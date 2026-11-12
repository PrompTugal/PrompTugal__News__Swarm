/* StoryKit: tell a story only with primitives (Dinis, 12 Nov ~07:35: "you're not designing new UIs ... you're just telling a
   particular story with the APIs that exist ... a whole bunch of primitives ... Sonnet as a coordinator").
   By swarm.1.dev.fringe@PrompTugal.dinis (WS-215). Plain script: window.StoryKit. No model calls, no network but the page's own files.

   A story (stories/<id>/story.json):
     { id, title, asked_by?, answered_by?, at?, simulated?, sample?, scenes: [ { type, caption?, say?: [..], kicker?, ...fields } ] }
   type is one of the PRIMITIVES below; each scene is ONLY its primitive's fields (validate() refuses anything else).
   The markup uses pages/story.html's classes (k, sub, big, cmp2, lad, flw, ctr, tbl, emb), so its look and focus growth apply;
   a fallback style, under .storykit and :where() (no specificity), covers pages without them. Colours: the stage tokens.

   API
     StoryKit.PRIMITIVES                  { name: { description, fields, required, reveals(scene), render(scene) } }
     StoryKit.render(scene)               → html of one scene, every step hidden but the first ([data-r] > 0 get .off)
     StoryKit.present(el, story, opts)    → { next, prev, play, stop, goto(i), state }   opts: { onStep(i, n, info), caption: el, keys: bool, dwell: ms }
     StoryKit.load(id)                    → Promise<{ story, trail }>   (stories/<id>/story.json and trail.json, trail optional)
     StoryKit.STORY_TOOLS                 one JSON-schema tool per primitive: { name, description, parameters }
     StoryKit.openaiTools()               the same, as OpenAI/OpenRouter "tools" ({ type: 'function', function: {...} })
     StoryKit.validate(story)             → { ok, errors[] }   refuses unknown types, unknown or missing fields, too-long text
     StoryKit.fromToolCalls(calls, meta)  → { story, errors[] }   calls: [{ name, arguments }] (arguments: object or JSON string)
*/
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ALT = ['P', 'A4', 'A3', 'A2', 'A1', 'A0', 'C', 'E', 'M', 'D', 'X', 'T'];
  const S = (max) => ({ type: 'string', maxLength: max });
  const LIST = (item, max) => ({ type: 'array', items: item, maxItems: max });
  const COMMON = { kicker: S(60), caption: S(240), say: LIST(S(400), 6) };   // every scene: a kicker, the caption on screen, what to say
  const HEAD = (sc) => (sc.kicker ? `<div class="k">${esc(sc.kicker)}</div>` : '') + (sc.title ? `<h2>${esc(sc.title)}</h2>` : '');

  const PRIMITIVES = {
    title: { description: 'The opening or a section title: one big line and an optional sub-line.',
      fields: { title: S(90), sub: S(160) }, required: ['title'],
      render: (sc) => `${sc.kicker ? `<div class="k">${esc(sc.kicker)}</div>` : ''}<h2 class="sk-title">${esc(sc.title)}</h2>${sc.sub ? `<p class="sub">${esc(sc.sub)}</p>` : ''}` },
    statement: { description: 'One sentence that carries the point, large.',
      fields: { text: S(200) }, required: ['text'],
      render: (sc) => `${HEAD(sc)}<p class="big">${esc(sc.text)}</p>` },
    bullets: { description: 'A heading and up to 6 short points, revealed one by one.',
      fields: { title: S(90), items: LIST(S(140), 6) }, required: ['items'], reveals: (sc) => (sc.items || []).length,
      render: (sc) => `${HEAD(sc)}<ul class="sk-list">${(sc.items || []).map((x, j) => `<li data-r="${j}">${esc(x)}</li>`).join('')}</ul>` },
    quote: { description: "A person's own words, quoted exactly, with who said them. Never invent a quote.",
      fields: { text: S(300), who: S(80) }, required: ['text', 'who'],
      render: (sc) => `${sc.kicker ? `<div class="k">${esc(sc.kicker)}</div>` : ''}<blockquote>“${esc(sc.text)}”<cite>${esc(sc.who)}</cite></blockquote>` },
    compare: { description: 'Before and after (or without and with), side by side; the after side arrives second.',
      fields: { title: S(90), before: { type: 'object', properties: { label: S(40), items: LIST(S(120), 5) }, required: ['items'], additionalProperties: false },
        after: { type: 'object', properties: { label: S(40), items: LIST(S(120), 5) }, required: ['items'], additionalProperties: false } },
      required: ['before', 'after'], reveals: () => 2,
      render: (sc) => `${HEAD(sc)}<div class="cmp2">${['before', 'after'].map((k, j) => `<div class="${k === 'before' ? 'b' : 'a'}" data-r="${j}"><h3>${esc((sc[k] || {}).label || (j ? 'After' : 'Before'))}</h3>${((sc[k] || {}).items || []).map((x) => `<p>${esc(x)}</p>`).join('')}</div>`).join('')}</div>` },
    ladder: { description: 'n levels, top to bottom (an altitude ladder, a maturity scale), each arriving in turn.',
      fields: { title: S(90), levels: LIST({ type: 'object', properties: { id: S(12), label: S(60), note: S(140) }, required: ['label'], additionalProperties: false }, 7) },
      required: ['levels'], reveals: (sc) => (sc.levels || []).length,
      render: (sc) => `${HEAD(sc)}<div class="lad">${(sc.levels || []).map((l, j) => `<div data-r="${j}" style="--c:var(--alt-${ALT.includes(l.id) ? l.id : 'A2'})"><b>${esc(l.id || l.label)}</b><span>${esc(l.id ? l.label : '')}<small>${esc(l.note || '')}</small></span></div>`).join('')}</div>` },
    flow: { description: 'A → B → C: who passes what to whom, in order (2 to 6 steps).',
      fields: { title: S(90), steps: LIST(S(60), 6) }, required: ['steps'], reveals: (sc) => (sc.steps || []).length,
      render: (sc) => `${HEAD(sc)}<div class="flw">${(sc.steps || []).map((x, j) => `${j ? `<i data-r="${j}">→</i>` : ''}<div data-r="${j}">${esc(x)}</div>`).join('')}</div>` },
    graph: { description: 'A small graph: nodes (with an altitude: P person, A4 swarm, A3 agent, A2 loop, A1 model call, A0 code, X asset) and edges, laid out by altitude.',
      fields: { title: S(90), nodes: LIST({ type: 'object', properties: { id: S(30), label: S(40), alt: { type: 'string', enum: ALT } }, required: ['id', 'label', 'alt'], additionalProperties: false }, 16),
        edges: LIST({ type: 'object', properties: { from: S(30), to: S(30), label: S(30) }, required: ['from', 'to'], additionalProperties: false }, 24) },
      required: ['nodes'], reveals: () => 2, render: graphHtml },
    counter: { description: 'One number that counts up, with what it counts.',
      fields: { value: { type: 'number' }, unit: S(20), label: S(120) }, required: ['value', 'label'],
      render: (sc) => `${sc.kicker ? `<div class="k">${esc(sc.kicker)}</div>` : ''}<p class="sub">${esc(sc.label)}</p><div class="ctr" data-to="${+sc.value || 0}">0<small>${esc(sc.unit || '')}</small></div>` },
    table: { description: 'A small table (e.g. attempt / with access / under the mandate), rows arriving one by one.',
      fields: { title: S(90), cols: LIST(S(30), 5), rows: LIST(LIST(S(80), 5), 10) }, required: ['cols', 'rows'], reveals: (sc) => (sc.rows || []).length,
      render: (sc) => `${HEAD(sc)}<table class="tbl"><thead><tr>${(sc.cols || []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${(sc.rows || []).map((r, j) => `<tr data-r="${j}">${r.map((c) => `<td class="${/^(refused|denied|blocked)/i.test(c) ? 'no' : /^(done|allowed|ok)/i.test(c) ? 'ok' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` },
    embed: { description: 'A scene of the live stage, by its stable step id (stage/step-ids.json, e.g. "elsewhere/the-honest-gap").',
      fields: { title: S(90), step: { type: 'string', pattern: '^[a-z0-9-]+/[a-z0-9-]+$', maxLength: 80 }, pack: { type: 'string', pattern: '^[a-z0-9-]+$', maxLength: 30 } },
      required: ['step'],
      render: (sc) => `${HEAD(sc)}<div class="emb"><iframe loading="lazy" src="${esc(ROOT + 'stage.html#' + (sc.pack ? 'pack=' + sc.pack + '&' : '') + 'step=' + sc.step + '&embed')}" title="${esc(sc.title || 'A stage scene')}"></iframe></div>` },
  };
  const reveals = (sc) => Math.max(1, (PRIMITIVES[sc.type] && PRIMITIVES[sc.type].reveals ? PRIMITIVES[sc.type].reveals(sc) : 1));

  function graphHtml(sc) {   // layered by altitude, top to bottom; edges arrive on the second step
    const nodes = sc.nodes || [], rows = [];
    ALT.forEach((a) => { const r = nodes.filter((n) => n.alt === a); if (r.length) rows.push(r); });
    const W = 800, H = Math.max(160, rows.length * 90), pos = {};
    rows.forEach((r, i) => r.forEach((n, j) => { pos[n.id] = { x: (W * (j + 1)) / (r.length + 1), y: 40 + (i * (H - 80)) / Math.max(1, rows.length - 1) }; }));
    const E = (sc.edges || []).filter((e) => pos[e.from] && pos[e.to]).map((e) => `<line x1="${pos[e.from].x}" y1="${pos[e.from].y}" x2="${pos[e.to].x}" y2="${pos[e.to].y}"/>${e.label ? `<text class="el" x="${(pos[e.from].x + pos[e.to].x) / 2}" y="${(pos[e.from].y + pos[e.to].y) / 2 - 4}">${esc(e.label)}</text>` : ''}`).join('');
    const N = nodes.filter((n) => pos[n.id]).map((n) => `<g transform="translate(${pos[n.id].x},${pos[n.id].y})"><circle r="11" style="fill:var(--alt-${n.alt})"/><text y="28">${esc(n.label)}</text></g>`).join('');
    return `${HEAD(sc)}<svg class="sk-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(sc.title || 'graph')}"><g class="sk-e" data-r="1">${E}</g><g class="sk-n" data-r="0">${N}</g></svg>`;
  }

  function render(sc) {
    const P = PRIMITIVES[sc.type];
    const html = P ? P.render(sc) : `<p class="big">${esc(sc.text || '')}</p>`;
    return `<div class="storykit sk-${esc(sc.type)}">${html}</div>`;
  }

  // ---------- the player: the stage's clock in small (a step is a reveal; → plays the next, ← goes back to the end of the one before)
  function present(el, story, opts = {}) {
    const SC = (story && (story.scenes || story.slides)) || [];
    const total = SC.reduce((a, s) => a + reveals(s), 0);
    let si = 0, ri = 0, timer = null;
    const index = () => SC.slice(0, si).reduce((a, s) => a + reveals(s), 0) + ri;
    function paint(full) {
      const sc = SC[si]; if (!sc) { el.innerHTML = ''; return; }
      el.innerHTML = render(sc);
      show(); count(full);
      if (opts.caption) opts.caption.textContent = sc.caption || '';
      if (opts.onStep) opts.onStep(index(), total, { scene: sc, si, ri, say: sc.say || [] });
    }
    function show() { el.querySelectorAll('[data-r]').forEach((n) => n.classList.toggle('off', +n.dataset.r > ri)); }
    function count(full) {
      const c = el.querySelector('.ctr'); if (!c) return;
      const to = +c.dataset.to, unit = c.querySelector('small') ? c.querySelector('small').outerHTML : '', t0 = performance.now();
      const fmt = (v) => (Math.abs(to) < 10 && to % 1 ? v.toFixed(2) : Math.round(v).toLocaleString('en-GB'));
      const tick = (t) => { const p = full ? 1 : Math.min(1, (t - t0) / 900); c.innerHTML = fmt(to * (1 - (1 - p) ** 3)) + unit; if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    function next() {
      if (!SC.length) return false;
      if (ri < reveals(SC[si]) - 1) { ri++; show(); if (opts.onStep) opts.onStep(index(), total, { scene: SC[si], si, ri, say: SC[si].say || [] }); return true; }
      if (si < SC.length - 1) { si++; ri = 0; paint(); return true; }
      return false;
    }
    function prev() {   // back lands on the END of the step before, so a reveal is always seen whole
      if (ri > 0) { ri--; show(); if (opts.onStep) opts.onStep(index(), total, { scene: SC[si], si, ri, say: SC[si].say || [] }); return true; }
      if (si > 0) { si--; ri = reveals(SC[si]) - 1; paint(true); return true; }
      return false;
    }
    function play() { if (timer) return stop(); timer = setInterval(() => { if (!next()) stop(); }, opts.dwell || 2600); return true; }   // play all: scene after scene, to the end
    function stop() { clearInterval(timer); timer = null; return false; }
    function goto(i) { let k = clamp(+i || 0, 0, Math.max(0, total - 1)); si = 0; while (si < SC.length - 1 && k >= reveals(SC[si])) { k -= reveals(SC[si]); si++; } ri = Math.min(k, reveals(SC[si]) - 1); paint(true); }
    if (opts.keys) addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { stop(); next(); } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { stop(); prev(); }
      else if (e.key === ' ' || e.key === 'p' || e.key === 'P') { e.preventDefault(); timer ? stop() : play(); }
      else if (e.key === 'z' || e.key === 'Z') document.documentElement.classList.toggle('focus');
      else if (e.key === 'Home') goto(0); else if (e.key === 'End') goto(total - 1);
    });
    styleOnce();
    paint();
    return { next, prev, play, stop, goto, get state() { return { si, ri, index: index(), total, playing: !!timer }; } };
  }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // ---------- the tool schema (a coordinator may build a deck only by calling these) and the gate that refuses anything else
  const schemaOf = (name) => { const P = PRIMITIVES[name]; return { type: 'object', properties: { ...P.fields, ...COMMON }, required: P.required, additionalProperties: false }; };
  const STORY_TOOLS = Object.keys(PRIMITIVES).map((name) => ({ name, description: PRIMITIVES[name].description + ' Adds one scene to the deck.', parameters: schemaOf(name) }));
  const openaiTools = () => STORY_TOOLS.map((t) => ({ type: 'function', function: t }));

  function check(v, sch, path, errs) {
    if (sch.type === 'string') { if (typeof v !== 'string') return errs.push(path + ': a string'); if (sch.maxLength && v.length > sch.maxLength) errs.push(`${path}: at most ${sch.maxLength} characters`); if (sch.enum && !sch.enum.includes(v)) errs.push(`${path}: one of ${sch.enum.join(', ')}`); if (sch.pattern && !new RegExp(sch.pattern).test(v)) errs.push(`${path}: does not match ${sch.pattern}`); return; }
    if (sch.type === 'number') { if (typeof v !== 'number' || !isFinite(v)) errs.push(path + ': a number'); return; }
    if (sch.type === 'array') { if (!Array.isArray(v)) return errs.push(path + ': a list'); if (sch.maxItems && v.length > sch.maxItems) errs.push(`${path}: at most ${sch.maxItems} items`); v.forEach((x, i) => check(x, sch.items, `${path}[${i}]`, errs)); return; }
    if (sch.type === 'object') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return errs.push(path + ': an object');
      for (const k of sch.required || []) if (v[k] == null) errs.push(`${path}.${k}: missing`);
      for (const k of Object.keys(v)) { if (!sch.properties[k]) { if (sch.additionalProperties === false) errs.push(`${path}.${k}: not a field of this primitive`); } else check(v[k], sch.properties[k], `${path}.${k}`, errs); }
    }
  }
  function validate(story) {
    const errors = [];
    if (!story || typeof story !== 'object') return { ok: false, errors: ['a story is an object'] };
    if (typeof story.title !== 'string' || !story.title) errors.push('title: missing');
    if (!Array.isArray(story.scenes) || !story.scenes.length) errors.push('scenes: a non-empty list');
    else if (story.scenes.length > 24) errors.push('scenes: at most 24');
    (story.scenes || []).forEach((sc, i) => {
      if (!sc || !PRIMITIVES[sc.type]) return errors.push(`scenes[${i}].type: one of ${Object.keys(PRIMITIVES).join(', ')}`);
      const { type, ...rest } = sc; check(rest, schemaOf(type), `scenes[${i}] (${type})`, errors);
    });
    return { ok: !errors.length, errors };
  }
  function fromToolCalls(calls, meta = {}) {
    const scenes = [], errors = [];
    (calls || []).forEach((c, i) => {
      const name = c.name || (c.function && c.function.name); let args = c.arguments != null ? c.arguments : c.function && c.function.arguments;
      if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { errors.push(`call ${i} (${name}): arguments are not JSON`); return; } }
      if (!PRIMITIVES[name]) { errors.push(`call ${i}: "${name}" is not a primitive`); return; }
      scenes.push({ type: name, ...(args || {}) });
    });
    const story = { title: meta.title || (scenes[0] && scenes[0].title) || 'A story', ...meta, scenes };
    const v = validate(story);
    return { story, errors: errors.concat(v.errors) };
  }

  // ---------- files
  const ROOT = (() => { try { const s = document.currentScript && document.currentScript.src; return s ? s.replace(/assets\/story-kit\.js.*$/, '') : '../'; } catch (e) { return '../'; } })();
  async function load(id) {
    const get = (f) => fetch(`${ROOT}stories/${encodeURIComponent(id)}/${f}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [story, trail] = await Promise.all([get('story.json'), get('trail.json')]);
    if (!story) throw new Error('no story ' + id);
    return { story, trail };
  }

  // ---------- a fallback look, only where the page has none (:where() keeps it at zero specificity)
  function styleOnce() {
    if (document.getElementById('storykit-style')) return;
    const st = document.createElement('style'); st.id = 'storykit-style';
    st.textContent = `
:where(.storykit) { color: var(--ink, #e8f1ef); font-size: 1.15em; line-height: 1.4 }
:where(.storykit) :where(.k) { font: 600 .8em var(--mono, monospace); letter-spacing: .12em; text-transform: uppercase; color: var(--accent, #4fd1a5); margin-bottom: .4em }
:where(.storykit) :where(h2) { font: 700 2em/1.15 var(--font-head, inherit); margin: 0 0 .5em } :where(.storykit .sk-title) { font-size: 2.8em }
:where(.storykit) :where(.big) { font-size: 1.8em; font-weight: 600 } :where(.storykit) :where(.sub) { color: var(--muted, #9fb3af); font-size: 1.1em }
:where(.storykit) :where([data-r]) { transition: opacity .45s, transform .45s } :where(.storykit) :where(.off) { opacity: 0; transform: translateY(8px) }
:where(.storykit) :where(blockquote) { font-size: 1.6em; border-left: 3px solid var(--accent, #4fd1a5); padding-left: .8em; margin: 0 } :where(.storykit) :where(cite) { display: block; font-size: .55em; color: var(--muted, #9fb3af); margin-top: .6em; font-style: normal }
:where(.storykit) :where(.cmp2) { display: grid; grid-template-columns: 1fr 1fr; gap: 1em } :where(.storykit .cmp2 > div) { border: 1px solid var(--line, #24403b); border-radius: 10px; padding: .8em } :where(.storykit .cmp2 .a) { border-color: var(--accent, #4fd1a5) }
:where(.storykit) :where(.lad > div) { display: grid; grid-template-columns: 4em 1fr; gap: .8em; align-items: baseline; padding: .4em .6em; border-left: 4px solid var(--c, var(--accent)); margin: .3em 0 } :where(.storykit .lad small) { display: block; color: var(--muted, #9fb3af) }
:where(.storykit) :where(.flw) { display: flex; flex-wrap: wrap; align-items: center; gap: .6em } :where(.storykit .flw > div) { border: 1px solid var(--accent, #4fd1a5); border-radius: 10px; padding: .5em .8em } :where(.storykit .flw > i) { font-style: normal; color: var(--muted, #9fb3af) }
:where(.storykit) :where(.ctr) { font: 700 4.5em var(--font-head, inherit); color: var(--accent, #4fd1a5) } :where(.storykit .ctr small) { font-size: .35em; margin-left: .3em; color: var(--muted, #9fb3af) }
:where(.storykit) :where(.tbl) { border-collapse: collapse; width: 100% } :where(.storykit .tbl) :where(th, td) { text-align: left; padding: .35em .6em; border-bottom: 1px solid var(--line, #24403b) } :where(.storykit .tbl td.ok) { color: var(--ok, #4fd1a5) } :where(.storykit .tbl td.no) { color: var(--accent, #5ec2ff) }
:where(.storykit) :where(.emb iframe) { width: 100%; aspect-ratio: 16 / 9; border: 1px solid var(--line, #24403b); border-radius: 10px }
:where(.storykit) :where(.sk-graph) { width: 100%; max-height: 60vh } :where(.storykit .sk-graph line) { stroke: var(--muted, #9fb3af); stroke-width: 1.4 } :where(.storykit .sk-graph text) { fill: var(--ink, #e8f1ef); font-size: 13px; text-anchor: middle } :where(.storykit .sk-graph .el) { fill: var(--muted, #9fb3af); font-size: 11px }`;
    document.head.appendChild(st);
  }

  const KIT = { PRIMITIVES, render, present, load, STORY_TOOLS, openaiTools, validate, fromToolCalls, reveals, version: '1' };
  if (typeof window !== 'undefined') window.StoryKit = KIT;
  if (typeof module !== 'undefined' && module.exports) module.exports = KIT;   // node: tools can validate a story
})();
