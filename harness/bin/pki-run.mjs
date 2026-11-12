// E5 orchestrator (A3, unharnessed): keys on everything. Prints public fingerprints and key paths/lifetimes only; never a private key.
import fs from 'node:fs'; import crypto from 'node:crypto'; import { spawnSync } from 'node:child_process';
const T0 = Date.now(), now = () => new Date().toISOString(), t = () => Date.now() - T0;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fpOf = (pubKey) => 'sha256:' + sha(pubKey.export({ type: 'spki', format: 'der' })).slice(0, 16);
const pubB64 = (k) => k.export({ type: 'spki', format: 'der' }).toString('base64');
const S = '/opt/sh-venv/bin/sharness-ai', UNIT = '/opt/hx/bin/a0-consensus-signed.mjs', POLICY = '/opt/hx/policy-a0-pki.json', WS = '/opt/hx/ws', KEYF = '/opt/hx/keys/exec.pem';
const timeline = [], keys = [], ev = (unit, phase, more = {}) => timeline.push({ t_ms: t(), unit, phase, ...more });
const signWith = (k, o) => crypto.sign(null, Buffer.from(JSON.stringify(o)), k).toString('base64');
const verifyWith = (pub, o, s) => crypto.verify(null, Buffer.from(JSON.stringify(o)), pub, Buffer.from(s, 'base64'));
// 1. the operator key: made in this process's memory, never written
ev('operator', 'start');
const op = crypto.generateKeyPairSync('ed25519'); keys.push({ role: 'operator (harness.1, A3)', alg: 'ed25519', fp: fpOf(op.publicKey), pub: pubB64(op.publicKey), private_key_path: 'memory of the orchestrator process only (never on disk)', created_at: now(), destroyed_at: null });
ev('operator', 'key', { fp: fpOf(op.publicKey) });
// 2. the code: its sha256, signed
const code = { file: UNIT, sha256: sha(fs.readFileSync(UNIT)) }; const codeSig = signWith(op.privateKey, code); ev('code', 'signed', { sha256: code.sha256, by: fpOf(op.publicKey) });
// 3. the policy: sharness's own hash, signed
const policyHash = spawnSync(S, ['policy', 'hash', POLICY], { encoding: 'utf8' }).stdout.split(' ')[0].trim();
const pol = { file: POLICY, hash: policyHash }; const polSig = signWith(op.privateKey, pol); ev('policy', 'signed', { hash: policyHash, by: fpOf(op.publicKey) });
// 4. the execution key: made for this one process, its certificate binds it to the code and the policy; the private key is handed over in one file
const ex = crypto.generateKeyPairSync('ed25519'); const exCreated = now();
fs.writeFileSync(KEYF, ex.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o400 });
const cert = { subject: 'execution of a0-consensus', exec_fp: fpOf(ex.publicKey), exec_pub: pubB64(ex.publicKey), code_sha256: code.sha256, policy_hash: policyHash, not_after: new Date(Date.now() + 60e3).toISOString() };
const certSig = signWith(op.privateKey, cert); ev('exec-key', 'issued', { fp: cert.exec_fp, by: fpOf(op.publicKey), handed_via: KEYF });
// 5. run the unit under the policy (sharness refuses unless the policy still hashes to the signed hash)
ev('a0-consensus', 'start', { harnessed: true, policy_hash: policyHash });
const r = spawnSync(S, ['run', '--quiet', '--policy', POLICY, '--expect-hash', policyHash, '--', '/opt/node22/bin/node', UNIT, WS, KEYF], { encoding: 'utf8' });
ev('a0-consensus', 'end', { exit: r.status });
// 6. the private execution key is destroyed: overwrite, then unlink
const len = fs.statSync(KEYF).size; fs.chmodSync(KEYF, 0o600); fs.writeFileSync(KEYF, crypto.randomBytes(len)); fs.unlinkSync(KEYF);
const exDestroyed = now(); ev('exec-key', 'destroyed', { path: KEYF, exists_after: fs.existsSync(KEYF) });
keys.push({ role: 'execution (one process, A0)', alg: 'ed25519', fp: cert.exec_fp, pub: cert.exec_pub, private_key_path: `${KEYF} (mode 0400; the policy's only key row: files.read)`, created_at: exCreated, destroyed_at: exDestroyed, destroyed_how: 'overwritten with random bytes, then unlinked, after the process exited' });
// 7. verify the chain, then a tamper test
const sigDoc = JSON.parse(fs.readFileSync(`${WS}/out/summary.sig.json`, 'utf8')); const outBytes = fs.readFileSync(`${WS}/out/summary.json`);
const exPub = crypto.createPublicKey({ key: Buffer.from(cert.exec_pub, 'base64'), format: 'der', type: 'spki' });
const checks = {
  code_signed_by_operator: verifyWith(op.publicKey, code, codeSig) && sha(fs.readFileSync(UNIT)) === code.sha256,
  policy_signed_by_operator: verifyWith(op.publicKey, pol, polSig),
  exec_cert_signed_by_operator: verifyWith(op.publicKey, cert, certSig),
  output_signed_by_exec_key: verifyWith(exPub, sigDoc.stmt, sigDoc.sig) && sigDoc.exec_fp === cert.exec_fp,
  output_bytes_match: sha(outBytes) === sigDoc.stmt.output_sha256,
  process_saw_policy_hash: sigDoc.stmt.policy_hash_seen,
  tamper_one_byte_detected: (() => { const b = Buffer.from(outBytes); b[10] ^= 1; return sha(b) !== sigDoc.stmt.output_sha256; })(),
  tamper_statement_detected: !verifyWith(exPub, { ...sigDoc.stmt, output_sha256: '0'.repeat(64) }, sigDoc.sig),
};
ev('verifier', 'verified', { all: Object.entries(checks).every(([k, v]) => k === 'process_saw_policy_hash' || v === true) });
keys[0].destroyed_at = now(); keys[0].destroyed_how = 'dropped with the orchestrator process at its exit (never serialised)';
ev('operator', 'end');
console.log(JSON.stringify({ code: { ...code, sig_by: fpOf(op.publicKey) }, policy: { ...pol, sig_by: fpOf(op.publicKey) }, exec_cert: { ...cert, exec_pub: undefined, sig_by: fpOf(op.publicKey) },
  output: { file: 'out/summary.json', sha256: sigDoc.stmt.output_sha256, sig_by: sigDoc.exec_fp, pid: sigDoc.stmt.pid, signed_at: sigDoc.stmt.signed_at },
  unit_exit: r.status, unit_stdout: r.stdout.trim(), keys, checks, timeline }, null, 1));
