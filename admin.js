/* Kinton Technologies - admin shell, Overview and Staff & users.
   Everything here only decides what to SHOW. Real protection is in firestore.rules. */
(function () {
  'use strict';
  var KT = window.KT, E = KT.esc, say = KT.say;
  KT.usd = function (n) { n = Math.round((Number(n) || 0) * 100) / 100; return '$' + n.toFixed(2).replace(/\.00$/, ''); };
  KT.modules = [];
  KT.registerAdmin = function (m) { KT.modules.push(m); };
  KT.dayStr = function (ms) { return ms ? new Date(ms).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : ''; };
  KT.badge = function (t, cls) { return '<span class="badge ' + E(cls || String(t).replace(/\s/g, '-')) + '">' + E(t) + '</span>'; };
  var $ = KT.$;

  function safe(perm, fn) { return (perm === true || Store.can(perm)) ? Promise.resolve().then(fn).catch(function () { return null; }) : Promise.resolve(null); }

  /* ---------------- Overview ---------------- */
  KT.registerAdmin({ key: 'overview', title: 'Overview', order: 0, perm: true, render: function (panel, ctx) {
    Promise.all([
      safe('users', function () { return Store.listUsers(); }),
      safe('projects', function () { return Store.col('projects').list(); }),
      safe('orders', function () { return Store.listAllOrders(); }),
      safe('payments', function () { return Store.col('payments').list(); }),
      safe('tickets', function () { return Store.col('tickets').list(); }),
      safe('tickets', function () { return Store.listInquiries(); }),
      safe('users', function () { return Store.listAdminRequests(); }),
      safe(true, function () { return Store.col('activity').list(); }),
      Store.ping().catch(function () { return null; })
    ]).then(function (r) {
      var users = r[0], projects = r[1], orders = r[2], pays = r[3], tickets = r[4], msgs = r[5], reqs = r[6], acts = r[7], ping = r[8];
      var dash = '&mdash;';
      var active = projects ? projects.filter(function (p) { return ['approved', 'in progress', 'review'].indexOf(p.status) >= 0; }).length : null;
      var newOrders = orders ? orders.filter(function (o) { return o.status === 'new'; }).length : null;
      var revenue = pays ? pays.reduce(function (s, p) { return s + (p.type === 'refund' ? -1 : 1) * (Number(p.amount) || 0); }, 0) : null;
      var openT = tickets ? tickets.filter(function (t) { return t.status !== 'resolved'; }).length : null;
      var quotes = projects ? projects.filter(function (p) { return p.status === 'quote'; }).length : null;
      function stat(label, v, sub) { return '<div class="stat"><div class="stat-n">' + (v == null ? dash : v) + '</div><div class="stat-l">' + E(label) + '</div>' + (sub ? '<div class="stat-s">' + sub + '</div>' : '') + '</div>'; }
      var pending = [];
      if (newOrders) pending.push(newOrders + ' new order' + (newOrders > 1 ? 's' : ''));
      if (openT) pending.push(openT + ' open ticket' + (openT > 1 ? 's' : ''));
      if (quotes) pending.push(quotes + ' quote' + (quotes > 1 ? 's' : '') + ' to send');
      if (reqs && reqs.length) pending.push(reqs.length + ' staff access request' + (reqs.length > 1 ? 's' : ''));
      var unreadMsgs = msgs ? msgs.length : 0; if (unreadMsgs) pending.push(unreadMsgs + ' contact message' + (unreadMsgs > 1 ? 's' : ''));
      var testKey = /^6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI$/.test((window.KINTON_CONFIG || {}).recaptchaSiteKey || '');
      var health = [
        [!Store.demo, Store.demo ? 'Demo mode: data is only stored in this browser' : 'Connected to Firebase'],
        [ping != null, ping != null ? 'Database responded in ' + ping + ' ms' : 'Database did not respond'],
        [location.protocol === 'https:' || /^(localhost|127\.)/.test(location.hostname), location.protocol === 'https:' ? 'Site is using HTTPS' : 'Not using HTTPS (fine on localhost only)'],
        [!testKey, testKey ? 'reCAPTCHA is using the Google TEST key. Add your own key in config.js' : 'reCAPTCHA key is set'],
        [!!(window.KINTON_CONFIG || {}).appCheckSiteKey, (window.KINTON_CONFIG || {}).appCheckSiteKey ? 'Firebase App Check is on' : 'Firebase App Check is off (recommended)'],
        [navigator.onLine, navigator.onLine ? 'Your device is online' : 'Your device is offline']
      ];
      panel.innerHTML = '<div class="stats">' + stat('Customers', users ? users.length : null) + stat('Active projects', active, projects ? projects.length + ' in total' : '') +
        stat('Orders', orders ? orders.length : null, newOrders != null ? newOrders + ' new' : '') + stat('Revenue received', revenue == null ? null : KT.usd(revenue), 'Payments minus refunds') + '</div>' +
        '<div class="two" style="margin-top:1.5rem"><section class="panel"><h2 style="font-size:1.15rem">Needs attention</h2>' +
        (pending.length ? '<ul class="plain">' + pending.map(function (x) { return '<li class="tick">' + E(x) + '</li>'; }).join('') + '</ul>' : '<p class="muted">Nothing is waiting. Nice.</p>') +
        '</section><section class="panel"><h2 style="font-size:1.15rem">System health</h2><ul class="plain health">' + health.map(function (h) {
          return '<li><span class="dot ' + (h[0] ? 'good' : 'warn') + '" aria-hidden="true"></span><span class="sr-only">' + (h[0] ? 'OK: ' : 'Check: ') + '</span>' + E(h[1]) + '</li>'; }).join('') + '</ul></section></div>' +
        '<section class="panel" style="margin-top:1.5rem"><h2 style="font-size:1.15rem">Recent activity</h2>' +
        (acts && acts.length ? '<ul class="plain feed">' + acts.slice(0, 15).map(function (a) { return '<li><span>' + E(a.text) + '</span><span class="meta">' + E(a.by) + ' &middot; ' + E(KT.fmtDate(a.createdAt)) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">Actions you and your team take in this dashboard will be listed here.</p>') + '</section>';
    }).catch(ctx.fail);
  } });

  /* ---------------- Staff & users ---------------- */
  var ROLE_LABEL = { owner: 'Main admin', admin: 'Admin', staff: 'Staff' };
  KT.registerAdmin({ key: 'users', title: 'Staff & users', order: 99, perm: 'users', render: function (panel, ctx) {
    var me = Store.user;
    Promise.all([Store.listStaff(), Store.listUsers(), Store.listAdminRequests()]).then(function (r) {
      var staff = r[0], customers = r[1], reqs = r[2];
      ctx.count('users', reqs.length);
      function canManage(t) { return t.role !== 'owner' && t.uid !== me.uid && (me.role === 'owner' || t.role === 'staff'); }
      function permBoxes(sel, prefix) {
        return '<div class="perm-grid">' + Store.MODULES.map(function (m) { return '<label class="check"><input type="checkbox" name="' + prefix + '" value="' + m[0] + '"' + (sel.indexOf(m[0]) >= 0 ? ' checked' : '') + '> ' + E(m[1]) + '</label>'; }).join('') + '</div>';
      }
      var roleOpts = '<option value="staff">Staff (only the sections you tick)</option>' + (me.role === 'owner' ? '<option value="admin">Admin (everything except the main admin)</option>' : '');
      panel.innerHTML = '<h2 style="font-size:1.3rem">Staff accounts</h2><div class="list" id="staff-list">' + staff.map(function (s) {
        var prot = s.role === 'owner';
        return '<article class="row-card" data-uid="' + E(s.uid) + '"><header><h3>' + E(s.name || s.email) + (s.uid === me.uid ? ' (you)' : '') + '</h3><span>' + KT.badge(ROLE_LABEL[s.role] || s.role, s.role === 'owner' ? 'new' : '') + (s.suspended ? ' ' + KT.badge('Suspended', 'cancelled') : '') + '</span></header>' +
          '<div class="meta">' + E(s.email) + (s.role === 'staff' ? ' &middot; Access: ' + (s.perms.length ? s.perms.map(function (p) { var m = Store.MODULES.filter(function (x) { return x[0] === p; })[0]; return E(m ? m[1] : p); }).join(', ') : 'none yet') : '') + '</div>' +
          (prot ? '<p class="meta" style="margin:.5rem 0 0">Protected. This account cannot be edited, suspended or removed from the dashboard.</p>' :
            canManage(s) ? '<div class="row-actions"><button class="btn btn-line btn-sm" data-edit="' + E(s.uid) + '" type="button">Edit access</button><button class="btn btn-line btn-sm" data-sus="' + E(s.uid) + '" data-v="' + (s.suspended ? '0' : '1') + '" type="button">' + (s.suspended ? 'Reactivate' : 'Suspend') + '</button><button class="link-btn danger" data-rm="' + E(s.uid) + '" type="button">Remove staff access</button></div>' : '') +
          '<div class="edit-box" hidden></div></article>';
      }).join('') + '</div>' +
      '<form class="panel" id="staff-form" style="margin:1.5rem 0" novalidate><h2 style="font-size:1.15rem">Add a staff account</h2><div class="form-grid">' +
        '<div class="field"><label for="s-name">Full name</label><input id="s-name" type="text" maxlength="80" required></div><div class="field"><label for="s-email">Email</label><input id="s-email" type="email" maxlength="120" required></div>' +
        '<div class="field full"><label for="s-role">Role</label><select id="s-role">' + roleOpts + '</select></div>' +
        '<div class="field full"><span class="label">Sections this person can use</span>' + permBoxes(['orders', 'tickets'], 's-perm') + '<div class="hint">Admins can use every section. Only the main admin can create admins.</div></div></div>' +
        '<button class="btn" type="submit">Create account</button><div id="s-msg" class="msg" role="alert"></div></form>' +
      '<h2 style="font-size:1.3rem;margin-top:2rem">Waiting for approval</h2>' + (reqs.length ? '<div class="list">' + reqs.map(function (a) {
          return '<article class="row-card"><h3>' + E(a.name) + '</h3><div class="meta">' + E(a.email) + '</div><div class="row-actions"><button class="btn btn-sm" data-ok="' + E(a.uid) + '" type="button">Approve as staff</button><button class="link-btn danger" data-no="' + E(a.uid) + '" type="button">Decline</button></div></article>'; }).join('') + '</div>' : '<p class="muted">No pending requests.</p>') +
      '<h2 style="font-size:1.3rem;margin-top:2rem">Customers (' + customers.length + ')</h2><div class="field" style="max-width:22rem"><label class="sr-only" for="c-find">Search customers</label><input id="c-find" type="search" placeholder="Search customers"></div><div class="list" id="cust-list"></div>';

      function paintCust() {
        var q = $('#c-find').value.trim().toLowerCase();
        var l = customers.filter(function (c) { return !q || (c.name + ' ' + c.email).toLowerCase().indexOf(q) >= 0; });
        $('#cust-list').innerHTML = l.length ? l.map(function (c) {
          return '<article class="row-card"><header><h3>' + E(c.name || c.email) + '</h3>' + (c.suspended ? KT.badge('Suspended', 'cancelled') : '') + '</header><div class="meta">' + E(c.email) + ' &middot; joined ' + E(KT.dayStr(c.createdAt)) + '</div>' +
            '<div class="row-actions"><button class="btn btn-line btn-sm" data-csus="' + E(c.uid) + '" data-v="' + (c.suspended ? '0' : '1') + '" type="button">' + (c.suspended ? 'Reactivate' : 'Suspend') + '</button></div></article>'; }).join('') : '<div class="empty">No customers found.</div>';
      }
      paintCust(); $('#c-find').addEventListener('input', paintCust);

      panel.onclick = function (e) {
        var t = e.target.closest('button'); if (!t) return;
        function done(msg, log) { return function () { KT.toast(msg); Store.log(log); ctx.reload(); }; }
        function bad(err) { KT.toast(err.message); }
        if (t.dataset.ok) Store.approveAdmin(t.dataset.ok).then(done('Approved as staff. Set their access under Edit access.', 'Approved a staff access request')).catch(bad);
        else if (t.dataset.no) Store.rejectAdmin(t.dataset.no).then(done('Declined', 'Declined a staff access request')).catch(bad);
        else if (t.dataset.sus) { if (confirm((t.dataset.v === '1' ? 'Suspend' : 'Reactivate') + ' this staff account?')) Store.setSuspended('staff', t.dataset.sus, t.dataset.v === '1').then(done('Updated', (t.dataset.v === '1' ? 'Suspended' : 'Reactivated') + ' a staff account')).catch(bad); }
        else if (t.dataset.csus) { if (confirm((t.dataset.v === '1' ? 'Suspend' : 'Reactivate') + ' this customer? Suspended customers cannot sign in or place orders.')) Store.setSuspended('user', t.dataset.csus, t.dataset.v === '1').then(done('Updated', (t.dataset.v === '1' ? 'Suspended' : 'Reactivated') + ' a customer account')).catch(bad); }
        else if (t.dataset.rm) { if (confirm('Remove staff access? The person keeps a normal customer account.')) Store.removeStaff(t.dataset.rm).then(done('Staff access removed', 'Removed a staff member')).catch(bad); }
        else if (t.dataset.edit) {
          var card = t.closest('.row-card'), s = staff.filter(function (x) { return x.uid === t.dataset.edit; })[0], box = card.querySelector('.edit-box');
          if (!box.hidden) { box.hidden = true; return; }
          box.hidden = false;
          box.innerHTML = '<div class="field" style="margin-top:1rem"><label>Role</label><select class="e-role">' + roleOpts + '</select></div>' + permBoxes(s.perms, 'e-perm') + '<div class="row-actions"><button class="btn btn-sm" type="button" data-save="' + E(s.uid) + '">Save access</button></div>';
          box.querySelector('.e-role').value = s.role;
        }
        else if (t.dataset.save) {
          var b = t.closest('.edit-box'), perms = Array.prototype.map.call(b.querySelectorAll('input[name=e-perm]:checked'), function (i) { return i.value; });
          Store.updateStaff(t.dataset.save, { role: b.querySelector('.e-role').value, perms: perms }).then(done('Access saved', 'Changed a staff member\'s access')).catch(bad);
        }
      };
      $('#staff-form').addEventListener('submit', function (e) {
        e.preventDefault(); var msg = $('#s-msg'), btn = e.target.querySelector('button[type=submit]');
        var name = $('#s-name').value.trim(), email = $('#s-email').value.trim(), role = $('#s-role').value;
        var perms = Array.prototype.map.call(e.target.querySelectorAll('input[name=s-perm]:checked'), function (i) { return i.value; });
        if (name.length < 2) return say(msg, 'Enter their name.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say(msg, 'Enter a valid email address.');
        if (role === 'staff' && !perms.length) return say(msg, 'Tick at least one section for this staff member.');
        btn.disabled = true; say(msg, '');
        Store.createStaff({ name: name.slice(0, 80), email: email, role: role, perms: perms }).then(function (res) {
          Store.log('Created a ' + role + ' account for ' + name);
          panel.querySelector('#s-msg').className = 'msg ok';
          panel.querySelector('#s-msg').textContent = res.tempPassword ? 'Account created. Temporary password (shown once, demo only): ' + res.tempPassword : 'Account created. A password-setup email was sent to ' + email + '.';
          e.target.reset(); btn.disabled = false; ctx.count('users', reqs.length);
        }).catch(function (err) { say(msg, err.message); btn.disabled = false; });
      });
    }).catch(ctx.fail);
  } });

  /* ---------------- shell ---------------- */
  KT.pages.admin = function () {
    var root = $('#admin-root'), u = Store.user;
    if (!u) { root.innerHTML = '<div class="empty"><h3>Staff only</h3><p>Sign in with a staff or admin account to continue.</p><a class="btn" href="signin.html?next=admin.html">Sign in</a></div>'; return; }
    if (!u.isAdmin) {
      root.innerHTML = '<div class="empty"><h3>' + (u.adminRequested ? 'Your request is waiting' : 'This area is for staff') + '</h3><p>' + (u.adminRequested ? 'An admin needs to approve your account. You can shop as a customer in the meantime.' : 'Your account does not have staff access.') + '</p><a class="btn" href="account.html">Go to my account</a></div>';
      return;
    }
    var mods = KT.modules.filter(function (m) { return m.perm === true || Store.can(m.perm); }).sort(function (a, b) { return a.order - b.order; });
    root.innerHTML = '<div class="section-head no-print" style="margin-bottom:0"><div><h1 style="font-size:clamp(1.8rem,4vw,2.6rem);margin:0">Dashboard</h1><p class="muted" style="margin:.3rem 0 0">' + E(u.name || u.email) + ' &middot; ' + E(ROLE_LABEL[u.role] || u.role) + '</p></div><button type="button" class="btn btn-line btn-sm" id="admin-out">Sign out</button></div>' +
      '<div class="tabs no-print" role="tablist" aria-label="Dashboard sections">' + mods.map(function (m) { return '<button class="tab" role="tab" data-tab="' + m.key + '" aria-selected="false" aria-controls="panel">' + E(m.title) + '<span class="n" id="n-' + m.key + '"></span></button>'; }).join('') + '</div><div id="panel" role="tabpanel" tabindex="-1"></div>';
    $('#admin-out').addEventListener('click', function () { Store.signOut().then(function () { location.href = 'index.html'; }); });
    var panel = $('#panel'), current = null;
    var ctx = {
      fail: function (err) { panel.innerHTML = '<div class="msg error">' + E((err && err.message) || 'Something went wrong.') + '</div>'; },
      count: function (k, n) { var el = $('#n-' + k); if (el) el.textContent = n ? ' (' + n + ')' : ''; },
      reload: function () { show(current, true); },
      go: function (k, arg) { show(k, false, arg); },
      panel: panel
    };
    function show(key, keepScroll, arg) {
      var m = mods.filter(function (x) { return x.key === key; })[0] || mods[0]; current = m.key; ctx.arg = arg;
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === m.key)); });
      panel.onclick = null; panel.onchange = null; panel.innerHTML = '<p class="muted">Loading...</p>';
      if (history.replaceState) history.replaceState(null, '', '#' + m.key);
      try { m.render(panel, ctx); } catch (err) { console.error(err); ctx.fail(err); }
      if (!keepScroll) window.scrollTo(0, 0);
    }
    root.querySelector('.tabs').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) show(b.dataset.tab); });
    show((location.hash || '').slice(1) || 'overview');
    window.addEventListener('hashchange', function () { var k = (location.hash || '').slice(1); if (k && k !== current) show(k); });
    // fill tab count badges in the background
    if (Store.can('orders')) Store.listAllOrders().then(function (os) { ctx.count('orders', os.filter(function (o) { return o.status === 'new'; }).length); }).catch(function () {});
    if (Store.can('tickets')) Store.col('tickets').list().then(function (ts) { ctx.count('tickets', ts.filter(function (t) { return t.status !== 'resolved'; }).length); }).catch(function () {});
    if (Store.can('users')) Store.listAdminRequests().then(function (rs) { ctx.count('users', rs.length); }).catch(function () {});
  };
})();
