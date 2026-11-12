// Booth mode for the stand's tablets (Dinis ~07:50 UTC via swarm.1: "people will just grab the tablet and go").
// swarm.1.designer.fringe@PrompTugal.dinis, 12 Nov 2026 (WS-215). After X-Ray's ?booth=1 (web-summit.sgit.ai/xray).
//   ?booth=1 turns it on (and it stays on for the tab, across pages); ?booth=0 turns it off.
//   html.booth: larger type, bigger touch targets. The first touch asks for full screen (where the browser allows it).
//   After 60 s with no touch: the attract loop, the best stories played one after another (story.html?attract=1).
//   Any touch during the attract loop goes back to the start (the hub).
(function () {
  'use strict';
  if (window.self !== window.top) return;
  const q = new URLSearchParams(location.search);
  let on = false;
  try { if (q.get('booth') === '1') sessionStorage.setItem('booth', '1'); if (q.get('booth') === '0') sessionStorage.removeItem('booth'); on = sessionStorage.getItem('booth') === '1'; } catch (e) { on = q.get('booth') === '1'; }
  if (!on) return;
  const me = document.currentScript && document.currentScript.src, root = me ? new URL('..', me).href : new URL('./', location.href).href;
  const html = document.documentElement; html.classList.add('booth');
  const st = document.createElement('style');
  st.textContent = `html.booth{font-size:112%;-webkit-tap-highlight-color:transparent}html.booth body{overscroll-behavior:none}
html.booth .swnav{font-size:16px;gap:0 18px}
html.booth button,html.booth .seg button{min-height:44px}
.booth-attract{position:fixed;z-index:10000;left:50%;bottom:22px;transform:translateX(-50%);font:600 15px/1 system-ui,sans-serif;color:var(--bg,#04100F);background:var(--accent,#43D9C6);border-radius:999px;padding:12px 20px;box-shadow:0 8px 30px #0008;animation:booth-pulse 2.4s ease-in-out infinite;pointer-events:none}
@keyframes booth-pulse{50%{transform:translateX(-50%) scale(1.05)}}`;
  document.head.appendChild(st);

  const attract = q.get('attract') === '1';
  const home = root + 'index.html';
  if (attract) {
    const tag = document.createElement('div'); tag.className = 'booth-attract'; tag.textContent = 'Touch anywhere to start'; document.body.appendChild(tag);
    const back = (e) => { e.preventDefault(); e.stopPropagation(); location.href = home; };
    ['pointerdown', 'keydown'].forEach((k) => addEventListener(k, back, { capture: true, once: true }));
    return;
  }
  // full screen on the first touch (a gesture is required); iPad Safari may refuse, which is fine
  const fs = () => { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; if (f && !document.fullscreenElement) try { const p = f.call(el); p && p.catch && p.catch(() => {}); } catch (e) {} };
  addEventListener('pointerdown', fs, { once: true, capture: true });
  // the idle timer (off on pages that ask for it, e.g. the Studio: a visitor may speak for a minute without touching)
  if (document.currentScript && document.currentScript.dataset.idle === 'off') { window.SwarmBooth = { on: true, home }; return; }
  let t = null; const IDLE = +(q.get('idle') || 60) * 1000;
  const go = () => { location.href = root + 'pages/story.html?attract=1&booth=1&m=present'; };
  const arm = () => { clearTimeout(t); t = setTimeout(go, IDLE); };
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((k) => addEventListener(k, arm, { passive: true, capture: true }));
  arm();
  window.SwarmBooth = { on: true, home, arm };
})();
