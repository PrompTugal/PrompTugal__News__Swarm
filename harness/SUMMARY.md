# SHarness in the swarm: the night of 12 November (one page)

By harness.1.fringe@PrompTugal.dinis (WS-215), for Dinis's breakfast review. Everything here was measured in harness.1's container (uid 0, all capabilities, no seccomp before any policy) with sharness-ai 0.2.0 (Landlock ABI 7). No model text, no secrets, and public key fingerprints only. Each record is listed in `harness/index.json`.

## What held

| | Unharnessed | Harnessed | Record |
|---|---|---|---|
| The same A0 compute (3 storm datasets) | sha256 `63544c8a…` | the same `63544c8a…` | E1 |
| 12 attempts (shadow, keys, /root, write outside, /tmp, shell, 1.5 GiB, network…) | 11 of 12 succeed | 3 succeed: 2 workspace + the inherited env (gap) | E2 |
| The swarm's own engine (`tools/swarm.mjs`), A0 reads | 3 of 3 | none: 0 of 3 · door: 3 of 3 | E7 |
| Its A1 model call through a door that allows only the storm site | — | refused by the door, $0 | E7 |
| A2 loops, 4 loops × 3 tries | — | 12 of 12 calls refused by the door, 0 tokens, $0 | E8 |
| Ways around the door (session proxy, direct TLS, direct IP) | all succeed | all refused by the kernel (EACCES) | E4 |
| A key on code, policy, execution and output | — | 6 of 6 checks, tamper caught | E5 |
| The execution key | a file for 213 ms | born inside, never on disk, env 17 → 0 names, 9 of 9 checks | E9 |
| Who can open the unit's memory (as uid 65534) | — | other uid: no · root: yes · same uid: yes · root under its own policy: no | E10 |

## What did not hold, or was not covered

- **The environment is inherited** (F4). 17 credential-like names reach the child unless the run starts with `env -i`.
- **A profile is wider than the unit** (F1). `contain --profile newsroom-agent` lets a contained root shell read `/etc/shadow` (readable: yes, the content was never read).
- **The door cannot carry a credential** (F6). Reads through it work. The vault push in h003 (relay.2) and the OpenRouter call in E11 both got 401, because the credential is added by the session proxy, which the door does not use. Reach was right; the job did not finish.
- **A root neighbour can still open a harnessed process's memory** (E10). A separate uid stops other users, not root. Yama is not in this kernel.
- **The memory row is an address-space limit** (F2). V8 needs 1024 MiB, TLS 2048, undici's Wasm 16384.
- **Small things.** `/dev/null` and `/etc/mime.types` (F7); the audit logs a cut tunnel as allowed (F3); interleaved audit lines (F8); a lowercase `https_proxy` routes around the door unless the kernel row holds it (F5, relay.2).
- **Only Landlock ran** (E12). Translated to bwrap, Docker, Kubernetes and the Claude Code sandbox, the execute allowlist and the policy hash have no equivalent there.

## Your decisions

1. **File the findings?** F1–F8 are drafted as SHarness issues in `harness/2026-11-12-harness1-findings.json`. None are filed.
2. **The credential row (F6):** a credential row on sharness.net (the door holds the secret), or chain the door to the session proxy for named hosts. Either one unblocks a fully positive E11 and h003.
3. **h003:** finish it with the vault push as a step outside the harness, recorded as outside, or leave it blocked as the finding.
4. **The operator key:** anchor it in `data/keys.json`, so the E5/E9 chain points to a key the swarm already knows.

## Where things are

Records: `harness/2026-11-12-harness1-e*.json`. Units: `harness/bin/`. Policies: `harness/policies/`. Raw outputs: `harness/raw/`. Assembler: `tools/harness1-assemble.py`. relay.2's kit: `harness/relay2/` and `tools/harness-relay.mjs`. On the stage: `stage.html#pack=harness` and `#pack=pki` (swarm.1.dev).
