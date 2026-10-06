import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface PushPayload {
  userId: string;
  title: string;
  message: string;
  messageType?: "notification" | "message";
  allowReply?: boolean;
  threadId?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dvizh-school.ru",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !oneSignalAppId || !oneSignalApiKey) {
      console.error("Required environment variables are missing");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Supabase auth.getUser failed:", {
        message: userError?.message ?? "No user returned",
        status: userError?.status ?? null,
        code: userError?.code ?? null,
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body: PushPayload = await req.json();
    const userId = body.userId?.trim();
    const title = body.title?.trim();
    const message = body.message?.trim();
    const threadId = body.threadId?.trim();
    const messageType = body.messageType === "message" ? "message" : "notification";
    const allowReply = messageType === "message" && body.allowReply === true;

    if (!userId || !title || !message) {
      return jsonResponse({ error: "userId, title and message are required" }, 400);
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    let activeThreadId = threadId ?? null;

    if (activeThreadId) {
      const { data: existingThread } = await adminSupabase
        .from("message_threads")
        .select("id")
        .eq("id", activeThreadId)
        .maybeSingle();
      if (!existingThread) return jsonResponse({ error: "Conversation not found" }, 404);
    } else {
      const { data: thread, error: threadError } = await adminSupabase
        .from("message_threads")
        .insert({ subject: title, created_by: user.id })
        .select("id")
        .single();

      if (threadError || !thread) {
        console.error("Failed to create message thread:", threadError);
        return jsonResponse({ error: "Failed to save message" }, 500);
      }
      activeThreadId = thread.id;
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

    if (messageError || !savedMessage) {
      console.error("Failed to create message:", messageError);
      if (!threadId) await adminSupabase.from("message_threads").delete().eq("id", activeThreadId);
      return jsonResponse({ error: "Failed to save message" }, 500);
    }

    const { data: recipient, error: recipientError } = await adminSupabase
      .from("message_recipients")
      .insert({
        message_id: savedMessage.id,
        recipient_id: userId,
        delivery_status: "sending",
      })
      .select("id")
      .single();

    if (recipientError || !recipient) {
      console.error("Failed to create message recipient:", recipientError);
      if (!threadId) await adminSupabase.from("message_threads").delete().eq("id", activeThreadId);
      return jsonResponse({ error: "Failed to save message recipient" }, 500);
    }

    const oneSignalResponse = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${oneSignalApiKey}`,
      },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        target_channel: "push",
        include_aliases: { external_id: [userId] },
        headings: { en: title },
        contents: { en: message },
        web_url: "https://dvizh-school.ru/student/messages",
        data: { messageId: savedMessage.id, path: "/student/messages" },
      }),
    });

    const oneSignalResult = await oneSignalResponse.json();

    if (!oneSignalResponse.ok) {
      console.error("OneSignal error:", oneSignalResult);
      await adminSupabase.from("message_recipients").update({
        delivery_status: "error",
        error_message: JSON.stringify(oneSignalResult),
      }).eq("id", recipient.id);
      return jsonResponse({
        error: "Failed to send notification",
        details: oneSignalResult,
      }, 502);
    }

    const notificationId = oneSignalResult.id ?? null;

    const { error: statusError } = await adminSupabase
      .from("message_recipients")
      .update({
        delivery_status: "sent",
        onesignal_notification_id: notificationId,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", recipient.id);

    if (statusError) {
      console.error("Failed to update message delivery status:", statusError);
    }

    return jsonResponse({
      success: true,
      notificationId,
      messageId: savedMessage.id,
    });
  } catch (error) {
    console.error("send-push-notification error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
