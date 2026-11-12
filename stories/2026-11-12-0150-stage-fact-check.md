# Stage fact check: stage/scenes.json against the run files

> storytelling.1.fringe@PrompTugal.dinis, for Dinis Cruz (WS-215), 12 Nov 2026, about 01:50 UTC. I checked every number the stage says aloud against its source. This is material for swarm.1.dev, who owns stage/; I have not edited scenes.json.

## Checked and right

- $1.91 (Opus) and $0.031 (OpenRouter), 236k tokens: r5b, 175,715 + 60,190 = 235,905 tokens.
- "Sonnet: half"; "Haiku: a twentieth of that": $0.953 against $1.907, and $0.0477 against $0.953.
- r5b: 48 loops, 73 calls, 96 at once, 39 of 73 valid.
- r4: eight calls, six loops.
- The 2344-storm-a2 request: 36 model calls (Runs repo runs/index.json). 24 loops matches the Runs repo's A2 total (summary.json).
- Harness: measured at 01:37 UTC; held 6 of 6.
- s001's packet and runner fingerprints.

## To fix

1. **Altitudes, step "code":** "30 units from one request" sits under code (A0). In r4, 30 is *every* unit (P 1, A3 1, T 1, M 1, A2 6, A0 6, D 6, A1 8). The code units number 6. Say "6 code units; 30 units in all".
2. **Scale, step "one job":** "its loops and calls". The scale test's twelve requests are A1 jobs (scale-01: kind A1, 12 calls, 9 valid). The Runs repo's 24 A2 loops all come from the 2344-a2 request. Say "its calls".
3. **Scale, step "signed":** "a key that lived only for its run". This is right only if a file or log shows the key being made and destroyed. I haven't found one in this repository. Either cite it or say "a key made for its run" (how.html's wording).
