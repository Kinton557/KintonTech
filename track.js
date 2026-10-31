/* Kinton Technologies - anonymous visit counter.
   Sends one "page view" and a small "still here" signal every 40 seconds while the tab is open.
   No names, no emails, no IP addresses, no cookies. Visitors can switch it off with the notice at the bottom of the page.
   Staff and the admin page are never counted. */
(function () {
  'use strict';
  var BEAT_MS = 40000;
  function get(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
  function set(store, k, v) { try { store.setItem(k, v); } catch (e) {} }
  function rand(n) {
    var c = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '', a = new Uint8Array(n);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 255; });
    for (var i = 0; i < n; i++) s += c[a[i] % c.length];
    return s;
  }
  if (get(localStorage, 'kt_consent') === 'no' || navigator.doNotTrack === '1') return;
  if (document.body && document.body.getAttribute('data-page') === 'admin') return;
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return;

  var vid = get(localStorage, 'kt_vid'), isNew = false;
  if (!vid) { vid = rand(16); set(localStorage, 'kt_vid', vid); isNew = true; }
  var sid = get(sessionStorage, 'kt_sid');
  if (!sid) { sid = rand(12); set(sessionStorage, 'kt_sid', sid); }

  var ua = navigator.userAgent || '';
  var dev = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop';
  var br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  var os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var ref = '';
  try { if (document.referrer) { var h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h && h !== location.hostname.replace(/^www\./, '')) ref = h; } } catch (e) {}
  var path = location.pathname.replace(/\/index\.html$/, '/') || '/';

  function clip(v, n) { return String(v || '').slice(0, n); }

  function start() {
    if (!window.Store) return;
    Store.ready.then(function () {
      if (Store.user && Store.user.isAdmin) return;           // never count staff
      Store.logHit({ vid: vid, sid: sid, path: clip(path, 200), title: clip(document.title, 120), ref: clip(ref, 80), dev: dev, br: br, os: os, tz: clip(tz, 40), lang: clip(navigator.language, 12), w: Math.round(window.innerWidth || 0), nv: isNew });
      var beat = function () { if (document.visibilityState === 'visible') Store.beat(vid, { sid: sid, path: clip(path, 200), dev: dev, br: br, tz: clip(tz, 40) }); };
      beat();
      setInterval(beat, BEAT_MS);
      document.addEventListener('visibilitychange', beat);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
