// The stand's OpenRouter key, held only in the browser (Dinis, 12 Nov 2026 ~07:45 UTC: "We'll put the key in the browser").
// A disposable key (about £10 of credit) is pasted on the stand's own device, encrypted there with a passphrase
// (PBKDF2-SHA-256, 600,000 rounds → AES-256-GCM) and kept as ciphertext only: in this device's localStorage, and, if Dinis
// wants other devices to use it, as data/stand-key.json on the site. The plain key never leaves the page's memory, is never
// printed, logged, sent to swarm.1 or written to git. By swarm.1.fringe@PrompTugal.dinis (WS-215).
const te = new TextEncoder(), td = new TextDecoder();
const b64 = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ROUNDS = 600000, LS = 'swarm-stand-key/v1';
// Dinis, 12 Nov ~08:35 UTC: "remove the pass key ... all these are trusted devices". The default passphrase is this page's own:
// the key is obfuscated (not readable by a scanner or a casual reader of the site), not secret from someone who reads this file.
export const BUILTIN = 'swarm.promptugal.news/stand/v1 trusted devices';

async function derive(pass, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ROUNDS }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function sealKey(apiKey, pass) {
  if (!/^sk-or-/.test(apiKey)) throw new Error('that does not look like an OpenRouter key (sk-or-…)');
  pass = pass || BUILTIN;
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await derive(pass, salt), te.encode(apiKey));
  return { v: 1, kind: 'swarm-stand-key/v1', kdf: 'PBKDF2-SHA-256', rounds: ROUNDS, cipher: 'AES-256-GCM', salt: b64(salt), iv: b64(iv), ct: b64(ct),
    hint: apiKey.slice(0, 8) + '…' + apiKey.slice(-4), sealed_at: new Date().toISOString().slice(0, 16) + 'Z' };
}
export async function openKey(blob, pass) {
  pass = pass || BUILTIN;
  try { return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, await derive(pass, unb64(blob.salt)), unb64(blob.ct))); }
  catch { throw new Error('wrong passphrase'); }
}
export const saveLocal = (blob) => { try { localStorage.setItem(LS, JSON.stringify(blob)); return true; } catch { return false; } };
export const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
export const forgetLocal = () => { try { localStorage.removeItem(LS); } catch {} };
// the blob for this device, else the site's copy (data/stand-key.json), else null
export async function findBlob(base = '/') {
  const l = loadLocal(); if (l) return { blob: l, from: 'this device' };
  try { const r = await fetch(base + 'data/stand-key.json', { cache: 'no-store' }); if (r.ok) return { blob: await r.json(), from: 'the site' }; } catch {}
  return null;
}
// credit left on the key (OpenRouter's own endpoint); the key goes only to openrouter.ai, in a header
export async function credit(apiKey) {
  const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: 'Bearer ' + apiKey }, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error('OpenRouter answered ' + r.status);
  const d = (await r.json()).data || {};
  return { limit: d.limit, used: d.usage, remaining: d.limit_remaining ?? (d.limit != null ? d.limit - d.usage : null), label: d.label };
}
// no passphrase on the trusted devices: the site's or this device's key, opened with the built-in passphrase
export async function autoKey(base = '/') { const f = await findBlob(base); if (!f) return null; try { return { key: await openKey(f.blob), blob: f.blob, from: f.from }; } catch { return null; } }
