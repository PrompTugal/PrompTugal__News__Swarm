#!/usr/bin/env python3
"""
licence: a licence to operate that lapses when the reach changes.

storytelling.1.fringe@PrompTugal.dinis, for Dinis Cruz (WS-215), 12 Nov 2026.
Dinis (this session, ~01:58 UTC): "if some of the assumptions change that we make our understanding of
our environment, then like the license to operate should be revoked ... if suddenly we have more assets
being connected, or an MCP or a tool be connected."

What is real and what is simulated:
  - REAL: the reach fingerprint is measured from this container: the command-line tools on PATH that can
    reach an outside system, the NAMES of credential-like environment variables (never their values),
    whether outbound HTTPS goes through a proxy, and the MCP servers in a config file.
  - SIMULATED: the change. Mid-run, a new tool ("gmail-mcp") is "connected": an MCP entry is added to a
    config file in a temporary folder, and an executable of that name is put on PATH. Nothing real is connected.

The licence is granted against the fingerprint and its stated assumptions. Before every action the
fingerprint is measured again; if it differs, the licence is suspended and the action does not run.
Writes result.json next to this file. Run: python3 -I sims/licence/run.py
"""
import hashlib, json, os, pathlib, shutil, tempfile, datetime, stat

REACH_TOOLS = ["gh", "gcloud", "bq", "gsutil", "aws", "az", "kubectl", "docker", "psql", "mysql",
               "sqlite3", "curl", "wget", "ssh", "gmail-mcp", "calendar-mcp", "slack-mcp", "zapier-mcp"]
CRED_WORDS = ("KEY", "TOKEN", "SECRET", "PASS", "CRED", "AUTH")

def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

def measure(path_env, mcp_config):
    tools = sorted(t for t in REACH_TOOLS if shutil.which(t, path=path_env))
    creds = sorted(k for k in os.environ if any(w in k.upper() for w in CRED_WORDS))
    proxy = bool(os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy"))
    try:
        mcp = sorted(json.loads(pathlib.Path(mcp_config).read_text()).get("mcpServers", {}))
    except FileNotFoundError:
        mcp = []
    reach = {"tools_on_path": tools, "credential_like_env_names": len(creds), "https_via_proxy": proxy, "mcp_servers": mcp}
    fp = "sha256:" + hashlib.sha256(json.dumps(reach, sort_keys=True).encode()).hexdigest()[:16]
    return reach, fp

def main():
    work = pathlib.Path(tempfile.mkdtemp(prefix="licence-"))
    bindir, cfg = work / "bin", work / "mcp.json"
    bindir.mkdir()
    cfg.write_text(json.dumps({"mcpServers": {}}))
    path_env = str(bindir) + os.pathsep + os.environ.get("PATH", "")

    reach0, fp0 = measure(path_env, cfg)
    licence = {
        "granted_at": now(), "to": "a storm-data agent (A3), for tonight's demo",
        "mandate": "read the storm site's public API; write its own run file",
        "assumptions": ["no mail, calendar or chat tool is connected", "the reach is exactly the fingerprint below"],
        "reach_fingerprint": fp0, "reach": reach0, "state": "valid",
    }
    timeline = [{"t": licence["granted_at"], "event": "licence granted", "fp": fp0}]

    actions = ["read warnings.json", "read forecast.json", "write the run file", "read tides.json", "read flights.json"]
    results = []
    for i, action in enumerate(actions):
        if i == 2:  # SIMULATED: a tool is connected mid-run
            cfg.write_text(json.dumps({"mcpServers": {"gmail-mcp": {"command": "gmail-mcp"}}}))
            exe = bindir / "gmail-mcp"
            exe.write_text("#!/bin/sh\necho simulated\n")
            exe.chmod(exe.stat().st_mode | stat.S_IXUSR)
            timeline.append({"t": now(), "event": "SIMULATED: a tool is connected (gmail-mcp: an MCP entry and a command on PATH)"})
        reach, fp = measure(path_env, cfg)
        if licence["state"] == "valid" and fp != fp0:
            licence["state"] = "suspended"
            changed = {k: {"was": reach0[k], "now": reach[k]} for k in reach if reach[k] != reach0[k]}
            licence["suspended"] = {"at": now(), "why": "the reach changed", "changed": changed, "fp_now": fp}
            timeline.append({"t": licence["suspended"]["at"], "event": "licence suspended: reach changed", "fp": fp, "changed": changed})
        ok = licence["state"] == "valid"
        results.append({"action": action, "fp": fp, "got": "done" if ok else "refused: licence suspended until the reach is reviewed"})
        timeline.append({"t": now(), "event": ("done: " if ok else "refused: ") + action})

    shutil.rmtree(work)
    result = {
        "v": 1, "title": "A licence to operate that lapses when the reach changes",
        "label": "real measurement, simulated change",
        "by": "storytelling.1.fringe@PrompTugal.dinis", "for": "Dinis Cruz", "issue": "WS-215",
        "where": "R1 Claude Code cloud, riskmandate-personal (storytelling.1's container)",
        "measured": "tools on PATH that reach outside systems; the count of credential-like env names (names only, values never read); whether HTTPS goes through a proxy; MCP servers in a config file",
        "licence": licence, "actions": results, "timeline": timeline,
        "tally": {"done": sum(r["got"] == "done" for r in results), "refused": sum(r["got"] != "done" for r in results)},
        "not_covered": [
            "the fingerprint sees what it measures: a connector held by the agent's host (a claude.ai connector, a hosted MCP server) is outside this container and must be fed in by the host",
            "suspension is enforced by this loop; in production the check belongs outside the agent (the harness, the runner, or the host that adds connectors)",
            "the five actions are named, not performed: the run shows when the licence would let them through",
            "re-granting needs a person or a policy to review the new reach; this run only shows the suspension",
        ],
        "real_example": "this storytelling session's own tool list changed tonight (Gmail, GitHub and Claude Docs connectors reported disconnected and reconnected, about 01:27 to 01:40 UTC), with no one asking whether the mandate still fitted",
    }
    out = pathlib.Path(__file__).with_name("result.json")
    out.write_text(json.dumps(result, indent=1) + "\n")
    print("granted", fp0, reach0)
    for e in timeline:
        print(" ", e["t"], e["event"], e.get("changed", ""))
    print("tally", result["tally"])

if __name__ == "__main__":
    main()
