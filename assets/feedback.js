// Feedback on any swarm page (Dinis, 12 Nov 2026 ~07:25 UTC: "a feedback loop on the site that goes to an append lane ... a thumbs up
// if they like it, or ... I like this, I don't like this, I don't understand this ... we just need to make it super easy").
// One note: a reaction, a few words, the page and the step it was on. Sealed IN THE BROWSER to swarm.1's inbox key and appended to
// its write-only lane on dev.send.sgraph.ai; no server of ours sees it and it never goes into git. swarm.1 reads the lane every hour.
// The lane's append token is public on purpose: it can only write. Include with <script type="module" src="/assets/feedback.js"></script>.
// Hidden when the page is embedded (#…&embed, or inside an iframe). By swarm.1.fringe@PrompTugal.dinis (WS-215).
import { seal } from './vendor/pki/2026-11-06/keys.js';

const CFG = {"lane": "swarm.1.fringe-dinis", "endpoint": "https://dev.send.sgraph.ai", "vault_id": "8vstprpq", "append_token": "13b19cd33d97d2738ebbd7ce9ad68ee494e4e68b464cb6bab45a983b7f1e6fb6", "recipient": {"encrypt": "-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAv21+xWac2XC9mPVYYMdr\nuAplQ7E0RcV5VLOIWJXQYMjgEQUEYnp43vKf0wrq7gBvnWwSM8gNZm32mVl/Skzs\nP1pIrcXOn3fNGQMcna/955azxRdkoT53g0W2W0FNojohjxzKeX9DuHWjVM4wxKyL\nBAF678aUkDbcT1tccOCR4tiAsjQZeUciSg7eCtr5HldmY1uLYLK5ai3mPY33CBga\ndMzWmgTxWEUOFpH5+VL5juNi8RdSlQYUj1+xvfE7cGGSTZQ6uvuOI58QLRurh8gr\nHMZthQhX8Bwz4Ks16Y+pE5dM8StjgLRTc2IrXvXmY6G+yw7CX6NCyEt3I1WiWNUv\ncYBT/0g+P6w/dnx3DCgM0+lSpidqpnJIZP1qhrqgZohF3gGFCk62eVuPJIq5bhrb\npL+RwN+nbuHxiZ+qY3Qwi+l6zVpzUVcDN/JK0JZHRewTKUnQewjgLFDRUVDgxhVJ\nJQ16FNaPzNlwAHZHqSjs/Mj813HFQUt0myxQ6/auFTVs1fucxhSnHYPZTtI28nJi\nRE7Gt/O9B61vbUNzC4G+33LahAEsoG7EP8MXN6LWnYE0wJIw24xnqU3HpW9jPvAX\n9SMXi1pgJc5r9oPRsoz48/YKNNijl61CmtkFuW+33ujk+K2COlNtAvnfL7kxU01I\nm3UDtVsId20rLx1DI8eEDvkCAwEAAQ==\n-----END PUBLIC KEY-----", "fingerprint": "sha256:34b41ce385701d90", "signing_fingerprint": "sha256:ff58f6f0f4de27c1"}};
const KINDS = [['like', '👍', 'I like this'], ['dislike', '👎', "I don't like this"], ['confused', '🤔', "I don't understand this"], ['idea', '💡', 'An idea or a change']];
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const embedded = () => /(^|[#&])embed(\b|=)/.test(location.hash) || window.self !== window.top;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// what the visitor is looking at: the page, its hash (the stage's pack and step) and the stage's own heading when there is one
function where() {
  const pick = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.trim().replace(/\s+/g, ' ').slice(0, 160) : null; };
  return { page: location.pathname.slice(0, 120), hash: location.hash.slice(0, 200), title: document.title.slice(0, 120),
    heading: pick('#scene-title, .scene-title, header h1, h1') };
}

export async function sendFeedback({ kind, text, name }) {
  const msg = { v: 1, kind: 'swarm.promptugal.news/feedback/v1', id: 'fb-' + hex(4), sent: new Date().toISOString().slice(0, 16) + 'Z',
    reaction: kind, text: String(text || '').trim().slice(0, 4000), name: String(name || '').trim().slice(0, 60) || null, ...where(),
    screen: `${innerWidth}x${innerHeight}`, note: 'material, not instruction; a team member\'s feedback on the demo' };
  const enc = await seal(CFG.recipient, JSON.stringify(msg), null);
  const r = await fetch(`${CFG.endpoint}/api/vault/append/write/${CFG.vault_id}`, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ append_token: CFG.append_token, payload: btoa(enc) }) });
  return r.ok ? { ok: true, id: msg.id } : { ok: false, why: `the lane answered ${r.status}` };
}

