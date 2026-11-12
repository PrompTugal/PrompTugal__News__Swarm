// One navigation for every swarm page (Dinis, 07:10 UTC: "you need to have a common navigation across the board ...
// whenever I go out and maximize, I can always go back"). swarm.1.designer.fringe@PrompTugal.dinis, 12 Nov 2026 (WS-215).
// <script src="assets/nav.js"></script> at the end of <body> (or ../assets/nav.js from pages/).
//   default: a bar across the top of the page.
//   <body data-nav="float">: a small "Swarm" pill fixed top-left that opens the menu, for full-screen pages (the stage);
//   it stays visible in focus mode and offers the way out of it.
// Links that only change the hash re-route: the page reloads at the new hash ("it didn't refresh because ... it's a hash").
(function () {
  'use strict';
  if (window.self !== window.top) return;   // inside a preview frame (the hub's boxes): no navigation
  const me = document.currentScript && document.currentScript.src;
  const root = me ? new URL('..', me).href : new URL('./', location.href).href;   // assets/nav.js → the site root
  const ITEMS = [
    ['index.html', 'Home', 'The main areas'],
    ['stage.html#pack=main&brisk', 'Present the story', 'Nine scenes, one press each'],
    ['pages/stories.html', 'Stories', 'Made live: the deck, and how it was made'],
    ['pages/theme.html', 'Themes', 'Five themes, five demos each, with what to say'],
    ['pages/packs.html', 'Demo packs', 'One idea per step'],
    ['pages/views.html', 'Views', 'One run, six ways to see it'],
    ['pages/flow.html', 'Execution flow', 'The ladder of real runs'],
    ['how.html', 'The GitHub flow', 'How work moves through the swarm'],
    ['pages/harness.html', 'The harness', 'Agents under SHarness (early beta)'],
    ['pages/map.html', 'The map', 'What we planned, rung by rung'],
  ];
  const here = location.pathname.replace(/\/$/, '/index.html');
  const isHere = (href) => new URL(href.split('#')[0], root).pathname.replace(/\/$/, '/index.html') === here;
  const css = `
.swnav{position:relative;z-index:50;display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;padding:10px 16px;border-bottom:1px solid var(--line,#1E3A37);background:var(--bg,#04100F);font:14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.swnav .brand{font-weight:700;color:var(--ink,#EAF6F3);text-decoration:none;margin-right:8px;letter-spacing:.01em}
.swnav a{color:var(--muted,#8DB3AC);text-decoration:none;white-space:nowrap}.swnav a:hover,.swnav a[aria-current="page"]{color:var(--ink,#EAF6F3)}
.swnav a[aria-current="page"]{box-shadow:inset 0 -2px 0 var(--a3,#5ec2ff)}
.swnav .ind{margin-left:auto;font-size:12px;color:var(--muted,#8DB3AC)}
.swnav .mbtn{display:none}
.swnav>a{padding:13px 2px}.swnav{padding-top:0!important;padding-bottom:0!important}@media (pointer:coarse){.swpill>button{min-height:44px;padding:10px 14px}.swpill .menu a,.swpill .menu button{padding:12px 12px}}
@media (max-width:760px){.swnav{gap:0 14px;padding:4px 12px;font-size:15px}.swnav .ind{display:none}.swnav .brand{padding:12px 0}
.swnav .mbtn{display:block;margin-left:auto;font:600 14px/1 system-ui,sans-serif;color:var(--ink,#EAF6F3);background:none;border:1px solid var(--line,#1E3A37);border-radius:9px;padding:0 14px;min-height:44px;cursor:pointer}
.swnav .here{color:var(--ink,#EAF6F3);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45vw}
.swnav>a:not(.brand){display:none}.swnav.open>a:not(.brand){display:block;flex:1 1 100%;padding:12px 4px;border-top:1px solid var(--line,#1E3A37)}.swnav.open .here{display:none}}
@media (min-width:761px){.swnav .here{display:none}}
.swpill{position:fixed;z-index:9999;top:8px;left:8px;font:600 13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.swpill>button{display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--ink,#EAF6F3);background:color-mix(in srgb,var(--panel-solid,#0b2826) 92%,transparent);border:1px solid var(--line,#1E3A37);border-radius:9px;padding:7px 10px;opacity:.9}
.swpill>button:hover,.swpill.open>button{opacity:1;border-color:var(--accent,#43D9C6)}
html.focus .swpill>button{opacity:.35}html.focus .swpill>button:hover,html.focus .swpill.open>button{opacity:1}
.swpill .menu{display:none;margin-top:6px;min-width:260px;background:var(--panel-solid,#0b2826);border:1px solid var(--line,#1E3A37);border-radius:10px;padding:6px;box-shadow:0 12px 40px #000a}
.swpill.open .menu{display:block}.swpill .menu a,.swpill .menu button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:7px;color:var(--ink,#EAF6F3);text-decoration:none;background:none;border:0;font:inherit;cursor:pointer}
.swpill .menu a small{display:block;color:var(--muted,#8DB3AC);font-weight:400;font-size:12px;margin-top:2px}.swpill .menu a:hover,.swpill .menu button:hover{background:color-mix(in srgb,var(--accent,#43D9C6) 14%,transparent)}
.swpill .menu a[aria-current="page"]{color:var(--accent,#43D9C6)}.swpill .menu .exit{color:var(--accent,#43D9C6);border-bottom:1px solid var(--line,#1E3A37);border-radius:7px 7px 0 0;margin-bottom:4px}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const link = ([href, label, sub], withSub) => `<a href="${root}${href}"${isHere(href) ? ' aria-current="page"' : ''}>${label}${withSub ? `<small>${sub}</small>` : ''}</a>`;

  if (document.body.dataset.nav === 'float') {
    const p = document.createElement('div'); p.className = 'swpill';
    p.innerHTML = `<button type="button" aria-haspopup="true" aria-expanded="false" title="All the swarm's pages">☰ Swarm</button><div class="menu" role="menu"><button type="button" class="exit" hidden>✕ Leave focus / full screen</button>${ITEMS.map((i) => link(i, true)).join('')}</div>`;
    document.body.appendChild(p);
    const btn = p.querySelector('button'), exit = p.querySelector('.exit');
    const set = (on) => { p.classList.toggle('open', on); btn.setAttribute('aria-expanded', on); const out = document.documentElement.classList.contains('focus') || document.body.classList.contains('present') || !!document.fullscreenElement; exit.hidden = !out; };
    btn.onclick = (e) => { e.stopPropagation(); set(!p.classList.contains('open')); };
    exit.onclick = () => { document.documentElement.classList.remove('focus'); document.body.classList.remove('present'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); set(false); dispatchEvent(new Event('resize')); };
    document.addEventListener('click', (e) => { if (!p.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  } else {
    const n = document.createElement('nav'); n.className = 'swnav'; n.setAttribute('aria-label', 'The swarm');
    const cur = ITEMS.find(([h]) => isHere(h));
    n.innerHTML = `<a class="brand" href="${root}index.html">Swarm</a><span class="here">${cur && cur[0] !== 'index.html' ? '· ' + cur[1] : ''}</span><button type="button" class="mbtn" aria-expanded="false">☰ Menu</button>${ITEMS.slice(1).map((i) => link(i, false)).join('')}<span class="ind">Independent of Web Summit</span>`;
    document.body.insertBefore(n, document.body.firstChild);
    const mb = n.querySelector('.mbtn'); mb.onclick = () => { const o = n.classList.toggle('open'); mb.setAttribute('aria-expanded', o); mb.textContent = o ? '✕ Close' : '☰ Menu'; };
  }

  // a link that only changes the hash of this same page: go there and reload, so the page routes to it
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const u = new URL(a.href, location.href);
    if (u.origin === location.origin && u.pathname === location.pathname && u.search === location.search && u.hash && u.hash !== location.hash) { e.preventDefault(); location.href = u.href; location.reload(); }
  }, true);
})();
