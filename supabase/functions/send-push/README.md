# Deploying push notifications

This is the one piece of this app that can't be deployed just by syncing files into
GitHub — an Edge Function is real server code that has to be deployed to Supabase
directly. Everything below only needs to be done once.

## 1. Install the Supabase CLI (one-time, on your own computer)

```powershell
npm install -g supabase
```

## 2. Generate your VAPID key pair (one-time)

This identifies your server to browser push services. Run this on your own machine —
never share the private key with anyone, including in chat, email, or a public repo.

```powershell
npx web-push generate-vapid-keys
```

This prints a Public Key and a Private Key. Save both somewhere safe — you'll need
them in steps 4 and 5.

## 3. Log in and link the CLI to your project

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is the short string in your Supabase project's URL, e.g. for
`https://abcdefghijk.supabase.co` it's `abcdefghijk`.

## 4. Deploy the function

From the root of this project (where the `supabase` folder is):

```powershell
supabase functions deploy send-push
```

## 5. Set the function's secrets

Make up a long random string for `WEBHOOK_SECRET` yourself (a password manager's
"generate password" feature works fine) — this is what stops a stranger from calling
your function directly and sending fake push notifications to your staff.

```powershell
supabase secrets set VAPID_PUBLIC_KEY="paste-your-public-key-here"
supabase secrets set VAPID_PRIVATE_KEY="paste-your-private-key-here"
supabase secrets set WEBHOOK_SECRET="make-up-a-long-random-string-here"
```

## 6. Wire up the database trigger

Open `supabase/push-notifications.sql` in this repo and replace the two placeholders
near the bottom:
- `YOUR_PROJECT_REF` → your project ref from step 3
- `YOUR_WEBHOOK_SECRET` → the exact same string you set in step 5

Then run the entire file in the Supabase SQL Editor.

## 7. Add your public key to the app itself

The public key is safe to expose client-side (that's what "public" means here) — it
needs to be baked into the app the same way your Supabase URL/Anon Key are. In your
GitHub repo: Settings → Secrets and variables → Actions → New repository secret:

- Name: `VITE_VAPID_PUBLIC_KEY`
- Value: the same public key from step 2

Push and let the Actions build run.

## 8. Test it

Open the app on a device, click the bell icon in the sidebar to enable notifications
(this now also subscribes that device to push, not just in-app alerts), then **close
the browser completely** on that device. Send it a message from a different account.
A real OS notification should appear within a few seconds, even though the app isn't
open anywhere.

## If it doesn't work

Check the Edge Function's logs: Supabase Dashboard → Edge Functions → send-push → Logs.
Every failure this function can hit (bad webhook secret, missing subscriptions, a
rejected push send) is logged there with the real underlying reason.
