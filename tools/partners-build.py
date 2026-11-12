#!/usr/bin/env python3
"""Build partners/index.json and partners/<slug>/partner.json from our own public pages.

partners.1.fringe@PrompTugal.dinis, 12 Nov 2026 (WS-215), for Dinis.

Input: a cache folder holding the markdown twins of our own sites, fetched by hand with curl:
  gr/<card>.card.md   https://gamma-ray.sgit.ai/spectrum/cards/<card>/index.md
  gr/<card>.scan.md   https://gamma-ray.sgit.ai/scans/<card>/index.md
  xr/<slug>.md        https://web-summit.sgit.ai/xray/<slug>/index.md
Only our own public sites are read (never websummit.com, never Luma). Facts keep their source URL and read time.
The registry below (COMPANIES) is written by hand: which artefacts belong to which company, its kind, and which
of our demos fit. Everything else comes from the pages.

  python3 -I tools/partners-build.py <cache-dir> <fetched-at-UTC>
"""
import json, os, re, sys

CACHE, FETCHED = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GR, XR = 'https://gamma-ray.sgit.ai/', 'https://web-summit.sgit.ai/xray/'
BY = 'partners.1.fringe@PrompTugal.dinis'

# slug: (name, kind, [gamma-ray cards], x-ray slug or None, extra pages)
COMPANIES = {
    'replit': ('Replit', 'coding', ['replit-agent'], 'replit'),
    'manus': ('Manus', 'general-agent', ['manus-agent'], 'manus-ai'),
    'talkdesk': ('Talkdesk', 'customer-service', ['talkdesk-autopilot'], None),
    'crowdstrike': ('CrowdStrike', 'security', ['crowdstrike-charlotte-ai'], None),
    'outsystems': ('OutSystems', 'platform', ['outsystems-agent-workbench'], None),
    'codacy': ('Codacy', 'coding', ['codacy-ai-reviewer'], None),
    'ethiack': ('Ethiack', 'security', ['ethiack-hackian'], None),
    'noxus': ('Noxus', 'platform', ['noxus-ai-workers'], None),
    'getvocal': ('GetVocal', 'customer-service', ['getvocal-agents'], None),
    'aisle': ('AISLE', 'security', ['aisle-platform'], None),
    'legalfly': ('LEGALFLY', 'legal', ['legalfly-agents'], None),
    'pebl': ('Pebl', 'other', ['pebl-alfie'], None),
    'jetbrains': ('JetBrains', 'coding', ['junie'], None),
    'github': ('GitHub', 'coding', ['github-copilot-cloud-agent'], None),
    'anthropic': ('Anthropic', 'coding', ['claude-code-web', 'claude-code-local'], None),
    'automaise': ('Automaise', 'customer-service', ['automaise-conversational-ai'], None),
    'visor-ai': ('Visor.ai', 'customer-service', ['visor-ai-agents'], None),
    'spinnable': ('Spinnable', 'platform', ['spinnable-ai-employees'], None),
    'emergence': ('Emergence', 'platform', ['emergence-craft'], None),
    'trent-ai': ('Trent AI', 'security', ['trent-ai-security-engineer'], None),
    'granter': ('Granter', 'other', ['granter-ai-grant-consultant'], None),
    'bythelaw': ('ByTheLaw', 'legal', ['bythelaw-legal-chat'], None),
    'buzz': ('Buzz', 'other', ['buzz-messaging-ai'], None),
    'student-property-network': ('Student Property Network', 'other', ['student-property-network'], None),
    'amex-gbt': ('Amex GBT', 'customer-service', [], 'amex-gbt'),
    'atlassian': ('Atlassian', 'platform', [], 'atlassian'),
    'booking-com': ('Booking.com', 'customer-service', [], 'booking-com'),
    'cloudflare': ('Cloudflare', 'infrastructure', [], 'cloudflare'),
    'feedzai': ('Feedzai', 'finance', [], 'feedzai'),
    'fidelidade': ('Fidelidade', 'finance', [], 'fidelidade'),
    'klarna': ('Klarna', 'finance', [], 'klarna'),
    'primitive': ('Primitive', 'infrastructure', [], 'primitive'),
    'salesforce': ('Salesforce', 'platform', [], 'salesforce'),
}

