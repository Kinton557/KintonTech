/* Kinton Technologies - admin: Analytics (live visitors, last 5 minutes, today, 7 and 30 days).
   Reads the anonymous "hits" and "live" records written by track.js. Only decides what to show;
   real protection is in firestore.rules (the Analytics permission). */
(function () {
  'use strict';
  var KT = window.KT, E = KT.esc;
  var DAY = 86400000, MIN = 60000;

  var TZ = { 'Africa/Harare': 'Zimbabwe', 'Africa/Johannesburg': 'South Africa', 'Africa/Maputo': 'Mozambique', 'Africa/Lusaka': 'Zambia', 'Africa/Gaborone': 'Botswana', 'Africa/Windhoek': 'Namibia', 'Africa/Blantyre': 'Malawi', 'Africa/Nairobi': 'Kenya', 'Africa/Lagos': 'Nigeria', 'Africa/Accra': 'Ghana', 'Africa/Cairo': 'Egypt', 'Africa/Kampala': 'Uganda', 'Africa/Dar_es_Salaam': 'Tanzania', 'Africa/Addis_Ababa': 'Ethiopia', 'Africa/Kinshasa': 'DR Congo', 'Africa/Lubumbashi': 'DR Congo', 'Africa/Luanda': 'Angola', 'Africa/Casablanca': 'Morocco', 'Africa/Algiers': 'Algeria', 'Africa/Tunis': 'Tunisia', 'Europe/London': 'United Kingdom', 'Europe/Dublin': 'Ireland', 'Europe/Paris': 'France', 'Europe/Berlin': 'Germany', 'Europe/Madrid': 'Spain', 'Europe/Rome': 'Italy', 'Europe/Amsterdam': 'Netherlands', 'Europe/Lisbon': 'Portugal', 'Europe/Moscow': 'Russia', 'America/New_York': 'United States', 'America/Chicago': 'United States', 'America/Denver': 'United States', 'America/Los_Angeles': 'United States', 'America/Toronto': 'Canada', 'America/Sao_Paulo': 'Brazil', 'Asia/Dubai': 'UAE', 'Asia/Kolkata': 'India', 'Asia/Calcutta': 'India', 'Asia/Karachi': 'Pakistan', 'Asia/Shanghai': 'China', 'Asia/Singapore': 'Singapore', 'Asia/Tokyo': 'Japan', 'Australia/Sydney': 'Australia', 'Pacific/Auckland': 'New Zealand' };
  function country(tz) { return TZ[tz] || (tz ? tz.split('/')[0] : 'Unknown'); }
  function n(v) { return Number(v || 0).toLocaleString('en-GB'); }
  function ago(ms) { var s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + 's ago' : Math.round(s / 60) + ' min ago'; }
  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

  function uniq(list, key) { var m = {}; list.forEach(function (h) { m[h[key]] = 1; }); return Object.keys(m).length; }
  function tally(list, fn) {
    var m = {}; list.forEach(function (h) { var k = fn(h); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  }
  function stats(list) {
    var sess = {}; list.forEach(function (h) { sess[h.sid] = (sess[h.sid] || 0) + 1; });
    var sids = Object.keys(sess), single = sids.filter(function (k) { return sess[k] === 1; }).length;
    return { views: list.length, visitors: uniq(list, 'vid'), sessions: sids.length, newV: list.filter(function (h) { return h.nv; }).length,
      pps: sids.length ? (list.length / sids.length) : 0, bounce: sids.length ? Math.round(single / sids.length * 100) : 0 };
  }

  function tile(label, value, sub, live) {
    return '<div class="an-tile' + (live ? ' an-live' : '') + '"><span class="an-k">' + E(label) + '</span><strong>' + E(value) + '</strong>' + (sub ? '<span class="an-sub">' + E(sub) + '</span>' : '') + '</div>';
  }
  function list(title, rows, total, empty) {
    var max = rows.length ? rows[0][1] : 1;
    return '<section class="an-card"><h3>' + E(title) + '</h3>' + (rows.length ? '<ul class="an-list">' + rows.slice(0, 8).map(function (r) {
      return '<li><span class="an-name">' + E(r[0]) + '</span><span class="an-num">' + n(r[1]) + ' <small>' + (total ? Math.round(r[1] / total * 100) : 0) + '%</small></span><i style="width:' + Math.max(3, Math.round(r[1] / max * 100)) + '%"></i></li>';
    }).join('') + '</ul>' : '<p class="muted" style="margin:0">' + E(empty || 'No data yet.') + '</p>') + '</section>';
  }
  function bars(buckets, labelEvery, unit) {
    var W = 600, H = 190, pad = 34, max = Math.max.apply(null, buckets.map(function (b) { return b.v; }).concat([1]));
    var bw = (W - pad) / buckets.length;
    var out = '<svg class="an-chart" viewBox="0 0 ' + W + ' ' + (H + 30) + '" role="img" aria-label="Visits over time">';
    [0.5, 1].forEach(function (f) { var y = H - f * (H - 10); out += '<line x1="' + pad + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" class="an-grid"/><text x="0" y="' + (y + 4) + '" class="an-axis">' + Math.round(max * f) + '</text>'; });
    buckets.forEach(function (b, i) {
      var h = Math.round(b.v / max * (H - 10)), x = pad + i * bw;
      out += '<rect x="' + (x + 1.5) + '" y="' + (H - h) + '" width="' + Math.max(2, bw - 3) + '" height="' + Math.max(h, b.v ? 2 : 0) + '" rx="2" class="an-bar"><title>' + E(b.l + ': ' + b.v + ' ' + unit) + '</title></rect>';
      if (i % labelEvery === 0) out += '<text x="' + (x + bw / 2) + '" y="' + (H + 24) + '" text-anchor="middle" class="an-axis">' + E(b.s) + '</text>';
    });
    return out + '</svg>';
  }

  KT.registerAdmin({ key: 'analytics', title: 'Analytics', order: 5, perm: 'analytics', render: function (panel, ctx) {
    var range = 'today', hits = [], live = [], timers = [], root;
    panel.innerHTML = '<div class="an" id="an-root"><p class="muted">Loading visitor statistics...</p></div>';
    root = document.getElementById('an-root');
    function stop() { timers.forEach(clearInterval); timers = []; }
    function alive() { if (!document.body.contains(root)) { stop(); return false; } return true; }

    function rangeStart() { return range === 'today' ? startOfToday() : Date.now() - (range === '7d' ? 7 : 30) * DAY; }

    function draw() {
      if (!alive()) return;
      var now = Date.now();
      var inRange = hits.filter(function (h) { return h.t >= rangeStart(); });
      var s = stats(inRange);
      var activeNow = live.filter(function (x) { return now - x.t < 90000; });
      var last5 = uniq(hits.filter(function (h) { return now - h.t < 5 * MIN; }), 'vid');
      var liveIds = {}; live.filter(function (x) { return now - x.t < 5 * MIN; }).forEach(function (x) { liveIds[x.id] = 1; });
      var last5v = Math.max(last5, Object.keys(liveIds).length);
      var last30 = Math.max(uniq(hits.filter(function (h) { return now - h.t < 30 * MIN; }), 'vid'), live.filter(function (x) { return now - x.t < 30 * MIN; }).length);
      var today = stats(hits.filter(function (h) { return h.t >= startOfToday(); }));

      // chart buckets
      var buckets = [], i;
      if (range === 'today') {
        var base = startOfToday();
        for (i = 0; i < 24; i++) buckets.push({ s: (i < 10 ? '0' : '') + i, l: (i < 10 ? '0' : '') + i + ':00', v: 0, a: base + i * 3600000 });
        inRange.forEach(function (h) { var k = Math.floor((h.t - base) / 3600000); if (buckets[k]) buckets[k].v++; });
      } else {
        var days = range === '7d' ? 7 : 30, d0 = new Date(); d0.setHours(0, 0, 0, 0);
        for (i = days - 1; i >= 0; i--) { var dt = new Date(d0.getTime() - i * DAY); buckets.push({ s: dt.getDate() + '/' + (dt.getMonth() + 1), l: dt.toLocaleDateString('en-GB', { dateStyle: 'medium' }), v: 0, a: dt.getTime() }); }
        inRange.forEach(function (h) { for (var k = buckets.length - 1; k >= 0; k--) { if (h.t >= buckets[k].a) { buckets[k].v++; break; } } });
      }
      var m30 = []; for (i = 29; i >= 0; i--) m30.push({ s: i === 0 ? 'now' : '-' + i + 'm', l: i + ' min ago', v: 0, a: now - (i + 1) * MIN });
      hits.filter(function (h) { return now - h.t < 30 * MIN; }).forEach(function (h) { var k = 29 - Math.floor((now - h.t) / MIN); if (m30[k]) m30[k].v++; });

      var chips = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']].map(function (r) { return '<button type="button" class="chip" data-range="' + r[0] + '" aria-pressed="' + (range === r[0]) + '">' + r[1] + '</button>'; }).join('');
      var rows = activeNow.sort(function (a, b) { return b.t - a.t; });

      root.innerHTML =
        '<div class="an-top">' + tile('Active right now', n(activeNow.length), 'updates every 15 seconds', true) + tile('Last 5 minutes', n(last5v), 'visitors') + tile('Last 30 minutes', n(last30), 'visitors') + tile('Today', n(today.visitors), n(today.views) + ' page views') + '</div>' +
        '<section class="an-card"><div class="an-head"><h3>Live visitors</h3><span class="an-pulse" aria-hidden="true"></span></div>' +
        (rows.length ? '<div style="overflow-x:auto"><table class="an-table"><thead><tr><th>Page</th><th>Device</th><th>Browser</th><th>Country</th><th>Last seen</th></tr></thead><tbody>' + rows.slice(0, 25).map(function (x) {
          return '<tr><td>' + E(x.path) + '</td><td>' + E(x.dev || '') + '</td><td>' + E(x.br || '') + '</td><td>' + E(country(x.tz)) + '</td><td>' + ago(now - x.t) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted" style="margin:0">Nobody is on the site this second.</p>') + '</section>' +
        '<section class="an-card"><h3>Last 30 minutes</h3><p class="muted" style="margin:0 0 .6rem">Page views per minute.</p>' + bars(m30, 5, 'views') + '</section>' +
        '<div class="an-range"><h3 style="margin:0">Traffic</h3><div class="chips" role="group" aria-label="Time range">' + chips + '</div></div>' +
        '<div class="an-top">' + tile('Visitors', n(s.visitors), 'unique people') + tile('Page views', n(s.views), s.pps ? s.pps.toFixed(1) + ' pages per visit' : '') + tile('Visits', n(s.sessions), s.bounce + '% left after one page') + tile('New visitors', n(s.newV), s.views ? 'first time on the site' : '') + '</div>' +
        '<section class="an-card"><h3>' + (range === 'today' ? 'Views by hour' : 'Views by day') + '</h3>' + bars(buckets, range === '30d' ? 4 : (range === 'today' ? 3 : 1), 'views') + '</section>' +
        '<div class="an-grid">' +
          list('Top pages', tally(inRange, function (h) { return h.path; }), s.views) +
          list('Where visitors come from', tally(inRange, function (h) { return h.ref || 'Direct or unknown'; }), s.views) +
          list('Countries', tally(inRange, function (h) { return country(h.tz); }), s.views) +
          list('Devices', tally(inRange, function (h) { return h.dev; }), s.views) +
          list('Browsers', tally(inRange, function (h) { return h.br; }), s.views) +
          list('Operating systems', tally(inRange, function (h) { return h.os; }), s.views) +
        '</div>' +
        '<p class="muted" style="font-size:.85rem">Counts are anonymous: no names, emails, IP addresses or cookies. Staff visits are not counted. Country is estimated from the visitor\'s time zone. ' + (hits.length >= 8000 ? 'Showing the latest 8,000 page views.' : '') + '</p>';
    }

    function loadLive() { return Store.listLive(Date.now() - 6 * MIN).then(function (l) { live = l; draw(); }).catch(function () {}); }
    function loadHits() { return Store.listHits(Date.now() - 30 * DAY).then(function (h) { hits = h; draw(); }); }

    panel.onclick = function (e) { var b = e.target.closest('[data-range]'); if (b) { range = b.dataset.range; draw(); } };
    Promise.all([loadHits(), loadLive()]).then(function () {
      draw();
      timers.push(setInterval(function () { if (alive() && document.visibilityState === 'visible') loadLive(); }, 15000));
      timers.push(setInterval(function () { if (alive() && document.visibilityState === 'visible') loadHits(); }, 60000));
    }).catch(function (err) {
      root.innerHTML = '<div class="msg error">Could not load statistics. Publish the latest firestore.rules (it adds the "hits" and "live" collections), then reload.</div>';
      console.error(err);
    });
  } });
})();
