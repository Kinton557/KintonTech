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
