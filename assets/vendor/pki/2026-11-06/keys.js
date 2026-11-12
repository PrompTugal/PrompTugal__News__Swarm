/**
 * keys.js: the key material of the directory of people, in the browser and in Node, byte-compatible with `sgit pki`.
 *
 * Everything here is Web Crypto and nothing else. Each construction was checked against sgit-ai v0.23.0 (the
 * PKI__Crypto and PKI__Key_Store classes it ships) by admin/build/test_people.mjs, which runs the sgit CLI on what
 * this file makes and makes what the CLI reads:
 *
 *   encryption pair     RSA-OAEP 4096, e = 65537, SHA-256                          (sgit: generate_encryption_key_pair)
 *   signing pair        ECDSA P-256, SHA-256, signatures raw r||s, 64 bytes        (sgit: sign / verify)
 *   fingerprint         "sha256:" + the first 16 hex of SHA-256 over the DER SPKI  (sgit: compute_fingerprint)
 *   public bundle       { v: 1, encrypt, sign, label, fingerprint, signing_fingerprint }   (sgit pki export)
 *   private halves      PKCS#8 PEM, passphrase-encrypted as PBES2: PBKDF2-HMAC-SHA256 and AES-256-CBC, the form
 *                       python-cryptography's BestAvailableEncryption writes and sgit's key store reads
 *   the envelope        sgit's hybrid v2: base64 of { v: 2, w, i, c[, s, f] }; a fresh AES-256-GCM key encrypts,
 *                       RSA-OAEP wraps it; s is the sender's ECDSA signature over c, f the sender's signing fingerprint
 *   statements          the register's: canonical bytes are `jq -cS 'del(.sig)'` plus the newline jq ends with; the
 *                       statement id is "sha256:" + SHA-256 over `jq -cS .` of the whole statement, sig included
 *
 * Records in the register are keyed by the SIGNING fingerprint (registry/params.json); sgit's key store folders are
 * named by the ENCRYPTION fingerprint. Both are in every bundle, and the code says which one it means.
 *
 * @module keys
 */
const te = new TextEncoder(), td = new TextDecoder()
const subtle = () => globalThis.crypto.subtle
const random = n => globalThis.crypto.getRandomValues(new Uint8Array(n))

// ------------------------------------------------------------ bytes
export const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
export const unhex = s => Uint8Array.from(String(s).match(/../g) || [], h => parseInt(h, 16))
export function b64(bytes) { let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s) }
export function unb64(s) { const bin = atob(String(s).replace(/\s/g, '')); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out }
export const b64url = bytes => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const unb64url = s => unb64(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4))
export const utf8 = s => te.encode(s)
export const fromUtf8 = b => td.decode(b)
export async function sha256(data) { return new Uint8Array(await subtle().digest('SHA-256', typeof data === 'string' ? te.encode(data) : data)) }
export const sha256hex = async data => hex(await sha256(data))

