// Demo packs: one idea per step, calm, real data where it exists. swarm.1.designer.fringe@PrompTugal.dinis, 12 Nov 2026 (WS-215).
// The visual language (the same in every pack):
//   mandate: a small solid green disc · reach: the pink circle around it · gap: the hatched red ring between them
//   encrypted: a closed lock on hatched (ciphertext) fill · decrypted: an amber glow with a dashed edge, in memory only, it fades
//   public: an open page · a key: a key glyph with its life as a bar (made → signs → destroyed); the private half is never
//   shown, only its path · a harness: a thick wall with doors; an arrow through a door is allowed, an arrow stopped at the
//   wall with a red cross is refused · a check inside the agent is a lock inside its box; a check outside is a lock on the wall.
// Every step says whether it is a fact (with its source) or an idea. Packs read harness/, runs/, handover/flows/ and the
// Runs repo's summary.json when they can; anything illustrative says so on screen.
(function () {
  'use strict';
  const W = 1600, H = 900;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // building blocks: a step group fades in at its step (with an optional delay), and may fade back at a later step
  const S = (step, inner, o = {}) => `<g class="s ${o.cls || ''}" data-step="${step}"${o.until != null ? ` data-until="${o.until}"` : ''} style="--d:${o.d || 0}s;--dur:${o.dur || .8}s">${inner}</g>`;
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" class="${o.cls || ''}" text-anchor="${o.a || 'middle'}" style="${o.size ? `font-size:${o.size}px;` : ''}${o.fill ? `fill:${o.fill};` : ''}${o.w ? `font-weight:${o.w};` : ''}">${esc(s)}</text>`;
  const lines = (x, y, arr, o = {}) => arr.map((s, i) => T(x, y + i * (o.lh || 30), s, o)).join('');
  const path = (d, o = {}) => { const len = o.len || 1400; return `<path d="${d}" class="ln ${o.cls || ''}" style="--len:${len};${o.stroke ? `stroke:${o.stroke};` : ''}${o.sw ? `stroke-width:${o.sw};` : ''}" ${o.marker ? `marker-end="url(#${o.marker})"` : ''}/>`; };
  const L = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const arrow = (x1, y1, x2, y2, o = {}) => path(`M${x1},${y1} L${x2},${y2}`, { ...o, len: L(x1, y1, x2, y2) + 2, marker: o.marker || 'ar' });
  const lock = (x, y, s = 1, c = 'var(--accent)', open = false) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-11,-4 V-13 a11,11 0 0 1 22,0 ${open ? 'V-16' : 'V-4'}" fill="none" stroke="${c}" stroke-width="4" ${open ? 'transform="translate(10,-4) rotate(25)"' : ''}/><rect x="-16" y="-5" width="32" height="25" rx="5" fill="${c}"/><circle cx="0" cy="6" r="3.5" fill="var(--bg)"/></g>`;
  const key = (x, y, s = 1, c = 'var(--accent2)') => `<g transform="translate(${x},${y}) scale(${s})"><circle cx="-14" cy="0" r="10" fill="none" stroke="${c}" stroke-width="5"/><path d="M-4,0 H22 M14,0 V8 M20,0 V6" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
  const page = (x, y, s = 1, c = 'var(--ink)') => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-16,-22 H8 L18,-12 V22 H-16 Z" fill="none" stroke="${c}" stroke-width="3"/><path d="M8,-22 V-12 H18 M-9,-4 H11 M-9,4 H11 M-9,12 H5" stroke="${c}" stroke-width="2.5" fill="none"/></g>`;
  const agent = (x, y, label, o = {}) => `<g transform="translate(${x},${y})"><rect x="-${o.w || 70}" y="-${o.h || 46}" width="${2 * (o.w || 70)}" height="${2 * (o.h || 46)}" rx="16" class="box" style="${o.stroke ? `stroke:${o.stroke};` : ''}"/>${T(0, 8, label, { size: o.size || 22, w: 600 })}</g>`;
  const tag = (kind, src) => ({ kind, src });

  // ---------- the packs. Each step: { cap, say?, tag, dur } and draw(ctx) returns the SVG for every step at once.
  const PACKS = [];

  PACKS.push({
    id: 'language', title: 'The visual language', blurb: 'Six marks, used the same way in every pack.',
    steps: [
      { cap: 'Mandate: what a unit is allowed to do. A small green disc.', tag: tag('idea') },
      { cap: 'Reach: what the process running it can actually touch. The pink circle around it.', tag: tag('idea') },
      { cap: 'The gap: reach minus mandate. Hatched red. Every incident lives here.', tag: tag('idea') },
      { cap: 'Data has three states: public (an open page), encrypted (a lock on ciphertext), decrypted (amber, in memory, and it fades).', tag: tag('idea') },
      { cap: 'A key lives a short life: made, signs, destroyed. Its private half is never shown, only where it lives.', tag: tag('idea') },
      { cap: 'A harness is a wall with doors. Through a door: allowed. Stopped at the wall: refused.', tag: tag('idea') },
    ],
    draw() {
      const c = [260, 800, 1340];
      return S(1, `<circle cx="${c[0]}" cy="260" r="34" class="mandate"/>` + T(c[0], 340, 'mandate', { size: 24, w: 600 }))
        + S(2, `<circle cx="${c[1]}" cy="260" r="120" class="reach"/><circle cx="${c[1]}" cy="260" r="34" class="mandate"/>` + T(c[1], 420, 'reach', { size: 24, w: 600 }))
        + S(3, `<circle cx="${c[2]}" cy="260" r="120" class="reach"/><path d="${ring(c[2], 260, 120, 34)}" class="gap"/><circle cx="${c[2]}" cy="260" r="34" class="mandate"/>` + T(c[2], 420, 'the gap', { size: 24, w: 600, fill: 'var(--bad)' }))
        + S(4, page(220, 600, 1.6) + T(220, 680, 'public', { size: 20 }), { d: 0 }) + S(4, `<rect x="400" y="555" width="110" height="90" rx="10" class="cipher"/>` + lock(455, 600, 1.4) + T(455, 680, 'encrypted', { size: 20 }), { d: .5 }) + S(4, `<rect x="640" y="555" width="110" height="90" rx="10" class="plain"/>` + T(695, 608, 'abc…', { size: 22, fill: 'var(--warn)' }) + T(695, 680, 'decrypted, in memory', { size: 20 }), { d: 1 })
        + S(5, key(930, 600, 1.6) + `<rect x="1010" y="592" width="220" height="16" rx="8" class="life"/><circle cx="1010" cy="600" r="9" class="made"/><circle cx="1080" cy="600" r="6" class="sig"/><circle cx="1120" cy="600" r="6" class="sig"/><circle cx="1160" cy="600" r="6" class="sig"/>` + T(1240, 607, '✕', { size: 26, fill: 'var(--bad)' }) + T(1080, 680, 'made → signs → destroyed', { size: 20 }))
        + S(6, `<rect x="1330" y="540" width="180" height="130" rx="8" class="wall"/><rect x="1500" y="585" width="22" height="34" class="door"/>` + arrow(1400, 602, 1560, 602, { cls: 'ok-ln', marker: 'ar-ok' }) + arrow(1400, 570, 1488, 570, { cls: 'bad-ln', marker: 'ar-bad' }) + T(1500, 562, '✕', { size: 22, fill: 'var(--bad)' }) + T(1420, 700, 'harness', { size: 20 }));
    },
  });

  PACKS.push({
    id: 'gap', title: 'Mandate, reach, gap', blurb: 'The three words for everything else.',
    steps: [
      { cap: 'An LLM call\'s mandate is one line: a prompt in, an answer out. It may use no tool.', tag: tag('fact', 'how.html, "Who holds what"') },
      { cap: 'The process it ran in could reach far more.', tag: tag('fact', 'harness/2026-11-12-swarm1-probe-and-hello.json, E01'), dur: 2.2 },
      { cap: 'The space between the two is the gap. Every incident lives there.', tag: tag('idea') },
      { cap: 'Close it two ways: shrink the reach (the harness), or move the work where the reach was never there.', tag: tag('idea') },
    ],
    draw(F) {
      const h = F.harness?.before, cx = 560, cy = 470;
      const facts = h ? [`uid ${h.uid}  (root)`, `capabilities: ${String(h.capabilities).split(' ')[0]}`, `seccomp: ${h.seccomp ? 'on' : 'off'} · no_new_privs: ${h.no_new_privs ? 'on' : 'off'}`, `tools: ${(h.tools_reachable || []).slice(0, 3).join(', ')} …`, 'network: the whole internet', `working directory writable: ${h.cwd_writable ? 'yes' : 'no'}`] : ['(harness evidence not loaded)'];
      return S(1, `<circle cx="${cx}" cy="${cy}" r="46" class="mandate"/>` + T(cx, cy + 8, 'A1', { size: 26, w: 700, fill: 'var(--bg)' }) + T(cx, cy + 92, 'prompt in → answer out', { size: 22 }), { until: 9 })
        + S(2, `<circle cx="${cx}" cy="${cy}" r="330" class="reach grow"/>`, { dur: 2 }) + S(2, T(cx, cy - 350, 'reach', { size: 26, w: 600, fill: 'var(--reach)' }), { d: 1.2 })
        + facts.map((f, i) => S(2, T(1000, 250 + i * 46, f, { a: 'start', size: 24, cls: 'mono' }), { d: .6 + i * .25 })).join('')
        + S(2, T(1000, 200, 'what the process could touch (measured)', { a: 'start', size: 18, fill: 'var(--muted)' }), { d: .3 })
        + S(3, `<path d="${ring(cx, cy, 330, 46)}" class="gap"/>` + T(cx, cy - 190, 'THE GAP', { size: 40, w: 800, fill: 'var(--bad)' }), { dur: 1.2 })
        + S(4, arrow(cx + 330, cy + 220, cx + 120, cy + 90, { cls: 'ok-ln', marker: 'ar-ok', sw: 5 }) + T(1080, 720, '1 · shrink the reach: the harness', { a: 'start', size: 26, w: 600 }) + T(1080, 770, '2 · run the work where the assets are not', { a: 'start', size: 26, w: 600 }), { d: .2 });
    },
    say: { Engineer: 'Your agent\'s process has root and the internet. Its job needed neither.', Investor: 'Every agent incident so far fits in the gap between what it was asked and what it could do. We measure the gap and close it.', CISO: 'Mandate is policy. Reach is fact. Audit the gap, not the prompt.' },
  });

  PACKS.push({
    id: 'harness', title: 'SHarness: the secure harness', blurb: 'One process, one policy, six probes.',
    steps: [
      { cap: 'Today an agent\'s process runs as root, with everything.', tag: tag('fact', 'harness E01 probe') },
      { cap: 'Put one child process under one deny-all policy.', tag: tag('fact', 'harness E04: policy "hello"'), dur: 1.4 },
      { cap: 'Six probes. Through the door: allowed. At the wall: refused.', tag: tag('fact', 'harness E04 results'), dur: 3.2 },
      { cap: 'Held: six of six. Measured, not designed.', tag: tag('fact', 'harness E04: held, of, failed') },
      { cap: 'And what it does not cover yet, said plainly.', tag: tag('fact', 'harness E04 not_covered') },
    ],
    draw(F) {
      const a = F.harness?.after || {}, b = F.harness?.before || {}, res = a.results || [], pol = a.policy || {};
      const bx = 380, by = 250, bw = 520, bh = 420, doorY = by + 70;
      let s = S(1, `<rect x="${bx + 30}" y="${by + 160}" width="220" height="120" rx="18" class="box hot"/>` + T(bx + 140, by + 212, 'agent process', { size: 24, w: 600 }) + T(bx + 140, by + 248, `uid ${b.uid ?? 0} · caps ${String(b.capabilities || 'all').split(' ')[0]}`, { size: 18, cls: 'mono', fill: 'var(--bad)' }));
      s += S(2, `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="10" class="wall"/><rect x="${bx + bw - 10}" y="${doorY - 22}" width="20" height="44" class="door"/>` + T(bx + bw - 30, doorY - 32, 'read', { size: 16, a: 'end', fill: 'var(--ok)' }) + T(bx + 20, by - 18, `policy "${pol.id || 'hello'}" · ${String(a.policy_hash || '').slice(0, 19)}…`, { a: 'start', size: 18, cls: 'mono' }), { dur: 1.2 });
      const pf = [`network: ${pol.network || 'none'}`, `write: ${JSON.stringify(pol.files?.write ?? [])}`, `no_new_privs: ${pol.process?.no_new_privs ?? 'on'}`, `memory: ${pol.process?.max_memory_mb ?? pol.process?.memory_mb ?? 128} MB max`];
      s += S(2, T(bx + 20, by - 52, pf.join('  ·  '), { a: 'start', size: 18, cls: 'mono', fill: 'var(--muted)' }), { d: .5 });
      res.slice(0, 6).forEach((r, i) => {
        const got = String(r.got).split(/[\s(]/)[0], y = by + 130 + i * 42, ok = got === 'allowed', x0 = bx + 252, d = i * .45;
        s += S(3, (ok ? arrow(x0, doorY, bx + bw + 120, doorY, { cls: 'ok-ln', marker: 'ar-ok' }) : arrow(x0, y, bx + bw - 14, y, { cls: 'bad-ln', marker: 'ar-bad' }) + T(bx + bw + 2, y + 8, '✕', { size: 24, fill: 'var(--bad)' }))
          + T(bx + bw + (ok ? 130 : 60), (ok ? doorY : y) + 7, `${r.probe}: ${got}${String(r.expected).split(/[\s(]/)[0] === got ? '' : ' (expected ' + r.expected + ')'}`, { a: 'start', size: 22, cls: 'mono', fill: ok ? 'var(--ok)' : 'var(--bad)' }), { d });
      });
      s += S(4, T(bx + bw / 2, by + bh + 80, `${a.held ?? '?'} of ${a.of ?? '?'} held · ${a.failed ?? 0} failed`, { size: 44, w: 800, fill: 'var(--ok)' }));
      const nc = String(a.not_covered || '').split(/;\s*|\.\s+/).filter(Boolean).slice(0, 4);
      s += S(5, T(1000, by + 400, 'not covered yet:', { a: 'start', size: 20, fill: 'var(--muted)' }) + nc.map((x, i) => T(1000, by + 435 + i * 30, '· ' + x.slice(0, 56), { a: 'start', size: 18 })).join(''));
      return s;
    },
    say: { Engineer: 'Landlock, no_new_privs and an empty network, one policy per process: six probes, six held.', Investor: 'The harness turns "we hope it behaves" into "it can\'t".', CISO: 'Measured, not designed, and we list what it doesn\'t cover.' },
  });

  PACKS.push({
    id: 'policy', title: 'Where the policy check lives', blurb: 'Inside the agent is hope. Outside is control.',
    steps: [
      { cap: 'An agent asks to act on an asset.', tag: tag('idea') },
      { cap: 'A policy checks and refuses.', tag: tag('fact', 'how.html, "Who holds what": the Cannot column') },
      { cap: 'But if the check runs inside the agent, a tricked agent walks around it.', tag: tag('idea', 'Dinis, 01:18: "we\'re still hoping that it behaves well"'), dur: 1.6 },
      { cap: 'Move the check outside, onto the wall: the harness, the runner checking the packet\'s signature, the Action holding the budget.', tag: tag('fact', 'how.html steps 3–4; harness E04') },
    ],
    draw() {
      const ax = 420, ay = 450, asx = 1240;
      return S(1, agent(ax, ay, 'agent', { w: 150, h: 120 }) + `<rect x="${asx - 90}" y="${ay - 70}" width="180" height="140" rx="16" class="asset"/>` + T(asx, ay + 8, 'asset', { size: 26, w: 600 }), { until: 9 })
        + S(1, arrow(ax + 150, ay - 40, asx - 100, ay - 40, { cls: 'ask-ln', marker: 'ar' }), { d: .4, until: 1 })
        + S(2, lock(ax + 90, ay - 40, 1.2, 'var(--accent)') + arrow(ax + 110, ay - 40, asx - 100, ay - 40, { cls: 'bad-ln', marker: 'ar-bad', len: 200 }) + T(ax + 90, ay - 80, 'check', { size: 18 }), { until: 2 })
        + S(3, lock(ax + 90, ay - 40, 1.2, 'var(--dim)') + path(`M${ax - 40},${ay + 10} C${ax + 20},${ay + 110} ${ax + 180},${ay + 110} ${asx - 100},${ay + 30}`, { cls: 'bad-ln', marker: 'ar-bad', sw: 5, len: 900 }) + T(ax - 150, ay + 170, 'tricked: the check is skipped', { a: 'start', size: 24, fill: 'var(--bad)', w: 600 }), { until: 3, dur: 1.4 })
        + S(4, `<rect x="${ax + 230}" y="${ay - 200}" width="26" height="400" class="wall-v"/>` + lock(ax + 243, ay - 40, 1.4, 'var(--ok)') + arrow(ax + 150, ay - 40, ax + 222, ay - 40, { cls: 'bad-ln', marker: 'ar-bad' }) + T(ax + 243, ay + 240, 'the check is on the wall, outside the agent', { size: 22, w: 600 }) + T(ax + 243, ay + 275, 'harness · signature checked by the runner · budget held by the Action', { size: 18, fill: 'var(--muted)' }));
    },
    say: { Engineer: 'A check inside the process it guards is a suggestion.', Investor: 'We sell the wall, not the promise.', CISO: 'Ask of every control: enforced by what, from where?' },
  });

  PACKS.push({
    id: 'keys', title: 'A key\'s life', blurb: 'Made for one job, signs, gone.',
    steps: [
      { cap: 'A key is made for one packet. Only its public fingerprint is ever shown.', tag: tag('fact', 'how.html step 2; the packet\'s fingerprint') },
      { cap: 'Every model call gets its own key, and signs its answer\'s sha256, never its text.', tag: tag('fact', 'the run\'s calls: one signed key per call'), dur: 2 },
      { cap: 'The runner signs the whole result with its key for this run.', tag: tag('fact', 'the run\'s signed_by') },
      { cap: 'The private halves never leave the machine: you see where they live, never what they are.', tag: tag('fact', 'pki-agent.mjs: ~/.sg-send/keys/, mode 0600') },
      { cap: 'Publish checks every signature before anything reaches the site.', tag: tag('fact', 'how.html, "Publish"') },
    ],
    draw(F) {
      const r = F.packet || {}, calls = (r.calls || []).filter((c) => c.signed).slice(0, 14), y0 = 260;
      let s = S(1, key(220, y0, 1.6) + T(300, y0 - 22, 'packet ' + (r.packet || 's001'), { a: 'start', size: 22, w: 600 }) + T(300, y0 + 14, (r.packet_fp || 'sha256:…').replace('sha256:', 'sha256 '), { a: 'start', size: 20, cls: 'mono', fill: 'var(--accent2)' }));
      calls.forEach((c, i) => { const x = 220 + (i % 7) * 175, y = 430 + Math.floor(i / 7) * 90; s += S(2, key(x, y, .8, 'var(--alt-A1)') + T(x + 26, y + 6, String(c.signed.by.fp).replace('sha256:', '').slice(0, 8), { a: 'start', size: 15, cls: 'mono', fill: 'var(--alt-A1)' }), { d: i * .12 }); });
      s += S(2, T(220, 400, `${(r.calls || []).filter((c) => c.signed).length} calls, ${new Set((r.calls || []).filter((c) => c.signed).map((c) => c.signed.by.fp)).size} keys: one each`, { a: 'start', size: 22, w: 600 }), { d: .2 });
      s += S(3, key(220, 680, 1.6, 'var(--alt-A3)') + T(300, 660, 'result signed by ' + String(r.by || 'the runner').split('@')[0], { a: 'start', size: 22, w: 600 }) + T(300, 696, String(r.signed_by || 'sha256:…').replace('sha256:', 'sha256 '), { a: 'start', size: 20, cls: 'mono', fill: 'var(--alt-A3)' }));
      s += S(4, `<rect x="980" y="620" width="520" height="130" rx="14" class="vaultbox"/>` + lock(1030, 685, 1.2) + T(1070, 670, 'private halves: never shown', { a: 'start', size: 22, w: 600 }) + T(1070, 705, '~/.sg-send/keys/sha256_…/  (0600)', { a: 'start', size: 18, cls: 'mono', fill: 'var(--muted)' }));
      s += S(5, T(800, 830, '✓ packet  ✓ result  ✓ every call: verified before publish', { size: 30, w: 700, fill: 'var(--ok)' }));
      return s;
    },
    say: { Engineer: 'Short-lived keys, one per unit: a leak is one call, not the system.', Investor: 'Every number on the site is signed by the thing that made it.', CISO: 'Who did what is in the signatures, not the logs.' },
  });

  PACKS.push({
    id: 'vault', title: 'Where is the data? (sgit vaults)', blurb: 'Public, encrypted, decrypted: colour-coded, hop by hop.',
    steps: [
      { cap: 'Four places data can sit: Git (public), a vault (encrypted), memory (decrypted, briefly), and the network.', tag: tag('fact', 'handover/flows/FORMAT.json, "where"') },
      { cap: 'The task is public: written to Git, signed.', tag: null, dur: 1.2 },
      { cap: 'The private input is sealed to the next agent\'s key. Git and the vault only ever see ciphertext.', tag: null, dur: 1.4 },
      { cap: 'Only that agent opens it, in memory, for as long as the work takes. Then it is gone.', tag: null, dur: 1.4 },
      { cap: 'The output is sealed onward, or published in the open on purpose.', tag: null, dur: 1.4 },
      { cap: 'Private input in Git: never.', tag: null },
    ],
    draw(F) {
      const fl = F.flow, lanes = [['git-public', 'Git · public', 'var(--ink)'], ['vault-encrypted', 'vault · encrypted', 'var(--accent)'], ['memory-decrypted', 'memory · decrypted', 'var(--warn)'], ['network', 'network', 'var(--muted)']];
      const ly = (w) => 230 + lanes.findIndex((l) => l[0] === w) * 140;
      let s = lanes.map(([w, l, c], i) => S(1, `<rect x="120" y="${ly(w) - 55}" width="1380" height="110" rx="14" class="lane ${w}"/>` + T(140, ly(w) - 28, l, { a: 'start', size: 20, w: 600, fill: c }), { d: i * .2 })).join('');
      const steps = (fl?.steps || []).slice(0, 8), xs = (i) => 330 + i * Math.min(260, 1100 / Math.max(1, steps.length - 1));
      const glyph = (st, x, y) => st.where === 'vault-encrypted' ? `<rect x="${x - 40}" y="${y - 34}" width="80" height="68" rx="10" class="cipher"/>` + lock(x, y - 2, 1) : st.where === 'memory-decrypted' ? `<rect x="${x - 40}" y="${y - 34}" width="80" height="68" rx="10" class="plain"/>` + T(x, y + 8, 'abc', { size: 20, fill: 'var(--warn)' }) : st.where === 'git-public' ? page(x, y, 1.3) : `<circle cx="${x}" cy="${y}" r="20" class="netdot"/>`;
      const by = (st) => String(st.who || '').split('@')[0].replace('.fringe', '');
      steps.forEach((st, i) => {
        const x = xs(i), y = ly(st.where), stp = Math.min(5, 2 + Math.floor(i * 3 / Math.max(1, steps.length)));
        s += S(stp, glyph(st, x, y) + T(x, y + 70, `${st.n}. ${by(st)}`, { size: 15, w: 600 }) + wrap(String(st.what || ''), 30).slice(0, 2).map((ln, j) => T(x, y + 90 + j * 17, ln, { size: 14, fill: 'var(--muted)' })).join('') + (st.sealed_to ? T(x, y - 46, 'sealed to the next key', { size: 13, fill: 'var(--accent)' }) : ''), { d: (i % 3) * .3, cls: st.where === 'memory-decrypted' ? 'ephemeral' : '' });
        if (i) { const p = steps[i - 1]; s += S(stp, arrow(xs(i - 1) + 44, ly(p.where), x - 46, y, { cls: 'flow-ln', marker: 'ar' }), { d: (i % 3) * .3 }); }
      });
      s += S(6, T(800, 830, `private input in Git: ${fl && fl.private_input_in_git === false ? 'never' : 'never (by the format\'s rule)'}`, { size: 34, w: 800, fill: 'var(--ok)' }));
      if (!fl?.real) s += S(1, T(1480, 140, 'illustration from the proposed flow format · the real relay run replaces it when it lands', { a: 'end', size: 16, fill: 'var(--warn)' }));
      return s;
    },
    say: { Engineer: 'Git is the transport; it never sees plaintext. Decryption happens in memory, per hop, per key.', Investor: 'Agents can hand each other secrets without any of them being stored in the clear.', CISO: 'You can answer "where is it encrypted, where is it not" from the flow file, hop by hop.' },
  });

  PACKS.push({
    id: 'push', title: 'Every run starts with a push', blurb: 'Git is the queue, the log and the trigger.',
    steps: [
      { cap: 'An agent writes a request and signs it.', tag: tag('fact', 'how.html, "Every run starts with a push" 1') },
      { cap: 'The push is the button: nobody presses anything.', tag: tag('fact', 'step 2') },
      { cap: 'The Action checks the signature and runs inside the budget.', tag: tag('fact', 'step 3') },
      { cap: 'One push became twelve jobs at once.', tag: tag('fact', 'Runs repo runs/summary.json'), dur: 2.2 },
      { cap: 'Each result is signed, and GitHub attests where it came from.', tag: tag('fact', 'steps 4–5: gh attestation verify') },
    ],
    draw(F) {
      const sm = F.summary, big = (sm?.by_workflow_run || []).slice().sort((a, b) => b.jobs - a.jobs)[0], jobs = big?.jobs || 12, y = 330;
      let s = S(1, page(200, y, 1.8) + key(200, y + 80, .9) + T(200, y + 140, 'request, signed', { size: 20, w: 600 }));
      s += S(2, arrow(250, y, 430, y) + `<circle cx="500" cy="${y}" r="44" class="commit"/>` + T(500, y + 8, (big?.commit || '').slice(0, 7) || 'commit', { size: 18, cls: 'mono', fill: 'var(--bg)' }) + T(500, y + 80, 'the push', { size: 20, w: 600 }));
      s += S(3, arrow(548, y, 700, y) + `<rect x="710" y="${y - 50}" width="200" height="100" rx="16" class="box"/>` + T(810, y - 5, 'GitHub Action', { size: 22, w: 600 }) + T(810, y + 25, 'signature ✓ · budget', { size: 16, fill: 'var(--muted)' }));
      for (let i = 0; i < jobs; i++) { const yy = 150 + i * (560 / Math.max(1, jobs - 1)); s += S(4, path(`M912,${y} C1000,${y} 1000,${yy} 1080,${yy}`, { cls: 'flow-ln', len: 700 }) + `<rect x="1084" y="${yy - 14}" width="70" height="28" rx="6" class="job"/>`, { d: i * .1 }); }
      s += S(4, T(1200, y - 10, `1 push → ${jobs} jobs`, { a: 'start', size: 40, w: 800 }) + T(1200, y + 30, big ? `${big.calls} calls · $${Number(big.openrouter_usd).toFixed(3)} · ${Math.round(big.span_ms / 1000)} s` : '', { a: 'start', size: 22, fill: 'var(--muted)' }), { d: .6 });
      s += S(5, key(1220, 640, 1) + T(1260, 647, 'result signed', { a: 'start', size: 22, w: 600 }) + T(1220, 690, 'gh attestation verify', { a: 'start', size: 19, cls: 'mono', fill: 'var(--muted)' }) + T(1220, 716, 'runs/<id>/result.json', { a: 'start', size: 19, cls: 'mono', fill: 'var(--muted)' }));
      return s;
    },
    say: { Engineer: 'Git is the queue, the log and the trigger.', Investor: 'No sessions to keep alive: work scales with pushes.', CISO: 'Each result traces back to a commit, a workflow run and a key.' },
  });

  function wrap(s, n) { const out = []; let cur = ''; for (const w of s.split(/\s+/)) { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); if (out.length > 2) out[1] = out[1].slice(0, n - 1) + '…'; return out; }
  // a ring (annulus) as one path, so the gap can be filled and hatched
  function ring(cx, cy, R, r) { return `M${cx - R},${cy} a${R},${R} 0 1 0 ${2 * R},0 a${R},${R} 0 1 0 ${-2 * R},0 Z M${cx - r},${cy} a${r},${r} 0 1 1 ${2 * r},0 a${r},${r} 0 1 1 ${-2 * r},0 Z`; }

  const DEFS = `<defs>
    <pattern id="hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="color-mix(in srgb,var(--bad) 18%,transparent)"/><line x1="0" y1="0" x2="0" y2="12" stroke="var(--bad)" stroke-width="4" opacity=".55"/></pattern>
    <pattern id="ciph" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="10" height="10" fill="color-mix(in srgb,var(--accent) 12%,transparent)"/><line x1="0" y1="0" x2="0" y2="10" stroke="var(--accent)" stroke-width="2" opacity=".5"/></pattern>
    ${['ar:var(--muted)', 'ar-ok:var(--ok)', 'ar-bad:var(--bad)'].map((m) => { const [id, c] = m.split(':'); return `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`; }).join('')}
    <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter></defs>`;

  window.PACKS = { list: PACKS, W, H, DEFS };
})();
