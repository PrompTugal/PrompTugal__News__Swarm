// A0 read through the door: fetch storm datasets via HTTPS_PROXY (the door), then attempts the door or the kernel must refuse.
// Hosts touched: storm-charles.promptugal.news (allowed) and openrouter.ai (the allowlist test). Nothing else.
import fs from 'node:fs'; import net from 'node:net'; import tls from 'node:tls'; import crypto from 'node:crypto';
const ws = process.argv[2], DOOR = { host: '127.0.0.1', port: 18443 }, R = [];
const STORM = 'storm-charles.promptugal.news', BASE = `https://${STORM}/api/v1/2026-11-10-storm-charles/`;
const ca = fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS || '/etc/ssl/certs/ca-certificates.crt');
// CONNECT host:port through the door, then TLS with a chosen SNI; returns {status, ...}
function viaDoor(host, port, sni, path) { return new Promise((res) => { const s0 = Date.now();
  const so = net.connect(DOOR, () => so.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`));
  so.on('error', (e) => res({ result: 'refused', error: `${e.code}: ${e.message.slice(0, 120)}`, ms: Date.now() - s0 }));
  let head = ''; so.once('data', (d) => { head = d.toString('latin1'); const line = head.split('\r\n')[0];
    if (!/ 200 /.test(line)) { const why = (head.split('\r\n\r\n')[1] || '').trim().slice(0, 160); so.destroy(); return res({ result: 'refused', door_status: line, error: why, ms: Date.now() - s0 }); }
    const t = tls.connect({ socket: so, servername: sni, ca, rejectUnauthorized: true }, () => t.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`));
    const chunks = []; t.on('data', (c) => chunks.push(c));
    t.on('error', (e) => res({ result: 'refused', door_status: line, error: `${e.code || e.name}: ${e.message.slice(0, 120)}`, ms: Date.now() - s0 }));
    t.on('end', () => { const b = Buffer.concat(chunks), i = b.indexOf('\r\n\r\n'), st = b.slice(0, i).toString().split('\r\n')[0], body = b.slice(i + 4);
      res({ result: st.startsWith('HTTP/') ? 'succeeded' : 'refused', ...(st.startsWith('HTTP/') ? {} : { error: 'the door cut the tunnel after the TLS hello (no bytes back)' }), door_status: line, http: st || null, bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex'), ms: Date.now() - s0 }); }); }); }); }
const add = async (id, target, p) => R.push({ id, target, ...(await p) });
await add('a0-read-warnings', `${STORM}:443 /weather/warnings.json`, viaDoor(STORM, 443, STORM, '/api/v1/2026-11-10-storm-charles/weather/warnings.json'));
await add('a0-read-services', `${STORM}:443 /transport/services.json`, viaDoor(STORM, 443, STORM, '/api/v1/2026-11-10-storm-charles/transport/services.json'));
await add('off-allowlist-host', 'openrouter.ai:443', viaDoor('openrouter.ai', 443, 'openrouter.ai', '/api/v1/models'));
await add('ip-literal', '127.0.0.1:443', viaDoor('127.0.0.1', 443, '', '/'));
await add('off-list-port', `${STORM}:8443`, viaDoor(STORM, 8443, STORM, '/'));
await add('domain-fronting', `CONNECT ${STORM}:443, SNI openrouter.ai`, viaDoor(STORM, 443, 'openrouter.ai', '/'));
const proxy = (process.env.CCR_PROXY || '').match(/\/\/([^:/]+):(\d+)/);
const direct = (id, host, port) => new Promise((res) => { const s = Date.now(), so = net.connect({ host, port, timeout: 4000 });
  so.on('connect', () => { so.destroy(); res(R.push({ id, target: `${host}:${port}`, result: 'succeeded', ms: Date.now() - s })); });
  so.on('timeout', () => { so.destroy(); res(R.push({ id, target: `${host}:${port}`, result: 'refused', error: 'timeout', ms: Date.now() - s })); });
  so.on('error', (e) => res(R.push({ id, target: `${host}:${port}`, result: 'refused', error: `${e.code}: ${e.message.slice(0, 120)}`, ms: Date.now() - s }))); });
if (proxy) await direct('bypass-session-proxy', proxy[1], +proxy[2]);
await new Promise((res) => { const s = Date.now(); const t = tls.connect({ host: STORM, port: 443, servername: STORM, ca, timeout: 5000 }, () => { t.destroy(); res(R.push({ id: 'bypass-door-direct-tls', target: `${STORM}:443 direct`, result: 'succeeded', ms: Date.now() - s })); });
  t.on('error', (e) => res(R.push({ id: 'bypass-door-direct-tls', target: `${STORM}:443 direct`, result: 'refused', error: `${e.code}: ${e.message.slice(0, 120)}`, ms: Date.now() - s })));
  t.on('timeout', () => { t.destroy(); res(R.push({ id: 'bypass-door-direct-tls', target: `${STORM}:443 direct`, result: 'refused', error: 'timeout', ms: Date.now() - s })); }); });
console.log(JSON.stringify(R));
