// The relay probe (harness.1.fringe, WS-215): what relay.2's worker can and cannot do. argv[2] is JSON {checkout, keys, others, work, door, hosts}.
// Never prints content: only readable/writable/connected yes or no, and the error. Touches only this container, the door and the named hosts.
import fs from 'node:fs'; import net from 'node:net'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const T = JSON.parse(process.argv[2]), R = [];
const t = (id, target, mandate, fn) => { const s = Date.now(); try { const r = fn(); R.push({ id, target, mandate, result: 'succeeded', ...(r || {}), ms: Date.now() - s }); } catch (e) { R.push({ id, target, mandate, result: 'refused', error: `${e.code || e.name}: ${String(e.message).split('\n')[0].slice(0, 140)}`, ms: Date.now() - s }); } };
const firstFile = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isFile()) return p; } return null; };
const tmpName = (d) => path.join(d, `.harness-probe-${process.pid}`);
const wr = (p) => { fs.writeFileSync(p, 'x'); fs.unlinkSync(p); return { writable: true }; };
t('read-checkout', path.join(T.checkout, 'handover/keys.json'), true, () => ({ readable: fs.readFileSync(path.join(T.checkout, 'handover/keys.json')).length > 0 }));
t('read-own-keys', T.keys, true, () => { const f = firstFile(T.keys); return { readable: f ? fs.readFileSync(f).length > 0 : fs.readdirSync(T.keys).length >= 0 }; });
t('write-handover', path.join(T.checkout, 'handover'), true, () => wr(tmpName(path.join(T.checkout, 'handover'))));
t('write-work', T.work, true, () => wr(tmpName(T.work)));
t('list-other-keys', T.others, false, () => ({ readable: true, entries: fs.readdirSync(T.others).length }));
t('read-sibling-key-dir', T.others, false, () => { const sib = fs.readdirSync(T.others).map((n) => path.join(T.others, n)).find((p) => p !== T.keys && fs.statSync(p).isDirectory()); if (!sib) return { readable: null, note: 'no sibling key dir here' }; return { readable: fs.readdirSync(sib).length >= 0, sibling: path.basename(sib) }; });
t('read-shadow', '/etc/shadow', false, () => ({ readable: fs.readFileSync('/etc/shadow').length > 0 }));
t('read-home', process.env.HOME || '/root', false, () => ({ readable: fs.readdirSync(process.env.HOME || '/root').length >= 0 }));
t('write-git', path.join(T.checkout, '.git'), false, () => wr(tmpName(path.join(T.checkout, '.git'))));
t('write-tools', path.join(T.checkout, 'tools'), false, () => wr(tmpName(path.join(T.checkout, 'tools'))));
t('spawn-shell', '/bin/sh -c true', false, () => { const r = spawnSync('/bin/sh', ['-c', 'true']); if (r.error) throw r.error; return { spawned: r.status === 0 }; });
t('env-credentials', 'process.env', false, () => ({ credential_like_names: Object.keys(process.env).filter((k) => /TOKEN|SECRET|KEY|PASSWORD/i.test(k)).length }));
const connect = (id, target, mandate, port, line) => new Promise((res) => { const s = Date.now(); const so = net.connect({ host: '127.0.0.1', port, timeout: 5000 });
  const done = (r) => { so.destroy(); R.push({ id, target, mandate, ...r, ms: Date.now() - s }); res(); };
  so.on('connect', () => { if (!line) return done({ result: 'succeeded', connected: true }); so.write(line); so.once('data', (d) => { const st = d.toString('latin1').split('\r\n')[0]; done({ result: / 200 /.test(st) ? 'succeeded' : 'refused', door_status: st, error: / 200 /.test(st) ? undefined : (d.toString('latin1').split('\r\n\r\n')[1] || '').trim().slice(0, 160) }); }); });
  so.on('timeout', () => done({ result: 'refused', error: 'timeout' })); so.on('error', (e) => done({ result: 'refused', error: `${e.code}: ${e.message.slice(0, 120)}` })); });
for (const h of T.hosts) await connect(`door-${h}`, `CONNECT ${h}:443 via the door`, null, T.door, `CONNECT ${h}:443 HTTP/1.1\r\nHost: ${h}:443\r\n\r\n`);
const sp = (process.env.CCR_PROXY || '').match(/:(\d+)\/?$/);
if (sp) await connect('bypass-session-proxy', `127.0.0.1:${sp[1]} (the session proxy)`, false, +sp[1]);
console.log(JSON.stringify(R));