KIND_LABEL = {'coding': 'Coding agents', 'general-agent': 'General agents', 'customer-service': 'Customer service',
              'security': 'Security', 'platform': 'Agent platforms', 'legal': 'Legal', 'finance': 'Finance and insurance',
              'infrastructure': 'Infrastructure for agents', 'other': 'Other'}

# Our demos, by the kind of agent they speak to: (theme, demo id, why it fits them). Deep links into the themes page
# (the demo on the left, what to say on the right) and the stage scene itself.
DEMOS = {
    'coding': [('reach', 'same-privileges', 'A coding agent runs with the developer\'s own keys: everything it can reach, measured.'),
               ('flow', 'altitudes', 'One agent doing six jobs at different altitudes, each with its own reach.'),
               ('harness', 'harness-before-after', 'The same attempts, bare and then under one policy.'),
               ('flow', 'elsewhere', 'The agent only commits a signed request; a GitHub Action does the work.')],
    'general-agent': [('reach', 'same-privileges', 'An agent connected to your apps can reach far more than its task needs.'),
                      ('harness', 'harness-door', 'One host, one port, and the kernel enforcing it.'),
                      ('control', 'licence', 'A new tool connected mid-run changes the licence to operate.'),
                      ('reach', 'gap', 'Mandate, reach, gap: the three words for the conversation.')],
    'customer-service': [('reach', 'send-button', 'A send button is not a mandate: published findings on mail and calendar access.'),
                         ('control', 'db-mandate', 'A mandate as deep as the business logic: pay one invoice, not all of them.'),
                         ('reach', 'gap', 'Mandate, reach, gap: the three words for the conversation.'),
                         ('trust', 'q-why', 'Why was it allowed? A visitor\'s question, answered with files.')],
    'security': [('harness', 'harness-reach', 'Mandate, reach and gap, measured three ways, unit by unit.'),
                 ('control', 'check-outside', 'A check outside the process: real probes under one deny-all policy.'),
                 ('trust', 'pki', 'Who did what, provably: a packet run by two runners on separate keys.'),
                 ('harness', 'harness-credential', 'A run that did not get through, shown as it is.')],
    'platform': [('control', 'one-per-asset', 'One agent per asset instead of every agent wired to everything.'),
                 ('control', 'licence', 'A new tool connected mid-run changes the licence to operate.'),
                 ('flow', 'scale', 'One push, twelve jobs at once.'),
                 ('reach', 'reach-measured', 'What each unit needed against what it held.')],
    'legal': [('control', 'db-mandate', 'A mandate as deep as the business logic.'),
              ('trust', 'q-why', 'Why was it allowed? Answered with files.'),
              ('trust', 'handover', 'A handover between three agents, every step recorded.'),
              ('reach', 'gap', 'Mandate, reach, gap.')],
    'finance': [('control', 'db-mandate', 'A REAL run on a SIMULATED ledger: the task was to pay one invoice.'),
                ('reach', 'send-button', 'A send button is not a mandate.'),
                ('trust', 'q-why', 'Why was it allowed? Answered with files.'),
                ('control', 'licence', 'A licence to operate that changes when a tool is connected.')],
    'infrastructure': [('harness', 'harness-door', 'The network door: one host, one port, enforced by the kernel.'),
                       ('trust', 'harness-key-inside', 'A key born inside the run; it never touches a file.'),
                       ('flow', 'elsewhere', 'Run it where the assets are not.'),
                       ('harness', 'harness-reach', 'Mandate, reach and gap, per unit.')],
    'other': [('reach', 'gap', 'Mandate, reach, gap: the three words for the conversation.'),
              ('reach', 'opening', 'The same work, two ways.'),
              ('trust', 'q-why', 'Why was it allowed? Answered with files.')],
}


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def clean(s):
    s = re.sub(r'&quot;', '"', s)
    return re.sub(r'\s+', ' ', s).strip()


FACT = re.compile(r'^- `([IS]\d+)` (.*?)(?: "([^"]*)")? \[Source\]\(([^)]+)\) \(([^)]*?)captured (\S+?),')


