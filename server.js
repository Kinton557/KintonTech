// Kinton Technologies - Paynow payment server (runs on Render).
// Secrets come from Render's Environment settings. Nothing secret is stored in this file.
const express = require("express");
const crypto = require("crypto");
const admin = require("firebase-admin");
const { Paynow } = require("paynow");

const env = process.env;
const SITE = env.SITE_URL || "https://kintontechnologies.co.zw";
const SELF = env.RENDER_EXTERNAL_URL || "http://localhost:" + (env.PORT || 3000);
const COLLECTION = "paynow_payments";
const LIVE = env.PAYNOW_MODE === "live";

for (const name of ["PAYNOW_INTEGRATION_ID", "PAYNOW_INTEGRATION_KEY", "PAYNOW_MERCHANT_EMAIL", "FIREBASE_SERVICE_ACCOUNT"]) {
  if (!env[name]) { console.error("Missing setting: " + name); process.exit(1); }
}

// Direct EcoCash (EcoCash Instant Payments). Turned on by adding EIP_USERNAME and EIP_PASSWORD on Render.
// Leave them out and EcoCash goes through Paynow like before.
const EIP_ON = !!(env.EIP_USERNAME && env.EIP_PASSWORD);
const EIP_BASE = (env.EIP_BASE_URL || "https://developers.ecocash.co.zw/sandbox/payment/v1").replace(/\/+$/, "");
const EIP_SANDBOX = EIP_BASE.includes("/sandbox/");
const EIP_CURRENCY = env.EIP_CURRENCY || "USD";
if (EIP_ON) {
  for (const name of ["EIP_MERCHANT_CODE", "EIP_MERCHANT_PIN", "EIP_MERCHANT_NUMBER", "EIP_TERMINAL_ID", "EIP_MERCHANT_NAME"]) {
    if (!env[name]) { console.error("Missing setting: " + name); process.exit(1); }
  }
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

// The price is decided here on the server, never taken from the browser.
const ITEMS = {
  demo: { name: "Kinton payment demo", amount: 1.0 },
};

const app = express();
app.set("trust proxy", 1); // Render sits behind a proxy; this makes req.ip the visitor's address
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", SITE);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

function paynowClient(ref) {
  const p = new Paynow(env.PAYNOW_INTEGRATION_ID, env.PAYNOW_INTEGRATION_KEY);
  p.resultUrl = SELF + "/paynowResult";
  p.returnUrl = SITE + "/payment-result.html?ref=" + encodeURIComponent(ref);
  return p;
}

// Check the hash Paynow puts on its status notifications.
function hashIsValid(body) {
  let joined = "";
  for (const [key, value] of Object.entries(body)) {
    if (key.toLowerCase() !== "hash") joined += value;
  }
  joined += env.PAYNOW_INTEGRATION_KEY;
  const expected = crypto.createHash("sha512").update(joined, "utf8").digest("hex").toUpperCase();
  return expected === String(body.hash || "").toUpperCase();
}

// Marks the shop order paid once money is confirmed. Shared by Paynow and EcoCash.
async function markOrderPaid(saved, ref) {
  if (!saved.orderId) return;
  await db.collection("orders").doc(saved.orderId).update({
    paid: true,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    paynowRef: ref,
    paidAmount: saved.amount,
  }).catch((err) => console.error("Could not mark order paid:", err));
}

// One call to the EcoCash API. Never throws on a bad status, the caller reads httpStatus and body.
async function ecocash(method, path, payload) {
  const login = Buffer.from(env.EIP_USERNAME + ":" + env.EIP_PASSWORD).toString("base64");
  const res = await fetch(EIP_BASE + path, {
    method,
    headers: { Authorization: "Basic " + login, "Content-Type": "application/json", Accept: "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.json().catch(() => ({}));
  return { httpStatus: res.status, body };
}

// Asks EcoCash how a charge went. EcoCash answers PENDING, SUCCESS or FAILED.
async function refreshEcoCash(snap, saved) {
  if (saved.status === "failed") return saved;
  const path = "/" + encodeURIComponent(saved.msisdn) + "/transactions/amount/" + encodeURIComponent(saved.ref);
  const r = await ecocash("GET", path);
  if (r.httpStatus === 404) return saved; // EcoCash has not registered it (yet), keep waiting
  if (r.httpStatus !== 200) throw new Error("EcoCash lookup answered " + r.httpStatus);
  const code = String(r.body.status || "").toUpperCase();
  console.log("EcoCash status for " + saved.ref + ": " + code);

  let status = "pending";
  let paid = false;
  let message = null;
  if (code === "SUCCESS") {
    if (r.body.amount !== undefined && Math.round(Number(r.body.amount) * 100) !== Math.round(saved.amount * 100)) {
      status = "amount mismatch";
    } else {
      status = "paid";
      paid = true;
    }
  } else if (code === "FAILED") {
    status = "failed";
    message = r.body.statusMessage || null;
  }
  const update = { status, paid, message, ecocashRef: r.body.transactionId || saved.ecocashRef || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  await snap.ref.update(update);
  if (paid) await markOrderPaid(saved, saved.ref);
  return { ...saved, ...update };
}

// Ask Paynow directly what happened. This is the answer we trust.
async function refreshStatus(ref) {
  const snap = await db.collection(COLLECTION).doc(ref).get();
  if (!snap.exists) return null;
  const saved = snap.data();
  if (saved.paid) return saved;
  if (saved.provider === "ecocash") return refreshEcoCash(snap, saved);

  const result = await paynowClient(ref).pollTransaction(saved.pollUrl);
  const status0 = String(result.status || "unknown");
  console.log("Paynow status for " + ref + ": " + status0);
  // Paynow counts these three as money received.
  let paid = ["paid", "awaiting delivery", "delivered"].includes(status0.toLowerCase());
  let status = status0;
  if (paid && result.amount !== undefined && Number(result.amount) !== saved.amount) {
    paid = false;
    status = "amount mismatch";
  }
  const update = { status, paid, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  await snap.ref.update(update);
  if (paid) await markOrderPaid(saved, ref);
  return { ...saved, ...update };
}

// Used to wake the server up when the pay page opens.

// ---------------------------------------------------------------------------
// Email verification codes (OTP). Sent through Brevo's HTTPS API (free plan),
// checked here, then Firebase is told the email is verified.
// Turn on by adding BREVO_API_KEY and MAIL_FROM on Render.
// ---------------------------------------------------------------------------
const MAIL_ON = !!(env.BREVO_API_KEY && env.MAIL_FROM);
const OTP_COLLECTION = "email_otps";
const httpErr = (status, error) => Object.assign(new Error(error), { status });
const fail = (res, e) => { if (!e.status) console.error("otp/ai error:", e); res.status(e.status || 500).json({ error: e.status ? e.message : "Something went wrong. Please try again." }); };

async function userFromToken(req) {
  const m = (req.get("Authorization") || "").match(/^Bearer (.+)$/);
  if (!m) throw httpErr(401, "Please sign in again.");
  try { return await admin.auth().verifyIdToken(m[1]); } catch (e) { throw httpErr(401, "Please sign in again."); }
}
const otpHash = (uid, code) => crypto.createHmac("sha256", env.OTP_SECRET || env.FIREBASE_SERVICE_ACCOUNT).update(uid + ":" + code).digest("hex");

async function sendMail(to, subject, html, text) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: env.MAIL_FROM, name: env.MAIL_FROM_NAME || "Kinton Technologies" }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
  });
  if (!r.ok) { console.error("Brevo error", r.status, await r.text().catch(() => "")); throw httpErr(502, "We could not send the email. Please try again, or use the email link option."); }
}

app.post("/otp/send", async (req, res) => {
  try {
    if (!MAIL_ON) throw httpErr(503, "Email codes are not set up yet. Please use the email link option.");
    const tok = await userFromToken(req);
    const user = await admin.auth().getUser(tok.uid);
    if (!user.email) throw httpErr(400, "This account has no email address.");
    if (user.emailVerified) return res.json({ ok: true, already: true });
    const ref = db.collection(OTP_COLLECTION).doc(tok.uid), now = Date.now(), d = (await ref.get()).data() || {};
    if (d.sentAt && now - d.sentAt < 60000) throw httpErr(429, "Please wait a minute before asking for another code.");
    const fresh = d.windowStart && now - d.windowStart < 3600000;
    const sends = fresh ? (d.sends || 0) + 1 : 1;
    if (sends > 5) throw httpErr(429, "Too many codes requested. Try again in an hour.");
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await ref.set({ hash: otpHash(tok.uid, code), expires: now + 10 * 60000, attempts: 0, sentAt: now, sends, windowStart: fresh ? d.windowStart : now });
    await sendMail(user.email, "Your Kinton verification code: " + code,
      '<div style="font-family:Arial,sans-serif;max-width:420px"><h2 style="margin:0 0 8px">Verify your email</h2><p>Use this code on the Kinton Technologies website. It works for 10 minutes.</p>' +
      '<p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:16px 0">' + code + '</p><p style="color:#666;font-size:13px">If you did not ask for this, you can ignore this email.</p></div>',
      "Your Kinton verification code is " + code + ". It works for 10 minutes.");
    res.json({ ok: true, expiresInMinutes: 10 });
  } catch (e) { fail(res, e); }
});

app.post("/otp/verify", async (req, res) => {
  try {
    const tok = await userFromToken(req);
    const code = String((req.body || {}).code || "").trim();
    if (!/^\d{6}$/.test(code)) throw httpErr(400, "Enter the 6-digit code.");
    const ref = db.collection(OTP_COLLECTION).doc(tok.uid), d = (await ref.get()).data();
    if (!d || Date.now() > d.expires) throw httpErr(400, "That code has expired. Ask for a new one.");
    if ((d.attempts || 0) >= 5) throw httpErr(429, "Too many wrong tries. Ask for a new code.");
    const a = Buffer.from(otpHash(tok.uid, code)), b = Buffer.from(d.hash);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await ref.update({ attempts: (d.attempts || 0) + 1 });
      throw httpErr(400, "That code is not right. Check it and try again.");
    }
    await admin.auth().updateUser(tok.uid, { emailVerified: true });
    await ref.delete();
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// ---------------------------------------------------------------------------
// AI assistant (Google Gemini free tier). The key lives only on Render.
// Turn on by adding GEMINI_API_KEY (optional: GEMINI_MODEL) on Render.
// ---------------------------------------------------------------------------
const AI_ON = !!env.GEMINI_API_KEY;
const AI_MODEL = env.GEMINI_MODEL || "gemini-2.5-flash";
const AI_SYSTEM = [
  "You are the Kinton Guide, the friendly assistant on the website of Kinton Technologies, a software and design studio in Kadoma, Zimbabwe.",
  "Services: websites and online shops, Android/iOS apps, brand identity (logos, colours, social media kits), domains and hosting help.",
  "How it works: customers pick a package in the shop or ask for a quote, we confirm scope, price and timeline on WhatsApp (+263 77 561 0805), then build. Placing an order pays nothing. Payments go through Paynow (EcoCash, InnBucks, Zimswitch, bank).",
  "Rules: answer in 1 to 3 short sentences, plain language, in the language the person uses. Never invent prices, dates or promises; for exact prices point to the shop page, and for anything uncertain suggest WhatsApp. Do not give legal, medical or financial advice. Stay on topic: Kinton and its services, and simple help using the website.",
].join(" ");
const aiHits = new Map(); // ip -> { minute: [times], day: count, dayStart }
function aiAllowed(ip) {
  const now = Date.now(), h = aiHits.get(ip) || { t: [], day: 0, dayStart: now };
  if (now - h.dayStart > 86400000) { h.day = 0; h.dayStart = now; }
  h.t = h.t.filter((x) => now - x < 60000);
  if (h.t.length >= 10 || h.day >= 100) return false;
  h.t.push(now); h.day++; aiHits.set(ip, h);
  if (aiHits.size > 5000) aiHits.clear();
  return true;
}
app.post("/ai/chat", async (req, res) => {
  try {
    if (!AI_ON) throw httpErr(503, "The assistant is not switched on.");
    if (!aiAllowed(req.ip)) throw httpErr(429, "You are asking quickly. Please wait a moment.");
    const q = String((req.body || {}).message || "").trim().slice(0, 400);
    if (!q) throw httpErr(400, "Ask me something.");
    const hist = (Array.isArray((req.body || {}).history) ? req.body.history : []).slice(-6)
      .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
      .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 500) }] }));
    const gen = { maxOutputTokens: 400, temperature: 0.4 };
    if (/2\.5/.test(AI_MODEL)) gen.thinkingConfig = { thinkingBudget: 0 };
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(AI_MODEL) + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: AI_SYSTEM }] }, contents: [...hist, { role: "user", parts: [{ text: q }] }], generationConfig: gen }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("Gemini error", r.status, JSON.stringify(j).slice(0, 300)); throw httpErr(502, "The assistant is busy right now."); }
    const reply = ((j.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!reply) throw httpErr(502, "The assistant had no answer.");
    res.json({ reply });
  } catch (e) { fail(res, e); }
});

