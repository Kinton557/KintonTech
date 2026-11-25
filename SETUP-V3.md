# Kinton v3 setup: Google sign-in, email codes, real AI

Do these in order. Each one is optional and the site keeps working without it.

## 1. Google sign-in (Firebase console)
1. Authentication > Sign-in method > Google > Enable > Save.
2. Authentication > Settings > Authorized domains > Add: `kintontechnologies.co.zw` and `www.kintontechnologies.co.zw`.
3. Firestore Database > Rules > paste the whole `firestore.rules` from this folder > Publish.
   (Without this, new phone/address fields and Google profiles will not save.)

## 2. Email verification codes (free)
The code is sent by the Kinton server on Render through Brevo (free plan).
1. Create a free account at brevo.com. Settings > Senders > add and verify the email you want codes to come from.
2. Brevo > SMTP & API > API keys > create a key.
3. Render > your kinton-pay service > Environment, add:
   - `BREVO_API_KEY` = the key
   - `MAIL_FROM` = the verified sender email
   - `MAIL_FROM_NAME` = Kinton Technologies (optional)
4. Replace `server.js` in your repo with the one in this folder. Render redeploys.
5. Open https://kinton-pay.onrender.com/health. It should show `"emailCodes": true`.
Until this is on, customers can use the "Email me a link instead" button (built into Firebase, no server needed).

## 3. Real AI assistant (free)
1. Go to aistudio.google.com, sign in, create an API key (use the free tier).
2. Render > Environment, add `GEMINI_API_KEY` = the key. Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`; pick any Flash or Flash-Lite model your AI Studio shows as free).
3. `/health` should now show `"ai": true`.
The Guide still answers common questions from its ready-made list first. Only questions it does not know go to the AI.
Turn it off any time with `aiEnabled: false` in `config.js`.

Notes
- Never put the API keys in `config.js` or GitHub. They live only on Render.
- Free tiers have daily limits and may use prompts to improve Google's products, so the assistant never receives customer account data.
- Render's free server sleeps when idle. The first code or AI reply after a quiet period can take up to a minute.
- Phone numbers can now be SMS-verified from My account (see section 4). It is optional and costs money after the free tier.


## 4. Phone SMS verification (Firebase)
1. Firebase console > Authentication > Sign-in method > Phone > Enable > Save.
2. Authentication > Settings > SMS region policy > Allow > select only Zimbabwe (+263). This blocks toll-fraud pumping from other countries.
3. Authentication > Sign-in method > Phone > "Phone numbers for testing": add a number and code to test without sending real SMS.
4. Phone verification needs the Blaze (pay-as-you-go) plan for real SMS beyond the small free quota. Set a budget alert in Google Cloud Billing.
5. Authorized domains (section 1) must include your site. Customers verify from My account > Verify your phone.
Each phone number can be verified on only one account. If a customer changes their number, they verify the new one.
