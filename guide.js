/*
  Kinton Guide - a free, built-in help and navigation assistant.
  No server, no AI key, no cost. It matches keywords to ready-made answers,
  so it can never invent facts. To change an answer, edit the INTENTS list below.
*/
(function () {
  'use strict';
  if (window.__kintonGuide) return;
  window.__kintonGuide = true;

  var CFG = window.KINTON_CONFIG || {};
  var WA = CFG.whatsappNumber || '263775610805';
  var WA_TXT = CFG.whatsappDisplay || '+263 77 561 0805';
  var WA_LINK = 'https://wa.me/' + WA;

  /* ---------- Answers. Each: keywords (any match), reply text, optional links ---------- */
  var INTENTS = [
    { id: 'hello', k: ['hi', 'hello', 'hey', 'hie', 'howdy', 'morning', 'afternoon', 'evening'],
      a: 'Hello! I can help you find your way around Kinton Technologies. What are you looking for?' },
    { id: 'services', k: ['service', 'services', 'what do you do', 'what you do', 'offer', 'build', 'help me with'],
      a: 'We build websites, mobile apps, brand identities (logos, colours, social media kits), and we help with domains and hosting.',
      l: [['See services', 'services.html'], ['Browse the shop', 'shop.html']] },
    { id: 'website', k: ['website', 'web site', 'web', 'online store', 'online shop', 'ecommerce', 'e-commerce', 'landing page', 'portfolio site'],
      a: 'We build business sites, portfolios and online shops that work well on phones, load quickly and let customers contact you on WhatsApp in one tap.',
      l: [['See website packages', 'shop.html?cat=Websites'], ['Get a quote', 'contact.html']] },
    { id: 'app', k: ['app', 'apps', 'mobile app', 'android', 'ios', 'iphone', 'application'],
      a: 'We build Android and iOS apps. First we write down what the app should do, then we quote a fixed price.',
      l: [['Ask about an app', 'shop.html?cat=Apps'], ['Get a quote', 'contact.html']] },
    { id: 'brand', k: ['brand', 'branding', 'logo', 'logos', 'colours', 'colors', 'identity', 'social media kit', 'design'],
      a: 'We design logos plus the pieces around them: colours, fonts and social media templates, so your business looks consistent online and in print.',
      l: [['See branding packs', 'shop.html?cat=Branding'], ['Get a quote', 'contact.html']] },
    { id: 'domain', k: ['domain', 'hosting', 'host', 'co.zw', '.com', 'dns', 'email address'],
      a: 'We help you choose, register and connect a domain name and get your site online. Domain and hosting fees are paid to the provider.',
      l: [['See add-ons', 'shop.html?cat=Add-ons']] },
    { id: 'price', k: ['price', 'prices', 'pricing', 'cost', 'how much', 'rate', 'rates', 'cheap', 'afford', 'quote', 'package', 'packages', 'budget'],
      a: 'Prices are listed on each package in the shop. For something custom, send us a message and we will give you a quote. Placing an order is only a request. Nothing is charged until we agree the scope and price with you.',
      l: [['Browse packages', 'shop.html'], ['Get a quote', 'contact.html']] },
    { id: 'order', k: ['order', 'buy', 'purchase', 'how do i start', 'get started', 'start a project', 'cart', 'checkout'],
      a: 'It is simple: 1) Add a package to your cart, or message us if you need something custom. 2) Place your order. We contact you on WhatsApp to agree scope, price and timeline. You pay nothing at this step. 3) We build, you review and ask for changes, then we launch together.',
      l: [['Open the shop', 'shop.html'], ['View cart', 'cart.html']] },
    { id: 'pay', k: ['pay', 'payment', 'ecocash', 'bank', 'cash', 'invoice', 'refund', 'deposit', 'usd', 'zig'],
      a: 'We agree the payment method with you on WhatsApp before work starts (for example cash, EcoCash or bank). The website records orders and invoices but does not take card payments itself.',
      l: [['Chat on WhatsApp', WA_LINK, true]] },
    { id: 'time', k: ['how long', 'timeline', 'deadline', 'delivery', 'turnaround', 'days', 'weeks', 'when will'],
      a: 'Timelines depend on the project. We confirm the scope, price and timeline with you before work begins. Tell us what you need and we will give you a realistic date.',
      l: [['Get a quote', 'contact.html'], ['Chat on WhatsApp', WA_LINK, true]] },
    { id: 'contact', k: ['contact', 'reach', 'phone', 'call', 'email', 'message', 'talk', 'speak', 'whatsapp', 'number', 'human', 'person', 'agent'],
      a: 'You can reach us on WhatsApp at ' + WA_TXT + ', or send a message through the contact form. We reply on the email or phone number you give us.',
      l: [['Chat on WhatsApp', WA_LINK, true], ['Contact form', 'contact.html']] },
    { id: 'where', k: ['where', 'location', 'address', 'kadoma', 'zimbabwe', 'office', 'visit', 'based'],
      a: 'We are based in Kadoma, Zimbabwe, and we build for businesses and organisations all over the country.',
      l: [['Contact us', 'contact.html']] },
    { id: 'about', k: ['about', 'who are you', 'who is', 'founder', 'ceo', 'team', 'company', 'tanaka', 'denzel', 'mangani', 'mujikijera'],
      a: 'Kinton Technologies is a software and design studio in Kadoma, Zimbabwe. Founder and CEO: Tanaka Shanon Mujikijera. Co-founder: Denzel Mangani. We keep the team small so you always know who is working on your project.',
      l: [['About us', 'about.html']] },
    { id: 'labs', k: ['labs', 'lab', 'product', 'products', 'experiment', 'kintontech labs', 'roadmap', 'release'],
      a: 'KintonTech Labs is where we build and test our own products and ideas. Some are ideas, some are in progress, and some are ready to use.',
      l: [['Visit Labs', 'labs.html']] },
    { id: 'account', k: ['account', 'sign in', 'signin', 'login', 'log in', 'sign up', 'signup', 'register', 'create account', 'password', 'forgot'],
      a: 'You can create a free account to place orders and track them. If you forgot your password, use the reset link on the sign-in page.',
      l: [['Sign in', 'signin.html'], ['Create account', 'signup.html']] },
    { id: 'support', k: ['support', 'problem', 'issue', 'not working', 'broken', 'complaint', 'ticket', 'bug'],
      a: 'Sorry you are having trouble. Sign in to open a support ticket from your account, or message us on WhatsApp and we will help.',
      l: [['My account', 'account.html'], ['Chat on WhatsApp', WA_LINK, true]] },
    { id: 'legal', k: ['terms', 'privacy', 'policy', 'data', 'conditions', 'legal'],
      a: 'You can read how we work and how we handle your information in these pages.',
      l: [['Terms', 'terms.html'], ['Privacy', 'privacy.html']] },
    { id: 'thanks', k: ['thanks', 'thank you', 'thank', 'ok thanks', 'cool', 'great', 'nice', 'appreciate'],
      a: 'You are welcome! Anything else I can help you find?' },
    { id: 'bye', k: ['bye', 'goodbye', 'see you', 'cheers'],
      a: 'Goodbye! If you need us, we are one WhatsApp message away.' }
  ];

  var QUICK = [
    ['What do you build?', 'services'],
    ['How do I order?', 'order'],
    ['Prices', 'price'],
    ['Contact us', 'contact']
  ];

  var FALLBACK = {
    a: 'I am not sure about that one. A real person can answer it best. Message us on WhatsApp and we will help.',
    l: [['Chat on WhatsApp', WA_LINK, true], ['Contact form', 'contact.html']]
  };

  /* ---------- Matching ---------- */
  function norm(s) { return ' ' + String(s).toLowerCase().replace(/[^a-z0-9.\s-]/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }

  function find(text) {
    var t = norm(text), best = null, bestScore = 0;
    INTENTS.forEach(function (it) {
      var score = 0;
      it.k.forEach(function (kw) {
        var n = norm(kw);
        if (t.indexOf(n) !== -1) score += n.trim().split(' ').length + (n.length > 8 ? 1 : 0);
      });
      if (score > bestScore) { best = it; bestScore = score; }
    });
    return best;
  }

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
    if (VERB.test(t.trim())) {
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
    '<div class="kg-hb">' + (TTS ? '<button id="kg-vo" type="button" aria-pressed="false" aria-label="Speak answers aloud" title="Speak answers aloud">&#128266;</button>' : '') +
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
        b.addEventListener('click', function () { ask(x[0], x[1]); });
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
    var cmd = id ? null : command(label);
    if (cmd) {
      reply(cmd.say, null, null, viaVoice, cmd.silent);
      if (cmd.run) setTimeout(cmd.run, cmd.delay || 1100);
      return;
    }
    var it = id ? INTENTS.filter(function (x) { return x.id === id; })[0] : find(label);
    setTimeout(function () {
      if (it) reply(it.a, it.l, null, viaVoice);
      else reply(FALLBACK.a, FALLBACK.l, QUICK, viaVoice);
    }, 250);
  }

  /* ---------- Listening (microphone) ---------- */
  var rec = null, listening = false;
  function stopListen() { listening = false; if (micBtn) { micBtn.classList.remove('on'); micBtn.setAttribute('aria-label', 'Speak to the guide'); } }
  if (SR && micBtn) {
    micBtn.addEventListener('click', function () {
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
    box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); store('kg_open', '1');
    if (!started) {
      started = true;
      if (restored) add('kg-bot', 'Done. What else can I help with?', null, QUICK);
      else add('kg-bot', 'Hi! I am the Kinton Guide. Ask me a question, or tell me where to go, like "go to cart". You can type or tap the mic.', null, QUICK);
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

  /* Keep the guide open after it takes you to another page */
  if (store('kg_open') === '1') open(true);
})();
