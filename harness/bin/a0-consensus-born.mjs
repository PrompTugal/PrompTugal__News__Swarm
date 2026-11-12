// A0 compute with a key born inside (harness.1.fringe, WS-215, E9): the execution key is generated in this process's memory,
// signs the output, and dies with the process. Nothing about it is written but its public half. Never prints a private key.
import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
const ws = process.argv[2]; const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const files = fs.readdirSync(path.join(ws, 'data')).sort();
const datasets = files.map((f) => { const b = fs.readFileSync(path.join(ws, 'data', f)); const j = JSON.parse(b);
  return { file: f, bytes: b.length, sha256: sha(b), keys: Object.keys(j).length, read_utc: j.read_utc ?? null, lisbon_peak_level: j.lisbon_peak_level ?? null }; });
const levels = datasets.map((d) => d.lisbon_peak_level).filter(Boolean);
const outText = JSON.stringify({ unit: 'a0-consensus', datasets, lisbon_peak_level: levels[0] ?? null }, null, 1);
fs.writeFileSync(path.join(ws, 'out', 'summary.json'), outText);
const born = new Date().toISOString(); const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const stmt = { output: 'out/summary.json', output_sha256: sha(outText), policy_hash_seen: process.env.SHARNESS_AI_POLICY_HASH ?? null, pid: process.pid, key_born_at: born, env_names: Object.keys(process.env).length,
  credential_like_env_names: Object.keys(process.env).filter((k) => /TOKEN|SECRET|KEY|PASSWORD/i.test(k)).length, signed_at: new Date().toISOString() };
const sig = crypto.sign(null, Buffer.from(JSON.stringify(stmt)), privateKey).toString('base64');
fs.writeFileSync(path.join(ws, 'out', 'summary.born.json'), JSON.stringify({ stmt, pub, exec_fp: 'sha256:' + sha(Buffer.from(pub, 'base64')).slice(0, 16), sig }, null, 1));
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);   // stay alive 1.5 s so the neighbour test can look for the key
console.log(JSON.stringify({ ok: true, output_sha256: stmt.output_sha256, key_died_at: new Date().toISOString() }));