def parse_card(card):
    t = read(os.path.join(CACHE, 'gr', card + '.card.md'))
    s = read(os.path.join(CACHE, 'gr', card + '.scan.md'))
    product = re.search(r'^# Spectrum card: (.+)$', t, re.M).group(1).strip()
    m = re.search(r'card of .+?: (A\S+ · R\S+ · C\S+ · O\S+), (\w+); (\d+) provisions lit across (\d+) instruments', t)
    code, stage, prov, inst = (m.group(1), m.group(2), int(m.group(3)), int(m.group(4))) if m else (None, None, None, None)
    read_on = re.search(r'read (\d{4}-\d\d-\d\d)', t).group(1)
    desc = ''
    m = re.search(r'not reviewed by its vendor yet\n\n(.+?)\n', t)
    if m: desc = clean(m.group(1))
    dims, facts, seen = [], [], set()
    for sec in re.split(r'^## ', t, flags=re.M)[1:]:
        h = re.match(r'(Autonomy|Reach|Control|Openness): (?:level (\d), (.+)|(.+))$', sec.split('\n', 1)[0])
        if not h: continue
        dim = {'dim': h.group(1), 'level': int(h.group(2)) if h.group(2) else None, 'name': (h.group(3) or h.group(4)).strip()}
        q = re.search(r'^\*([^*]+)\*', sec.split('\n', 2)[2] if sec.count('\n') > 1 else '', re.M)
        if q: dim['question'] = q.group(1).strip()
        nu = re.search(r'\*\*Next unlock: (level \d, [^.]+)\.\*\* (.+)', sec)
        if nu: dim['next_unlock'] = {'level': nu.group(1), 'needs': clean(nu.group(2))}
        dims.append(dim)
        for line in sec.split('\n'):
            f = FACT.match(line)
            if not f: continue
            key = (f.group(1), f.group(4))
            if key in seen:
                next(x for x in facts if (x['indicator'], x['source']) == key)['dims'].append(dim['dim']); continue
            seen.add(key)
            label, _, text = clean(f.group(2)).partition('. ')
            facts.append({'indicator': f.group(1), 'dims': [dim['dim']], 'label': label, 'fact': text or label, 'quote': clean(f.group(3) or ''),
                          'source': f.group(4), 'read_at': f.group(6), 'via': GR + 'spectrum/cards/' + card + '/'})
    fr = re.search(r'\*\*The facts:\*\* ([^\n]+)', t)
    vendor = re.search(r'Built only from (.+?)\.', s)
    m = re.search(r'beta rating of .+?: (.+?)\n', s)
    configs = []
    for row in re.findall(r'^\| \*\*(.+?)\*\* \| (.+?) \| (\d \w[^|]*?) \| (\d+|n/a) \|', s, re.M)[:8]:
        configs.append({'config': row[0], 'what': clean(row[1]), 'freedom': row[2].strip()})
    return {'product': product, 'card': GR + 'spectrum/cards/' + card + '/', 'scan': GR + 'scans/' + card + '/',
            'correct': GR + 'feedback/?about=' + product.replace(' ', '%20').replace(',', '%2C'),
            'code': code, 'stage': stage, 'provisions': prov, 'instruments': inst, 'read_on': read_on, 'description': desc,
            'dims': dims, 'facts': facts, 'fact_ray': clean(fr.group(1)) if fr else None,
            'scan_summary': clean(m.group(1)) if m else None, 'built_from': clean(vendor.group(1)) if vendor else None,
            'configs': configs}


def bullets(block):
    return [clean(x) for x in re.findall(r'^- (.+)$', block, re.M)]


