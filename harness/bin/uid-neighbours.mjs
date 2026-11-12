// E10 (harness.1.fringe, WS-215): the unit runs as uid 65534 under the policy, key born inside; while it lives, three neighbours try to open
// its /proc/<pid>/mem (0 bytes read) and its output dir: root, another uid (65533), and the same uid outside the sandbox. Never reads memory.
import fs from 'node:fs'; import { spawn, spawnSync } from 'node:child_process';
const [policy, ws] = process.argv.slice(2), OUTF = `${ws}/out/summary.born.json`, T0 = Date.now(), tl = [], ev = (u, p, m = {}) => tl.push({ t_ms: Date.now() - T0, unit: u, phase: p, ...m });
try { fs.unlinkSync(OUTF); } catch {}
const S = '/opt/sh-venv/bin/sharness-ai', h = spawnSync(S, ['policy', 'hash', policy], { encoding: 'utf8' }).stdout.trim().split(/\s/)[0];
ev('a0-consensus', 'start', { uid: 65534, policy_hash: h });
const child = spawn('setpriv', ['--reuid', '65534', '--regid', '65534', '--clear-groups', 'env', '-i', 'PATH=/usr/bin:/bin', S, 'run', '--quiet', '--policy', policy, '--expect-hash', h, '--', '/opt/node22/bin/node', '/opt/hx/bin/a0-consensus-born.mjs', ws], { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '', exited = null; child.stdout.on('data', (d) => (out += d)); child.on('exit', (c) => (exited = c));
while (!fs.existsSync(OUTF)) { if (exited !== null) { console.error('child exited early'); process.exit(1); } await new Promise((r) => setTimeout(r, 20)); }
await new Promise((r) => setTimeout(r, 50));
const born = JSON.parse(fs.readFileSync(OUTF, 'utf8')), pid = born.stmt.pid;
const st = fs.readFileSync(`/proc/${pid}/status`, 'utf8'), uid = st.match(/^Uid:\s+(\d+)/m)[1]; ev('exec-key', 'born-inside', { fp: born.exec_fp, pid, uid: +uid });
const probe = `const fs=require('fs');const r={};for(const [k,p,f] of [['mem','/proc/${pid}/mem','r'],['environ','/proc/${pid}/environ','r']]){try{fs.closeSync(fs.openSync(p,f));r[k]='opened (0 bytes read)'}catch(e){r[k]='refused ('+e.code+')'}}console.log(JSON.stringify(r))`;
const as = (who, pre) => { const r = spawnSync(pre[0], [...pre.slice(1), '/opt/node22/bin/node', '-e', probe], { encoding: 'utf8' }); const res = r.status === 0 ? JSON.parse(r.stdout.trim()) : { error: (r.stderr || '').slice(-200) }; ev('neighbour:' + who, 'looked', res); return { who, ...res }; };
const neighbours = [as('root (uid 0, all capabilities)', ['env']), as('another uid (65533)', ['setpriv', '--reuid', '65533', '--regid', '65533', '--clear-groups']), as('the same uid (65534), outside the sandbox', ['setpriv', '--reuid', '65534', '--regid', '65534', '--clear-groups']), as('root, itself under a policy (neighbour-root-harnessed)', [S, 'run', '--quiet', '--policy', process.argv[4], '--'])];
const exit = exited !== null ? exited : await new Promise((r) => child.on('close', r)); ev('a0-consensus', 'end', { exit });
console.log(JSON.stringify({ policy_hash: h, pid, uid: +uid, exec_fp: born.exec_fp, output_sha256: born.stmt.output_sha256, child_env: { names: born.stmt.env_names, credential_like: born.stmt.credential_like_env_names }, unit: JSON.parse(out.trim() || '{}'), neighbours, timeline: tl }, null, 1));
