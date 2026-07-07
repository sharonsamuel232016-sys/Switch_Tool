# Setting up "Email Report to Manager"

The Telematics Dashboard can email the generated PDF report directly to
your manager. Since this app is a static site (no server of its own), the
actual sending is done by a small serverless function that keeps your email
API key private. This guide sets that up — takes about 10 minutes, free.

## Why not just send email from the browser directly?
Anyone can view-source a webpage. If your email service's API key or
password were in `telematics.js`, anyone visiting the site could copy it
and send email as you. The serverless function below keeps that key on
Netlify's servers instead, where only your function code can read it.

## What you need
- Your site deployed on **Netlify** (see the earlier hosting instructions —
  GitHub repo connected to Netlify).
- A free **Resend** account (https://resend.com) — a transactional email
  API with a generous free tier (3,000 emails/month at time of writing).

## 1. Create a Resend account and API key
1. Sign up at https://resend.com
2. Go to **API Keys** → **Create API Key** → copy it (starts with `re_`).
3. (Optional but recommended for production) Go to **Domains** → add and
   verify your company domain (adds a couple of DNS records) so emails come
   from `reports@yourcompany.com` instead of Resend's shared test address.
   Skipping this is fine for trying it out — Resend lets you send from
   `onboarding@resend.dev` without domain verification, but only to your
   own verified account email until a domain is added.

## 2. Add the function's files to your repo
This project already includes:
- `netlify/functions/send-report.js` — the function that sends the email
- `netlify.toml` — tells Netlify where to find it

Make sure both are committed and pushed to your GitHub repo (same repo
Netlify is deployed from).

## 3. Add your API key to Netlify (never commit it to git)
1. In Netlify: your site → **Site configuration** → **Environment
   variables** → **Add a variable**.
2. Add:
   - `RESEND_API_KEY` = `re_xxxxxxxxxxxxxxxx` (your key from step 1)
   - `REPORT_FROM` = `SWITCH Reports <reports@yourcompany.com>` (or leave
     unset to use Resend's shared test sender while trying it out)
3. Save, then trigger a redeploy (Netlify → **Deploys** → **Trigger
   deploy**) so the function picks up the new variables.

## 4. Try it
1. Open your deployed site → Telematics tab → upload a file.
2. Type a manager's email into the **Manager's Email** field in the top
   bar (it's remembered in your browser for next time).
3. Click **⬇ Export Report** → **📧 Email PDF to Manager**.
4. You should see "Report emailed to ...". Check the inbox (and spam
   folder, especially before a domain is verified).

## Troubleshooting
- **"Server is missing RESEND_API_KEY"** — the environment variable isn't
  set, or you didn't redeploy after adding it.
- **"Resend API error: ..."** — read the message; common ones:
  - Sending to an address other than your own account email, without
    having verified a domain yet (Resend restricts this in test mode).
  - Malformed `REPORT_FROM` — must be `Name <email@domain>` or a bare
    verified email.
- **Nothing happens / network error** — make sure the site is actually
  deployed on **Netlify** (not GitHub Pages) since GitHub Pages can't run
  serverless functions. Netlify's function path is always
  `/.netlify/functions/<name>` regardless of your custom domain.
- **Emails land in spam** — expected until you verify a sending domain in
  Resend (step 1.3); this adds SPF/DKIM records that mail providers use to
  trust the sender.

## Alternative: no server code at all (EmailJS)
If you'd rather not deploy a function, **EmailJS** can send from pure
front-end JavaScript with no backend. The tradeoff: file attachments on
EmailJS require at least their paid "Personal" plan (their free tier only
supports plain emails, no attachments). If that's an acceptable tradeoff
for your team, EmailJS's dynamic-attachment docs are here:
https://www.emailjs.com/docs/user-guide/file-attachments/
