# Kinton Technologies website - setup guide

The site works straight away in **demo mode** (open it, sign up, click around; data stays in your own browser).
To go **live** with real accounts, orders and an admin dashboard, do these 4 steps. No coding needed, only copy and paste.

## 1. Put the files on GitHub
Upload everything in this folder to the root of your repo (keep the `assets` folder). Delete the old `portfolio.html` and `main.js`.
In the repo: Settings > Pages > turn on **Enforce HTTPS**.

## 2. Create the database (Firebase, free plan is enough to start)
1. Go to https://console.firebase.google.com and click **Add project**.
2. **Build > Authentication > Get started > Email/Password > Enable**.
3. **Build > Firestore Database > Create database** (production mode, pick a region near you).
4. **Firestore > Rules**: delete everything, paste the whole of `firestore.rules`, click **Publish**.
5. **Project settings (gear) > Your apps > Web (</>)**: register an app, then copy the `firebaseConfig` values
   (apiKey, authDomain, projectId, appId) into `config.js`.
6. **Authentication > Settings > Authorized domains**: add `kintontechnologies.co.zw`.

These Firebase keys are NOT secrets. The rules in step 4 are what protect your data.

## 3. Create YOUR owner (main admin) account
1. Open your live site, go to **Create account**, make a normal customer account with your email.
2. In Firebase: **Authentication > Users**, copy your **User UID**.
3. **Firestore Database > Start collection** named `admins`. Document ID = your UID. Add fields:
   - `name` (string) = your name
   - `email` (string) = your email
   - `role` (string) = `owner`
   - `perms` (array) = leave empty
   - `suspended` (boolean) = `false`
4. Sign in with the **Staff / Admin** option. You now see the full dashboard.
The owner account can never be edited, suspended or removed from the website. Only from the Firebase console.
After this you add staff from **Dashboard > Staff & users**; they get an email to set their own password.

## 4. reCAPTCHA (stops bots)
1. https://www.google.com/recaptcha/admin > **Create** > type **reCAPTCHA v2 "I'm not a robot"** > add domain `kintontechnologies.co.zw`.
2. Copy the **Site key** into `recaptchaSiteKey` in `config.js`.
3. NEVER put the **Secret key** in any file on GitHub.

Recommended extra: Firebase **App Check** with reCAPTCHA v3 (Build > App Check). Paste its site key in `appCheckSiteKey`.
It makes Firebase itself refuse requests that do not come from your real site. A checkbox alone can be bypassed by someone who talks to the database directly, App Check closes that gap.

## What each dashboard section does
- **Overview**: customers, active projects, orders, revenue, things waiting on you, system health, recent activity.
- **Products / Orders**: the shop catalog and customer orders. Change order status, WhatsApp the customer, create an invoice.
- **Invoices & payments**: invoices (print or save as PDF), record payments and refunds (cash, EcoCash, bank), reconciliation.
  It records money you receive. It does not process payments.
- **Client projects**: quotes, deadlines, progress, assigned person, links to client files.
- **KintonTech Labs**: your own products. Public ones appear on the Labs page with roadmap and releases.
- **Support**: customer tickets with replies, and messages from the contact form.
- **Website content**: edit the main wording and an announcement bar without touching code.
- **Staff & users**: create staff, set which sections each can use, suspend accounts, approve requests.

## Good to know
- Prices and Labs items in the starter data are SAMPLES. Edit or delete them in the dashboard.
- "Suspend" blocks a person from signing in on the site and from ordering or opening tickets. It does not delete their Firebase login.
- `terms.html` and `privacy.html` are plain-language starting drafts. Have a lawyer check them as the business grows.
- Updating the site: edit the `.html` files directly in GitHub. Header and footer are repeated in each page.

## Visitor analytics (Dashboard > Analytics)
1. Publish the latest `firestore.rules` (it adds the `hits` and `live` collections).
2. Upload all website files, including the new `track.js`, `motion.js`, `modern.css`, `admin-stats.js`, `manifest.webmanifest` and `sw.js`.
3. Open Dashboard > Analytics. Owners and admins see it automatically. For staff, tick **Analytics** in Staff & users.
Visits are anonymous (no names, emails, IP addresses or cookies). Staff visits are never counted.

## Direct EcoCash payments (EcoCash Instant Payments)
EcoCash can be charged straight through EcoCash's own API instead of Paynow. The customer gets the PIN prompt on their phone and never leaves our page.
InnBucks, Zimswitch and the other methods still go through Paynow.

It switches on by itself when the settings below exist on Render (Environment tab). Remove `EIP_USERNAME` and EcoCash goes back through Paynow.

| Setting | Where to get it |
| --- | --- |
| `EIP_BASE_URL` | Sandbox: `https://developers.ecocash.co.zw/sandbox/payment/v1`. Live: the address EcoCash sends with your production credentials. |
| `EIP_USERNAME`, `EIP_PASSWORD` | developers.ecocash.co.zw > Instant Payments > Credentials (the password is in the portal Inbox) |
| `EIP_MERCHANT_CODE`, `EIP_MERCHANT_PIN`, `EIP_MERCHANT_NUMBER` | Same page, "Sandbox test values" |
| `EIP_TERMINAL_ID`, `EIP_MERCHANT_NAME` | Same page. If you cannot see them, ask EcoCash support. |
| `EIP_SUPER_MERCHANT_NAME`, `EIP_LOCATION`, `EIP_CHANNEL`, `EIP_CURRENCY` | Optional. Defaults: `ECOCASH`, `Harare`, `WEB`, `USD`. |

Never put these in GitHub. They only live on Render.

Testing in the sandbox:
1. In the portal, add your own EcoCash number under **Test Numbers** and verify it with the code EcoCash sends. Only verified numbers can be charged.
2. Pay on pay.html with that number. On your phone enter PIN `0000` to succeed, `1111` not enough money, `2222` wrong PIN, `9999` limit exceeded.
3. Run all of these, then use the portal's Production tab to send your test evidence and ask for live credentials.

Things EcoCash has not published, so ask their support before going live: the callback format (we check the result by asking EcoCash instead of waiting for a callback) and whether the amount must be sent as text like `"1.00"` (that is what we send).
