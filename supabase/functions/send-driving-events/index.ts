import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://dvizh-school.ru",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const bearer = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  if (!bearer) return reply({ error: "Unauthorized" }, 401);
  if (!url || !anon || !service || !appId || !apiKey) return reply({ error: "Missing configuration" }, 500);
  const authClient = createClient(url, anon, { global: { headers: { Authorization: bearer } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return reply({ error: "Unauthorized" }, 401);
  const db = createClient(url, service);
  const { data: events, error } = await db.rpc("claim_driving_notification_events", { target_student_id: user.id });
  if (error) return reply({ error: "Unable to claim events" }, 500);
  const failures: string[] = [];
  for (const event of events ?? []) {
    try {
      const { data: instructor } = await db.from("profiles").select("full_name").eq("id", event.instructor_id).maybeSingle();
      const when = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(event.start_at));
      const booked = event.event_type === "booked";
      const title = booked ? "Запись на вождение подтверждена" : "Занятие по вождению отменено";
      const message = booked
        ? `Вы записаны на вождение ${when}. Инструктор: ${instructor?.full_name ?? "не указан"}.`
        : `Занятие по вождению ${when} отменено. Инструктор: ${instructor?.full_name ?? "не указан"}.`;
      const { data: thread, error: threadError } = await db.from("message_threads")
        .insert({ subject: title, created_by: null, is_group: false }).select("id").single();
      if (threadError || !thread) throw threadError ?? new Error("Thread not created");
      const { data: saved, error: messageError } = await db.from("messages")
        .insert({ thread_id: thread.id, sender_id: null, body: message, message_type: "notification", allow_reply: false })
        .select("id").single();
      if (messageError || !saved) throw messageError ?? new Error("Message not created");
      const { error: recipientError } = await db.from("message_recipients")
        .insert({ message_id: saved.id, recipient_id: user.id, delivery_status: "sending" });
      if (recipientError) throw recipientError;
      let sent = false;
      let notificationId: string | null = null;
      try {
        const response = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
          body: JSON.stringify({
            app_id: appId, target_channel: "push",
            include_aliases: { external_id: [user.id] },
            headings: { en: title }, contents: { en: message },
            web_url: "https://dvizh-school.ru/student/practice",
            data: { path: "/student/practice", messageId: saved.id, threadId: thread.id, eventId: event.id },
          }),
        });
        const responseData = await response.json();
        sent = response.ok;
        notificationId = responseData.id ?? null;
      } catch (pushError) {
        console.error("Driving notification push error", pushError);
      }
      await db.from("message_recipients").update({
        delivery_status: sent ? "sent" : "error",
        onesignal_notification_id: notificationId,
        sent_at: sent ? new Date().toISOString() : null,
        error_message: sent ? null : "Push request failed",
      }).eq("message_id", saved.id);
      await db.from("driving_notification_events").update({
        status: sent ? "sent" : "error",
        error_message: sent ? null : "Push request failed; message saved in history",
        processed_at: new Date().toISOString(),
      }).eq("id", event.id);
      if (!sent) failures.push(event.id);
    } catch (err) {
      console.error("Driving notification event error", event.id, err);
      await db.from("driving_notification_events").update({ status: "error", error_message: "Notification processing failed" }).eq("id", event.id);
      failures.push(event.id);
    }
  }
  return reply({ processed: (events ?? []).length, failures: failures.length });
});
