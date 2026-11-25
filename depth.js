/* Kinton - light 3D reactions. Pointer tilt on the hero stage and cards. Off for reduced-motion. */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var stage = document.getElementById('stage');
  if (stage) {
    var host = stage.parentNode, raf = 0;
    function aim(x, y) {
      var r = host.getBoundingClientRect();
      var px = Math.max(-1, Math.min(1, (x - r.left) / r.width * 2 - 1)), py = Math.max(-1, Math.min(1, (y - r.top) / r.height * 2 - 1));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        stage.classList.add('live');
        stage.style.setProperty('--ry', (-14 + px * 12) + 'deg');
        stage.style.setProperty('--rx', (6 - py * 10) + 'deg');
      });
    }
    window.addEventListener('pointermove', function (e) { aim(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) aim(t.clientX, t.clientY); }, { passive: true });
  }
  // Cards, service tiles and team nodes lean gently toward the pointer.
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var el = e.target.closest && e.target.closest('.card, .svc, .org-node');
    document.querySelectorAll('.tilt').forEach(function (n) { if (n !== el) { n.classList.remove('tilt'); n.style.removeProperty('--tx'); n.style.removeProperty('--ty'); } });
    if (!el) return;
    var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    el.classList.add('tilt'); el.style.setProperty('--ty', (px * 6) + 'deg'); el.style.setProperty('--tx', (-py * 6) + 'deg');
  }, { passive: true });
  var pill = document.getElementById('ask-pill');
  if (pill) pill.addEventListener('click', function () { if (window.KintonGuide) window.KintonGuide.open(); });
})();
