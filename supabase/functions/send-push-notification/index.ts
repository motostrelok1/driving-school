import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface PushPayload {
  userId?: string;
  userIds?: string[];
  title?: string;
  message: string;
  messageType?: "notification" | "message";
  allowReply?: boolean;
  threadId?: string;
  isGroup?: boolean;
  action?: "reply";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dvizh-school.ru",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !oneSignalAppId || !oneSignalApiKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileError || !profile) return jsonResponse({ error: "Forbidden" }, 403);

    const body: PushPayload = await req.json();
    const message = body.message?.trim();
    if (!message) return jsonResponse({ error: "message is required" }, 400);

    async function sendPush(targetIds: string[], title: string, path: string, messageId: string) {
      if (targetIds.length === 0) return { ok: true, id: null };
      const response = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${oneSignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: oneSignalAppId,
          target_channel: "push",
          include_aliases: { external_id: targetIds },
          headings: { en: title },
          contents: { en: message },
          web_url: `https://dvizh-school.ru${path}`,
          data: { messageId, threadId: body.threadId ?? null, path },
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        console.error("OneSignal error:", result);
        return { ok: false, id: null, details: result };
      }
      return { ok: true, id: result.id ?? null };
    }

    if (body.action === "reply") {
      const threadId = body.threadId?.trim();
      if (!threadId) return jsonResponse({ error: "threadId is required" }, 400);

      const { data: thread } = await adminSupabase
        .from("message_threads")
        .select("id, subject, created_by")
        .eq("id", threadId)
        .maybeSingle();
      if (!thread?.created_by) return jsonResponse({ error: "Conversation not found" }, 404);

      const { data: membership } = await adminSupabase
        .from("message_thread_participants")
        .select("user_id")
        .eq("thread_id", threadId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership && profile.role !== "admin") {
        return jsonResponse({ error: "Reply is not allowed" }, 403);
      }

      const { data: savedReply, error: replyError } = await adminSupabase
        .from("messages")
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          body: message,
          message_type: "message",
          allow_reply: true,
        })
        .select("id")
        .single();

      if (replyError || !savedReply) return jsonResponse({ error: "Failed to save reply" }, 500);

      const { data: participants = [] } = await adminSupabase
        .from("message_thread_participants")
        .select("user_id")
        .eq("thread_id", threadId);

      const studentRecipients = participants
        .map((item) => item.user_id as string)
        .filter((id) => id !== user.id);
      const adminRecipients = thread.created_by !== user.id ? [thread.created_by] : [];
      const allRecipients = Array.from(new Set([...studentRecipients, ...adminRecipients]));

      if (allRecipients.length > 0) {
        const { error: recipientError } = await adminSupabase
          .from("message_recipients")
          .insert(allRecipients.map((recipientId) => ({
            message_id: savedReply.id,
            recipient_id: recipientId,
            delivery_status: "sending",
          })));
        if (recipientError) return jsonResponse({ error: "Failed to save reply recipients" }, 500);
      }

      await adminSupabase.from("message_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);

      const title = thread.subject || "Новое сообщение";
      let pushFailed = false;
      let notificationId: string | null = null;

      if (adminRecipients.length > 0) {
        const result = await sendPush(adminRecipients, title, "/admin/messages?tab=message", savedReply.id);
        pushFailed ||= !result.ok;
        notificationId = result.id ?? notificationId;
      }
      if (studentRecipients.length > 0) {
        const result = await sendPush(studentRecipients, title, "/student/messages?tab=message", savedReply.id);
        pushFailed ||= !result.ok;
        notificationId = result.id ?? notificationId;
      }

      if (allRecipients.length > 0) {
        await adminSupabase
          .from("message_recipients")
          .update({
            delivery_status: pushFailed ? "error" : "sent",
            onesignal_notification_id: notificationId,
            sent_at: pushFailed ? null : new Date().toISOString(),
            error_message: pushFailed ? "Push delivery request failed" : null,
          })
          .eq("message_id", savedReply.id);
      }

      return jsonResponse({ success: true, messageId: savedReply.id, pushFailed });
    }

    if (profile.role !== "admin") return jsonResponse({ error: "Forbidden" }, 403);

    const title = body.title?.trim();
    const messageType = body.messageType === "message" ? "message" : "notification";
    const allowReply = messageType === "message" && body.allowReply === true;
    const requestedIds = Array.from(new Set([
      ...(body.userIds ?? []),
      ...(body.userId ? [body.userId] : []),
    ].map((id) => id.trim()).filter(Boolean)));

    if (!title || requestedIds.length === 0) {
      return jsonResponse({ error: "title and at least one recipient are required" }, 400);
    }

    let activeThreadId = body.threadId?.trim() || null;
    let recipientIds = requestedIds;

    if (activeThreadId) {
      const { data: existingThread } = await adminSupabase
        .from("message_threads")
        .select("id")
        .eq("id", activeThreadId)
        .maybeSingle();
      if (!existingThread) return jsonResponse({ error: "Conversation not found" }, 404);

      if (messageType === "message") {
        const { data: participants = [] } = await adminSupabase
          .from("message_thread_participants")
          .select("user_id")
          .eq("thread_id", activeThreadId);
        recipientIds = participants.map((item) => item.user_id as string);
      }
    } else {
      const { data: thread, error: threadError } = await adminSupabase
        .from("message_threads")
        .insert({
          subject: title,
          created_by: user.id,
          is_group: messageType === "message" && (body.isGroup === true || requestedIds.length > 1),
        })
        .select("id")
        .single();

      if (threadError || !thread) return jsonResponse({ error: "Failed to save message" }, 500);
      activeThreadId = thread.id;

      if (messageType === "message") {
        const { error: participantsError } = await adminSupabase
          .from("message_thread_participants")
          .insert(requestedIds.map((recipientId) => ({
            thread_id: activeThreadId,
            user_id: recipientId,
          })));
        if (participantsError) {
          await adminSupabase.from("message_threads").delete().eq("id", activeThreadId);
          return jsonResponse({ error: "Failed to save chat participants" }, 500);
        }
      }
    }

    const { data: savedMessage, error: messageError } = await adminSupabase
      .from("messages")
      .insert({
        thread_id: activeThreadId,
        sender_id: user.id,
        body: message,
        message_type: messageType,
        allow_reply: allowReply,
      })
      .select("id")
      .single();

    if (messageError || !savedMessage) return jsonResponse({ error: "Failed to save message" }, 500);

    const { error: recipientError } = await adminSupabase
      .from("message_recipients")
      .insert(recipientIds.map((recipientId) => ({
        message_id: savedMessage.id,
        recipient_id: recipientId,
        delivery_status: "sending",
      })));

    if (recipientError) return jsonResponse({ error: "Failed to save message recipients" }, 500);

    const path = messageType === "message"
      ? "/student/messages?tab=message"
      : "/student/messages";
    const pushResult = await sendPush(recipientIds, title, path, savedMessage.id);

    await adminSupabase.from("message_recipients").update({
      delivery_status: pushResult.ok ? "sent" : "error",
      onesignal_notification_id: pushResult.id,
      sent_at: pushResult.ok ? new Date().toISOString() : null,
      error_message: pushResult.ok ? null : "Push delivery request failed",
    }).eq("message_id", savedMessage.id);

    if (!pushResult.ok) {
      return jsonResponse({ error: "Failed to send notification", details: pushResult.details }, 502);
    }

    return jsonResponse({
      success: true,
      notificationId: pushResult.id,
      messageId: savedMessage.id,
      threadId: activeThreadId,
    });
  } catch (error) {
    console.error("send-push-notification error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
