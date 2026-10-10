/* Kinton Technologies - site behaviour (header, cart, shop, auth, checkout, contact). */
(function () {
  'use strict';
  var cfg = window.KINTON_CONFIG || {};

  // Always use HTTPS on the live site
  if (location.protocol === 'http:' && !/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname)) {
    location.replace('https://' + location.host + location.pathname + location.search + location.hash);
    return;
  }

  /* ---------- helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function money(n) {
    n = Number(n) || 0;
    return n > 0 ? (cfg.currencySymbol || '$') + (n % 1 ? n.toFixed(2) : n) : 'Custom quote';
  }
  function priceHTML(p) { return p.price > 0 ? '<span class="price">' + money(p.price) + '</span>' : '<span class="price"><small>Custom quote</small></span>'; }
  function safeImg(u) {
    u = String(u || '');
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(u)) return u;
    if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u;
    return '';
  }
  function fmtDate(ms) { return ms ? new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function waLink(text, number) { return 'https://wa.me/' + (number || cfg.whatsappNumber || '') + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function safeNext(n) { return /^[a-z0-9\-]+\.html(\?[\w=&%\-]*)?$/i.test(n || '') ? n : ''; }
  function param(k) { return new URLSearchParams(location.search).get(k) || ''; }
  function say(el, text, kind) { if (!el) return; el.textContent = text || ''; el.className = 'msg' + (text ? ' ' + (kind || 'error') : ''); }

  var ICONS = {
    Websites: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>',
    Apps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>',
    Branding: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 8-8 10-8-10z"/><path d="M12 3v18M4 11h16"/></svg>',
    'Add-ons': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>'
  };
  function icon(cat) { return ICONS[cat] || ICONS['Add-ons']; }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------- cart (per device) ---------- */
  var Cart = {
    key: 'kt_cart',
    get: function () { try { var c = JSON.parse(localStorage.getItem(this.key) || '[]'); return Array.isArray(c) ? c.filter(function (i) { return i && i.id && i.qty > 0; }) : []; } catch (e) { return []; } },
    save: function (c) { try { localStorage.setItem(this.key, JSON.stringify(c)); } catch (e) {} badge(); },
    add: function (p) {
      var c = this.get(), it = c.find(function (i) { return i.id === p.id; });
      if (it) it.qty = Math.min(20, it.qty + 1); else c.push({ id: p.id, qty: 1 });
      this.save(c);
    },
    setQty: function (id, q) {
      var c = this.get().map(function (i) { if (i.id === id) i.qty = Math.max(0, Math.min(20, q)); return i; }).filter(function (i) { return i.qty > 0; });
      this.save(c);
    },
    clear: function () { this.save([]); },
    count: function () { return this.get().reduce(function (n, i) { return n + i.qty; }, 0); }
  };
  function badge() {
    var n = Cart.count();
    $$('.cart-count').forEach(function (b) { b.textContent = n; b.hidden = n === 0; });
  }
  window.addEventListener('storage', badge);

  /* ---------- reCAPTCHA (v2 checkbox) ---------- */
  var capPromise;
  function loadRecaptcha() {
    if (capPromise) return capPromise;
    capPromise = new Promise(function (res, rej) {
      if (window.grecaptcha && window.grecaptcha.render) return res();
      window.__ktCaptchaReady = res;
      var s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?onload=__ktCaptchaReady&render=explicit';
      s.async = true; s.onerror = function () { rej(new Error('captcha')); };
      document.head.appendChild(s);
    });
    return capPromise;
  }
  function mountCaptcha(el) {
    if (!el) return { get: function () { return 'none'; }, reset: function () {} };
    if (!cfg.recaptchaSiteKey) return { get: function () { return 'no-key'; }, reset: function () {} };
    var h = { id: null, ok: false,
      get: function () { return this.ok ? window.grecaptcha.getResponse(this.id) : ''; },
      reset: function () { if (this.ok) window.grecaptcha.reset(this.id); } };
    loadRecaptcha().then(function () {
      h.id = window.grecaptcha.render(el, { sitekey: cfg.recaptchaSiteKey, size: window.innerWidth < 360 ? 'compact' : 'normal' });
      h.ok = true;
    }).catch(function () {
      el.innerHTML = '<p class="msg error">The security check could not load. Check your connection and reload the page.</p>';
    });
    return h;
  }
  function needCaptcha(cap, msgEl) {
    if (cap.get()) return true;
    say(msgEl, 'Tick the "I\'m not a robot" box first.', 'error');
    return false;
  }

  /* ---------- header / footer ---------- */
  function initHeader() {
    var btn = $('.menu-btn'), nav = $('#nav');
    if (btn && nav) {
      btn.addEventListener('click', function () {
        var open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
      $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }); });
    }
    var page = document.body.getAttribute('data-page');
    $$('#nav a').forEach(function (a) { if (a.getAttribute('data-page') === page) a.setAttribute('aria-current', 'page'); });
    paintAccount();
    Store.onChange(paintAccount);
    badge();
    $$('.year').forEach(function (y) { y.textContent = new Date().getFullYear(); });
    if (Store.demo) {
      var bar = document.createElement('div'); bar.className = 'demo-bar';
      bar.innerHTML = '<div class="wrap">Demo mode: accounts, orders and products are saved only in this browser. Add your Firebase keys in config.js to go live.</div>';
      document.body.insertBefore(bar, document.body.firstChild);
    }
    if (Store.failed) {
      var f = document.createElement('div'); f.className = 'demo-bar'; f.style.background = '#fbeaea';
      f.innerHTML = '<div class="wrap">We couldn\'t reach the server. Shop and sign-in may not work until you reload.</div>';
      document.body.insertBefore(f, document.body.firstChild);
    }
  }
  function paintAccount() {
    var a = $('#account-link'); if (!a) return;
    var u = Store.user;
    if (u) { a.textContent = u.isAdmin ? 'Admin' : 'Account'; a.href = u.isAdmin ? 'admin.html' : 'account.html'; }
    else { a.textContent = 'Sign in'; a.href = 'signin.html'; }
  }

  function applyContent() {
    Store.getContent().then(function (c) {
      c = c || {};
      $$('[data-content]').forEach(function (el) { var v = c[el.getAttribute('data-content')]; if (v) el.textContent = v; });
      if (c.announcementOn && c.announcement) {
        var b = document.createElement('div'); b.className = 'announce'; b.setAttribute('role', 'note'); b.textContent = c.announcement;
        var h = $('.site-header'); if (h && h.parentNode) h.parentNode.insertBefore(b, h);
      }
    }).catch(function () {});
  }

  /* ---------- product rendering ---------- */
  var productCache = {};
  function cardHTML(p) {
    var img = safeImg(p.image);
    return '<article class="card"><div class="card-img">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon(p.category)) + '</div>' +
      '<div class="card-body"><span class="cat">' + esc(p.category) + '</span><h3>' + esc(p.name) + '</h3><p>' + esc(p.description) + '</p>' +
      '<div class="card-foot">' + priceHTML(p) + '<button type="button" class="btn btn-sm" data-add="' + esc(p.id) + '">Add to cart</button></div></div></article>';
  }
  function cacheProducts(list) { list.forEach(function (p) { productCache[p.id] = p; }); }
  function bindAdd(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]'); if (!b) return;
      var p = productCache[b.getAttribute('data-add')]; if (!p) return;
      Cart.add(p); toast('Added "' + p.name + '" to your cart');
      var old = b.textContent; b.textContent = 'Added'; setTimeout(function () { b.textContent = old; }, 1200);
    });
  }

  /* ---------- pages ---------- */
  var pages = {};

  pages.home = function () {
    var box = $('#featured'); if (!box) return;
    Store.listProducts().then(function (list) {
      cacheProducts(list);
      var f = list.filter(function (p) { return p.featured; });
      if (f.length < 4) f = f.concat(list.filter(function (p) { return !p.featured; }));
      f = f.slice(0, 4);
      box.innerHTML = f.length ? f.map(cardHTML).join('') : '<div class="empty" style="grid-column:1/-1"><h3>The shop is being set up</h3><p>Message us on WhatsApp and we will help you directly.</p></div>';
    }).catch(function () { box.innerHTML = '<div class="empty" style="grid-column:1/-1">We could not load the shop. Please reload.</div>'; });
    bindAdd(box);
  };

  pages.shop = function () {
    var grid = $('#grid'), chips = $('#chips'), q = $('#q'), sort = $('#sort'), count = $('#count');
    var all = [], state = { cat: param('cat'), q: '', sort: 'featured' };
    function render() {
      var list = all.filter(function (p) {
        if (state.cat && p.category !== state.cat) return false;
        if (state.q) { var h = (p.name + ' ' + p.description + ' ' + p.category).toLowerCase(); if (h.indexOf(state.q) < 0) return false; }
        return true;
      });
      var s = state.sort;
      list.sort(function (a, b) {
        if (s === 'low') return (a.price || 1e9) - (b.price || 1e9);
        if (s === 'high') return b.price - a.price;
        if (s === 'name') return a.name.localeCompare(b.name);
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.name.localeCompare(b.name);
      });
      grid.innerHTML = list.length ? list.map(cardHTML).join('') :
        '<div class="empty" style="grid-column:1/-1"><h3>Nothing matches that</h3><p>Try another category or search word, or <a href="contact.html">ask us for a quote</a>.</p></div>';
      count.textContent = list.length + (list.length === 1 ? ' item' : ' items');
      $$('.chip', chips).forEach(function (c) { c.setAttribute('aria-pressed', String((c.getAttribute('data-cat') || '') === state.cat)); });
    }
    Store.listProducts().then(function (list) {
      all = list; cacheProducts(list);
      var cats = Store.categories.filter(function (c) { return list.some(function (p) { return p.category === c; }); });
      list.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
      if (state.cat && cats.indexOf(state.cat) < 0) state.cat = '';
      chips.innerHTML = ['All'].concat(cats).map(function (c) { return '<button type="button" class="chip" data-cat="' + (c === 'All' ? '' : esc(c)) + '" aria-pressed="false">' + esc(c) + '</button>'; }).join('');
      render();
    }).catch(function () { grid.innerHTML = '<div class="empty" style="grid-column:1/-1">We could not load the shop. Please reload.</div>'; });
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.cat = b.getAttribute('data-cat') || '';
      history.replaceState(null, '', state.cat ? '?cat=' + encodeURIComponent(state.cat) : location.pathname); render();
    });
    q.addEventListener('input', function () { state.q = q.value.trim().toLowerCase(); render(); });
    sort.addEventListener('change', function () { state.sort = sort.value; render(); });
    bindAdd(grid);
  };

  pages.cart = function () {
    var list = $('#cart-list'), sum = $('#cart-sum'), wrapEl = $('#cart-wrap'), done = $('#cart-done');
    var products = {};

    function lines() {
      return Cart.get().map(function (i) { var p = products[i.id]; return p ? { p: p, qty: i.qty } : { gone: true, id: i.id, qty: i.qty }; });
    }
    function paint() {
      var ls = lines(), live = ls.filter(function (l) { return !l.gone; });
      ls.filter(function (l) { return l.gone; }).forEach(function (l) { Cart.setQty(l.id, 0); });
      if (!live.length) {
        wrapEl.innerHTML = '<div class="empty"><h3>Your cart is empty</h3><p>Pick a package from the shop and it will show up here.</p><a class="btn" href="shop.html">Browse the shop</a></div>';
        return;
      }
      var total = 0, quote = false;
      list.innerHTML = live.map(function (l) {
        var p = l.p, img = safeImg(p.image); if (p.price > 0) total += p.price * l.qty; else quote = true;
        return '<div class="cart-item"><div class="thumb">' + (img ? '<img src="' + esc(img) + '" alt="">' : icon(p.category)) + '</div>' +
          '<div><h3>' + esc(p.name) + '</h3><div class="meta">' + esc(p.category) + ' &middot; ' + (p.price > 0 ? money(p.price) + ' each' : 'Custom quote') + '</div></div>' +
          '<div class="cart-ctl"><div class="qty" role="group" aria-label="Quantity for ' + esc(p.name) + '"><button type="button" data-q="-1" data-id="' + esc(p.id) + '" aria-label="Decrease quantity">&minus;</button><span>' + l.qty + '</span><button type="button" data-q="1" data-id="' + esc(p.id) + '" aria-label="Increase quantity">+</button></div>' +
          '<button type="button" class="link-btn danger" data-rm="' + esc(p.id) + '">Remove</button></div></div>';
      }).join('');
      $('#sum-total').textContent = money(total) === 'Custom quote' ? (cfg.currencySymbol || '$') + '0' : money(total);
      $('#sum-quote').hidden = !quote;
      paintCheckout();
    }
    function paintCheckout() {
      var box = $('#checkout');
      if (!Store.user) {
        box.innerHTML = '<p class="muted">Sign in or create an account to place your order. Your cart will be waiting.</p>' +
          '<a class="btn btn-block" href="signin.html?next=cart.html">Sign in</a><p style="margin:.8rem 0 0;text-align:center"><a class="link-btn" href="signup.html?next=cart.html">Create an account</a></p>';
        return;
      }
      box.innerHTML = '<form id="order-form" novalidate><p class="muted" style="font-size:.9rem">Ordering as <strong>' + esc(Store.user.name || Store.user.email) + '</strong> (' + esc(Store.user.email) + ')</p>' +
        '<div class="field"><label for="o-phone">Phone / WhatsApp number</label><input id="o-phone" type="tel" autocomplete="tel" placeholder="e.g. 077 123 4567" required maxlength="20"></div>' +
        '<div class="field"><label for="o-note">Anything we should know? (optional)</label><textarea id="o-note" maxlength="500" placeholder="Your business name, deadline, ideas..."></textarea></div>' +
        '<button class="btn btn-block" type="submit">Place order</button><div id="o-msg" class="msg" role="alert"></div>' +
        '<p class="hint">Placing an order does not charge you. We confirm scope, price and payment with you on WhatsApp first.</p></form>';
      $('#order-form').addEventListener('submit', place);
    }
    function place(e) {
      e.preventDefault();
      var msg = $('#o-msg'), btn = e.target.querySelector('button'), phone = $('#o-phone').value.trim(), note = $('#o-note').value.trim();
      if (!/^[+\d][\d\s\-]{6,18}$/.test(phone)) return say(msg, 'Enter a valid phone number, for example 077 123 4567.');
      var ls = lines().filter(function (l) { return !l.gone; }); if (!ls.length) return;
      var total = 0;
      var items = ls.map(function (l) { if (l.p.price > 0) total += l.p.price * l.qty; return { id: l.p.id, name: String(l.p.name).slice(0, 80), price: Number(l.p.price) || 0, qty: l.qty }; });
      btn.disabled = true; btn.textContent = 'Placing order...'; say(msg, '');
      Store.createOrder({ userName: Store.user.name || Store.user.email, userEmail: Store.user.email, phone: phone, note: note.slice(0, 500), items: items, total: total })
        .then(function (o) {
          Cart.clear(); wrapEl.hidden = true; done.hidden = false;
          $('#done-ref').textContent = o.ref;
          var text = 'Hi Kinton, I just placed order ' + o.ref + ' on your website:\n' + items.map(function (i) { return '- ' + i.qty + ' x ' + i.name; }).join('\n') + '\nTotal: ' + (total > 0 ? money(total) : 'to be quoted');
          $('#done-wa').href = waLink(text);
          window.scrollTo(0, 0);
        }).catch(function (err) { say(msg, err.message); btn.disabled = false; btn.textContent = 'Place order'; });
    }
    Store.listProducts().then(function (ps) {
      ps.forEach(function (p) { products[p.id] = p; }); paint();
    }).catch(function () { say($('#cart-err'), 'We could not load your cart. Please reload.'); });
    wrapEl.addEventListener('click', function (e) {
      var q = e.target.closest('[data-q]'), r = e.target.closest('[data-rm]');
      if (q) { var id = q.getAttribute('data-id'), cur = (Cart.get().find(function (i) { return i.id === id; }) || {}).qty || 0; Cart.setQty(id, cur + Number(q.getAttribute('data-q'))); paint(); }
      if (r) { Cart.setQty(r.getAttribute('data-rm'), 0); paint(); }
    });
    Store.onChange(function () { if (!done.hidden) return; var b = $('#checkout'); if (b) paintCheckout(); });
  };

  function afterAuthRedirect(user, wantAdmin) {
    var next = safeNext(param('next'));
    location.href = wantAdmin && user.isAdmin ? 'admin.html' : (next || (user.isAdmin ? 'admin.html' : 'account.html'));
  }

  pages.signin = function () {
    if (Store.user) return afterAuthRedirect(Store.user, Store.user.isAdmin);
    var form = $('#signin-form'), msg = $('#msg'), cap = mountCaptcha($('#captcha'));
    if (Store.suspendedMsg) say(msg, Store.suspendedMsg);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); say(msg, '');
      var email = $('#email').value.trim(), pw = $('#password').value, role = form.elements.role.value;
      if (!email || !pw) return say(msg, 'Enter your email and password.');
      if (!needCaptcha(cap, msg)) return;
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      Store.signIn(email, pw).then(function (u) {
        if (role === 'admin' && !u.isAdmin) {
          return Store.signOut().then(function () {
            cap.reset(); btn.disabled = false;
            say(msg, u.adminRequested ? 'Your staff request is still waiting for approval. Sign in as a customer for now.' : 'This account does not have staff access. Sign in as a customer, or ask an admin to approve you.');
          });
        }
        afterAuthRedirect(u, role === 'admin');
      }).catch(function (err) { say(msg, err.message); cap.reset(); btn.disabled = false; });
    });
    $('#forgot').addEventListener('click', function () {
      var email = $('#email').value.trim();
      if (!email) return say(msg, 'Type your email above first, then tap "Forgot password?".');
      Store.resetPassword(email).then(function () { say(msg, 'If an account exists for that email, a reset link is on its way.', 'ok'); }).catch(function (err) { say(msg, err.message); });
    });
    var su = $('#to-signup'); if (su && param('next')) su.href = 'signup.html?next=' + encodeURIComponent(param('next'));
  };

  pages.signup = function () {
    if (Store.user) return afterAuthRedirect(Store.user, false);
    var form = $('#signup-form'), msg = $('#msg'), cap = mountCaptcha($('#captcha')), note = $('#admin-note');
    $$('input[name=role]', form).forEach(function (r) { r.addEventListener('change', function () { note.hidden = form.elements.role.value !== 'admin'; }); });
    $('#show-pw').addEventListener('change', function (e) { $('#password').type = e.target.checked ? 'text' : 'password'; });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); say(msg, '');
      var name = $('#name').value.trim(), email = $('#email').value.trim(), pw = $('#password').value, wantAdmin = form.elements.role.value === 'admin';
      if (name.length < 2) return say(msg, 'Enter your full name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say(msg, 'Enter a valid email address.');
      if (pw.length < 8) return say(msg, 'Your password needs at least 8 characters.');
      if (!$('#agree').checked) return say(msg, 'Please agree to the terms and privacy notice to continue.');
      if (!needCaptcha(cap, msg)) return;
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      Store.signUp(name.slice(0, 80), email, pw, wantAdmin).then(function (u) {
        var next = safeNext(param('next'));
        location.href = u.isAdmin ? 'admin.html' : (wantAdmin ? 'account.html' : (next || 'account.html'));
      }).catch(function (err) { say(msg, err.message); cap.reset(); btn.disabled = false; });
    });
    var si = $('#to-signin'); if (si && param('next')) si.href = 'signin.html?next=' + encodeURIComponent(param('next'));
  };

  pages.account = function () {
    var root = $('#account-root'), u = Store.user;
    if (!u) { root.innerHTML = '<div class="empty"><h3>You are signed out</h3><p>Sign in to see your orders.</p><a class="btn" href="signin.html?next=account.html">Sign in</a></div>'; return; }
    $('#acc-name').textContent = u.name || u.email;
    $('#acc-email').textContent = u.email;
    if (u.isAdmin) { $('#acc-admin').hidden = false; }
    else if (u.adminRequested) { $('#acc-pending').hidden = false; }
    $('#signout').addEventListener('click', function () { Store.signOut().then(function () { location.href = 'index.html'; }); });

    // Support tickets
    var tBox = $('#tickets'), tForm = $('#ticket-form');
    function threadHTML(t) {
      return '<div class="thread"><div class="bubble"><strong>You</strong><p>' + esc(t.message) + '</p></div>' + (t.replies || []).map(function (r) { return '<div class="bubble ' + (r.role === 'staff' ? 'staff' : '') + '"><strong>' + (r.role === 'staff' ? 'Kinton' : 'You') + '</strong> <span class="meta">' + esc(fmtDate(r.at)) + '</span><p>' + esc(r.text) + '</p></div>'; }).join('') + '</div>';
    }
    function loadTickets() {
      Store.listMyTickets().then(function (ts) {
        tBox.innerHTML = ts.length ? ts.map(function (t) {
          return '<article class="row-card" data-id="' + esc(t.id) + '"><header><h3>' + esc(t.subject) + '</h3><span class="badge ' + (t.status === 'open' ? 'new' : (t.status === 'resolved' ? 'completed' : '')) + '">' + esc(t.status === 'pending' ? 'Kinton replied' : t.status) + '</span></header><div class="meta">' + esc(fmtDate(t.createdAt)) + '</div>' + threadHTML(t) +
            (t.status === 'resolved' ? '' : '<div class="field" style="margin:.8rem 0 .5rem"><label class="sr-only" for="tr-' + esc(t.id) + '">Your reply</label><textarea id="tr-' + esc(t.id) + '" maxlength="1000" placeholder="Reply" style="min-height:4.5rem"></textarea></div><button class="btn btn-sm" type="button" data-treply="' + esc(t.id) + '">Send reply</button>') + '</article>';
        }).join('') : '<p class="muted">You have no support tickets.</p>';
        tBox.onclick = function (e) {
          var b = e.target.closest('[data-treply]'); if (!b) return;
          var id = b.getAttribute('data-treply'), t = ts.filter(function (x) { return x.id === id; })[0], v = $('#tr-' + id).value.trim();
          if (v.length < 2) return toast('Write your reply first.');
          b.disabled = true;
          Store.replyTicketAsCustomer(id, (t.replies || []).concat([{ by: u.name || u.email, role: 'customer', text: v.slice(0, 1000), at: Date.now() }])).then(loadTickets).catch(function (err) { toast(err.message); b.disabled = false; });
        };
      }).catch(function () { tBox.innerHTML = '<div class="empty">We could not load your tickets. Please reload.</div>'; });
    }
    if (tBox) {
      loadTickets();
      tForm.addEventListener('submit', function (e) {
        e.preventDefault(); var m = $('#t-msg'), subj = $('#t-subject').value.trim(), body = $('#t-body').value.trim();
        if (subj.length < 3) return say(m, 'Give your question a short title.');
        if (body.length < 10) return say(m, 'Tell us a little more (at least 10 characters).');
        var btn = tForm.querySelector('button'); btn.disabled = true;
        Store.createTicket({ subject: subj.slice(0, 100), message: body.slice(0, 1000) }).then(function () { tForm.reset(); say(m, 'Sent. We will reply here.', 'ok'); loadTickets(); }).catch(function (err) { say(m, err.message); }).then(function () { btn.disabled = false; });
      });
    }
    var box = $('#orders');
    Store.listMyOrders().then(function (os) {
      box.innerHTML = os.length ? os.map(function (o) {
        return '<article class="row-card"><header><h3>Order ' + esc(o.ref) + '</h3><span class="badge ' + esc(String(o.status).replace(/\s/g, '-')) + '">' + esc(o.status) + '</span></header>' +
          '<div class="meta">' + esc(fmtDate(o.createdAt)) + '</div><ul>' + (o.items || []).map(function (i) { return '<li>' + esc(i.qty) + ' &times; ' + esc(i.name) + '</li>'; }).join('') + '</ul>' +
          '<strong>' + (o.total > 0 ? money(o.total) : 'Quote to follow') + '</strong></article>';
      }).join('') : '<div class="empty"><h3>No orders yet</h3><p>When you place an order it will appear here.</p><a class="btn" href="shop.html">Browse the shop</a></div>';
    }).catch(function () { box.innerHTML = '<div class="empty">We could not load your orders. Please reload.</div>'; });
  };

  pages.labs = function () {
    var box = $('#labs-grid'); if (!box) return;
    Store.listPublicLabs().then(function (ls) {
      var order = { released: 0, testing: 1, building: 2, planned: 3, paused: 4 };
      ls.sort(function (a, b) { return (order[a.stage] == null ? 9 : order[a.stage]) - (order[b.stage] == null ? 9 : order[b.stage]); });
      box.innerHTML = ls.length ? ls.map(function (l) {
        var road = l.roadmap || [], done = road.filter(function (r) { return r.done; }).length, p = road.length ? Math.round(done * 100 / road.length) : 0;
        var rel = (l.releases || []).slice(0, 2).map(function (r) { return '<li><strong>' + esc(r.v) + '</strong>' + (r.date ? ' <span class="meta">' + esc(r.date) + '</span>' : '') + (r.notes ? '<br>' + esc(r.notes) : '') + '</li>'; }).join('');
        return '<article class="card lab"><div class="card-body"><span class="cat">' + esc(l.type || 'Product') + '</span><h3>' + esc(l.name) + ' <span class="badge ' + esc(l.stage) + '">' + esc(l.stage) + '</span></h3><p style="-webkit-line-clamp:unset;display:block">' + esc(l.summary) + '</p>' +
          (road.length ? '<div class="bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '" aria-label="Roadmap progress"><div class="bar-fill" style="width:' + p + '%"></div></div><div class="meta">Roadmap ' + p + '% done</div>' : '') +
          (l.team ? '<div class="meta">Team: ' + esc(l.team) + '</div>' : '') + (l.version ? '<div class="meta">Version ' + esc(l.version) + '</div>' : '') +
          (rel ? '<ul class="plain rel">' + rel + '</ul>' : '') +
          (/^https:\/\/[^\s"'<>]+$/i.test(l.url || '') ? '<div class="card-foot"><a class="btn btn-sm" href="' + esc(l.url) + '" target="_blank" rel="noopener">Open ' + esc(l.name) + '</a></div>' : '') + '</div></article>';
      }).join('') : '<div class="empty" style="grid-column:1/-1"><h3>Labs is warming up</h3><p>Our own products and experiments will show up here.</p></div>';
    }).catch(function () { box.innerHTML = '<div class="empty" style="grid-column:1/-1">We could not load Labs. Please reload.</div>'; });
  };

  pages.contact = function () {
    var form = $('#contact-form'), msg = $('#msg'), cap = mountCaptcha($('#captcha'));
    if (Store.user) { $('#c-name').value = Store.user.name || ''; $('#c-email').value = Store.user.email || ''; }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); say(msg, '');
      var d = { name: $('#c-name').value.trim(), email: $('#c-email').value.trim(), phone: $('#c-phone').value.trim(), topic: $('#c-topic').value, message: $('#c-message').value.trim() };
      if (d.name.length < 2) return say(msg, 'Enter your name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return say(msg, 'Enter a valid email address.');
      if (d.phone && !/^[+\d][\d\s\-]{6,18}$/.test(d.phone)) return say(msg, 'That phone number does not look right.');
      if (d.message.length < 10) return say(msg, 'Tell us a little more (at least 10 characters).');
      if (!needCaptcha(cap, msg)) return;
      d.name = d.name.slice(0, 80); d.email = d.email.slice(0, 120); d.message = d.message.slice(0, 1500);
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Sending...';
      Store.createInquiry(d).then(function () {
        form.reset(); cap.reset(); say(msg, 'Message sent. We will reply on the email or phone you gave us.', 'ok');
      }).catch(function (err) { say(msg, err.message); }).then(function () { btn.disabled = false; btn.textContent = 'Send message'; });
    });
  };

  /* ---------- boot ---------- */
  window.KT = { $: $, $$: $$, esc: esc, money: money, priceHTML: priceHTML, safeImg: safeImg, icon: icon, fmtDate: fmtDate, waLink: waLink, toast: toast, say: say, pages: pages };
  // Deferred scripts run while readyState is "interactive"; DOMContentLoaded fires only after ALL of them have run.
  var domReady = new Promise(function (r) { if (document.readyState === 'complete') r(); else document.addEventListener('DOMContentLoaded', r); });
  Promise.all([Store.ready, domReady]).then(function () {
    initHeader();
    applyContent();
    var fn = pages[document.body.getAttribute('data-page')];
    if (fn) fn();
  });
})();
