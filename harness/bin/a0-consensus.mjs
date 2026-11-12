// A0 compute: read saved storm datasets in the workspace, compute a summary, write it to out/. No network needed.
import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
const ws = process.argv[2]; const t0 = Date.now();
const files = fs.readdirSync(path.join(ws, 'data')).sort();
const datasets = files.map((f) => { const b = fs.readFileSync(path.join(ws, 'data', f)); const j = JSON.parse(b);
  return { file: f, bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex'), keys: Object.keys(j).length, read_utc: j.read_utc ?? null, lisbon_peak_level: j.lisbon_peak_level ?? null }; });
const levels = datasets.map((d) => d.lisbon_peak_level).filter(Boolean);
const out = { unit: 'a0-consensus', datasets, lisbon_peak_level: levels[0] ?? null };
fs.writeFileSync(path.join(ws, 'out', 'summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ok: true, datasets: datasets.length, out_sha256: crypto.createHash('sha256').update(JSON.stringify(out, null, 1)).digest('hex') }));
