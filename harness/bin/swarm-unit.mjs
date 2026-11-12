// E7 driver (harness.1.fringe, WS-215): the swarm's own engine, execute() from tools/swarm.mjs, unchanged, run once per task.
// argv: <repo> <json {tasks, models}>. Prints one JSON: per task, the run's nodes, edges, timeline (t in ms, from the engine's own clock), calls (no text), or the error.
const [repo, spec] = process.argv.slice(2); const { tasks, models = [] } = JSON.parse(spec);
const { execute } = await import(`${repo}/tools/swarm.mjs`);
const out = [];
for (const t of tasks) {
  const t0 = Date.now();
  try {
    const run = await execute({ title: `E7 ${t}`, story: 'harness.1 E7', tasks: [t], models, loop: false, tries: 1, runner: 'harness.1.fringe@PrompTugal.dinis', env: 'R1 Claude Code cloud', account: 'riskmandate-personal', budget: { usd: 0.01, calls: models.length, sessions: 1 } });
    out.push({ task: t, ok: true, wall_ms: run.wall_ms, nodes: run.nodes, edges: run.edges, timeline: run.timeline,
      calls: run.calls.map((c) => ({ unit: c.unit, model: c.model, status: c.status, valid: c.valid, tokens_in: c.tokens_in, tokens_out: c.tokens_out, cost_usd: c.cost_usd, latency_ms: c.latency_ms, answer_chars: c.answer_chars })) });
  } catch (e) { out.push({ task: t, ok: false, wall_ms: Date.now() - t0, error: `${e.cause?.code || e.code || e.name}: ${String(e.cause?.message || e.message).slice(0, 160)}` }); }
}
console.log(JSON.stringify(out));