// ------------------------------------------------------------ PEM, as python-cryptography writes it
export function pem(der, label) {
    const body = b64(der).match(/.{1,64}/g).join('\n')
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`
}
export function unpem(text) {
    const m = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(String(text || ''))
    if (!m) throw new Error('not a PEM block')
    return { label: m[1], der: unb64(m[2]) }
}

/** sgit's fingerprint of a public key: SPKI bytes or a PEM. */
export async function fingerprint(spkiOrPem) {
    const der = typeof spkiOrPem === 'string' ? unpem(spkiOrPem).der : new Uint8Array(spkiOrPem)
    return 'sha256:' + (await sha256hex(der)).slice(0, 16)
}
export const FP = /^sha256:[0-9a-f]{16}$/
/** The folder name a record lives in: a ':' breaks Windows checkouts (registry/params.json, record_dirname). */
export const dirOf = fp => String(fp).replace(':', '-')
export const fpOfDir = d => String(d).replace(/^sha256-/, 'sha256:')

// ------------------------------------------------------------ algorithms
export const RSA_GEN = { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
export const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' }
export const EC = { name: 'ECDSA', namedCurve: 'P-256' }
export const ECDSA = { name: 'ECDSA', hash: 'SHA-256' }

const importEncPublic = spki => subtle().importKey('spki', spki, RSA, false, ['encrypt'])
const importEncPrivate = pkcs8 => subtle().importKey('pkcs8', pkcs8, RSA, false, ['decrypt'])
const importSignPublic = spki => subtle().importKey('spki', spki, EC, false, ['verify'])
const importSignPrivate = pkcs8 => subtle().importKey('pkcs8', pkcs8, EC, false, ['sign'])

// ------------------------------------------------------------ the identity: two pairs, one bundle
/**
 * A new identity, made here: { bundle, private: { encrypt, sign } (PKCS#8 bytes), created }.
 * RSA-4096 generation takes a few seconds in a browser; the caller says so on the page.
 */
export async function generate(label = '') {
    const enc = await subtle().generateKey(RSA_GEN, true, ['encrypt', 'decrypt'])
    const sig = await subtle().generateKey(EC, true, ['sign', 'verify'])
    const encSpki = new Uint8Array(await subtle().exportKey('spki', enc.publicKey))
    const sigSpki = new Uint8Array(await subtle().exportKey('spki', sig.publicKey))
    return {
        bundle: await bundleOf(encSpki, sigSpki, label),
        private: { encrypt: new Uint8Array(await subtle().exportKey('pkcs8', enc.privateKey)), sign: new Uint8Array(await subtle().exportKey('pkcs8', sig.privateKey)) },
        created: Date.now(),
    }
}
/** The public bundle, in the shape `sgit pki export` emits. */
export async function bundleOf(encSpki, sigSpki, label = '') {
    return { v: 1, encrypt: pem(encSpki, 'PUBLIC KEY'), sign: pem(sigSpki, 'PUBLIC KEY'), label: String(label || ''),
             fingerprint: await fingerprint(encSpki), signing_fingerprint: await fingerprint(sigSpki) }
}
/** A bundle checked: both keys parse as what they claim, and both fingerprints are theirs. Returns a list of problems. */
export async function checkBundle(bundle) {
    const out = []
    if (!bundle || bundle.v !== 1) return ['not a v1 public-key bundle']
    try { await importEncPublic(unpem(bundle.encrypt).der) } catch (e) { out.push('the encryption key is not an RSA-OAEP public key') }
    try { await importSignPublic(unpem(bundle.sign).der) } catch (e) { out.push('the signing key is not an ECDSA P-256 public key') }
    if (out.length) return out
    if (await fingerprint(bundle.encrypt) !== bundle.fingerprint) out.push('fingerprint is not the encryption key’s')
    if (await fingerprint(bundle.sign) !== bundle.signing_fingerprint) out.push('signing_fingerprint is not the signing key’s')
    const { modulusLength } = (await subtle().importKey('spki', unpem(bundle.encrypt).der, RSA, true, ['encrypt'])).algorithm
    if (modulusLength < 3072) out.push(`the encryption key is ${modulusLength}-bit; sgit makes 4096`)
    return out
}
/** The public halves recomputed from the private ones (so an import needs only the two private PEMs). */
export async function publicFromPrivate(encPkcs8, signPkcs8, label = '') {
    const ej = await subtle().exportKey('jwk', await subtle().importKey('pkcs8', encPkcs8, RSA, true, ['decrypt']))
    const sj = await subtle().exportKey('jwk', await subtle().importKey('pkcs8', signPkcs8, EC, true, ['sign']))
    const encPub = await subtle().importKey('jwk', { kty: 'RSA', n: ej.n, e: ej.e, alg: 'RSA-OAEP-256', ext: true }, RSA, true, ['encrypt'])
    const sigPub = await subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', x: sj.x, y: sj.y, ext: true }, EC, true, ['verify'])
    return bundleOf(new Uint8Array(await subtle().exportKey('spki', encPub)), new Uint8Array(await subtle().exportKey('spki', sigPub)), label)
}

// ------------------------------------------------------------ DER, as much as PBES2 needs
function derLen(n) { if (n < 128) return [n]; const b = []; while (n) { b.unshift(n & 255); n >>= 8 } return [0x80 | b.length, ...b] }
const tlv = (tag, body) => Uint8Array.from([tag, ...derLen(body.length), ...body])
const seq = (...parts) => tlv(0x30, concat(...parts))
const octets = b => tlv(0x04, b)
function int(n) { const b = []; do { b.unshift(n & 255); n = Math.floor(n / 256) } while (n); if (b[0] & 0x80) b.unshift(0); return tlv(0x02, Uint8Array.from(b)) }
function oid(dotted) {
    const p = dotted.split('.').map(Number), out = [40 * p[0] + p[1]]
    for (const v of p.slice(2)) { const s = [v & 127]; let x = v >> 7; while (x) { s.unshift(0x80 | (x & 127)); x >>= 7 } out.push(...s) }
    return tlv(0x06, Uint8Array.from(out))
}
const NULL = Uint8Array.from([0x05, 0x00])
export function concat(...parts) { const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n); let i = 0; for (const p of parts) { out.set(p, i); i += p.length } return out }
/** One TLV at offset: { tag, start (of content), end, kids() }. */
function read(buf, at = 0) {
    const tag = buf[at]; let len = buf[at + 1], i = at + 2
    if (len & 0x80) { const n = len & 127; len = 0; for (let k = 0; k < n; k++) len = len * 256 + buf[i++] }
    const node = { tag, start: i, end: i + len, bytes: buf.subarray(i, i + len) }
    node.kids = () => { const out = []; let p = node.start; while (p < node.end) { const k = read(buf, p); out.push(k); p = k.end } return out }
    return node
}
function oidText(bytes) {
    const out = [Math.floor(bytes[0] / 40), bytes[0] % 40]; let v = 0
    for (const b of bytes.subarray(1)) { v = v * 128 + (b & 127); if (!(b & 0x80)) { out.push(v); v = 0 } }
    return out.join('.')
}
const intOf = bytes => [...bytes].reduce((s, b) => s * 256 + b, 0)
const OID = { pbes2: '1.2.840.113549.1.5.13', pbkdf2: '1.2.840.113549.1.5.12', hmacSha256: '1.2.840.113549.2.9', hmacSha1: '1.2.840.113549.2.7',
              aes256cbc: '2.16.840.1.101.3.4.1.42', aes128cbc: '2.16.840.1.101.3.4.1.2' }

/**
 * A PKCS#8 private key encrypted with a passphrase, as "ENCRYPTED PRIVATE KEY" PEM: PBES2, PBKDF2-HMAC-SHA256,
 * AES-256-CBC. python-cryptography (and so sgit's key store) reads it; the iteration count is in the file.
 */
export async function encryptPrivate(pkcs8, passphrase, iterations = 210000) {
    if (!passphrase) throw new Error('a passphrase is required: sgit keeps private keys encrypted at rest')
    const salt = random(16), iv = random(16)
    const base = await subtle().importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
    const key = await subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-CBC', length: 256 }, false, ['encrypt'])
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv }, key, pkcs8))
    const alg = seq(oid(OID.pbes2), seq(seq(oid(OID.pbkdf2), seq(octets(salt), int(iterations), seq(oid(OID.hmacSha256), NULL))), seq(oid(OID.aes256cbc), octets(iv))))
    return pem(seq(alg, octets(ct)), 'ENCRYPTED PRIVATE KEY')
}
/** The reverse, for sgit's own files (and for a plain "PRIVATE KEY" PEM, which needs no passphrase). PKCS#8 bytes out. */
export async function decryptPrivate(text, passphrase) {
    const { label, der } = unpem(text)
    if (label === 'PRIVATE KEY') return der
    if (label !== 'ENCRYPTED PRIVATE KEY') throw new Error(`a ${label.toLowerCase()} PEM is not a PKCS#8 private key`)
    const [alg, data] = read(der).kids()
    const [algId, params] = alg.kids()
    if (oidText(algId.bytes) !== OID.pbes2) throw new Error('only PBES2-encrypted keys are read here (sgit writes PBES2)')
    const [kdf, enc] = params.kids()
    const [kdfId, kdfParams] = kdf.kids()
    if (oidText(kdfId.bytes) !== OID.pbkdf2) throw new Error('only PBKDF2 is read here')
    const kp = kdfParams.kids()
    const salt = kp[0].bytes, iterations = intOf(kp[1].bytes)
    const prfNode = kp.find(k => k.tag === 0x30)
    const prf = prfNode ? oidText(prfNode.kids()[0].bytes) : OID.hmacSha1
    const hash = prf === OID.hmacSha256 ? 'SHA-256' : prf === OID.hmacSha1 ? 'SHA-1' : null
    if (!hash) throw new Error('unknown PBKDF2 hash')
    const [encId, ivNode] = enc.kids()
    const cipher = oidText(encId.bytes), length = cipher === OID.aes256cbc ? 256 : cipher === OID.aes128cbc ? 128 : 0
    if (!length) throw new Error('only AES-CBC-encrypted keys are read here')
    const base = await subtle().importKey('raw', te.encode(passphrase || ''), 'PBKDF2', false, ['deriveKey'])
    const key = await subtle().deriveKey({ name: 'PBKDF2', hash, salt, iterations }, base, { name: 'AES-CBC', length }, false, ['decrypt'])
    try { return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv: ivNode.bytes }, key, data.bytes)) }
    catch (e) { throw new Error('wrong passphrase, or not this key') }
}

