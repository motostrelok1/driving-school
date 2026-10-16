import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
Deno.serve(async req => {
  const allowedOrigin = Deno.env.get("FUNCTIONS_CORS_ORIGIN") ?? "https://dvizh-school.ru";
  const headers = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appId = Deno.env.get("ONESIGNAL_APP_ID")!, apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY")!;
  const authorization = req.headers.get("Authorization");
  if (!authorization) return new Response("Unauthorized", { status: 401, headers });
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers });
  const db = createClient(url, service);
  const { data: events, error } = await db.rpc("claim_instructor_chat_task_notifications", { target_student_id: user.id });
  if (error) return new Response("Claim failed", { status: 500, headers });
  for (const event of events ?? []) {
    try {
      const { data: names } = await db.from("profiles").select("id,role,full_name").in("id", [event.student_id, event.instructor_id]);
      const student = names?.find(x => x.id === event.student_id)?.full_name ?? "Ученик";
      const instructor = names?.find(x => x.id === event.instructor_id)?.full_name ?? "Инструктор";
      const title = "Ученик выбрал инструктора";
      const message = `${student} выбрал инструктора ${instructor}. Создайте общий чат в разделе «Задачи».`;
      const { data: admins, error: adminsError } = await db.from("profiles").select("id").eq("role", "admin");
      if (adminsError || !admins?.length) throw new Error("No admin recipients");
      const { data: thread, error: threadError } = await db.from("message_threads").insert({ subject: title, created_by: null, is_group: false }).select("id").single();
      if (threadError || !thread) throw new Error("Thread failed");
      const { data: saved, error: messageError } = await db.from("messages").insert({ thread_id: thread.id, sender_id: null, body: message, message_type: "notification", allow_reply: false }).select("id").single();
      if (messageError || !saved) throw new Error("Message failed");
      const { error: recipientsError } = await db.from("message_recipients").insert(admins.map(a => ({ message_id: saved.id, recipient_id: a.id, delivery_status: "sending" })));
      if (recipientsError) throw new Error("Recipients failed");
      let pushOk = false;
      try {
        const response = await fetch("https://api.onesignal.com/notifications", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` }, body: JSON.stringify({ app_id: appId, target_channel: "push", include_aliases: { external_id: admins.map(a => a.id) }, headings: { en: title }, contents: { en: message }, web_url: "https://dvizh-school.ru/admin/tasks" }) });
        pushOk = response.ok;
      } catch (pushError) { console.error(pushError); }
      await db.from("message_recipients").update({ delivery_status: pushOk ? "sent" : "error", sent_at: pushOk ? new Date().toISOString() : null }).eq("message_id", saved.id);
      await db.from("instructor_chat_tasks").update({ notification_status: pushOk ? "sent" : "error" }).eq("id", event.id);
    } catch (err) {
      console.error("Chat task notification error", err);
      await db.from("instructor_chat_tasks").update({ notification_status: "error" }).eq("id", event.id);
    }
  }
  return new Response(JSON.stringify({ processed: events?.length ?? 0 }), { headers: { ...headers, "Content-Type": "application/json" } });
});
