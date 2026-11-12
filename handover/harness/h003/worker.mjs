// relay.2's worker hop for h003, meant to run inside SHarness (policy relay2-h003). Prints no key; logs steps (no secrets) to $W/steps.json.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { spawnSync } from 'node:child_process';
const [phase, CO] = process.argv.slice(2); const W = '/dev/shm/r2', HERE = path.dirname(new URL(import.meta.url).pathname);
const PKI = HERE.replace(/worker$/, 'pki') + '/pki-agent.mjs', SGIT = '/usr/local/bin/sgit', BASE = 'https://dev.send.sgraph.ai', TOKEN = 'dummy-no-session-proxy';
const H = 'handover', now = () => new Date().toISOString().replace(/\.\d+Z/, 'Z');
const logf = `${W}/steps.json`, steps = fs.existsSync(logf) ? JSON.parse(fs.readFileSync(logf)) : [];
const step = (o) => { steps.push({ when: now(), inside_harness: true, ...o }); fs.writeFileSync(logf, JSON.stringify(steps, null, 1)); console.log(JSON.stringify(steps.at(-1))) };
const run = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: CO, ...opt }); return { rc: r.status, err: (r.error ? String(r.error) : '') + (r.stderr || '') } };
const scrub = s => String(s).replace(/[A-Za-z0-9_]{20,}/g, '<r>').slice(-400);
const fail = (what, r) => { step({ what, outcome: 'failed', rc: r.rc, error: scrub(r.err) }); process.exit(1) };
function verify(file, sigf) {
  const sig = JSON.parse(fs.readFileSync(path.join(CO, sigf))), keys = JSON.parse(fs.readFileSync(path.join(CO, H, 'keys.json')));
  const e = keys.keys.find(k => k.bundle.signing_fingerprint === sig.fingerprint);
  return { valid: !!e && crypto.verify('sha256', fs.readFileSync(path.join(CO, file)), { key: e.bundle.sign, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig.signature, 'base64')), signer: e?.agent, fp: sig.fingerprint };
}
if (phase === 'open') {
  const v = verify(`${H}/tasks/h003.json`, `${H}/tasks/h003.json.sig`);
  step({ altitude: 'A0', what: 'verify relay.1 signature on the task (Node crypto against handover/keys.json)', ...v });
  if (!v.valid) process.exit(1);
  let r = run(process.execPath, [PKI, 'open', `${H}/sealed/h003.vaultkey.relay2.enc`, '--save', W], { stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.rc !== 0) fail('unseal the vault key with relay.2 key', r);
  step({ altitude: 'A0', what: 'unseal the vault key with relay.2 key into tmpfs', where: 'memory-decrypted', opened_with: 'sha256:8a04c60ad84ce04d' });
  r = run(SGIT, ['clone', '--base-url', BASE, '-', `${W}/in`], { input: fs.readFileSync(`${W}/vault-key-wwpo3r81.txt`), stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.rc !== 0) fail('clone vault wwpo3r81 through the door', r);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(`${W}/in/trains.json`)).digest('hex');
  step({ altitude: 'A1', what: 'clone vault wwpo3r81 through the sharness.net door (127.0.0.1:18443), decrypt locally', where: 'network', vault: 'wwpo3r81', sha256_trains: sha, matches_task: sha === '1e7ef9e1962a400ec9059debf4bf8d810229d5285a5ee035addfc984caae7721' });
  const t = JSON.parse(fs.readFileSync(`${W}/in/trains.json`)); const shape = (o, d = 0) => Array.isArray(o) ? `[${o.length}]` + (o.length ? shape(o[0], d + 1) : '') : o && typeof o === 'object' ? (d > 2 ? '{..}' : '{' + Object.keys(o).map(k => k + ':' + shape(o[k], d + 1)).join(', ') + '}') : typeof o;
  fs.writeFileSync(`${W}/shape.txt`, shape(t));
}
if (phase === 'seal') {
  fs.mkdirSync(`${W}/res-src`, { recursive: true });
  let r = run(process.execPath, [PKI, 'sign', `${W}/out/result.json`], { stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.rc !== 0) fail('sign result.json', r);
  step({ altitude: 'A0', what: 'sign result.json with relay.2 signing key', signed_by: 'sha256:ea1b3d0cda2e9906', result_sha256: crypto.createHash('sha256').update(fs.readFileSync(`${W}/out/result.json`)).digest('hex') });
  r = run(SGIT, ['create', '--base-url', BASE, '--token', TOKEN, `${W}/res`], { stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.rc !== 0) fail('create the result vault through the door', r);
  for (const f of ['result.json', 'result.json.sig']) fs.copyFileSync(`${W}/out/${f}`, `${W}/res/${f}`);
  r = run(SGIT, ['commit', '-m', 'h003 result by relay.2'], { cwd: `${W}/res`, stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.rc !== 0) fail('commit inside the result vault', r);
  r = run(SGIT, ['--token', TOKEN, 'push'], { cwd: `${W}/res`, stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.rc !== 0) fail('push the result vault through the door (no session proxy, so no injected credential)', r);
  const ks = spawnSync(SGIT, ['vault', 'show-key'], { cwd: `${W}/res`, encoding: 'utf8' });
  const m = /^Vault key:\s+(\S+:([a-z0-9]+))$/m.exec(ks.stdout || ''); if (!m) fail('read the result vault key', { rc: ks.status, err: 'no key line' });
  fs.writeFileSync(`${W}/rk.txt`, m[1], { mode: 0o600 });
  step({ altitude: 'A1', what: 'create the result vault and push result.json + .sig through the door (encrypted before it leaves)', where: 'vault-encrypted', vault: m[2] });
  r = run(SGIT, ['pki', 'encrypt', '--recipient', 'sha256:a71e9928bf207a0a', '--output', `${H}/sealed/h003.resultkey.relay3.enc`, `${W}/rk.txt`], { stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.rc !== 0) fail('seal the result vault key to relay.3', r);
  r = run(process.execPath, [PKI, 'sign', `${H}/sealed/h003.resultkey.relay3.enc`], { stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.rc !== 0) fail('sign the sealed key', r);
  step({ altitude: 'A0', what: 'seal the result vault key to relay.3 and sign the envelope', where: 'git-public (working tree, not yet committed)', sealed_to: 'sha256:a71e9928bf207a0a', path: `${H}/sealed/h003.resultkey.relay3.enc` });
  fs.writeFileSync(`${W}/result-vault.txt`, m[2]);
}
