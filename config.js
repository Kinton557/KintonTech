/*
  Kinton Technologies - site settings.
  This is the ONLY file you need to edit to go live. See SETUP.md.

  Nothing in here is a secret. Firebase web keys and the reCAPTCHA *site* key
  are meant to be public. Your security comes from the rules in firestore.rules.
  NEVER paste a reCAPTCHA *secret* key or any password into this file.
*/
window.KINTON_CONFIG = {
  // 1) Paste your Firebase web config here (Firebase console > Project settings > Your apps).
  //    While apiKey starts with "PASTE", the site runs in DEMO MODE (data stays in this browser only).
  firebase: {
apiKey: "AIzaSyDoSfxKsVyrt2ME6to4TYNqOEiOuIikaoA",
authDomain: "kinton-technologies-26d08.firebaseapp.com",
projectId: "kinton-technologies-26d08",
appId: "1:384922068250:web:6f8a78cde94870798cb8a3"
},

  // 2) Google reCAPTCHA v2 ("I'm not a robot" checkbox) SITE key.
  //    The key below is Google's public TEST key: it always passes and shows a warning.
  //    Replace it with your own from https://www.google.com/recaptcha/admin
  recaptchaSiteKey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",

  // 3) Optional but recommended: Firebase App Check (reCAPTCHA v3) site key.
  //    This makes Firebase itself reject traffic that doesn't come from your real site.
  appCheckSiteKey: "",

  // Business details used across the site
  whatsappNumber: "263775610805",
  whatsappDisplay: "+263 77 561 0805",
  currencySymbol: "$"
};