def parse_xray(slug):
    t = read(os.path.join(CACHE, 'xr', slug + '.md'))
    one = re.search(r'\*\*.+? in one line:\*\* (.+)', t).group(1).strip()
    read_on = re.search(r'sources read on (\d{4}-\d\d-\d\d)', t).group(1)
    what = re.search(r'^## What it does\n\n(.+?)\n', t, re.M)
    sits = []
    for sec in re.split(r'^## Situation: ', t, flags=re.M)[1:]:
        sec = re.split(r'^## (?!#)', sec, flags=re.M)[0]
        title = sec.split('\n', 1)[0].strip()
        helper = re.search(r'The helper: (.+?)\.\n', sec)
        parts = re.split(r'^### ', sec, flags=re.M)
        get = lambda k: next((p for p in parts if p.startswith(k)), '')
        reach, asked, gap = get('What its AI helpers can reach'), get('What they were asked to do'), get('The gap')
        sits.append({'title': title, 'helper': helper.group(1) if helper else None,
                     'reach': bullets(reach), 'reach_sources': re.findall(r'<(https?://[^>]+)>', reach),
                     'asked_our_example': bullets(asked), 'gap': bullets(gap), 'gap_sources': re.findall(r'<(https?://[^>]+)>', gap)})
    qs = re.search(r'^## The questions we would ask.*?\n\n(.+?)\n\n## ', t, re.M | re.S)
    questions = [clean(x) for x in re.findall(r'^\d+\. (.+)$', qs.group(1), re.M)] if qs else []
    srcs = []
    sm = re.search(r'^## Sources\n\n(.+)', t, re.M | re.S)
    if sm:
        for m in re.finditer(r'^- (s\d+): \[(.+?)\]\((\S+?)\), (.+?)\((\S+), read (\d{4}-\d\d-\d\d)\)', sm.group(1), re.M):
            srcs.append({'id': m.group(1), 'title': clean(m.group(2)), 'url': m.group(3), 'publisher': clean(m.group(4)), 'type': m.group(5), 'read_on': m.group(6)})
    inc = re.search(r'^## Incidents, as reported\n\n(.+?)\n\n## ', t, re.M | re.S)
    return {'page': XR + slug + '/', 'deck': XR + slug + '/deck/', 'run': XR + slug + '/run/', 'one_line': one, 'read_on': read_on,
            'what_it_does': clean(what.group(1)) if what else None, 'situations': sits, 'questions': questions,
            'incidents': bullets(inc.group(1)) if inc else [], 'sources': srcs}


def help_for(name, cards, xray):
    """How RiskMandate could help: OUR HYPOTHESIS, built only from what the cards and the X-ray say."""
    mandate, reach, gap = [], [], []
    for c in cards:
        for f in c['facts']:
            if f['indicator'] == 'I20': mandate.append({'text': f'{c["product"]}, its stated purpose: {f["fact"]}', 'source': f['source'], 'via': c['card']})
        for f in [f for f in c['facts'] if 'Reach' in f['dims']][:3]:
            reach.append({'text': f'{c["product"]}: {f["fact"]}', 'source': f['source'], 'via': c['card']})
        for d in c['dims']:
            if d['dim'] == 'Control':
                nu = d.get('next_unlock')
                lvl = f'level {d["level"]}, {d["name"]}' if d['level'] is not None else d['name']
                gap.append({'text': f'{c["product"]}: control is at {lvl} on the public evidence.' + (f' Not yet shown in public: {nu["needs"][len("Public evidence "):] if nu["needs"].startswith("Public evidence ") else nu["needs"]}' if nu else ''), 'via': c['card']})
    if xray:
        for s in xray['situations'][:3]:
            for a in s['asked_our_example'][:2]: mandate.append({'text': f'{s["title"]}: {a}', 'via': xray['page'], 'ours': True})
            for r in s['reach'][:2]: reach.append({'text': f'{s["title"]}: {r}', 'sources': s['reach_sources'][:4], 'via': xray['page']})
            for g in s['gap'][:2]: gap.append({'text': f'{s["title"]}: {g}', 'sources': s['gap_sources'][:4], 'via': xray['page']})
    pitch = (f'RiskMandate would measure, for one real deployment of {name}\'s agents, what each agent was asked to do (its mandate), '
             'what its credentials and connections actually let it reach (its grant), and the difference between the two (the gap), '
             'and keep that as a written record. It is read-only: never in the request path.')
    return {'label': 'Our hypothesis, not their claim. Built from public pages only; nothing of theirs was tested.',
            'pitch': pitch, 'mandate': mandate[:6], 'reach': reach[:6], 'gap': gap[:6]}


def together_for(name, cards, xray):
    out = []
    if cards:
        out.append({'title': 'Check and claim the GAMMA-Ray card', 'text': f'The card is beta and read only from public pages; {name} has not reviewed it. '
                    'A correction is dated and published, and a file at /.well-known/fact-ray.json on their own domain raises the trust of every fact on it.',
                    'link': cards[0]['correct'], 'link2': GR + 'fact-ray/well-known/'})
    if xray:
        out.append({'title': 'Answer the open questions of the X-ray', 'text': f'The X-ray lists the questions we would ask {name}; none has been asked yet.', 'link': xray['page']})
    out.append({'title': 'Measure one deployment', 'text': 'Pick one agent in one deployment; RiskMandate records its mandate, its grant and the gap, read-only. The lens page explains the measurement.', 'link': GR + 'lens/'})
    out.append({'title': 'Run one of their agents under a harness, on stage', 'text': 'The same task run bare and under one policy, with the probes and the record public, as in our own harness runs (simulated data only).', 'link': 'harness.html'})
    return {'label': 'Our suggestions. Nothing here is agreed.', 'items': out}


