#!/usr/bin/env node
// Who has been working, from the git logs: commits per agent per hour, for the stage's "who built this" scene.
//   node tools/agent-activity.mjs [--hours 24] [--out data/agent-activity.json] <repo path> [<repo path> ...]
// An agent is read from the commit subject ("<agent>@PrompTugal.<id>: ..."), not from trailers (storytelling.1 counted the Fringe
// at 02:00 UTC: 794 of 806 commits name their agent in the subject; only 95 carry an Agent: trailer). Commits whose subject names no
// agent are counted as "unnamed". Reads only the logs (subjects and times); writes one small JSON file. No network.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const hours = +opt('--hours', '24'), out = opt('--out', 'data/agent-activity.json');
const repos = argv.length ? argv : ['.'];
const since = new Date(Date.now() - hours * 3600e3);
const AGENT = /^([a-z0-9][\w.-]*@PrompTugal\.[\w-]+)\s*:/i;   // the subject's "<agent>@PrompTugal.<id>:"

const agents = {}, byRepo = {};
for (const r of repos) {
  const name = path.basename(path.resolve(r));
  let log = '';
  try { log = execFileSync('git', ['-C', r, 'log', '--all', `--since=${since.toISOString()}`, '--format=%cI%x09%s'], { encoding: 'utf8', maxBuffer: 64 << 20 }); }
  catch (e) { console.error(`agent-activity: ${r}: ${String(e.message).split('\n')[0]}`); continue; }
  const seen = new Set();
  for (const line of log.split('\n')) {
    if (!line || seen.has(line)) continue; seen.add(line);
    const [when, subject = ''] = line.split('\t'), m = AGENT.exec(subject), who = m ? m[1] : 'unnamed', hour = when.slice(0, 13) + ':00Z';
    const a = (agents[who] ||= { commits: 0, repos: {}, hours: {}, first: when, last: when });
    a.commits++; a.repos[name] = (a.repos[name] || 0) + 1; a.hours[hour] = (a.hours[hour] || 0) + 1;
    if (when < a.first) a.first = when; if (when > a.last) a.last = when;
    byRepo[name] = (byRepo[name] || 0) + 1;
  }
}
const list = Object.entries(agents).map(([agent, a]) => ({ agent, ...a })).sort((x, y) => y.commits - x.commits);
const doc = {
  about: `Commits per agent per hour over the last ${hours} hours, read from the git logs (subjects and times only). An agent is named by its commit subject. Written by tools/agent-activity.mjs.`,
  updated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), since: since.toISOString().replace(/\.\d+Z$/, 'Z'), hours,
  repos: byRepo, commits: list.reduce((s, a) => s + a.commits, 0), named: list.filter((a) => a.agent !== 'unnamed').reduce((s, a) => s + a.commits, 0),
  agents_named: list.filter((a) => a.agent !== 'unnamed').length, agents: list,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
console.log(`agent-activity: ${doc.commits} commits (${doc.named} named) by ${doc.agents_named} agents in ${hours} h across ${Object.keys(byRepo).length} repos -> ${out} (${fs.statSync(out).size} bytes)`);