// ------------------------------------------------------------ sgit's key store, on disk
/**
 * The five files of one key in sgit's key store (~/.sg-send/keys/sha256_<encryption fp>/), private halves encrypted
 * with the passphrase. Returns { folder, files: { name: text } }.
 */
export async function keystoreFiles(identity, passphrase) {
    const b = identity.bundle
    return {
        folder: b.fingerprint.replace(':', '_'),
        files: {
            'metadata.json': JSON.stringify({ label: b.label, algorithm: 'RSA-OAEP', key_size: 4096, encryption_fingerprint: b.fingerprint,
                                              signing_fingerprint: b.signing_fingerprint, created: identity.created || 0 }, null, 2),
            'private_key.pem': await encryptPrivate(identity.private.encrypt, passphrase),
            'public_key.pem': b.encrypt,
            'signing_private.pem': await encryptPrivate(identity.private.sign, passphrase),
            'signing_public.pem': b.sign,
        },
    }
}
/** A shell script that writes those files where sgit looks for them. Plain text; the private halves stay encrypted. */
export function keystoreScript({ folder, files }) {
    const lines = ['#!/bin/sh', '# Writes one key into sgit\'s key store. Made by pki.sgit.ai in your browser; the private halves are', '# encrypted with your passphrase, which this file does not contain. Then: sgit pki list', 'set -e',
        `D="$HOME/.sg-send/keys/${folder}"`, 'mkdir -p "$D"', 'chmod 700 "$HOME/.sg-send/keys" "$D" 2>/dev/null || true']
    for (const [name, text] of Object.entries(files)) lines.push(`cat > "$D/${name}" <<'SGIT_PKI_EOF'`, text.replace(/\n$/, ''), 'SGIT_PKI_EOF')
    lines.push('chmod 600 "$D/private_key.pem" "$D/signing_private.pem"', `echo "written: $D"`)
    return lines.join('\n') + '\n'
}
/** An identity from sgit's two private PEMs (and the passphrase): the public bundle is recomputed, not trusted. */
export async function importKeystore({ privateKeyPem, signingPrivatePem, passphrase, label = '', created = 0 }) {
    const encrypt = await decryptPrivate(privateKeyPem, passphrase), sign = await decryptPrivate(signingPrivatePem, passphrase)
    return { bundle: await publicFromPrivate(encrypt, sign, label), private: { encrypt, sign }, created }
}