app.get("/health", (req, res) => res.json({ ok: true, emailCodes: MAIL_ON, ai: AI_ON, mode: LIVE ? "live" : "test", ecocash: EIP_ON ? (EIP_SANDBOX ? "sandbox" : "live") : "paynow" }));

// Works out what an order really costs from the shop's own prices, not from the browser.
async function priceOrder(orderId) {
  const snap = await db.collection("orders").doc(orderId).get();
  if (!snap.exists) return { error: "Order not found." };
  const order = snap.data();
  if (order.paid) return { error: "This order is already paid." };
  if (order.status === "cancelled") return { error: "This order was cancelled." };
  let total = 0;
  for (const line of order.items || []) {
    const product = await db.collection("products").doc(String(line.id)).get();
    const price = product.exists ? Number(product.data().price) : 0;
    const qty = Math.max(1, Math.min(99, parseInt(line.qty, 10) || 1));
    if (!(price > 0)) return { error: "This order needs a quote from us first. We will contact you." };
    total += price * qty;
  }
  return { order, amount: Math.round(total * 100) / 100 };
}

// Turns 263771234567, +263 77 123 4567 or 771234567 into 0771234567.
function localPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("263")) d = "0" + d.slice(3);
  if (/^7\d{8}$/.test(d)) d = "0" + d;
  return d;
}