def demos_for(kind):
    return [{'title': None, 'theme': t, 'demo': d, 'why': why, 'present': f'theme.html?t={t}&d={d}', 'stage': f'../stage.html?scene={d}'} for t, d, why in DEMOS[kind]]


def cut(t, n):
    t = clean(t or '')
    if len(t) <= n: return t
    t = t[:n - 1].rsplit(' ', 1)[0].rstrip(',;:')
    return t + '…'


def deck_for(p, steps):
    """The mini deck, in StoryKit's primitives only (assets/story-kit.js validates it)."""
    name, sc = p['name'], []
    sc.append({'type': 'title', 'kicker': 'A partner brief', 'title': cut(name, 90), 'sub': cut(p['one_line'], 160),
               'caption': cut('What we have on ' + name + ', what we know, and how RiskMandate could help. Public sources only; our hypotheses say so.', 240)})
    facts = [f['fact'] for f in p['facts']][:5]
    if p['xray']:
        facts = [cut(p['xray']['one_line'], 140)] + [r for s_ in p['xray']['situations'][:2] for r in s_['reach'][:2]][:4]
    if facts:
        sc.append({'type': 'bullets', 'kicker': 'What we know (facts)', 'title': 'From their public pages', 'items': [cut(f, 140) for f in facts],
                   'caption': 'Facts only. Each has its source and the time it was read, on the brief page.'})
    for g in p['gamma_ray'][:1]:
        lv = [{'id': (d['dim'][0] + (str(d['level']) if d['level'] is not None else '–')), 'label': cut(d['dim'] + ': ' + d['name'], 60),
               'note': cut(('Next: ' + d['next_unlock']['needs']) if d.get('next_unlock') else (d.get('question') or ''), 140)} for d in g['dims']]
        sc.append({'type': 'ladder', 'kicker': 'GAMMA-Ray card (beta)', 'title': cut(g['product'] + ': ' + (g['code'] or ''), 90), 'levels': lv,
                   'caption': cut(f'A beta rating from public evidence only; {name} has not reviewed it. Stage: {g["stage"]}. {g["provisions"]} provisions lit across {g["instruments"]} instruments.', 240)})
    if p['xray']:
        gaps = [g for s_ in p['xray']['situations'] for g in s_['gap']][:5]
        sc.append({'type': 'bullets', 'kicker': 'The X-ray', 'title': 'Where reach and mandate do not match', 'items': [cut(g, 140) for g in gaps],
                   'caption': 'From the X-ray record. The mandate side is our example of sensible limits, not their policy.'})
    before = [cut(g['text'].split(': ', 1)[-1], 120) for g in p['help']['gap']][:4] or ['What each agent may reach is not written down in public']
    sc.append({'type': 'compare', 'kicker': 'Our hypothesis, not their claim', 'title': 'How RiskMandate could help',
               'before': {'label': 'On public evidence today', 'items': before},
               'after': {'label': 'With RiskMandate', 'items': ['A written mandate for each agent: what it was asked to do',
                         'Its grant, measured: what its credentials actually reach', 'The gap between the two, recorded and priced',
                         'Read-only: never in the request path']},
               'caption': 'Our hypothesis from public pages. Nothing of theirs was tested.'})
    sc.append({'type': 'flow', 'kicker': 'Our suggestion', 'title': 'How we could work together', 'steps': [cut(t['title'], 60) for t in p['together']['items']][:5],
               'caption': 'Suggestions only; nothing is agreed.'})
    for d in p['demos']:
        st = [x['step'] for x in steps if x['step'].startswith(d['demo'] + '/')]
        if st:
            sc.append({'type': 'embed', 'kicker': 'A demo to show', 'title': cut(d['title'], 90), 'step': st[-1], 'caption': cut(d['why'], 240)}); break
    sc.append({'type': 'statement', 'text': "Don't hope the agent behaves. Make the dangerous thing unreachable.", 'caption': 'The sentence.'})
    return {'id': 'partner-' + p['slug'], 'title': cut(name + ': a partner brief', 90), 'by': BY, 'at': p['built_at'], 'scenes': sc}


