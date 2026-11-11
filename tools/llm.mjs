#!/usr/bin/env node
// A copy of the Fringe's model router (PrompTugal__News__Fringe admin/tools/llm.mjs), so runners need only this repository. The model router: ONE wrapper for every model call in this repository, with a ledger (work/20, dev.2.fringe@PrompTugal.dinis).
// Adapted from the storm site's tools/llm.mjs (PrompTugal/PrompTugal__News__Storm-Charles). What it does:
//   - the caller names a TIER (cheap | strong | hard | long), the router picks the model from admin/tools/llm-models.json
//     (open-weight cheap models first: "it's about being optimized", brief 4), falling back to the tier's fallback on a provider error;
//   - checks the key's credit first (GET /api/v1/auth/key) and refuses to send below min_credit_usd;
//   - one ledger line per call (when, task, agent, tier, model asked and served, tokens, cost, latency, status, raw record's name and sha256),
//     in LLM_LEDGER_DIR (default ~/.fringe-ledger/<UTC date>.jsonl): outside git. The raw request and response go to LLM_RAW_DIR
//     (default ~/.fringe-raw): outside git too (CLAUDE.md: no model text in git). `--summary-json` writes a small summary (counts and cost only);
//   - a daily cap, counted from the ledger;
//   - THE KEY IS NEVER IN THIS CODE OR ITS ENVIRONMENT HERE: on this estate the OpenRouter key is a network secret the proxy adds to
//     requests for openrouter.ai. The code sends the placeholder "Bearer placeholder" (or OPENROUTER_API_KEY / OPEN_ROUTER_KEY if a
//     person set one). It never prints a key; errors are scrubbed of anything that looks like one.
// As a module:  import { call, credit, route } from './llm.mjs'; await call({ task: 'WS-215/classify', agent, tier: 'cheap', messages })
// From a shell: node admin/tools/llm.mjs --task T --agent A [--tier cheap|strong|hard|long] [--model M] [--mock] "prompt"
//               node admin/tools/llm.mjs --credit | --summary [YYYY-MM-DD] | --summary-json FILE
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const TABLE = JSON.parse(fs.readFileSync(path.join(HERE, 'llm-models.json'), 'utf8'));
const LEDGER_DIR = process.env.LLM_LEDGER_DIR || path.join(os.homedir(), '.fringe-ledger');
const RAW_DIR = process.env.LLM_RAW_DIR || path.join(os.homedir(), '.fringe-raw');
const CAP = +(process.env.LLM_DAILY_CAP_USD || TABLE.daily_cap_usd || 20);
const MIN_CREDIT = +(process.env.LLM_MIN_CREDIT_USD || TABLE.min_credit_usd || 0);
const BASE = 'https://openrouter.ai/api/v1';
const keyHeader = () => `Bearer ${process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_KEY || 'placeholder'}`;   // the proxy replaces the placeholder
const scrub = (s) => String(s ?? '').replace(/sk-or-[A-Za-z0-9_-]{6,}/g, 'sk-or-…').replace(/Bearer\s+[A-Za-z0-9._-]{12,}/g, 'Bearer …');

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const ledgerFile = (d = day()) => path.join(LEDGER_DIR, `${d}.jsonl`);
const inRepo = (p) => { const r = path.relative(REPO, path.resolve(p)); return !r.startsWith('..') && !path.isAbsolute(r); };
if (inRepo(LEDGER_DIR) || inRepo(RAW_DIR)) throw new Error('llm.mjs: the ledger and the raw store live outside the repository (no model text in git)');