// ------------------------------------------------------------ signatures
export async function signBytes(signPkcs8, bytes) { return new Uint8Array(await subtle().sign(ECDSA, await importSignPrivate(signPkcs8), bytes)) }
export async function verifyBytes(signPemOrSpki, sigRaw, bytes) {
    try {
        const spki = typeof signPemOrSpki === 'string' ? unpem(signPemOrSpki).der : signPemOrSpki
        if (sigRaw.length !== 64) return false
        return await subtle().verify(ECDSA, await importSignPublic(spki), sigRaw, bytes)
    } catch (e) { return false }
}

// ------------------------------------------------------------ statements: the register's canonical form
/** Recursively key-sorted compact JSON: jq -cS, byte for byte, for the values a statement may hold. */
export function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
    if (typeof v === 'number' && !Number.isInteger(v)) throw new Error('statements carry no non-integer numbers (registry/params.json)')
    return JSON.stringify(v)
}
export const canonicalBytes = st => { const { sig, ...rest } = st; return te.encode(canon(rest) + '\n') }
export const statementId = async st => 'sha256:' + await sha256hex(te.encode(canon(st) + '\n'))
export async function signStatement(st, signPkcs8) { const { sig, ...rest } = st; return { ...rest, sig: b64(await signBytes(signPkcs8, canonicalBytes(rest))) } }
export async function verifyStatement(st, signPem) {
    if (!st || typeof st.sig !== 'string') return false
    let raw; try { raw = unb64(st.sig) } catch (e) { return false }
    return verifyBytes(signPem, raw, canonicalBytes(st))
}

