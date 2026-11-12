#!/usr/bin/env node
// harness.1.fringe@PrompTugal.dinis (WS-215): put a relay's worker hop inside SHarness (sharness-ai 0.2.0, Landlock).
// The policy is written in the relay's own container from its own paths, so its hash is that container's.
//
//   1. install (outside the repo):  python3 -m venv /opt/sh-venv && /opt/sh-venv/bin/pip install sharness-ai==0.2.0
//   2. the network door (background): /opt/sh-venv/bin/sharness-ai session new --dir /opt/sh-session --roles app fs net launcher --days 1
//        /opt/sh-venv/bin/sharness-ai net serve --hosts dev.send.sgraph.ai [openrouter.ai] --ports 443 --proxy-port 18443 --audit --session /opt/sh-session 2> door.audit &
//   3. the policy:  node tools/harness-relay.mjs policy --id relay2-h003 --checkout "$PWD" --keys <relay.2's own key dir> --work /dev/shm/r2 [--extra-read P ...] [--extra-exec P ...]
//                   -> harness/relay2/policy-<id>.json and its hash (sharness-ai policy hash)
//   4. the probe:   node tools/harness-relay.mjs probe --id relay2-h003 --checkout "$PWD" --keys <dir> [--others <a sibling key dir>]
//                   -> harness/relay2/probe-<id>.json: each attempt before (bare) and after (under the policy)
//   5. the hop:     HTTPS_PROXY=http://127.0.0.1:18443 https_proxy=http://127.0.0.1:18443 \
//                   /opt/sh-venv/bin/sharness-ai run --policy harness/relay2/policy-<id>.json --expect-hash <hash> -- <the worker command>
//                   The worker verifies, unseals, clones, computes, signs, pushes the vault and seals; it writes only to handover/ and the work dir.
//                   The git commit and push of handover/ are the agent's own step (A3), outside the harness: .git is not writable inside.
// Never prints a key: attempts record readable/writable yes or no and the error, never content.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync, execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SH = process.env.SHARNESS_AI || '/opt/sh-venv/bin/sharness-ai';
const argv = process.argv.slice(2), cmd = argv[0];
const one = (n, d) => { const i = argv.indexOf(n); return i > 0 ? argv[i + 1] : d; };
const many = (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : []));
const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
const which = (b) => { const r = spawnSync('sh', ['-c', `command -v ${b}`], { encoding: 'utf8' }); return r.status === 0 ? real(r.stdout.trim()) : null; };
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const ID = one('--id', 'relay2'), OUT = path.join(ROOT, 'harness', 'relay2'); fs.mkdirSync(OUT, { recursive: true });
const PORT = +one('--port', '18443');

function prefixOf(bin) {          // the install root of a binary: /opt/node22 for /opt/node22/bin/node; a venv for a console script
  if (!bin) return null; const d = path.dirname(path.dirname(bin));
  return d === '/usr' || d === '/' ? null : d;
}
function pythonHome(venv) {       // a venv's base interpreter (pyvenv.cfg home), which it also has to read and execute
  try { const h = fs.readFileSync(path.join(venv, 'pyvenv.cfg'), 'utf8').match(/^home\s*=\s*(.+)$/m); return h ? prefixOf(path.join(h[1].trim(), 'python3')) : null; } catch { return null; }
}

