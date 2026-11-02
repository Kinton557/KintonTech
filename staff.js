(function(){
  const cfg = window.STAFF_CONFIG;
  firebase.initializeApp(cfg.firebase);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const $ = id => document.getElementById(id);
  let api = null, timerId = null, stopGroups = null, pending = null;

  const isAdmin = u => cfg.adminEmails.map(e => e.toLowerCase()).includes((u.email || "").toLowerCase());
  const nameOf = u => u.displayName || u.email.split("@")[0];
  const initial = s => (s || "?").trim().charAt(0).toUpperCase();
  const hue = s => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  let toastTimer;
  function toast(msg){
    const t = $("toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 3200);
  }

  function showLogin(){
    $("loginView").classList.remove("hide");
    $("groupsView").classList.add("hide");
    $("who").classList.add("hide");
  }
  function showGroups(user){
    $("loginView").classList.add("hide");
    $("groupsView").classList.remove("hide");
    $("who").classList.remove("hide");
    $("meAvatar").textContent = initial(nameOf(user));
    $("hello").textContent = "Hi, " + nameOf(user);
    $("adminBox").classList.toggle("hide", !isAdmin(user));
  }

  async function login(){
    const btn = $("loginBtn");
    $("loginErr").textContent = "";
    btn.disabled = true;
    try{
      await auth.signInWithEmailAndPassword($("email").value.trim(), $("password").value);
    }catch(e){
      $("loginErr").textContent = e.code === "auth/network-request-failed"
        ? "No internet connection. Check your data and try again."
        : "Email or password is wrong. Ask the admin to check your account.";
    }
    btn.disabled = false;
  }
  $("loginBtn").onclick = login;
  $("password").addEventListener("keydown", e => { if(e.key === "Enter") login(); });
  $("logoutBtn").onclick = () => auth.signOut();

  function renderGroups(snap, user){
    const list = $("groupList");
    list.innerHTML = "";
    if(snap.empty){
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = isAdmin(user) ? "No groups yet. Create the first one above." : "No groups yet. The admin will add one soon.";
      list.append(p);
      return;
    }
    snap.forEach(doc => {
      const g = doc.data();
      const card = document.createElement("div");
      card.className = "card";

      const head = document.createElement("div");
      head.className = "card-head";
      const av = document.createElement("span");
      av.className = "avatar";
      av.style.background = "hsl(" + hue(g.name) + " 55% 45%)";
      av.textContent = initial(g.name);
      const text = document.createElement("div");
      const nm = document.createElement("div");
      nm.className = "card-name"; nm.textContent = g.name;
      const meta = document.createElement("div");
      meta.className = "card-meta"; meta.textContent = "Created by " + (g.createdBy || "admin").split("@")[0];
      text.append(nm, meta);
      head.append(av, text);

      const actions = document.createElement("div");
      actions.className = "card-actions";
      const join = document.createElement("button");
      join.className = "primary"; join.textContent = "Join call";
      join.onclick = () => openJoin(doc.id, g.name);
      actions.append(join);
      if(isAdmin(user)){
        const del = document.createElement("button");
        del.className = "del"; del.textContent = "Delete";
        del.onclick = async () => {
          if(!confirm('Delete the group "' + g.name + '"?')) return;
          try{ await db.collection("groups").doc(doc.id).delete(); toast("Group deleted"); }
          catch(e){ toast("Could not delete. Check the Firestore rules."); }
        };
        actions.append(del);
      }
      card.append(head, actions);
      list.append(card);
    });
  }

  $("createBtn").onclick = async () => {
    const name = $("groupName").value.trim();
    if(!name){ toast("Type a group name first"); return; }
    try{
      await db.collection("groups").add({
        name, createdBy: auth.currentUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      $("groupName").value = "";
      toast("Group created");
    }catch(e){ toast("Could not create the group. Check the Firestore rules."); }
  };

  function openJoin(id, name){
    pending = { id, name };
    $("joinTitle").textContent = name;
    $("joinDialog").showModal();
  }
  $("joinCancel").onclick = () => $("joinDialog").close();
  $("joinGo").onclick = () => { $("joinDialog").close(); startCall(); };

  function startCall(){
    const user = auth.currentUser;
    const saver = $("optSaver").checked;
    $("callTitle").textContent = pending.name;
    $("callView").classList.remove("hide");
    const started = Date.now();
    clearInterval(timerId);
    timerId = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      $("callTimer").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }, 1000);

    api = new JitsiMeetExternalAPI(cfg.jitsiDomain, {
      roomName: "kinton-staff-" + pending.id,
      parentNode: $("callFrame"),
      width: "100%", height: "100%",
      userInfo: { displayName: nameOf(user), email: user.email },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: !$("optMic").checked,
        startWithVideoMuted: !$("optCam").checked,
        resolution: saver ? 360 : 720,
        constraints: { video: { height: saver ? { ideal: 360, max: 480 } : { ideal: 720, max: 720 } } },
        disableDeepLinking: true,
        toolbarButtons: ["microphone", "camera", "chat", "raisehand", "tileview", "participants-pane", "desktop", "hangup"]
      },
      interfaceConfigOverwrite: { MOBILE_APP_PROMO: false, SHOW_JITSI_WATERMARK: false }
    });
    api.addListener("readyToClose", endCall);
  }

  function endCall(){
    clearInterval(timerId);
    if(api){ api.dispose(); api = null; }
    $("callView").classList.add("hide");
    $("callTimer").textContent = "00:00";
  }
  $("leaveBtn").onclick = endCall;

  auth.onAuthStateChanged(user => {
    if(stopGroups){ stopGroups(); stopGroups = null; }
    if(!user){ endCall(); showLogin(); return; }
    showGroups(user);
    stopGroups = db.collection("groups").orderBy("createdAt").onSnapshot(
      snap => renderGroups(snap, user),
      () => toast("Could not load groups. Check the Firestore rules.")
    );
  });
})();