export const readLedger = (d = day()) => { try { return fs.readFileSync(ledgerFile(d), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
export const spentToday = () => readLedger().reduce((s, l) => s + (l.cost_usd || 0), 0);
const appendLedger = (line) => { fs.mkdirSync(LEDGER_DIR, { recursive: true, mode: 0o700 }); fs.appendFileSync(ledgerFile(line.at.slice(0, 10)), JSON.stringify(line) + '\n'); };
function writeRaw(rec) {
  const dir = path.join(RAW_DIR, rec.at.slice(0, 10)); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = `${rec.id}.json`, body = JSON.stringify(rec, null, 1) + '\n';
  fs.writeFileSync(path.join(dir, name), body, { mode: 0o600 });
  return { raw: `${rec.at.slice(0, 10)}/${name}`, raw_sha256: crypto.createHash('sha256').update(body).digest('hex').slice(0, 16), raw_bytes: Buffer.byteLength(body) };
}

// The credit: { ok, key_remaining, account_remaining, remaining } in USD (remaining = the smaller of the two: the key's own limit and the
// account's balance, which can run out first); ok false when neither can be read (then the call is not blocked, but says so).
export async function credit() {
  const get = async (p) => { try { const r = await fetch(`${BASE}${p}`, { headers: { Authorization: keyHeader() } }); return r.ok ? (await r.json()).data || {} : null; } catch { return null; } };
  const [k, c] = [await get('/auth/key'), await get('/credits')];
  if (!k && !c) return { ok: false };
  const key_remaining = k ? (k.limit_remaining ?? (k.limit != null ? k.limit - (k.usage ?? 0) : null)) : null;
  const account_remaining = c && c.total_credits != null ? +(c.total_credits - (c.total_usage ?? 0)).toFixed(4) : null;
  const known = [key_remaining, account_remaining].filter((x) => x != null);
  return { ok: true, key_limit: k?.limit ?? null, key_remaining, account_remaining, remaining: known.length ? Math.min(...known) : null };
}

// tier -> { tier, model, fallback }; an explicit model wins. Unknown tiers are an error, not a silent default.
export function route({ tier, model }) {
  if (model) return { tier: tier || 'explicit', model, fallback: null };
  const t = TABLE.tiers[tier || TABLE.default_tier];
  if (!t) throw new Error(`llm.mjs: unknown tier ${tier} (cheap | strong | hard | long)`);
  return { tier: tier || TABLE.default_tier, model: t.model, fallback: t.fallback || null };
}

let creditChecked = null;   // the first call in a process checks the credit once; 402 stops the process's calls
let noCredit = null;
async function send(model, messages, max_tokens, extra) {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), 120000);
  try {
    const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', signal: c.signal, headers: { Authorization: keyHeader(), 'Content-Type': 'application/json', 'X-Title': 'PrompTugal Swarm (WS-215)' },
      body: JSON.stringify({ model, messages, max_tokens, usage: { include: true }, ...extra }) });
    const body = await r.text(); let response; try { response = JSON.parse(body); } catch { response = { raw: body.slice(0, 4000) }; }
    return { r, response, body };
  } finally { clearTimeout(timer); }
}

