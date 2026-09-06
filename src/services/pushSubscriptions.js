import { getSupabaseClient } from './supabaseClient';

// Saves a device's push subscription so the send-push Edge Function can find it later —
// without a row here, that function has no way to know this device exists at all, no
// matter how correctly everything else is configured. Upserts on endpoint (the browser's
// own unique identifier for this subscription) so re-subscribing the same device never
// creates a duplicate row.
export const savePushSubscription = async (userId, subscription) => {
  const supabase = getSupabaseClient();
  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth
  }, { onConflict: 'endpoint' });
  if (error) console.error('[pushSubscriptions] savePushSubscription failed:', error.message);
  return { success: !error, error: error?.message };
};

// Removes a subscription — used when the person explicitly disables notifications, or a
// browser permission gets revoked and re-subscribing fails.
export const deletePushSubscription = async (endpoint) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) console.error('[pushSubscriptions] deletePushSubscription failed:', error.message);
};
