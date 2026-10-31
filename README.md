# Kinton update - 3 steps

## 1. Fix "Unknown item" (payment server on Render)
The server running on Render is the OLD version. It only knows the $1 demo item and has no code for shop orders.
- In your `kinton-pay-server` GitHub repo, replace `server.js` with `pay-server/server.js` (and `package.json` if you like).
- Render redeploys by itself. Check https://kinton-pay.onrender.com/health shows {"ok":true}.
- Then open an invoice and tap Pay now again.
What changed: orders are priced from your products (matched by id, then by name), so every item with a price can be paid.
Items with price $0 ("Custom quote") still need a quote first. There is also a small rate limit on /createPayment.

## 2. Website (GitHub Pages repo)
Upload everything in `website/` to the repo root (replace existing files).
New files: track.js, motion.js, modern.css, admin-stats.js, manifest.webmanifest, sw.js.

## 3. Firestore rules
Firebase console > Firestore Database > Rules: paste `website/firestore.rules` > Publish.
Without this step the Analytics page shows an error and visits are not recorded.
