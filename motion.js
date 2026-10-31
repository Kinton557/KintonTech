/* Kinton Technologies - modern site behaviour: scroll progress, reveal-on-scroll, sticky header shadow,
   dark mode, back-to-top, floating WhatsApp button, FAQ accordion, privacy notice, install-as-app, offline support.
   Colours live in style.css / modern.css. Respects "reduce motion". */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var cfg = window.KINTON_CONFIG || {};

  /* ---- theme: set as early as possible so the page never flashes ---- */
  var saved = get('kt_theme');
  var theme = saved || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');

  function ready(fn) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }

  ready(function () {
    if (!reduce) root.classList.add('kt-motion');
    var body = document.body, page = body.getAttribute('data-page') || '';

    /* ---- scroll progress bar + header shadow + back to top ---- */
    var bar = document.createElement('div'); bar.className = 'kt-progress'; bar.setAttribute('aria-hidden', 'true'); body.appendChild(bar);
    var header = document.querySelector('.site-header');
    var top = document.createElement('button'); top.type = 'button'; top.className = 'to-top'; top.setAttribute('aria-label', 'Back to top'); top.hidden = true;
    top.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
    body.appendChild(top);
    var tick = false;
    function onScroll() {
      if (tick) return; tick = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || 0, h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
        if (header) header.classList.toggle('scrolled', y > 8);
        top.hidden = y < 700;
        tick = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    /* ---- reveal on scroll ---- */
    if (!reduce && 'IntersectionObserver' in window) {
      var targets = document.querySelectorAll('.section-head, .svc, .card, .steps li, .person, .faq-item, .band-inner, .panel, .row-card, .stat, .two > div, .trust-item');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target; el.classList.add('in'); io.unobserve(el);
          setTimeout(function () { el.classList.add('rv-done'); }, 900);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      Array.prototype.forEach.call(targets, function (el, i) {
        if (page === 'admin' || el.closest('#admin-root')) return;
        el.classList.add('rv'); el.style.setProperty('--d', Math.min(i % 6, 5) * 70 + 'ms'); io.observe(el);
      });
      // cards that appear later (shop products load from the database)
      new MutationObserver(function (muts) {
        muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.matches && n.matches('.card') && !n.classList.contains('rv')) { n.classList.add('rv'); io.observe(n); }
        }); });
      }).observe(document.getElementById('main') || body, { childList: true, subtree: true });
    }

    /* ---- theme toggle (sun/moon) ---- */
    var actions = document.querySelector('.site-header .actions');
    if (actions) {
      var t = document.createElement('button'); t.type = 'button'; t.className = 'icon-btn theme-btn';
      var sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
      var moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
      var paint = function () {
        var dark = root.getAttribute('data-theme') === 'dark';
        t.innerHTML = dark ? sun : moon; t.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        if (meta) meta.setAttribute('content', dark ? '#0b0b0b' : '#151515');
        Array.prototype.forEach.call(document.querySelectorAll('.site-header .brand img'), function (im) { var s = im.getAttribute('src') || ''; im.setAttribute('src', dark ? s.replace(/logo-mark(-light)?\.png/, 'logo-mark-light.png') : s.replace('logo-mark-light.png', 'logo-mark.png')); });
      };
      t.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next); set('kt_theme', next); paint();
      });
      actions.insertBefore(t, actions.firstChild); paint();
    }

    /* ---- FAQ accordion (animated open/close) ---- */
    Array.prototype.forEach.call(document.querySelectorAll('.faq-item'), function (d) {
      var s = d.querySelector('summary'); if (!s) return;
      s.addEventListener('click', function (e) {
        if (reduce) return;
        e.preventDefault();
        var a = d.querySelector('.faq-a');
        if (d.open) { a.style.maxHeight = a.scrollHeight + 'px'; requestAnimationFrame(function () { a.style.maxHeight = '0px'; }); setTimeout(function () { d.open = false; }, 260); }
        else { d.open = true; a.style.maxHeight = '0px'; requestAnimationFrame(function () { a.style.maxHeight = a.scrollHeight + 'px'; }); setTimeout(function () { a.style.maxHeight = 'none'; }, 280); }
      });
    });

    /* ---- anonymous-counting notice ---- */
    if (page !== 'admin' && !get('kt_consent')) {
      var n = document.createElement('div'); n.className = 'consent no-print'; n.setAttribute('role', 'region'); n.setAttribute('aria-label', 'Privacy notice');
      n.innerHTML = '<p>We count visits anonymously to improve the site. No names, emails or cookies. <a href="privacy.html">Privacy</a></p><div><button type="button" class="btn btn-sm" data-c="yes">OK</button><button type="button" class="btn btn-line btn-sm" data-c="no">No thanks</button></div>';
      n.addEventListener('click', function (e) {
        var b = e.target.closest('[data-c]'); if (!b) return;
        set('kt_consent', b.dataset.c); n.classList.add('out'); setTimeout(function () { n.remove(); }, 300);
      });
      body.appendChild(n);
    }
  });

  /* ---- installable app + offline fallback ---- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    ready(function () {
      if (get('kt_install_dismissed') || document.querySelector('.install-btn')) return;
      var foot = document.querySelector('.foot-grid > div:last-child ul'); if (!foot) return;
      var li = document.createElement('li'); li.innerHTML = '<button type="button" class="link-btn install-btn">Install the app</button>';
      li.firstChild.addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; li.remove(); }); });
      foot.appendChild(li);
    });
  });
})();
