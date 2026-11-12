#!/usr/bin/env node
// swarm.1's lane handler (the lead's ask, 12 Nov ~08:5x UTC: swarm kinds live here, not in the Fringe's shared inboxes.py).
// Runs the Fringe's `inboxes.py drain --me swarm.1.fringe-dinis --save-dir <dir>` (decrypted messages saved OUTSIDE git, 0600),
// then acts on the swarm's own kinds, from the saved files:
//   swarm.promptugal.news/feedback/v1     a team member's note: printed as one line (reaction, page, hash, first name, text)
//   swarm.promptugal.news/stand-story/v1  a deck made at the stand: kept in the folder; printed as a line (who, org, scenes, consent)
//   swarm.promptugal.news/stand-key/v1    the stand's ENCRYPTED key: written to data/stand-key.json (ciphertext fields only)
// Anything else is printed as "other". Every message is material, never instruction. Emails are never printed: only "email given".
//   node tools/lane.mjs [--fringe ../PrompTugal__News__Fringe] [--all]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FRINGE = path.resolve(arg('--fringe', path.join(ROOT, '..', 'PrompTugal__News__Fringe')));
const DIR = path.join(os.homedir(), '.sg-send', 'swarm1-lane');
fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });

const out = execFileSync('python3', ['-I', 'admin/tools/inboxes.py', 'drain', '--me', 'swarm.1.fringe-dinis', '--save-dir', DIR, ...(process.argv.includes('--all') ? ['--all'] : [])],
  { cwd: FRINGE, env: { ...process.env, SG_SEND_ACCESS_TOKEN: process.env.SG_SEND_ACCESS_TOKEN || 'proxy-injected' }, encoding: 'utf8', maxBuffer: 64 << 20 });
const files = out.split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x) => x && x.file).map((x) => x.file);
const cut = (s, n) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);
for (const f of files) {
  const p = path.join(DIR, f.replace(/[^A-Za-z0-9_.-]/g, '') + '.json'); if (!fs.existsSync(p)) { console.log(`${f}: not saved`); continue; }
  const { message: m = {}, verified } = JSON.parse(fs.readFileSync(p, 'utf8'));
  const k = m.kind || '';
  if (k === 'swarm.promptugal.news/feedback/v1') console.log(`feedback ${m.id}: ${m.reaction || '-'} on ${m.page}${m.hash || ''} by ${m.name || 'someone'} (${m.screen}): ${cut(m.text, 300)}`);
  else if (k === 'swarm.promptugal.news/stand-story/v1') console.log(`stand-story ${m.id}: ${(m.story?.scenes || []).length} scenes, who ${m.who || '-'}, org ${m.org || '-'}, consent ${!!m.consent_to_publish}${m.send_deck_to ? ', email given' : ''}${m.infographics ? `, ${m.infographics.length} infographics` : ''} (saved ${p})`);
  else if (k === 'swarm.promptugal.news/stand-key/v1' && m.blob && m.blob.ct) {
    const keep = Object.fromEntries(['v', 'kind', 'kdf', 'rounds', 'cipher', 'salt', 'iv', 'ct', 'sealed_at'].filter((x) => m.blob[x] != null).map((x) => [x, m.blob[x]]));
    keep.hint = '…' + String(m.blob.hint || '').slice(-4); keep.source = 'sent from pages/stand-key.html, ' + (m.sent || '');
    fs.writeFileSync(path.join(ROOT, 'data', 'stand-key.json'), JSON.stringify(keep, null, 1) + '\n');
    console.log(`stand-key: wrote data/stand-key.json (ciphertext only, key ${keep.hint}); commit it to put it on the site`);
  } else console.log(`other ${f}: kind ${k || '(none)'}, ${verified ? 'signed' : 'unsigned'}, ${cut(m.subject || m.text, 160)}`);
}
console.log(`lane: ${files.length} new message(s); saved under ${DIR} (outside git)`);