// 0771234567 -> 263771234567, the form EcoCash expects.
function intlPhone(local) {
  return "263" + String(local).replace(/^0/, "");
}

// Starts a direct EcoCash charge. The customer gets the PIN prompt on their phone.
async function startEcoCash({ ref, item, name, phone, orderId, itemKey }) {
  const msisdn = intlPhone(phone);
  const doc = db.collection(COLLECTION).doc(ref);
  // Saved before we call EcoCash, so a timeout can always be looked up and never charged twice.
  await doc.set({
    ref,
    provider: "ecocash",
    item: itemKey || null,
    orderId,
    amount: item.amount,
    name,
    phone,
    msisdn,
    method: "ecocash",
    mode: EIP_SANDBOX ? "test" : "live",
    status: "created",
    paid: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const payload = {
    clientCorrelator: ref,
    notifyUrl: "",
    referenceCode: ref,
    tranType: "MER",
    endUserId: msisdn,
    remarks: item.name,
    transactionOperationStatus: "Charged",
    paymentAmount: {
      charginginformation: { amount: item.amount.toFixed(2), currency: EIP_CURRENCY, description: item.name },
      chargeMetaData: { channel: env.EIP_CHANNEL || "WEB" },
    },
    merchantCode: env.EIP_MERCHANT_CODE,
    merchantPin: env.EIP_MERCHANT_PIN,
    merchantNumber: env.EIP_MERCHANT_NUMBER,
    countryCode: "ZW",
    terminalID: env.EIP_TERMINAL_ID,
    location: env.EIP_LOCATION || "Harare",
    superMerchantName: env.EIP_SUPER_MERCHANT_NAME || "ECOCASH",
    merchantName: env.EIP_MERCHANT_NAME,
  };

  let r;
  try {
    r = await ecocash("POST", "/transactions/amount/", payload);
  } catch (err) {
    // No answer in time. The request may still have reached the phone, so do not send it again.
    console.error("EcoCash charge got no answer for " + ref + ":", err.message);
    return { ref, mobile: true };
  }

  if (r.httpStatus !== 200) {
    console.error("EcoCash refused " + ref + ": " + r.httpStatus + " " + (r.body.statusMessage || ""));
    await doc.update({ status: "failed", message: r.body.statusMessage || "Refused", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const text = r.httpStatus === 422 && r.body.statusMessage ? r.body.statusMessage : "EcoCash could not start this payment. Please check the number and try again.";
    const err = new Error(text);
    err.userFacing = true;
    throw err;
  }
  await doc.update({ ecocashRef: r.body.transactionId || null });
  return { ref, mobile: true };
}

app.post("/createPayment", async (req, res) => {
  const body = req.body || {};
  let item = ITEMS[body.item];
  let orderId = null;
  let orderInfo = null;
  if (body.orderId) {
    orderId = String(body.orderId).slice(0, 60);
    orderInfo = await priceOrder(orderId).catch(() => ({ error: "Could not load this order." }));
    if (orderInfo.error) return res.status(400).json({ error: orderInfo.error });
    item = { name: "Order " + orderInfo.order.ref, amount: orderInfo.amount };
  }
  const method = body.method === "ecocash" ? "ecocash" : "redirect";
  const name = String(body.name || (orderInfo && orderInfo.order.userName) || "").trim().slice(0, 80);
  const phone = localPhone(body.phone).slice(0, 16);
  const email = String(body.email || (orderInfo && orderInfo.order.userEmail) || "").trim().slice(0, 120);

  if (!item) return res.status(400).json({ error: "Unknown item." });
  if (name.length < 2) return res.status(400).json({ error: "Please enter your name." });
  if (phone.length < 9) return res.status(400).json({ error: "Please enter a valid phone number." });
  if (method === "ecocash" && !/^07[78]\d{7}$/.test(phone)) {
    return res.status(400).json({ error: "Please enter your EcoCash number, for example 0771234567." });
  }
  if (LIVE && !(method === "ecocash" && EIP_ON) && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });

  const ref = "KT-" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString("hex").toUpperCase();

  if (method === "ecocash" && EIP_ON) {
    try {
      return res.json(await startEcoCash({ ref, item, name, phone, orderId, itemKey: body.item }));
    } catch (err) {
      console.error("EcoCash createPayment failed:", err);
      return res.status(err.userFacing ? 502 : 500).json({ error: err.userFacing ? err.message : "Something went wrong. Please try again." });
    }
  }
  // In test mode Paynow only accepts the merchant's own email here.
  const authEmail = LIVE ? email : env.PAYNOW_MERCHANT_EMAIL;

  try {
    const paynow = paynowClient(ref);
    const payment = paynow.createPayment(ref, authEmail);
    payment.add(item.name, item.amount);
    // EcoCash: the PIN prompt pops up on the customer's phone. Anything else: go to Paynow's page.
    const response = method === "ecocash"
      ? await paynow.sendMobile(payment, phone, "ecocash")
      : await paynow.send(payment);

    if (!response.success) {
      console.error("Paynow refused the transaction:", response.error);
      return res.status(502).json({ error: "Paynow could not start this payment. Please check the number and try again." });
    }

    await db.collection(COLLECTION).doc(ref).set({
      ref,
      item: body.item || null,
      orderId,
      amount: item.amount,
      name,
      phone,
      email: email || null,
      method,
      mode: LIVE ? "live" : "test",
      pollUrl: response.pollUrl,
      status: "created",
      paid: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (method === "ecocash") return res.json({ ref, mobile: true });
    res.json({ ref, redirectUrl: response.redirectUrl });
  } catch (err) {
    console.error("createPayment failed:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// Paynow posts status changes here (the "result url").
app.post("/paynowResult", async (req, res) => {
  if (!hashIsValid(req.body || {})) {
    console.warn("Paynow notification with a bad hash was ignored.");
    return res.status(400).send("bad hash");
  }
  try {
    await refreshStatus(String(req.body.reference || ""));
    res.status(200).send("ok");
  } catch (err) {
    console.error("paynowResult failed:", err);
    res.status(500).send("error");
  }
});

// The return page asks this for the final, confirmed result.
app.get("/paymentStatus", async (req, res) => {
  const ref = String(req.query.ref || "");
  if (!/^KT-[A-Z0-9]+$/.test(ref)) return res.status(400).json({ error: "Bad reference." });
  try {
    const found = await refreshStatus(ref);
    if (!found) return res.status(404).json({ error: "Payment not found." });
    res.json({ ref, status: found.status, paid: !!found.paid, amount: found.amount, orderId: found.orderId || null, message: found.message || null });
  } catch (err) {
    console.error("paymentStatus failed:", err);
    res.status(500).json({ error: "Could not check the payment." });
  }
});

app.listen(env.PORT || 3000, () => console.log("Kinton pay server listening"));
