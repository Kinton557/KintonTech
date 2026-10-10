/* Kinton Technologies - admin: Client projects, KintonTech Labs, Support, Website content. */
(function () {
  'use strict';
  var KT = window.KT, E = KT.esc, say = KT.say, $ = KT.$;
  function today() { return new Date().toISOString().slice(0, 10); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function pct(v) { return Math.max(0, Math.min(100, Math.round(num(v)))); }
  function link(u, t) { return /^https:\/\/[^\s"'<>]+$/i.test(u || '') ? '<a href="' + E(u) + '" target="_blank" rel="noopener">' + E(t || u) + '</a>' : E(t || ''); }
  function bar(p) { p = pct(p); return '<div class="bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '"><div class="bar-fill" style="width:' + p + '%"></div></div>'; }
  function chips(opts, cur, attr) { return '<div class="chips" style="margin-bottom:1.2rem" role="group">' + opts.map(function (o) { return '<button type="button" class="chip" data-' + attr + '="' + E(o[0]) + '" aria-pressed="' + (cur === o[0]) + '">' + E(o[1]) + '</button>'; }).join('') + '</div>'; }

  /* ---------------- Client projects ---------------- */
  var P_STATUS = ['quote', 'approved', 'in progress', 'review', 'delivered', 'on hold'];
  var P_TYPES = ['Website', 'Mobile app', 'Software', 'Branding', 'Other'];
  function parseFiles(txt) {
    return String(txt || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 10).map(function (l) {
      var p = l.split('|'), url = (p.length > 1 ? p[1] : p[0]).trim(), name = (p.length > 1 ? p[0] : 'File').trim().slice(0, 60);
      return /^https:\/\/[^\s"'<>]+$/i.test(url) ? { name: name || 'File', url: url.slice(0, 500) } : null;
    }).filter(Boolean);
  }
  KT.registerAdmin({ key: 'projects', title: 'Client projects', order: 40, perm: 'projects', render: function (panel, ctx) {
    var list = [], filter = '';
    function load() { Store.col('projects').list().then(function (l) { list = l; paint(); }).catch(ctx.fail); }
    function paint() {
      var shown = list.filter(function (p) { return !filter || p.status === filter; });
      panel.innerHTML = '<div class="cta-row" style="margin-bottom:1.2rem"><button class="btn" type="button" id="new-proj">New project or quote</button></div><div id="proj-form"></div>' +
        chips([['', 'All (' + list.length + ')']].concat(P_STATUS.map(function (s) { return [s, s[0].toUpperCase() + s.slice(1)]; })), filter, 'f') +
        '<div class="list">' + (shown.length ? shown.map(function (p) {
          var late = p.deadline && p.deadline < today() && ['delivered', 'on hold'].indexOf(p.status) < 0;
          return '<article class="row-card"><header><h3>' + E(p.title) + '</h3><span>' + KT.badge(p.status) + (late ? ' ' + KT.badge('Past deadline', 'cancelled') : '') + '</span></header>' +
            '<div class="meta">' + E(p.client) + ' &middot; ' + E(p.type) + (p.assignee ? ' &middot; ' + E(p.assignee) : '') + (p.deadline ? ' &middot; deadline ' + E(p.deadline) : '') + (Number(p.quoteAmount) > 0 ? ' &middot; quote ' + KT.usd(p.quoteAmount) : '') + '</div>' +
            '<div style="margin:.6rem 0 .2rem">' + bar(p.progress) + '<div class="meta">' + pct(p.progress) + '% complete</div></div>' + (p.notes ? '<p class="meta" style="white-space:pre-wrap;margin:.4rem 0">' + E(p.notes) + '</p>' : '') +
            ((p.files || []).length ? '<p class="meta" style="margin:.3rem 0">Files: ' + p.files.map(function (f) { return link(f.url, f.name); }).join(' &middot; ') + '</p>' : '') +
            '<div class="row-actions"><button class="btn btn-line btn-sm" type="button" data-edit="' + E(p.id) + '">Edit</button>' + (Store.can('payments') ? '<button class="btn btn-line btn-sm" type="button" data-inv="' + E(p.id) + '">Create invoice</button>' : '') + '<button class="link-btn danger" type="button" data-del="' + E(p.id) + '">Delete</button></div></article>'; }).join('')
          : '<div class="empty"><h3>' + (list.length ? 'No projects in that stage' : 'No client projects yet') + '</h3><p>Add a quote or project to track its deadline, files and progress.</p></div>') + '</div>';
      $('#new-proj').addEventListener('click', function () { form(null); });
      panel.onclick = function (e) {
        var f = e.target.closest('[data-f]'), t = e.target.closest('button'); if (!t) return;
        if (f) { filter = f.dataset.f; return paint(); }
        var p = list.filter(function (x) { return x.id === (t.dataset.edit || t.dataset.inv || t.dataset.del); })[0];
        if (t.dataset.edit) form(p);
        else if (t.dataset.inv) ctx.go('payments', { newInvoice: { client: p.client, email: p.clientEmail || '', projectId: p.id, items: [{ desc: p.title, qty: 1, price: Number(p.quoteAmount) || 0 }] } });
        else if (t.dataset.del && confirm('Delete this project?')) Store.col('projects').remove(p.id).then(function () { Store.log('Deleted project "' + p.title + '"'); load(); }).catch(function (err) { KT.toast(err.message); });
      };
    }
    function form(p) {
      p = p || { title: '', client: '', clientEmail: '', type: 'Website', status: 'quote', progress: 0, quoteAmount: '', deadline: '', assignee: '', notes: '', files: [] };
      var box = $('#proj-form');
      box.innerHTML = '<form class="panel" id="pf" style="margin-bottom:1.5rem" novalidate><h2 style="font-size:1.3rem">' + (p.id ? 'Edit project' : 'New project') + '</h2><div class="form-grid">' +
        '<div class="field"><label for="j-title">Project title</label><input id="j-title" type="text" maxlength="100" value="' + E(p.title) + '" required></div><div class="field"><label for="j-client">Client</label><input id="j-client" type="text" maxlength="100" value="' + E(p.client) + '" required></div>' +
        '<div class="field"><label for="j-email">Client email</label><input id="j-email" type="email" maxlength="120" value="' + E(p.clientEmail) + '"></div><div class="field"><label for="j-type">Type</label><select id="j-type">' + P_TYPES.map(function (t) { return '<option' + (t === p.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="j-status">Stage</label><select id="j-status">' + P_STATUS.map(function (s) { return '<option' + (s === p.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="field"><label for="j-quote">Quotation (USD)</label><input id="j-quote" type="number" min="0" step="0.01" inputmode="decimal" value="' + E(p.quoteAmount) + '"></div>' +
        '<div class="field"><label for="j-deadline">Deadline</label><input id="j-deadline" type="date" value="' + E(p.deadline) + '"></div><div class="field"><label for="j-assignee">Assigned to</label><input id="j-assignee" type="text" maxlength="80" value="' + E(p.assignee) + '"></div>' +
        '<div class="field full"><label for="j-progress">Progress: <output id="j-pv">' + pct(p.progress) + '</output>%</label><input id="j-progress" type="range" min="0" max="100" step="5" value="' + pct(p.progress) + '" style="width:100%;accent-color:#151515"></div>' +
        '<div class="field full"><label for="j-notes">Notes</label><textarea id="j-notes" maxlength="1000" style="min-height:6rem">' + E(p.notes) + '</textarea></div>' +
        '<div class="field full"><label for="j-files">Client files (links)</label><textarea id="j-files" maxlength="1500" style="min-height:5rem" placeholder="Brief | https://drive.google.com/...">' + E((p.files || []).map(function (f) { return f.name + ' | ' + f.url; }).join('\n')) + '</textarea><div class="hint">One per line as: Name | https://link. Upload files to Google Drive or similar and paste the share link.</div></div></div>' +
        '<div class="cta-row"><button class="btn" type="submit">Save project</button><button class="btn btn-line" type="button" id="j-cancel">Cancel</button></div><div id="j-msg" class="msg" role="alert"></div></form>';
      $('#j-progress').addEventListener('input', function (e) { $('#j-pv').textContent = e.target.value; });
      $('#j-cancel').addEventListener('click', function () { box.innerHTML = ''; });
      $('#pf').addEventListener('submit', function (e) {
        e.preventDefault(); var msg = $('#j-msg'), title = $('#j-title').value.trim(), client = $('#j-client').value.trim(), email = $('#j-email').value.trim();
        if (title.length < 2 || client.length < 2) return say(msg, 'Enter a project title and the client name.');
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say(msg, 'That email does not look right.');
        var doc = { id: p.id, title: title.slice(0, 100), client: client.slice(0, 100), clientEmail: email, type: $('#j-type').value, status: $('#j-status').value, quoteAmount: Math.max(0, Math.round(num($('#j-quote').value) * 100) / 100), deadline: $('#j-deadline').value, assignee: $('#j-assignee').value.trim().slice(0, 80), progress: pct($('#j-progress').value), notes: $('#j-notes').value.trim().slice(0, 1000), files: parseFiles($('#j-files').value) };
        var btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
        Store.col('projects').save(doc).then(function () { Store.log((p.id ? 'Updated' : 'Added') + ' project "' + doc.title + '"'); KT.toast('Project saved'); load(); }).catch(function (err) { say(msg, err.message); btn.disabled = false; });
      });
      box.scrollIntoView({ block: 'start' });
    }
    load();
  } });

  /* ---------------- KintonTech Labs ---------------- */
  var L_STAGE = ['planned', 'building', 'testing', 'released', 'paused'], L_TYPE = ['Product', 'App', 'Experiment', 'Tool'];
  function roadToText(r) { return (r || []).map(function (x) { return (x.done ? '[x] ' : '[ ] ') + x.t; }).join('\n'); }
  function textToRoad(t) { return String(t || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 30).map(function (l) { var m = /^\[( |x|X)\]\s*(.*)$/.exec(l); return { t: (m ? m[2] : l).slice(0, 120), done: !!(m && m[1].toLowerCase() === 'x') }; }).filter(function (x) { return x.t; }); }
  function relToText(r) { return (r || []).map(function (x) { return [x.v, x.date, x.notes].join(' | '); }).join('\n'); }
  function textToRel(t) { return String(t || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 20).map(function (l) { var p = l.split('|').map(function (s) { return s.trim(); }); return { v: (p[0] || '').slice(0, 20), date: (p[1] || '').slice(0, 20), notes: (p[2] || '').slice(0, 200) }; }).filter(function (x) { return x.v; }); }
  KT.labsRoadPct = function (l) { var r = l.roadmap || []; return r.length ? Math.round(r.filter(function (x) { return x.done; }).length * 100 / r.length) : 0; };

  KT.registerAdmin({ key: 'labs', title: 'KintonTech Labs', order: 50, perm: 'labs', render: function (panel, ctx) {
    var list = [];
    function load() { Store.col('labs').list().then(function (l) { list = l; paint(); }).catch(ctx.fail); }
    function paint() {
      panel.innerHTML = '<p class="muted" style="margin-top:0">Your own products and experiments. Items marked public appear on the <a href="labs.html" target="_blank" rel="noopener">Labs page</a>.</p><div class="cta-row" style="margin-bottom:1.2rem"><button class="btn" type="button" id="new-lab">Add to Labs</button>' + (list.length ? '' : '<button class="btn btn-line" type="button" id="seed-labs">Load starter ideas</button>') + '</div><div id="lab-form"></div><div class="list">' +
        (list.length ? list.map(function (l) {
          return '<article class="row-card"><header><h3>' + E(l.name) + '</h3><span>' + KT.badge(l.stage) + ' ' + KT.badge(l.type || 'Product', '') + (l.public ? '' : ' ' + KT.badge('Private', 'cancelled')) + '</span></header>' +
            '<div class="meta">' + (l.version ? 'Version ' + E(l.version) + ' &middot; ' : '') + (l.team ? 'Team: ' + E(l.team) + ' &middot; ' : '') + (l.url ? link(l.url, 'Open link') : '') + '</div><p style="margin:.5rem 0">' + E(l.summary) + '</p>' +
            ((l.roadmap || []).length ? bar(KT.labsRoadPct(l)) + '<div class="meta">Roadmap: ' + KT.labsRoadPct(l) + '% done (' + l.roadmap.length + ' items)</div>' : '') +
            '<div class="row-actions"><button class="btn btn-line btn-sm" type="button" data-edit="' + E(l.id) + '">Edit</button><button class="link-btn danger" type="button" data-del="' + E(l.id) + '">Delete</button></div></article>'; }).join('')
          : '<div class="empty"><h3>Nothing in Labs yet</h3><p>Add your first product or experiment, or load the starter ideas and edit them.</p></div>') + '</div>';
      $('#new-lab').addEventListener('click', function () { form(null); });
      var sd = $('#seed-labs'); if (sd) sd.addEventListener('click', function () { sd.disabled = true; Store.seedLabs().then(function () { Store.log('Loaded starter Labs ideas'); load(); }).catch(ctx.fail); });
      panel.onclick = function (e) {
        var t = e.target.closest('button'); if (!t) return; var l = list.filter(function (x) { return x.id === (t.dataset.edit || t.dataset.del); })[0];
        if (t.dataset.edit) form(l); else if (t.dataset.del && confirm('Delete this Labs item?')) Store.col('labs').remove(l.id).then(function () { Store.log('Deleted Labs item "' + l.name + '"'); load(); }).catch(function (err) { KT.toast(err.message); });
      };
    }
    function form(l) {
      l = l || { name: '', type: 'Product', stage: 'planned', version: '', url: '', public: true, team: '', summary: '', roadmap: [], releases: [] };
      var box = $('#lab-form');
      box.innerHTML = '<form class="panel" id="lf" style="margin-bottom:1.5rem" novalidate><h2 style="font-size:1.3rem">' + (l.id ? 'Edit' : 'New') + ' Labs item</h2><div class="form-grid">' +
        '<div class="field"><label for="l-name">Name</label><input id="l-name" type="text" maxlength="80" value="' + E(l.name) + '" required></div><div class="field"><label for="l-type">Type</label><select id="l-type">' + L_TYPE.map(function (t) { return '<option' + (t === l.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="l-stage">Stage</label><select id="l-stage">' + L_STAGE.map(function (s) { return '<option' + (s === l.stage ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="field"><label for="l-ver">Current version</label><input id="l-ver" type="text" maxlength="20" value="' + E(l.version) + '" placeholder="e.g. 0.1"></div>' +
        '<div class="field"><label for="l-url">Link (https)</label><input id="l-url" type="url" maxlength="300" value="' + E(l.url) + '"></div><div class="field"><label for="l-team">Product team</label><input id="l-team" type="text" maxlength="150" value="' + E(l.team) + '" placeholder="Names, separated by commas"></div>' +
        '<div class="field full"><label class="check"><input type="checkbox" id="l-pub"' + (l.public ? ' checked' : '') + '> Show on the public Labs page</label></div>' +
        '<div class="field full"><label for="l-sum">Summary</label><textarea id="l-sum" maxlength="300" style="min-height:5rem" required>' + E(l.summary) + '</textarea></div>' +
        '<div class="field full"><label for="l-road">Roadmap</label><textarea id="l-road" maxlength="2000" style="min-height:7rem">' + E(roadToText(l.roadmap)) + '</textarea><div class="hint">One item per line. Start with [x] when it is done, or [ ] when it is not.</div></div>' +
        '<div class="field full"><label for="l-rel">Releases</label><textarea id="l-rel" maxlength="2000" style="min-height:5rem" placeholder="v0.1 | 2026-11-01 | First test version">' + E(relToText(l.releases)) + '</textarea><div class="hint">One per line: version | date | what changed.</div></div></div>' +
        '<div class="cta-row"><button class="btn" type="submit">Save</button><button class="btn btn-line" type="button" id="l-cancel">Cancel</button></div><div id="l-msg" class="msg" role="alert"></div></form>';
      $('#l-cancel').addEventListener('click', function () { box.innerHTML = ''; });
      $('#lf').addEventListener('submit', function (e) {
        e.preventDefault(); var msg = $('#l-msg'), name = $('#l-name').value.trim(), sum = $('#l-sum').value.trim(), url = $('#l-url').value.trim();
        if (name.length < 2) return say(msg, 'Give it a name.'); if (sum.length < 5) return say(msg, 'Add a short summary.');
        if (url && !/^https:\/\/[^\s"'<>]+$/i.test(url)) return say(msg, 'The link must start with https://');
        var doc = { id: l.id, name: name.slice(0, 80), type: $('#l-type').value, stage: $('#l-stage').value, version: $('#l-ver').value.trim().slice(0, 20), url: url, team: $('#l-team').value.trim().slice(0, 150), public: $('#l-pub').checked, summary: sum.slice(0, 300), roadmap: textToRoad($('#l-road').value), releases: textToRel($('#l-rel').value) };
        var btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
        Store.col('labs').save(doc).then(function () { Store.log((l.id ? 'Updated' : 'Added') + ' Labs item "' + doc.name + '"'); KT.toast('Saved'); load(); }).catch(function (err) { say(msg, err.message); btn.disabled = false; });
      });
      box.scrollIntoView({ block: 'start' });
    }
    load();
  } });

  /* ---------------- Support ---------------- */
  KT.registerAdmin({ key: 'tickets', title: 'Support', order: 60, perm: 'tickets', render: function (panel, ctx) {
    var tickets = [], msgs = [], sub = 'tickets', filter = 'active';
    function load() { Promise.all([Store.col('tickets').list(), Store.listInquiries()]).then(function (r) { tickets = r[0]; msgs = r[1]; ctx.count('tickets', tickets.filter(function (t) { return t.status !== 'resolved'; }).length); paint(); }).catch(ctx.fail); }
    function paint() {
      var head = chips([['tickets', 'Tickets (' + tickets.length + ')'], ['msgs', 'Contact messages (' + msgs.length + ')']], sub, 'sub');
      if (sub === 'msgs') {
        panel.innerHTML = head + (msgs.length ? '<div class="list">' + msgs.map(function (m) {
          return '<article class="row-card"><header><h3>' + E(m.name) + '</h3><span class="meta">' + E(KT.fmtDate(m.createdAt)) + '</span></header><div class="meta">' + E(m.topic) + ' &middot; <a href="mailto:' + E(m.email) + '">' + E(m.email) + '</a>' + (m.phone ? ' &middot; ' + E(m.phone) : '') + '</div><p style="margin:.6rem 0 0;white-space:pre-wrap">' + E(m.message) + '</p><div class="row-actions"><button type="button" class="link-btn danger" data-delmsg="' + E(m.id) + '">Delete</button></div></article>'; }).join('') + '</div>' : '<div class="empty"><h3>No messages yet</h3><p>Messages from the contact page show up here.</p></div>');
      } else {
        var shown = tickets.filter(function (t) { return filter === 'all' || (filter === 'active' ? t.status !== 'resolved' : t.status === filter); });
        panel.innerHTML = head + chips([['active', 'Active'], ['open', 'Open'], ['pending', 'Waiting on customer'], ['resolved', 'Resolved'], ['all', 'All']], filter, 'tf') +
          (shown.length ? '<div class="list">' + shown.map(function (t) {
            return '<article class="row-card" data-id="' + E(t.id) + '"><header><h3>' + E(t.subject) + '</h3>' + KT.badge(t.status, t.status === 'open' ? 'new' : (t.status === 'resolved' ? 'completed' : '')) + '</header><div class="meta">' + E(t.userName) + ' &middot; ' + E(t.userEmail) + ' &middot; ' + E(KT.fmtDate(t.createdAt)) + '</div>' +
              '<div class="thread"><div class="bubble"><strong>' + E(t.userName) + '</strong><p>' + E(t.message) + '</p></div>' + (t.replies || []).map(function (r) { return '<div class="bubble ' + (r.role === 'staff' ? 'staff' : '') + '"><strong>' + E(r.by) + (r.role === 'staff' ? ' (Kinton)' : '') + '</strong> <span class="meta">' + E(KT.fmtDate(r.at)) + '</span><p>' + E(r.text) + '</p></div>'; }).join('') + '</div>' +
              '<div class="field" style="margin:.8rem 0 .5rem"><label class="sr-only" for="r-' + E(t.id) + '">Reply</label><textarea id="r-' + E(t.id) + '" maxlength="1000" placeholder="Write a reply" style="min-height:5rem"></textarea></div>' +
              '<div class="row-actions"><button class="btn btn-sm" type="button" data-reply="' + E(t.id) + '">Send reply</button><label class="sr-only" for="s-' + E(t.id) + '">Status after reply</label><select id="s-' + E(t.id) + '"><option value="pending">Mark: waiting on customer</option><option value="resolved">Mark: resolved</option><option value="open">Keep open</option></select><button class="link-btn danger" type="button" data-delt="' + E(t.id) + '">Delete</button></div></article>'; }).join('') + '</div>'
            : '<div class="empty"><h3>No tickets here</h3><p>Customers open tickets from their account page.</p></div>');
      }
    }
    panel.onclick = function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.sub) { sub = t.dataset.sub; return paint(); }
      if (t.dataset.tf) { filter = t.dataset.tf; return paint(); }
      if (t.dataset.delmsg && confirm('Delete this message?')) return Store.deleteInquiry(t.dataset.delmsg).then(load).catch(function (err) { KT.toast(err.message); });
      if (t.dataset.delt && confirm('Delete this ticket?')) return Store.col('tickets').remove(t.dataset.delt).then(function () { Store.log('Deleted a support ticket'); load(); }).catch(function (err) { KT.toast(err.message); });
      if (t.dataset.reply) {
        var id = t.dataset.reply, tk = tickets.filter(function (x) { return x.id === id; })[0], ta = $('#r-' + id), text = ta.value.trim();
        if (text.length < 2) { KT.toast('Write a reply first.'); return; }
        var replies = (tk.replies || []).concat([{ by: Store.user.name || 'Kinton', role: 'staff', text: text.slice(0, 1000), at: Date.now() }]);
        t.disabled = true;
        Store.col('tickets').save({ id: id, replies: replies, status: $('#s-' + id).value }).then(function () { Store.log('Replied to ticket "' + tk.subject + '"'); KT.toast('Reply sent'); load(); }).catch(function (err) { KT.toast(err.message); t.disabled = false; });
      }
    };
    load();
  } });

  /* ---------------- Website content ---------------- */
  var DEFAULTS = { heroTitle: 'Websites, apps and brands for Zimbabwean businesses.', heroText: 'Kinton Technologies is a software and design studio in Kadoma. Pick a package in the shop, or tell us what you need and we will send a quote.', bandTitle: 'Have an idea?', bandText: 'Tell us about it on WhatsApp or through the contact form.', aboutText: 'Kinton Technologies is a software and design studio based in Kadoma, Zimbabwe.' };
  KT.contentDefaults = DEFAULTS;
  KT.registerAdmin({ key: 'content', title: 'Website content', order: 70, perm: 'content', render: function (panel, ctx) {
    Store.getContent().then(function (c) {
      c = c || {};
      function f(id, label, rows, max) { return '<div class="field full"><label for="c-' + id + '">' + label + '</label>' + (rows ? '<textarea id="c-' + id + '" maxlength="' + max + '" style="min-height:' + rows * 1.6 + 'rem" placeholder="' + E(DEFAULTS[id]) + '">' + E(c[id] || '') + '</textarea>' : '<input id="c-' + id + '" type="text" maxlength="' + max + '" value="' + E(c[id] || '') + '" placeholder="' + E(DEFAULTS[id]) + '">') + '</div>'; }
      panel.innerHTML = '<p class="muted" style="margin-top:0">Change the main wording on your public pages without touching code. Leave a box empty to use the built-in text (shown faintly inside it). Plain text only.</p>' +
        '<form class="panel" id="cf" novalidate><h2 style="font-size:1.2rem">Announcement bar</h2><div class="form-grid"><div class="field full"><label for="c-ann">Message shown at the top of every page</label><input id="c-ann" type="text" maxlength="160" value="' + E(c.announcement || '') + '" placeholder="e.g. New: Business websites now include free logo touch-ups"></div>' +
        '<div class="field full"><label class="check"><input type="checkbox" id="c-annon"' + (c.announcementOn ? ' checked' : '') + '> Show the announcement</label></div></div>' +
        '<h2 style="font-size:1.2rem;margin-top:1.5rem">Home page</h2><div class="form-grid">' + f('heroTitle', 'Main headline', 0, 120) + f('heroText', 'Intro paragraph', 4, 300) + f('bandTitle', 'Bottom banner headline', 0, 80) + f('bandText', 'Bottom banner text', 3, 200) + '</div>' +
        '<h2 style="font-size:1.2rem;margin-top:1.5rem">About page</h2><div class="form-grid">' + f('aboutText', 'Opening line', 3, 300) + '</div>' +
        '<div class="cta-row"><button class="btn" type="submit">Save changes</button><button class="btn btn-line" type="button" id="c-reset">Reset to built-in text</button></div><div id="c-msg" class="msg" role="alert"></div></form>';
      $('#cf').addEventListener('submit', function (e) {
        e.preventDefault(); var doc = { announcement: $('#c-ann').value.trim().slice(0, 160), announcementOn: $('#c-annon').checked };
        Object.keys(DEFAULTS).forEach(function (k) { doc[k] = $('#c-' + k).value.trim(); });
        if (doc.announcementOn && !doc.announcement) return say($('#c-msg'), 'Type the announcement, or untick "Show the announcement".');
        Store.saveContent(doc).then(function () { Store.log('Updated website content'); say($('#c-msg'), 'Saved. Reload a public page to see it.', 'ok'); }).catch(function (err) { say($('#c-msg'), err.message); });
      });
      $('#c-reset').addEventListener('click', function () { if (confirm('Clear all custom wording and go back to the built-in text?')) Store.saveContent({}).then(function () { Store.log('Reset website content'); ctx.reload(); }).catch(function (err) { KT.toast(err.message); }); });
    }).catch(ctx.fail);
  } });
})();
