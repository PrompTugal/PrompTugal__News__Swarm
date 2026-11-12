#!/usr/bin/env node
// The blast radius of each run: which unit can reach which asset, and through what (Dinis 07:10: "which agent has access to
// everything? Which agent has access to the asset"). Written for views.html (swarm.1.designer) and the stage.
//
//   node tools/reach.mjs [path to PrompTugal__News__Swarm__Runs]     (default ../promptugal__news__swarm__runs)
//
// Reads runs/*.json here (runs inside a Claude Code session) and <Runs>/runs/*/result.json (runs on GitHub Actions).
// Writes data/reach/<run>.json and data/reach/index.json. Derived, not probed: the rule is where the unit ran.
//  - In a session, every unit the agent started runs as the agent's process and inherits its reach. The assets are the
//    agent's connectors, Gmail and Calendar, SIMULATED ("if connected", riskmandate.ai's published findings).
//  - On GitHub Actions, the run step holds OPEN_ROUTER_KEY and ELASTIC_CLOUD in its env (.github/workflows/run.yml); every
//    process of that step inherits them, so every A0/A2 unit can reach Elastic (REAL, a disposable account) today. Gmail and
//    Calendar are not connected there: nobody reaches them.
//  - Model calls (A1) are text in, text out at the provider: they reach nothing. The person, providers and datasets are not units.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RUNS = path.resolve(process.argv[2] || path.join(HERE, '..', 'promptugal__news__swarm__runs'));
const OUT = path.join(HERE, 'data', 'reach');
fs.mkdirSync(OUT, { recursive: true });

const SIM_ASSETS = [
  { id: 'asset:gmail', label: 'Gmail', kind: 'mailbox', real: false },
  { id: 'asset:calendar', label: 'Calendar', kind: 'calendar', real: false },
];
const ELASTIC = { id: 'asset:elastic', label: 'Elastic', kind: 'log store', real: true, note: 'the deployment superuser password, on a disposable account with no confidential data (Fringe abp/policies.json); after the demo a write-only key for swarm-*' };
const NOT_UNITS = new Set(['P', 'M', 'D', 'X']);

function reachOf(run, where) {
  const nodes = run.nodes || [], edges = run.edges || [];
  const parent = new Map(); for (const e of edges) if (!parent.has(e.to) && e.kind !== 'reach') parent.set(e.to, e.from);
  const assets = (where === 'actions' ? [ELASTIC, ...SIM_ASSETS.map((a) => ({ ...a, connected: false }))] : SIM_ASSETS.map((a) => ({ ...a, connected: 'simulated' })))
    .map((a) => ({ ...a, held_by: [] }));
  const units = nodes.filter((n) => !NOT_UNITS.has(n.altitude)).map((n) => {
    let reaches = [], via = [];
    if (n.altitude === 'A1') via = ['text in, text out at the provider'];
    else if (where === 'session' && ['A3', 'T', 'A2', 'A0', 'A4'].includes(n.altitude)) { reaches = ['asset:gmail', 'asset:calendar']; via = ["the agent's process: a child inherits its parent's whole reach (simulated connectors)"]; }
    else if (where === 'actions' && ['A0', 'A2'].includes(n.altitude)) { reaches = ['asset:elastic']; via = ['ELASTIC_CLOUD in the run step env, inherited by every process of the step']; }
    else if (where === 'actions' && n.altitude === 'E') { reaches = ['asset:elastic']; via = ['the run step holds ELASTIC_CLOUD (.github/workflows/run.yml)']; }
    else if (where === 'actions' && n.altitude === 'A3') via = ['commits a signed request; holds no key of the Action'];
    return { id: n.id, label: n.label, altitude: n.altitude, parent: parent.get(n.id) || null, reaches, via };
  });
  for (const u of units) for (const a of u.reaches) assets.find((x) => x.id === a).held_by.push(u.id);
  const connected = assets.filter((a) => a.held_by.length).map((a) => a.id);
  const everything = units.filter((u) => connected.length && connected.every((a) => u.reaches.includes(a))).map((u) => u.id);
  // swarm.1.designer's rows for views: one per (unit, asset, policy), so "everybody" can be toggled against "with a policy".
  //  all: every unit that inherits the reach (the table above); policy: only the unit that needs it (the agent for its
  //  connectors; the step's root process, 'runner', for the log store); isolated: the work moved to where the asset is not
  //  connected (on Actions nobody reaches Gmail or Calendar; in a session the agent keeps its own connectors).
  const reach = [];
  const root = units.find((u) => u.id === 'runner') || units.find((u) => u.altitude === 'E');
  const agent = units.find((u) => u.altitude === 'A3');
  for (const u of units) for (const a of u.reaches) reach.push({ unit: u.id, asset: a, via: 'inherited', policy: 'all' });
  for (const a of assets.filter((x) => x.held_by.length)) {
    const owner = a.id === 'asset:elastic' ? root : agent;
    if (owner) { reach.push({ unit: owner.id, asset: a.id, via: 'owner', policy: 'policy' }); reach.push({ unit: owner.id, asset: a.id, via: 'owner', policy: 'isolated' }); }
  }
  return { assets: assets.map((a) => ({ ...a, sim: !a.real })), units, reach, reaches_everything: everything };
}

const index = [];
function write(id, run, where, src) {
  const r = reachOf(run, where);
  const out = { run: id, title: run.title || id, where, environment: (run.environment && (run.environment.label || run.environment.id)) || null, source: src,
    rule: 'derived from where each unit ran (see tools/reach.mjs), not probed', ...r };
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(out, null, 1) + '\n');
  index.push({ run: id, title: out.title, where, units: r.units.length, reaching: r.units.filter((u) => u.reaches.length).length, reaches_everything: r.reaches_everything.length, assets: r.assets.filter((a) => a.held_by.length).map((a) => a.label) });
}
for (const f of fs.readdirSync(path.join(HERE, 'runs')).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()) {
  const run = JSON.parse(fs.readFileSync(path.join(HERE, 'runs', f), 'utf8'));
  if (!run.nodes) continue;
  write(f.replace(/\.json$/, ''), run, 'session', 'runs/' + f);
}
if (fs.existsSync(path.join(RUNS, 'runs'))) for (const d of fs.readdirSync(path.join(RUNS, 'runs')).sort()) {
  const p = path.join(RUNS, 'runs', d, 'result.json'); if (!fs.existsSync(p)) continue;
  const body = JSON.parse(fs.readFileSync(p, 'utf8')).body; if (!body || !body.nodes) continue;
  write(d, body, 'actions', 'PrompTugal__News__Swarm__Runs runs/' + d + '/result.json');
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ about: 'which unit can reach which asset, per run (tools/reach.mjs)', generated_at: new Date().toISOString(), runs: index }, null, 1) + '\n');
console.log('reach:', index.length, 'runs →', path.relative(HERE, OUT));
