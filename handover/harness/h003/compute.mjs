// A0 compute for h003 inside SHarness: notices by status per operator, and operators affected by the storm. Reads $W/in/trains.json, writes $W/out/result.json.
import fs from 'node:fs'; import crypto from 'node:crypto';
const W = '/dev/shm/r2', t = JSON.parse(fs.readFileSync(`${W}/in/trains.json`)), FROM = '2026-11-10T00:00:00Z';
const WX = /meteorol|mau tempo|tempestade|vento|storm|weather|wind/i;
const ops = {}, affected = [];
for (const o of t.operators) {
  const by = {}; let inStorm = 0, wx = 0;
  for (const n of o.notices) {
    const s = n.en?.text ? (n.en.text.length <= 60 ? n.en.text : n.en.text.slice(0, 57) + '...') : 'no status line (title only)';
    by[s] = (by[s] || 0) + 1;
    const when = n.updated || n.published; if (when >= FROM) inStorm++;
    if ((n.published >= FROM || (n.updated || '') >= FROM) && WX.test(`${n.title} ${n.excerpt || ''} ${n.en?.text || ''}`)) wx++;
  }
  ops[o.id] = { operator: o.operator.split(' (')[0], mode: o.mode, notices: o.notices.length, notices_by_status: by, notices_since_10_nov: inStorm, weather_notices_since_10_nov: wx };
  if (wx) affected.push(o.id);
}
const r = { task: 'h003', by: 'relay.2.fringe@PrompTugal.dinis', computed_utc: new Date().toISOString(), altitude: 'A0', inside_harness: 'SHarness policy relay2-h003',
  method: 'trains.json has operator notices, not per-train records: "services by status" is counted as notices by status line, per operator. An operator is affected if it has a notice since 10 Nov whose text mentions the weather.',
  operators: ops, operators_affected: affected, operators_total: t.operators.length,
  input_sha256: { 'trains.json': crypto.createHash('sha256').update(fs.readFileSync(`${W}/in/trains.json`)).digest('hex') } };
fs.mkdirSync(`${W}/out`, { recursive: true }); fs.writeFileSync(`${W}/out/result.json`, JSON.stringify(r, null, 2) + '\n');
const steps = JSON.parse(fs.readFileSync(`${W}/steps.json`)); steps.push({ when: new Date().toISOString().replace(/\.\d+Z/, 'Z'), inside_harness: true, altitude: 'A0', what: 'compute notices by status per operator and operators affected (no model call)', where: 'memory-decrypted', result_sha256: crypto.createHash('sha256').update(fs.readFileSync(`${W}/out/result.json`)).digest('hex') });
fs.writeFileSync(`${W}/steps.json`, JSON.stringify(steps, null, 1));
console.log(JSON.stringify({ affected, per: Object.fromEntries(Object.entries(ops).map(([k, v]) => [k, [v.notices, v.notices_since_10_nov, v.weather_notices_since_10_nov, Object.keys(v.notices_by_status).length]])) }));
