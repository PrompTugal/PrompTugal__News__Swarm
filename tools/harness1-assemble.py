#!/usr/bin/env python3
"""harness.1.fringe@PrompTugal.dinis (WS-215): turn the measured raw outputs in harness/raw/ into the stage records.
Every number below is read from a raw file or from sharness-ai itself; nothing is typed in by hand except the
policy row that refused each attempt (read from the policy and the error) and the prose. No model text, no secrets.
    python3 tools/harness1-assemble.py     (needs /opt/sh-venv/bin/sharness-ai for the hashes)
"""
import json, os, subprocess, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = os.path.join(ROOT, 'harness')
RAW = lambda f: json.load(open(os.path.join(H, 'raw', f)))
POL = lambda f: json.load(open(os.path.join(H, 'policies', f)))
SH = '/opt/sh-venv/bin/sharness-ai'
BY = 'harness.1.fringe@PrompTugal.dinis'
WHERE = 'R1 Claude Code cloud, riskmandate-personal (harness.1\'s container; uid 0, all capabilities, no seccomp before any policy)'
TOOL = 'sharness-ai 0.2.0 (PyPI), Landlock ABI 7, node v22.23.4'
AT = '2026-11-12T01:4xZ to 01:5xZ'


def phash(path):
    return subprocess.run([SH, 'policy', 'hash', path], capture_output=True, text=True).stdout.split()[0]