function makePolicy() {
  const checkout = real(one('--checkout', process.cwd())), keys = real(one('--keys', '')), work = one('--work', '/dev/shm/r2');
  if (!keys) throw new Error('--keys: relay.2\'s own key directory (it must exist)');
  fs.mkdirSync(work, { recursive: true, mode: 0o700 });
  const node = prefixOf(process.execPath), sgit = which('sgit'), sgitVenv = prefixOf(sgit), py = sgitVenv && pythonHome(sgitVenv);
  const tools = [node, sgitVenv, py].filter(Boolean);
  const read = [...new Set(['/usr', '/lib', '/lib64', '/etc/ssl', '/etc/ca-certificates', checkout, keys, real(work), ...tools, ...many('--extra-read')].filter(Boolean))];
  const exec = [...new Set(['/lib', '/lib64', '/usr/lib', ...tools, ...many('--extra-exec')].filter(Boolean))];
  const ca = ['/root/.ccr/ca-bundle.crt'].filter((p) => fs.existsSync(p));
  return {
    pbp: 1, id: `${ID}`, layer: 'invocation',
    notes: `harness.1.fringe for relay.2's worker hop: reads the system libraries, its tools (${tools.join(', ') || 'none found'}), the Git checkout and its own key directory; writes only handover/ and its tmpfs work dir; executes only its tools; the only TCP port is the sharness.net door on 127.0.0.1:${PORT}, which holds the hosts. Generated ${now()}.`,
    files: { read: [...read, ...ca], write: [path.join(checkout, 'handover'), real(work)], exec },
    network: { connect_tcp_ports: [PORT] },
    process: { no_new_privs: true, max_memory_mb: +one('--memory-mb', '2048'), max_pids: +one('--pids', '64') },
  };
}

function hashOf(file) { return execFileSync(SH, ['policy', 'hash', file], { encoding: 'utf8' }).split(/\s/)[0]; }

if (cmd === 'policy') {
  const p = makePolicy(), f = path.join(OUT, `policy-${ID}.json`);
  fs.writeFileSync(f, JSON.stringify(p, null, 1) + '\n');
  const h = hashOf(f);
  console.log(JSON.stringify({ policy: path.relative(ROOT, f), hash: h, run: `${SH} run --policy ${path.relative(ROOT, f)} --expect-hash ${h} -- <worker command>` }, null, 1));
} else if (cmd === 'probe') {
  const f = path.join(OUT, `policy-${ID}.json`); if (!fs.existsSync(f)) throw new Error(`no ${f}: run policy first`);
  const pol = JSON.parse(fs.readFileSync(f, 'utf8')), h = hashOf(f);
  const checkout = real(one('--checkout', process.cwd())), keys = real(one('--keys', '')), others = one('--others', path.dirname(keys));
  const probe = path.join(ROOT, 'harness', 'bin', 'relay-probe.mjs');
  const targets = JSON.stringify({ checkout, keys, others, work: pol.files.write[1], door: PORT, hosts: many('--host').length ? many('--host') : ['dev.send.sgraph.ai', 'openrouter.ai'] });
  const bare = spawnSync(process.execPath, [probe, targets], { encoding: 'utf8' });
  const env = { ...process.env, HTTPS_PROXY: `http://127.0.0.1:${PORT}`, https_proxy: `http://127.0.0.1:${PORT}` };
  const held = spawnSync(SH, ['run', '--quiet', '--policy', f, '--expect-hash', h, '--', process.execPath, probe, targets], { encoding: 'utf8', env });
  const parse = (r) => { try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return { error: `exit ${r.status}`, stderr_tail: (r.stderr || '').slice(-300) }; } };
  const before = parse(bare), after = parse(held);
  const rec = {
    about: `The probe for ${ID}: the same attempts by relay.2's worker identity, bare and under its policy. Never content: readable/writable yes or no, the error.`,
    by: 'harness.1.fringe@PrompTugal.dinis (tool); run by the relay in its own container', measured_at: now(), tool: 'sharness-ai 0.2.0',
    policy: { id: pol.id, hash: h, file: path.relative(ROOT, f), rows: { files: pol.files, network: pol.network, process: pol.process } },
    before: { exit: bare.status, attempts: before }, after: { exit: held.status, attempts: after },
    summary: Array.isArray(before) && Array.isArray(after) ? before.map((b, i) => ({ id: b.id, target: b.target, mandate: b.mandate, bare: b.result, harnessed: after[i]?.result, error: after[i]?.error })) : null,
  };
  const out = path.join(OUT, `probe-${ID}.json`); fs.writeFileSync(out, JSON.stringify(rec, null, 1) + '\n');
  console.log(JSON.stringify({ probe: path.relative(ROOT, out), summary: rec.summary }, null, 1));
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 17).join('\n'));
}
