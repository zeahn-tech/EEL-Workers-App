// Supabase Edge Function: send-push
//
// Triggered by the database trigger in supabase/push-notifications.sql every time a new
// row is inserted into public.messages. Looks up who should be notified, fetches their
// saved push subscriptions, and asks the browser vendor's push service to deliver a
// notification — this is what actually reaches someone whose browser is fully closed,
// which nothing else in this app can do (everything else needs a live connection).
//
// See supabase/functions/send-push/README.md for exact deployment steps.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("https://gzmaopvcoxkrvffkwzlx.supabase.co")!;
const SERVICE_ROLE_KEY = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6bWFvcHZjb3hrcnZmZmt3emx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODE5MDMxMSwiZXhwIjoyMTAzNzY2MzExfQ.rEi7CETEC5fBBWmMH5-86rLqEIt1YawAD3891ngmPNA")!;
const VAPID_PUBLIC_KEY = Deno.env.get("BP0wZYCMnedKPLCNxDGUiGNWmiqqW7ZcobzyqcxDLeMpTI22Iu0m7uIZZ_RzHwFfq3VqfXD0G84Y5XlAATJjYu4")!;
const VAPID_PRIVATE_KEY = Deno.env.get("beL4dZ0E8vYHuMLR06Bw5sxEM1_oFKC2UmTphVlgJ3Q")!;
const WEBHOOK_SECRET = Deno.env.get("v7Kq9mX2pL8zR4nT6wY3cH9sF1aB5dE8uJ0kN7qP4xZ6m")!;
// Web Push requires a contact URI in the VAPID claims (browsers use this to reach you if
// your server is misbehaving) — set VAPID_SUBJECT as a secret to your own email/site if
// you want it to be something specific; this default works but is generic.
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:emmanuelzeahn45@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    // Authenticates the caller (our own database trigger, via pg_net) — without this,
    // this function's public URL would let a stranger POST to it directly and send
    // arbitrary push notifications to your entire staff.
    if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const message = await req.json();
    const { chat_id, sender_id, sender_name, type, content } = message;

    if (!chat_id || !sender_id) {
      return new Response("Missing chat_id or sender_id", { status: 400 });
    }

    // Same logic the client uses to tell a DM from a group (see ChatContext.jsx's
    // threadKeyFor): a group message's chat_id matches a real group's id; a DM's
    // chat_id IS the recipient's own user id, not a separate "conversation id".
    const { data: group } = await supabase
      .from("groups")
      .select("members")
      .eq("id", chat_id)
      .maybeSingle();

    const recipientIds: string[] = group
      ? (group.members || []).filter((id: string) => id !== sender_id)
      : [chat_id].filter((id) => id !== sender_id);

    if (recipientIds.length === 0) {
      return new Response("No recipients", { status: 200 });
    }

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", recipientIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response("No subscriptions for recipients", { status: 200 });
    }

    const preview = type === "text" ? content
      : type === "image" ? "📷 Sent a photo"
      : type === "file" ? "📎 Sent a file"
      : type === "voice" ? "🎤 Sent a voice note"
      : type === "location" ? "📍 Shared a location"
      : "New message";

    const payload = JSON.stringify({
      title: sender_name,
      body: preview,
      tag: chat_id
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    // A 404/410 means the browser permanently revoked this subscription (site data
    // cleared, notifications disabled at the OS level, etc.) — clean those up now
    // rather than retrying a dead endpoint on every single future message forever.
    const staleEndpoints: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const statusCode = (result.reason as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(subscriptions[i].endpoint);
        } else {
          console.error("push send failed:", result.reason);
        }
      }
    });
    if (staleEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
