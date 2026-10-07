import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dvizh-school.ru",
  "Access-Control-Allow-Headers": "content-type, x-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("DRIVING_REMINDER_SECRET");
  const providedSecret = req.headers.get("X-Reminder-Secret");
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
  const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !oneSignalAppId || !oneSignalApiKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

    const { data: slots, error: slotsError } = await supabase
      .from("driving_slots")
      .select("id, student_id, instructor_id, start_at, duration_minutes, instructor:profiles!driving_slots_instructor_id_fkey(full_name)")
      .eq("status", "booked")
      .not("student_id", "is", null)
      .gte("start_at", windowStart.toISOString())
      .lt("start_at", windowEnd.toISOString())
      .order("start_at", { ascending: true });

    if (slotsError) return json({ error: slotsError.message }, 500);

    let sent = 0;
    let skipped = 0;
    const failures: Array<{ slotId: string; error: string }> = [];

    for (const slot of slots ?? []) {
      const studentId = slot.student_id as string | null;
      if (!studentId) {
        skipped += 1;
        continue;
      }

      const { data: existing } = await supabase
        .from("driving_lesson_reminders")
        .select("id")
        .eq("slot_id", slot.id)
        .eq("reminder_type", "24h")
        .maybeSingle();

      if (existing) {
        skipped += 1;
        continue;
      }

      const start = new Date(slot.start_at);
      const instructorName =
        (slot.instructor as { full_name?: string | null } | null)?.full_name ?? null;
      const title = "Напоминание о занятии";
      const message = instructorName
        ? `Завтра в ${start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} у вас занятие по вождению. Инструктор: ${instructorName}.`
        : `Завтра в ${start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} у вас занятие по вождению.`;

      const { data: thread, error: threadError } = await supabase
        .from("message_threads")
        .insert({
          subject: title,
          created_by: null,
          is_group: false,
        })
        .select("id")
        .single();

      if (threadError || !thread) {
        failures.push({ slotId: slot.id, error: threadError?.message ?? "Failed to create thread" });
        continue;
      }

      const { data: savedMessage, error: messageError } = await supabase
        .from("messages")
        .insert({
          thread_id: thread.id,
          sender_id: null,
          body: message,
          message_type: "notification",
          allow_reply: false,
        })
        .select("id")
        .single();

      if (messageError || !savedMessage) {
        failures.push({ slotId: slot.id, error: messageError?.message ?? "Failed to save message" });
        await supabase.from("message_threads").delete().eq("id", thread.id);
        continue;
      }

      const { error: recipientError } = await supabase
        .from("message_recipients")
        .insert({
          message_id: savedMessage.id,
          recipient_id: studentId,
          delivery_status: "sending",
        });

      if (recipientError) {
        failures.push({ slotId: slot.id, error: recipientError.message });
        continue;
      }

      const response = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${oneSignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: oneSignalAppId,
          target_channel: "push",
          include_aliases: { external_id: [studentId] },
          headings: { en: title },
          contents: { en: message },
          web_url: "https://dvizh-school.ru/student/practice",
          data: {
            messageId: savedMessage.id,
            threadId: thread.id,
            path: "/student/practice",
            reminderType: "24h",
            slotId: slot.id,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        await supabase
          .from("message_recipients")
          .update({
            delivery_status: "error",
            error_message: "Push delivery request failed",
          })
          .eq("message_id", savedMessage.id);

        failures.push({
          slotId: slot.id,
          error: typeof result === "object" ? JSON.stringify(result) : String(result),
        });
        continue;
      }

      await supabase
        .from("message_recipients")
        .update({
          delivery_status: "sent",
          onesignal_notification_id: result.id ?? null,
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("message_id", savedMessage.id);

      const { error: reminderError } = await supabase
        .from("driving_lesson_reminders")
        .insert({
          slot_id: slot.id,
          student_id: studentId,
          reminder_type: "24h",
        });

      if (reminderError) {
        failures.push({ slotId: slot.id, error: reminderError.message });
        continue;
      }

      sent += 1;
    }

    return json({ success: true, sent, skipped, failures });
  } catch (error) {
    console.error("send-driving-reminders error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
