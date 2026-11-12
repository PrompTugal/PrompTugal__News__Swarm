#!/usr/bin/env node
// Every stage step's stable id ("<scene id>/<label slug>", the same rule as stage/stage.js stepId), per pack and for the
// whole story, so theme pages and stories can link stage.html#pack=<p>&step=<id>&embed and survive scenes moving.
//   node tools/step-ids.mjs   →   stage/step-ids.json
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync('stage/scenes.json', 'utf8'));
const slug = (x) => String(x || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const byId = new Map(j.scenes.map((s) => [s.id, s]));
const ids = (sc) => sc.steps.map((st, i) => ({ step: sc.id + '/' + (st.id || slug(st.label) || String(i + 1)), label: st.label || '', scene: sc.title }));
const out = { about: 'stage.html#pack=<pack>&step=<step>&embed (tools/step-ids.mjs)', story: j.scenes.filter((s) => !s.hidden).flatMap(ids), packs: {} };
for (const [k, p] of Object.entries(j.packs || {})) out.packs[k] = { title: p.title, steps: p.scenes.map((id) => byId.get(id)).filter(Boolean).flatMap(ids) };
const all = out.story.map((x) => x.step); const dup = all.filter((x, i) => all.indexOf(x) !== i);
if (dup.length) { console.error('duplicate step ids:', dup); process.exit(1); }
fs.writeFileSync('stage/step-ids.json', JSON.stringify(out, null, 1) + '\n');
console.log('step ids:', all.length, 'in the story,', Object.keys(out.packs).length, 'packs → stage/step-ids.json');
