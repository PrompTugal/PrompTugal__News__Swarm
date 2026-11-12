#!/usr/bin/env node
// A Studio deck made outside the browser, for a partner (or several), with the same coordinator, primitives, front page and closing
// offer as pages/stand.html, and a trail of how it was made (attendees.1 → partners.1 → swarm.1 → the coordinator → StoryKit → the page).
// By swarm.1.fringe@PrompTugal.dinis (WS-215), 12 Nov 2026, for decks asked at the summit.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/make-deck.mjs --id <story id> --partners a,b [--angle "..."] [--title "..."] [--hops hops.json]
// Uses only PUBLIC facts from partners/<slug>/partner.json (facts, one_line, help, together); never the 'told' lines unless --told.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const K = createRequire(import.meta.url)(path.join(ROOT, 'assets', 'story-kit.js'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ID = arg('--id'), SLUGS = String(arg('--partners', '')).split(',').filter(Boolean), ANGLE = arg('--angle', ''), MODEL = arg('--model', 'anthropic/claude-sonnet-5.5');
if (!ID || !SLUGS.length) { console.error('make-deck: --id and --partners are required'); process.exit(1); }
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const P = SLUGS.map((s) => JSON.parse(fs.readFileSync(path.join(ROOT, 'partners', s, 'partner.json'), 'utf8')));
const brief = P.map((p) => [`## ${p.name} (${p.kind_label || p.kind})`, p.one_line, 'Public facts (from their own pages):', ...(p.facts || []).map((f) => '- ' + (f.fact || f.label || '')).slice(0, 12),
  ...(process.argv.includes('--told') ? ['Told us at the summit:', ...(p.told || []).map((t) => '- ' + (t.fact || t.text || JSON.stringify(t)))] : []),
  'How RiskMandate could help (our hypothesis):', ...[].concat(p.help || []).map((h) => '- ' + (typeof h === 'string' ? h : h.text || h.title || JSON.stringify(h))).slice(0, 6)].join('\n')).join('\n\n');

const OFFER = { email: 'agent@riskmandate.ai', store: 'store.sgit.ai', levels: [
  '£500 · ABP Tailored: your deployment, reflected in the mandate, corrected by a named security professional (1 to 3 days)',
  '£1,500 · ABP Reviewed: two sessions with your team and a custom vault, signed off by a security professional (1 to 5 days)',
  '£5,000 · A deeper engagement: your agents mapped, mandated and measured with us, end to end'],
  discount: 'Summit promotion: commit today and take 25% off any of these, or, with the £1,500 or £5,000 package, a tablet set up for you.' };
const SYSTEM = `You are the coordinator of the PrompTugal swarm's story studio. You turn a brief about one or more companies into a short visual story, a deck, using ONLY the tools you are given: each tool adds one scene, built from one primitive.
Rules:
- Make 5 to 8 scenes that carry the angle and end with one strong statement. Do NOT make an opening title slide or a closing offer or contact slide: they are added for you.
- Use only the facts in the brief. Invent no facts, numbers, customers or people. Label RiskMandate's part as what we would do together, not as their claim.
- Mix primitives where they fit: compare, ladder, flow, graph, table, bullets, statement. No quote scene unless the brief holds a person's exact words.
- Every scene has a short caption and 1 to 3 "say" lines for the presenter.
- Call all the tools in one turn, in order. Then stop.`;