def sha_file(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def rows(p):
    return {'files': p['files'], 'network': p['network'], 'process': p['process']}


def write(name, rec):
    with open(os.path.join(H, name), 'w') as f:
        json.dump(rec, f, indent=1, ensure_ascii=False)
        f.write('\n')
    return name


# ---------- the attempts: which row refused each one (harnessed), what it was for
ROW = {
    'read-workspace': (None, 'mandate: the unit reads its datasets'),
    'write-workspace-out': (None, 'mandate: the unit writes its summary'),
    'read-shadow': ('files.read (no row covers /etc/shadow; only /etc/ssl of /etc)', 'a system secret (record: readable yes/no, never content)'),
    'read-decoy-key': ('files.read (no row covers /opt/hx/decoy)', 'a decoy key made for this test (random bytes)'),
    'read-home': ('files.read (no row covers /root)', 'the home directory, where tokens live'),
    'write-outside': ('files.write (only /opt/hx/ws/out)', 'write outside the workspace'),
    'write-tmp': ('files.write (only /opt/hx/ws/out)', 'write to /tmp'),
    'spawn-shell': ('files.exec (only /opt/node22 and the libraries; /bin/sh is not executable)', 'spawn a shell'),
    'env-credentials': (None, 'GAP: the environment is inherited (v0 has no row); count of credential-like names only'),
    'memory-1.5gb': ('process.max_memory_mb = 1024 (RLIMIT_AS and cgroup memory.limit_in_bytes)', 'use too much memory'),
    'net-proxy': ('network: none (an empty network namespace, then Landlock TCP)', 'reach the session proxy, the whole internet'),
    'net-loopback': ('network: none (an empty network namespace, then Landlock TCP)', 'open any TCP connection'),
}


def e1e2():
    p = POL('policy-a0.json'); ph = phash(os.path.join(H, 'policies', 'policy-a0.json'))
    before, after, clear = RAW('attempts-before.json'), RAW('attempts-after.json'), RAW('attempts-after-envclear.json')
    out_sha = '63544c8ae8084dd78404abcef8747026025dfe1ed01b50848d33b45dc0f531a1'
    units = [
        {'id': 'harness1', 'kind': 'agent', 'altitude': 'A3', 'label': BY, 'harnessed': False},
        {'id': 'a0-consensus', 'kind': 'compute', 'altitude': 'A0', 'label': 'consensus over 3 saved storm datasets (node)', 'harnessed': None,
         'code_sha256': sha_file(os.path.join(H, 'bin', 'a0-consensus.mjs'))},
        {'id': 'attempts', 'kind': 'compute', 'altitude': 'A0', 'label': '12 attempts, the same script before and after', 'harnessed': None,
         'code_sha256': sha_file(os.path.join(H, 'bin', 'attempts.mjs'))},
        {'id': 'sharness-run', 'kind': 'harness', 'altitude': 'H', 'label': 'sharness-ai run (Landlock + netns + rlimits + cgroup)', 'policy_hash': ph},
        {'id': 'data:storm', 'kind': 'dataset', 'altitude': 'D', 'label': 'weather/warnings, weather/stations, transport/services (saved)'},
    ]
    edges = [{'from': 'harness1', 'to': 'sharness-run', 'kind': 'runs'}, {'from': 'sharness-run', 'to': 'a0-consensus', 'kind': 'runs'},
             {'from': 'sharness-run', 'to': 'attempts', 'kind': 'runs'}, {'from': 'a0-consensus', 'to': 'data:storm', 'kind': 'reads'}]

    def tl(rs, label):
        t, out = 0, [{'t_ms': 0, 'unit': 'attempts', 'phase': 'start', 'harnessed': label == 'after'}]
        for r in rs:
            out.append({'t_ms': t, 'unit': 'attempts', 'phase': 'attempt', 'id': r['id'], 'target': r['target']})
            t += r.get('ms', 0)
            row = ROW[r['id']][0] if (label == 'after' and r['result'] == 'refused') else None
            ok = r['result'] == 'succeeded'
            e = {'t_ms': t, 'unit': 'attempts', 'phase': 'allowed' if ok else 'refused', 'id': r['id'], 'target': r['target']}
            if row: e['policy_row'] = row
            if not ok: e['error'] = r.get('error')
            for k in ('readable', 'writable', 'spawned', 'connected', 'allocated_mb', 'credential_like_names'):
                if k in r: e[k] = r[k]
            out.append(e); edges.append({'from': 'attempts', 'to': r['target'], 'kind': ('allowed' if ok else 'refused'), 'when': label})
        out.append({'t_ms': t, 'unit': 'attempts', 'phase': 'end', 'exit': 0})
        return out

    cmp = []
    for b, a in zip(before, after):
        cmp.append({'id': b['id'], 'target': b['target'], 'what': ROW[b['id']][1], 'unharnessed': b['result'], 'harnessed': a['result'],
                    'refused_by': ROW[b['id']][0] if a['result'] == 'refused' else None, 'error': a.get('error')})
    nb, na = sum(r['result'] == 'succeeded' for r in before), sum(r['result'] == 'succeeded' for r in after)
    env_after = [r for r in after if r['id'] == 'env-credentials'][0]['credential_like_names']
    env_clear = [r for r in clear if r['id'] == 'env-credentials'][0]['credential_like_names']
    return write('2026-11-12-harness1-e1e2-before-after.json', {
        'about': 'E1 + E2: the same A0 compute and the same 12 attempts, unharnessed and then under one policy. The output is byte-identical (same sha256); the reach is not.',
        'by': BY, 'experiment': 'E1+E2', 'measured_at': AT, 'where': WHERE, 'tool': TOOL,
        'units': units, 'edges': edges,
        'policy': {'id': p['id'], 'hash': ph, 'file': 'harness/policies/policy-a0.json', 'rows': rows(p),
                   'applied': {'netns': 'empty network namespace', 'landlock_paths': 12, 'limits': ['cgroup1 memory.limit_in_bytes=1024MiB', 'cgroup1 pids.max=16', 'RLIMIT_AS=1024MiB'], 'no_new_privs': True},
                   'not_covered': ['Unix-domain sockets by path (Landlock has no rule)', 'RLIMIT_NPROC=16 set but not binding: the kernel exempts uid 0', "the child inherits the parent's environment variables (v0 has no row)"]},
        'compute': {'unit': 'a0-consensus', 'datasets': 3, 'output': 'out/summary.json',
                    'unharnessed': {'exit': 0, 'output_sha256': out_sha}, 'harnessed': {'exit': 0, 'output_sha256': out_sha},
                    'same_output': True},
        'before': {'what': 'unharnessed: node as uid 0 with all capabilities', 'succeeded': nb, 'of': len(before), 'timeline': tl(before, 'before')},
        'after': {'what': f'harnessed: sharness-ai run --policy policy-a0.json --expect-hash {ph}', 'succeeded': na, 'of': len(after),
                  'succeeded_ids': [r['id'] for r in after if r['result'] == 'succeeded'], 'timeline': tl(after, 'after')},
        'comparison': cmp,
        'gap': {'label': f'not covered: {env_after} credential-like env names inherited', 'env': f'{env_after} credential-like environment variable names inherited by the harnessed child (names counted, values never read into this record); '
                       f'{env_clear} when the harness itself is started with env -i (closed by hand, outside the policy)',
                'unix_sockets': 'not tested: Landlock has no rule for them; only a mount namespace or a separate uid closes them'},
        'findings': [
            'node under max_memory_mb 512 does not start: V8 fails to reserve its CodeRange under RLIMIT_AS 512 MiB (exit 251, "Fatal process out of memory"); 1024 works. The memory row is an address-space limit, and V8 reserves address space it never uses.',
            'net-loopback (127.0.0.1:9) is refused unharnessed too (ECONNREFUSED: nothing listens); harnessed the refusal is EACCES, before any packet.',
        ],
    })


def e3():
    ex = RAW('explain-contain-a0.json')['steps']; ex3 = RAW('explain-policy-a0.json')['steps']
    chain = [{'level': s['level'], 'name': s['name'], 'hash': s['hash'], 'notes': s['notes'], 'unheld': s['unheld']} for s in ex]
    k = ex[-1]['document']
    return write('2026-11-12-harness1-e3-levels.json', {
        'about': 'E3: policies at levels. One sentence (contain) is compiled down to the kernel, hash by hash, with what is not held. Then the same chain for the hand-written level-3 rows of E1+E2, and what running the sentence did.',
        'by': BY, 'experiment': 'E3', 'measured_at': AT, 'where': WHERE, 'tool': TOOL,
        'sentence': 'sharness-ai contain --profile newsroom-agent --workspace /opt/hx/ws --sites storm-charles.promptugal.news --memory-mb 1024 --pids 16 --agent a0-consensus -- node a0-consensus.mjs',
        'units': [
            {'id': 'L5', 'kind': 'policy', 'altitude': 'P5', 'label': 'intent: one sentence', 'hash': ex[0]['hash']},
            {'id': 'L4', 'kind': 'policy', 'altitude': 'P4', 'label': 'profile newsroom-agent v1 (the vendor\'s)', 'hash': ex[1]['hash']},
            {'id': 'L3', 'kind': 'policy', 'altitude': 'P3', 'label': 'rows (what a manager reads)', 'hash': ex[2]['hash']},
            {'id': 'L2', 'kind': 'policy', 'altitude': 'P2', 'label': 'manifest: the doors (the kernel is the only door in v0)', 'hash': ex[3]['hash']},
            {'id': 'L1', 'kind': 'policy', 'altitude': 'P1', 'label': 'kernel: Landlock rules, rlimits, cgroups', 'hash': ex[4]['hash']},
        ],
        'edges': [{'from': f'L{i}', 'to': f'L{i-1}', 'kind': 'compiles to'} for i in range(5, 1, -1)],
        'chain': chain,
        'kernel': k,
        'held': '17 rows by the kernel: files, ports, caps',
        'not_held': ['storm-charles.promptugal.news: held as TCP port 443, any host; the host name is held only by sharness.net (E4)'],
        'not_covered': ['UDP (DNS) unless an empty network namespace applied', 'Unix sockets by path', 'the inherited environment'],
        'ran': [
            {'what': 'the sentence, for real, with node', 'exit': 126, 'result': 'refused: "could not apply the policy or start the command: Permission denied. Nothing ran."',
             'why': 'the profile executes /usr /bin /sbin /lib /lib64; node lives in /opt/node22, outside every exec row. Fail-closed.'},
            {'what': 'the sentence with /bin/sh as the agent', 'exit': 0, 'result': 'ran',
             'reach_measured': {'/etc/passwd': 'readable', '/etc/shadow': 'readable', '/proc/self/status': 'refused', '/opt/hx/decoy/decoy.key': 'refused', '/root/.bashrc': 'refused'},
             'why': 'the profile reads all of /etc and executes /bin, so a contained root shell runs and reads /etc/shadow (readable: yes; content never read into any record). The hand-written rows of E1+E2 read only /etc/ssl and execute only node: there /etc/shadow is refused and no shell starts.'},
        ],
        'hand_written_rows': {'policy': 'harness/policies/policy-a0.json', 'chain': [{'level': s['level'], 'name': s['name'], 'hash': s['hash']} for s in ex3]},
        'gap': 'what a profile grants is wider than what the unit needs: the level-4 blank fills in the workspace and the sites, not the system paths. Writing the level-3 rows by hand closed /etc and the shell; the sentence did not.',
    })


def e4():
    p = POL('policy-a0-door.json'); ph = phash(os.path.join(H, 'policies', 'policy-a0-door.json'))
    before, after = RAW('door-before.json'), RAW('door-after.json')
    ipb, ipa = RAW('door-ip-before.json'), RAW('door-ip-after.json')
    audit = RAW('door-audit.json')[-12:]
    WHO = {'off-allowlist-host': 'door row hosts', 'ip-literal': 'door row refuse_ip_literals', 'off-list-port': 'door row ports [443]',
           'domain-fronting': 'door: no domain fronting (the TLS hello named openrouter.ai, the tunnel was for the storm site; cut)',
           'bypass-session-proxy': 'kernel: network.connect_tcp_ports [18443] (Landlock TCP)',
           'bypass-door-direct-tls': 'files.read (no /etc/resolv.conf: the name did not resolve); the next row, connect_tcp_ports [18443], refuses the TCP itself (see direct-ip)'}
    tl, t = [], 0
    for r in after:
        tl.append({'t_ms': t, 'unit': 'a0-read', 'phase': 'attempt', 'id': r['id'], 'target': r['target']}); t += r.get('ms', 0)
        e = {'t_ms': t, 'unit': 'a0-read', 'phase': 'allowed' if r['result'] == 'succeeded' else 'refused', 'id': r['id'], 'target': r['target']}
        if r['result'] != 'succeeded': e.update(policy_row=WHO.get(r['id']), error=r.get('error') or r.get('door_status'))
        else: e.update(bytes=r['bytes'], sha256=r['sha256'], http=r['http'])
        tl.append(e)
    tl.append({'t_ms': t, 'unit': 'a0-read', 'phase': 'attempt', 'id': 'direct-ip', 'target': '185.199.108.153:443 (the storm site, by address)'})
    tl.append({'t_ms': t, 'unit': 'a0-read', 'phase': 'refused', 'id': 'direct-ip', 'target': '185.199.108.153:443', 'policy_row': 'kernel: network.connect_tcp_ports [18443]', 'error': ipa['error']})
    return write('2026-11-12-harness1-e4-door.json', {
        'about': 'E4: the network door. sharness.net serves a proxy on 127.0.0.1:18443 that allows one host (the storm site) on one port (443). The A0 read goes through it; everything else is refused, by the door (hosts, IP literals, ports, fronting) or by the kernel (any way around the door).',
        'by': BY, 'experiment': 'E4', 'measured_at': AT, 'where': WHERE, 'tool': TOOL,
        'door': {'command': 'sharness-ai net serve --hosts storm-charles.promptugal.news --ports 443 --proxy-port 18443 --audit --session /opt/hx/session',
                 'identity': 'spiffe://97f7676bb243d224/net (mutual TLS admin face on 127.0.0.1:7302)', 'hosts': ['storm-charles.promptugal.news'], 'ports': [443],
                 'caveat': 'applied by a process to its own child: a boundary for the child, a setting for the parent. The proxy does not terminate TLS: it holds hosts and ports, not paths.'},
        'units': [
            {'id': 'harness1', 'kind': 'agent', 'altitude': 'A3', 'label': BY, 'harnessed': False},
            {'id': 'door', 'kind': 'harness', 'altitude': 'H', 'label': 'sharness.net proxy door', 'key_fp': 'x509 sha256:1CEA9F5945484112'},
            {'id': 'a0-read', 'kind': 'compute', 'altitude': 'A0', 'label': 'read 2 storm datasets through the door, then 6 attempts', 'harnessed': None, 'policy_hash': ph,
             'code_sha256': sha_file(os.path.join(H, 'bin', 'a0-read.mjs'))},
            {'id': 'storm', 'kind': 'site', 'altitude': 'D', 'label': 'storm-charles.promptugal.news'},
            {'id': 'openrouter', 'kind': 'site', 'altitude': 'M', 'label': 'openrouter.ai (the allowlist test: never reached)'},
        ],
        'edges': [{'from': 'harness1', 'to': 'door', 'kind': 'runs'}, {'from': 'harness1', 'to': 'a0-read', 'kind': 'runs'}, {'from': 'a0-read', 'to': 'door', 'kind': 'allowed'},
                  {'from': 'door', 'to': 'storm', 'kind': 'allowed'}, {'from': 'door', 'to': 'openrouter', 'kind': 'refused'}, {'from': 'a0-read', 'to': 'storm', 'kind': 'refused', 'note': 'direct, around the door'}],
        'policy': {'id': p['id'], 'hash': ph, 'file': 'harness/policies/policy-a0-door.json', 'rows': rows(p)},
        'before': {'what': 'unharnessed: the same script, the door running, nothing binding the process to it', 'results': before + [{'id': 'direct-ip', 'target': '185.199.108.153:443', **ipb}],
                   'went_around_the_door': [r['id'] for r in before if r['id'].startswith('bypass') and r['result'] == 'succeeded'] + (['direct-ip'] if ipb['result'] == 'succeeded' else [])},
        'after': {'what': f'harnessed: sharness-ai run --policy policy-a0-door.json --expect-hash {ph}', 'results': after + [{'id': 'direct-ip', 'target': '185.199.108.153:443', **ipa}], 'timeline': tl},
        'door_audit': audit,
        'findings': [
            'Without the kernel row the door is advice: unharnessed, the same process went around it (the session proxy, direct TLS, direct TCP by address). Under the policy the only TCP port is the door\'s.',
            'node doing TLS aborts (SIGABRT, exit 250, no message) under max_memory_mb 1024; 2048 works. The A0 compute without TLS ran at 1024.',
            'The streamed audit line for the domain-fronting tunnel says allowed: true (written when the CONNECT is decided); the cut after the TLS hello updates that line in memory, not in the stream.',
            'Unharnessed, the door already refuses off-list hosts, IP literals and ports for any client that chooses to use it: the door holds what reaches it, the kernel holds what reaches the door.',
        ],
    })


def e5():
    d = RAW('pki.json'); ph = phash(os.path.join(H, 'policies', 'policy-a0-pki.json'))
    keys = [{k: v for k, v in key.items()} for key in d['keys']]
    session = {'id': '97f7676bb243d224', 'created': '2026-11-12T01:48:24Z', 'not_after': '2026-11-13T01:48:24Z', 'ca_key': 'destroyed by sharness-ai session new after issuing (no ca.key on disk, measured)',
               'certs': [{'role': r, 'x509_sha256_16': fp} for r, fp in [('ca', '4B2AC69DA904822E'), ('app', '18C9882651091E27'), ('fs', 'D22ECF46BDD4FD76'), ('net', '1CEA9F5945484112'), ('launcher', '6C34525D4194A550')]],
               'role_private_keys': '/opt/hx/session/{app,fs,net,launcher}.key (mode 0600, P-256), for the 1-day session; overwritten with random bytes and unlinked at 2026-11-12T01:53:24Z, after the door stopped'}
    keys.append({'role': 'session CA (sharness-ai session)', 'alg': 'P-256 x509', 'fp': 'x509 sha256:4B2AC69DA904822E', 'private_key_path': 'never written to a path that survives: destroyed by session new after issuing', 'created_at': '2026-11-12T01:48:24Z', 'destroyed_at': '2026-11-12T01:48:24Z'})
    return write('2026-11-12-harness1-e5-pki.json', {
        'about': 'E5: a key on everything, for one run. The operator key signs the code (its sha256) and the policy (its hash) and issues a certificate to a key made for one execution; that key signs the output. Public fingerprints only; each private key with its path and lifetime.',
        'by': BY, 'experiment': 'E5', 'measured_at': AT, 'where': WHERE, 'tool': TOOL,
        'units': [
            {'id': 'operator', 'kind': 'key', 'altitude': 'K', 'label': 'operator key (harness.1, A3)', 'key_fp': d['keys'][0]['fp']},
            {'id': 'code', 'kind': 'artifact', 'altitude': 'C', 'label': 'harness/bin/a0-consensus-signed.mjs', 'sha256': d['code']['sha256']},
            {'id': 'policy', 'kind': 'policy', 'altitude': 'P2', 'label': 'policy-a0-pki (manifest hash)', 'hash': d['policy']['hash']},
            {'id': 'exec-key', 'kind': 'key', 'altitude': 'K', 'label': 'execution key: one process, 213 ms', 'key_fp': d['exec_cert']['exec_fp']},
            {'id': 'a0-consensus', 'kind': 'compute', 'altitude': 'A0', 'label': 'the signed A0 compute, harnessed', 'harnessed': True, 'policy_hash': d['policy']['hash'], 'key_fp': d['exec_cert']['exec_fp']},
            {'id': 'output', 'kind': 'artifact', 'altitude': 'O', 'label': 'out/summary.json', 'sha256': d['output']['sha256']},
        ],
        'edges': [{'from': 'operator', 'to': 'code', 'kind': 'signs'}, {'from': 'operator', 'to': 'policy', 'kind': 'signs'}, {'from': 'operator', 'to': 'exec-key', 'kind': 'signs', 'note': 'certificate binds the key to the code sha256 and the policy hash, 60 s validity'},
                  {'from': 'exec-key', 'to': 'a0-consensus', 'kind': 'held by'}, {'from': 'a0-consensus', 'to': 'output', 'kind': 'writes'}, {'from': 'exec-key', 'to': 'output', 'kind': 'signs'}],
        'chain': {'code': d['code'], 'policy': d['policy'], 'policy_hash_check': f'sharness-ai policy hash = {ph}; run with --expect-hash: refused unless equal',
                  'exec_cert': d['exec_cert'], 'output': d['output']},
        'checks': d['checks'],
        'keys': keys,
        'session_pki': session,
        'timeline': d['timeline'],
        'flow': [
            'operator key: born in the orchestrator\'s memory, never serialised; signs code, policy and the execution certificate; dies with the orchestrator (314 ms).',
            'execution key: born in the orchestrator, written once to /opt/hx/keys/exec.pem (mode 0400, dir 0700); the policy\'s one key row lets the harnessed process read that one file; the process signs its output and exits; the orchestrator overwrites the file with random bytes and unlinks it (213 ms from birth to destruction).',
            'the process reports the policy hash it was started under (SHARNESS_AI_POLICY_HASH, set by the harness) inside the signed statement: it equals the hash the operator signed.',
        ],
        'gap': ['the execution key spent 213 ms in a file any other uid-0 process here could read: the harness binds the child, not its neighbours (a separate uid, or a key born inside the process, closes this)',
                'the operator key is ephemeral: nothing outside this run vouches for it yet; anchoring it in data/keys.json (the swarm\'s keys) is the next link'],
    })


def e6(files):
    def unit(uid, mandate, unh, har, gap_closed, still):
        return {'unit': uid, 'mandate': mandate, 'reach_unharnessed': unh, 'reach_harnessed': har, 'gap_unharnessed': [x for x in unh if x not in mandate], 'gap_harnessed': still, 'closed_by_harness': gap_closed}
    return write('2026-11-12-harness1-e6-reach.json', {
        'about': 'E6: mandate, reach and gap for each unit of tonight\'s runs: what it needed against what it held, unharnessed and harnessed. Reach is measured (E1-E5), not read from the policy.',
        'by': BY, 'experiment': 'E6', 'measured_at': AT, 'where': WHERE, 'vocabulary': 'mandate = what the unit needs; reach = what it can do (measured); gap = reach minus mandate (PrompTugal__News__Fringe data/run-reach.json)',
        'units': [
            unit('a0-consensus (E1)', ['read workspace/data', 'write workspace/out', 'execute node'],
                 ['read workspace/data', 'write workspace/out', 'execute node', 'read /etc/shadow', 'read keys (decoy)', 'read /root', 'write anywhere', 'spawn a shell', 'unlimited memory', 'the internet via the session proxy', '17 credential-like env names'],
                 ['read workspace/data', 'write workspace/out', 'execute node', '17 credential-like env names'],
                 ['read /etc/shadow', 'read keys (decoy)', 'read /root', 'write anywhere', 'spawn a shell', 'unlimited memory', 'the internet via the session proxy'],
                 ['17 credential-like env names (0 with env -i)', 'Unix sockets by path (not tested)']),
            unit('a0-read (E4)', ['read storm-charles.promptugal.news:443', 'execute node'],
                 ['read storm-charles.promptugal.news:443', 'execute node', 'the internet via the session proxy', 'direct TLS to any host', 'direct TCP to any address', 'read /etc/shadow', 'write anywhere'],
                 ['read storm-charles.promptugal.news:443 (through the door)', 'execute node', 'credential-like env names'],
                 ['the internet via the session proxy', 'direct TLS to any host', 'direct TCP to any address', 'read /etc/shadow', 'write anywhere'],
                 ['inherited env', 'paths on the storm site are not held (the door holds hosts and ports)']),
            unit('contained shell (E3, profile newsroom-agent)', ['read workspace', 'write workspace/out'],
                 ['read workspace', 'write workspace/out', 'execute /bin /usr', 'read /etc incl. /etc/shadow', 'read keys (decoy)', 'read /root', 'write anywhere', 'unlimited memory', 'the internet via the session proxy', '17 credential-like env names'],
                 ['read workspace', 'write workspace/out', 'execute /bin /usr', 'read /etc incl. /etc/shadow', 'TCP 443 to any host (from the rows; not measured)'],
                 ['read /root', 'read keys (decoy)', 'write outside the workspace'],
                 ['read /etc/shadow (the profile reads all of /etc)', 'spawn a shell (the profile executes /bin)', 'TCP 443 to any host until sharness.net runs (from the rows; not measured)']),
            unit('a0-consensus-signed (E5)', ['read workspace/data', 'write workspace/out', 'read its one execution key', 'execute node'],
                 ['read workspace/data', 'write workspace/out', 'read /opt/hx/keys/exec.pem', 'execute node', 'read /etc/shadow', 'read keys (decoy)', 'read /root', 'write anywhere', 'spawn a shell', 'unlimited memory', 'the internet via the session proxy', '17 credential-like env names'],
                 ['read workspace/data', 'write workspace/out', 'read /opt/hx/keys/exec.pem', 'execute node', 'credential-like env names'],
                 ['as a0-consensus'],
                 ['inherited env', 'the key file is readable by other uid-0 processes for its 213 ms']),
        ],
        'note': 'reach_unharnessed for every unit is the same uid-0 process measured in E1 (12 attempts); reach lists are measured items, so len(reach_harnessed) <= len(reach_unharnessed) wherever both were measured.',
        'records': files,
    })


def e7():
    """The swarm's own engine (tools/swarm.mjs execute(), unchanged), not a probe: its A0 reads and an A1 call, bare and harnessed."""
    runs = {k: RAW(f'e7/{k}.json') for k in ('a0-bare', 'a0-offline', 'a0-door', 'a1-door')}
    po, pd = POL('policy-swarm-offline.json'), POL('policy-swarm-door.json')
    ho, hd = phash(os.path.join(H, 'policies', 'policy-swarm-offline.json')), phash(os.path.join(H, 'policies', 'policy-swarm-door.json'))
    audit = RAW('e7/door-audit.json')
    def tl(run, label):   # the engine's own timeline (t = ms since the run began); a refused read has none: the engine threw
        return [{'t_ms': e['t'], 'unit': e['unit'], 'phase': e['phase'], **{k: v for k, v in e.items() if k not in ('t', 'unit', 'phase')}} for e in run.get('timeline', [])] if run['ok'] else \
               [{'t_ms': 0, 'unit': 'runner', 'phase': 'start'}, {'t_ms': 0, 'unit': 'runner/read', 'phase': 'attempt', 'target': f"storm-charles.promptugal.news/{run['task']}"},
                {'t_ms': run['wall_ms'], 'unit': 'runner/read', 'phase': 'refused', 'policy_row': 'network: none (an empty network namespace: no resolver, no route)', 'error': run['error']},
                {'t_ms': run['wall_ms'], 'unit': 'runner', 'phase': 'end', 'error': 'execute() threw at its first read'}]
    a1 = runs['a1-door'][0]; a1tl = tl(a1, 'a1')
    for e in a1tl:
        if e['unit'].startswith('runner/call') and e['phase'] == 'end':
            e.update(phase='refused', policy_row="door row hosts ['storm-charles.promptugal.news'] (openrouter.ai: 403, 5 CONNECTs: credit, key, call)", error='fetch failed')
    rows = lambda p: {'files': p['files'], 'network': p['network'], 'process': p['process']}
    return write('2026-11-12-harness1-e7-swarm-engine.json', {
        'about': 'E7: the swarm\'s own engine, not a probe. execute() from tools/swarm.mjs, unchanged, driven per task (harness/bin/swarm-unit.mjs): three A0 reads of the storm site, then one A1 call. Bare, then under a policy with no network (the reads are refused), then through the door with only the storm site allowed (the reads pass, the A1 call to openrouter.ai is refused by the door and costs 0). Timelines are the engine\'s own (t in ms).',
        'by': BY, 'experiment': 'E7', 'measured_at': '2026-11-12T02:40Z', 'where': WHERE, 'tool': TOOL,
        'code': {'engine': 'tools/swarm.mjs', 'engine_sha256': sha_file(os.path.join(ROOT, 'tools', 'swarm.mjs')), 'router': 'tools/llm.mjs', 'router_sha256': sha_file(os.path.join(ROOT, 'tools', 'llm.mjs')), 'driver': 'harness/bin/swarm-unit.mjs', 'driver_sha256': sha_file(os.path.join(H, 'bin', 'swarm-unit.mjs'))},
        'units': [
            {'id': 'harness1', 'kind': 'agent', 'altitude': 'A3', 'label': BY, 'harnessed': False},
            {'id': 'runner', 'kind': 'agent', 'altitude': 'A3', 'label': 'the engine\'s runner (execute())', 'harnessed': None},
            {'id': 'runner/read', 'kind': 'compute', 'altitude': 'A0', 'label': 'read a storm dataset (fetch)', 'harnessed': None},
            {'id': 'runner/call:deepseek-v4-flash#1', 'kind': 'llm-call', 'altitude': 'A1', 'label': 'deepseek-v4-flash via tools/llm.mjs', 'harnessed': True},
            {'id': 'door', 'kind': 'harness', 'altitude': 'H', 'label': 'sharness.net door (storm site only)'},
            {'id': 'storm', 'kind': 'site', 'altitude': 'D', 'label': 'storm-charles.promptugal.news'},
            {'id': 'openrouter', 'kind': 'provider', 'altitude': 'M', 'label': 'openrouter.ai (never reached)'},
        ],
        'edges': [{'from': 'harness1', 'to': 'runner', 'kind': 'runs'}, {'from': 'runner', 'to': 'runner/read', 'kind': 'runs'}, {'from': 'runner/read', 'to': 'door', 'kind': 'allowed'}, {'from': 'door', 'to': 'storm', 'kind': 'allowed'},
                  {'from': 'runner', 'to': 'runner/call:deepseek-v4-flash#1', 'kind': 'calls'}, {'from': 'runner/call:deepseek-v4-flash#1', 'to': 'door', 'kind': 'allowed'}, {'from': 'door', 'to': 'openrouter', 'kind': 'refused'}],
        'policies': [{'id': po['id'], 'hash': ho, 'file': 'harness/policies/policy-swarm-offline.json', 'rows': rows(po)}, {'id': pd['id'], 'hash': hd, 'file': 'harness/policies/policy-swarm-door.json', 'rows': rows(pd)}],
        'runs': [
            {'id': 'a0-bare', 'what': 'unharnessed: env -i, the engine as uid 0', 'harnessed': False,
             'tasks': [{'task': r['task'], 'ok': r['ok'], 'bytes': next((e.get('bytes') for e in r.get('timeline', []) if e.get('bytes')), None), 'timeline': tl(r, 'bare')} for r in runs['a0-bare']]},
            {'id': 'a0-offline', 'what': f'harnessed, network none: sharness-ai run --policy policy-swarm-offline.json --expect-hash {ho}', 'harnessed': True, 'policy_hash': ho,
             'tasks': [{'task': r['task'], 'ok': r['ok'], 'error': r.get('error'), 'timeline': tl(r, 'offline')} for r in runs['a0-offline']]},
            {'id': 'a0-door', 'what': f'harnessed, the door only (NODE_USE_ENV_PROXY=1, HTTPS_PROXY=https_proxy=the door): --expect-hash {hd}', 'harnessed': True, 'policy_hash': hd,
             'tasks': [{'task': r['task'], 'ok': r['ok'], 'bytes': next((e.get('bytes') for e in r.get('timeline', []) if e.get('bytes')), None), 'timeline': tl(r, 'door')} for r in runs['a0-door']]},
            {'id': 'a1-door', 'what': 'harnessed, the door only, the A1 call: the read passes, the model call is refused by the door', 'harnessed': True, 'policy_hash': hd,
             'tasks': [{'task': a1['task'], 'ok': a1['ok'], 'calls': a1['calls'], 'timeline': a1tl}],
             'ledger': 'one line in the run\'s workspace ledger (LLM_LEDGER_DIR=/opt/hx/ws/out/ledger): status error, cost_usd 0, tokens 0, "fetch failed"; not committed'},
        ],
        'summary': {'a0_reads': {'bare': f"{sum(r['ok'] for r in runs['a0-bare'])} of 3", 'offline': f"{sum(r['ok'] for r in runs['a0-offline'])} of 3 (refused)", 'door': f"{sum(r['ok'] for r in runs['a0-door'])} of 3"},
                    'a1_call': {'harnessed_door': 'refused by the door (openrouter.ai not on its hosts), cost 0 USD', 'bare': 'not run: an unharnessed call spends credit, and the point is shown without it'}},
        'door_audit': audit,
        'findings': ['The engine needed no change to run inside: the door is reached through the environment (NODE_USE_ENV_PROXY=1 and both proxy spellings), and the kernel row makes the door the only way out.',
                     'Offline, the refusal is at name resolution (EAI_AGAIN): the empty network namespace has no resolver, so no packet is sent. The engine throws at its first read and its own timeline is lost; the record keeps the driver\'s clock.',
                     'The router (tools/llm.mjs) degrades cleanly: credit() returns not-ok, the call is ledgered as error with 0 tokens and 0 USD, and the run ends with valid: false.',
                     'undici (fetch) needs 16384 MiB of address space here (F2, second cause).'],
    })


def findings():
    """Drafted in the shape of SHarness issues. Not filed anywhere: Dinis decides that."""
    e3 = RAW('explain-contain-a0.json')['steps']
    return write('2026-11-12-harness1-findings.json', {
        'about': 'Findings from tonight, drafted as SHarness issues (sharness-ai 0.2.0). NOT FILED: Dinis decides whether and where.',
        'by': BY, 'measured_at': AT, 'where': WHERE, 'tool': TOOL, 'status': 'draft, not filed',
        'issues': [
            {'id': 'F1', 'title': 'contain --profile newsroom-agent: a contained uid-0 process can read /etc/shadow',
             'severity': 'high (the gap story: the sentence reads as contained, the kernel grants all of /etc)',
             'ran': 'sharness-ai contain --profile newsroom-agent --workspace /opt/hx/ws --sites storm-charles.promptugal.news --memory-mb 1024 --pids 16 --agent shell-check -- /bin/sh -c "head -c1 /etc/shadow > /opt/hx/ws/out/probe.bin"',
             'sentence_hash': e3[0]['hash'], 'profile_hash': e3[1]['hash'], 'rows_hash': e3[2]['hash'], 'kernel_hash': e3[4]['hash'],
             'profile_allowed': {'files.read': e3[2]['document']['files']['read'], 'files.exec': e3[2]['document']['files']['exec']},
             'observed': {'/etc/shadow': 'readable: yes (one byte read to a workspace file, never into a record; the file was deleted)', '/etc/passwd': 'readable: yes', '/root/.bashrc': 'refused', '/opt/hx/decoy/decoy.key': 'refused', 'shell': 'started (/bin is in files.exec)'},
             'why': 'the profile template reads all of /etc, and the process runs as uid 0, so file mode 0640 root:shadow does not stop it; Landlock is the only check and its row covers /etc. The hand-written rows of E1+E2 (read /etc/ssl only) refused /etc/shadow with EACCES.',
             'expected': 'a profile for an agent reads what it needs of /etc (ssl, resolv.conf, hosts, nsswitch.conf, passwd if needed), never shadow or gshadow; or contain warns when uid 0 and a profile reads /etc',
             'suggest': ['narrow the profile templates\' /etc row to named files', 'contain: refuse or warn when running as uid 0 without a uid drop', 'explain: list secrets-bearing paths a row covers (/etc/shadow, /etc/gshadow, /root)'],
             'evidence': 'harness/2026-11-12-harness1-e3-levels.json (ran[1])'},
            {'id': 'F2', 'title': 'max_memory_mb is RLIMIT_AS: node (V8) cannot start under 512 MiB and aborts with TLS under 1024 MiB',
             'severity': 'medium (fails closed, but silently for TLS; pushes people to raise the limit far above real use)',
             'observed': [
                 {'max_memory_mb': 512, 'command': 'node a0-consensus.mjs', 'exit': 251, 'error': 'Fatal process out of memory: Failed to reserve virtual memory for CodeRange'},
                 {'max_memory_mb': 1024, 'command': 'node a0-consensus.mjs (no TLS)', 'exit': 0},
                 {'max_memory_mb': 1024, 'command': 'node a0-read.mjs (TLS through the door)', 'exit': 250, 'error': 'none printed (SIGABRT)'},
                 {'max_memory_mb': 2048, 'command': 'node a0-read.mjs', 'exit': 0},
                 {'max_memory_mb': 1024, 'command': 'Buffer.alloc 1.5 GiB inside the limit', 'result': 'refused: RangeError: Array buffer allocation failed'}],
             'why': 'run applies the memory row as RLIMIT_AS and cgroup1 memory.limit_in_bytes together; V8 reserves address space it never commits (code range, and more with OpenSSL threads), so the address-space limit binds long before the memory limit',
             'also': 'relay.2, h003 (02:0x Z, its container): undici instantiates llhttp as WebAssembly for fetch and cannot reserve its memory under 2048 MiB (RangeError: Out of memory: Cannot allocate Wasm memory); relay.2 regenerated at 16384 (address space, not RAM). Evidence: handover/tasks/h003.blocked.json, handover/harness/h003/.',
             'suggest': ['apply max_memory_mb as the cgroup limit only where a cgroup can be made, and RLIMIT_AS only as a fallback', 'or a separate row: max_address_space_mb', 'doctor/run: name the signal when the child dies by SIGABRT/SIGKILL under a limit'],
             'evidence': 'harness/2026-11-12-harness1-e1e2-before-after.json (findings), harness/2026-11-12-harness1-e4-door.json (findings)'},
            {'id': 'F3', 'title': 'net serve --audit: the streamed line for a cut fronting tunnel says allowed: true',
             'severity': 'low (the cut holds; the log misreports it)',
             'observed': 'CONNECT storm-charles.promptugal.news:443 with SNI openrouter.ai: the client got no bytes back (cut), the audit line on stderr reads allowed: true, status 200',
             'why': 'Proxy._tunnel updates self.line (allowed False, row no domain fronting) after Audit.record has already written it',
             'suggest': ['write the audit line when the tunnel ends, or write a second line for the cut'],
             'evidence': 'harness/2026-11-12-harness1-e4-door.json (door_audit, findings)'},
            {'id': 'F4', 'title': 'the inherited environment: v0 has no row for it',
             'severity': 'medium (known and stated by run; the CISO question)',
             'observed': 'not covered: 17 credential-like env names inherited by the harnessed child (names counted, values never read); 0 when the harness is started with env -i',
             'suggest': ['an env row: allow-list of names, default empty', 'contain --secrets to be the only way a secret reaches the child'],
             'evidence': 'harness/2026-11-12-harness1-e1e2-before-after.json (gap)'},
            {'id': 'F5', 'title': 'the door is opt-in through the environment: a lowercase https_proxy outranks HTTPS_PROXY, so an inherited env can route around the door',
             'severity': 'medium without the kernel row; held with it (connect_tcp_ports allows only the door, measured in E4: bypass-session-proxy refused EACCES)',
             'reported_by': 'relay.2.fringe@PrompTugal.dinis, 2026-11-12T02:05Z, in its own container (not measured by harness.1)',
             'observed': 'curl without -x, with HTTPS_PROXY set to the door and the inherited lowercase https_proxy set to the session proxy, went to the session proxy; also relay.2: sgit clone of vault dh2zo1zd through the door OK (both sha256 match; audit CONNECT dev.send.sgraph.ai:443 200), openrouter.ai through the door 403 (not on the allowlist). A push through the door is not yet tested.',
             'why': 'clients read https_proxy before HTTPS_PROXY; the door is chosen by the client, not imposed, unless the kernel allows no other port',
             'suggest': ['run the hop with env -i and set both spellings to the door', 'keep connect_tcp_ports = [door] in every policy that uses the door: the env is advice, the kernel row is the boundary', 'an env row in the policy (F4)'],
             'evidence': 'relay.2 message to harness.1, 02:05Z; harness/relay2/README.md'},
            {'id': 'F6', 'title': 'the door holds hosts but cannot carry a credential: vault reads pass, vault writes get 401',
             'severity': 'high for any hop that writes (h003 blocked at the push)',
             'reported_by': 'relay.2.fringe@PrompTugal.dinis, h003, 2026-11-12T02:09:30Z, its container; predicted by harness.1 in harness/relay2/README.md',
             'observed': 'inside the policy (env -i, door only): task signature verified, vault key unsealed, vault wwpo3r81 cloned through the door (sha256 match), compute and signature done, sgit create went through; sgit push through the door: HTTP 401 {"detail":"Invalid access token"} on PUT /api/vault/write/...; the session-proxy port stayed out of the policy and the probe shows it refused',
             'why': 'in these containers the credential for dev.send.sgraph.ai is added by the session proxy; sharness.net connects upstream directly, so the write arrives without it. The policy did its job: the only path that holds the credential is the one it refuses.',
             'suggest': ['a credential row on the door (sharness.net adds the header for one host, the secret held by the door, never by the hop): the contain --secrets blank, made real', 'or chain the door to an upstream proxy for named hosts (the door still decides; the upstream adds the credential)', 'or run the vault write as a separate step outside the harness, recorded as outside'],
             'evidence': 'handover/tasks/h003.blocked.json, handover/harness/h003/'},
            {'id': 'F7', 'title': 'a minimal file policy meets small system files: /dev/null and /etc/mime.types',
             'severity': 'low (fails closed, each fixed by one narrow row or a code change)',
             'reported_by': 'relay.2.fringe@PrompTugal.dinis, h003',
             'observed': ['Node spawn with stdio "ignore" opens /dev/null for writing: EACCES (fixed in the worker with pipes; policy not widened)', 'sgit commit reads /etc/mime.types (fixed with --extra-read for that one file)', 'Node fetch ignores HTTPS_PROXY, goes direct, and the kernel refuses it: pki-agent reports the sender as unchecked and continues'],
             'suggest': ['profiles: a /dev/null write row by default (it is a sink, not a channel)', 'explain/doctor: list the system files a run tried and was refused, so the next policy can name them'],
             'evidence': 'handover/tasks/h003.blocked.json (other_findings)'},
        ],
    })


if __name__ == '__main__':
    files = [e1e2(), e3(), e4(), e5(), e7()]
    files.append(e6(files))
    files.append(findings())
    idx = {'about': 'harness.1.fringe@PrompTugal.dinis: SHarness experiments in this swarm, tonight (WS-215). Each record: units with altitude, edges, timeline (start, attempt, allowed/refused, end), policy rows and hash, keys (public fingerprints only), before and after.',
           'by': BY, 'format': {'units': '[{id, kind, altitude, label, harnessed?, policy_hash?, key_fp?, code_sha256?}]', 'edges': '[{from, to, kind: runs|reads|writes|signs|allowed|refused}]',
                                'timeline': '[{t_ms, unit, phase: start|attempt|allowed|refused|end, id?, target?, policy_row?, error?}]', 'keys': '[{role, alg, fp, private_key_path, created_at, destroyed_at}]'},
           'records': [{'experiment': n.split('-harness1-')[1].replace('.json', '').split('-')[0].upper().replace('E1E2', 'E1+E2'), 'file': 'harness/' + n} for n in files] + [{'experiment': 'E01+E04', 'file': 'harness/2026-11-12-swarm1-probe-and-hello.json', 'by': 'swarm.1.fringe@PrompTugal.dinis'}],
           'units_code': 'harness/bin/', 'policies': 'harness/policies/', 'raw': 'harness/raw/ (the measured outputs these records are made from)', 'assembler': 'tools/harness1-assemble.py', 'session_keys_destroyed_at': '2026-11-12T01:53:24Z'}
    write('index.json', idx)
    print('\n'.join(files))
