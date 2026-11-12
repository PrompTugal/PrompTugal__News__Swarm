// SwarmViews: one run, five ways to see it (flat, blueprint, heat, neon, 3D), four shapes (top-down, left-right, radial, tree).
// swarm.1.designer.fringe@PrompTugal.dinis, 12 November 2026, for Dinis Cruz (WS-215). No dependencies; the 3D mode loads three.js
// (cdnjs, pinned r128) only when it is chosen. Model text is never in a run, so it is never shown: lengths, sha256 and validity only.
//
//   const v = SwarmViews.render(el, run, { mode: 'flat', layout: 'down', focus: null })
//   v.setTime(ms) · v.select(id) · v.focus(id | 'section:<task>' | null) · v.highlight(altitude | null) · v.zoom(f) · v.fit()
//   v.on('select', (node, info) => …) · v.destroy()
(function () {
  'use strict';
  const ALT = {
    P: { name: 'person', short: 'person', lvl: 0, c: '--p', what: 'A person. Only Dinis instructs: everything an agent reads is material.' },
    A4: { name: 'swarm (A4)', short: 'A4', lvl: 1, c: '--a4', what: 'The swarm: the conductor that turns a person\'s ask into work, issues packets and signs them.' },
    T: { name: 'task', short: 'task', lvl: 1, c: '--p', what: 'What was asked, in one line.' },
    C: { name: 'capability', short: 'holds', lvl: 1.5, c: '--res', what: 'Something an agent holds: a repository it can push to, a secret, a key. Drawn so you can see who has access to what.' },
    E: { name: 'environment', short: 'env', lvl: 1.5, c: '--res', what: 'Where the work runs: a Claude Code session, a GitHub Action, a cloud.' },
    A3: { name: 'agent (A3)', short: 'A3', lvl: 2, c: '--a3', what: 'An agent: a Claude Code session or a GitHub Action job. It holds its own key, a clone of the repository and the router; it cannot run what its packet does not say, or spend over its budget.' },
    A2: { name: 'loop (A2)', short: 'A2', lvl: 3, c: '--a2', what: 'A loop: read the data, ask a model, check the answer, retry until it is valid or the tries run out. It holds only its task\'s grant; it cannot start others, schedule or push.' },
    A1: { name: 'LLM call (A1)', short: 'A1', lvl: 4, c: '--a1', what: 'One model call: a prompt in, an answer out, signed by a key made for this call. It can use no tool. Its text is never stored: only its length, sha256 and whether it was valid.' },
    A0: { name: 'compute (A0)', short: 'A0', lvl: 4, c: '--a0', what: 'Code: a read of a public dataset, a check, a consensus. It calls no model.' },
    M: { name: 'provider', short: 'router', lvl: 5, c: '--res', what: 'Where the model calls go: the router (OpenRouter) and the models behind it.' },
    D: { name: 'dataset', short: 'data', lvl: 5, c: '--res', what: 'A public dataset the loops read: the storm site\'s scheduled data, over its public API.' },
  };
  const ORDER = ['P', 'A4', 'A3', 'A2', 'A1', 'A0'], RES = new Set(['M', 'D', 'C', 'E']);
  const TREE_EDGES = new Set(['asks', 'owns', 'runs', 'starts', 'calls', 'commits']);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = (el, v) => getComputedStyle(el).getPropertyValue(v).trim() || '#888';
  const short = (s, n) => (s = String(s ?? ''), s.length > n ? s.slice(0, n - 1) + '…' : s);
  const nice = (l) => String(l).replace(/^swarm\.1\.fringe@PrompTugal\.dinis$/, 'swarm.1').replace(/@PrompTugal\.dinis$/, '');

  // ---------- the model: one run as a tree (who started whom) plus shared resources, sections (one per storm task) and intervals
  function model(run) {
    const seen = new Map();
    for (const n of run.nodes || []) if (!seen.has(n.id)) seen.set(n.id, { ...n });
    const nodes = [...seen.values()], byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const edges = (run.edges || []).filter((e) => byId[e.from] && byId[e.to] && e.from !== e.to);
    const parent = {}, kids = {}, links = {};
    const chainRes = new Set(nodes.filter((n) => (n.altitude === 'C' || n.altitude === 'E') && edges.some((e) => e.from === n.id && TREE_EDGES.has(e.kind))).map((n) => n.id));
    const isRes = (n) => RES.has(n.altitude) && !chainRes.has(n.id);
    for (const e of edges) {
      (links[e.from] ||= []).push(e); (links[e.to] ||= []).push(e);
      const t = byId[e.to];
      if (isRes(t) || parent[e.to] !== undefined || !TREE_EDGES.has(e.kind)) continue;
      if (isRes(byId[e.from])) continue;
      parent[e.to] = e.from; (kids[e.from] ||= []).push(e.to);
    }
    // a section is a storm task: loops are named loop:<task>:<model>, reads read:<task>; children inherit it
    const secOf = (n) => { const m = /(?:^|\/)loop:([^:/]+)/.exec(n.id) || /(?:^|\/)read:([^:/]+)/.exec(n.id) || /^runner:([^:/]+)/.exec(n.id); return m ? m[1] : null; };
    const roots = nodes.filter((n) => !isRes(n) && parent[n.id] === undefined).sort((a, b) => (ALT[a.altitude]?.lvl ?? 9) - (ALT[b.altitude]?.lvl ?? 9));
    const order = [], depth = {};
    const walk = (id, d, sec) => {
      const n = byId[id]; if (depth[id] !== undefined) return; depth[id] = d; n.section = secOf(n) || sec; order.push(id);
      const ks = (kids[id] || []).slice().sort((a, b) => (ALT[byId[a].altitude]?.lvl ?? 9) - (ALT[byId[b].altitude]?.lvl ?? 9) || String(secOf(byId[a]) || '').localeCompare(String(secOf(byId[b]) || '')));
      kids[id] = ks; ks.forEach((k) => walk(k, d + 1, n.section));
    };
    roots.forEach((r) => walk(r.id, 0, null));
    // leaves get evenly spaced positions u in [0, 1]; a parent sits at the mean of its children (a clean fan-out)
    const leaves = order.filter((id) => !(kids[id] || []).length), u = {};
    leaves.forEach((id, i) => (u[id] = leaves.length > 1 ? i / (leaves.length - 1) : 0.5));
    const up = (id) => { if (u[id] !== undefined) return u[id]; const ks = kids[id]; return (u[id] = ks.reduce((s, k) => s + up(k), 0) / ks.length); };
    order.forEach(up);
    // shared resources sit near the units that use them, spread so they never overlap
    const res = nodes.filter(isRes);
    for (const r of res) { const us = (links[r.id] || []).map((e) => u[e.from === r.id ? e.to : e.from]).filter((x) => x !== undefined); r._u = us.length ? us.reduce((a, b) => a + b, 0) / us.length : 0.5; }
    for (const lvL of [1.5, 5]) {
      const row = res.filter((r) => ALT[r.altitude].lvl === lvL).sort((a, b) => a._u - b._u), gap = Math.min(0.12, 1 / Math.max(1, row.length));
      row.forEach((r, i) => { r._u = Math.max(r._u, i ? row[i - 1]._u + gap : 0); });
      const over = row.length ? row[row.length - 1]._u - 1 : 0; if (over > 0) row.forEach((r) => (r._u -= over * (r._u / (row[row.length - 1]._u || 1))));
      row.forEach((r) => (u[r.id] = Math.min(1, Math.max(0, r._u))));
    }
    const lvl = {}, height = (id) => { const ks = M_kids(id); return ks.length ? 1 + Math.max(...ks.map(height)) : 0; }, M_kids = (id) => (kids[id] || []).filter((k) => ['A0', 'A1'].includes(byId[k].altitude));
    for (const n of nodes) { let l = ALT[n.altitude]?.lvl ?? 4; if (chainRes.has(n.id)) l = n.altitude === 'C' ? 2.33 : 2.67; else if (n.altitude === 'A0' && M_kids(n.id).length) l = 4 - 0.5 * height(n.id); lvl[n.id] = l; }
    for (const id of order) { const pa = parent[id]; if (pa !== undefined && lvl[id] <= lvl[pa]) lvl[id] = Math.min(4.6, +(lvl[pa] + 0.33).toFixed(2)); }
    // when each unit was live, from the run's own timeline
    const span = {}, tl = [...(run.timeline || [])].sort((a, b) => a.t - b.t);
    for (const e of tl) { const s = (span[e.unit] ||= {}); if (e.phase === 'start' && s.a === undefined) s.a = e.t; if (e.phase === 'end') s.b = e.t; }
    const end = Math.max(1, run.wall_ms || 0, ...tl.map((e) => e.t));
    const sections = {};
    for (const id of order) { const n = byId[id], s = n.section; if (!s || !['A2', 'A1', 'A0'].includes(n.altitude)) continue; const x = (sections[s] ||= { id: s, min: 1, max: 0, units: 0 }); x.min = Math.min(x.min, u[id]); x.max = Math.max(x.max, u[id]); x.units++; }
    const calls = Object.fromEntries((run.calls || []).map((c) => [c.unit, c]));
    const used = [...new Set(Object.values(lvl))].sort((a, b) => a - b), rank = (L) => (used.length > 1 ? used.indexOf(L) / (used.length - 1) : 0.5);
    return { run, nodes, byId, edges, parent, kids, links, order, depth, u, span, end, sections, calls, lvl, rank, isRes, maxDepth: Math.max(1, ...Object.values(depth)) };
  }

  // ---------- the four shapes: every layout is the same (u, level) pair, drawn a different way
  function place(M, layout, W, H) {
    const P = {}, pad = 60, lvl = (n) => (layout === 'tree' ? (M.isRes(n) ? (ALT[n.altitude].lvl === 5 ? M.maxDepth + 1 : -0.6) : M.depth[n.id] ?? 0) : M.lvl[n.id]);
    const top = -0.6, bot = M.maxDepth + 1, v = (n) => (layout === 'tree' ? (lvl(n) - top) / (bot - top) : M.rank(M.lvl[n.id]));
    for (const n of M.nodes) {
      const uu = M.u[n.id] ?? 0.5, vv = v(n);
      if (layout === 'right' || layout === 'tree') P[n.id] = { x: pad + vv * (W - 2 * pad), y: pad + uu * (H - 2 * pad) };
      else if (layout === 'radial') { const a = -Math.PI / 2 + uu * Math.PI * 2 * 0.97, r = vv * (Math.min(W, H) / 2 - pad); P[n.id] = { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a), a }; }
      else P[n.id] = { x: 150 + uu * (W - 210), y: pad + vv * (H - 2 * pad) };
    }
    return P;
  }
  // a canvas big enough that 133 leaves never touch: the long side grows with the number of leaves
  function canvas(M, layout, ar = 1.6) {
    const leaves = M.order.filter((id) => !(M.kids[id] || []).length).length, long = Math.max(ar < 1 ? 380 : 900, leaves * 16 + 120);
    if (layout === 'radial') { const s = Math.max(900, leaves * 7 + 300); return [s, s]; }
    if (layout === 'right' || layout === 'tree') return [Math.max(1100, (layout === 'tree' ? M.maxDepth + 2 : 6) * 190), long * 0.9];
    return [long, Math.max(760, Math.round(long / Math.max(1, ar)))];
  }

  // ---------- the node shapes, one per altitude, so the altitude reads from the shape alone
  function shape(alt, r, fill) {
    const f = `fill="${fill}"`;
    if (alt === 'P') return `<circle class="sh" r="${r}" ${f}/><circle r="${r * .35}" cy="${-r * .25}" class="hole"/>`;
    if (alt === 'A4') return `<polygon class="sh" ${f} points="${[...Array(6)].map((_, i) => `${(r * Math.cos(i * Math.PI / 3)).toFixed(1)},${(r * Math.sin(i * Math.PI / 3)).toFixed(1)}`).join(' ')}"/>`;
    if (alt === 'A3') return `<rect class="sh" ${f} x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="${r * .35}"/>`;
    if (alt === 'A2') return `<circle class="sh ring" r="${r}" fill="none" stroke="${fill}" stroke-width="${Math.max(2, r / 4)}"/><circle r="${r * .4}" ${f}/>`;
    if (alt === 'A1') return `<polygon class="sh" ${f} points="0,${-r} ${r},0 0,${r} ${-r},0"/>`;
    if (alt === 'A0') return `<rect class="sh" ${f} x="${-r * .7}" y="${-r * .7}" width="${1.4 * r}" height="${1.4 * r}"/>`;
    if (alt === 'D') return `<ellipse class="sh" ${f} rx="${r}" ry="${r * .6}"/>`;
    return `<rect class="sh" ${f} x="${-r * 1.2}" y="${-r * .7}" width="${2.4 * r}" height="${1.4 * r}" rx="${r * .7}"/>`;
  }

  // what one unit is, what it holds and what it did, in words: the panel and the tooltips read this
  function info(M, n) {
    const a = ALT[n.altitude] || { name: n.altitude, what: '' }, c = M.calls[n.id], s = M.span[n.id] || {}, facts = [];
    if (n.model) facts.push(['model', n.model]);
    if (c) { facts.push(['answer', c.valid ? 'valid' : 'not valid' + (c.status && c.status !== 'ok' ? ` (${c.status})` : '')]); if (c.verdict) facts.push(['verdict', c.verdict]); facts.push(['tokens', `${c.tokens_in} in, ${c.tokens_out} out`]); facts.push(['cost', '$' + Number(c.cost_usd || 0).toFixed(5)]); facts.push(['latency', c.latency_ms + ' ms']); if (c.answer_sha256) facts.push(['answer sha256', c.answer_sha256 + ` (${c.answer_chars} chars; text never stored)`]); if (c.signed?.by?.fp) facts.push(['signed by', c.signed.by.fp + ' (a key made for this call)']); }
    else { if (n.tokens) facts.push(['tokens', n.tokens]); if (n.cost_usd != null) facts.push(['cost', '$' + Number(n.cost_usd).toFixed(5)]); if (n.latency_ms) facts.push(['latency', n.latency_ms + ' ms']); if (n.valid !== undefined) facts.push(['answer', n.valid ? 'valid' : 'not valid']); }
    if (n.key_fp && !c?.signed) facts.push(['key', n.key_fp]);
    if (n.env) facts.push(['runs in', n.env]); if (n.account) facts.push(['account', n.account]);
    if (n.url) facts.push(['source', n.url]); if (n.bytes) facts.push(['size', n.bytes.toLocaleString() + ' bytes']);
    if (n.section) facts.push(['storm task', n.section]);
    if (s.a !== undefined) facts.push(['live', `${(s.a / 1000).toFixed(1)} s → ${s.b !== undefined ? (s.b / 1000).toFixed(1) + ' s' : 'the end'}`]);
    return { altitude: a.name, what: a.what, facts };
  }

  function render(el, run, opts = {}) {
    const st = { mode: opts.mode || 'flat', layout: opts.layout || 'down', t: Infinity, sel: null, hi: null, focus: null, vb: null, handlers: {} };
    let M = model(run), P = {}, W = 0, H = 0, three = null;
    el.classList.add('sv'); el.innerHTML = '';
    const svgWrap = document.createElement('div'); svgWrap.className = 'sv-stage'; el.appendChild(svgWrap);
    const tip = document.createElement('div'); tip.className = 'sv-tip'; tip.hidden = true; el.appendChild(tip);
    const emit = (k, ...a) => (st.handlers[k] || []).forEach((f) => f(...a));

    function draw() {
      if (three) { three.destroy(); three = null; }
      el.dataset.mode = st.mode; el.dataset.layout = st.layout;
      if (st.mode === 'three') { svgWrap.innerHTML = '<div class="sv-3d-wait">loading the 3D view…</div>'; draw3d(); return; }
      [W, H] = canvas(M, st.layout, (svgWrap.clientWidth || 1200) / Math.max(1, svgWrap.clientHeight || 700)); P = place(M, st.layout, W, H);
      const big = M.nodes.length > 60, R = big ? Math.round(7 * Math.max(1, Math.min(2.2, Math.max(W, H) / 1500))) : 12, heat = st.mode === 'heat', blue = st.mode === 'blueprint', neon = st.mode === 'neon';
      const nLeaves = M.order.filter((id) => !(M.kids[id] || []).length).length, gap = (W - 120) / Math.max(1, nLeaves - 1);
      const maxTok = Math.max(1, ...M.nodes.map((n) => M.calls[n.id] ? M.calls[n.id].tokens_in + M.calls[n.id].tokens_out : n.tokens || 0));
      const rOf = (n) => { if (heat && n.altitude === 'A1') { const c = M.calls[n.id], t = c ? c.tokens_in + c.tokens_out : n.tokens || 0; return 4 + 14 * Math.sqrt(t / maxTok); } return (n.altitude === 'P' || n.altitude === 'A4' || n.altitude === 'A3') ? R + 3 : RES.has(n.altitude) ? R - 1 : R; };
      const col = (n) => { if (heat && n.altitude === 'A1') { const v = M.calls[n.id]?.valid ?? n.valid; return v === false ? 'var(--warn)' : 'var(--a1)'; } return `var(${(ALT[n.altitude] || ALT.A0).c})`; };
      let s = `<svg class="sv-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(run.title || run.id)}"><defs>`
        + `<pattern id="sv-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" class="grid"/></pattern>`
        + `<filter id="sv-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
        + `<g class="sv-world">` + (blue ? `<rect x="-2000" y="-2000" width="${W + 4000}" height="${H + 4000}" fill="url(#sv-grid)"/>` : '');
      // altitude guides: lanes (top-down, left-right), rings (radial), depth columns (tree); each labelled and clickable
      const WORD = { P: 'person', A4: 'A4 swarm', T: 'the task', C: 'holds', E: 'runs in', A3: 'A3 agents', A2: 'A2 loops', A1: 'A1 calls', A0: 'A0 compute', M: 'router', D: 'data' };
      const levels = [...new Set(Object.values(M.lvl))].sort((a, b) => a - b).map((L) => { const alts = [...new Set(M.nodes.filter((n) => M.lvl[n.id] === L).map((n) => n.altitude))]; return [L, alts]; }).filter(([, a]) => a.length);
      if (st.layout !== 'tree') for (const [L, altsArr] of levels) {
        const a = 'L', alts = altsArr.join(','), lab = { L: altsArr.map((x) => (x === 'A0' && L < 4 ? (L <= 3 ? 'A0 job' : 'A0 tasks') : WORD[x])).join(' · ') };
        const v = 60 + M.rank(L) * ((st.layout === 'radial' ? Math.min(W, H) / 2 : st.layout === 'right' ? W : H) - 120), band = Math.min(68, ((st.layout === 'right' ? W : H) - 120) / Math.max(1, levels.length - 1) * 0.8);
        if (st.layout === 'radial') { const r = M.rank(L) * (Math.min(W, H) / 2 - 60); s += `<g class="lane" data-alt="${alts}"><circle cx="${W / 2}" cy="${H / 2}" r="${r}" class="lane-ring"/><text x="${W / 2 + 6}" y="${H / 2 - r - 6}" class="lane-l">${lab[a]}</text></g>`; }
        else if (st.layout === 'right') s += `<g class="lane" data-alt="${alts}"><rect x="${v - band / 2}" y="0" width="${band}" height="${H}" class="lane-band"/><text x="${v}" y="22" text-anchor="middle" class="lane-l">${lab[a]}</text></g>`;
        else s += `<g class="lane" data-alt="${alts}"><rect x="0" y="${v - band / 2}" width="${W}" height="${band}" class="lane-band"/><text x="10" y="${v - band / 2 + 14}" class="lane-l">${lab[a]}</text></g>`;
      }
      // sections: one band per storm task around its loops, calls and reads; click to zoom into it
      if (st.layout !== 'radial') for (const sec of Object.values(M.sections)) {
        const sp = M.order.filter((id) => M.byId[id].section === sec.id).map((id) => P[id]), a = Math.min(...sp.map((q) => (st.layout === 'down' ? q.x : q.y))) - 14, b = Math.max(...sp.map((q) => (st.layout === 'down' ? q.x : q.y))) + 14;
        if (st.layout === 'down') { const ys = M.order.filter((id) => M.byId[id].section === sec.id).map((id) => P[id].y), y0 = Math.min(...ys) - 26, y1 = Math.max(...ys) + 30; s += `<g class="sec" data-sec="${esc(sec.id)}"><rect x="${a}" y="${y0}" width="${b - a}" height="${y1 - y0}" rx="10"/><text x="${(a + b) / 2}" y="${y1 + 16}" text-anchor="middle">${esc(sec.id)}</text></g>`; }
        else { const xs = M.order.filter((id) => M.byId[id].section === sec.id).map((id) => P[id].x), x0 = Math.min(...xs) - 24, x1 = Math.max(...xs) + 24; s += `<g class="sec" data-sec="${esc(sec.id)}"><rect x="${x0}" y="${a}" width="${x1 - x0}" height="${b - a}" rx="10"/><text x="${x0 + 8}" y="${a + 14}">${esc(sec.id)}</text></g>`; }
      } else for (const sec of Object.values(M.sections)) { const a0 = -Math.PI / 2 + sec.min * Math.PI * 2 * .97 - .02, a1 = -Math.PI / 2 + sec.max * Math.PI * 2 * .97 + .02, rs = M.order.filter((id) => M.byId[id].section === sec.id).map((id) => Math.hypot(P[id].x - W / 2, P[id].y - H / 2)), r0 = Math.min(...rs) - 24, r1 = Math.max(...rs) + 24, cx = W / 2, cy = H / 2, pt = (r, a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`, lg = a1 - a0 > Math.PI ? 1 : 0; s += `<g class="sec" data-sec="${esc(sec.id)}"><path d="M${pt(r0, a0)} A${r0},${r0} 0 ${lg} 1 ${pt(r0, a1)} L${pt(r1, a1)} A${r1},${r1} 0 ${lg} 0 ${pt(r1, a0)}Z"/><text x="${cx + (r1 + 16) * Math.cos((a0 + a1) / 2)}" y="${cy + (r1 + 16) * Math.sin((a0 + a1) / 2)}" text-anchor="middle">${esc(sec.id)}</text></g>`; }
      // edges: straight (flat, heat), orthogonal elbows (blueprint, tree), curves (neon, radial)
      s += '<g class="edges">';
      for (const e of M.edges) {
        const a = P[e.from], b = P[e.to]; if (!a || !b) continue;
        let d;
        if (blue || st.layout === 'tree') d = st.layout === 'down' ? `M${a.x},${a.y}V${(a.y + b.y) / 2}H${b.x}V${b.y}` : `M${a.x},${a.y}H${(a.x + b.x) / 2}V${b.y}H${b.x}`;
        else if (neon || st.layout === 'radial') { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, cx = st.layout === 'radial' ? mx + (W / 2 - mx) * .25 : mx, cy = st.layout === 'radial' ? my + (H / 2 - my) * .25 : st.layout === 'down' ? a.y : my; d = `M${a.x},${a.y}Q${cx},${cy} ${b.x},${b.y}`; }
        else d = `M${a.x},${a.y}L${b.x},${b.y}`;
        const res = M.isRes(M.byId[e.to]) || M.isRes(M.byId[e.from]);
        s += `<path class="e ${res ? 'res' : 'tree'} k-${esc(e.kind)}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" d="${d}"><title>${esc(nice(M.byId[e.from].label))} ${esc(e.kind)} ${esc(nice(M.byId[e.to].label))}</title></path>`;
      }
      // short names: a call shows its try (#1) when its loop already names the model; a loop names its model when its task has several;
      // a dataset shows its file name; neighbours on the data row are staggered so their labels never overlap
      const loopsIn = {}; M.nodes.filter((n) => n.altitude === 'A2').forEach((n) => (loopsIn[n.section] = (loopsIn[n.section] || 0) + 1));
      const modelOf = (id) => (/loop:[^:/]+:([^/]+)/.exec(id) || [])[1];
      const nameOf = (n) => {
        if (n.altitude === 'A1') { const tr = (/#\d+$/.exec(n.label) || [''])[0], pm = modelOf(M.parent[n.id] || ''); return pm && String(n.label).startsWith(pm) ? (tr ? 'try ' + tr : n.label) : String(n.label).split('-')[0] + ' ' + tr; }
        if (n.altitude === 'A2' && loopsIn[n.section] > 1 && modelOf(n.id)) return modelOf(n.id).split('-').slice(0, 2).join('-');
        if (n.altitude === 'D') return String(n.label).split('/').pop();
        return nice(n.label);
      };
      const stagger = {}; M.nodes.filter((n) => M.isRes(n) && M.lvl[n.id] >= 5).sort((a, b) => (P[a.id]?.x ?? 0) - (P[b.id]?.x ?? 0)).forEach((n, i) => (stagger[n.id] = i % 2));
      s += '</g><g class="nodes">';
      for (const id of [...M.order, ...M.nodes.filter(M.isRes).map((n) => n.id)]) {
        const n = M.byId[id], p = P[id]; if (!p) continue; const r = rOf(n), c = M.calls[id], v = c ? c.valid : n.valid;
        const showLab = !big || ['P', 'A4', 'A3', 'C', 'E', 'M', 'D', 'T'].includes(n.altitude) || blue;
        let label = '';
        if (showLab) {
          const room = st.layout === 'down' ? Math.max(5, Math.floor(gap / 6)) : 26, txt = short(nameOf(n), n.altitude === 'A1' || n.altitude === 'A0' ? room : 28);
          const lx = st.layout === 'right' || st.layout === 'tree' ? r + 5 : 0, ly = st.layout === 'right' || st.layout === 'tree' ? 4 : r + 12 + (st.layout === 'down' && stagger[n.id] ? 14 : 0), anc = lx ? 'start' : 'middle';
          label = (blue && (n.altitude === 'A1' || n.altitude === 'A0') && st.layout === 'down') ? '' : `<text class="nl" x="${lx}" y="${ly}" text-anchor="${anc}">${esc(txt)}</text>`;
          if (blue && c && st.layout !== 'down') label += `<text class="nm" x="${lx}" y="${ly + 11}" text-anchor="${anc}">${c.tokens_in + c.tokens_out} tok · ${c.latency_ms} ms · $${Number(c.cost_usd).toFixed(4)}</text>`;
        }
        const ring = heat && c ? `<circle class="lat" r="${r + 3}" stroke-dasharray="${Math.min(1, c.latency_ms / 20000) * 2 * Math.PI * (r + 3)} 999" transform="rotate(-90)"/>` : '';
        s += `<g class="n a-${n.altitude} ${v === false ? 'bad' : v ? 'ok' : ''}" data-id="${esc(id)}" data-alt="${n.altitude}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc((ALT[n.altitude]?.name || '') + ': ' + nice(n.label))}">${ring}${shape(n.altitude, r, col(n))}${label}</g>`;
      }
      s += '</g></g></svg>';
      svgWrap.innerHTML = s;
      const svg = svgWrap.querySelector('svg'); st.vb = st.vb && st.vbFor === key() ? st.vb : [0, 0, W, H]; st.vbFor = key(); setVB();
      wire(svg); apply();
    }
    const key = () => st.mode + '|' + st.layout + '|' + (run.id || '');
    function setVB() { const svg = svgWrap.querySelector('svg'); if (svg) svg.setAttribute('viewBox', st.vb.map((x) => x.toFixed(1)).join(' ')); }
    function zoomTo(box, pad = 60) { if (!box) return; const [x0, y0, x1, y1] = box, w = Math.max(160, x1 - x0 + 2 * pad), h = Math.max(120, y1 - y0 + 2 * pad), ar = svgWrap.clientWidth / Math.max(1, svgWrap.clientHeight) || W / H; let vw = w, vh = h; if (vw / vh < ar) vw = vh * ar; else vh = vw / ar; animate([(x0 + x1) / 2 - vw / 2, (y0 + y1) / 2 - vh / 2, vw, vh]); }
    function animate(to) { const from = st.vb.slice(), t0 = performance.now(), D = 450; const step = (now) => { const k = Math.min(1, (now - t0) / D), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; st.vb = from.map((v, i) => v + (to[i] - v) * e); setVB(); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
    const boxOf = (ids) => { const ps = ids.map((id) => P[id]).filter(Boolean); return ps.length ? [Math.min(...ps.map((p) => p.x)), Math.min(...ps.map((p) => p.y)), Math.max(...ps.map((p) => p.x)), Math.max(...ps.map((p) => p.y))] : null; };
    const subtree = (id, out = []) => { out.push(id); (M.kids[id] || []).forEach((k) => subtree(k, out)); return out; };

    function wire(svg) {
      // pan with a drag, zoom with the wheel or a pinch, around the pointer
      let drag = null; const pt = (ev) => { const r = svg.getBoundingClientRect(); return [st.vb[0] + (ev.clientX - r.left) / r.width * st.vb[2], st.vb[1] + (ev.clientY - r.top) / r.height * st.vb[3]]; };
      svg.addEventListener('wheel', (ev) => { ev.preventDefault(); const [x, y] = pt(ev), f = Math.exp(ev.deltaY * 0.0015); st.vb = [x - (x - st.vb[0]) * f, y - (y - st.vb[1]) * f, st.vb[2] * f, st.vb[3] * f]; setVB(); }, { passive: false });
      svg.addEventListener('pointerdown', (ev) => { if (ev.target.closest('.n,.sec,.lane')) return; drag = { x: ev.clientX, y: ev.clientY, vb: st.vb.slice() }; svg.setPointerCapture(ev.pointerId); svg.classList.add('grab'); });
      svg.addEventListener('pointermove', (ev) => { if (!drag) return; const r = svg.getBoundingClientRect(); st.vb = [drag.vb[0] - (ev.clientX - drag.x) / r.width * drag.vb[2], drag.vb[1] - (ev.clientY - drag.y) / r.height * drag.vb[3], drag.vb[2], drag.vb[3]]; setVB(); });
      svg.addEventListener('pointerup', () => { drag = null; svg.classList.remove('grab'); });
      svg.addEventListener('click', (ev) => {
        const g = ev.target.closest('.n'), sec = ev.target.closest('.sec'), lane = ev.target.closest('.lane');
        if (g) api.select(g.dataset.id); else if (sec) api.focus('section:' + sec.dataset.sec); else if (lane) api.highlight(st.hi === lane.dataset.alt ? null : lane.dataset.alt); else api.select(null);
      });
      svg.addEventListener('dblclick', (ev) => { const g = ev.target.closest('.n'); if (g) api.focus(g.dataset.id); });
      svg.addEventListener('keydown', (ev) => { const g = ev.target.closest('.n'); if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); api.select(g.dataset.id); } });
      svg.addEventListener('pointerover', (ev) => { const g = ev.target.closest('.n'); if (!g) { tip.hidden = true; return; } const n = M.byId[g.dataset.id], i = info(M, n); tip.innerHTML = `<b>${esc(nice(n.label))}</b><span>${esc(i.altitude)}</span>${i.facts.slice(0, 3).map(([k, v]) => `<small>${esc(k)}: ${esc(short(v, 48))}</small>`).join('')}`; tip.hidden = false; });
      svg.addEventListener('pointermove', (ev) => { if (tip.hidden) return; const r = el.getBoundingClientRect(); tip.style.left = Math.min(r.width - 230, ev.clientX - r.left + 14) + 'px'; tip.style.top = (ev.clientY - r.top + 14) + 'px'; });
      svg.addEventListener('pointerleave', () => (tip.hidden = true));
    }
    // classes do all the showing: time (hidden, live), selection (the chain from the person down, and what the unit started), altitude light
    function apply() {
      if (three) return three.apply();
      const svg = svgWrap.querySelector('svg'); if (!svg) return;
      const chain = new Set(), below = new Set();
      if (st.sel) { let x = st.sel; while (x !== undefined) { chain.add(x); x = M.parent[x]; } subtree(st.sel).forEach((k) => below.add(k)); (M.links[st.sel] || []).forEach((e) => below.add(e.from === st.sel ? e.to : e.from)); }
      const his = st.hi ? new Set(st.hi.split(',')) : null;
      svg.querySelectorAll('.n').forEach((g) => {
        const id = g.dataset.id, s = M.span[id], timed = !!s && s.a !== undefined;
        g.classList.toggle('hidden', timed && st.t < s.a);
        g.classList.toggle('live', timed && st.t >= s.a && (s.b === undefined ? st.t < M.end : st.t < s.b) && st.t !== Infinity);
        g.classList.toggle('sel', id === st.sel); g.classList.toggle('chain', chain.has(id) && id !== st.sel); g.classList.toggle('kin', below.has(id) && id !== st.sel);
        g.classList.toggle('dim', (!!st.sel && !chain.has(id) && !below.has(id)) || (!!his && !his.has(g.dataset.alt)));
      });
      svg.querySelectorAll('.e').forEach((p) => {
        const a = p.dataset.from, b = p.dataset.to, sb = M.span[b];
        p.classList.toggle('on', !!st.sel && ((chain.has(a) && chain.has(b)) || (below.has(b) && (below.has(a) || a === st.sel)) || a === st.sel || b === st.sel));
        p.classList.toggle('flow', st.t !== Infinity && !!sb && sb.a !== undefined && st.t >= sb.a && (sb.b === undefined || st.t < sb.b));
        p.classList.toggle('hidden', st.t !== Infinity && !!sb && sb.a !== undefined && st.t < sb.a);
        p.classList.toggle('dim', (!!st.sel && !p.classList.contains('on')) || (!!his && !(his.has(M.byId[a].altitude) || his.has(M.byId[b].altitude))));
      });
      svg.querySelectorAll('.lane').forEach((l) => l.classList.toggle('on', l.dataset.alt === st.hi));
      svg.querySelectorAll('.sec').forEach((l) => l.classList.toggle('on', st.focus === 'section:' + l.dataset.sec));
    }

    // ---------- 3D: the altitudes as stacked planes, person at the top, calls and reads at the bottom; drag to orbit, wheel to zoom
    function draw3d() {
      const go = () => {
        const T = window.THREE; if (!T) { svgWrap.innerHTML = '<div class="sv-3d-wait">The 3D view needs three.js from cdnjs, which did not load here.</div>'; return; }
        svgWrap.innerHTML = ''; const w = svgWrap.clientWidth || 800, h = svgWrap.clientHeight || 520;
        const scene = new T.Scene(), cam = new T.PerspectiveCamera(48, w / h, 1, 8000), ren = new T.WebGLRenderer({ antialias: true, alpha: true });
        ren.setPixelRatio(Math.min(2, devicePixelRatio)); ren.setSize(w, h); svgWrap.appendChild(ren.domElement);
        scene.fog = new T.FogExp2(new T.Color(css(el, '--bg')).getHex(), 0.00045);
        const leaves = M.order.filter((id) => !(M.kids[id] || []).length).length, Rmax = Math.max(220, leaves * 5), lvlY = (n) => 300 - M.lvl[n.id] * 120;
        const pos = {}, root = new T.Group(); scene.add(root);
        for (const n of M.nodes) { const u = M.u[n.id] ?? .5, lv = M.lvl[n.id], r = lv <= 1 ? lv * 40 : (lv / 5) * Rmax, a = u * Math.PI * 2 * .97; pos[n.id] = new T.Vector3(r * Math.cos(a), lvlY(n), r * Math.sin(a)); }
        for (const [a, lv] of [['A3', 2], ['A2', 3], ['A1', 4], ['M', 5]]) { if (!M.nodes.some((n) => M.lvl[n.id] === lv)) continue; const g = new T.Mesh(new T.RingGeometry((lv / 5) * Rmax - 30, (lv / 5) * Rmax + 30, 96), new T.MeshBasicMaterial({ color: new T.Color(css(el, ALT[a].c)), transparent: true, opacity: .07, side: T.DoubleSide })); g.rotation.x = -Math.PI / 2; g.position.y = 300 - lv * 120; root.add(g); }
        const geo = { P: new T.SphereGeometry(1, 20, 14), A4: new T.CylinderGeometry(1, 1, .6, 6), A3: new T.BoxGeometry(1.5, 1.5, 1.5), A2: new T.TorusGeometry(.9, .28, 10, 24), A1: new T.OctahedronGeometry(1.1), A0: new T.BoxGeometry(1.1, 1.1, 1.1) }, def = new T.SphereGeometry(.9, 12, 10);
        const meshes = [], byMesh = new Map();
        for (const n of M.nodes) {
          const c = M.calls[n.id], bad = (c ? c.valid : n.valid) === false, color = new T.Color(bad ? css(el, '--warn') : css(el, (ALT[n.altitude] || ALT.A0).c));
          const m = new T.Mesh(geo[n.altitude] || def, new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .55, roughness: .4, metalness: .2, transparent: true, opacity: 1 }));
          const s = ['P', 'A4', 'A3'].includes(n.altitude) ? 14 : RES.has(n.altitude) ? 8 : 6; m.scale.setScalar(s); m.position.copy(pos[n.id]); root.add(m); meshes.push(m); byMesh.set(m, n.id); m.userData = { id: n.id, base: s };
        }
        const lines = [];
        for (const e of M.edges) { const a = pos[e.from], b = pos[e.to]; if (!a || !b) continue; const g = new T.BufferGeometry().setFromPoints([a, b]); const res = M.isRes(M.byId[e.to]) || M.isRes(M.byId[e.from]); const l = new T.Line(g, new T.LineBasicMaterial({ color: new T.Color(css(el, res ? '--line' : '--muted')), transparent: true, opacity: res ? .25 : .5 })); root.add(l); lines.push({ l, e }); }
        scene.add(new T.AmbientLight(0xffffff, .5)); const dl = new T.DirectionalLight(0xffffff, .8); dl.position.set(300, 800, 400); scene.add(dl);
        let th = .8, ph = 1.05, dist = Rmax * 2.6 + 400, auto = true, drag = null, raf = 0;
        const place = () => { cam.position.set(dist * Math.sin(ph) * Math.cos(th), 60 + dist * Math.cos(ph), dist * Math.sin(ph) * Math.sin(th)); cam.lookAt(0, 40, 0); };
        const cv = ren.domElement, ray = new T.Raycaster(), mv = new T.Vector2();
        cv.addEventListener('pointerdown', (ev) => { drag = { x: ev.clientX, y: ev.clientY, th, ph, moved: false }; auto = false; cv.setPointerCapture(ev.pointerId); });
        cv.addEventListener('pointermove', (ev) => { if (drag) { th = drag.th + (ev.clientX - drag.x) * .008; ph = Math.min(1.5, Math.max(.15, drag.ph - (ev.clientY - drag.y) * .006)); drag.moved ||= Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 4; } });
        cv.addEventListener('pointerup', (ev) => { if (drag && !drag.moved) { const r = cv.getBoundingClientRect(); mv.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mv, cam); const hit = ray.intersectObjects(meshes)[0]; api.select(hit ? byMesh.get(hit.object) : null); } drag = null; });
        cv.addEventListener('wheel', (ev) => { ev.preventDefault(); dist = Math.min(9000, Math.max(200, dist * Math.exp(ev.deltaY * .0012))); }, { passive: false });
        const loop = (now) => { raf = requestAnimationFrame(loop); if (auto) th += .0016; place(); const k = 1 + .25 * Math.sin(now / 180); meshes.forEach((m) => { const live = m.userData.live; m.scale.setScalar(m.userData.base * (live ? k : 1)); }); ren.render(scene, cam); };
        raf = requestAnimationFrame(loop);
        const ro = new ResizeObserver(() => { const w2 = svgWrap.clientWidth, h2 = svgWrap.clientHeight; if (w2 && h2) { ren.setSize(w2, h2); cam.aspect = w2 / h2; cam.updateProjectionMatrix(); } }); ro.observe(svgWrap);
        three = {
          apply() {
            const chain = new Set(), below = new Set(), his = st.hi ? new Set(st.hi.split(',')) : null;
            if (st.sel) { let x = st.sel; while (x !== undefined) { chain.add(x); x = M.parent[x]; } subtree(st.sel).forEach((k) => below.add(k)); }
            meshes.forEach((m) => { const id = m.userData.id, s = M.span[id], timed = !!s && s.a !== undefined, n = M.byId[id]; const hidden = timed && st.t < s.a; m.visible = !hidden; m.userData.live = timed && st.t !== Infinity && st.t >= s.a && (s.b === undefined || st.t < s.b); const dim = (st.sel && !chain.has(id) && !below.has(id)) || (his && !his.has(n.altitude)); m.material.opacity = dim ? .12 : 1; m.material.emissiveIntensity = id === st.sel ? 1.4 : chain.has(id) ? 1 : .55; });
            lines.forEach(({ l, e }) => { const sb = M.span[e.to]; l.visible = !(st.t !== Infinity && sb && sb.a !== undefined && st.t < sb.a); const on = st.sel && (chain.has(e.to) && chain.has(e.from) || below.has(e.to)); l.material.opacity = st.sel ? (on ? .95 : .06) : .45; });
          },
          focus(id) { auto = false; const p = id && pos[id]; if (!p) { dist = Rmax * 2.6 + 400; return; } dist = Math.max(300, Rmax * .9); th = Math.atan2(p.z, p.x); },
          destroy() { cancelAnimationFrame(raf); ro.disconnect(); ren.dispose(); svgWrap.innerHTML = ''; },
        };
        three.apply();
      };
      if (window.THREE) return go();
      let tag = document.querySelector('script[data-sv3]');
      if (!tag) { tag = document.createElement('script'); tag.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; tag.dataset.sv3 = '1'; document.head.appendChild(tag); }
      tag.addEventListener('load', () => st.mode === 'three' && go()); tag.addEventListener('error', () => { svgWrap.innerHTML = '<div class="sv-3d-wait">The 3D view needs three.js from cdnjs, which did not load here.</div>'; });
    }

    const api = {
      model: M, info: (id) => M.byId[id] && info(M, M.byId[id]), altitudes: ALT,
      setMode(m) { st.mode = m; draw(); }, setLayout(l) { st.layout = l; draw(); }, setRun(r) { run = r; M = model(r); api.model = M; st.sel = null; st.focus = null; st.vb = null; draw(); },
      setTime(ms) { st.t = ms == null ? Infinity : ms; apply(); }, get end() { return M.end; },
      select(id) { st.sel = id && M.byId[id] ? id : null; apply(); emit('select', st.sel && M.byId[st.sel], st.sel && info(M, M.byId[st.sel])); },
      highlight(alt) { st.hi = alt || null; apply(); emit('highlight', st.hi); },
      focus(target) {
        st.focus = target || null;
        if (three) { three.focus(target && !String(target).startsWith('section:') ? target : null); apply(); return; }
        if (!target) { animate([0, 0, W, H]); apply(); emit('focus', null); return; }
        const ids = String(target).startsWith('section:') ? M.order.filter((id) => M.byId[id].section === target.slice(8)) : M.byId[target] ? subtree(target) : [];
        zoomTo(boxOf(ids)); apply(); emit('focus', target);
      },
      zoom(f) { if (three) return; const [x, y, w, h] = st.vb; animate([x + w / 2 - w * f / 2, y + h / 2 - h * f / 2, w * f, h * f]); },
      fit() { st.focus = null; if (three) return three.focus(null); animate([0, 0, W, H]); apply(); },
      on(k, f) { (st.handlers[k] ||= []).push(f); return api; },
      destroy() { if (three) three.destroy(); el.innerHTML = ''; },
    };
    draw();
    if (opts.focus) setTimeout(() => api.focus(opts.focus), 50);
    return api;
  }
  window.SwarmViews = { render, ALT, version: '1' };
})();
