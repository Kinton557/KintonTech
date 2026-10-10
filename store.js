/*
  Kinton Technologies - data layer.
  Two backends behind one API:
    - Firebase (Auth + Firestore) when config.js has real keys -> real accounts; security comes from firestore.rules
    - Demo mode (localStorage) otherwise                        -> for previewing only, NOT secure
  Pages only ever talk to window.Store.
*/
(function () {
  'use strict';
  var cfg = window.KINTON_CONFIG || {};
  var fb = cfg.firebase || {};
  var DEMO = !fb.apiKey || /^PASTE/i.test(fb.apiKey);
  var listeners = [];
  var Store = { demo: DEMO, user: null, suspendedMsg: '' };
  var auth, db;

  function notify() { listeners.forEach(function (fn) { try { fn(Store.user); } catch (e) { console.error(e); } }); }
  Store.onChange = function (fn) { listeners.push(fn); };
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('Could not load ' + src)); }; document.head.appendChild(s);
    });
  }
  function uid8() { return Math.random().toString(36).slice(2, 10); }
  function orderRef() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return 'KT-' + s; }
  function tmpPassword() { var c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; var a = new Uint32Array(14); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 4e9; }); for (var i = 0; i < 14; i++) s += c[a[i] % c.length]; return s + '9a'; }
  function byNewest(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }

  /* ---------------- constants ---------------- */
  Store.categories = ['Websites', 'Apps', 'Branding', 'Add-ons'];
  Store.orderStatuses = ['new', 'confirmed', 'in progress', 'completed', 'cancelled'];
  // Admin modules. "perms" for staff are these keys. Owners and admins can open everything.
  Store.MODULES = [
    ['products', 'Products'], ['orders', 'Orders'], ['payments', 'Invoices & payments'], ['projects', 'Client projects'],
    ['labs', 'KintonTech Labs'], ['tickets', 'Support'], ['content', 'Website content']
  ];
  Store.sampleProducts = [
    { name: 'Starter Website', category: 'Websites', price: 120, featured: true, active: true, image: '', description: 'Up to 5 pages, mobile-friendly, with a contact form and WhatsApp button.' },
    { name: 'Business Website', category: 'Websites', price: 250, featured: true, active: true, image: '', description: 'Up to 10 pages with Google Maps, basic search-engine setup and your own domain connected.' },
    { name: 'Online Shop', category: 'Websites', price: 400, featured: true, active: true, image: '', description: 'A shop with a product catalog, cart, customer accounts and order management.' },
    { name: 'Mobile App', category: 'Apps', price: 0, featured: true, active: true, image: '', description: 'An Android or iOS app for your idea. We scope it with you first, then send a fixed quote.' },
    { name: 'Logo Design', category: 'Branding', price: 40, featured: false, active: true, image: '', description: 'A primary logo plus colour, black and white versions ready for print and social media.' },
    { name: 'Brand Kit', category: 'Branding', price: 90, featured: false, active: true, image: '', description: 'Logo, colour palette, fonts and profile images so everything you post looks the same.' },
    { name: 'Social Media Pack', category: 'Branding', price: 30, featured: false, active: true, image: '', description: '10 post templates sized for Facebook, Instagram and WhatsApp status.' },
    { name: 'Domain & Hosting Setup', category: 'Add-ons', price: 25, featured: false, active: true, image: '', description: 'We help you register a .co.zw or .com domain and get your site online. Domain fees are extra.' }
  ];
  // Labs starting entries are honest placeholders: stage "planned" until you change them.
  Store.sampleLabs = [
    { name: 'ZimSkills', type: 'product', stage: 'planned', version: '', url: '', public: true, team: '', summary: 'A place to learn and showcase practical skills in Zimbabwe.', roadmap: [{ t: 'Define the first version', done: false }], releases: [] },
    { name: 'Payment tools', type: 'product', stage: 'planned', version: '', url: '', public: true, team: '', summary: 'Simple tools that help small businesses take and track payments.', roadmap: [{ t: 'Research what businesses need', done: false }], releases: [] },
    { name: 'School systems', type: 'product', stage: 'planned', version: '', url: '', public: true, team: '', summary: 'Software that helps schools manage students, fees and results.', roadmap: [{ t: 'Talk to schools', done: false }], releases: [] },
    { name: 'Business management software', type: 'product', stage: 'planned', version: '', url: '', public: true, team: '', summary: 'Stock, sales and customers in one simple app for small businesses.', roadmap: [{ t: 'Choose the first feature', done: false }], releases: [] }
  ];
  var COLS = ['projects', 'labs', 'tickets', 'invoices', 'payments', 'activity'];

  function roleOf(u) { return u ? u.role : 'customer'; }
  Store.can = function (mod) {
    var u = Store.user; if (!u || !u.isAdmin) return false;
    if (mod === 'users') return u.role === 'owner' || u.role === 'admin';
    if (u.role === 'owner' || u.role === 'admin') return true;
    return (u.perms || []).indexOf(mod) >= 0;
  };

  /* ============================== DEMO BACKEND ============================== */
  var D = {
    get: function (k, d) { try { var v = localStorage.getItem('kt_demo_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('kt_demo_' + k, JSON.stringify(v)); } catch (e) { throw new Error('Browser storage is full or blocked.'); } },
    hash: function (s) { var h = 5381; for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; } return String(h); }
  };
  function isStaffRole(r) { return r === 'owner' || r === 'admin' || r === 'staff'; }
  function setDemoUser(id) {
    var u = D.get('users', []).find(function (x) { return x.uid === id; });
    if (!u || u.suspended) { Store.user = null; return; }
    Store.user = { uid: u.uid, name: u.name, email: u.email, role: u.role || 'customer', perms: u.perms || [], isAdmin: isStaffRole(u.role), isOwner: u.role === 'owner', adminRequested: !!u.adminRequested };
  }
  function demoInit() {
    if (!D.get('products')) D.set('products', Store.sampleProducts.map(function (p, i) { return Object.assign({ id: 'p' + (i + 1), updatedAt: Date.now() }, p); }));
    if (!D.get('col_labs')) D.set('col_labs', Store.sampleLabs.map(function (l) { return Object.assign({ id: 'l' + uid8(), createdAt: Date.now(), updatedAt: Date.now() }, l); }));
    var sid = D.get('session'); if (sid) setDemoUser(sid);
    return Promise.resolve();
  }
  function pubUser(u) { return { uid: u.uid, name: u.name, email: u.email, role: u.role || 'customer', perms: u.perms || [], suspended: !!u.suspended, adminRequested: !!u.adminRequested, createdAt: u.createdAt }; }
  function mapUser(uid, fn) { D.set('users', D.get('users', []).map(function (u) { return u.uid === uid ? fn(u) : u; })); }
  function need(mod) { return Store.can(mod) ? null : Promise.reject(new Error('You do not have permission to do that.')); }

  var demoApi = {
    signUp: function (name, email, password, wantAdmin) {
      var users = D.get('users', []); email = email.toLowerCase();
      if (users.some(function (u) { return u.email === email; })) return Promise.reject(new Error('An account with this email already exists. Try signing in.'));
      var first = !users.some(function (u) { return isStaffRole(u.role); });
      var u = { uid: 'u' + uid8(), name: name, email: email, pass: D.hash(password), role: (wantAdmin && first) ? 'owner' : 'customer', perms: [], suspended: false, adminRequested: !!(wantAdmin && !first), createdAt: Date.now() };
      users.push(u); D.set('users', users); D.set('session', u.uid); setDemoUser(u.uid); notify();
      return Promise.resolve(Store.user);
    },
    signIn: function (email, password) {
      var u = D.get('users', []).find(function (x) { return x.email === email.toLowerCase() && x.pass === D.hash(password); });
      if (!u) return Promise.reject(new Error('Email or password is incorrect.'));
      if (u.suspended) return Promise.reject(new Error('This account is suspended. Contact Kinton Technologies for help.'));
      D.set('session', u.uid); setDemoUser(u.uid); notify(); return Promise.resolve(Store.user);
    },
    signOut: function () { try { localStorage.removeItem('kt_demo_session'); } catch (e) {} Store.user = null; notify(); return Promise.resolve(); },
    resetPassword: function () { return Promise.resolve(); },

    listProducts: function (opts) { var all = D.get('products', []); return Promise.resolve(opts && opts.includeInactive ? all : all.filter(function (p) { return p.active !== false; })); },
    saveProduct: function (p) {
      var all = D.get('products', []);
      if (p.id) all = all.map(function (x) { return x.id === p.id ? Object.assign({}, x, p, { updatedAt: Date.now() }) : x; });
      else { p.id = 'p' + uid8(); p.updatedAt = Date.now(); all.push(p); }
      D.set('products', all); return Promise.resolve(p);
    },
    deleteProduct: function (id) { D.set('products', D.get('products', []).filter(function (x) { return x.id !== id; })); return Promise.resolve(); },
    seedProducts: function () { var all = D.get('products', []); Store.sampleProducts.forEach(function (p) { all.push(Object.assign({ id: 'p' + uid8(), updatedAt: Date.now() }, p)); }); D.set('products', all); return Promise.resolve(); },

    createOrder: function (o) {
      var all = D.get('orders', []); o.id = 'o' + uid8(); o.ref = orderRef(); o.status = 'new'; o.userId = Store.user.uid; o.createdAt = Date.now();
      all.push(o); D.set('orders', all); return Promise.resolve(o);
    },
    listMyOrders: function () { return Promise.resolve(D.get('orders', []).filter(function (o) { return o.userId === Store.user.uid; }).sort(byNewest)); },
    listAllOrders: function () { return Promise.resolve(D.get('orders', []).sort(byNewest)); },
    setOrderStatus: function (id, status) { D.set('orders', D.get('orders', []).map(function (o) { return o.id === id ? Object.assign({}, o, { status: status }) : o; })); return Promise.resolve(); },

    createInquiry: function (i) { var all = D.get('inquiries', []); i.id = 'i' + uid8(); i.createdAt = Date.now(); all.push(i); D.set('inquiries', all); return Promise.resolve(i); },
    listInquiries: function () { return Promise.resolve(D.get('inquiries', []).sort(byNewest)); },
    deleteInquiry: function (id) { D.set('inquiries', D.get('inquiries', []).filter(function (x) { return x.id !== id; })); return Promise.resolve(); },

    // generic admin collections
    colList: function (name) { return Promise.resolve(D.get('col_' + name, []).sort(byNewest)); },
    colSave: function (name, doc) {
      var all = D.get('col_' + name, []);
      if (doc.id) all = all.map(function (x) { return x.id === doc.id ? Object.assign({}, x, doc, { updatedAt: Date.now() }) : x; });
      else { doc = Object.assign({}, doc); delete doc.id; doc = Object.assign({ id: name[0] + uid8(), createdAt: Date.now(), updatedAt: Date.now() }, doc); all.push(doc); }
      D.set('col_' + name, all); return Promise.resolve(doc);
    },
    colRemove: function (name, id) { D.set('col_' + name, D.get('col_' + name, []).filter(function (x) { return x.id !== id; })); return Promise.resolve(); },
    listPublicLabs: function () { return Promise.resolve(D.get('col_labs', []).filter(function (l) { return l.public; }).sort(byNewest)); },
    listMyTickets: function () { return Promise.resolve(D.get('col_tickets', []).filter(function (t) { return t.userId === Store.user.uid; }).sort(byNewest)); },
    createTicket: function (t) { return demoApi.colSave('tickets', Object.assign({}, t, { userId: Store.user.uid, userName: Store.user.name || Store.user.email, userEmail: Store.user.email, status: 'open', replies: [] })); },
    replyTicketAsCustomer: function (id, replies) { D.set('col_tickets', D.get('col_tickets', []).map(function (t) { return t.id === id ? Object.assign({}, t, { replies: replies, status: 'open', updatedAt: Date.now() }) : t; })); return Promise.resolve(); },
    getContent: function () { return Promise.resolve(D.get('content', {})); },
    saveContent: function (c) { D.set('content', c); return Promise.resolve(); },

    // people
    listUsers: function () { return Promise.resolve(D.get('users', []).filter(function (u) { return !isStaffRole(u.role); }).map(pubUser)); },
    listStaff: function () { return Promise.resolve(D.get('users', []).filter(function (u) { return isStaffRole(u.role); }).map(pubUser)); },
    listAdminRequests: function () { return Promise.resolve(D.get('users', []).filter(function (u) { return u.adminRequested; }).map(pubUser)); },
    approveAdmin: function (uid) { mapUser(uid, function (u) { return Object.assign({}, u, { role: 'staff', perms: ['products', 'orders', 'tickets'], adminRequested: false }); }); return Promise.resolve(); },
    rejectAdmin: function (uid) { mapUser(uid, function (u) { return Object.assign({}, u, { adminRequested: false }); }); return Promise.resolve(); },
    createStaff: function (info) {
      var users = D.get('users', []); var email = info.email.toLowerCase();
      if (users.some(function (u) { return u.email === email; })) return Promise.reject(new Error('That email already has an account.'));
      var pw = tmpPassword();
      users.push({ uid: 'u' + uid8(), name: info.name, email: email, pass: D.hash(pw), role: info.role, perms: info.perms || [], suspended: false, createdAt: Date.now() });
      D.set('users', users); return Promise.resolve({ tempPassword: pw });
    },
    updateStaff: function (uid, patch) { mapUser(uid, function (u) { if (u.role === 'owner') return u; return Object.assign({}, u, { role: patch.role || u.role, perms: patch.perms || u.perms }); }); return Promise.resolve(); },
    setSuspended: function (kind, uid, v) { mapUser(uid, function (u) { return u.role === 'owner' ? u : Object.assign({}, u, { suspended: !!v }); }); return Promise.resolve(); },
    removeStaff: function (uid) { mapUser(uid, function (u) { return u.role === 'owner' ? u : Object.assign({}, u, { role: 'customer', perms: [] }); }); return Promise.resolve(); },
    ping: function () { var t = Date.now(); D.get('products'); return Promise.resolve(Date.now() - t); }
  };

  /* ============================== FIREBASE BACKEND ============================== */
  function ms(v) { return v && v.toMillis ? v.toMillis() : (typeof v === 'number' ? v : 0); }
  function docs(snap) { return snap.docs.map(function (d) { var x = d.data(); x.id = d.id; x.createdAt = ms(x.createdAt); x.updatedAt = ms(x.updatedAt); return x; }); }
  function ts() { return firebase.firestore.FieldValue.serverTimestamp(); }
  function friendly(e) {
    var m = {
      'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
      'auth/invalid-email': 'That email address does not look right.',
      'auth/weak-password': 'Choose a password with at least 8 characters.',
      'auth/invalid-credential': 'Email or password is incorrect.', 'auth/wrong-password': 'Email or password is incorrect.', 'auth/user-not-found': 'Email or password is incorrect.',
      'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No connection. Check your internet and try again.',
      'permission-denied': 'You do not have permission to do that.'
    };
    return new Error(m[e && e.code] || (e && e.message && /^(That|This|You)/.test(e.message) ? e.message : 'Something went wrong. Please try again.'));
  }
  function wrap(p) { return p.catch(function (e) { console.error(e); throw friendly(e); }); }
  function firebaseInit() {
    var base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    var files = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
    if (cfg.appCheckSiteKey) files.push('firebase-app-check-compat.js');
    return files.reduce(function (p, f) { return p.then(function () { return loadScript(base + f); }); }, Promise.resolve()).then(function () {
      firebase.initializeApp(fb);
      if (cfg.appCheckSiteKey) firebase.appCheck().activate(cfg.appCheckSiteKey, true);
      auth = firebase.auth(); db = firebase.firestore();
      return new Promise(function (resolve) {
        var first = true;
        auth.onAuthStateChanged(function (u) { loadProfile(u).then(function () { if (first) { first = false; resolve(); } notify(); }); });
      });
    });
  }
  function loadProfile(u) {
    if (!u) { Store.user = null; return Promise.resolve(); }
    var profile = {}, adm = null;
    return db.collection('users').doc(u.uid).get().then(function (d) { if (d.exists) profile = d.data(); }).catch(function () {})
      .then(function () { return db.collection('admins').doc(u.uid).get(); })
      .then(function (a) { if (a.exists) adm = a.data(); }).catch(function () {})
      .then(function () {
        var suspended = profile.suspended === true || (adm && adm.suspended === true);
        if (suspended) { Store.suspendedMsg = 'This account is suspended. Contact Kinton Technologies for help.'; Store.user = null; return auth.signOut(); }
        var role = adm ? (adm.role || 'staff') : 'customer';
        Store.user = { uid: u.uid, email: u.email, name: profile.name || (adm && adm.name) || '', role: role, perms: (adm && adm.perms) || [], isAdmin: !!adm, isOwner: role === 'owner', adminRequested: !!profile.adminRequested };
      });
  }
  function secondary() {
    var ex = firebase.apps.filter(function (a) { return a.name === 'kt-secondary'; })[0];
    if (ex) return ex;
    var a = firebase.initializeApp(fb, 'kt-secondary');
    if (cfg.appCheckSiteKey) firebase.appCheck(a).activate(cfg.appCheckSiteKey, true);
    return a;
  }

  var fbApi = {
    signUp: function (name, email, password, wantAdmin) {
      return wrap(auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
        return db.collection('users').doc(cred.user.uid).set({ name: name, email: email.toLowerCase(), adminRequested: !!wantAdmin, createdAt: ts() })
          .then(function () { return loadProfile(cred.user); }).then(function () { notify(); return Store.user; });
      }));
    },
    signIn: function (email, password) {
      Store.suspendedMsg = '';
      return wrap(auth.signInWithEmailAndPassword(email, password).then(function (c) { return loadProfile(c.user); }).then(function () {
        if (!Store.user) throw new Error(Store.suspendedMsg || 'Could not sign in.'); notify(); return Store.user;
      }));
    },
    signOut: function () { return wrap(auth.signOut()); },
    resetPassword: function (email) { return wrap(auth.sendPasswordResetEmail(email)); },

    listProducts: function (opts) { return wrap(db.collection('products').get().then(function (s) { var all = docs(s); return opts && opts.includeInactive ? all : all.filter(function (p) { return p.active !== false; }); })); },
    saveProduct: function (p) {
      var data = { name: p.name, category: p.category, price: p.price, description: p.description, image: p.image || '', featured: !!p.featured, active: p.active !== false, updatedAt: ts() };
      var ref = p.id ? db.collection('products').doc(p.id) : db.collection('products').doc();
      return wrap(ref.set(data).then(function () { p.id = ref.id; return p; }));
    },
    deleteProduct: function (id) { return wrap(db.collection('products').doc(id).delete()); },
    seedProducts: function () { var b = db.batch(); Store.sampleProducts.forEach(function (p) { b.set(db.collection('products').doc(), Object.assign({}, p, { updatedAt: ts() })); }); return wrap(b.commit()); },

    createOrder: function (o) {
      var ref = orderRef();
      var data = { ref: ref, userId: Store.user.uid, userName: o.userName, userEmail: o.userEmail, phone: o.phone, note: o.note, items: o.items, total: o.total, status: 'new', createdAt: ts() };
      return wrap(db.collection('orders').add(data).then(function (d) { return Object.assign({ id: d.id }, o, { ref: ref, status: 'new' }); }));
    },
    listMyOrders: function () { return wrap(db.collection('orders').where('userId', '==', Store.user.uid).get().then(function (s) { return docs(s).sort(byNewest); })); },
    listAllOrders: function () { return wrap(db.collection('orders').get().then(function (s) { return docs(s).sort(byNewest); })); },
    setOrderStatus: function (id, status) { return wrap(db.collection('orders').doc(id).update({ status: status })); },

    createInquiry: function (i) { i.createdAt = ts(); return wrap(db.collection('inquiries').add(i)); },
    listInquiries: function () { return wrap(db.collection('inquiries').get().then(function (s) { return docs(s).sort(byNewest); })); },
    deleteInquiry: function (id) { return wrap(db.collection('inquiries').doc(id).delete()); },

    colList: function (name) { return wrap(db.collection(name).limit(1000).get().then(function (s) { return docs(s).sort(byNewest); })); },
    colSave: function (name, doc) {
      var id = doc.id, data = Object.assign({}, doc); delete data.id; delete data.createdAt; data.updatedAt = ts();
      Object.keys(data).forEach(function (k) { if (data[k] === undefined) delete data[k]; });
      if (id) return wrap(db.collection(name).doc(id).set(data, { merge: true }).then(function () { return doc; }));
      data.createdAt = ts(); return wrap(db.collection(name).add(data).then(function (r) { doc.id = r.id; return doc; }));
    },
    colRemove: function (name, id) { return wrap(db.collection(name).doc(id).delete()); },
    listPublicLabs: function () { return wrap(db.collection('labs').where('public', '==', true).get().then(function (s) { return docs(s).sort(byNewest); })); },
    listMyTickets: function () { return wrap(db.collection('tickets').where('userId', '==', Store.user.uid).get().then(function (s) { return docs(s).sort(byNewest); })); },
    createTicket: function (t) {
      return wrap(db.collection('tickets').add({ userId: Store.user.uid, userName: Store.user.name || Store.user.email, userEmail: Store.user.email, subject: t.subject, message: t.message, priority: 'normal', status: 'open', replies: [], createdAt: ts(), updatedAt: ts() }));
    },
    replyTicketAsCustomer: function (id, replies) { return wrap(db.collection('tickets').doc(id).update({ replies: replies, status: 'open', updatedAt: ts() })); },
    getContent: function () { return db.collection('content').doc('site').get().then(function (d) { return d.exists ? d.data() : {}; }).catch(function () { return {}; }); },
    saveContent: function (c) { return wrap(db.collection('content').doc('site').set(c)); },

    listUsers: function () { return wrap(db.collection('users').get().then(function (s) { return docs(s).map(function (u) { return { uid: u.id, name: u.name, email: u.email, suspended: !!u.suspended, adminRequested: !!u.adminRequested, createdAt: u.createdAt }; }); })); },
    listStaff: function () { return wrap(db.collection('admins').get().then(function (s) { return docs(s).map(function (a) { return { uid: a.id, name: a.name || '', email: a.email || '', role: a.role || 'staff', perms: a.perms || [], suspended: !!a.suspended, createdAt: a.createdAt }; }); })); },
    listAdminRequests: function () { return wrap(db.collection('users').where('adminRequested', '==', true).get().then(function (s) { return docs(s).map(function (u) { return { uid: u.id, name: u.name, email: u.email, createdAt: u.createdAt }; }); })); },
    approveAdmin: function (uid) {
      return wrap(db.collection('users').doc(uid).get().then(function (d) {
        var u = d.data() || {}, b = db.batch();
        b.set(db.collection('admins').doc(uid), { name: u.name || '', email: u.email || '', role: 'staff', perms: ['products', 'orders', 'tickets'], suspended: false, createdAt: ts() });
        b.update(db.collection('users').doc(uid), { adminRequested: false });
        return b.commit();
      }));
    },
    rejectAdmin: function (uid) { return wrap(db.collection('users').doc(uid).update({ adminRequested: false })); },
    createStaff: function (info) {
      var pw = tmpPassword(), app2 = secondary(), a2 = app2.auth(), d2 = app2.firestore(), uid;
      return wrap(a2.createUserWithEmailAndPassword(info.email, pw).then(function (cred) {
        uid = cred.user.uid;
        return d2.collection('users').doc(uid).set({ name: info.name, email: info.email.toLowerCase(), adminRequested: false, createdAt: ts() });
      }).then(function () {
        return db.collection('admins').doc(uid).set({ name: info.name, email: info.email.toLowerCase(), role: info.role, perms: info.perms || [], suspended: false, createdAt: ts() });
      }).then(function () { return a2.signOut(); }).then(function () { return auth.sendPasswordResetEmail(info.email); }).then(function () { return { emailed: true }; }));
    },
    updateStaff: function (uid, patch) { var d = {}; if (patch.role) d.role = patch.role; if (patch.perms) d.perms = patch.perms; return wrap(db.collection('admins').doc(uid).update(d)); },
    setSuspended: function (kind, uid, v) { return wrap(db.collection(kind === 'staff' ? 'admins' : 'users').doc(uid).update({ suspended: !!v })); },
    removeStaff: function (uid) { return wrap(db.collection('admins').doc(uid).delete()); },
    ping: function () { var t = Date.now(); return db.collection('content').doc('site').get().then(function () { return Date.now() - t; }); }
  };

  /* ============================== PUBLIC API ============================== */
  var api = DEMO ? demoApi : fbApi;
  Object.keys(api).forEach(function (k) { Store[k] = api[k]; });
  // Safe wrappers for the generic admin collections (whitelisted names only)
  Store.col = function (name) {
    if (COLS.indexOf(name) < 0) throw new Error('Unknown collection');
    return { list: function () { return api.colList(name); }, save: function (d) { return api.colSave(name, d); }, remove: function (id) { return api.colRemove(name, id); } };
  };
  Store.log = function (text) {
    if (!Store.user || !Store.user.isAdmin) return Promise.resolve();
    return api.colSave('activity', { by: Store.user.name || Store.user.email, text: String(text).slice(0, 200) }).catch(function () {});
  };
  Store.seedLabs = function () { return Promise.all(Store.sampleLabs.map(function (l) { return api.colSave('labs', Object.assign({}, l)); })); };
  Store.ready = (DEMO ? demoInit() : firebaseInit()).catch(function (e) { console.error('Store init failed', e); Store.failed = true; });
  window.Store = Store;
})();
