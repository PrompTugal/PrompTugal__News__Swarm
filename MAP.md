# The swarm demo: the map

> swarm.1.fringe@PrompTugal.dinis, 11 November 2026, 21:37 UTC, for Dinis Cruz (WS-215; the Fringe board's work/52). From Dinis's brief, 11 Nov about 21:3x UTC: "start small and then go one by one ... every one of them should be a real run ... you do the runs, and then we visualize them, and then we're going to run them live."

## The idea

One ladder, rung by rung. Each rung adds one thing (compute, one model call, many models, loops, sessions, accounts, clouds, people), and each rung is a **real run**, saved as one JSON file (`runs/`), published here and on GitHub (and next in a vault), then replayed in the flat view at https://swarm.promptugal.news. The 3D view (Silvio's Gravity universe) and Elastic, Kibana, Grafana and Neo4j read the same files: we go where the enterprise already looks.

## The workload: the storm site's scheduled work

The storm site (https://storm-charles.promptugal.news) refreshes 51 datasets from public sources on schedules. Each is a unit any runner can do: A0 read the data, A1 ask a model for a checked answer, A2 loop until it is valid. We read the storm site's public `/api/v1/` (never copying by hand) and, for fresher reads, IPMA's open data. Not used: `watch/websummit.json` (no automated reading of websummit.com).

| Task | Dataset |
|---|---|
| warnings | weather/warnings.json |
| forecast | weather/forecast.json |
| stations | weather/stations.json |
| tides | exposure/tides.json |
| transport | transport/services.json |
| flights | transport/flights.json |

## The ladder

| Rung | What it adds | Status |
|---|---|---|
| r0 | Me → Claude → a task | **ran** (21:34 UTC) |
| r1 | → compute (A0): read one storm dataset | **ran** |
| r2 | → one OpenRouter call (A1) | **ran**: 1 call, $0.0002 |
| r3 | → many models: one question, 4 open-weight models at once | **ran**: 4 calls, $0.0011 |
| r4 | → loops (A2): 6 storm tasks, read, ask, check, retry | **ran**: 8 calls, $0.0026, 12 units at once |
| r5 | → a swarm of loops: 6 tasks × 4 models = 24 loops, consensus in code | **ran**: 40 calls, $0.011, 48 units at once; same tokens on Sonnet: $0.33 |
| r6 | Me + Angelo → sessions → packets: Dinis's 3 sessions and Angelo's 2 run the same signed packets | next: needs the sessions (Dinis's word, with a number) |
| r7 | → clouds: swarm.cloudflare, swarm.aws, swarm.gcp, swarm.netlify | next: needs each cloud's credential |
| r8 | → everybody: every person's conductor; hundreds of loops, thousands of calls | after r7 |

Variations Dinis can call for, each a flag on the runner: more tasks, more models, more retries, Claude models instead of open-weight, several runners at once.

## What every run records

Units by altitude (person, A4 swarm, A3 agent, A2 loop, A1 LLM call, A0 compute) and their edges; a timeline of starts and ends (the replay); the budget written before it started; calls, valid answers, tokens in and out, the OpenRouter cost, the **potential Claude cost** of the same tokens (Haiku, Sonnet, Opus at list price), the models served, wall time, peak units at once; per task, the models' consensus. Model text is never stored: only its length, sha256 and whether it was valid. Not yet measured: the Claude Code agent's own tokens.

## The cloud agents (proposed, not started)

| Agent | Runs | It holds | Needs from Dinis |
|---|---|---|---|
| swarm.cloudflare | a Worker on a cron: A0 reads and A1 calls; an A2 loop in a Worker | a Worker, a KV or R2 bucket, the OpenRouter key as a Worker secret | an API token scoped to Workers on one account |
| swarm.aws | Lambda on a schedule (EventBridge): A0, A1, A2; results to S3 | one S3 bucket, one Lambda role | an IAM user or role limited to that bucket and function |
| swarm.gcp | Cloud Run job or Cloud Function on Cloud Scheduler | one bucket, one service account | a project and a service account key or workload identity |
| swarm.netlify | a scheduled function: the cheapest to start | its site and env | a personal access token for one site |

Each one gets its own key (`<cloud>.swarm` identity), signs its results, and is drawn with what it holds (GitHub, a vault, secrets) so the picture shows who has access to what. A Claude Code session for each only at Dinis's word, with a number; most of the scale comes from A1 and A2 units, not sessions.

## Where results go

1. **GitHub**: `runs/*.json` in this repository (dev), served at https://swarm.promptugal.news.
2. **A vault** (sgit): the same files, so the demo does not depend on GitHub.
3. **Elastic**: each timeline event to swarm-flows (the Fringe's flow.mjs), for Kibana and Grafana.

## Budget

Written before each run, checked against the router's credit. Tonight's ladder: at most $1 and 120 calls, 0 new sessions; spent $0.0148 on 53 calls (credit before: $72.42). The daily cap is raised per run (Dinis: "yes, you can raise the 5-daily cap absolutely").
