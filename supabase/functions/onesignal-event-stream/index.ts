import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface OneSignalEventPayload {
  event_kind?: string;
  event_id?: string;
  event_datetime?: string;
  event_external_id?: string;
  event_subscription_id?: string;
  event_subscription_device_type?: string;
  failure_reason?: string;
  message_id?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeEventDate(value?: string) {
  const raw = value?.trim();
  if (!raw) return new Date().toISOString();

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    const milliseconds = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString();

  return new Date().toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const expectedSecret = Deno.env.get("ONESIGNAL_EVENT_STREAM_SECRET");
    const receivedSecret = req.headers.get("X-Webhook-Secret");

    if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server configuration error" }, 500);
    }

    const payload: OneSignalEventPayload = await req.json();
    const eventKind = payload.event_kind?.trim();
    const eventId = payload.event_id?.trim();
    const messageId = payload.message_id?.trim();
    const externalId = payload.event_external_id?.trim();

    if (!eventKind || !eventId || !messageId) {
      return json({ error: "Missing required event fields" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing } = await admin
      .from("onesignal_message_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) return json({ success: true, duplicate: true });

    const eventAt = normalizeEventDate(payload.event_datetime);
    const recipientId = externalId || null;

    const { error: insertError } = await admin
      .from("onesignal_message_events")
      .insert({
        event_id: eventId,
        event_kind: eventKind,
        onesignal_message_id: messageId,
        recipient_id: recipientId,
        subscription_id: payload.event_subscription_id?.trim() || null,
        device_type: payload.event_subscription_device_type?.trim() || null,
        event_at: eventAt,
        failure_reason: payload.failure_reason?.trim() || null,
      });

    if (insertError) {
      console.error("Failed to store OneSignal event:", insertError);
      return json({ error: "Failed to store event" }, 500);
    }

    if (!recipientId) {
      return json({ success: true, updated: false, reason: "No external_id" });
    }

    const normalizedKind = eventKind.toLowerCase()

    if (normalizedKind.includes("push") && normalizedKind.includes("received")) {
      const { error } = await admin
        .from("message_recipients")
        .update({
          delivery_status: "delivered",
          delivered_at: eventAt,
          error_message: null,
        })
        .eq("onesignal_notification_id", messageId)
        .eq("recipient_id", recipientId);

      if (error) {
        console.error("Failed to mark delivered:", error);
        return json({ error: "Failed to update delivery status" }, 500);
      }
    } else if (
      normalizedKind.includes("push")
      && (normalizedKind.includes("failed") || normalizedKind.includes("unsubscribed"))
    ) {
      const { error } = await admin
        .from("message_recipients")
        .update({
          delivery_status: "error",
          error_message: payload.failure_reason?.trim() || (
            normalizedKind.includes("unsubscribed")
              ? "Push subscription is unsubscribed"
              : "OneSignal push failed"
          ),
        })
        .eq("onesignal_notification_id", messageId)
        .eq("recipient_id", recipientId);

      if (error) {
        console.error("Failed to mark push error:", error);
        return json({ error: "Failed to update delivery status" }, 500);
      }
    } else if (normalizedKind.includes("push") && normalizedKind.includes("sent")) {
      const { error } = await admin
        .from("message_recipients")
        .update({
          delivery_status: "sent",
          sent_at: eventAt,
          error_message: null,
        })
        .eq("onesignal_notification_id", messageId)
        .eq("recipient_id", recipientId)
        .neq("delivery_status", "delivered");

      if (error) {
        console.error("Failed to mark push sent:", error);
        return json({ error: "Failed to update sent status" }, 500);
      }
    }

    return json({ success: true });
  } catch (error) {
    console.error("onesignal-event-stream error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