export async function call({ task, agent, tier, model, messages, max_tokens = 2000, mock = false, extra = {} }) {
  if (!task || !agent || !Array.isArray(messages)) throw new Error('call({ task, agent, messages }) needs all three');
  // NO TIP TEXT IN A MODEL PROMPT (advice 2053 item 7, 11 Nov 2026): a tip can hold a private person's words, and OpenRouter traces keep prompts.
  // A call whose task names tips is refused and the refusal is ledgered; nothing is sent. Page text from public organiser pages is not tip text.
  if (/(^|[\/\s._-])tips?([\/\s._-]|$)/i.test(String(task))) { const at = new Date().toISOString().slice(0, 19) + 'Z'; const line = { at, id: 'refused-' + crypto.randomBytes(4).toString('hex'), task, agent, status: 'refused_tip_text', tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: 0 }; appendLedger(line); return { text: null, line, response: null }; }
  const pick = route({ tier, model });
  const at = new Date().toISOString(), id = `${at.replace(/[-:.]/g, '').slice(0, 15)}-${crypto.randomBytes(4).toString('hex')}`;
  const base = { at: at.slice(0, 19) + 'Z', id, task, agent, tier: pick.tier, provider: mock ? 'mock' : 'openrouter', model: pick.model, cap_usd: CAP };
  const refuse = (status, more = {}) => { const line = { ...base, status, ...more, tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: 0 }; appendLedger(line); return { text: null, line, response: null }; };
  if (!mock) {
    const spent = spentToday();
    if (spent >= CAP) return refuse('refused_cap', { spent_today_usd: +spent.toFixed(4) });
    if (noCredit) return { text: null, line: { ...base, status: 'not_sent_account_out_of_credit', since: noCredit, tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: 0 }, response: null };
    if (!creditChecked) creditChecked = await credit();
    if (creditChecked.ok && creditChecked.remaining != null && creditChecked.remaining < MIN_CREDIT) return refuse('refused_low_credit', { credit_remaining_usd: +creditChecked.remaining.toFixed(2), min_credit_usd: MIN_CREDIT });
  }
  const t0 = Date.now(); let status = 'ok', response = null, error = null, text = null, served = pick.model, request = { model: pick.model, messages, max_tokens, ...extra };
  try {
    if (mock) response = { model: pick.model + ' (mock)', choices: [{ message: { role: 'assistant', content: 'mock answer to: ' + String(messages.at(-1).content).slice(0, 80) }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8, cost: 0 } };
    else {
      let out = await send(pick.model, messages, max_tokens, extra);
      if (!out.r.ok && out.r.status !== 402 && out.r.status !== 401 && pick.fallback) { served = pick.fallback; out = await send(pick.fallback, messages, max_tokens, extra); }   // one fallback on a provider error
      response = out.response;
      if (!out.r.ok) { status = 'http_' + out.r.status; error = (response.error && response.error.message) || out.body.slice(0, 300); }
      if (out.r.status === 402) { status = 'account_out_of_credit'; noCredit = at; }
    }
    if (response && response.choices) text = response.choices[0]?.message?.content ?? null;
  } catch (e) { status = 'error'; error = String(e.message || e); }
  const u = (response && response.usage) || {};
  const raw = writeRaw({ ...base, request, response, error: error && scrub(error), latency_ms: Date.now() - t0 });
  const line = { ...base, model_served: (response && response.model) || served, status, tokens_in: u.prompt_tokens ?? 0, tokens_out: u.completion_tokens ?? 0, cost_usd: typeof u.cost === 'number' ? u.cost : 0, latency_ms: Date.now() - t0, ...raw, ...(error ? { error: scrub(error).slice(0, 200) } : {}) };
  appendLedger(line);
  return { text, line, response };
}

export function summary(d = day()) {
  const L = readLedger(d);
  const by = (k) => L.reduce((m, l) => { const v = l[k] || '?'; const x = (m[v] ||= { calls: 0, cost_usd: 0, tokens_in: 0, tokens_out: 0 }); x.calls++; x.cost_usd += l.cost_usd || 0; x.tokens_in += l.tokens_in || 0; x.tokens_out += l.tokens_out || 0; return m; }, {});
  return { day: d, calls: L.length, cost_usd: +L.reduce((s, l) => s + (l.cost_usd || 0), 0).toFixed(6), cap_usd: CAP, by_tier: by('tier'), by_model: by('model'), by_agent: by('agent'), by_task: by('task'), by_status: by('status') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; }, has = (k) => a.includes('--' + k);
  if (has('credit')) { console.log(JSON.stringify(await credit())); process.exit(0); }
  if (has('summary')) { console.log(JSON.stringify(summary(a[a.indexOf('--summary') + 1]?.startsWith('--') ? undefined : a[a.indexOf('--summary') + 1]), null, 1)); process.exit(0); }
  if (has('summary-json')) { fs.writeFileSync(opt('summary-json'), JSON.stringify(summary(), null, 1) + '\n'); process.exit(0); }
  const rest = []; for (let i = 0; i < a.length; i++) { if (['--task', '--agent', '--model', '--tier'].includes(a[i])) i++; else if (!a[i].startsWith('--')) rest.push(a[i]); }
  const prompt = rest.join(' ');
  if (!opt('task') || !opt('agent') || !prompt) { console.error('usage: llm.mjs --task T --agent A [--tier cheap|strong|hard|long] [--model M] [--mock] "prompt" | --credit | --summary [date] | --summary-json FILE'); process.exit(2); }
  const { text, line } = await call({ task: opt('task'), agent: opt('agent'), tier: opt('tier'), model: opt('model'), mock: has('mock'), messages: [{ role: 'user', content: prompt }] });
  console.log(JSON.stringify(line)); if (text) console.log(text);
  process.exit(line.status === 'ok' ? 0 : 1);
}
