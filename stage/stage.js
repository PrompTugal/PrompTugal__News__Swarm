// The stage: the swarm's runs as a presentation, scene by scene and step by step.
// swarm.1.dev.fringe@PrompTugal.dinis, 12 Nov 2026, at Dinis's word (01:2x UTC): "start, stop, move, zoom in, move out, and
// also focus completely, minimize things on the left, on the right, resize everything ... every scene needs to tell a story."
//
// The clock is the Ultimate Insider talk player's (SGit-AI__Website__Presentation__The-Ultimate-Insider, talk/player.html):
// every step has a start and an end; → plays the next step from its start and holds on its built end; ← lands on the
// previous stop, which is the END of the previous step (and, across scenes, the end of the previous scene), "or else you
// can never get the full loop". Space plays on through everything.
//
// Scenes are data (stage/scenes.json). A step is cumulative: its state is every earlier step of its scene, fully applied,
// plus its own at progress p (0..1). What a step can say: see applyStep() and stage/README.md.
// Numbers on screen come from the run files (runs/*.json here, results in PrompTugal__News__Swarm__Runs, its summary.json);
// what is simulated says so on screen.
/* global d3 */
(() => {
  'use strict';
  const RUNS_REPO = 'PrompTugal/PrompTugal__News__Swarm__Runs';
  const RAW = (p) => `https://raw.githubusercontent.com/${RUNS_REPO}/dev/runs/${p}`;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const Q = new URLSearchParams(location.search);
  const store = { get(k, d) { try { const v = localStorage.getItem('stage.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('stage.' + k, JSON.stringify(v)); } catch {} } };

  // ---------- altitudes: the order top to bottom, and their names
  const ALT = ['P', 'A4', 'T', 'A3', 'C', 'E', 'A2', 'A1', 'A0', 'M', 'D', 'X'];
  const ALT_NAME = { P: 'person', A4: 'A4 swarm', T: 'task / packet', A3: 'A3 agent', A2: 'A2 loop', A1: 'A1 LLM call', A0: 'A0 code', M: 'model provider', D: 'dataset', X: 'asset', C: 'commit', E: 'environment' };
  const altIx = (a) => { const i = ALT.indexOf(a); return i < 0 ? ALT.length : i; };
  const ALT_R = { P: 11, A4: 13, T: 7, A3: 12, A2: 8, A1: 5.5, A0: 4.5, M: 10, D: 7, X: 12, C: 7, E: 9 };

  // ---------- knobs (kept per viewer)
  const K = Object.assign({ mode: 'layers', theme: 'gravity', text: 1, label: 1, node: 1, link: 1, labels: true, anchors: true, rate: 1, left: 260, right: 300, hideL: false, hideR: false, auto: false, brisk: false, userAnchors: {}, vmode: 'neon', vlayout: 'down' }, store.get('knobs', {}));
  if (/[#&?]brisk\b/.test(location.hash + '&' + location.search)) K.brisk = true;   // stage.html#pack=main&brisk
  if (Q.get('mode')) K.mode = Q.get('mode');
  if (Q.get('theme')) K.theme = Q.get('theme');
  const saveK = () => store.set('knobs', K);

  // ---------- state
  let SCENES = [], STEPS = [], TOTAL = 0;     // flattened steps: {scene, si, i, s, e, step}
  let t = 0, playing = false, stopAt = null, lastFrame = performance.now();
  let curScene = -1, G = null;               // G: the graph of the current scene (nodes, links, run)
  const runCache = new Map();
  const extraHidden = new Set(store.get('hiddenAlts', []));   // altitudes the presenter switched off in the legend
  let focusId = null;                        // a node the presenter double-clicked: its neighbourhood stays bright

  // ---------- data: a run, normalised to a graph
  async function loadRun(src) {
    if (!src) return { nodes: [], links: [], byId: new Map(), timeline: [], T: 1, metrics: {}, run: {}, title: '', error: null, sim: false };
    if (runCache.has(src)) return runCache.get(src);
    let p;
    if (src.startsWith('sim:')) p = Promise.resolve(simulated(src.slice(4)));
    else if (src.startsWith('agents:')) p = Promise.all([fetch(src.slice(7), { cache: 'no-store' }).then((r) => r.json()), fetch('data/agent-activity.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)]).then(([a, act]) => agentsGraph(a, act));
    else if (src.startsWith('gh:')) p = fetch(RAW(src.slice(3) + '/result.json'), { cache: 'no-store' }).then((r) => r.json()).then((j) => ({ ...j.body, signed_by: j.by && j.by.fp, source: 'github' }));
    else p = fetch('runs/' + src).then((r) => r.json());
    p = p.then(normalise).catch((e) => ({ error: String(e.message || e), nodes: [], links: [], byId: new Map(), timeline: [], T: 1, metrics: {} }));
    runCache.set(src, p);
    return p;
  }
  function normalise(r) {
    const nodes = (r.nodes || []).map((n) => ({ ...n, alt: n.altitude || '?', sim: !!n.sim }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links = (r.edges || []).filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => ({ source: e.from, target: e.to, kind: e.kind, sim: !!e.sim }));
    // first start and last end of every unit, in run time (ms), for replays
    const tl = r.timeline || []; let T = 1;
    for (const ev of tl) { const n = byId.get(ev.unit); if (!n) continue; if (ev.phase === 'start' && n.t0 == null) n.t0 = ev.t; if (ev.phase === 'end') n.t1 = ev.t; T = Math.max(T, ev.t); }
    // units with no event (people, datasets, providers) appear with the first unit that touches them
    for (const n of nodes) if (n.t0 == null) { const touch = links.filter((l) => l.target === n.id || l.source === n.id).map((l) => byId.get(l.source === n.id ? l.target : l.source).t0).filter((x) => x != null); n.t0 = touch.length ? Math.min(...touch) : 0; }
    for (const c of r.calls || []) { const n = byId.get(c.unit); if (n) Object.assign(n, { valid: c.valid, cost: c.cost_usd, model: c.served || c.model, tokens: (c.tokens_in || 0) + (c.tokens_out || 0) }); }
    // a spanning tree for the tree layouts: each node's first parent by edge order, people and agents first
    const parent = new Map();
    const ancestor = (a, b) => { for (let x = a, i = 0; x && i < 1e4; x = parent.get(x), i++) if (x === b) return true; return false; };
    for (const l of links) if (!parent.has(l.target) && l.target !== l.source && altIx(byId.get(l.source).alt) <= altIx(byId.get(l.target).alt) && !ancestor(l.source, l.target)) parent.set(l.target, l.source);
    for (const n of nodes) n.parent = parent.get(n.id) || null;
    return { run: r, title: r.title || r.id, nodes, links, byId, timeline: tl, T, metrics: r.metrics || {}, sim: !!r.sim, error: null };
  }

  // data/agents.json (swarm.1's snapshot of the real session tree): agents become nodes, parent sessions become edges, and
  // each agent's start time becomes its timeline, so a replay shows the team being built over the day
  function agentsGraph(j, act) {
    const A = j.agents || [], id = (a) => a.session || a.name, t = (a) => (a.started ? Date.parse(a.started) : NaN);
    const ts = A.map(t).filter(Number.isFinite), t0 = ts.length ? Math.min(...ts) : 0;
    const nodes = A.map((a) => ({ id: id(a), kind: a.altitude === 'P' ? 'person' : a.altitude === 'A0' ? 'compute' : 'agent', altitude: a.altitude || 'A3', label: a.name, role: a.role, wake: a.wake, started: a.started }));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = A.filter((a) => a.parent && ids.has(a.parent)).map((a) => ({ from: a.parent, to: id(a), kind: 'starts' }));
    const timeline = A.filter((a) => Number.isFinite(t(a))).map((a) => ({ t: (t(a) - t0) / 1000, unit: id(a), phase: 'start' }));
    // commits per agent (data/agent-activity.json, from the git logs): each node's size and its counter
    const A2 = new Map(((act && act.agents) || []).map((x) => [x.agent, x]));
    for (const n of nodes) { const x = A2.get(n.label); if (x) { n.commits = x.commits; n.lastCommit = x.last; } }
    const counts = act ? { commits_24h: act.commits, named_by_agent: act.named, agents_committing: act.agents_named, read_at: act.updated } : j.counts_last_24h;
    return { id: 'agents', title: 'Who is building this demo tonight', story: j.about, nodes, edges, timeline, metrics: {}, environment: { label: 'the session tree, ' + (j.updated || '') + (act ? ' · commits from the git logs, ' + act.updated : '') }, counts };
  }

  // simulated graphs, for the stories the runs cannot show (Dinis, 01:18: "it's okay ... a couple simulated scenarios"):
  // every node and edge carries sim:true and the page says "simulated" while one is on screen
  const ASSETS = ['Gmail', 'Calendar', 'Drive', 'Slack', 'Zapier', 'GitHub', 'Database'];
  function simulated(kind) {
    const nodes = [{ id: 'person', kind: 'person', altitude: 'P', label: 'You', sim: true }], edges = [];
    const nA = kind === 'mesh10' ? 10 : 5;
    for (let i = 1; i <= nA; i++) { nodes.push({ id: 'agent' + i, kind: 'agent', altitude: 'A3', label: 'agent ' + i, sim: true }); edges.push({ from: 'person', to: 'agent' + i, kind: 'runs', sim: true }); }
    ASSETS.forEach((a, j) => nodes.push({ id: 'asset:' + a, kind: 'asset', altitude: 'X', label: a, sim: true, home: 'agent' + ((j % nA) + 1) }));
    if (kind === 'mesh' || kind === 'mesh10') { for (let i = 1; i <= nA; i++) for (const a of ASSETS) edges.push({ from: 'agent' + i, to: 'asset:' + a, kind: 'reach', sim: true }); }
    else for (const a of ASSETS) { const n = nodes.find((x) => x.id === 'asset:' + a); edges.push({ from: n.home, to: n.id, kind: 'reach', sim: true }); }
    return { id: 'sim:' + kind, title: kind === 'policy' ? 'Simulated: one agent per asset' : `Simulated: ${nA} agents, every one wired to everything`, nodes, edges, timeline: [], sim: true, metrics: {} };
  }

  // ---------- scenes
  async function loadScenes() {
    let j;
    try { j = await (await fetch('stage/scenes.json', { cache: 'no-store' })).json(); } catch (e) { j = { scenes: [] }; }
    const runIx = await fetch('runs/index.json').then((r) => r.json()).catch(() => ({ runs: [] }));
    ALL_SCENES = (j.scenes || []).map((s) => ({ ...s, steps: (s.steps || []).map((x) => ({ dur: 2.5, ...x })) }));
    PACKS = j.packs || {};
    applyPack(packFromUrl());
    // every real run is also a free scene: the replay, then each altitude in turn (from the left pane's Runs group)
    FREE = runIx.runs.map((r) => freeScene(r.file, r.title || r.file, r.rung));
    // and every run that started with a push (the Runs repo's index, from raw.githubusercontent: never api.github.com on load)
    fetch(RAW('index.json'), { cache: 'no-store' }).then((r) => r.json()).then((ix) => {
      const seen = new Set();
      for (const r of (ix.runs || []).slice().reverse()) { if (seen.has(r.request)) continue; seen.add(r.request); FREE.push(freeScene('gh:' + r.request, `${r.request} (${r.kind}, ${r.llm_calls} calls)`, 'push')); }
      renderStory();
    }).catch(() => {});
    layout();
    renderStory();
  }
  let FREE = [], ALL_SCENES = [], PACKS = {}, PACK = null;
  // packs: mini demos, each a list of scene ids (scenes.json "packs"), opened as stage.html#pack=<name>; no pack = the whole story
  function packFromUrl() { const m = /pack=([\w-]+)/.exec(location.hash + '&' + location.search); return m ? m[1] : null; }
  function applyPack(name) {
    PACK = name && PACKS[name] ? name : null;
    SCENES = PACK ? PACKS[PACK].scenes.map((id) => ALL_SCENES.find((s) => s.id === id)).filter(Boolean) : ALL_SCENES.filter((s) => !s.hidden);
    // a pack (or the story) opens by playing its first step and holding on its end, so it never opens on an empty
    // card frame (swarm.1.designer, 04:36: the harness pack opened on a table with 0 rows); ← goes back to t = 0
    layout(); t = 0; shownScene = null; playing = STEPS.length > 0; stopAt = STEPS.length ? STEPS[0].e - 1e-3 : null;
    if (typeof renderStory === 'function' && $('#story')) renderStory();
  }
  addEventListener('hashchange', () => applyPack(packFromUrl()));
  setInterval(async () => {
    const sc = shownScene; if (!sc || !sc.run || !sc.run.startsWith('agents:') || !G) return;
    runCache.delete(sc.run); const g = await loadRun(sc.run); if (shownScene !== sc || g.error) return;
    const old = new Map(G.nodes.map((n) => [n.id, n])); g.nodes.forEach((n) => { const o = old.get(n.id); if (o) { n.x = o.x; n.y = o.y; } });
    const grew = g.nodes.length !== G.nodes.length || g.nodes.some((n) => (old.get(n.id) || {}).commits !== n.commits);
    G = g; lastLayoutKey = ''; renderSide(); if (grew) toast('live: the session tree and commits, read again');
  }, 60000);
  function freeScene(src, title, rung) {
    return { id: 'run:' + src, act: 'Runs', title: (rung ? rung + ' · ' : '') + title, run: src, free: true, say: 'One real run, replayed as it happened: every unit appears when it started and goes quiet when it ended.',
      steps: [{ label: 'the run, replayed', dur: 6, replay: true, caption: 'Replayed from the run file: each unit appears when it started.' },
        { label: 'agents', dur: 1.5, highlight: ['P', 'A3'], caption: 'The agent (A3): the one with memory and its own wake.' },
        { label: 'loops', dur: 1.5, highlight: ['A2'], caption: 'Its loops (A2): read, ask, check, retry. They cannot start anything.' },
        { label: 'LLM calls', dur: 1.5, highlight: ['A1'], caption: 'The model calls (A1): one prompt in, one answer out, no tools.' },
        { label: 'code', dur: 1.5, highlight: ['A0', 'D'], caption: 'The code (A0): reads the public data. It holds no keys.' },
        { label: 'all of it', dur: 1.5, caption: 'All of it, by altitude.' }] };
  }
  function actName(sc) {   // inside a pack the acts are numbered 1..n in the pack's own order
    if (!PACK) return sc.act || '';
    const order = []; SCENES.forEach((x) => { const a = x.act || ''; if (!order.includes(a)) order.push(a); });
    return (order.indexOf(sc.act || '') + 1) + ' · ' + String(sc.act || '').replace(/^\d+\s*·\s*/, '');
  }
  function layout() {   // the flattened clock: steps back to back
    STEPS = []; let at = 0;
    SCENES.forEach((sc, si) => sc.steps.forEach((st, i) => { STEPS.push({ scene: sc, si, i, s: at, e: at + st.dur, step: st }); at += st.dur; }));
    TOTAL = at;
  }
  function stepAt(time) { for (let k = 0; k < STEPS.length; k++) if (time < STEPS[k].e - 1e-6) return k; return STEPS.length - 1; }

  // ---------- the clock (the talk player's semantics)
  // brisk (swarm.1, 03:45: a short talk wants one press per scene): → plays the scene through, every step in turn, and holds on its end;
  // ← lands on the END of the previous scene. Key B, or #...&brisk in the URL.
  const sceneEnd = (si) => STEPS.filter((x) => x.si === si).pop();
  function next() {
    if (!STEPS.length) return;
    const k = stepAt(t), S = STEPS[k];
    if (K.brisk) {
      const E = sceneEnd(S.si);
      if (t < E.e - 0.02) { if (t <= S.s + 0.02) t = S.s; stopAt = E.e - 1e-3; playing = true; }   // play on to this scene's end
      else { const N = STEPS.find((x) => x.si > S.si); if (N) { t = N.s; stopAt = sceneEnd(N.si).e - 1e-3; playing = true; } }
      return;
    }
    if (t <= S.s + 0.02) { t = S.s; stopAt = S.e - 1e-3; playing = true; }        // at a step's start: play it, hold on its end
    else if (t < S.e - 0.02) { t = S.e - 1e-3; playing = false; stopAt = null; }  // mid-step: finish it (its built frame)
    else if (k + 1 < STEPS.length) { t = STEPS[k + 1].s; stopAt = STEPS[k + 1].e - 1e-3; playing = true; }
  }
  function prev() {   // to the previous stop: the END of the previous step, so a loop is always seen whole
    if (!STEPS.length) return;
    const k = stepAt(t);
    playing = false; stopAt = null;
    if (K.brisk) { const P = [...STEPS].reverse().find((x) => x.si < STEPS[k].si); t = P ? P.e - 1e-3 : 0; return; }
    const S = STEPS[k];
    if (t > S.s + 0.15) t = k > 0 ? STEPS[k - 1].e - 1e-3 : 0;          // within a step: back to where it began (the step before, built)
    else if (k > 0 && STEPS[k - 1].si !== S.si) t = STEPS[k - 1].e - 1e-3;   // at a scene's start: the END of the previous scene
    else if (k > 1) t = STEPS[k - 2].e - 1e-3;                          // at a step's start (= the step before, built): one more back
    else t = 0;
  }
  function sceneJump(d) {
    const k = stepAt(t), si = STEPS[k] ? STEPS[k].si : 0, to = clamp(si + d, 0, SCENES.length - 1);
    const first = STEPS.find((x) => x.si === to);
    if (first) { t = d < 0 && to === si - 1 ? STEPS.filter((x) => x.si === to).pop().e - 1e-3 : first.s; playing = false; stopAt = null; }
  }
  function gotoScene(si, end) { const ss = STEPS.filter((x) => x.si === si); if (!ss.length) return; t = end ? ss[ss.length - 1].e - 1e-3 : ss[0].s; playing = false; stopAt = null; }
  function playScene(sc) {   // a free scene (one run) goes in after the story, played from its start
    let si = SCENES.indexOf(sc);
    if (si < 0) { SCENES.push(sc); layout(); renderStory(); si = SCENES.length - 1; }
    gotoScene(si); next();
  }
  function tick(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
    if (playing) { t += dt * K.rate; if (stopAt != null && t >= stopAt) { t = stopAt; playing = false; stopAt = null; if (K.auto) setTimeout(() => { if (!playing) next(); }, 1200); } if (t >= TOTAL) { t = TOTAL - 1e-3; playing = false; } }
    // say what → does while something plays (swarm.1, 04:50): it finishes what is playing; one more → moves on
    { let h = $('#playhint'); if (!h) { h = document.createElement('div'); h.id = 'playhint'; document.body.appendChild(h); }
      const left = playing && stopAt != null ? (stopAt - t) / K.rate : 0, on = left > 1.2;
      if (on) h.textContent = (K.brisk ? 'playing the scene' : 'playing') + ' · ' + Math.ceil(left) + ' s · → shows its end now';
      h.classList.toggle('on', on); }
    render();
    requestAnimationFrame(tick);
  }

  // ---------- the state of the stage at time t: the scene, its steps applied cumulatively
  function stateAt(time) {
    const k = stepAt(time), S = STEPS[k];
    if (!S) return null;
    const sc = S.scene, mine = STEPS.filter((x) => x.si === S.si);
    const st = { scene: sc, si: S.si, k, i: S.i, p: clamp((time - S.s) / (S.e - S.s), 0, 1), mode: sc.mode || null, highlight: null, show: null, overlay: null, overlayP: 0,
      anchors: sc.anchors || null, replay: null, assets: [], assetsP: 1, caption: '', counter: null, owner: null, idea: false, fail: null, failP: 0, bars: null, barsN: 0, barsP: 1, card: null, cardN: 0, cardP: 1, camera: sc.camera || 'fit', label: '' };
    for (const x of mine) {
      if (x.i > S.i) break;
      const p = x.i < S.i ? 1 : st.p, s = x.step;
      st.label = s.label || st.label;
      if (s.mode) st.mode = s.mode;
      if (s.caption !== undefined) st.caption = s.caption;
      if (s.highlight !== undefined) st.highlight = s.highlight;
      if (s.show !== undefined) st.show = s.show;
      if (s.anchors !== undefined) st.anchors = s.anchors;
      if (s.camera !== undefined) st.camera = s.camera;
      if (s.replay) st.replay = x.i < S.i ? 1 : ease(p);
      if (s.overlay !== undefined) { st.overlay = s.overlay; st.overlayP = s.overlay ? ease(p) : 0; }
      if (s.assets) { st.assets = s.assets; st.assetsP = x.i < S.i ? 1 : ease(clamp(p * 1.6, 0, 1)); }
      if (s.counter) st.counter = { ...s.counter, p: ease(p) };
      if (s.fail !== undefined) { st.fail = s.fail; st.failP = ease(p); }
      if (s.owner !== undefined) st.owner = s.owner;
      st.idea = !!s.idea;   // a step marked idea is an illustration of what could happen, on a real run
      if (s.card !== undefined) { st.card = s.card; if (s.card) { st.cardN = s.card.upto != null ? s.card.upto : 99; st.cardP = x.i < S.i ? 1 : ease(p); } }
      if (s.bars) { st.bars = s.bars; st.barsN = s.bars.upto != null ? s.bars.upto : s.bars.items ? s.bars.items.length : 0; st.barsP = ease(p); }
    }
    if (st.replay == null && sc.replayFirst === false) st.replay = 1;
    return st;
  }

  // ---------- the stage: one SVG, zoomable, with layers for links, reach lines, nodes and labels
  let svg, zoomG, gLinks, gReach, gNodes, gLabels, zoom, W = 800, H = 600, sim = null, lastLayoutKey = '';
  function setupSvg() {
    svg = d3.select('#svg');
    zoomG = svg.append('g');
    gLinks = zoomG.append('g').attr('class', 'links');
    gReach = zoomG.append('g').attr('class', 'reach');
    gNodes = zoomG.append('g').attr('class', 'nodes');
    gLabels = zoomG.append('g').attr('class', 'labels');
    zoom = d3.zoom().scaleExtent([0.1, 12]).on('zoom', (e) => { zoomG.attr('transform', e.transform); if (e.sourceEvent) userZoomed = true; });
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('click', (e) => { if (e.target === svg.node()) { focusId = null; $('#box').classList.remove('on'); $('#info').innerHTML = ''; } });
    let rz = null;
    const ro = new ResizeObserver(() => { const r = $('#stage').getBoundingClientRect(); W = r.width; H = r.height; svg.attr('viewBox', `0 0 ${W} ${H}`); lastLayoutKey = ''; clearTimeout(rz); rz = setTimeout(() => { if (!userZoomed) fit(); }, 450); });
    ro.observe($('#stage'));
  }

  // layouts: each gives every node a target x, y (and the force mode runs a simulation with anchors)
  const MODES = {
    layers: { name: 'Top-down', key: '1', place: placeLayers },
    tree: { name: 'Tree', key: '2', place: placeTree },
    radial: { name: 'Radial', key: '3', place: placeRadial },
    force: { name: 'Force', key: '4', place: placeForce },
    universe: { name: '3D universe', key: '5', place: null },   // stage/universe.js plugs in here (window.STAGE_UNIVERSE)
    views: { name: 'Designer', key: '6', place: null },         // swarm.1.designer's assets/swarm-views.js: its five modes and four layouts
  };
  function visibleAlts(nodes) { return ALT.filter((a) => nodes.some((n) => n.alt === a)); }
  function placeLayers(g) {   // X-Ray's top-down: one band per altitude; children under their parents
    const alts = visibleAlts(g.nodes), band = H / (alts.length + 1);
    const order = new Map(); let c = 0; const walk = (id) => { if (order.has(id)) return; order.set(id, c++); g.nodes.filter((n) => n.parent === id).forEach((n) => walk(n.id)); };
    g.nodes.filter((n) => !n.parent).forEach((n) => walk(n.id)); g.nodes.forEach((n) => walk(n.id));
    for (const a of alts) {
      const row = g.nodes.filter((n) => n.alt === a).sort((x, y) => order.get(x.id) - order.get(y.id));
      row.forEach((n, i) => { n.tx = ((i + 1) / (row.length + 1)) * W; n.ty = band * (alts.indexOf(a) + 1); });
    }
  }
  function hierarchy(g) {
    const root = { id: '__root', children: [] }, kids = new Map(g.nodes.map((n) => [n.id, []]));
    for (const n of g.nodes) (n.parent && kids.has(n.parent) ? kids.get(n.parent) : root.children).push(n.id);
    const build = (id) => ({ id, children: (kids.get(id) || []).map(build) });
    return d3.hierarchy({ id: '__root', children: root.children.map(build) });
  }
  function placeTree(g) {   // left to right, a tidy tree
    const h = hierarchy(g); d3.tree().size([H * 0.9, W * 0.85])(h);
    h.each((d) => { const n = g.byId.get(d.data.id); if (n) { n.tx = W * 0.06 + d.y; n.ty = H * 0.05 + d.x; n.tdepth = d.depth; n.tinner = !!d.children; } });
  }
  function placeRadial(g) {   // rings by depth: the agent in the middle, the code at the rim
    const h = hierarchy(g), R = Math.min(W, H) * 0.46; d3.tree().size([2 * Math.PI, R]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(h);
    h.each((d) => { const n = g.byId.get(d.data.id); if (n) { n.tx = W / 2 + d.y * Math.cos(d.x - Math.PI / 2); n.ty = H / 2 + d.y * Math.sin(d.x - Math.PI / 2); } });
  }
  // anchors (graphs.sgit.ai's idea): a group is pulled to a side, so the story's groups stand apart
  const SIDE = { left: [0.12, null], right: [0.88, null], top: [null, 0.12], bottom: [null, 0.88], center: [0.5, 0.5], middle: [0.5, null], 'top-left': [0.12, 0.12], 'top-right': [0.88, 0.12], 'bottom-left': [0.12, 0.88], 'bottom-right': [0.88, 0.88] };
  function anchorOf(n, anchors) { if (!anchors) return null; const u = K.userAnchors || {}, a = anchors; return u[n.id] || u[n.alt] || a[n.id] || a[n.kind] || a[n.alt] || null; }
  function placeForce(g, st) {
    if (sim) sim.stop();
    const anchors = K.anchors ? (st && st.anchors) || {} : null;
    g.nodes.forEach((n) => { if (n.x == null) { n.x = n.tx ?? W / 2 + (Math.random() - 0.5) * 50; n.y = n.ty ?? H / 2 + (Math.random() - 0.5) * 50; } });
    sim = d3.forceSimulation(g.nodes)
      .force('link', d3.forceLink(g.links.filter((l) => l.kind !== 'reach')).id((n) => n.id).distance((l) => 22 + 10 * (ALT_R[l.source.alt] || 6) / 6).strength(0.6))
      .force('charge', d3.forceManyBody().strength((n) => -40 - 6 * (ALT_R[n.alt] || 5)))
      .force('collide', d3.forceCollide((n) => r(n) + 2))
      .force('x', d3.forceX((n) => { const a = SIDE[anchorOf(n, anchors)]; return a && a[0] != null ? a[0] * W : W / 2; }).strength((n) => (SIDE[anchorOf(n, anchors)] && SIDE[anchorOf(n, anchors)][0] != null ? 0.35 : 0.04)))
      .force('y', d3.forceY((n) => { const a = SIDE[anchorOf(n, anchors)]; return a && a[1] != null ? a[1] * H : H / 2; }).strength((n) => (SIDE[anchorOf(n, anchors)] && SIDE[anchorOf(n, anchors)][1] != null ? 0.35 : 0.05)))
      .alphaDecay(0.03)
      .on('tick', () => g.nodes.forEach((n) => { n.tx = n.x; n.ty = n.y; }));
  }
  const r = (n) => (ALT_R[n.alt] || 6) * K.node * (n.commits ? 1 + Math.log10(1 + n.commits) * 0.6 : 1);   // an agent grows with its commits

  // assets added by a step (the "who can reach it" stories): nodes on the right, sim-marked
  function withAssets(g, names) {
    if (!names || !names.length) return g;
    // an asset is a name (simulated), or {name, label, real, home}: home "alt:E" ties its one reach line to the first unit of that altitude
    const nm = (a) => (typeof a === 'string' ? a : a.name), key = names.map(nm).join(',');
    if (g._assets && g._assets.key === key) return g._assets.g;
    const homeOf = (h) => (h && h.startsWith('alt:') ? (g.nodes.find((n) => n.alt === h.slice(4)) || {}).id : h);
    const extra = names.map((a) => g.byId.get('asset:' + nm(a)) || (typeof a === 'string' ? { id: 'asset:' + a, kind: 'asset', alt: 'X', label: a, sim: true, t0: 0 }
      : { id: 'asset:' + a.name, kind: 'asset', alt: 'X', label: a.label || a.name, sim: !a.real, home: homeOf(a.home), t0: 0 }));
    const ng = { ...g, nodes: g.nodes.concat(extra.filter((n) => !g.byId.has(n.id))), byId: new Map(g.byId) };
    extra.forEach((n) => ng.byId.set(n.id, n));
    g._assets = { key, g: ng };
    return ng;
  }

  // ---------- render one frame
  var shownScene = null; let clickT = null, lastReplayFit = 0, userZoomed = false, lastStepK = -1, modeOverride = null, curMode = 'layers';
  async function ensureScene(st) {
    const sc = st.scene;
    if (shownScene === sc) return;
    shownScene = sc;
    const g = await loadRun(sc.run);
    if (shownScene !== sc) return;
    G = g; lastLayoutKey = ''; focusId = null; modeOverride = null;
    document.querySelectorAll('#story details').forEach((d) => { d.open = d.dataset.act === actName(sc); });   // the current act open, the rest folded
    g.nodes.forEach((n) => { n.x = n.y = null; });
    if (sim) { sim.stop(); sim = null; }
    renderSide();
    setTimeout(() => fit(true), 60); setTimeout(() => fit(), 1400);
  }
  let pending = false;
  function render() {
    const st = stateAt(t);
    renderControls(st);
    if (!st) return;
    if (st.scene !== shownScene) { if (!pending) { pending = true; ensureScene(st).finally(() => { pending = false; }); } return; }
    if (!G) return;
    // the view: the presenter's choice for this scene (keys 1-5, the buttons) wins over the scene's, which wins over the default
    const mode = modeOverride || (st.mode && MODES[st.mode] && !Q.get('mode') ? st.mode : K.mode);
    curMode = mode;
    renderCaption(st, mode);
    // the camera follows the story: a new step refits (twice: as it starts, and once the layout settles), unless the presenter
    // zoomed by hand during this scene (0 or the fit button gives the camera back)
    // during a replay the picture grows: the camera follows it about once a second (unless the presenter zoomed)
    if (st.replay != null && st.replay < 1 && playing && !userZoomed && performance.now() - lastReplayFit > 450) { lastReplayFit = performance.now(); fit(); }
    if (st.k !== lastStepK) { const sameScene = lastStepK >= 0 && STEPS[lastStepK] && STEPS[lastStepK].si === st.si; lastStepK = st.k; if (!sameScene) userZoomed = false; if (!userZoomed && st.camera !== 'hold') { setTimeout(() => { if (!userZoomed) fit(); }, 350); setTimeout(() => { if (!userZoomed) fit(); }, 1500); setTimeout(() => { if (!userZoomed) fit(); }, 2700); } }
    if (st.card) { hideViews(); drawCard(st); return; }
    $('#card').style.display = 'none';
    if (st.bars) { hideViews(); drawBars(st); return; }
    d3.select('#bars').style('display', 'none');
    if (mode !== 'universe' || !window.STAGE_UNIVERSE) $('#svg').style.display = '';
    const g = withAssets(G, st.assets);
    if (mode === 'views') { drawViews(st); return; } else hideViews();
    if (mode === 'universe') {
      if (window.STAGE_UNIVERSE) { $('#svg').style.display = 'none'; window.STAGE_UNIVERSE.render(g, st, { K, ALT, altIx, r, color, visible: (n) => visibleOf(n, st) }); return; }
      // the 3D mode is not loaded yet: load it once, draw the flat view meanwhile
      loadUniverse();
    } else if (window.STAGE_UNIVERSE) window.STAGE_UNIVERSE.hide();
    const layoutKey = [mode === 'universe' ? 'layers' : mode, W | 0, H | 0, g.nodes.length, JSON.stringify(K.anchors ? [st.anchors, K.userAnchors] : null), st.si].join('|');
    if (layoutKey !== lastLayoutKey) { lastLayoutKey = layoutKey; (MODES[mode === 'universe' ? 'layers' : mode].place)(g, st); if (mode !== 'force' && sim) { sim.stop(); sim = null; } }
    // ease every node towards its target (the layouts morph into each other)
    for (const n of g.nodes) { if (n.tx == null) continue; if (n.x == null) { n.x = n.tx; n.y = n.ty; } else if (mode !== 'force') { n.x += (n.tx - n.x) * 0.18; n.y += (n.ty - n.y) * 0.18; } }
    draw(g, st);
  }
  function color(n) { return `var(--alt-${n.alt === '?' ? 'A0' : n.alt})`; }
  function visibleOf(n, st) {   // 0..1: the replay, the presenter's legend switches, a step's "show"
    if (extraHidden.has(n.alt)) return 0;
    if (st.show && !st.show.includes(n.alt) && !st.show.includes(n.kind) && !st.show.includes(n.id)) return 0;
    if (n.alt === 'X') return n._fromStep ? st.assetsP : 1;
    if (st.replay != null && st.replay < 1 && G && G.T > 1) { const at = st.replay * G.T * 1.02; return n.t0 == null || n.t0 <= at ? 1 : 0; }
    return 1;
  }
  function liveOf(n, st) { if (st.replay == null || st.replay >= 1 || !G) return false; const at = st.replay * G.T; return n.t0 != null && n.t0 <= at && (n.t1 == null || n.t1 > at); }
  function dimOf(n, st) {
    if (focusId) { const near = focusId === n.id || G.links.some((l) => (idOf(l.source) === focusId && idOf(l.target) === n.id) || (idOf(l.target) === focusId && idOf(l.source) === n.id)); return near ? 1 : 0.12; }
    if (!st.highlight) return 1;
    return st.highlight.includes(n.alt) || st.highlight.includes(n.kind) || st.highlight.includes(n.id) ? 1 : 0.14;
  }
  const idOf = (x) => (typeof x === 'object' ? x.id : x);

  let drawn = null;
  function draw(g, st) {
    const byId = g.byId; drawn = g;
    for (const n of g.nodes) if (n.alt === 'X' && !G.byId.has(n.id)) n._fromStep = true;
    // links
    const L = g.links.filter((l) => l.kind !== 'reach' || !st.overlay);
    const ls = gLinks.selectAll('line').data(L, (l) => idOf(l.source) + '>' + idOf(l.target) + l.kind);
    ls.exit().remove();
    ls.enter().append('line').attr('class', (l) => 'edge k-' + l.kind + (l.sim ? ' sim' : '')).merge(ls)
      .each(function (l) {
        const a = byId.get(idOf(l.source)), b = byId.get(idOf(l.target)); if (!a || !b || a.x == null || b.x == null) return;
        const v = Math.min(visibleOf(a, st), visibleOf(b, st)), d = Math.min(dimOf(a, st), dimOf(b, st));
        const failed = st.fail && (idOf(l.source) === st.fail || idOf(l.target) === st.fail);
        this.setAttribute('x1', a.x); this.setAttribute('y1', a.y); this.setAttribute('x2', b.x); this.setAttribute('y2', b.y);
        this.style.opacity = v * d * (l.kind === 'reach' ? 0.75 : 0.6);
        this.style.strokeWidth = (l.kind === 'reach' ? 1.6 : 1.1) * K.link * (failed ? 1 + 1.5 * st.failP : 1);
        this.classList.toggle('fail', !!failed && st.failP > 0.05);
      });
    drawReach(g, st);
    // nodes
    const ns = gNodes.selectAll('g.n').data(g.nodes, (n) => n.id);
    ns.exit().remove();
    const ne = ns.enter().append('g').attr('class', 'n').call(drag());
    ne.append('circle').attr('class', 'halo');
    ne.append('circle').attr('class', 'dot');
    ne.append('title');
    ne.on('dblclick', (e, n) => { e.stopPropagation(); clearTimeout(clickT); $('#box').classList.remove('on'); focusId = focusId === n.id ? null : n.id; if (focusId) zoomToSubtree(n); else fit(); })
      .on('click', (e, n) => { e.stopPropagation(); clearTimeout(clickT); if (e.shiftKey) { showInfo(n); return; } const ev = { clientX: e.clientX, clientY: e.clientY }; clickT = setTimeout(() => { $('#info').innerHTML = ''; openBox(n, ev); }, 260); });
    ns.merge(ne).each(function (n) {
      if (n.x == null) return;
      const v = visibleOf(n, st), d = dimOf(n, st), live = liveOf(n, st), failed = st.fail === n.id && st.failP > 0.05;
      this.setAttribute('transform', `translate(${n.x},${n.y}) scale(${0.3 + 0.7 * v})`);
      this.style.opacity = v * d;
      this.style.display = v <= 0.001 ? 'none' : '';
      this.classList.toggle('live', live); this.classList.toggle('bad', n.valid === false); this.classList.toggle('ok', n.valid === true);
      this.classList.toggle('sim', !!n.sim); this.classList.toggle('fail', failed); this.classList.toggle('pinned', n.fx != null);
      const dot = this.childNodes[1], halo = this.childNodes[0];
      dot.setAttribute('r', r(n)); dot.style.fill = color(n);
      halo.setAttribute('r', r(n) + 4 + (failed ? 10 * st.failP : 0));
      this.childNodes[2].textContent = `${n.label} (${ALT_NAME[n.alt] || n.alt})${n.model ? ' · ' + n.model : ''}${n.valid != null ? (n.valid ? ' · valid' : ' · not valid') : ''}${n.sim ? ' · simulated' : ''}`;
    });
    // labels: big units always, small ones when there are few or when the presenter zooms in
    const k = d3.zoomTransform(svg.node()).k, few = g.nodes.length < 60;
    const lab = K.labels ? g.nodes.filter((n) => visibleOf(n, st) > 0.5 && dimOf(n, st) > 0.5 && (few || k > 1.6 || ['P', 'A4', 'A3', 'M', 'X', 'E', 'C'].includes(n.alt) || n.id === focusId)) : [];
    const boostTok = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--label-boost')) || 1;
    const under = (n) => curMode === 'layers' && !['P', 'A4', 'A3', 'X', 'M', 'T'].includes(n.alt);
    // tree: the columns are close, so an inner node's label sits centred above or below it (alternating by depth), never across the next column
    const stack = (n) => curMode === 'tree' && n.tinner, up = (n) => n.tdepth % 2 === 0;
    const fsz = (n) => ((['P', 'A4', 'A3', 'X', 'M'].includes(n.alt) ? 13 : 10.5) * K.label * sparse) / k;
    // crowded (more than 24): only the big units keep a label until the presenter zooms in, so the picture stays clean
    const BIG = ['P', 'A4', 'A3', 'X', 'M', 'E', 'C'], labs = lab.length > 24 && !userZoomed ? lab.filter((n) => BIG.includes(n.alt) || n.id === focusId) : lab;
    // the boost is for the projector: on a narrow stage (a laptop with both panes open) it shrinks with the stage's width
    const fitW = Math.max(0.55, Math.min(1, (W || 1300) / 1300));
    const sparse = boostTok * (1 + ((labs.length <= 8 ? 2.2 : labs.length <= 12 ? 1.8 : labs.length <= 16 ? 1.4 : 1) - 1) * fitW);
    const ts = gLabels.selectAll('text').data(labs, (n) => n.id);
    ts.exit().remove();
    ts.enter().append('text').attr('class', 'lbl').merge(ts)
      // the same size on screen at any zoom (swarm.1.dev); bigger when few labels are on screen, and in top-down the small units'
      // labels sit centred under the node, clear of the lines from above (swarm.1.designer, Dinis 02:0x UTC); --label-boost tunes it
      .attr('x', (n) => (under(n) || stack(n) ? n.x : n.x + r(n) + 4 / k)).attr('y', (n) => (stack(n) ? (up(n) ? n.y - r(n) - 6 / k : n.y + r(n) + fsz(n) + 2 / k) : under(n) ? n.y + r(n) + (10.5 * K.label * sparse + 2) / k : n.y + 4 / k))
      .attr('text-anchor', (n) => (under(n) || stack(n) ? 'middle' : 'start')).style('stroke-width', 3 / k + 'px')
      .style('font-size', (n) => ((['P', 'A4', 'A3', 'X', 'M'].includes(n.alt) ? 13 : 10.5) * K.label * sparse) / k + 'px')
      .classed('big', (n) => ['P', 'A4', 'A3', 'X', 'M'].includes(n.alt))
      .text((n) => (n.alt === 'A1' && k < 2.5 && n.id !== focusId && /#\d+$/.test(n.label) ? n.label.match(/#\d+$/)[0]   // calls: "#1" until zoomed (the model is on its loop)
        : short(String(n.label).replace(/\.fringe@PrompTugal\.\w+$|@PrompTugal\.\w+$/, '').replace(/^commit ([0-9a-f]{7})[0-9a-f]+$/, 'commit $1'), ['P', 'A3', 'X'].includes(n.alt) ? 40 : 26))); // the full name stays in the node's title
    // counter
    const c = $('#counter');
    if (st.counter) { c.style.display = ''; const v = counterValue(g, st); const shown = Math.round(v.value * st.counter.p), lab = st.counter.label || v.label; c.innerHTML = `<b>${fmtN(shown)}</b><span>${esc(shown === 1 ? lab.replace(/^units\b/, 'unit').replace(/^results\b/, 'result').replace(/^connections\b/, 'connection') : lab)}</span>`; }
    else c.style.display = 'none';
    const simOn = g.sim || g.nodes.some((n) => n.sim && visibleOf(n, st) > 0);
    badge(st.idea ? ['idea', 'ILLUSTRATION · WHAT COULD HAPPEN'] : g.sim ? ['sim', 'SIMULATED'] : simOn ? ['sim', 'REAL RUN · SIMULATED ASSETS'] : ['real', 'REAL RUN · ' + (st.scene.run || '').replace(/^gh:/, 'Runs repo ').replace(/^agents:/, '')]);
  }
  function badge(b) { const el = $('#simflag'); if (!b) { el.style.display = 'none'; return; } el.style.display = ''; el.className = 'b-' + b[0]; el.textContent = b[1]; }
  const short = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
  const fmtN = (x) => Number(x).toLocaleString('en-GB');

  // reach lines: who can touch the assets. "all": every unit, with the agent's privileges ("poof, everybody");
  // "policy": only the unit the policy names; "isolated": units that run away from the assets (GitHub Actions,
  // OpenRouter) are drawn with a cut line.
  function drawReach(g, st) {
    const assets = g.nodes.filter((n) => n.alt === 'X' && visibleOf(n, st) > 0.5);
    let R = [];
    if (st.overlay && assets.length) {
      const units = g.nodes.filter((n) => n.alt !== 'X' && n.alt !== 'P' && n.alt !== 'D' && n.alt !== 'M' && visibleOf(n, st) > 0.5);
      if (st.overlay === 'all') for (const u of units) for (const a of assets) R.push({ u, a, cut: false });
      else if (st.overlay === 'policy' || st.overlay === 'isolated') for (const a of assets) {
        // policy: only the owner reaches (a's home in a simulated graph, else the step's owner, else the first agent);
        // isolated: the same, and every other unit is drawn cut (it runs where the asset is not connected at all)
        const owner = g.byId.get(a.home) || g.byId.get(st.owner) || units.find((u) => u.alt === 'A3');
        for (const u of units) R.push({ u, a, cut: u !== owner });
      }
      // the lines appear one after another over the step, so "everybody" is seen happening
      const n = R.length; R = R.map((x, i) => ({ ...x, on: st.overlayP * 1.15 > i / Math.max(1, n) }));
      if (st.fail) R = R.map((x) => ({ ...x, failed: x.u.id === st.fail }));
    }
    const few = R.filter((x) => !x.cut).length <= 2;
    const rs = gReach.selectAll('line').data(R, (x) => x.u.id + '>' + x.a.id);
    rs.exit().remove();
    rs.enter().append('line').merge(rs)
      .attr('class', (x) => 'reachline' + (x.cut ? ' cut' : '') + (x.failed ? ' fail' : ''))
      .attr('x1', (x) => x.u.x).attr('y1', (x) => x.u.y).attr('x2', (x) => x.a.x).attr('y2', (x) => x.a.y)
      // one or two live lines (the Action's one real reach): drawn bold, so the eye finds it; many lines stay fine
      .style('opacity', (x) => (x.on ? (x.cut ? 0.22 : few ? 0.95 : 0.5) * Math.min(dimOf(x.u, st), 1) : 0))
      .style('stroke-width', (x) => (!x.cut && few ? 3 : 1.2) * K.link);
    const reaching = R.filter((x) => x.on && !x.cut).length, units = new Set(R.filter((x) => x.on && !x.cut).map((x) => x.u.id)).size;
    st._reach = { lines: reaching, units };
  }
  function counterValue(g, st) {
    const c = st.counter;
    if (c.of === 'reach') return { value: (st._reach && st._reach.units) || 0, label: 'units that can reach the assets' };
    if (c.of === 'units') return { value: g.nodes.filter((n) => n.alt !== 'X' && visibleOf(n, st) > 0.5).length, label: 'units on screen' };
    if (c.of === 'commits') return { value: g.nodes.filter((n) => visibleOf(n, st) > 0.5).reduce((s2, n) => s2 + (n.commits || 0), 0), label: 'commits by the agents on screen, last 24 h' };
    if (c.of === 'calls') return { value: g.metrics.llm_calls || 0, label: 'model calls in this run' };
    if (c.of === 'peak') return { value: g.metrics.peak_concurrency || 0, label: 'units at once (peak)' };
    if (c.of === 'value') return { value: c.value || 0, label: c.label || '' };
    if (c.of && c.of.startsWith('summary.')) { loadSummary(); const v = c.of.slice(8).split('.').reduce((o, k) => (o == null ? o : o[k]), SUMMARY && SUMMARY.totals); return { value: +v || 0, label: SUMMARY ? c.label || c.of : 'loading the Runs summary…' }; }
    return { value: 0, label: '' };
  }

  // ---------- cards: the stories that are not graphs. slide (lines, one more per step), gap (mandate, reach and the gap
  // between them, from an evidence file), lights (probe results lit one by one). The data comes from the card's src.
  const cardData = new Map();
  function cardSrc(src) { if (!src) return null; if (!cardData.has(src)) { cardData.set(src, null); fetch(src).then((r) => r.json()).then((j) => { cardData.set(src, j); lastCardKey = ''; }).catch(() => cardData.set(src, { error: true })); } return cardData.get(src); }
  const pick = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  let lastCardKey = '', glyphStep = null;
  function drawCard(st) {
    const el = $('#card'), c = st.card;
    el.style.display = ''; $('#svg').style.display = 'none'; d3.select('#bars').style('display', 'none'); $('#counter').style.display = 'none';
    if (window.STAGE_UNIVERSE) window.STAGE_UNIVERSE.hide();
    const data = cardSrc(c.src);
    badge(c.badge ? [c.badgeKind || 'sim', c.badge] : c.idea ? ['idea', 'ILLUSTRATION · NOT A RUN'] : c.src || c.source ? ['real', 'REAL · ' + short(c.source || c.src, 70)] : null);
    const key = c.kind === 'glyph' ? 'glyph|' + c.name + '|' + st.si : JSON.stringify(c) + st.cardN + (data ? 1 : 0);
    if (key !== lastCardKey) {
      lastCardKey = key;
      if (c.kind === 'gap') {
        const reach = c.reach || (data && pick(data, c.reachFrom || '') ) || [];
        const items = Array.isArray(reach) ? reach : Object.entries(reach).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        el.innerHTML = `<div class="gap"><svg viewBox="-300 -300 600 600"><circle class="reachc" r="250"/><circle class="gapring" r="250"/><circle class="mand" r="34"/><text class="mt" y="5">${esc(c.mandate || 'mandate')}</text></svg>
          <ul class="ritems">${items.slice(0, 10).map((x, i) => `<li data-i="${i}">${esc(short(String(x), 70))}</li>`).join('')}</ul>
          <div class="glabels"><span class="gl m">${esc(c.mandateLabel || 'Mandate: what it was asked to do')}</span><span class="gl r">${esc(c.reachLabel || 'Reach: what it could actually touch')}</span><span class="gl g">${esc(c.gapLabel || 'The gap: where things go wrong')}</span></div></div>`;
      } else if (c.kind === 'check') {   // ask → check → allowed or refused, one row per step of the reveal
        const M = c.map || null, src = (data && pick(data, c.from || 'after.results')) || [];
        const rows = c.rows || (c.fromActions && data ? (pick(data, c.fromActions) || []).map((r) => ({ who: c.who, ask: r.action, check: (c.policy || 'the licence') + ' · reach ' + String(r.fp || '').slice(7, 15), outcome: String(r.got).split(':')[0] })) : null) || (M ? src.slice(0, c.max || 12).map((r) => ({ who: M.who ? pick(r, M.who) : c.who, ask: [M.askPrefix || '', pick(r, M.ask)].join(''), check: M.check ? pick(r, M.check) || c.policy : c.policy, outcome: M.outcome ? (pick(r, M.outcome) === true ? 'allowed' : pick(r, M.outcome) === false ? 'refused' : String(pick(r, M.outcome))) : '', where: c.where })) : src.map((r) => ({ who: c.who || 'the child process', ask: r.probe, check: c.policy || 'policy', outcome: String(r.got).split(' (')[0], expected: r.expected })));
        el.innerHTML = `<div class="check"><h2>${esc(c.title || '')}</h2><div class="ck-head"><span>asks</span><span>the check</span><span>outcome</span></div>${rows.map((r, i) => `<div class="ck" data-i="${i}"><span class="ask"><small>${esc(r.who || '')}</small>${esc(r.ask)}</span><span class="arrow">→</span><span class="gate ${r.where === 'inside' ? 'inside' : ''}">${esc(r.check)}${r.where ? `<small>${esc(r.where === 'inside' ? 'inside the agent' : 'outside the agent')}</small>` : ''}</span><span class="arrow">→</span><span class="out ${/^allowed\b/.test(r.outcome) || /^done( ·|$)/.test(r.outcome) ? 'ok' : /refus|denied|block/.test(r.outcome) ? 'no' : 'skip'}">${esc(r.outcome)}</span></div>`).join('')}${c.source ? `<p class="src">${esc(c.source)}</p>` : ''}</div>`;
      } else if (c.kind === 'flow') {   // where the data is, step by step: network, in memory (decrypted), vault (encrypted), Git (public)
        const steps = (data && data.steps) || [], LANES = c.lanes || ['network', 'memory-decrypted', 'disk-plaintext', 'vault-encrypted', 'git-public'];
        const NAMES = { network: 'network', 'memory-decrypted': 'in memory · decrypted', 'vault-encrypted': 'vault · encrypted', 'git-public': 'Git · public', 'inside-harness': 'inside the harness', 'disk-plaintext': 'disk · plaintext' };
        const laneOf = (s2) => (s2.where === 'memory' ? 'memory-decrypted' : s2.where || (s2.inside_harness ? 'inside-harness' : 'memory-decrypted'));
        const who = (w) => String(w || '').replace(/\.fringe@PrompTugal\.\w+$/, '');
        el.innerHTML = `<div class="flow"><h2>${esc(c.title || (data && data.run) || '')}</h2><div class="fl-head" style="grid-template-columns:36px repeat(${LANES.length},1fr)"><span></span>${LANES.map((l) => `<span class="l-${l}">${esc(NAMES[l] || l)}</span>`).join('')}</div><div class="fl-body">${steps.map((s2, i) => { const ln = laneOf(s2), col = LANES.indexOf(ln) + 2, refused = /^REFUSED/i.test(s2.what || '') || s2.outcome === 'refused', failed = s2.outcome === 'failed'; return `<div class="fr ${(c.mark || []).includes(s2.n) ? 'mark' : ''}" data-i="${i}" style="grid-template-columns:36px repeat(${LANES.length},1fr)"><span class="fn">${s2.n || i + 1}</span><div class="fs l-${ln} ${refused ? 'refused' : ''} ${failed ? 'failed' : ''}" style="grid-column:${col}" title="${esc(s2.what || '')}" onclick="this.classList.toggle('open')"><b>${esc(who(s2.who))}</b> <small class="alt">${esc(s2.altitude || '')}</small> ${s2.encrypted ? '<i title="encrypted">🔒</i>' : ''}<span>${failed ? '<b class="fail-tag">FAILED</b> ' : ''}${esc(s2.what || '')}</span>${s2.sealed_to ? `<small class="fp">sealed to ${esc(String(s2.sealed_to).slice(0, 23))}</small>` : ''}</div></div>`; }).join('')}</div>${data ? `<p class="src">${esc(c.src)} · ${esc(data.outcome || '')}${data.private_input_in_git === false ? ' · private input in Git: never' : ''}</p>` : '<p class="src">loading…</p>'}</div>`;
      } else if (c.kind === 'glyph') {
        el.innerHTML = `<iframe class="glyph" title="${esc(c.name)}" src="pages/packs.html?pack=${encodeURIComponent(c.name)}&step=${st.cardN}&embed=1&cap=${c.cap ? 1 : 0}"></iframe>`;
        glyphStep = null;
      } else if (c.kind === 'compare') {   // the same attempts, before and after: phase "before" lights the first column, "after" the second
        let rows = (data && pick(data, c.from || 'comparison')) || [];
        if (c.before && data) { const A = pick(data, c.before) || [], B = pick(data, c.after) || []; rows = A.map((a, i) => ({ id: a[c.idKey || 'action'], what: a[c.whatKey || 'kind'], unharnessed: a[c.gotKey || 'got'], harnessed: (B[i] || {})[c.gotKey || 'got'], refused_by: /refus/.test((B[i] || {})[c.gotKey || 'got']) ? (B[i] || {})[c.whyKey || 'why'] : '' })); }
        const same = data && pick(data, c.same || 'compute');
        const ok = (v) => /succeed|allow|done/.test(String(v));
        el.innerHTML = `<div class="cmp"><h2>${esc(c.title || '')}</h2>${c.end && data ? `<div class="ends">${['before', 'after'].map((w) => { const e = pick(data, c.end[w]) || {}; return `<div class="end e-${w}" data-col="${w === 'before' ? 'b' : 'a'}"><b>${esc(c.end[w + 'Label'] || w)}</b>${Object.entries(e).map(([k, v]) => `<span>${esc(k.replace(/_/g, ' '))}: <i>${esc(v)}</i></span>`).join('')}</div>`; }).join('')}</div>` : ''}${same && same.unharnessed ? `<p class="same">Same code, same output: sha256 <b>${esc(String(same.unharnessed.output_sha256).slice(0, 16))}…</b> ${same.same_output ? 'both times' : '(different!)'}</p>` : ''}<div class="cm-head"><span>the attempt</span><span>${esc(c.beforeLabel || 'unharnessed')}</span><span>${esc(c.afterLabel || 'harnessed')}</span><span>refused by</span></div>${rows.map((r, i) => `<div class="cm" data-i="${i}"><span class="what"><b>${esc(r.id)}</b><small>${esc(r.what || '')}</small></span><span class="b ${ok(r.unharnessed) ? 'ok' : 'no'}" data-col="b">${ok(r.unharnessed) ? '✓ done' : '✗ refused'}</span><span class="a ${ok(r.harnessed) ? (/GAP/.test(r.what || '') ? 'gp' : /mandate/.test(r.what || '') ? 'ok' : 'gp') : 'no'}" data-col="a">${ok(r.harnessed) ? '✓ done' : '✗ refused'}</span><span class="rb">${esc(r.refused_by || '')}</span></div>`).join('')}<p class="src">${esc(c.source || c.src || '')}</p></div>`;
      } else if (c.kind === 'keys') {   // keys and how long each one lived
        const keys = (data && pick(data, c.from || 'keys')) || [];
        el.innerHTML = `<div class="kys"><h2>${esc(c.title || '')}</h2>${keys.map((k, i) => { const life = k.created_at && k.destroyed_at ? Date.parse(k.destroyed_at) - Date.parse(k.created_at) : null; return `<div class="ky" data-i="${i}"><span class="kr"><b>${esc(k.role)}</b><small>${esc(k.alg || '')} · ${esc(k.fp || '')}</small></span><span class="kl">${life != null ? `lived <b>${life.toLocaleString('en-GB')} ms</b>` : 'lifetime not recorded'}</span><span class="kw"><small>${esc(k.private_key_path || '')}</small>${k.destroyed_how ? `<small>${esc(k.destroyed_how)}</small>` : ''}</span></div>`; }).join('')}<p class="src">${esc(c.source || c.src || '')}</p></div>`;
      } else if (c.kind === 'needheld') {
        const units = (data && pick(data, c.from || 'units')) || [], len = (v) => (Array.isArray(v) ? v.length : +v || 0);
        const max = Math.max(1, ...units.map((u) => len(u[c.held || 'held'])));
        el.innerHTML = `<div class="nh"><h2>${esc(c.title || '')}</h2><div class="nh-head"><span></span><span><i class="need"></i>needed</span><span><i class="held"></i>${esc(c.heldLabel || 'held')}${c.held2 ? ` <i class="held2"></i>${esc(c.held2Label || 'harnessed')}` : ''}</span><span>gap</span></div>${units.map((u, i) => { const nd = len(u[c.need || 'needs']), hd = len(u[c.held || 'held']), h2 = c.held2 ? len(u[c.held2]) : null, last = h2 != null ? h2 : hd; return `<div class="nh-row ${(c.mark || []).includes(i) ? 'mark' : ''}" data-i="${i}"><span class="nl"><b>${esc(u[c.label || 'unit'])}</b><small>${esc(u.altitude || '')}</small></span><span class="bars"><i class="need" style="width:${(100 * nd) / max}%"></i><i class="held" style="width:${(100 * hd) / max}%"></i>${h2 != null ? `<i class="held2" style="width:${(100 * h2) / max}%"></i>` : ''}</span><span class="nums">${nd} / ${hd}${h2 != null ? ' → ' + h2 : ''}</span><span class="gapn ${last - nd > 5 ? 'big' : last - nd > 0 ? 'some' : 'none'}">${last - nd}</span></div>`; }).join('')}${c.note && data ? `<details class="note"><summary>${esc(c.noteLabel || 'why')}</summary><p>${esc(pick(data, c.note) || c.note)}</p></details>` : ''}<p class="src">${esc(c.source || c.src || '')}</p></div>`;
      } else if (c.kind === 'lights') {
        const res = (data && pick(data, c.from || 'after.results')) || [];
        el.innerHTML = `<div class="lights"><h2>${esc(c.title || '')}</h2><div class="row">${res.map((r, i) => `<div class="light" data-i="${i}"><i></i><b>${esc(r.probe)}</b><small>expected ${esc(r.expected)}</small><span>${esc(String(r.got).split(' (')[0])}</span></div>`).join('')}</div>${c.note && data ? `<details class="note"><summary>${esc(c.noteLabel || 'why')}</summary><p>${esc(pick(data, c.note) || c.note)}</p></details>` : ''}${c.source ? `<p class="src">${esc(c.source)}</p>` : ''}</div>`;
      } else {
        el.innerHTML = `<div class="slide">${c.kicker ? `<p class="kicker">${esc(c.kicker)}</p>` : ''}${c.title ? `<h2>${esc(c.title)}</h2>` : ''}${(c.lines || []).map((l, i) => `<p class="line ${typeof l === 'object' && l.big ? 'big' : ''}" data-i="${i}">${esc(typeof l === 'object' ? l.text : l)}</p>`).join('')}${c.source ? `<p class="src">${esc(c.source)}</p>` : ''}</div>`;
      }
    }
    // the reveal, every frame: items up to cardN, the last one at cardP. A flow or a check with no "upto" reveals all its
    // rows across the one step, one after another (however many the file holds)
    let n = st.cardN, p = st.cardP;
    if (c.fromN != null && c.upto != null) {
      // a table's first row arrives with its frame (audience.1, swarm.1.designer: an evidence table must never look empty)
      const span = Math.max(1, c.upto - c.fromN), lead = c.fromN === 0 ? 1 : 0, x = lead + st.cardP * (span - lead);
      el.querySelectorAll('[data-i]').forEach((row) => { const i = +row.dataset.i, k = i < c.fromN ? 1 : i < c.upto ? clamp(x - (i - c.fromN), 0, 1) : 0; row.style.opacity = k; row.style.transform = `translateY(${(1 - k) * 10}px)`; });
      const lastOn = [...el.querySelectorAll('[data-i]')].filter((row) => +row.style.opacity > 0.05).pop();
      if (lastOn && c.kind === 'flow') { const body = el; const r1 = lastOn.getBoundingClientRect(), r0 = body.getBoundingClientRect(); if (r1.bottom > r0.bottom - 130) body.scrollTop += r1.bottom - (r0.bottom - 130); if (r1.top < r0.top + 60) body.scrollTop -= r0.top + 60 - r1.top; }
      return;
    }
    if ((c.kind === 'flow' || c.kind === 'check' || c.kind === 'needheld' || c.kind === 'compare' || c.kind === 'keys') && c.upto == null && !c.phase) { const cnt = el.querySelectorAll('[data-i]').length, x = st.cardP * cnt; n = Math.min(cnt, Math.floor(x) + 1); p = x - Math.floor(x); if (st.cardP >= 0.999) { n = cnt; p = 1; } }
    el.querySelectorAll('[data-i]').forEach((x) => {
      const i = +x.dataset.i, k = i < n - 1 ? 1 : i === n - 1 ? p : 0; x.style.opacity = k; x.style.transform = `translateY(${(1 - k) * 12}px)`;
      if (x.classList.contains('big')) {   // the numbers in a big line count up as it comes in
        if (x.dataset.t == null) x.dataset.t = x.textContent;
        x.textContent = x.dataset.t.replace(/\d[\d,]*(\.\d+)?/g, (m) => { const v = parseFloat(m.replace(/,/g, '')), dec = (m.split('.')[1] || '').length; return (v * clamp(k * 1.15, 0, 1)).toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }); });
      }
    });
    if (c.kind === 'glyph') {   // the next step animates in; any other jump lands on its built end (the designer's pages/packs.html)
      const f = el.querySelector('iframe.glyph'), stepN = st.cardN;
      if (f && f.contentWindow && glyphStep !== stepN + '|' + K.theme) { glyphStep = stepN + '|' + K.theme; const send = () => { try { f.contentWindow.postMessage({ pack: c.name, step: stepN, theme: K.theme }, '*'); } catch {} }; send(); f.onload = send; }
      return;
    }
    if (c.kind === 'compare') {
      const rows = el.querySelectorAll('.cm'), cnt = rows.length, x = st.cardP * cnt;
      rows.forEach((r, i) => { const k = c.phase === 'before' ? clamp(x - i, 0, 1) : 1; r.style.opacity = 1; r.style.transform = 'none';
        r.querySelector('[data-col=b]').style.opacity = c.phase === 'before' ? k : 1;
        const ka = c.phase === 'after' ? clamp(x - i, 0, 1) : c.phase === 'before' ? 0 : 1;
        r.querySelector('[data-col=a]').style.opacity = ka; r.querySelector('.rb').style.opacity = ka; });
      const eb = el.querySelector('.end.e-before'), ea = el.querySelector('.end.e-after');
      if (eb) eb.style.opacity = c.phase === 'before' ? clamp(x - cnt + 1, 0, 1) : 1;
      if (ea) ea.style.opacity = c.phase === 'after' ? clamp(x - cnt + 1, 0, 1) : c.phase === 'before' ? 0 : 1;
    }
    if (c.kind === 'gap') {   // stage 1: the mandate dot; 2: the reach circle grows; 3: the gap turns red
      const g = el.querySelector('.gap'); if (!g) return;
      const s1 = n >= 2 ? (n === 2 ? p : 1) : 0, s2 = n >= 3 ? (n === 3 ? p : 1) : 0;
      g.querySelector('.reachc').setAttribute('r', 34 + 216 * s1); g.querySelector('.gapring').style.opacity = s2; g.querySelector('.gapring').setAttribute('r', 34 + 216 * s1);
      g.querySelector('.gl.r').style.opacity = s1; g.querySelector('.gl.g').style.opacity = s2;
      g.querySelectorAll('.ritems li').forEach((li, i, all) => { const k = clamp(s1 * all.length - i, 0, 1); li.style.opacity = k; li.style.transform = 'none'; });
    }
    if (c.kind === 'lights') {
      const all = el.querySelectorAll('.light'), on = c.upto == null ? (st.cardP * all.length) : st.cardN === 99 ? all.length : st.cardN;
      all.forEach((x, i) => { const k = clamp(on - i, 0, 1), r = (pick(data || {}, c.from || 'after.results') || [])[i]; x.style.opacity = 0.25 + 0.75 * k; x.classList.toggle('held', k > 0.5 && r && r.got.startsWith(r.expected)); x.classList.toggle('broke', k > 0.5 && r && !r.got.startsWith(r.expected)); x.style.transform = 'none'; });
    }
  }

  // the Runs repo's summary.json (every run that started with a push, added up), read once
  let SUMMARY = null, sumLoading = false;
  function loadSummary() { if (SUMMARY || sumLoading) return; sumLoading = true; fetch(RAW('summary.json'), { cache: 'no-store' }).then((r) => r.json()).then((j) => { SUMMARY = j; }).catch(() => { sumLoading = false; }); }
  setInterval(() => { if (!SUMMARY) return; fetch(RAW('summary.json'), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.updated !== SUMMARY.updated) toast('live: a new run landed in the Runs repo'); SUMMARY = j; }).catch(() => {}); }, 60000);

  // ---------- the bars (the cost story): the same tokens, priced on each tier, one bar per step
  function drawBars(st) {
    const el = d3.select('#bars').style('display', '');
    $('#counter').style.display = 'none'; badge(['real', 'REAL RUN · ' + (st.scene.run || '') + ' · Claude prices: list prices for the same tokens']);
    $('#svg').style.display = 'none'; if (window.STAGE_UNIVERSE) window.STAGE_UNIVERSE.hide();
    const m = G.metrics || {}, pc = m.potential_claude_usd || {};
    const items = (st.bars.items || []).map((it) => ({ ...it, v: it.of === 'openrouter' ? m.openrouter_usd : it.of ? pc[it.of] : it.value }));
    const max = Math.max(...items.map((x) => x.v || 0), 1e-9);
    const rows = el.selectAll('div.bar').data(items, (x) => x.label);
    rows.exit().remove();
    const re = rows.enter().append('div').attr('class', 'bar');
    re.append('span').attr('class', 'bl'); re.append('div').attr('class', 'track').append('i'); re.append('b');
    rows.merge(re).each(function (x, i) {
      const shown = i < st.barsN - 1 ? 1 : i === st.barsN - 1 ? st.barsP : 0;
      this.style.opacity = shown > 0 ? 1 : 0.0;
      this.querySelector('.bl').textContent = x.label;
      this.querySelector('i').style.width = (100 * (x.v || 0) / max) * shown + '%';
      this.querySelector('i').style.background = x.color || 'var(--alt-A3)';
      const top = items[0] && items[0].v, ratio = i > 0 && top && x.v ? Math.round(top / x.v) : 0;
      this.querySelector('b').textContent = x.v == null ? 'n/a' : '$' + ((x.v || 0) * shown).toFixed(x.v < 0.1 ? 4 : 2) + (ratio > 1 && shown > 0.98 ? `  ·  ${ratio}× less` : '');
    });
    el.select('.note').remove();
    el.append('p').attr('class', 'note').text(`${G.title}: ${fmtN((m.tokens_in || 0) + (m.tokens_out || 0))} tokens, ${m.llm_calls || 0} calls. The Claude prices are list prices for the same tokens (the run file's potential_claude_usd); OpenRouter is what was paid.`);
  }

  // ---------- the designer's views (assets/swarm-views.js + css/swarm-themes.css), loaded the first time they are chosen.
  // The stage's clock drives them: setTime during a replay (held at the built end), highlight from the step.
  let SV = null, svRun = null, svT = undefined, svHi = undefined, svLoading = false, svKey = '';
  function loadViews() {
    if (window.SwarmViews || svLoading) return; svLoading = true;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/swarm-themes.css'; document.head.appendChild(l);
    const s2 = document.createElement('script'); s2.src = 'assets/swarm-views.js'; s2.onerror = () => { svLoading = false; toast("The designer's views did not load."); }; document.body.appendChild(s2);
  }
  function drawViews(st) {
    const el = $('#views');
    $('#svg').style.display = 'none'; if (window.STAGE_UNIVERSE) window.STAGE_UNIVERSE.hide(); el.style.display = ''; $('#vpick').style.display = '';
    if (!window.SwarmViews) { loadViews(); return; }
    const key = st.si + '|' + K.vmode + '|' + K.vlayout;
    if (!SV || svRun !== G.run || svKey !== key) {
      if (SV && svRun === G.run) { SV.setMode(K.vmode); SV.setLayout(K.vlayout); }
      else { if (SV) SV.destroy(); SV = window.SwarmViews.render(el, G.run, { mode: K.vmode, layout: K.vlayout }); SV.on('select', (n) => { if (n) { const mine = G.byId.get(n.id); if (mine) openBox(mine, null); } }); svT = undefined; svHi = undefined; }
      svRun = G.run; svKey = key;
    }
    const tt = st.replay != null && st.replay < 1 ? st.replay * G.T : null;
    if (tt !== svT && (tt == null || svT == null || Math.abs(tt - svT) > 30)) { svT = tt; SV.setTime(tt); }
    const hi = st.highlight ? st.highlight.filter((a) => /^A[0-4]$|^P$/.test(a)).join(',') || null : null;
    if (hi !== svHi) { svHi = hi; SV.highlight(hi); }
    $('#simflag').style.display = 'none'; $('#counter').style.display = 'none';
  }
  function hideViews() { $('#views').style.display = 'none'; $('#vpick').style.display = 'none'; }

  // ---------- 3D: stage/universe.js, loaded the first time the mode is asked for
  let uniLoading = false;
  function loadUniverse() {
    if (uniLoading || window.STAGE_UNIVERSE) return; uniLoading = true;
    const s = document.createElement('script'); s.src = 'stage/universe.js'; s.onerror = () => { uniLoading = false; toast('The 3D mode did not load: the flat view stays.'); }; document.body.appendChild(s);
  }

  // ---------- drag: a node dragged stays where it is put (an anchor by hand); double-click frees it... shift-drag to pin
  function drag() {
    return d3.drag()
      .on('start', (e, n) => { if (sim) sim.alphaTarget(0.2).restart(); n.fx = n.x; n.fy = n.y; })
      .on('drag', (e, n) => { n.fx = n.x = n.tx = e.x; n.fy = n.y = n.ty = e.y; })
      .on('end', (e, n) => { if (sim) sim.alphaTarget(0); if (!e.sourceEvent.shiftKey) { if (sim) { n.fx = null; n.fy = null; } } });
  }

  // ---------- camera
  function fit(instant) {
    if (curMode === 'views' && SV) { SV.fit(); return; }
    if (!G || !svg) return;
    const ns = (drawn || G).nodes.filter((n) => n.x != null && !(drawn && drawn.nodes.includes(n) && gNodes.selectAll('g.n').filter((d) => d === n).style('display') === 'none'));
    if (!ns.length) return;
    // the frame: the nodes and their labels, in graph units; the caption and the counter take real screen space, reserved in pixels
    const pad = 40; let x0 = d3.min(ns, (n) => n.x) - pad, x1 = d3.max(ns, (n) => n.x) + pad + 80, y0 = d3.min(ns, (n) => n.y) - pad, y1 = d3.max(ns, (n) => n.y) + pad;
    try { const b = gLabels.node().getBBox(); if (b.width) { x0 = Math.min(x0, b.x - 16); x1 = Math.max(x1, b.x + b.width + 16); y0 = Math.min(y0, b.y - 16); y1 = Math.max(y1, b.y + b.height + 16); } } catch (e) { /* no labels yet */ }
    const sr = svg.node().getBoundingClientRect(), cap = $('#caption'), cnt = $('#counter');
    const seen = (e) => e && e.textContent && e.style.display !== 'none' && getComputedStyle(e).display !== 'none';
    const bot = seen(cap) ? clamp(sr.bottom - cap.getBoundingClientRect().top + 14, 0, H * 0.4) : 0;
    const top = seen(cnt) ? clamp(cnt.getBoundingClientRect().bottom - sr.top + 10, 0, H * 0.3) : 0;
    const Hh = H - top - bot;
    const k = clamp(Math.min(W / (x1 - x0), Hh / (y1 - y0)), 0.15, 2.5);
    const tr = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, top + Hh / 2 - k * (y0 + y1) / 2).scale(k);
    (instant ? svg : svg.transition().duration(600)).call(zoom.transform, tr);
    userZoomed = false;
  }
  // the presenter's "zoom in on that one": the unit and everything below it (its children, theirs, ...), framed
  function zoomToSubtree(n0) {
    const g = drawn || G; if (!g) return;
    const kids = new Map(); g.links.forEach((l) => { const a = idOf(l.source), b = idOf(l.target); if (!kids.has(a)) kids.set(a, []); kids.get(a).push(b); });
    const seen = new Set([n0.id]), q = [n0.id];
    const hub = (id) => { const n = g.byId.get(id); return !n || ['M', 'D', 'X', 'P'].includes(n.alt); };   // shared hubs (the router, datasets, assets) are not part of anyone's subtree
    while (q.length && seen.size < 400) { for (const c of kids.get(q.shift()) || []) if (!seen.has(c) && !hub(c)) { seen.add(c); q.push(c); } }
    const ns = [...seen].map((id) => g.byId.get(id)).filter((n) => n && n.x != null);
    if (!ns.length) return;
    const pad = 60, x0 = d3.min(ns, (n) => n.x) - pad, x1 = d3.max(ns, (n) => n.x) + pad + 120, y0 = d3.min(ns, (n) => n.y) - pad, y1 = d3.max(ns, (n) => n.y) + pad + 60;
    const k = clamp(Math.min(W / (x1 - x0), H / (y1 - y0)), 0.2, 6);
    svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k));
    userZoomed = true;   // the camera stays there until 0, fit, or the next scene
  }
  function zoomBy(f) { if (curMode === 'views' && SV) { SV.zoom(1 / f); return; } svg.transition().duration(250).call(zoom.scaleBy, f); }

  // ---------- panes, controls, captions
  function renderStory() {
    const acts = []; SCENES.forEach((s, si) => { if (s.free) return; let a = acts.find((x) => x.name === actName(s)); if (!a) acts.push(a = { name: actName(s), scenes: [] }); a.scenes.push({ s, si }); });
    const curAct = STEPS[stepAt(t)] ? actName(STEPS[stepAt(t)].scene) : acts[0] && acts[0].name;
    const packs = Object.entries(PACKS);
    $('#packs').innerHTML = packs.length ? `<a class="pk ${PACK ? '' : 'cur'}" href="#">the whole story</a>` + packs.filter(([k, v]) => !v.hidden || PACK === k).map(([k, v]) => `<a class="pk ${PACK === k ? 'cur' : ''}" href="#pack=${esc(k)}" title="${esc(v.about || '')}">${esc(v.title || k)}</a>`).join('') : '';
    $('#story').innerHTML = acts.map((a, ai) => `<details ${a.name === curAct ? 'open' : ''} data-act="${esc(a.name)}"><summary>${esc(a.name)}</summary>${a.scenes.map(({ s, si }) => `<button class="sc" data-si="${si}"><b>${esc(s.title)}</b><small>${s.steps.length} steps${s.run && s.run.startsWith('sim:') ? ' · simulated' : ''}</small></button>`).join('')}</details>`).join('') || '<p class="muted">No scenes yet (stage/scenes.json).</p>';
    $('#runs').innerHTML = FREE.map((s, i) => `<button class="sc" data-free="${i}"><b>${esc(s.title)}</b></button>`).join('');
    const ARROW = { left: '←', right: '→', top: '↑', bottom: '↓', middle: '↔', center: '◎' };
    $('#legend').innerHTML = ALT.filter((a) => a !== '?').map((a) => { const an = (K.userAnchors || {})[a]; return `<button class="chip ${extraHidden.has(a) ? 'off' : ''}" data-alt="${a}" title="click: show or hide · shift-click: only this · alt-click or right-click: anchor it left, right, top, bottom (force view)"><i style="background:var(--alt-${a})"></i>${esc(ALT_NAME[a])}${an ? ` <b class="anc">${ARROW[an] || an}</b>` : ''}</button>`; }).join('');
  }
  function renderSide() {
    if (!G) return;
    const runPane = $('#runmeta').closest('details'); if (runPane) runPane.open = !!G.nodes.length;
    if (!G.nodes.length && !G.error) { $('#cards').innerHTML = ''; $('#runmeta').innerHTML = '<p class="muted">No run on this scene: a card, with its source under it.</p>'; return; }
    const m = G.metrics || {}, r = G.run || {};
    const cards = G.sim ? [['simulated', 'no run file: an illustration']] : r.counts ? [[fmtN(G.nodes.length), 'agents and sessions'], ...Object.entries(r.counts).map(([k, v]) => [String(v), k.replace(/_/g, ' ')])] : [
      [fmtN(G.nodes.length), 'units'], [fmtN(m.llm_calls || 0), 'model calls'], [m.valid_calls != null ? `${m.valid_calls}/${m.llm_calls}` : '–', 'valid'],
      [m.peak_concurrency != null ? fmtN(m.peak_concurrency) : '–', 'at once (peak)'], [m.openrouter_usd != null ? '$' + m.openrouter_usd : '–', 'paid (OpenRouter)'],
      [m.potential_claude_usd ? '$' + m.potential_claude_usd['claude-sonnet-5.5'] : '–', 'same tokens on Sonnet'], [r.wall_ms ? (r.wall_ms / 1000).toFixed(1) + ' s' : '–', 'wall time']];
    $('#cards').innerHTML = cards.map(([b, s]) => `<div class="card"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
    $('#runmeta').innerHTML = G.error ? `<p class="bad">Could not load this run: ${esc(G.error)}</p>` : `<p><b>${esc(G.title)}</b>${r.environment ? `<br><small>${esc(r.environment.label || '')}${r.environment.account ? ' · ' + esc(r.environment.account) : ''}</small>` : ''}${r.run_url ? `<br><small><a href="${esc(r.run_url)}" target="_blank" rel="noopener">the GitHub Action</a>${r.commit ? ' · commit ' + esc(String(r.commit).slice(0, 7)) : ''}</small>` : ''}</p>`;
  }
  let lastCtl = '';
  function renderControls(st) {
    const key = [st && st.k, playing, K.rate, Math.round(t * 4)].join('|');
    if (key === lastCtl) return; lastCtl = key;
    $('#play').textContent = playing ? '❚❚' : '▶';
    $('#play').setAttribute('aria-label', playing ? 'pause' : 'play');
    $('#rate').textContent = K.rate + '×';
    if (!st) { $('#where').textContent = 'no scenes'; return; }
    const mine = STEPS.filter((x) => x.si === st.si);
    $('#where').innerHTML = `<b>${esc(actName(st.scene))}</b> · ${esc(st.scene.title)} <small>${st.si + 1}/${SCENES.length}</small>`;
    $('#steps').innerHTML = mine.map((x) => { const cur = x.i === st.i, done = x.i < st.i || (cur && st.p >= 0.999); return `<button class="st ${cur ? 'cur' : ''} ${done ? 'done' : ''}" data-k="${STEPS.indexOf(x)}" title="${esc(x.step.label || '')}"><i style="width:${cur ? st.p * 100 : done ? 100 : 0}%"></i><span>${esc(x.step.label || 'step ' + (x.i + 1))}</span></button>`; }).join('');
    document.querySelectorAll('#story .sc').forEach((b) => b.classList.toggle('cur', +b.dataset.si === st.si));
  }
  let lastCap = '';
  function renderCaption(st, mode) {
    const key = st.si + '|' + st.i + '|' + mode + '|' + st.caption;
    if (key === lastCap) return; lastCap = key;
    $('#caption').textContent = st.caption || '';
    $('#say').innerHTML = `<h3>${esc(st.scene.title)}</h3><p>${esc(st.scene.say || '')}</p>${st.scene.cue ? `<p class="cue">${esc(st.scene.cue)}</p>` : ''}`;
    document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode));
  }
  // the box: everything the files say about one unit, zooming out of the node that was clicked. Facts only, each with
  // where it comes from; what the run does not record says "not recorded".
  const HOLDS = {   // how.html, "Who holds what" (the mandate by altitude)
    P: ['instructs', 'only a person instructs; everything else is material'],
    A4: ['routes work across agents and sessions', 'a swarm conductor: starts agents only at its person\'s word'],
    A3: ['plans, remembers, wakes itself, holds keys and connectors', 'the only altitude with memory and its own wake'],
    A2: ['reads, asks, checks, retries', 'cannot start others, schedule or push'],
    A1: ['one prompt in, one answer out', 'cannot use any tool'],
    A0: ['runs the code it is given (reads public data)', 'holds no keys'],
  };
  async function openBox(n, ev) {
    const box = $('#box'), r = (G && G.run) || {};
    const call = (r.calls || []).find((c) => c.unit === n.id);
    const rows = [];
    const row = (k, v, src) => rows.push(`<tr><th>${esc(k)}</th><td>${v == null || v === '' ? '<span class="muted">not recorded</span>' : esc(v)}${src ? `<small>${esc(src)}</small>` : ''}</td></tr>`);
    row('what it is', `${n.label} · ${ALT_NAME[n.alt] || n.alt} · ${n.kind}`);
    if (HOLDS[n.alt]) { row('its mandate', HOLDS[n.alt][0], 'how.html, Who holds what'); row('what it cannot do', HOLDS[n.alt][1], 'how.html'); }
    if (n.role) row('role', n.role, 'data/agents.json');
    if (n.commits) row('commits, last 24 h', `${n.commits} (last at ${n.lastCommit})`, 'data/agent-activity.json, from the git logs');
    if (r.environment) row('where it ran', [r.environment.label, r.environment.account].filter(Boolean).join(' · '), 'the run file');
    if (n.env) row('environment', [n.env, n.account].filter(Boolean).join(' · '));
    let pk = null;
    if (r.packet) try { pk = await (await fetch(`packets/${r.packet}/packet.json`)).json(); pk = pk.body || pk; } catch {}
    if (!pk && r.request) try { pk = await (await fetch(`https://raw.githubusercontent.com/${RUNS_REPO}/dev/requests/${r.request}/packet.json`)).json(); } catch {}
    if (pk && ['A3', 'A2', 'A1', 'A0', 'T'].includes(n.alt)) {
      row('the request\'s mandate', pk.mandate, r.packet ? `packets/${r.packet}/packet.json` : `Runs requests/${r.request}/packet.json`);
      row('its grant', (pk.grant || []).join(' · '), 'the signed packet');
      if (pk.budget) row('its budget', Object.entries(pk.budget).map(([k, v]) => `${k} ${v}`).join(' · '), 'the signed packet');
    }
    if (call) {
      row('model', call.served || call.model); row('tokens', `${fmtN(call.tokens_in)} in · ${fmtN(call.tokens_out)} out`); row('cost', '$' + call.cost_usd); row('latency', call.latency_ms + ' ms');
      row('answer', call.valid ? `valid (${call.verdict})` : `not valid (${call.status})`);
      row('prompt sha256', call.signed && call.signed.body && call.signed.body.prompt_sha256, 'the prompt itself is never stored');
      row('answer sha256', call.answer_sha256 ? `${call.answer_sha256} (${call.answer_chars} chars)` : null, 'the answer itself is never stored');
      row('signed by', call.signed && call.signed.by ? `${call.signed.by.fp} (a key made for this call)` : n.key_fp, 'the run file');
    } else if (n.key_fp) row('its key', n.key_fp + ' (made for this unit)');
    if (n.alt === 'A3' || n.kind === 'agent') {
      row('the run\'s signature', r.signed_by || r.request_signed_by || (r.by && r.by.fp) || null, 'the run file');
      row('connectors', null, 'which connectors its session held is not in the run file');
    }
    if (n.alt === 'D') { row('read from', n.url); row('bytes', n.bytes); row('sha256', n.sha256); row('read at', n.read_at); }
    if (n.sim) row('note', 'simulated: no run file holds this unit');
    box.innerHTML = `<div class="bx"><header><i style="background:${color(n)}"></i><div><b>${esc(n.label)}</b><small>${esc(ALT_NAME[n.alt] || n.alt)}</small></div><button aria-label="close" title="close (Esc)">✕</button></header><table>${rows.join('')}</table></div>`;
    const sr = $('#stage').getBoundingClientRect();
    box.style.transformOrigin = `${(ev && ev.clientX ? ev.clientX - sr.left : sr.width / 2)}px ${(ev && ev.clientY ? ev.clientY - sr.top : sr.height / 2)}px`;
    box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
    box.querySelector('button').onclick = () => box.classList.remove('on');
  }
  function showInfo(n) {
    const links = G.links.filter((l) => idOf(l.source) === n.id || idOf(l.target) === n.id).length;
    $('#info').innerHTML = `<b>${esc(n.label)}</b><br><small>${esc(ALT_NAME[n.alt] || n.alt)} · ${esc(n.kind)}${n.model ? ' · ' + esc(n.model) : ''}${n.valid != null ? ' · ' + (n.valid ? 'valid' : 'not valid') : ''}${n.cost != null ? ' · $' + n.cost : ''}${n.tokens ? ' · ' + fmtN(n.tokens) + ' tokens' : ''} · ${links} links${n.key_fp ? ' · its own key ' + esc(n.key_fp) : ''}${n.role ? '<br>' + esc(n.role) : ''}${n.started ? ' · started ' + esc(n.started) : ''}${n.commits ? ' · ' + n.commits + ' commits in 24 h' : ''}${n.sim ? ' · simulated' : ''}</small><br><small class="muted">click: open its box · double-click: focus on its neighbours · drag: move (shift: pin)</small>`;
  }
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('on'), 2200); }

  // ---------- panes: collapse, resize, focus
  function applyPanes() {
    const root = document.documentElement;
    root.style.setProperty('--lw', (K.hideL ? 0 : K.left) + 'px');
    root.style.setProperty('--rw', (K.hideR ? 0 : K.right) + 'px');
    root.classList.toggle('hideL', K.hideL); root.classList.toggle('hideR', K.hideR);
    root.style.setProperty('--text', K.text); root.style.setProperty('--label-scale', K.label); root.style.setProperty('--node-scale', K.node); root.style.setProperty('--labels', K.labels ? 1 : 0);
    root.dataset.theme = K.theme;
    $('#k-mode').value = K.mode; $('#k-theme').value = K.theme;
    for (const k of ['text', 'label', 'node', 'link']) { const el = $('#k-' + k); if (el) el.value = K[k]; }
    $('#k-labels').checked = K.labels; $('#k-anchors').checked = K.anchors; $('#k-auto').checked = K.auto; if ($('#k-brisk')) $('#k-brisk').checked = K.brisk;
    saveK();
  }
  function resizer(el, side) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const move = (ev) => { if (side === 'L') { K.hideL = false; K.left = clamp(ev.clientX, 140, innerWidth * 0.5); } else { K.hideR = false; K.right = clamp(innerWidth - ev.clientX, 160, innerWidth * 0.5); } applyPanes(); };
      const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); lastLayoutKey = ''; };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
    });
    el.addEventListener('dblclick', () => { if (side === 'L') K.hideL = !K.hideL; else K.hideR = !K.hideR; applyPanes(); });
  }
  function focusMode(on) { document.documentElement.classList.toggle('focus', on ?? !document.documentElement.classList.contains('focus')); lastLayoutKey = ''; setTimeout(() => fit(), 80); }

  // ---------- keys (the player's map, plus the stage's own)
  const KEYS = [
    ['→ / tap', 'next step: plays it, holds on its end'], ['←', 'back to the previous stop (the end of the step before)'], ['Space', 'play or pause'],
    ['PageDown / PageUp', 'next / previous scene'], ['Home / End', 'the first scene / the end of the last'], ['1–6', 'view: top-down, tree, radial, force, 3D, the designer\'s views'],
    ['L', 'labels on or off'], ['+ / −', 'text size'], ['] / [', 'node size'], ['0', 'fit to screen'], ['= / -', 'zoom in / out (or the wheel)'],
    ['A', 'anchors on or off (alt-click or right-click an altitude to anchor it)'], ['G', 'go to any scene or step'], ['Z', 'focus: the stage only'], ['Q / E', 'hide the left / the right pane'], ['T', 'next theme'], ['s / S', 'speed: 0.5×, 1×, 2×, 5×, 20× (→ in the middle of a step: all at once)'], ['drag the step bars', 'scrub within a scene'], ['H', 'auto-advance'], ['B', 'brisk: one press of → plays a whole scene; ← to the end of the one before (or #...&brisk)'], ['F', 'fullscreen'], ['?', 'this help'], ['Esc', 'clear the focus'], ['double-click a unit', 'zoom to it and everything it started (0 to come back)'], ['click a unit', 'open its box'],
  ];
  const THEMES = ['gravity', 'night', 'ember', 'blueprint', 'paper', 'newsprint'];
  function onKey(e) {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    const k = e.key; let used = true;
    if (k === 'ArrowRight') next(); else if (k === 'ArrowLeft') prev();
    else if (k === ' ' || k === 'k') { playing = !playing; stopAt = null; if (playing && t >= TOTAL - 0.01) t = 0; }
    else if (k === 'PageDown' || k === 'ArrowDown') sceneJump(1); else if (k === 'PageUp' || k === 'ArrowUp') sceneJump(-1);
    else if (k === 'Home') gotoScene(0); else if (k === 'End') gotoScene(SCENES.length - 1, true);
    else if (/^[1-6]$/.test(k)) { K.mode = modeOverride = Object.keys(MODES).find((m) => MODES[m].key === k); applyPanes(); lastLayoutKey = ''; userZoomed = false; setTimeout(() => fit(), 400); setTimeout(() => fit(), 1600); toast(MODES[K.mode].name); }
    else if (k === 'l' || k === 'L') { K.labels = !K.labels; applyPanes(); }
    else if (k === '+') { K.text = +(clamp(K.text + 0.1, 0.6, 2.4)).toFixed(2); K.label = +(clamp(K.label + 0.1, 0.5, 3)).toFixed(2); applyPanes(); }
    else if (k === '−' || k === '_') { K.text = +(clamp(K.text - 0.1, 0.6, 2.4)).toFixed(2); K.label = +(clamp(K.label - 0.1, 0.5, 3)).toFixed(2); applyPanes(); }
    else if (k === ']') { K.node = +(clamp(K.node + 0.15, 0.3, 4)).toFixed(2); applyPanes(); } else if (k === '[') { K.node = +(clamp(K.node - 0.15, 0.3, 4)).toFixed(2); applyPanes(); }
    else if (k === '0') fit(); else if (k === '=') zoomBy(1.3); else if (k === '-') zoomBy(1 / 1.3);
    else if (k === 'a' || k === 'A') { K.anchors = !K.anchors; applyPanes(); lastLayoutKey = ''; toast('anchors ' + (K.anchors ? 'on' : 'off')); }
    else if (k === 'z' || k === 'Z') focusMode(); else if (k === 'q' || k === 'Q') { K.hideL = !K.hideL; applyPanes(); lastLayoutKey = ''; } else if (k === 'e' || k === 'E') { K.hideR = !K.hideR; applyPanes(); lastLayoutKey = ''; }
    else if (k === 't' || k === 'T') { K.theme = THEMES[(THEMES.indexOf(K.theme) + 1) % THEMES.length]; applyPanes(); toast('theme: ' + K.theme); }
    else if (k === 's' || k === 'S') { const R = [0.5, 1, 2, 5, 20], i = R.indexOf(K.rate); K.rate = R[(i < 0 ? 1 : i + (k === 'S' ? R.length - 1 : 1)) % R.length]; saveK(); toast('speed ' + K.rate + '×'); }
    else if (k === 'h' || k === 'H') { K.auto = !K.auto; applyPanes(); toast('auto-advance ' + (K.auto ? 'on' : 'off')); }
    else if (k === 'b' || k === 'B') { K.brisk = !K.brisk; applyPanes(); toast(K.brisk ? 'brisk: one press plays a whole scene' : 'step by step'); }
    else if (k === 'f' || k === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
    else if (k === '?') $('#help').toggleAttribute('open');
    else if (k === 'g' || k === 'G') openGoto();
    else if (k === 'Escape') { focusId = null; $('#box').classList.remove('on'); $('#help').removeAttribute('open'); $('#goto').removeAttribute('open'); document.documentElement.classList.remove('focus'); }
    else used = false;
    if (used) e.preventDefault();
  }

  // ---------- G: go to any scene or step (the talk player's G)
  function openGoto() {
    const el = $('#goto');
    if (el.hasAttribute('open')) { el.removeAttribute('open'); return; }
    el.innerHTML = '<h2>Go to</h2>' + SCENES.map((sc, si) => `<div class="g-sc"><b>${esc(sc.act || '')} · ${esc(sc.title)}</b>${STEPS.filter((x) => x.si === si).map((x) => `<button data-k="${STEPS.indexOf(x)}">${esc(x.step.label || 'step ' + (x.i + 1))}</button>`).join('')}</div>`).join('');
    el.setAttribute('open', '');
    el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const S = STEPS[+b.dataset.k]; t = S.e - 1e-3; playing = false; stopAt = null; el.removeAttribute('open'); };
  }

  // ---------- wiring
  function wire() {
    addEventListener('keydown', onKey);
    $('#play').onclick = () => { playing = !playing; stopAt = null; if (playing && t >= TOTAL - 0.01) t = 0; };
    $('#next').onclick = next; $('#prev').onclick = prev;
    $('#nextS').onclick = () => sceneJump(1); $('#prevS').onclick = () => sceneJump(-1);
    $('#rate').onclick = () => onKey({ key: 's', target: document.body, preventDefault() {} });
    $('#fit').onclick = () => fit(); $('#zin').onclick = () => zoomBy(1.3); $('#zout').onclick = () => zoomBy(1 / 1.3);
    $('#focusbtn').onclick = () => focusMode(); $('#fs').onclick = () => onKey({ key: 'f', target: document.body, preventDefault() {} });
    $('#helpbtn').onclick = () => $('#help').toggleAttribute('open');
    $('#tglL').onclick = () => { K.hideL = !K.hideL; applyPanes(); lastLayoutKey = ''; };
    $('#tglR').onclick = () => { K.hideR = !K.hideR; applyPanes(); lastLayoutKey = ''; };
    // the step bars: a click plays that step; a drag scrubs through the scene (the presenter's hand on the clock)
    let scrub = null;
    const scrubTo = (e) => { const b = document.elementFromPoint(e.clientX, $('#steps').getBoundingClientRect().top + 8); const st = b && b.closest && b.closest('.st'); if (!st) return; const S = STEPS[+st.dataset.k], r = st.getBoundingClientRect(); t = S.s + clamp((e.clientX - r.left) / r.width, 0, 0.999) * (S.e - S.s); playing = false; stopAt = null; };
    $('#steps').addEventListener('pointerdown', (e) => { scrub = { x: e.clientX, moved: false }; $('#steps').setPointerCapture(e.pointerId); });
    $('#steps').addEventListener('pointermove', (e) => { if (!scrub) return; if (Math.abs(e.clientX - scrub.x) > 4) scrub.moved = true; if (scrub.moved) scrubTo(e); });
    $('#steps').addEventListener('pointerup', (e) => { const was = scrub; scrub = null; if (was && !was.moved) { const b = e.target.closest('.st'); if (!b) return; const S = STEPS[+b.dataset.k]; t = S.s; stopAt = S.e - 1e-3; playing = true; } });
    $('#story').addEventListener('click', (e) => { const b = e.target.closest('.sc'); if (b) { gotoScene(+b.dataset.si); next(); } });
    $('#runs').addEventListener('click', (e) => { const b = e.target.closest('.sc'); if (b) playScene(FREE[+b.dataset.free]); });
    const cycleAnchor = (a) => { const order = [undefined, 'left', 'right', 'top', 'bottom', 'center']; const u = K.userAnchors || (K.userAnchors = {}); const nx = order[(order.indexOf(u[a]) + 1) % order.length]; if (nx) u[a] = nx; else delete u[a]; K.anchors = true; applyPanes(); lastLayoutKey = ''; renderStory(); userZoomed = false; setTimeout(() => fit(), 600); setTimeout(() => fit(), 1800); toast(`${ALT_NAME[a]}: ${nx ? 'anchored ' + nx : 'free'}${(st0() || {}).mode !== 'force' && modeOverride !== 'force' ? ' (anchors act in the force view: 4)' : ''}`); };
    const st0 = () => stateAt(t);
    $('#legend').addEventListener('contextmenu', (e) => { const b = e.target.closest('.chip'); if (!b) return; e.preventDefault(); cycleAnchor(b.dataset.alt); });
    $('#legend').addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return; const a = b.dataset.alt;
      if (e.altKey) { cycleAnchor(a); return; }
      if (e.shiftKey) { const all = new Set(ALT); all.delete(a); if ([...extraHidden].length === ALT.length - 1 && !extraHidden.has(a)) extraHidden.clear(); else { extraHidden.clear(); all.forEach((x) => extraHidden.add(x)); } }
      else if (extraHidden.has(a)) extraHidden.delete(a); else extraHidden.add(a);
      store.set('hiddenAlts', [...extraHidden]); renderStory();
    });
    $('#modes').innerHTML = Object.entries(MODES).map(([k, m]) => `<button data-mode="${k}" title="${esc(m.name)} (${m.key})">${esc(m.name)}</button>`).join('');
    $('#modes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { K.mode = modeOverride = b.dataset.mode; applyPanes(); lastLayoutKey = ''; setTimeout(() => fit(), 400); } });
    $('#k-mode').innerHTML = Object.entries(MODES).map(([k, m]) => `<option value="${k}">${esc(m.name)}</option>`).join('');
    $('#k-theme').innerHTML = THEMES.map((x) => `<option>${x}</option>`).join('');
    $('#k-mode').onchange = (e) => { K.mode = modeOverride = e.target.value; applyPanes(); lastLayoutKey = ''; setTimeout(() => fit(), 400); };
    $('#k-theme').onchange = (e) => { K.theme = e.target.value; applyPanes(); };
    for (const k of ['text', 'label', 'node', 'link']) $('#k-' + k).oninput = (e) => { K[k] = +e.target.value; applyPanes(); };
    $('#k-labels').onchange = (e) => { K.labels = e.target.checked; applyPanes(); };
    $('#k-anchors').onchange = (e) => { K.anchors = e.target.checked; applyPanes(); lastLayoutKey = ''; };
    $('#k-auto').onchange = (e) => { K.auto = e.target.checked; applyPanes(); };
    if ($('#k-brisk')) $('#k-brisk').onchange = (e) => { K.brisk = e.target.checked; applyPanes(); };
    $('#vpick').innerHTML = `<select id="v-mode" title="the designer's mode">${['flat', 'blueprint', 'heat', 'neon', 'orbit', 'three'].map((m) => `<option ${m === K.vmode ? 'selected' : ''}>${m}</option>`).join('')}</select><select id="v-layout" title="layout">${['down', 'right', 'radial', 'tree'].map((m) => `<option ${m === K.vlayout ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
    $('#v-mode').onchange = (e) => { K.vmode = e.target.value; saveK(); }; $('#v-layout').onchange = (e) => { K.vlayout = e.target.value; saveK(); };
    $('#k-reset').onclick = () => { store.set('knobs', {}); store.set('hiddenAlts', []); location.reload(); };
    $('#helpkeys').innerHTML = KEYS.map(([k, d]) => `<dt>${esc(k)}</dt><dd>${esc(d)}</dd>`).join('');
    resizer($('#hL'), 'L'); resizer($('#hR'), 'R');
    $('#stage').addEventListener('click', (e) => { if (e.target.id === 'svg' && e.detail === 1 && !e.shiftKey && Q.has('tap')) next(); });
  }

  // the API for the designer's modes and themes (stage/universe.js and anything else): read-only views of the stage
  window.STAGE = { get t() { return t; }, get state() { return stateAt(t); }, get graph() { return G; }, knobs: K, ALT, ALT_NAME, color, fit, next, prev, toast };

  addEventListener('DOMContentLoaded', async () => {
    wire(); applyPanes(); setupSvg();
    await loadScenes();
    const at = Q.get('scene'); if (at) { const si = SCENES.findIndex((s) => s.id === at); if (si >= 0) gotoScene(si); }
    requestAnimationFrame((n) => { lastFrame = n; tick(n); });
  });
})();
