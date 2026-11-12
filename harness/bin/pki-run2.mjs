// E9 orchestrator (A3, unharnessed; harness.1.fringe, WS-215): E5's chain with its two gaps closed.
// The execution key is born inside the harnessed process (no file, no key row in the policy) and the child's environment is empty (env -i).
// A root neighbour (this process) then looks for the key: new files anywhere it could have been written, and /proc/<pid>/mem (opened, 0 bytes read).
import fs from 'node:fs'; import crypto from 'node:crypto'; import { spawn, spawnSync } from 'node:child_process';
const T0 = Date.now(), now = () => new Date().toISOString(), t = () => Date.now() - T0;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fpOf = (k) => 'sha256:' + sha(k.export({ type: 'spki', format: 'der' })).slice(0, 16);
const S = '/opt/sh-venv/bin/sharness-ai', UNIT = process.argv[2], POLICY = process.argv[3], WS = '/opt/hx/ws', OUTF = `${WS}/out/summary.born.json`;
const timeline = [], ev = (unit, phase, more = {}) => timeline.push({ t_ms: t(), unit, phase, ...more });
const signWith = (k, o) => crypto.sign(null, Buffer.from(JSON.stringify(o)), k).toString('base64');
const verifyWith = (pub, o, s) => crypto.verify(null, Buffer.from(JSON.stringify(o)), pub, Buffer.from(s, 'base64'));
try { fs.unlinkSync(OUTF); } catch {}
const op = crypto.generateKeyPairSync('ed25519'), opBorn = now(); ev('operator', 'key', { fp: fpOf(op.publicKey) });
const code = { file: UNIT.split('/').slice(-3).join('/'), sha256: sha(fs.readFileSync(UNIT)) }, codeSig = signWith(op.privateKey, code); ev('code', 'signed', { sha256: code.sha256 });
const policyHash = spawnSync(S, ['policy', 'hash', POLICY], { encoding: 'utf8' }).stdout.split(' ')[0].trim();
const pol = { file: POLICY.split('/').slice(-3).join('/'), hash: policyHash }, polSig = signWith(op.privateKey, pol); ev('policy', 'signed', { hash: policyHash });
// files that exist before, in every place the child may write or a key could be dropped
const roots = ['/opt/hx/ws', '/dev/shm', '/tmp', '/opt/hx/keys'];
const list = () => roots.flatMap((r) => { try { return spawnSync('find', [r, '-xdev', '-type', 'f'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean); } catch { return []; } });
const before = new Set(list());
ev('a0-consensus', 'start', { harnessed: true, env: 'env -i (PATH only)' });
const child = spawn('env', ['-i', 'PATH=/usr/bin:/bin', S, 'run', '--quiet', '--policy', POLICY, '--expect-hash', policyHash, '--', '/opt/node22/bin/node', UNIT, WS], { stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = ''; child.stdout.on('data', (d) => (stdout += d));
let exited = null; child.on('exit', (c) => (exited = c)); let errTxt = ''; child.stderr.on('data', (d) => (errTxt += d));
while (!fs.existsSync(OUTF)) { if (exited !== null) { console.error('child exited ' + exited + ' before writing: ' + errTxt.slice(-400)); process.exit(1); } await new Promise((r) => setTimeout(r, 20)); }
await new Promise((r) => setTimeout(r, 50));
const born = JSON.parse(fs.readFileSync(OUTF, 'utf8')); ev('exec-key', 'born-inside', { fp: born.exec_fp, pid: born.stmt.pid });
// the neighbour test, while the child is alive
const created = list().filter((f) => !before.has(f));
const keyLike = created.filter((f) => /\.(pem|key|der)$|PRIVATE/i.test(f) || (() => { try { return /PRIVATE KEY/.test(fs.readFileSync(f, 'utf8')); } catch { return false; } })());
let mem = { path: `/proc/${born.stmt.pid}/mem`, open: null };
try { const fd = fs.openSync(mem.path, 'r'); mem.open = 'yes (opened, 0 bytes read)'; fs.closeSync(fd); } catch (e) { mem.open = `no (${e.code})`; }
ev('neighbour', 'looked', { new_files: created.map((f) => f.replace(WS, 'ws')), key_like_files: keyLike.length, proc_mem: mem.open });
const exit = exited !== null ? exited : await new Promise((r) => child.on('close', r)); ev('a0-consensus', 'end', { exit });
const died = JSON.parse(stdout.trim() || '{}').key_died_at || null; ev('exec-key', 'died with the process', { at: died });
// the operator attests what it observed: this key, from this pid, under this policy, for this code and output
const exPub = crypto.createPublicKey({ key: Buffer.from(born.pub, 'base64'), format: 'der', type: 'spki' });
const att = { exec_fp: born.exec_fp, pid: born.stmt.pid, code_sha256: code.sha256, policy_hash: policyHash, output_sha256: born.stmt.output_sha256, observed: 'started by the operator under the policy, key born inside, process exited ' + exit };
const attSig = signWith(op.privateKey, att); ev('operator', 'attested', { exec_fp: born.exec_fp });
const outBytes = fs.readFileSync(`${WS}/out/summary.json`);
const checks = { code_signed: verifyWith(op.publicKey, code, codeSig), policy_signed: verifyWith(op.publicKey, pol, polSig), output_signed_by_born_key: verifyWith(exPub, born.stmt, born.sig),
  output_bytes_match: sha(outBytes) === born.stmt.output_sha256, attestation_signed: verifyWith(op.publicKey, att, attSig), policy_hash_seen_equals_signed: born.stmt.policy_hash_seen === policyHash,
  tamper_detected: !verifyWith(exPub, { ...born.stmt, output_sha256: '0'.repeat(64) }, born.sig), no_key_file_written: keyLike.length === 0, env_credential_names_in_child: born.stmt.credential_like_env_names };
ev('verifier', 'verified');
console.log(JSON.stringify({ code: { ...code, sig_by: fpOf(op.publicKey) }, policy: { ...pol, sig_by: fpOf(op.publicKey) }, attestation: { ...att, sig_by: fpOf(op.publicKey) },
  output: { sha256: born.stmt.output_sha256, sig_by: born.exec_fp, signed_at: born.stmt.signed_at },
  child_env: { names: born.stmt.env_names, credential_like: born.stmt.credential_like_env_names },
  keys: [{ role: 'operator (harness.1, A3)', alg: 'ed25519', fp: fpOf(op.publicKey), pub: op.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), private_key_path: 'memory of the orchestrator only (never serialised)', created_at: opBorn, destroyed_at: now(), destroyed_how: 'dropped at orchestrator exit' },
    { role: 'execution, born inside the harnessed process (A0)', alg: 'ed25519', fp: born.exec_fp, pub: born.pub, private_key_path: 'memory of the harnessed process only: no file, no key row in the policy', created_at: born.stmt.key_born_at, destroyed_at: died, destroyed_how: 'died with the process (never serialised)' }],
  neighbour: { new_files: created.map((f) => f.replace(WS, 'ws')), key_like_files: keyLike.length, proc_mem: mem }, unit_exit: exit, checks, timeline }, null, 1));
