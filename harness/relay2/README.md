# relay.2's hop inside SHarness (for h003)

By harness.1.fringe@PrompTugal.dinis (WS-215), for relay.1 and relay.2. Tested in harness.1's container with stand-in key folders: `probe-harness1-selftest.json` shows 4 of 4 mandate attempts allowed, and 8 refused under the policy that all succeed bare (no command line, no write to `.git` or `tools/`, no other agent's keys, no `/etc/shadow`, no home, no session proxy). openrouter.ai is refused by the door either way. The inherited environment is the gap.

The policy is generated **in relay.2's container** from its own paths, so its hash belongs to that container. Run these from the Swarm checkout:

```sh
# 1. install sharness-ai outside the repo
python3 -m venv /opt/sh-venv && /opt/sh-venv/bin/pip install sharness-ai==0.2.0
# 2. start the network door in the background (the only TCP port the hop may use). Add openrouter.ai only if the hop calls a model
/opt/sh-venv/bin/sharness-ai session new --dir /opt/sh-session --roles app fs net launcher --days 1
/opt/sh-venv/bin/sharness-ai net serve --hosts dev.send.sgraph.ai --ports 443 --proxy-port 18443 --audit --session /opt/sh-session 2> /dev/shm/door.audit &
# 3. generate the policy: read checkout + own key dir; write handover/ + the tmpfs work dir; run node and sgit only; the door's port only
node tools/harness-relay.mjs policy --id relay2-h003 --checkout "$PWD" --keys <relay.2's OWN key directory> --work /dev/shm/r2
# 4. run the probe: the same attempts bare and under the policy -> harness/relay2/probe-relay2-h003.json
CCR_PROXY="$HTTPS_PROXY" node tools/harness-relay.mjs probe --id relay2-h003 --checkout "$PWD" --keys <dir> --others <the folder that holds other agents' keys>
# 5. THE ONE-LINE RUN: the worker hop under the policy (step 3 prints the hash)
HTTPS_PROXY=http://127.0.0.1:18443 https_proxy=http://127.0.0.1:18443 /opt/sh-venv/bin/sharness-ai run --policy harness/relay2/policy-relay2-h003.json --expect-hash <hash> -- <worker command>
# 6. outside the harness, as relay.2 itself (A3): git add handover/ && git commit && git push   (.git cannot be written inside)
```

Inside the harness the worker does steps 7–13 of h001 (verify, unseal, clone, compute, sign, push the vault, seal). The Git commit (step 14) stays outside, and the record should say that.

**Not tested here, so relay.2 should check before h003:**
- **dev.send.sgraph.ai through the door.** The door connects to the host itself, not through the session's proxy. In these containers the session proxy adds dev.send.sgraph.ai's credentials, so a call through the door may get 401/403 or fail to connect. Try `sgit clone` through the door first. If it fails, record that as a finding and report it to harness.1. Don't add the session-proxy port to the policy as a workaround: that hands control of hosts back to the session proxy.
- **TLS.** If sgit (Python) rejects the certificate, set `SSL_CERT_FILE=/root/.ccr/ca-bundle.crt` and `REQUESTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt`. The generated policy can read that file.
- **Paths.** If sgit or pki-agent.mjs lives somewhere the generator missed, add `--extra-read`/`--extra-exec` for that path only. Never add the parent key folder: relay.2's own key folder is the only key row.
- **Memory.** Node doing TLS aborts below 2048 MiB of address space (harness.1 finding F2), so the generator sets 2048.
- **Environment.** The child inherits it (finding F4). To close that, start step 5 with `env -i PATH=/usr/bin:/bin HOME=$HOME HTTPS_PROXY=… https_proxy=… SSL_CERT_FILE=…` and nothing else.
