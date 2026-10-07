# OneSignal Event Stream → Supabase delivery status

This integration updates `message_recipients.delivery_status` from OneSignal push events.

## 1. Supabase secret

Create a random secret and add it to the Edge Function environment as:

`ONESIGNAL_EVENT_STREAM_SECRET`

Do not put this secret in the frontend or repository.

## 2. Deploy the Edge Function

Deploy:

`supabase/functions/onesignal-event-stream/index.ts`

The public endpoint is:

`https://dznjopipisdfrojlpxrz.supabase.co/functions/v1/onesignal-event-stream`

JWT verification for this webhook endpoint must be disabled because OneSignal is the caller. Authentication is performed with the private `X-Webhook-Secret` header instead.

## 3. Configure OneSignal Event Stream

In OneSignal, create an Event Stream destination that POSTs to the function URL above.

Add request header:

`X-Webhook-Secret: <same value as ONESIGNAL_EVENT_STREAM_SECRET>`

Use a JSON body with these keys:

```json
{
  "event_kind": "{{ event.kind }}",
  "event_id": "{{ event.id }}",
  "event_datetime": "{{ event.datetime }}",
  "event_external_id": "{{ event.external_id }}",
  "event_subscription_id": "{{ event.subscription_id }}",
  "event_subscription_device_type": "{{ event.subscription_device_type }}",
  "failure_reason": "{{ event.failure_reason }}",
  "message_id": "{{ message.id }}"
}
```

Enable push lifecycle events that OneSignal exposes for sent/received/failed/unsubscribed. The receiver normalizes the event kind and updates the matching recipient using:

- OneSignal message ID → `message_recipients.onesignal_notification_id`
- External ID → `message_recipients.recipient_id`

## 4. Result

- push received → `delivery_status = delivered`, `delivered_at` set
- push sent → `delivery_status = sent`
- push failed/unsubscribed → `delivery_status = error`
- duplicate webhook events are ignored by `event_id`

All raw events are stored in `onesignal_message_events` for troubleshooting.

## Notes

Confirmed Delivery depends on OneSignal/platform support. Some browser/platform combinations may not produce a confirmed-received event even when the push was shown, so `sent` and `delivered` must remain separate statuses.
