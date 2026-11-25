/* Kinton Technologies - admin: Team (the people shown on the About and Home pages). */
(function () {
  'use strict';
  var KT = window.KT, E = KT.esc, say = KT.say, $ = KT.$;
  var MAX_PEOPLE = 8, MAX_PHOTO = 150000;

  var DEFAULT_MEMBERS = [
    { name: 'Tanaka Shanon Mujikijera', role: 'Founder and CEO', bio: '', photo: '', tier: 1 },
    { name: 'Denzel Mangani', role: 'Co-founder', bio: '', photo: '', tier: 1 }
  ];

  // Centre-crops to a square and shrinks it, so photos stay small enough to store.
  function squarePhoto(file) {
    return new Promise(function (res, rej) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Use a JPG, PNG or WebP photo.'));
      if (file.size > 8 * 1024 * 1024) return rej(new Error('That photo is over 8 MB. Choose a smaller one.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var side = Math.min(img.width, img.height), size = Math.min(480, side), c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        var q = 0.82, out = c.toDataURL('image/jpeg', q);
        while (out.length > MAX_PHOTO && q > 0.4) { q -= 0.08; out = c.toDataURL('image/jpeg', q); }
        out.length > MAX_PHOTO ? rej(new Error('That photo is too detailed to store. Try another one.')) : res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That file could not be read as a photo.')); };
      img.src = url;
    });
  }

  function initials(n) { return String(n || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }

  KT.registerAdmin({ key: 'team', title: 'Team (About page)', order: 72, perm: 'content', render: function (panel, ctx) {
    Store.getTeam().then(function (t) {
      var saved = ((t || {}).members || []);
      var members = (saved.length ? saved : DEFAULT_MEMBERS).map(function (m) { return { name: m.name || '', role: m.role || '', bio: m.bio || '', photo: m.photo || '', tier: [1,2,3].indexOf(+m.tier) > -1 ? +m.tier : 1 }; });

      function card(m, i) {
        var pic = KT.safeImg(m.photo);
        return '<article class="row-card" data-i="' + i + '">' +
          '<header><h3>' + E(m.name || 'New person') + '</h3><span class="meta">Person ' + (i + 1) + '</span></header>' +
          '<div class="team-edit"><div class="team-edit-photo">' + (pic ? '<img src="' + E(pic) + '" alt="Photo of ' + E(m.name) + '">' : '<span aria-hidden="true">' + E(initials(m.name)) + '</span>') + '</div>' +
          '<div class="field"><label for="t-file-' + i + '">Photo</label><input id="t-file-' + i + '" data-photo="' + i + '" type="file" accept="image/jpeg,image/png,image/webp"><div class="hint">Cropped to a square and resized for you.</div>' +
          (pic ? '<button class="link-btn danger" type="button" data-nophoto="' + i + '">Remove photo</button>' : '') + '</div></div>' +
          '<div class="form-grid">' +
          '<div class="field"><label for="t-name-' + i + '">Full name</label><input id="t-name-' + i + '" data-k="name" data-i="' + i + '" type="text" maxlength="80" value="' + E(m.name) + '"></div>' +
          '<div class="field"><label for="t-role-' + i + '">Role</label><input id="t-role-' + i + '" data-k="role" data-i="' + i + '" type="text" maxlength="80" value="' + E(m.role) + '" placeholder="e.g. Founder and CEO"></div>' +
          '<div class="field"><label for="t-tier-' + i + '">Level in the hierarchy</label><select id="t-tier-' + i + '" data-k="tier" data-i="' + i + '"><option value="1"' + (+m.tier === 1 ? ' selected' : '') + '>1 - Leadership (top)</option><option value="2"' + (+m.tier === 2 ? ' selected' : '') + '>2 - Team leads</option><option value="3"' + (+m.tier === 3 ? ' selected' : '') + '>3 - Team members</option></select></div>' +
          '<div class="field full"><label for="t-bio-' + i + '">About this person</label><textarea id="t-bio-' + i + '" data-k="bio" data-i="' + i + '" maxlength="600" style="min-height:7rem" placeholder="A few lines: what they do, what they have built, what they care about.">' + E(m.bio) + '</textarea></div></div>' +
          '<div class="row-actions">' +
          '<button class="btn btn-line btn-sm" type="button" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + '>Move up</button>' +
          '<button class="btn btn-line btn-sm" type="button" data-down="' + i + '"' + (i === members.length - 1 ? ' disabled' : '') + '>Move down</button>' +
          '<button class="link-btn danger" type="button" data-del="' + i + '">Remove</button></div></article>';
      }

      function paint() {
        panel.innerHTML = '<p class="muted" style="margin-top:0">The people shown on the <a href="about.html" target="_blank" rel="noopener">About page</a> and the home page. Add a photo, a short bio and a level in the hierarchy for each person, then press Save. The order here is the order on the site.</p>' +
          '<div class="list">' + members.map(card).join('') + '</div>' +
          '<div class="cta-row" style="margin-top:1.2rem"><button class="btn" type="button" id="t-save">Save team</button>' +
          '<button class="btn btn-line" type="button" id="t-add"' + (members.length >= MAX_PEOPLE ? ' disabled' : '') + '>Add a person</button></div><div id="t-msg" class="msg" role="alert"></div>';
      }

      function msg(text, kind) { say($('#t-msg'), text, kind); }

      panel.oninput = function (e) {
        var k = e.target.dataset.k, i = e.target.dataset.i;
        if (k && i != null) members[+i][k] = e.target.value;
      };
      panel.onchange = function (e) {
        var idx = e.target.dataset.photo; if (idx == null) return;
        var f = e.target.files[0]; if (!f) return;
        squarePhoto(f).then(function (data) { members[+idx].photo = data; paint(); }).catch(function (err) { e.target.value = ''; msg(err.message); });
      };
      panel.onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var d = b.dataset;
        if (b.id === 't-add') { members.push({ name: '', role: '', bio: '', photo: '', tier: 3 }); paint(); return; }
        if (d.nophoto != null) { members[+d.nophoto].photo = ''; paint(); return; }
        if (d.up != null || d.down != null) {
          var i = +(d.up != null ? d.up : d.down), j = d.up != null ? i - 1 : i + 1;
          if (j < 0 || j >= members.length) return;
          var tmp = members[i]; members[i] = members[j]; members[j] = tmp; paint(); return;
        }
        if (d.del != null) { if (confirm('Remove this person from the site?')) { members.splice(+d.del, 1); paint(); } return; }
        if (b.id === 't-save') {
          var clean = members.map(function (m) { return { name: m.name.trim().slice(0, 80), role: m.role.trim().slice(0, 80), bio: m.bio.trim().slice(0, 600), photo: m.photo, tier: [1,2,3].indexOf(+m.tier) > -1 ? +m.tier : 1 }; });
          if (clean.some(function (m) { return !m.name; })) return msg('Every person needs a name. Fill it in or remove the empty card.');
          b.disabled = true;
          Store.saveTeam({ members: clean }).then(function () {
            Store.log('Updated team on the About page');
            KT.toast('Team saved');
            msg('Saved. Reload the About page to see it.', 'ok');
            b.disabled = false;
          }).catch(function (err) { msg(err.message); b.disabled = false; });
        }
      };
      paint();
    }).catch(ctx.fail);
  } });
})();
