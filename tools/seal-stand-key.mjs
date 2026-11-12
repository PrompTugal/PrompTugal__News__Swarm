#!/usr/bin/env node
// Seal the stand's OpenRouter key into data/stand-key.json, so every tablet opens the Studio with no setup
// (Dinis, 12 Nov 2026 ~08:55 UTC: "it is ok to put this on the site encrypted (with the decryption key somewhere on the code) ...
// a key with a budget limit and with an expiry date ... we have about 10 devices").
// Reads the key from the environment variable OPEN_ROUTER_WEB_SUMMIT (never from an argument, never printed), encrypts it
// exactly as assets/stand-key.js does (PBKDF2-SHA-256, 600,000 rounds → AES-256-GCM, the built-in passphrase), and writes
// only the ciphertext. The file is obfuscation, not secrecy: anyone who reads assets/stand-key.js can open it. That is
// accepted for this disposable, capped, expiring key. Prints only the last 4 characters, to tell keys apart.
//   node tools/seal-stand-key.mjs            writes data/stand-key.json
//   node tools/seal-stand-key.mjs --check    opens data/stand-key.json again and says whether it matches the env var
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'stand-key.json');
const src = fs.readFileSync(path.join(ROOT, 'assets', 'stand-key.js'), 'utf8');
const BUILTIN = /export const BUILTIN = '([^']+)'/.exec(src)[1], ROUNDS = +/ROUNDS = (\d+)/.exec(src)[1];
const key = process.env.OPEN_ROUTER_WEB_SUMMIT || '';
if (!/^sk-or-/.test(key)) { console.error('seal-stand-key: OPEN_ROUTER_WEB_SUMMIT is not set here (or is not an OpenRouter key); nothing written'); process.exit(1); }

const te = new TextEncoder(), b64 = (u) => Buffer.from(u).toString('base64');
const derive = async (salt) => crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ROUNDS },
  await crypto.subtle.importKey('raw', te.encode(BUILTIN), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

if (process.argv.includes('--check')) {
  const b = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const pt = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(b.iv, 'base64') }, await derive(Buffer.from(b.salt, 'base64')), Buffer.from(b.ct, 'base64')));
  console.log(`seal-stand-key: data/stand-key.json opens; ${pt === key ? 'it matches' : 'it does NOT match'} OPEN_ROUTER_WEB_SUMMIT (…${key.slice(-4)})`);
  process.exit(pt === key ? 0 : 2);
}
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await derive(salt), te.encode(key));
const blob = { v: 1, kind: 'swarm-stand-key/v1', kdf: 'PBKDF2-SHA-256', rounds: ROUNDS, cipher: 'AES-256-GCM', salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)),
  hint: '…' + key.slice(-4), source: 'OPEN_ROUTER_WEB_SUMMIT (a capped, expiring key for the stand)', sealed_at: new Date().toISOString().slice(0, 16) + 'Z' };
fs.writeFileSync(OUT, JSON.stringify(blob, null, 1) + '\n');
console.log(`seal-stand-key: wrote data/stand-key.json (key …${key.slice(-4)}, ciphertext only)`);
