/* Kinton Technologies - app experience.
   When the site is opened as an installed app (or with ?app=1 to preview), it gets: a splash screen,
   a first-launch walkthrough ("Get started"), a bottom tab bar and app-style spacing.
   In a normal browser it only offers the install button / sheet. */
(function () {
  'use strict';
  var root = document.documentElement;
  function get(s, k) { try { return s.getItem(k); } catch (e) { return null; } }
  function set(s, k, v) { try { s.setItem(k, v); } catch (e) {} }
  var qs = new URLSearchParams(location.search);
  if (qs.get('app') === '1') set(localStorage, 'kt_app_preview', '1');
  if (qs.get('app') === '0') { try { localStorage.removeItem('kt_app_preview'); } catch (e) {} }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var isApp = standalone || get(localStorage, 'kt_app_preview') === '1';
  if (isApp) root.classList.add('is-app');
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;

  /* ---- install prompt (Android / desktop Chrome) ---- */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; document.dispatchEvent(new Event('kt-installable')); });
  window.addEventListener('appinstalled', function () { deferred = null; set(localStorage, 'kt_installed', '1'); document.dispatchEvent(new Event('kt-installed')); });
  window.KTApp = {
    isApp: isApp, isIOS: isIOS,
    canInstall: function () { return !!deferred; },
    install: function () {
      if (!deferred) return Promise.resolve(false);
      deferred.prompt();
      return deferred.userChoice.then(function (c) { deferred = null; return c.outcome === 'accepted'; });
    },
    walkthrough: function () { showWalkthrough(true); }
  };

  function ready(fn) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  var ICON = {
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    shop: '<path d="M4 7h16l-1.2 12.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8z"/><path d="M8.5 7V6a3.5 3.5 0 0 1 7 0v1"/>',
    services: '<path d="m14.5 6.5 3 3M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/>',
    cart: '<path d="M3 4h2.2l2 11h10.2l2-8H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.500s8 2.500 8 6.500"/>'
  };
  function svg(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; }

  /* ---- splash ---- */
  function showSplash() {
    if (get(sessionStorage, 'kt_splash')) return;
    set(sessionStorage, 'kt_splash', '1');
    var s = el('<div class="splash" role="presentation"><img src="assets/logo-mark-light.png" alt="" width="96" height="96"><strong>KINTON</strong><span>TECHNOLOGIES</span><small>Building Ideas. Creating Solutions.</small></div>');
    document.body.appendChild(s);
    setTimeout(function () { s.classList.add('out'); setTimeout(function () { s.remove(); }, 450); }, 900);
  }

  /* ---- bottom tab bar ---- */
  function tabBar() {
    var page = document.body.getAttribute('data-page') || '';
    if (page === 'admin') return;
    var tabs = [['home', 'Home', 'index.html', ['home']], ['shop', 'Shop', 'shop.html', ['shop']], ['services', 'Services', 'services.html', ['services', 'labs']], ['cart', 'Cart', 'cart.html', ['cart']], ['account', 'Account', 'account.html', ['account', 'signin', 'signup', 'invoice']]];
    var nav = el('<nav class="tabbar" aria-label="App"></nav>');
    nav.innerHTML = tabs.map(function (t) {
      var on = t[3].indexOf(page) >= 0;
      return '<a href="' + t[2] + '"' + (on ? ' class="on" aria-current="page"' : '') + '>' + svg(t[0]) + '<span>' + t[1] + '</span>' + (t[0] === 'cart' ? '<b class="tab-badge" hidden></b>' : '') + '</a>';
    }).join('');
    document.body.appendChild(nav);
    // mirror the cart count
    function sync() { var c = document.querySelector('.cart-count'), b = nav.querySelector('.tab-badge'); if (!c || !b) return; var n = parseInt(c.textContent, 10) || 0; b.textContent = n; b.hidden = c.hidden || !n; }
    sync(); setInterval(sync, 1200);
  }

  /* ---- first-launch walkthrough ---- */
  var SLIDES = [
    { icon: '<path d="M4 7h16l-1.2 12.2a1 1 0 0 1-.8.8H6.2a1 1 0 0 1-.8-.8z"/><path d="M8.5 7V6a3.5 3.5 0 0 1 7 0v1"/>', t: 'Packages with clear prices', p: 'Websites, apps, branding and hosting. Add what you need to your cart and place your order. You pay nothing at that step.' },
    { icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>', t: 'Pay the way you already do', p: 'Your invoice has a Pay now button. Use EcoCash, InnBucks, Zimswitch or bank through Paynow. We never see your PIN.' },
    { icon: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.3A8.4 8.4 0 1 1 21 11.5z"/>', t: 'We are one tap away', p: 'Track your orders and invoices in your account, open a support ticket, or message us on WhatsApp any time.' }
  ];
  function showWalkthrough(force) {
    if (!force && get(localStorage, 'kt_onboarded')) return;
    var i = 0;
    var w = el('<div class="walk" role="dialog" aria-modal="true" aria-label="Welcome to Kinton"><button type="button" class="walk-skip">Skip</button><div class="walk-track"></div><div class="walk-dots"></div><div class="walk-actions"></div></div>');
    var track = w.querySelector('.walk-track'), dots = w.querySelector('.walk-dots'), acts = w.querySelector('.walk-actions');
    track.innerHTML = '<div class="walk-slide"><img src="assets/logo-mark-light.png" alt="" width="120" height="120"><h2>Welcome to Kinton</h2><p>Websites, apps and brands for Zimbabwean businesses. Here is how it works.</p></div>' +
      SLIDES.map(function (s) { return '<div class="walk-slide"><div class="walk-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + s.icon + '</svg></div><h2>' + s.t + '</h2><p>' + s.p + '</p></div>'; }).join('');
    var n = SLIDES.length + 1;
    dots.innerHTML = new Array(n + 1).join('<i></i>');
    function paint() {
      Array.prototype.forEach.call(dots.children, function (d, k) { d.className = k === i ? 'on' : ''; });
      var last = i === n - 1;
      acts.innerHTML = last ? '<a class="btn btn-block" href="signup.html" data-done>Create account</a><button type="button" class="walk-link" data-done data-shop>Browse the shop first</button>' : '<button type="button" class="btn btn-block" data-next>' + (i === 0 ? 'Get started' : 'Next') + '</button>';
      w.querySelector('.walk-skip').hidden = last;
    }
    function go(k) { i = Math.max(0, Math.min(n - 1, k)); track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); paint(); }
    function done(toShop) { set(localStorage, 'kt_onboarded', '1'); w.classList.add('out'); setTimeout(function () { w.remove(); document.body.style.overflow = ''; if (toShop) location.href = 'shop.html'; }, 300); }
    w.addEventListener('click', function (e) {
      if (e.target.closest('[data-next]')) go(i + 1);
      else if (e.target.closest('.walk-skip')) done(false);
      else if (e.target.closest('[data-done]')) { var shop = !!e.target.closest('[data-shop]'); set(localStorage, 'kt_onboarded', '1'); if (shop) { e.preventDefault(); done(true); } }
    });
    track.addEventListener('scroll', function () { var k = Math.round(track.scrollLeft / track.clientWidth); if (k !== i) { i = k; paint(); } }, { passive: true });
    document.body.appendChild(w); document.body.style.overflow = 'hidden'; paint();
  }

  /* ---- install sheet for browser visitors on phones ---- */
  function installSheet() {
    if (isApp || get(localStorage, 'kt_installed') || get(localStorage, 'kt_install_dismissed')) return;
    var views = (parseInt(get(sessionStorage, 'kt_views'), 10) || 0) + 1; set(sessionStorage, 'kt_views', String(views));
    if (views < 2 || !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return;
    if (document.body.getAttribute('data-page') === 'admin') return;
    if (!deferred && !isIOS) return;
    var s = el('<div class="sheet no-print" role="region" aria-label="Get the Kinton app"><img src="assets/icon-192.png" alt="" width="48" height="48"><div><strong>Get the Kinton app</strong><span>' + (isIOS ? 'Tap Share, then Add to Home Screen.' : 'Faster access to your orders and invoices.') + '</span></div>' + (isIOS ? '' : '<button type="button" class="btn btn-sm" data-i>Install</button>') + '<button type="button" class="sheet-x" aria-label="Not now">&times;</button></div>');
    s.addEventListener('click', function (e) {
      if (e.target.closest('[data-i]')) window.KTApp.install().then(function () { s.remove(); });
      else if (e.target.closest('.sheet-x')) { set(localStorage, 'kt_install_dismissed', '1'); s.remove(); }
    });
    setTimeout(function () { if (document.querySelector('.consent')) return; document.body.appendChild(s); }, 6000);
  }

  /* ---- footer link ---- */
  function footerLink() {
    var ul = document.querySelector('.foot-grid > div:last-child ul'); if (!ul || ul.querySelector('.app-link')) return;
    var li = document.createElement('li'); li.className = 'app-link'; li.innerHTML = '<a href="app.html">Get the app</a>'; ul.appendChild(li);
  }

  ready(function () {
    footerLink();
    if (isApp) { showSplash(); tabBar(); setTimeout(function () { showWalkthrough(false); }, 1000); }
    else installSheet();
  });
})();
