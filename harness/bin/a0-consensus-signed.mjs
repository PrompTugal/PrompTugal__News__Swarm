// A0 compute, signed: the same summary as a0-consensus, then signed by the execution key handed to this process.
// The private key is read from argv[3] and lives only in this process's memory; it is never printed or written.
import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
const [ws, keyPath] = process.argv.slice(2);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const files = fs.readdirSync(path.join(ws, 'data')).sort();
const datasets = files.map((f) => { const b = fs.readFileSync(path.join(ws, 'data', f)); const j = JSON.parse(b);
  return { file: f, bytes: b.length, sha256: sha(b), keys: Object.keys(j).length, read_utc: j.read_utc ?? null, lisbon_peak_level: j.lisbon_peak_level ?? null }; });
const levels = datasets.map((d) => d.lisbon_peak_level).filter(Boolean);
const out = { unit: 'a0-consensus', datasets, lisbon_peak_level: levels[0] ?? null };
const outText = JSON.stringify(out, null, 1);
fs.writeFileSync(path.join(ws, 'out', 'summary.json'), outText);
const key = crypto.createPrivateKey(fs.readFileSync(keyPath));
const pub = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
const stmt = { output: 'out/summary.json', output_sha256: sha(outText), policy_hash_seen: process.env.SHARNESS_AI_POLICY_HASH ?? null, pid: process.pid, signed_at: new Date().toISOString() };
const sig = crypto.sign(null, Buffer.from(JSON.stringify(stmt)), key).toString('base64');
fs.writeFileSync(path.join(ws, 'out', 'summary.sig.json'), JSON.stringify({ stmt, exec_fp: 'sha256:' + sha(pub).slice(0, 16), sig }, null, 1));
console.log(JSON.stringify({ ok: true, output_sha256: stmt.output_sha256 }));