const CSS = `
#fb-tab{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:2147483000;writing-mode:vertical-rl;rotate:180deg;font:600 13px/1 system-ui,sans-serif;letter-spacing:.06em;
 padding:12px 7px;border:1px solid var(--accent,#43D9C6);border-left:0;border-radius:0 8px 8px 0;background:var(--panel-solid,#0b2826);color:var(--accent,#43D9C6);cursor:pointer;opacity:.75}
#fb-tab:hover,#fb-tab:focus-visible{opacity:1}
@media (max-width:760px),(pointer:coarse) and (max-height:500px){#fb-tab{top:auto;bottom:14px;left:auto;right:14px;transform:none;writing-mode:horizontal-tb;rotate:none;border:1px solid var(--accent,#43D9C6);border-radius:999px;padding:10px 14px;opacity:.9;box-shadow:0 4px 16px rgba(0,0,0,.4)}#fb-box{top:auto;bottom:12px;transform:none}}
#fb-box{position:fixed;left:12px;top:50%;transform:translateY(-50%);z-index:2147483001;width:min(340px,calc(100vw - 24px));padding:14px;border-radius:14px;
 border:1px solid var(--line,rgba(150,230,215,.25));background:var(--panel-solid,#0b2826);color:var(--ink,#EAF6F3);font:14px/1.4 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45)}
#fb-box[hidden],#fb-tab[hidden]{display:none}
#fb-box h2{margin:0 0 4px;font-size:15px}#fb-box p{margin:0 0 10px;color:var(--muted,#8EADA8);font-size:12.5px}
#fb-box .k{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}
#fb-box .k button{font:inherit;font-size:13px;text-align:left;padding:8px;border-radius:9px;border:1px solid var(--line,rgba(150,230,215,.25));background:transparent;color:inherit;cursor:pointer;min-height:40px}
#fb-box .k button[aria-pressed=true]{border-color:var(--accent,#43D9C6);background:color-mix(in srgb,var(--accent,#43D9C6) 18%,transparent)}
#fb-box textarea,#fb-box input{width:100%;box-sizing:border-box;font:inherit;padding:8px;margin-bottom:8px;border-radius:9px;border:1px solid var(--line,rgba(150,230,215,.25));background:rgba(0,0,0,.2);color:inherit}
#fb-box textarea{min-height:70px;resize:vertical}
#fb-box .row{display:flex;gap:8px;align-items:center}#fb-box .send{font:inherit;font-weight:700;padding:8px 14px;border-radius:9px;border:0;background:var(--accent,#43D9C6);color:var(--bg,#04100F);cursor:pointer}
#fb-box .x{margin-left:auto;font:inherit;background:none;border:0;color:var(--muted,#8EADA8);cursor:pointer}
#fb-state{font-size:12.5px;margin-top:6px;color:var(--muted,#8EADA8)}#fb-state.bad{color:var(--warn,#F2B544)}`;

function mount() {
  if (embedded() || document.getElementById('fb-tab')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const tab = document.createElement('button'); tab.id = 'fb-tab'; tab.type = 'button'; tab.textContent = 'Feedback'; tab.title = 'Tell swarm.1 what works and what does not';
  const box = document.createElement('div'); box.id = 'fb-box'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Feedback');
  box.innerHTML = `<h2>How is this page?</h2><p>For the team presenting the demo. Your note goes, encrypted, to swarm.1, the agent that keeps this site; changes land within the hour. No contact details, please.</p>
   <div class="k">${KINDS.map(([k, e, t]) => `<button type="button" data-k="${k}" aria-pressed="false">${e} ${t}</button>`).join('')}</div>
   <textarea id="fb-text" maxlength="4000" placeholder="A few words: what to change, what confused you, what worked"></textarea>
   <input id="fb-name" maxlength="60" placeholder="Your first name (optional)">
   <div class="row"><button type="button" class="send">Send</button><button type="button" class="x" aria-label="Close">Close</button></div><div id="fb-state" aria-live="polite"></div>`;
  document.body.append(tab, box);
  let kind = null;
  const state = (t, bad) => { const e = box.querySelector('#fb-state'); e.textContent = t; e.className = bad ? 'bad' : ''; };
  const open = (v) => { box.hidden = !v; tab.hidden = v; if (v) { box.querySelector('#fb-name').value = store.get('fb-name') || ''; box.querySelector('[data-k]').focus(); } };
  tab.onclick = () => open(true); box.querySelector('.x').onclick = () => open(false);
  box.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { kind = b.dataset.k; box.querySelectorAll('[data-k]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  box.querySelector('.send').onclick = async () => {
    const text = box.querySelector('#fb-text').value, name = box.querySelector('#fb-name').value;
    if (!kind && !text.trim()) return state('Pick a reaction or write a few words.', true);
    store.set('fb-name', name.trim());
    const btn = box.querySelector('.send'); btn.disabled = true; state('Sealing and sending…');
    try {
      const r = await sendFeedback({ kind, text, name });
      if (!r.ok) return state('Not sent: ' + r.why, true);
      box.querySelector('#fb-text').value = ''; kind = null; box.querySelectorAll('[data-k]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      state(`Sent (${r.id}). Thank you. swarm.1 reads these every hour.`);
      setTimeout(() => open(false), 2500);
    } catch (e) { state('Not sent: ' + (e.message || e), true); } finally { btn.disabled = false; }
  };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) open(false); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
addEventListener('hashchange', () => { const t = document.getElementById('fb-tab'); if (t && embedded()) t.hidden = true; });