def main():
    steps = json.load(open(os.path.join(ROOT, 'stage/step-ids.json')))['story']
    scenes = {s['id']: s['title'] for s in json.load(open(os.path.join(ROOT, 'stage/scenes.json')))['scenes']}
    index = []
    for slug, (name, kind, cards_ids, xslug) in COMPANIES.items():
        cards = [parse_card(c) for c in cards_ids]
        xray = parse_xray(xslug) if xslug else None
        arte = []
        for c in cards:
            arte.append({'kind': 'gamma-ray', 'title': f'GAMMA-Ray card: {c["product"]}', 'url': c['card'], 'note': f'{c["code"]}, {c["stage"]} (beta)', 'read_on': c['read_on'], 'fetched_at': FETCHED})
            arte.append({'kind': 'gamma-ray-scan', 'title': f'GAMMA-Ray scan: {c["product"]}', 'url': c['scan'], 'note': c['scan_summary'], 'read_on': c['read_on'], 'fetched_at': FETCHED})
        if xray:
            arte.append({'kind': 'xray', 'title': f'X-ray: {name}', 'url': xray['page'], 'note': 'verified record: reach, our example of a mandate, the gap', 'read_on': xray['read_on'], 'fetched_at': FETCHED})
            arte.append({'kind': 'xray-deck', 'title': f'X-ray deck for the stand: {name}', 'url': xray['deck'], 'read_on': xray['read_on'], 'fetched_at': FETCHED})
            arte.append({'kind': 'xray-run', 'title': f'X-ray run: how the record was made', 'url': xray['run'], 'read_on': xray['read_on'], 'fetched_at': FETCHED})
        one = xray['one_line'] if xray else (cards[0]['description'] if cards else '')
        demos = demos_for(kind)
        for d in demos: d['title'] = scenes.get(d['demo'], d['demo'])
        p = {'slug': slug, 'name': name, 'kind': kind, 'kind_label': KIND_LABEL[kind], 'one_line': one,
             'made_by': BY, 'issue': 'WS-215', 'for': 'Dinis Cruz', 'built_at': FETCHED,
             'note': 'Everything here is from public pages. Facts carry their source and the time they were read; the hypothesis and the suggestions are ours and say so. GAMMA-Ray is a beta standard: every rating is experimental.',
             'artefacts': arte,
             'gamma_ray': [{k: c[k] for k in ('product', 'card', 'scan', 'code', 'stage', 'provisions', 'instruments', 'read_on', 'description', 'dims', 'fact_ray', 'built_from', 'configs')} for c in cards],
             'facts': [f for c in cards for f in c['facts']][:14],
             'xray': xray, 'help': help_for(name, cards, xray), 'together': together_for(name, cards, xray), 'demos': demos}
        p['deck'] = deck_for(p, steps)
        os.makedirs(os.path.join(ROOT, 'partners', slug), exist_ok=True)
        with open(os.path.join(ROOT, 'partners', slug, 'partner.json'), 'w', encoding='utf-8') as f:
            json.dump(p, f, ensure_ascii=False, indent=1); f.write('\n')
        has = sorted({a['kind'].split('-scan')[0].split('-deck')[0].split('-run')[0] for a in arte})
        index.append({'slug': slug, 'name': name, 'kind': kind, 'kind_label': KIND_LABEL[kind], 'one_line': one, 'has': has,
                      'products': [c['product'] for c in cards], 'codes': [c['code'] for c in cards],
                      'artefacts': [{k: a[k] for k in ('kind', 'url', 'read_on', 'fetched_at')} | {'source': 'gamma-ray.sgit.ai' if a['kind'].startswith('gamma') else 'web-summit.sgit.ai/xray'} for a in arte],
                      'material': len(arte) + len(p['facts']) + (len(xray['situations']) * 3 if xray else 0)})
    index.sort(key=lambda x: (-len(x['has']), -x['material'], x['name'].lower()))
    out = {'about': 'Every company we have something on: a GAMMA-Ray card (beta) or an X-ray record, on our own public sites. One entry per company; its mini deck is pages/partner.html?c=<slug>. Only companies with at least one real artefact.',
           'by': BY, 'for': 'Dinis Cruz', 'issue': 'WS-215', 'updated': FETCHED,
           'sources': [GR, XR], 'kinds': KIND_LABEL, 'partners': index}
    with open(os.path.join(ROOT, 'partners', 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write('\n')
    print(len(index), 'partners')


main()
