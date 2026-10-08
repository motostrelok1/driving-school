import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dvizh-school.ru",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const key = Deno.env.get("ONESIGNAL_REST_API_KEY");
  if (!url || !anon || !service || !appId || !key) return json({ error: "Server configuration error" }, 500);
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const server = createClient(url, service);
  let claim: { id: string; notification_claimed_at: string } | null = null;
  try {
    const { data: { user }, error: authError } = await client.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return json({ error: "Forbidden" }, 403);
    const body = await req.json();
    const assessmentId = body.assessmentId;
    if (typeof assessmentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId)) return json({ error: "Invalid assessment" }, 400);
    const { data: existing, error: lookupError } = await server.from("theory_assessments")
      .select("id, cancelled_at, deadline_at, notification_sent_at").eq("id", assessmentId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing || existing.cancelled_at || Date.parse(existing.deadline_at) <= Date.now()) return json({ error: "Назначение отменено или срок истёк" }, 400);
    if (existing.notification_sent_at) return json({ success: true, alreadySent: true });
    const { data: rows, error: claimError } = await server.rpc("claim_theory_assignment_notification", { p_id: assessmentId });
    if (claimError) throw claimError;
    const assessment = rows?.[0];
    if (!assessment) return json({ success: false, warning: "Уведомление уже отправляется. Проверьте статус через минуту." });
    claim = { id: assessment.id, notification_claimed_at: assessment.notification_claimed_at };
    const format = (value: string) => new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short",
    }).format(new Date(value));
    const kind = assessment.kind === "internal_exam" ? "Внутренний экзамен" : "Промежуточный зачёт";
    const title = "Назначено тестирование";
    const message = `${kind}: ${assessment.question_count} вопросов, ${assessment.time_limit_minutes} мин. Доступно с ${format(assessment.opens_at)} до ${format(assessment.deadline_at)} (МСК). Откройте раздел «Теория → Тестирование».`;
    // Один ID назначения для одной записи истории и одного ключа OneSignal.
    const { error: threadError } = await server.from("message_threads").upsert({ id: assessment.id, subject: title, created_by: user.id }, { onConflict: "id", ignoreDuplicates: true });
    if (threadError) throw threadError;
    const { error: messageError } = await server.from("messages").upsert({
      id: assessment.id, thread_id: assessment.id, sender_id: user.id, body: message, message_type: "notification", allow_reply: false,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (messageError) throw messageError;
    const { error: recipientError } = await server.from("message_recipients").upsert({
      message_id: assessment.id, recipient_id: assessment.student_id, delivery_status: "sending",
    }, { onConflict: "message_id,recipient_id", ignoreDuplicates: true });
    if (recipientError) throw recipientError;
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ app_id: appId, target_channel: "push", idempotency_key: assessment.id,
        include_aliases: { external_id: [assessment.student_id] }, headings: { en: title }, contents: { en: message },
        web_url: "https://dvizh-school.ru/student/theory/testing",
        data: { messageId: assessment.id, path: "/student/theory/testing" },
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.id) {
      await server.from("message_recipients").update({ delivery_status: "error", error_message: "Push не отправлен. Уведомление сохранено в истории." }).eq("message_id", assessment.id);
      throw new Error("Push не отправлен. Уведомление сохранено в истории; можно повторить отправку.");
    }
    const sentAt = new Date().toISOString();
    const { error: statusError } = await server.from("message_recipients").update({ delivery_status: "sent", sent_at: sentAt, error_message: null, onesignal_notification_id: result.id }).eq("message_id", assessment.id);
    if (statusError) throw statusError;
    const { error: sentError } = await server.from("theory_assessments").update({ notification_sent_at: sentAt, notification_claimed_at: null })
      .eq("id", assessment.id).eq("notification_claimed_at", claim.notification_claimed_at);
    if (sentError) throw sentError;
    claim = null;
    return json({ success: true });
  } catch (error) {
    if (claim) await server.from("message_recipients").update({
      delivery_status: "error", error_message: "Не удалось подтвердить отправку push. Уведомление сохранено в истории; можно повторить отправку.",
    }).eq("message_id", claim.id);
    console.error("Theory assignment notification failed", error instanceof Error ? error.message : "Database operation failed");
    return json({ error: error instanceof Error ? error.message : "Не удалось отправить уведомление" }, 500);
  } finally {
    if (claim) await server.from("theory_assessments").update({ notification_claimed_at: null })
      .eq("id", claim.id).eq("notification_claimed_at", claim.notification_claimed_at);
  }
});
