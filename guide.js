/*
  Kinton Guide - an AI help and navigation assistant.
  Every question is answered by Gemini through the Kinton server (/ai/chat).
  What the AI knows about Kinton lives in AI_SYSTEM in server.js.
  Voice commands ("go to cart", "scroll down", "click 3"...) still run on the page itself.
*/
(function () {
  'use strict';
  if (window.__kintonGuide) return;
  window.__kintonGuide = true;

  var CFG = window.KINTON_CONFIG || {};
  var WA = CFG.whatsappNumber || '263775610805';
  var WA_TXT = CFG.whatsappDisplay || '+263 77 561 0805';
  var WA_LINK = 'https://wa.me/' + WA;

  var QUICK = [
    ['What do you build?'],
    ['How do I order?'],
    ['How much does a website cost?'],
    ['How can I pay?']
  ];

  var FALLBACK = {
    a: 'Sorry, I could not get an answer just now. Please try again in a moment, or message us on WhatsApp and we will help.',
    l: [['Chat on WhatsApp', WA_LINK, true], ['Contact form', 'contact.html']]
  };

  /* ---------- Text helpers ---------- */
  function norm(s) { return ' ' + String(s).toLowerCase().replace(/[^a-z0-9.\s-]/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }

  /* ---------- Voice commands: "go to cart", "open shop", "go back" ... ---------- */
  var PAGES = [
    [['my account', 'my orders', 'my profile'], 'account.html', 'your account'],
    [['sign in', 'signin', 'log in', 'login'], 'signin.html', 'the sign in page'],
    [['sign up', 'signup', 'create account', 'create an account', 'register'], 'signup.html', 'the sign up page'],
    [['cart', 'basket', 'checkout', 'shopping cart'], 'cart.html', 'your cart'],
    [['websites', 'website packages'], 'shop.html?cat=Websites', 'the website packages'],
    [['apps', 'mobile apps'], 'shop.html?cat=Apps', 'the app packages'],
    [['branding', 'logos'], 'shop.html?cat=Branding', 'the branding packs'],
    [['add-ons', 'addons', 'add ons', 'domains', 'hosting'], 'shop.html?cat=Add-ons', 'the add-ons'],
    [['shop', 'store', 'packages', 'products'], 'shop.html', 'the shop'],
    [['services'], 'services.html', 'our services'],
    [['labs', 'lab'], 'labs.html', 'Labs'],
    [['about', 'about us'], 'about.html', 'the about page'],
    [['contact', 'contact form', 'contact page'], 'contact.html', 'the contact page'],
    [['terms', 'conditions'], 'terms.html', 'the terms'],
    [['privacy', 'privacy policy'], 'privacy.html', 'the privacy policy'],
    [['home', 'homepage', 'home page', 'main page', 'start page'], 'index.html', 'the home page'],
    [['whatsapp', 'whats app'], WA_LINK, 'WhatsApp']
  ];
  var VERB = /\b(go to|go|open|take me to|take me|show me|show|navigate to|visit|view|bring up|head to|check)\b/;

  function has(t, list) { return list.some(function (p) { return t.indexOf(' ' + p + ' ') !== -1; }); }

  function command(text) {
    var t = norm(text);
    if (t.trim() === 'back' || has(t, ['go back', 'previous page'])) return { say: 'Going back.', run: function () { history.back(); } };
    if (has(t, ['scroll down', 'page down'])) return { say: 'Scrolling down.', delay: 100, run: function () { window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' }); } };
    if (has(t, ['scroll up', 'page up'])) return { say: 'Scrolling up.', delay: 100, run: function () { window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' }); } };
    if (has(t, ['scroll to top', 'go to the top', 'go to top', 'top of the page'])) return { say: 'Going to the top.', delay: 100, run: function () { window.scrollTo({ top: 0, behavior: 'smooth' }); } };
    if (has(t, ['scroll to bottom', 'go to the bottom', 'go to bottom', 'bottom of the page'])) return { say: 'Going to the bottom.', delay: 100, run: function () { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } };
    if (has(t, ['stop talking', 'be quiet', 'mute', 'shut up', 'stop speaking', 'voice off'])) { setVoice(false); return { say: 'Voice replies are off.', silent: true }; }
    if (has(t, ['unmute', 'talk to me', 'talk back', 'turn on voice', 'voice on', 'speak to me', 'read answers'])) { setVoice(true); return { say: 'Voice replies are on.' }; }
    if (has(t, ['close chat', 'close the chat', 'close this', 'close guide', 'close the guide', 'close help'])) return { say: 'Closing.', delay: 600, run: close };
    var raw = t.trim(), m;
    if (has(t, ['hands free on', 'hands-free on', 'start hands free', 'start hands-free', 'hands free mode', 'voice control on'])) return { say: 'Hands-free is on.', run: function () { hfStart(); } };
    if (has(t, ['hands free off', 'hands-free off', 'stop hands free', 'stop listening', 'stop hands-free', 'voice control off'])) return { say: 'Hands-free is off. Tap the Hands-free button to start again.', run: function () { hfStop(); } };
    if (has(t, ['what can i say', 'voice commands', 'list commands', 'help with voice', 'how do i use voice'])) return { say: 'You can say: show numbers, then click 3. Or click a button by name, like click sign in. Also: go to shop, scroll down, scroll up, go back, read this page, type your words, next field, submit, bigger text, sign out, and stop listening.' };
    if (has(t, ['show numbers', 'show the numbers', 'number the buttons', 'show labels', 'numbers on'])) return { say: 'Numbers are on. Say click, then a number.', delay: 50, run: showNumbers };
    if (has(t, ['hide numbers', 'hide the numbers', 'numbers off', 'hide labels'])) return { say: 'Numbers hidden.', delay: 50, run: hideNumbers };
    if (has(t, ['bigger text', 'zoom in', 'larger text', 'make text bigger'])) return { say: 'Text made bigger.', delay: 50, run: function () { setZoom(1); } };
    if (has(t, ['smaller text', 'zoom out', 'make text smaller', 'normal text'])) return { say: 'Text made smaller.', delay: 50, run: function () { setZoom(-1); } };
    if (has(t, ['read this page', 'read the page', 'read page', 'read this out', 'read it to me'])) { var main = document.querySelector('main') || document.body; return { say: (main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 900) || 'There is nothing to read here.' }; }
    if (/^(please )?(sign|log) ?(out|off)( now)?$/.test(raw)) return { say: 'Signing you out.', run: function () { if (window.Store && Store.signOut) Store.signOut().then(function () { location.href = 'index.html'; }); } };
    if (has(t, ['next field', 'next box', 'next input'])) return { say: 'Next field.', delay: 50, run: function () { stepField(1); } };
    if (has(t, ['previous field', 'last field', 'previous box'])) return { say: 'Previous field.', delay: 50, run: function () { stepField(-1); } };
    if (/^(please )?(submit|submit form|submit it|send it|send form|press enter)$/.test(raw)) return { say: 'Submitting.', delay: 200, run: submitForm };
    if ((m = raw.match(/^(?:type|write|enter|dictate)\s+(.+)$/))) return { say: 'Typed.', silent: true, delay: 50, run: function () { typeInto(m[1]); } };
    if ((m = raw.match(/^(?:click|tap|press|select|choose|activate|number|open number|click on)\s+(?:on\s+|the\s+|number\s+)*([a-z0-9 -]+)$/))) {
      var n = toNum(m[1]), el = n ? (numEls.length ? numEls[n - 1] : interactives()[n - 1]) : findByName(m[1]);
      if (el) { var said = fieldOrClick(el); return { say: said, delay: 500, run: function () { activate(el); } }; }
      if (n || /\b(button|link|tab)\b/.test(m[1]) || !has(t, ['shop', 'services', 'labs', 'about', 'contact', 'home', 'cart'])) return { say: 'I could not find ' + (n ? 'number ' + n : m[1]) + ' on this screen. Say show numbers to see what you can click.' };
    }
    if (VERB.test(t.trim()) && t.trim().split(' ').length <= 6) {
      for (var i = 0; i < PAGES.length; i++) {
        if (has(t, PAGES[i][0])) {
          var url = PAGES[i][1], name = PAGES[i][2];
          return { say: 'Opening ' + name + '.', run: function () { window.location.href = url; } };
        }
      }
    }
    return null;
  }

  /* ---------- UI ---------- */
  var css = '' +
    '#kg-btn{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9998;display:flex;align-items:center;gap:8px;padding:12px 16px;border:0;border-radius:999px;background:linear-gradient(135deg,#e2b955,#a87c1a);color:#151515;font:700 .95rem Montserrat,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer}' +
    '#kg-btn svg{width:20px;height:20px}' +
    '#kg-box{position:fixed;right:16px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:9999;width:min(360px,calc(100vw - 32px));height:min(520px,calc(100dvh - 120px));display:none;flex-direction:column;background:#fff;color:#151515;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;font:400 .95rem/1.45 Montserrat,system-ui,sans-serif}' +
    '#kg-box.open{display:flex}' +
    '#kg-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:12px 14px;background:#151515;color:#fff}' +
    '#kg-head strong{display:block;font-weight:700}#kg-head small{color:#e2b955}' +
    '#kg-head .kg-hb{display:flex;align-items:center;gap:2px}' +
    '#kg-head button{background:none;border:0;color:#fff;font-size:1.25rem;line-height:1;cursor:pointer;padding:6px 8px;border-radius:8px}' +
    '#kg-head button[aria-pressed="true"]{background:#e2b955;color:#151515}' +
    '#kg-x{font-size:1.5rem!important}' +
    '#kg-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f7f5ef}' +
    '.kg-m{max-width:88%;padding:10px 12px;border-radius:14px;word-wrap:break-word}' +
    '.kg-bot{align-self:flex-start;background:#fff;border:1px solid #e6e1d3}' +
    '.kg-me{align-self:flex-end;background:#151515;color:#fff}' +
    '.kg-links,.kg-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
    '.kg-links a,.kg-chip{padding:7px 12px;border-radius:999px;font:600 .85rem Montserrat,system-ui,sans-serif;text-decoration:none;cursor:pointer}' +
    '.kg-links a{background:linear-gradient(135deg,#e2b955,#a87c1a);color:#151515;border:0}' +
    '.kg-chip{background:#fff;color:#151515;border:1.5px solid #151515}' +
    '#kg-hint{padding:0 14px 8px;background:#f7f5ef;color:#6b6554;font-size:.78rem}' +
    '#kg-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e6e1d3;background:#fff}' +
    '#kg-in{flex:1;min-width:0;padding:10px 12px;border:1.5px solid #cfc8b4;border-radius:10px;font:inherit}' +
    '#kg-mic{width:44px;border:1.5px solid #151515;border-radius:10px;background:#fff;color:#151515;font-size:1.15rem;cursor:pointer}' +
    '#kg-mic.on{background:#c0392b;border-color:#c0392b;color:#fff;animation:kgp 1s infinite}' +
    '@keyframes kgp{50%{opacity:.6}}' +
    '#kg-send{padding:0 14px;border:0;border-radius:10px;background:#151515;color:#fff;font:700 .9rem Montserrat,system-ui,sans-serif;cursor:pointer}' +
    '@media (prefers-color-scheme:dark){#kg-box{background:#1b1b1b;color:#f2f2f2}#kg-msgs,#kg-hint{background:#141414}#kg-hint{color:#a9a392}.kg-bot{background:#242424;border-color:#333;color:#f2f2f2}.kg-me{background:#e2b955;color:#151515}.kg-chip{background:#242424;color:#f2f2f2;border-color:#e2b955}#kg-form{background:#1b1b1b;border-color:#333}#kg-in{background:#242424;color:#f2f2f2;border-color:#444}#kg-mic{background:#242424;color:#f2f2f2;border-color:#e2b955}#kg-send{background:#e2b955;color:#151515}}';

  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'kg-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Open help guide'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.3A8 8 0 1 1 21 12z"/></svg><span>Help</span>';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var TTS = ('speechSynthesis' in window) && window.SpeechSynthesisUtterance;

  var box = document.createElement('div');
  box.id = 'kg-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Kinton help guide');
  box.innerHTML = '<div id="kg-head"><div><strong>Kinton Guide</strong><small>Type or talk to me</small></div>' +
    '<div class="kg-hb">' + (SR ? '<button id="kg-hf" type="button" aria-pressed="false" title="Hands-free: control the whole site by voice">Hands-free</button>' : '') + (TTS ? '<button id="kg-vo" type="button" aria-pressed="false" aria-label="Speak answers aloud" title="Speak answers aloud">&#128266;</button>' : '') +
    '<button id="kg-x" type="button" aria-label="Close">&times;</button></div></div>' +
    '<div id="kg-msgs" aria-live="polite"></div>' +
    '<div id="kg-hint">Try: &ldquo;go to cart&rdquo;, &ldquo;open shop&rdquo;, &ldquo;go back&rdquo;</div>' +
    '<form id="kg-form" autocomplete="off"><input id="kg-in" type="text" placeholder="Type or tap the mic..." aria-label="Your question" maxlength="200">' +
    (SR ? '<button id="kg-mic" type="button" aria-label="Speak to the guide" title="Speak">&#127908;</button>' : '') +
    '<button id="kg-send" type="submit">Send</button></form>';

  document.body.appendChild(box); document.body.appendChild(btn);

  var msgs = box.querySelector('#kg-msgs'), input = box.querySelector('#kg-in'), started = false;
  var voBtn = box.querySelector('#kg-vo'), micBtn = box.querySelector('#kg-mic');

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---------- Talking back ---------- */
  var speaking = false, lastSpoke = 0, hf = false;
  var voiceOn = store('kg_voice') === '1';
  function setVoice(on) {
    voiceOn = !!on; store('kg_voice', on ? '1' : '0');
    if (voBtn) { voBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); voBtn.innerHTML = on ? '&#128266;' : '&#128263;'; }
    if (!on) stopSpeak();
  }
  function stopSpeak() { try { if (TTS) window.speechSynthesis.cancel(); } catch (e) {} }
  function speak(text) {
    if (!TTS) return;
    try {
      stopSpeak();
      var u = new window.SpeechSynthesisUtterance(text);
      u.lang = navigator.language || 'en-GB'; u.rate = 1;
      u.onstart = function () { speaking = true; };
      u.onend = u.onerror = function () { speaking = false; lastSpoke = Date.now(); };
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  if (voBtn) {
    setVoice(voiceOn);
    voBtn.addEventListener('click', function () {
      setVoice(!voiceOn);
      if (voiceOn) speak('Voice replies are on.');
    });
  }

  function add(cls, text, links, chips) {
    var d = document.createElement('div'); d.className = 'kg-m ' + cls;
    var p = document.createElement('div'); p.textContent = text; d.appendChild(p);
    if (links && links.length) {
      var w = document.createElement('div'); w.className = 'kg-links';
      links.forEach(function (x) {
        var a = document.createElement('a'); a.textContent = x[0]; a.href = x[1];
        if (x[2]) { a.target = '_blank'; a.rel = 'noopener'; }
        w.appendChild(a);
      });
      d.appendChild(w);
    }
    if (chips) {
      var c = document.createElement('div'); c.className = 'kg-chips';
      chips.forEach(function (x) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'kg-chip'; b.textContent = x[0];
        b.addEventListener('click', function () { ask(x[0]); });
        c.appendChild(b);
      });
      d.appendChild(c);
    }
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  }

  function reply(text, links, chips, viaVoice, silent) {
    add('kg-bot', text, links, chips);
    if (!silent && (voiceOn || viaVoice)) speak(text);
  }

  function ask(label, id, viaVoice) {
    add('kg-me', label);
    stopSpeak();
    var cmd = command(label);
    if (cmd) {
      reply(cmd.say, null, null, viaVoice, cmd.silent);
      if (cmd.run) setTimeout(cmd.run, cmd.delay || 1100);
      return;
    }
    if (AI_URL) setTimeout(function () { askAI(label, viaVoice); }, 150);
    else reply(FALLBACK.a, FALLBACK.l, QUICK, viaVoice);
  }

  /* ---------- The AI does all the talking ---------- */
  /* Needs GEMINI_API_KEY on the Kinton server. What it knows about Kinton is AI_SYSTEM in server.js. */
  var AI_BASE = String(CFG.apiBase || 'https://kinton-pay.onrender.com').replace(/\/+$/, '');
  var AI_URL = CFG.aiEnabled === false ? '' : AI_BASE + '/ai/chat';
  var aiHist = [];

  /* The AI may end an answer with buttons written as [[Label|target]]. Only these targets are allowed. */
  var LINKS = {
    shop: 'shop.html', websites: 'shop.html?cat=Websites', apps: 'shop.html?cat=Apps', branding: 'shop.html?cat=Branding', addons: 'shop.html?cat=Add-ons',
    services: 'services.html', contact: 'contact.html', about: 'about.html', labs: 'labs.html', cart: 'cart.html', pay: 'pay.html',
    signin: 'signin.html', signup: 'signup.html', account: 'account.html', terms: 'terms.html', privacy: 'privacy.html', whatsapp: WA_LINK
  };
  function splitLinks(text) {
    var links = [];
    var clean = String(text).replace(/\[\[([^\]|]{1,40})\|\s*([a-z]+)\s*\]\]/gi, function (_, label, key) {
      key = key.toLowerCase();
      if (LINKS[key] && links.length < 2) links.push([label.trim(), LINKS[key], key === 'whatsapp']);
      return '';
    }).replace(/\s+\n/g, '\n').trim();
    return { text: clean, links: links };
  }
  function linkRow(links) {
    var w = document.createElement('div'); w.className = 'kg-links';
    links.forEach(function (x) {
      var a = document.createElement('a'); a.textContent = x[0]; a.href = x[1];
      if (x[2]) { a.target = '_blank'; a.rel = 'noopener'; }
      w.appendChild(a);
    });
    return w;
  }
  function wake() { if (AI_URL) { try { fetch(AI_BASE + '/health').catch(function () {}); } catch (e) {} } }

  function askAI(q, viaVoice) {
    add('kg-bot', 'Thinking...');
    var bubble = msgs.lastChild, line = bubble.firstChild, ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 45000);
    fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, history: aiHist.slice(-6) }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok && j.reply) return j.reply;
          var e = new Error('ai'); e.status = r.status; e.msg = j.error; throw e;
        });
      })
      .then(function (t) {
        clearTimeout(to);
        var p = splitLinks(t);
        line.textContent = p.text || t;
        if (p.links.length) bubble.appendChild(linkRow(p.links));
        msgs.scrollTop = msgs.scrollHeight;
        aiHist.push({ role: 'user', text: q }, { role: 'model', text: p.text || t });
        if (voiceOn || viaVoice) speak(p.text || t);
      })
      .catch(function (err) {
        clearTimeout(to);
        if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
        if (err && err.status === 429 && err.msg) reply(err.msg, null, null, viaVoice);
        else reply(FALLBACK.a, FALLBACK.l, QUICK, viaVoice);
      });
  }

  /* ---------- Listening (microphone) ---------- */
  var rec = null, listening = false;
  function stopListen() { listening = false; if (micBtn) { micBtn.classList.remove('on'); micBtn.setAttribute('aria-label', 'Speak to the guide'); } }
  if (SR && micBtn) {
    micBtn.addEventListener('click', function () {
      if (hf) { hfStop(); return; }
      if (listening) { try { rec.stop(); } catch (e) {} return; }
      stopSpeak();
      try {
        rec = new SR();
        rec.lang = navigator.language || 'en-GB';
        rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
        rec.onresult = function (e) {
          var said = e.results[0][0].transcript;
          if (said) ask(said, null, true);
        };
        rec.onerror = function (e) {
          stopListen();
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') reply('The microphone is blocked. Allow microphone access for this site in your browser settings, or just type your question.');
          else if (e.error === 'no-speech') reply('I did not hear anything. Tap the mic and try again.');
          else if (e.error === 'network') reply('Voice needs an internet connection. You can still type.');
        };
        rec.onend = stopListen;
        rec.start();
        listening = true; micBtn.classList.add('on'); micBtn.setAttribute('aria-label', 'Listening. Tap to stop');
      } catch (err) { stopListen(); }
    });
  }

  function open(restored) {
    box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); store('kg_open', '1'); wake();
    if (!started) {
      started = true;
      if (restored) add('kg-bot', 'Done. What else can I help with?', null, QUICK);
      else add('kg-bot', 'Hi! I am the Kinton Guide. Ask me anything about Kinton Technologies, or tell me where to go, like "go to cart". You can type or tap the mic.', null, QUICK);
    }
    if (!restored) setTimeout(function () { input.focus(); }, 50);
  }
  function close() { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); store('kg_open', '0'); stopSpeak(); if (listening && rec) { try { rec.stop(); } catch (e) {} } btn.focus(); }

  btn.addEventListener('click', function () { box.classList.contains('open') ? close() : open(); });
  box.querySelector('#kg-x').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
  box.querySelector('#kg-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim(); if (!v) return;
    input.value = ''; ask(v);
  });

  /* ---------- Hands-free: see the screen, talk to it, no touch needed ---------- */
  var numEls = [], numLayer = null, numTimer = 0, hfRec = null, hfDead = false;
  var WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, to: 2, too: 2, for: 4, ate: 8 };
  function toNum(x) { x = String(x).trim(); if (/^\d{1,2}$/.test(x)) return +x; return WORDS[x] || 0; }
  var cap = document.createElement('div'); cap.id = 'kg-caption'; cap.setAttribute('role', 'status'); cap.setAttribute('aria-live', 'polite'); document.body.appendChild(cap);
  var capT = 0;
  function caption(txt, live) {
    cap.textContent = '';
    if (live) { var d = document.createElement('span'); d.className = 'mic'; cap.appendChild(d); }
    cap.appendChild(document.createTextNode(txt)); cap.classList.add('on'); clearTimeout(capT);
    if (!live) capT = setTimeout(function () { if (hf) caption('Listening...', true); else cap.classList.remove('on'); }, 4500);
  }
  function interactives() {
    var q = document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]'), out = [];
    for (var i = 0; i < q.length; i++) {
      var el = q[i]; if (box.contains(el) || el === btn || el.disabled) continue;
      var r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      out.push(el);
    }
    return out;
  }
  function labelOf(el) { return norm(el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || (el.labels && el.labels[0] && el.labels[0].innerText) || '').trim(); }
  function findByName(name) {
    name = norm(name).trim(); if (!name) return null;
    var list = interactives(), best = null, i;
    for (i = 0; i < list.length; i++) if (labelOf(list[i]) === name) return list[i];
    for (i = 0; i < list.length; i++) { var l = labelOf(list[i]); if (l && (l.indexOf(name) !== -1 || (name.indexOf(l) !== -1 && l.length > 3))) { best = best || list[i]; } }
    return best;
  }
  function fieldOrClick(el) { var l = labelOf(el).slice(0, 40); return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ? 'Ready to type in ' + (l || 'that field') + '. Say type, then your words.' : 'Clicking ' + (l || 'that') + '.'; }
  function activate(el) { hideNumbers(); try { el.scrollIntoView({ block: 'center' }); } catch (e) {} if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit)$/.test(el.type)) el.focus(); else el.click(); }
  function showNumbers() {
    hideNumbers(); numEls = interactives(); numLayer = document.createElement('div');
    numEls.forEach(function (el, i) { var r = el.getBoundingClientRect(), b = document.createElement('span'); b.className = 'kg-num'; b.textContent = i + 1; b.style.left = Math.max(2, r.left) + 'px'; b.style.top = Math.max(2, r.top) + 'px'; numLayer.appendChild(b); });
    document.body.appendChild(numLayer);
  }
  function hideNumbers() { if (numLayer) { numLayer.remove(); numLayer = null; } numEls = []; }
  window.addEventListener('scroll', function () { if (!numLayer) return; clearTimeout(numTimer); numTimer = setTimeout(showNumbers, 250); }, { passive: true });
  function setZoom(d) { var cur = parseFloat(store('kg_zoom') || '100') + d * 15; cur = Math.max(85, Math.min(200, cur)); store('kg_zoom', String(cur)); document.documentElement.style.fontSize = cur + '%'; }
  if (store('kg_zoom')) document.documentElement.style.fontSize = store('kg_zoom') + '%';
  function fields() { return Array.prototype.filter.call(document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select'), function (e) { return !box.contains(e) && e.offsetParent !== null && !e.disabled; }); }
  function stepField(d) { var f = fields(), i = f.indexOf(document.activeElement), n = f[(i + d + f.length) % f.length]; if (n) { n.focus(); n.scrollIntoView({ block: 'center' }); caption('Field: ' + (labelOf(n) || n.type)); } }
  function typeInto(text) {
    var el = document.activeElement; if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) { var f = fields(); el = f[0]; if (el) el.focus(); }
    if (!el) return caption('Nothing to type into here.');
    if (el.type === 'email' || /email/i.test(el.name + el.id)) text = text.replace(/\s+at\s+/gi, '@').replace(/\s+dot\s+/gi, '.').replace(/\s+/g, '');
    else if (el.type === 'password') text = text.replace(/\s+/g, '');
    el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    caption('Typed: ' + (el.type === 'password' ? '••••••' : text));
  }
  function submitForm() {
    var el = document.activeElement, form = (el && el.form) || document.querySelector('main form, form');
    if (form) { if (form.requestSubmit) form.requestSubmit(); else form.submit(); } else caption('There is no form here.');
  }

  function hfLoop() {
    if (!hf || hfDead) return;
    try {
      hfRec = new SR(); hfRec.lang = navigator.language || 'en-GB'; hfRec.continuous = true; hfRec.interimResults = true; hfRec.maxAlternatives = 1;
      hfRec.onresult = function (e) {
        var r = e.results[e.results.length - 1]; if (!r) return;
        if (speaking || Date.now() - lastSpoke < 700) return;
        var said = r[0].transcript.trim(); if (!said) return;
        if (!r.isFinal) { caption(said, true); return; }
        caption('Heard: ' + said); ask(said, null, true);
      };
      hfRec.onerror = function (e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { hfDead = true; hfStop(); caption('Microphone is blocked. Allow it in your browser settings.'); }
      };
      hfRec.onend = function () { if (hf && !hfDead) setTimeout(hfLoop, 350); };
      hfRec.start();
    } catch (err) { setTimeout(hfLoop, 1200); }
  }
  function hfStart(quiet) {
    if (!SR || hf) return; hf = true; hfDead = false; store('kg_hf', '1'); setVoice(true);
    var b = box.querySelector('#kg-hf'); if (b) { b.setAttribute('aria-pressed', 'true'); b.classList.add('on'); }
    if (!box.classList.contains('open')) open(true);
    caption('Listening...', true); hfLoop();
    if (!quiet) speak('Hands-free is on. Say show numbers, then click a number. Or say what can I say.');
  }
  function hfStop() {
    hf = false; store('kg_hf', '0'); hideNumbers();
    try { if (hfRec) { hfRec.onend = null; hfRec.stop(); } } catch (e) {}
    var b = box.querySelector('#kg-hf'); if (b) { b.setAttribute('aria-pressed', 'false'); b.classList.remove('on'); }
    cap.classList.remove('on');
  }
  var hfBtn = box.querySelector('#kg-hf');
  if (hfBtn) hfBtn.addEventListener('click', function () { hf ? hfStop() : hfStart(); });
  window.KintonGuide = {
    open: function () { open(); },
    say: function (t) { open(true); reply(t, null, null, true); },
    handsFree: function (on) { on ? hfStart() : hfStop(); }
  };
  if (store('kg_hf') === '1' && SR) setTimeout(function () { hfStart(true); }, 600);

  /* Keep the guide open after it takes you to another page */
  if (store('kg_open') === '1') open(true);
})();
