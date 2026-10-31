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

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

// The price is decided here on the server, never taken from the browser.
const ITEMS = {
  demo: { name: "Kinton payment demo", amount: 1.0 },
};

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", SITE);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
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

// Ask Paynow directly what happened. This is the answer we trust.
async function refreshStatus(ref) {
  const snap = await db.collection(COLLECTION).doc(ref).get();
  if (!snap.exists) return null;
  const saved = snap.data();
  if (saved.paid) return saved;

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
  if (paid && saved.orderId) {
    await db.collection("orders").doc(saved.orderId).update({
      paid: true,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      paynowRef: ref,
      paidAmount: saved.amount,
    }).catch((err) => console.error("Could not mark order paid:", err));
  }
  return { ...saved, ...update };
}

// Used to wake the server up when the pay page opens.
app.get("/health", (req, res) => res.json({ ok: true, mode: LIVE ? "live" : "test" }));

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
  if (LIVE && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });

  const ref = "KT-" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString("hex").toUpperCase();
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
    res.json({ ref, status: found.status, paid: !!found.paid, amount: found.amount, orderId: found.orderId || null });
  } catch (err) {
    console.error("paymentStatus failed:", err);
    res.status(500).json({ error: "Could not check the payment." });
  }
});

app.listen(env.PORT || 3000, () => console.log("Kinton pay server listening"));
