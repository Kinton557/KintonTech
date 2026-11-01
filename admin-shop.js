/* Kinton Technologies - admin: Products, Orders, Invoices & payments. */
(function () {
  'use strict';
  var KT = window.KT, E = KT.esc, say = KT.say, $ = KT.$;
  function today() { return new Date().toISOString().slice(0, 10); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  /* Invoice look: dark gold header, soft cards, gold total. Scoped to .inv-doc so nothing else changes. */
  (function () {
    if (document.getElementById('kt-inv-css')) return;
    var s = document.createElement('style'); s.id = 'kt-inv-css';
    s.textContent = [
      '.invoice.inv-doc{background:#fff;color:#1b1b1b;border:0;border-radius:18px;overflow:hidden;box-shadow:0 22px 60px rgba(0,0,0,.2);padding:0 0 1.2rem}',
      '.inv-doc>*:not(.inv-head):not(.inv-stamp){margin-left:clamp(1rem,4vw,2rem);margin-right:clamp(1rem,4vw,2rem)}',
      '.inv-doc .inv-head{position:relative;overflow:hidden;background:linear-gradient(135deg,#0d0d0d 0%,#25200f 62%,#4a3a12 100%);color:#fff;border:0;border-bottom:4px solid #d4a72c;margin:0 0 1.4rem;padding:1.5rem clamp(1rem,4vw,2rem)}',
      '.inv-doc .inv-head::after{content:"";position:absolute;right:-50px;top:-60px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,rgba(226,185,85,.38),transparent 70%);pointer-events:none}',
      '.inv-doc .brand-word{color:#fff;letter-spacing:.3em}.inv-doc .inv-co{color:#c9c2ae}',
      '.inv-doc .inv-title{font-size:clamp(1.8rem,8vw,2.9rem);font-weight:800;letter-spacing:.2em;background:linear-gradient(90deg,#fff,#e2b955);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
      '.inv-doc .inv-no{color:#e2b955;font-weight:700;letter-spacing:.08em}',
      '.inv-doc .inv-meta{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}',
      '.inv-doc .inv-block,.inv-doc .inv-meta .inv-dates{background:#faf6ea;border-left:4px solid #d4a72c;border-radius:10px;padding:.8rem 1rem;text-align:left}',
      '.inv-doc .inv-k{color:#8a6d12}',
      '.inv-doc .inv-table{border-collapse:separate;border-spacing:0;border-radius:10px;overflow:hidden}',
      '.inv-doc .inv-table thead th{background:linear-gradient(90deg,#151515,#2e2610);color:#e2b955;border:0;border-radius:0;padding:.7rem .6rem}',
      '.inv-doc .inv-table tbody td{padding:.7rem .6rem;border-bottom:1px solid #eee6cf}',
      '.inv-doc .inv-table tbody tr:nth-child(even) td{background:#fbf8ef}',
      '.inv-doc .inv-sum{max-width:20rem;margin-left:auto}',
      '.inv-doc .inv-sum .due{background:linear-gradient(135deg,#f3d577,#d4a72c);color:#151515;border:0;border-radius:12px;padding:.85rem 1rem;font-size:1.15rem;box-shadow:0 8px 20px rgba(212,167,44,.35)}',
      '.inv-doc .inv-note{background:#f5f5f3;border-left:4px solid #151515;border-radius:10px;padding:.8rem 1rem}',
      '.inv-doc .inv-foot{background:#151515;color:#d8d0b8;text-align:center;border:0;border-radius:10px;padding:.9rem}',
      '.inv-doc .inv-stamp{border-width:4px;opacity:.85;color:#1a7f4b;border-color:#1a7f4b;background:rgba(255,255,255,.6)}',
      '.inv-doc .inv-stamp.s-overdue{color:#c0392b;border-color:#c0392b}.inv-doc .inv-stamp.s-void{color:#777;border-color:#777}',
      '@media print{.invoice.inv-doc{box-shadow:none;border-radius:0}.inv-doc,.inv-doc *{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.inv-doc .inv-table thead th{background:#151515!important;color:#e2b955!important;border:0!important}',
      '.inv-doc .inv-table tbody tr:nth-child(even) td{background:#fbf8ef!important}',
      '.inv-doc .inv-sum .due{background:linear-gradient(135deg,#f3d577,#d4a72c)!important;color:#151515!important;border:0!important;border-radius:12px!important;padding:.85rem 1rem!important}}'
    ].join('');
    document.head.appendChild(s);
  })();

  /* ---------------- Products ---------------- */
  function resizeImage(file) {
    return new Promise(function (res, rej) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Use a JPG, PNG or WebP image.'));
      if (file.size > 8 * 1024 * 1024) return rej(new Error('That image is over 8 MB. Choose a smaller one.'));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 720 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = 0.78, out = c.toDataURL('image/jpeg', q);
        while (out.length > 240000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        out.length > 240000 ? rej(new Error('That image is too detailed to store. Try a simpler one.')) : res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That file could not be read as an image.')); };
      img.src = url;
    });
  }

  KT.registerAdmin({ key: 'products', title: 'Products', order: 10, perm: 'products', render: function (panel, ctx) {
    Store.listProducts({ includeInactive: true }).then(function (list) {
      list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      panel.innerHTML = '<div class="cta-row" style="margin-bottom:1.2rem"><button type="button" class="btn" id="add-prod">Add product</button>' + (list.length ? '' : '<button type="button" class="btn btn-line" id="seed">Load sample products</button>') + '</div>' +
        '<div id="prod-form-box"></div><div class="list">' + (list.length ? list.map(function (p) {
          var img = KT.safeImg(p.image);
          return '<article class="row-card admin-prod"><div class="thumb">' + (img ? '<img src="' + E(img) + '" alt="">' : KT.icon(p.category)) + '</div><div><h3>' + E(p.name) + '</h3><div class="meta">' + E(p.category) + ' &middot; ' + KT.money(p.price) +
            (p.featured ? ' &middot; ' + KT.badge('Featured', 'new') : '') + (p.active === false ? ' &middot; ' + KT.badge('Hidden', 'cancelled') : '') + '</div></div>' +
            '<div class="row-actions"><button type="button" class="btn btn-line btn-sm" data-edit="' + E(p.id) + '">Edit</button><button type="button" class="link-btn danger" data-del="' + E(p.id) + '">Delete</button></div></article>'; }).join('') :
          '<div class="empty"><h3>No products yet</h3><p>Add your first product, or load the sample catalog and edit it.</p></div>') + '</div>';
      $('#add-prod').addEventListener('click', function () { form(null); });
      var seed = $('#seed'); if (seed) seed.addEventListener('click', function () { seed.disabled = true; Store.seedProducts().then(function () { Store.log('Loaded the sample products'); ctx.reload(); }).catch(ctx.fail); });
      panel.onclick = function (e) {
        var ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
        if (ed) form(list.filter(function (p) { return p.id === ed.dataset.edit; })[0]);
        if (del && confirm('Delete this product? This cannot be undone.')) Store.deleteProduct(del.dataset.del).then(function () { KT.toast('Product deleted'); Store.log('Deleted a product'); ctx.reload(); }).catch(function (err) { KT.toast(err.message); });
      };
    }).catch(ctx.fail);

    function form(p) {
      p = p || { name: '', category: Store.categories[0], price: '', description: '', image: '', featured: false, active: true };
      var box = $('#prod-form-box'), image = p.image || '';
      box.innerHTML = '<form class="panel" id="prod-form" style="margin-bottom:1.5rem" novalidate><h2 style="font-size:1.3rem">' + (p.id ? 'Edit product' : 'New product') + '</h2><div class="form-grid">' +
        '<div class="field"><label for="p-name">Name</label><input id="p-name" type="text" maxlength="80" required value="' + E(p.name) + '"></div>' +
        '<div class="field"><label for="p-cat">Category</label><select id="p-cat">' + Store.categories.map(function (c) { return '<option' + (c === p.category ? ' selected' : '') + '>' + E(c) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="p-price">Price (USD)</label><input id="p-price" type="number" min="0" max="100000" step="0.01" inputmode="decimal" value="' + E(p.price) + '"><div class="hint">Enter 0 to show "Custom quote".</div></div>' +
        '<div class="field"><span class="label">Options</span><label class="check"><input type="checkbox" id="p-feat"' + (p.featured ? ' checked' : '') + '> Show on the home page</label><label class="check" style="margin-top:.4rem"><input type="checkbox" id="p-active"' + (p.active !== false ? ' checked' : '') + '> Visible in the shop</label></div>' +
        '<div class="field full"><label for="p-desc">Description</label><textarea id="p-desc" maxlength="300" required>' + E(p.description) + '</textarea><div class="hint">Up to 300 characters.</div></div>' +
        '<div class="field"><label for="p-file">Picture (optional)</label><input id="p-file" type="file" accept="image/jpeg,image/png,image/webp"><div class="hint">Resized automatically.</div></div>' +
        '<div class="field"><span class="label">Preview</span><div class="img-prev" id="p-prev"></div><button type="button" class="link-btn danger" id="p-clear" style="margin-top:.4rem">Remove picture</button></div></div>' +
        '<div class="cta-row"><button class="btn" type="submit">Save product</button><button class="btn btn-line" type="button" id="p-cancel">Cancel</button></div><div id="p-msg" class="msg" role="alert"></div></form>';
      function prev() { var s = KT.safeImg(image); $('#p-prev').innerHTML = s ? '<img src="' + E(s) + '" alt="Preview">' : '<span style="width:60%;color:#e2b955">' + KT.icon($('#p-cat').value) + '</span>'; }
      prev(); $('#p-cat').addEventListener('change', prev);
      $('#p-clear').addEventListener('click', function () { image = ''; $('#p-file').value = ''; prev(); });
      $('#p-cancel').addEventListener('click', function () { box.innerHTML = ''; });
      $('#p-file').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; resizeImage(f).then(function (d) { image = d; prev(); say($('#p-msg'), ''); }).catch(function (err) { e.target.value = ''; say($('#p-msg'), err.message); }); });
      $('#prod-form').addEventListener('submit', function (e) {
        e.preventDefault(); var msg = $('#p-msg'), name = $('#p-name').value.trim(), desc = $('#p-desc').value.trim(), price = num($('#p-price').value);
        if (name.length < 2) return say(msg, 'Give the product a name.');
        if (desc.length < 5) return say(msg, 'Add a short description.');
        if (price < 0 || price > 100000) return say(msg, 'Enter a price between 0 and 100000.');
        var btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
        Store.saveProduct({ id: p.id, name: name.slice(0, 80), category: $('#p-cat').value, price: Math.round(price * 100) / 100, description: desc.slice(0, 300), image: image, featured: $('#p-feat').checked, active: $('#p-active').checked })
          .then(function () { KT.toast('Product saved'); Store.log((p.id ? 'Edited' : 'Added') + ' product "' + name + '"'); ctx.reload(); }).catch(function (err) { say(msg, err.message); btn.disabled = false; });
      });
      $('#p-name').focus(); box.scrollIntoView({ block: 'start' });
    }
  } });

  /* ---------------- Orders ---------------- */
  KT.registerAdmin({ key: 'orders', title: 'Orders', order: 20, perm: 'orders', render: function (panel, ctx) {
    Store.listAllOrders().then(function (os) {
      ctx.count('orders', os.filter(function (o) { return o.status === 'new'; }).length);
      panel.innerHTML = os.length ? '<div class="list">' + os.map(function (o) {
        var phone = String(o.phone || '').replace(/[^\d]/g, ''); if (phone.charAt(0) === '0') phone = '263' + phone.slice(1);
        return '<article class="row-card"><header><h3>Order ' + E(o.ref) + '</h3>' + KT.badge(o.status) + '</header>' +
          '<div class="meta">' + E(KT.fmtDate(o.createdAt)) + ' &middot; ' + E(o.userName) + ' &middot; ' + E(o.userEmail) + ' &middot; ' + E(o.phone) + '</div>' +
          '<ul>' + (o.items || []).map(function (i) { return '<li>' + E(i.qty) + ' &times; ' + E(i.name) + ' (' + KT.money(i.price) + ')</li>'; }).join('') + '</ul>' +
          (o.note ? '<p class="meta"><strong>Note:</strong> ' + E(o.note) + '</p>' : '') + '<strong>' + (o.total > 0 ? KT.money(o.total) : 'Quote to follow') + '</strong>' +
          '<div class="row-actions"><label class="sr-only" for="st-' + E(o.id) + '">Status</label><select id="st-' + E(o.id) + '" data-status="' + E(o.id) + '" data-ref="' + E(o.ref) + '">' + Store.orderStatuses.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + E(s) + '</option>'; }).join('') + '</select>' +
          (Store.can('payments') ? '<button type="button" class="btn btn-line btn-sm" data-inv="' + E(o.id) + '">Create invoice</button>' : '') +
          (phone ? '<a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="' + E(KT.waLink('Hi ' + o.userName + ', this is Kinton Technologies about your order ' + o.ref + '.', phone)) + '">WhatsApp customer</a>' : '') + '</div></article>'; }).join('') + '</div>'
        : '<div class="empty"><h3>No orders yet</h3><p>New orders from the cart will show up here.</p></div>';
      panel.onchange = function (e) {
        var s = e.target.closest('[data-status]'); if (!s) return;
        Store.setOrderStatus(s.dataset.status, s.value).then(function () { KT.toast('Status updated'); Store.log('Order ' + s.dataset.ref + ' set to ' + s.value); }).catch(function (err) { KT.toast(err.message); });
      };
      panel.onclick = function (e) {
        var b = e.target.closest('[data-inv]'); if (!b) return;
        var o = os.filter(function (x) { return x.id === b.dataset.inv; })[0];
        ctx.go('payments', { newInvoice: { client: o.userName, email: o.userEmail, orderRef: o.ref, items: (o.items || []).map(function (i) { return { desc: i.name, qty: i.qty, price: i.price }; }) } });
      };
    }).catch(ctx.fail);
  } });

  /* ---------------- Invoices & payments ---------------- */
  KT.registerAdmin({ key: 'payments', title: 'Invoices & payments', order: 30, perm: 'payments', render: function (panel, ctx) {
    var inv = [], pay = [], sub = 'invoices', pending = ctx.arg && ctx.arg.newInvoice;
    function paidFor(id) { return pay.reduce(function (s, p) { return p.invoiceId === id ? s + (p.type === 'refund' ? -1 : 1) * num(p.amount) : s; }, 0); }
    function invById(id) { return inv.filter(function (i) { return i.id === id; })[0]; }
    function sync(i) {
      var paid = paidFor(i.id), st = i.status;
      if (st === 'void') return Promise.resolve();
      if (i.total > 0 && paid >= i.total - 0.005) st = 'paid'; else if (paid > 0.005) st = 'partial'; else if (st === 'paid' || st === 'partial') st = 'sent';
      if (st === i.status) return Promise.resolve();
      i.status = st; return Store.col('invoices').save({ id: i.id, status: st });
    }
    function load(then) { Promise.all([Store.col('invoices').list(), Store.col('payments').list()]).then(function (r) { inv = r[0]; pay = r[1]; (then || paint)(); }).catch(ctx.fail); }
    function seg() {
      return '<div class="chips no-print" style="margin-bottom:1.2rem" role="group" aria-label="Section">' + [['invoices', 'Invoices'], ['payments', 'Payments & refunds'], ['recon', 'Reconciliation']].map(function (s) { return '<button type="button" class="chip" data-sub="' + s[0] + '" aria-pressed="' + (sub === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</div>';
    }
    function paint() {
      panel.innerHTML = seg() + '<div id="sub"></div>';
      if (sub === 'invoices') paintInvoices(); else if (sub === 'payments') paintPayments(); else paintRecon();
    }
    panel.onclick = function (e) { var s = e.target.closest('[data-sub]'); if (s) { sub = s.dataset.sub; paint(); } };

    /* invoices */
    function paintInvoices() {
      var box = $('#sub');
      box.innerHTML = '<div class="cta-row" style="margin-bottom:1.2rem"><button class="btn" type="button" id="new-inv">New invoice</button></div><div id="inv-form"></div><div class="list">' + (inv.length ? inv.map(function (i) {
        var paid = paidFor(i.id), bal = Math.max(0, num(i.total) - paid), late = i.due && i.due < today() && ['paid', 'void'].indexOf(i.status) < 0;
        return '<article class="row-card"><header><h3>' + E(i.number) + ' &middot; ' + E(i.client) + '</h3><span>' + KT.badge(i.status) + (late ? ' ' + KT.badge('Overdue', 'cancelled') : '') + '</span></header>' +
          '<div class="meta">' + E(i.email || '') + (i.due ? ' &middot; due ' + E(i.due) : '') + (i.orderRef ? ' &middot; order ' + E(i.orderRef) : '') + '</div>' +
          '<p style="margin:.5rem 0 0"><strong>' + KT.usd(i.total) + '</strong> &middot; paid ' + KT.usd(paid) + ' &middot; balance ' + KT.usd(bal) + '</p>' +
          '<div class="row-actions"><button class="btn btn-line btn-sm" type="button" data-view="' + E(i.id) + '">View / print</button><button class="btn btn-line btn-sm" type="button" data-iedit="' + E(i.id) + '">Edit</button>' +
          (bal > 0 && i.status !== 'void' ? '<button class="btn btn-sm" type="button" data-pay="' + E(i.id) + '">Record payment</button>' : '') + '<button class="link-btn danger" type="button" data-idel="' + E(i.id) + '">Delete</button></div></article>'; }).join('') : '<div class="empty"><h3>No invoices yet</h3><p>Create one here, or from an order or client project.</p></div>') + '</div>';
      $('#new-inv').addEventListener('click', function () { invForm(null); });
      box.onclick = function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.dataset.view) view(invById(t.dataset.view));
        else if (t.dataset.iedit) invForm(invById(t.dataset.iedit));
        else if (t.dataset.pay) { sub = 'payments'; paint(); payForm(t.dataset.pay); }
        else if (t.dataset.idel && confirm('Delete this invoice? Recorded payments stay on file.')) { var i = invById(t.dataset.idel); Store.col('invoices').remove(i.id).then(function () { Store.log('Deleted invoice ' + i.number); KT.toast('Invoice deleted'); load(); }).catch(function (err) { KT.toast(err.message); }); }
      };
      if (pending) { var p = pending; pending = null; invForm(null, p); }
    }
    function nextNumber() { var y = new Date().getFullYear(), n = inv.reduce(function (m, i) { var p = String(i.number || '').match(/^INV-(\d{4})-(\d+)$/); return p && +p[1] === y ? Math.max(m, +p[2]) : m; }, 0) + 1; return 'INV-' + y + '-' + String(n).padStart(3, '0'); }
    function calc(items, dPct, vPct) {
      var r = function (n) { return Math.round(n * 100) / 100; };
      var sub = items.reduce(function (t, l) { return t + num(l.qty) * num(l.price); }, 0);
      var disc = sub * Math.min(100, num(dPct)) / 100, vat = (sub - disc) * Math.min(100, num(vPct)) / 100;
      return { sub: r(sub), disc: r(disc), vat: r(vat), total: r(sub - disc + vat) };
    }
    var PAY_DEFAULT = 'Pay by EcoCash, InnBucks, Zimswitch or bank transfer. Please quote the invoice number as your payment reference.';
    function doc(i, paid) {
      var cfg = window.KINTON_CONFIG || {}, c = calc(i.items || [], i.discount, i.vat), bal = Math.max(0, c.total - paid);
      var late = i.due && i.due < today() && ['paid', 'void'].indexOf(i.status) < 0;
      var stamp = i.status === 'paid' ? 'PAID' : i.status === 'void' ? 'VOID' : late ? 'OVERDUE' : '';
      var rows = (i.items || []).map(function (l, n) { return '<tr><td>' + (n + 1) + '</td><td>' + E(l.desc) + '</td><td>' + E(l.qty) + '</td><td>' + KT.usd(l.price) + '</td><td>' + KT.usd(num(l.qty) * num(l.price)) + '</td></tr>'; }).join('');
      return '<article class="invoice inv-doc" style="position:relative">' + (stamp ? '<div class="inv-stamp s-' + stamp.toLowerCase() + '">' + stamp + '</div>' : '') +
        '<header class="inv-head"><div><div class="brand"><img src="assets/logo-mark-light.png" alt="" width="40" height="44"><span class="brand-word">KINTON</span></div>' +
        '<div class="inv-co">Kinton Technologies<br>Kadoma, Zimbabwe<br>WhatsApp ' + E(cfg.whatsappDisplay || '') + '</div></div>' +
        '<div class="inv-dates"><h2 class="inv-title">INVOICE</h2><div class="inv-no">' + E(i.number || 'Draft') + '</div></div></header>' +
        '<div class="inv-meta"><div class="inv-block"><span class="inv-k">Billed to</span><strong>' + E(i.client || 'Client name') + '</strong>' +
        (i.address ? '<br>' + E(i.address) : '') + (i.phone ? '<br>' + E(i.phone) : '') + (i.email ? '<br>' + E(i.email) : '') + (i.tin ? '<br>TIN ' + E(i.tin) : '') + '</div>' +
        '<div class="inv-dates"><span class="inv-k">Issued</span>' + E(i.issued || today()) + (i.due ? '<br><span class="inv-k">Due</span>' + E(i.due) : '') +
        '<br><span class="inv-k" style="margin-top:.6rem">Status</span>' + KT.badge(late && i.status !== 'paid' ? 'Overdue' : i.status, late ? 'cancelled' : undefined) + (i.orderRef ? '<br><span class="inv-k">Order</span>' + E(i.orderRef) : '') + '</div></div>' +
        '<div class="table-wrap"><table class="inv-table"><thead><tr><th>No.</th><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="inv-sum"><div><span>Subtotal</span><span>' + KT.usd(c.sub) + '</span></div>' +
        (c.disc ? '<div><span>Discount (' + num(i.discount) + '%)</span><span>-' + KT.usd(c.disc) + '</span></div>' : '') +
        (c.vat ? '<div><span>VAT (' + num(i.vat) + '%)</span><span>' + KT.usd(c.vat) + '</span></div>' : '') +
        '<div><strong>Total</strong><strong>' + KT.usd(c.total) + '</strong></div>' +
        (paid ? '<div><span>Paid</span><span>-' + KT.usd(paid) + '</span></div>' : '') +
        '<div class="due"><span>Balance due</span><strong>' + KT.usd(bal) + '</strong></div></div>' +
        '<p class="inv-note"><strong>How to pay</strong><br>' + E(i.payinfo || PAY_DEFAULT) + '</p>' +
        (i.notes ? '<p class="inv-note" style="white-space:pre-wrap">' + E(i.notes) + '</p>' : '') +
        '<footer class="inv-foot">Thank you for choosing Kinton Technologies. Building ideas. Creating solutions.</footer></article>';
    }
    function invForm(i, pre) {
      i = i || Object.assign({ client: '', email: '', phone: '', address: '', tin: '', items: [{ desc: '', qty: 1, price: 0 }], status: 'draft', issued: today(), due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), discount: 0, vat: 0, payinfo: PAY_DEFAULT, notes: 'Thank you for your business.', orderRef: '', projectId: '' }, pre || {});
      var box = $('#inv-form'), fld = function (id, label, val, attrs) { return '<div class="field"><label for="i-' + id + '">' + label + '</label><input id="i-' + id + '" ' + (attrs || 'type="text"') + ' value="' + E(val == null ? '' : val) + '"></div>'; };
      box.innerHTML = '<div class="inv-layout"><form class="panel" id="invf" novalidate><h2 style="font-size:1.3rem">' + (i.id ? 'Edit ' + E(i.number) : 'New invoice') + '</h2>' +
        '<h3 class="inv-sec">Client</h3><div class="form-grid">' + fld('client', 'Client name', i.client, 'type="text" maxlength="100"') + fld('email', 'Email', i.email, 'type="email" maxlength="120"') + fld('phone', 'Phone / WhatsApp', i.phone, 'type="tel" maxlength="20"') + fld('tin', 'TIN / BP number (optional)', i.tin, 'type="text" maxlength="30"') +
        '<div class="field full"><label for="i-address">Address</label><input id="i-address" type="text" maxlength="160" value="' + E(i.address || '') + '"></div></div>' +
        '<h3 class="inv-sec">Dates and status</h3><div class="form-grid">' + fld('issued', 'Issue date', i.issued || today(), 'type="date"') + fld('due', 'Due date', i.due, 'type="date"') +
        '<div class="field"><label for="i-status">Status</label><select id="i-status">' + ['draft', 'sent', 'partial', 'paid', 'void'].map(function (s) { return '<option' + (s === i.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div></div>' +
        '<h3 class="inv-sec">Items</h3><div id="lines"></div><button type="button" class="link-btn" id="add-line">+ Add a line</button>' +
        '<div class="form-grid" style="margin-top:1rem">' + fld('disc', 'Discount %', i.discount || 0, 'type="number" min="0" max="100" step="0.5"') + fld('vat', 'VAT % (0 if not registered)', i.vat || 0, 'type="number" min="0" max="100" step="0.5"') + '</div>' +
        '<div class="inv-calc" id="calc"></div>' +
        '<h3 class="inv-sec">Payment and notes</h3><div class="field"><label for="i-payinfo">How to pay</label><textarea id="i-payinfo" maxlength="300" style="min-height:4rem">' + E(i.payinfo || PAY_DEFAULT) + '</textarea></div>' +
        '<div class="field"><label for="i-notes">Notes</label><textarea id="i-notes" maxlength="500" style="min-height:4rem">' + E(i.notes) + '</textarea></div>' +
        '<div class="cta-row"><button class="btn" type="submit">Save invoice</button><button class="btn btn-line" type="button" id="i-cancel">Cancel</button></div><div id="i-msg" class="msg" role="alert"></div></form>' +
        '<aside class="inv-preview" aria-label="Live preview"></aside></div>';
      var lines = $('#lines'), form = $('#invf');
      function addLine(l) { var d = document.createElement('div'); d.className = 'inv-row inv-row-x'; d.innerHTML = '<input type="text" placeholder="Description" aria-label="Description" maxlength="120" value="' + E(l.desc) + '"><input type="number" min="1" max="999" step="1" aria-label="Quantity" value="' + E(l.qty) + '"><input type="number" min="0" step="0.01" aria-label="Unit price" value="' + E(l.price) + '"><span class="inv-amt"></span><button type="button" class="link-btn danger" aria-label="Remove line">&times;</button>'; lines.appendChild(d); }
      function read() {
        var v = function (id) { return $('#i-' + id).value.trim(); };
        var items = Array.prototype.map.call(lines.children, function (r) { var f = r.querySelectorAll('input'); return { desc: f[0].value.trim().slice(0, 120), qty: Math.max(1, Math.round(num(f[1].value))), price: Math.max(0, Math.round(num(f[2].value) * 100) / 100) }; });
        return Object.assign({}, i, { client: v('client').slice(0, 100), email: v('email'), phone: v('phone'), tin: v('tin'), address: v('address'), issued: v('issued') || today(), due: v('due'), status: $('#i-status').value, items: items, discount: Math.min(100, Math.max(0, num(v('disc')))), vat: Math.min(100, Math.max(0, num(v('vat')))), payinfo: v('payinfo').slice(0, 300), notes: v('notes').slice(0, 500) });
      }
      function refresh() {
        var d = read(), c = calc(d.items, d.discount, d.vat);
        Array.prototype.forEach.call(lines.children, function (r, n) { r.querySelector('.inv-amt').textContent = KT.usd(d.items[n].qty * d.items[n].price); });
        $('#calc').innerHTML = '<div><span>Subtotal</span><span>' + KT.usd(c.sub) + '</span></div>' + (c.disc ? '<div><span>Discount</span><span>-' + KT.usd(c.disc) + '</span></div>' : '') + (c.vat ? '<div><span>VAT</span><span>' + KT.usd(c.vat) + '</span></div>' : '') + '<div class="inv-total"><strong>Total</strong><strong>' + KT.usd(c.total) + '</strong></div>';
        d.items = d.items.filter(function (x) { return x.desc; });
        $('.inv-preview').innerHTML = doc(d, i.id ? paidFor(i.id) : 0);
      }
      (i.items.length ? i.items : [{ desc: '', qty: 1, price: 0 }]).forEach(addLine); refresh();
      form.addEventListener('input', refresh);
      lines.addEventListener('click', function (e) { if (e.target.closest('.link-btn') && lines.children.length > 1) { e.target.closest('.inv-row').remove(); refresh(); } });
      $('#add-line').addEventListener('click', function () { addLine({ desc: '', qty: 1, price: 0 }); refresh(); });
      $('#i-cancel').addEventListener('click', function () { box.innerHTML = ''; });
      form.addEventListener('submit', function (e) {
        e.preventDefault(); var msg = $('#i-msg'), d = read();
        if (d.client.length < 2) return say(msg, 'Enter the client name.');
        if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return say(msg, 'That email does not look right.');
        d.items = d.items.filter(function (x) { return x.desc; });
        if (!d.items.length) return say(msg, 'Add at least one item with a description.');
        var c = calc(d.items, d.discount, d.vat);
        var saved = Object.assign({}, d, { number: i.number || nextNumber(), total: c.total, subtotal: c.sub, discountAmt: c.disc, vatAmt: c.vat, orderRef: i.orderRef || '', projectId: i.projectId || '' });
        var btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
        Store.col('invoices').save(saved).then(function () { Store.log((i.id ? 'Edited' : 'Created') + ' invoice ' + saved.number); KT.toast('Invoice saved'); load(); }).catch(function (err) { say(msg, err.message); btn.disabled = false; });
      });
      box.scrollIntoView({ block: 'start' });
    }
    function view(i) {
      var paid = paidFor(i.id), c = calc(i.items || [], i.discount, i.vat), bal = Math.max(0, c.total - paid);
      var wa = 'https://wa.me/' + String(i.phone || '').replace(/\D/g, '') + '?text=' + encodeURIComponent('Hello ' + i.client + ', here is invoice ' + i.number + ' from Kinton Technologies. Amount due: ' + KT.usd(bal) + (i.due ? ', due ' + i.due : '') + '. Thank you!');
      panel.innerHTML = '<div class="no-print cta-row" style="margin-bottom:1rem"><button class="btn" type="button" id="do-print">Print or save as PDF</button><a class="btn btn-line" target="_blank" rel="noopener" href="' + E(wa) + '">Send on WhatsApp</a><button class="btn btn-line" type="button" id="back-inv">Back</button></div>' + doc(i, paid);
      $('#do-print').addEventListener('click', function () { window.print(); }); $('#back-inv').addEventListener('click', function () { load(); });
    }

    /* payments */
    function paintPayments() {
      var box = $('#sub'), sorted = pay.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      box.innerHTML = '<div class="cta-row" style="margin-bottom:1.2rem"><button class="btn" type="button" id="new-pay">Record payment or refund</button></div><div id="pay-form"></div><div class="list">' + (sorted.length ? sorted.map(function (p) {
        var i = invById(p.invoiceId), ref = p.type === 'refund';
        return '<article class="row-card"><header><h3>' + (ref ? '&minus;' : '') + KT.usd(p.amount) + ' &middot; ' + E(p.method) + '</h3><span>' + KT.badge(ref ? 'refund' : 'payment', ref ? 'cancelled' : 'completed') + (p.reconciled ? ' ' + KT.badge('Matched', 'completed') : '') + '</span></header>' +
          '<div class="meta">' + E(p.date) + (i ? ' &middot; ' + E(i.number) + ' (' + E(i.client) + ')' : ' &middot; no invoice') + (p.reference ? ' &middot; ref ' + E(p.reference) : '') + '</div>' + (p.note ? '<p class="meta" style="margin:.4rem 0 0">' + E(p.note) + '</p>' : '') +
          '<div class="row-actions"><button class="link-btn danger" type="button" data-pdel="' + E(p.id) + '">Delete</button></div></article>'; }).join('') : '<div class="empty"><h3>No payments recorded</h3><p>This dashboard records money you receive (cash, EcoCash, bank). It does not process payments itself.</p></div>') + '</div>';
      $('#new-pay').addEventListener('click', function () { payForm(''); });
      box.onclick = function (e) {
        var d = e.target.closest('[data-pdel]'); if (!d || !confirm('Delete this record?')) return;
        var p = pay.filter(function (x) { return x.id === d.dataset.pdel; })[0];
        Store.col('payments').remove(p.id).then(function () { pay = pay.filter(function (x) { return x.id !== p.id; }); var i = invById(p.invoiceId); return i ? sync(i) : null; }).then(function () { Store.log('Deleted a payment record'); load(); }).catch(function (err) { KT.toast(err.message); });
      };
    }
    function payForm(invId) {
      var box = $('#pay-form'), open = inv.filter(function (i) { return i.status !== 'void'; });
      var sel = invId ? invById(invId) : null, def = sel ? Math.max(0, num(sel.total) - paidFor(sel.id)) : '';
      box.innerHTML = '<form class="panel" id="payf" style="margin-bottom:1.5rem" novalidate><h2 style="font-size:1.3rem">Record payment or refund</h2><div class="form-grid">' +
        '<div class="field"><label for="y-type">Type</label><select id="y-type"><option value="payment">Payment received</option><option value="refund">Refund given</option></select></div>' +
        '<div class="field"><label for="y-inv">Invoice</label><select id="y-inv"><option value="">No invoice</option>' + open.map(function (i) { return '<option value="' + E(i.id) + '"' + (i.id === invId ? ' selected' : '') + '>' + E(i.number + ' - ' + i.client) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="y-amt">Amount (USD)</label><input id="y-amt" type="number" min="0.01" step="0.01" inputmode="decimal" value="' + E(def) + '"></div>' +
        '<div class="field"><label for="y-method">Method</label><select id="y-method"><option>Cash</option><option>EcoCash</option><option>Bank transfer</option><option>Other</option></select></div>' +
        '<div class="field"><label for="y-ref">Reference (optional)</label><input id="y-ref" type="text" maxlength="60"></div><div class="field"><label for="y-date">Date</label><input id="y-date" type="date" value="' + today() + '"></div>' +
        '<div class="field full"><label for="y-note">Note (optional)</label><input id="y-note" type="text" maxlength="200"></div></div>' +
        '<div class="cta-row"><button class="btn" type="submit">Save</button><button class="btn btn-line" type="button" id="y-cancel">Cancel</button></div><div id="y-msg" class="msg" role="alert"></div></form>';
      $('#y-cancel').addEventListener('click', function () { box.innerHTML = ''; });
      $('#payf').addEventListener('submit', function (e) {
        e.preventDefault(); var msg = $('#y-msg'), amt = Math.round(num($('#y-amt').value) * 100) / 100;
        if (amt <= 0 || amt > 1000000) return say(msg, 'Enter an amount greater than 0.');
        var doc = { invoiceId: $('#y-inv').value, type: $('#y-type').value, amount: amt, method: $('#y-method').value, reference: $('#y-ref').value.trim().slice(0, 60), date: $('#y-date').value || today(), note: $('#y-note').value.trim().slice(0, 200), reconciled: false };
        var btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
        Store.col('payments').save(doc).then(function (saved) { pay.push(saved); var i = invById(doc.invoiceId); return i ? sync(i) : null; })
          .then(function () { Store.log('Recorded a ' + doc.type + ' of ' + KT.usd(amt)); KT.toast('Saved'); load(); }).catch(function (err) { say(msg, err.message); btn.disabled = false; });
      });
      box.scrollIntoView({ block: 'start' });
    }

    /* reconciliation */
    function paintRecon() {
      var net = function (l) { return l.reduce(function (s, p) { return s + (p.type === 'refund' ? -1 : 1) * num(p.amount); }, 0); };
      var un = pay.filter(function (p) { return !p.reconciled; }), ok = pay.filter(function (p) { return p.reconciled; });
      var owed = inv.filter(function (i) { return ['paid', 'void', 'draft'].indexOf(i.status) < 0; }).reduce(function (s, i) { return s + Math.max(0, num(i.total) - paidFor(i.id)); }, 0);
      $('#sub').innerHTML = '<div class="stats"><div class="stat"><div class="stat-n">' + KT.usd(net(pay)) + '</div><div class="stat-l">Recorded (net)</div></div><div class="stat"><div class="stat-n">' + KT.usd(net(ok)) + '</div><div class="stat-l">Matched to statements</div></div><div class="stat"><div class="stat-n">' + KT.usd(net(un)) + '</div><div class="stat-l">Not yet matched</div></div><div class="stat"><div class="stat-n">' + KT.usd(owed) + '</div><div class="stat-l">Still owed by clients</div></div></div>' +
        '<p class="muted" style="margin:1.2rem 0">Compare each line with your cash book, EcoCash statement or bank statement. Tick "Matched" when the money really arrived.</p><div class="list">' + (un.length ? un.map(function (p) {
          var i = invById(p.invoiceId); return '<article class="row-card"><label class="check"><input type="checkbox" data-match="' + E(p.id) + '"><span><strong>' + (p.type === 'refund' ? '&minus;' : '') + KT.usd(p.amount) + '</strong> &middot; ' + E(p.method) + ' &middot; ' + E(p.date) + (i ? ' &middot; ' + E(i.number) : '') + (p.reference ? ' &middot; ref ' + E(p.reference) : '') + '</span></label></article>'; }).join('') : '<div class="empty">Everything recorded has been matched.</div>') + '</div>';
      $('#sub').onchange = function (e) {
        var c = e.target.closest('[data-match]'); if (!c) return;
        Store.col('payments').save({ id: c.dataset.match, reconciled: true }).then(function () { Store.log('Matched a payment to a statement'); load(); }).catch(function (err) { KT.toast(err.message); c.checked = false; });
      };
    }
    load();
  } });
})();