async function chat(messages, extra) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + (process.env.OPEN_ROUTER_KEY || 'sk-or-v1-proxy'), 'Content-Type': 'application/json', 'X-Title': 'swarm.promptugal.news make-deck' },
    body: JSON.stringify({ model: MODEL, messages, usage: { include: true }, ...extra }) });
  const d = await r.json(); if (!r.ok) throw new Error((d.error && d.error.message) || r.status); return d;
}
const hops = arg('--hops') ? JSON.parse(fs.readFileSync(arg('--hops'), 'utf8')) : [];
const user = { role: 'user', content: `${ANGLE ? 'The angle: ' + ANGLE + '\n\n' : ''}The brief:\n${brief}` };
let t0 = Date.now(), at0 = now();
let d = await chat([{ role: 'system', content: SYSTEM }, user], { tools: K.openaiTools(), tool_choice: 'auto', parallel_tool_calls: true, max_tokens: 12000 });
const am = d.choices[0].message; let calls = am.tool_calls || [];
hops.push({ at: at0, who: 'the coordinator', role: 'coordinator', where: 'OpenRouter, from swarm.1 (Claude Code cloud)', model: MODEL, what: `plans the deck: ${calls.length} primitives (${calls.map((c) => c.function.name).join(', ')})`, ms: Date.now() - t0, usd: d.usage?.cost ?? null, tokens: (d.usage?.prompt_tokens || 0) + (d.usage?.completion_tokens || 0), abp: true, github_compute: false });
const bad = calls.map((c) => { const r = K.fromToolCalls([c]); return r.errors.length ? r.errors.join('; ').slice(0, 300) : null; });
if (bad.some(Boolean)) {
  t0 = Date.now(); at0 = now();
  const d2 = await chat([{ role: 'system', content: SYSTEM }, user, am, ...calls.map((c, i) => ({ role: 'tool', tool_call_id: c.id, content: bad[i] ? 'REFUSED: ' + bad[i] + '. Call again, corrected.' : 'ok' })), { role: 'user', content: 'Re-call ONLY the refused tools, corrected, in the same order.' }],
    { tools: K.openaiTools(), tool_choice: 'auto', parallel_tool_calls: true, max_tokens: 8000 });
  const fx = d2.choices[0].message.tool_calls || []; let j = 0; calls = calls.map((c, i) => (bad[i] && fx[j] ? fx[j++] : c));
  hops.push({ at: at0, who: 'StoryKit → the coordinator', role: 'kit', where: 'swarm.1 → OpenRouter', model: MODEL, what: `returns ${bad.filter(Boolean).length} refused calls; ${j} fixed`, ms: Date.now() - t0, usd: d2.usage?.cost ?? null, abp: true, github_compute: false });
}
const { story, errors } = K.fromToolCalls(calls, { id: ID });
if (errors.length) story.scenes = story.scenes.filter((sc) => K.validate({ title: 'x', scenes: [sc] }).ok);
hops.push({ at: now(), who: 'StoryKit', role: 'kit', where: 'swarm.1 (node)', what: errors.length ? `refuses ${errors.length}, keeps ${story.scenes.length} scenes` : `accepts all ${story.scenes.length} scenes`, ms: 0, abp: true, github_compute: false });
const names = P.map((p) => p.name).join(' + ');
story.scenes.unshift({ type: 'title', kicker: 'RiskMandate · a story made at the summit', title: (arg('--title') || names).slice(0, 90), sub: 'Lisbon, 12 November 2026', caption: `For ${names}` });
story.scenes.push({ type: 'bullets', kicker: 'Working together · the summit promotion', title: 'Three ways to start', items: [...OFFER.levels, OFFER.discount], caption: `${OFFER.email} · ${OFFER.store}`, say: ['Pick the level that fits: tailored, reviewed, or end to end.', `Write to ${OFFER.email}.`] });
Object.assign(story, { title: arg('--title') || `${names}: a story made at the summit`, asked_by: 'Dinis, at the summit (relayed by attendees.1)', answered_by: 'their public pages, read by partners.1', at: now(), partners: SLUGS, simulated: false });
const v = K.validate(story); if (!v.ok) { console.error('make-deck: invalid', v.errors.slice(0, 5)); process.exit(2); }
hops.push({ at: now(), who: 'swarm.1', role: 'lead', where: 'GitHub (PrompTugal__News__Swarm, dev) → GitHub Pages', to: 'the page', what: `publishes stories/${ID}/ (story.json and this trail)`, abp: true, github_compute: true });
const dir = path.join(ROOT, 'stories', ID); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'story.json'), JSON.stringify(story, null, 1) + '\n');
fs.writeFileSync(path.join(dir, 'trail.json'), JSON.stringify({ about: 'How this deck was made: every hop, with its real time (UTC). Model text is the deck itself; no prompt text is stored.', hops }, null, 1) + '\n');
const idx = path.join(ROOT, 'stories', 'index.json'); const I = fs.existsSync(idx) ? JSON.parse(fs.readFileSync(idx, 'utf8')) : { stories: [] };
I.stories = [{ id: ID, title: story.title, asked_by: story.asked_by, answered_by: story.answered_by, at: story.at, abp: true, github_compute: true, partners: SLUGS }, ...I.stories.filter((x) => x.id !== ID)];
fs.writeFileSync(idx, JSON.stringify(I, null, 1) + '\n');
const usd = hops.reduce((a, h) => a + (h.usd || 0), 0);
console.log(`make-deck: stories/${ID}: ${story.scenes.length} scenes, ${hops.length} hops, $${usd.toFixed(4)}`);
