/*
  Kinton Briefing - when you sign in, tells you what happened while you were away.
  Free and built in: it counts and summarises your own data, so it never invents anything.
  Staff see orders, messages, tickets and signups. Customers see updates to their orders and tickets.
  "Last seen" is kept in this browser, per account.
*/
(function () {
  'use strict';
  var S = window.Store; if (!S) return;
  var MIN_AWAY = 2 * 60 * 1000; // only brief after 2+ minutes away
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ms(x) { return typeof x === 'number' ? x : (x && x.toMillis ? x.toMillis() : (x && x.seconds ? x.seconds * 1000 : Date.parse(x) || 0)); }
  function after(list, since, f) { return (list || []).filter(function (x) { return ms(x[f || 'createdAt']) > since; }); }
  function safe(p) { return Promise.resolve().then(function () { return p(); }).catch(function () { return []; }); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function money(n) { var c = (window.KINTON_CONFIG || {}).currencySymbol || '$'; return c + (Math.round(n * 100) / 100); }
  function away(ms_) {
    var m = Math.round(ms_ / 60000); if (m < 60) return plural(m, 'minute', 'minutes');
    var h = Math.round(m / 60); if (h < 48) return plural(h, 'hour', 'hours');
    return plural(Math.round(h / 24), 'day', 'days');
  }
  function when(t) { try { return new Date(t).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }); } catch (e) { return ''; } }

  function staffReport(since) {
    return Promise.all([
      safe(function () { return S.can('orders') ? S.listAllOrders() : []; }),
      safe(function () { return S.listInquiries(); }),
      safe(function () { return S.can('tickets') ? S.col('tickets').list() : []; }),
      safe(function () { return S.can('users') ? S.listUsers() : []; })
    ]).then(function (r) {
      var orders = after(r[0], since), inq = after(r[1], since), tix = after(r[2], since), users = after(r[3], since);
      var open = (r[0] || []).filter(function (o) { return o.status === 'new'; }).length;
      var total = orders.reduce(function (a, o) { return a + (+o.total || 0); }, 0);
      var items = [];
      if (orders.length) items.push({ n: orders.length, t: (orders.length === 1 ? 'new order' : 'new orders') + (total ? ', worth ' + money(total) : ''), href: 'admin.html#orders' });
      if (inq.length) items.push({ n: inq.length, t: inq.length === 1 ? 'new message from the contact form' : 'new messages from the contact form', href: 'admin.html#inquiries' });
      if (tix.length) items.push({ n: tix.length, t: tix.length === 1 ? 'support ticket opened or updated' : 'support tickets opened or updated', href: 'admin.html#tickets' });
      if (users.length) items.push({ n: users.length, t: users.length === 1 ? 'new account created' : 'new accounts created', href: 'admin.html#users' });
      var next = open ? 'Start with the ' + plural(open, 'order', 'orders') + ' still marked new.' : (tix.length ? 'Reply to the new support tickets first.' : '');
      return { items: items, next: next };
    });
  }

  function customerReport(since) {
    return Promise.all([safe(function () { return S.listMyOrders(); }), safe(function () { return S.listMyTickets(); })]).then(function (r) {
      var items = [];
      after(r[0], since, 'updatedAt').forEach(function (o) {
        if (ms(o.updatedAt) <= ms(o.createdAt) + 1000) return; // unchanged since placed
        items.push({ n: '', t: 'Order ' + (o.ref || '') + ' is now: ' + String(o.status || 'updated').replace(/_/g, ' '), href: 'account.html' });
      });
      after(r[1], since, 'updatedAt').forEach(function (t) { items.push({ n: '', t: 'There is an update on your ticket: ' + (t.subject || 'support request'), href: 'account.html' }); });
      var unpaid = (r[0] || []).filter(function (o) { return o.total > 0 && !o.paid; }).length;
      return { items: items, next: unpaid ? 'You have ' + plural(unpaid, 'invoice', 'invoices') + ' waiting to be paid.' : '' };
    });
  }

  function speakText(txt) {
    try { if (!('speechSynthesis' in window)) return; speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(txt); u.lang = navigator.language || 'en-GB'; speechSynthesis.speak(u); } catch (e) {}
  }

  function show(user, since, rep, first) {
    var name = (user.name || '').split(' ')[0] || 'there';
    var lines = rep.items.map(function (i) { return (i.n ? i.n + ' ' : '') + i.t; });
    var spoken = first ? 'Welcome, ' + name + '. This is your dashboard.' :
      'Welcome back, ' + name + '. You were away for ' + away(Date.now() - since) + '. ' + (lines.length ? 'While you were gone: ' + lines.join('. ') + '. ' : 'Nothing new while you were gone. ') + (rep.next || '');
    var wrap = document.createElement('div'); wrap.className = 'kb-wrap';
    var list = rep.items.map(function (i) {
      return '<li>' + (i.n !== '' ? '<strong>' + esc(i.n) + '</strong>' : '<strong>&bull;</strong>') + '<span><a href="' + esc(i.href) + '">' + esc(i.t) + '</a></span></li>';
    }).join('');
    wrap.innerHTML = '<div class="kb" role="dialog" aria-modal="true" aria-label="Your briefing">' +
      '<span class="kb-badge">Kinton briefing</span><h2>' + (first ? 'Welcome, ' : 'Welcome back, ') + esc(name) + '</h2>' +
      (first ? '<p class="kb-sub">Next time you sign in, you will see what happened while you were away.</p>' :
        '<p class="kb-sub">You were last here ' + esc(when(since)) + ' (' + esc(away(Date.now() - since)) + ' ago).</p>') +
      (first ? '' : (list ? '<ul>' + list + '</ul>' : '<ul><li><strong>0</strong><span>Nothing new while you were away.</span></li></ul>')) +
      (rep.next && !first ? '<p class="kb-next">' + esc(rep.next) + '</p>' : '') +
      '<div class="kb-act"><button class="btn" type="button" id="kb-ok">Got it</button><button class="btn btn-line" type="button" id="kb-read">Read it to me</button></div></div>';
    document.body.appendChild(wrap);
    function done() { try { speechSynthesis.cancel(); } catch (e) {} wrap.remove(); document.removeEventListener('keydown', esc_); }
    function esc_(e) { if (e.key === 'Escape') done(); }
    document.addEventListener('keydown', esc_);
    wrap.querySelector('#kb-ok').addEventListener('click', done);
    wrap.querySelector('#kb-read').addEventListener('click', function () { speakText(spoken); });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) done(); });
    wrap.querySelector('#kb-ok').focus();
    if (ls('kg_voice') === '1' || ls('kg_hf') === '1') speakText(spoken);
    if (window.KintonGuide && !first && ls('kg_hf') === '1') window.KintonGuide.say(spoken);
  }

  function run(user) {
    if (!user || ss('kt_briefed_' + user.uid)) return;
    ss('kt_briefed_' + user.uid, '1');
    var key = 'kt_lastseen_' + user.uid, since = +ls(key) || 0, now = Date.now();
    ls(key, String(now));
    if (!since) return show(user, now, { items: [], next: '' }, true);
    if (now - since < MIN_AWAY) return;
    (user.isAdmin ? staffReport(since) : customerReport(since)).then(function (rep) { show(user, since, rep, false); });
  }

  // Keep "last seen" fresh while the person is active, so the report starts from when they actually left.
  function touch() { var u = S.user; if (u) ls('kt_lastseen_' + u.uid, String(Date.now())); }
  setInterval(touch, 30000);
  window.addEventListener('pagehide', touch);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') touch(); });

  S.ready.then(function () { run(S.user); S.onChange(function (u) { if (u) run(u); }); });
})();