// ------------------------------------------------------------ the envelope: sgit's hybrid v2
/**
 * Seal bytes (or text) to a bundle's encryption key. With a signer ({ sign: PKCS#8, fingerprint: signing fp }) it
 * carries s and f exactly as `sgit pki encrypt --fingerprint` does. Returns the .enc text (base64 of the JSON).
 */
export async function seal(bundle, data, signer = null) {
    const pub = await importEncPublic(unpem(bundle.encrypt).der)
    const aes = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
    const iv = random(12)
    const c = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aes, typeof data === 'string' ? te.encode(data) : data))
    const w = new Uint8Array(await subtle().encrypt(RSA, pub, new Uint8Array(await subtle().exportKey('raw', aes))))
    const env = { v: 2, w: b64(w), i: b64(iv), c: b64(c) }
    if (signer) { env.s = b64(await signBytes(signer.sign, c)); env.f = signer.fingerprint }
    return btoa(JSON.stringify(env))
}
/** The envelope as an object, from the .enc text. */
export function parseEnvelope(enc) {
    let env; try { env = JSON.parse(atob(String(enc).trim())) } catch (e) { throw new Error('not an sgit envelope') }
    if (!env || ![1, 2].includes(env.v) || !env.w || !env.i || !env.c) throw new Error('not an sgit envelope')
    return env
}
/**
 * Open an envelope with a private encryption key (PKCS#8). Returns { bytes, text, signed, signer, verified }:
 * verified is true or false only when the signer's bundle was given (signerBundles: [bundle]); otherwise null,
 * which means "not checked" and must never be shown as "forged".
 */
export async function unseal(encPkcs8, enc, signerBundles = []) {
    const env = parseEnvelope(enc)
    let raw
    try { raw = await subtle().decrypt(RSA, await importEncPrivate(encPkcs8), unb64(env.w)) } catch (e) { throw new Error('not sealed to this key') }
    const aes = await subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt'])
    let bytes
    try { bytes = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(env.i), tagLength: 128 }, aes, unb64(env.c))) }
    catch (e) { throw new Error('changed on the way: the ciphertext does not check') }
    const out = { bytes, text: null, signed: !!(env.s && env.f), signer: env.f || null, verified: null }
    try { out.text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch (e) { out.text = null }
    if (out.signed) {
        const b = signerBundles.find(x => x && x.signing_fingerprint === env.f)
        if (b) out.verified = await verifyBytes(b.sign, unb64(env.s), unb64(env.c))
    }
    return out
}
