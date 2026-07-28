/**
 * fb-channel.js — shared signing primitives for the isolated <-> MAIN settings channel.
 *
 * Provides a pure-JS, synchronous HMAC-SHA256 (works on http:// pages too, where
 * crypto.subtle is unavailable) plus a deterministic stable serializer.
 *
 * Loaded first in every content_scripts entry (isolated bridge + MAIN modules) at
 * document_start, and published on globalThis.__fbChannel, an <html> expando, and
 * Document.prototype.__fbChannelGet (see fbPublish for why three carriers).
 *
 * TWO IDENTICAL COPIES EXIST: fb-channel.js (isolated entry) and fb-channel-main.js
 * (MAIN entries). They must stay byte-identical — change one, copy it over the other.
 * The duplication is required, not stylistic: a script path listed in several
 * content_scripts entries can be injected into a document only once, so the isolated
 * entry consumed the single injection and every MAIN module was left without a
 * channel, rejecting all signed settings (Threat Shield silent, Device Security stuck
 * fail-closed with IndexedDB blocked). Distinct paths give each world its own copy.
 * Two copies also mean two independent frozen API instances — that is fine, since the
 * worlds authenticate each other by the shared per-load key, not by object identity.
 *
 * Tamper resistance: this file runs in the MAIN world where the page can later
 * patch primordials (TextEncoder.prototype.encode, Uint8Array.prototype.set,
 * JSON.stringify, Object.keys, Array.prototype.sort, ...). A patched primordial
 * could otherwise observe the secret key during HMAC computation or control the
 * canonical string to forge verification. Therefore ALL natives used at call time
 * are captured here at load time (guaranteed pre-page at document_start), and the
 * exported API object is frozen so the page cannot swap its methods.
 *
 * Exposing the hash/HMAC functions themselves is harmless — security depends on
 * the per-load secret key, which is delivered out-of-band (a short-lived DOM
 * attribute) and never placed on globalThis or inside broadcast messages.
 */
(() => {
  "use strict";

  /**
   * Where the API is published for sibling files of the same world.
   *
   * `globalThis` is the normal carrier. The two DOM carriers are belt-and-braces
   * for hosts where scripts of one content_scripts entry do not share a global
   * object: `<html>` expandos cover a shared DOM wrapper, and the
   * `Document.prototype` getter covers the case where each script gets its own
   * wrapper but prototypes stay shared (the surface device-security's IndexedDB
   * shims already rely on).
   *
   * In the MAIN world the DOM carriers are reachable by the page — the same
   * trade-off this file already documents: the primitives are not secret, security
   * rests on the per-load key. All properties are non-writable and
   * non-configurable so the page cannot swap in an API that forges signatures.
   */
  const DOM_PROP = "__fbChannelApi";
  const PROTO_GETTER = "__fbChannelGet";

  function fbFindChannel() {
    try {
      if (typeof globalThis !== "undefined" && globalThis.__fbChannel) return globalThis.__fbChannel;
    } catch (_e) {}
    try {
      const el = typeof document !== "undefined" && document ? document.documentElement : null;
      if (el && el[DOM_PROP]) return el[DOM_PROP];
    } catch (_e) {}
    try {
      if (typeof Document !== "undefined" && Document.prototype && typeof Document.prototype[PROTO_GETTER] === "function") {
        return Document.prototype[PROTO_GETTER]();
      }
    } catch (_e) {}
    return null;
  }

  function fbPublish(value) {
    const desc = { value, configurable: false, writable: false, enumerable: false };
    try {
      if (typeof globalThis !== "undefined" && !globalThis.__fbChannel) {
        Object.defineProperty(globalThis, "__fbChannel", desc);
      }
    } catch (_e) {
      try {
        globalThis.__fbChannel = value;
      } catch (_e2) {}
    }
    try {
      const el = typeof document !== "undefined" && document ? document.documentElement : null;
      if (el && !el[DOM_PROP]) Object.defineProperty(el, DOM_PROP, desc);
    } catch (_e) {}
    // Reliable cross-file carrier (see comment above). Closure holds `value` so the
    // getter always returns the frozen API installed by the first publisher.
    try {
      if (typeof Document !== "undefined" && Document.prototype && !Document.prototype[PROTO_GETTER]) {
        const held = value;
        Object.defineProperty(Document.prototype, PROTO_GETTER, {
          value: function fbChannelGet() {
            return held;
          },
          configurable: false,
          writable: false,
          enumerable: false,
        });
      }
    } catch (_e) {}
  }

  const existing = fbFindChannel();
  if (existing) {
    fbPublish(existing);
    return;
  }

  // --- Captured primordials (genuine at document_start) ---
  const U8 = Uint8Array;
  const U32 = Uint32Array;
  const _floor = Math.floor;
  const _isFinite = Number.isFinite;
  const _isArray = Array.isArray;
  const _objectKeys = Object.keys;
  const _jsonStringify = JSON.stringify;
  const _arraySort = Array.prototype.sort;
  const _charCodeAt = String.prototype.charCodeAt;
  const _String = String;
  const _freeze = Object.freeze;
  const _crypto = typeof crypto !== "undefined" ? crypto : null;
  const _getRandomValues = _crypto && _crypto.getRandomValues ? _crypto.getRandomValues.bind(_crypto) : null;
  const _encode = (() => {
    try {
      if (typeof TextEncoder !== "undefined") {
        const enc = new TextEncoder();
        return TextEncoder.prototype.encode.bind(enc);
      }
    } catch (_e) {}
    return null;
  })();
  // Hex lookup table built at load — avoids Number.prototype.toString/padStart at call time.
  const HEX = (() => {
    const t = new Array(256);
    for (let i = 0; i < 256; i++) {
      t[i] = (i < 16 ? "0" : "") + i.toString(16);
    }
    return t;
  })();

  const K = new U32([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  /**
   * @param {Uint8Array} msg
   * @param {number} msgLen explicit length (avoids the patchable TypedArray length getter)
   * @returns {Uint8Array} 32-byte digest
   */
  function sha256(msg, msgLen) {
    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    const l = msgLen;
    const bitLen = l * 8;
    const withOne = l + 1;
    const pad = (56 - (withOne % 64) + 64) % 64;
    const total = withOne + pad + 8;
    const buf = new U8(total);
    // Index-based copy: no prototype methods involved, nothing for the page to patch.
    for (let i = 0; i < l; i++) buf[i] = msg[i] & 0xff;
    buf[l] = 0x80;

    const hi = _floor(bitLen / 0x100000000) >>> 0;
    const lo = bitLen >>> 0;
    buf[total - 8] = (hi >>> 24) & 0xff;
    buf[total - 7] = (hi >>> 16) & 0xff;
    buf[total - 6] = (hi >>> 8) & 0xff;
    buf[total - 5] = hi & 0xff;
    buf[total - 4] = (lo >>> 24) & 0xff;
    buf[total - 3] = (lo >>> 16) & 0xff;
    buf[total - 2] = (lo >>> 8) & 0xff;
    buf[total - 1] = lo & 0xff;

    const w = new U32(64);

    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        w[i] = ((buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3]) >>> 0;
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    const out = new U8(32);
    const hs = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 8; i++) {
      out[i * 4] = (hs[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
      out[i * 4 + 3] = hs[i] & 0xff;
    }
    return out;
  }

  /** UTF-8 encode using captured natives only. Returns { bytes, len }. */
  function utf8Bytes(str) {
    const s = typeof str === "string" ? str : _String(str == null ? "" : str);
    if (_encode) {
      const bytes = _encode(s);
      // TextEncoder.encode returns a fresh genuine Uint8Array; compute length
      // explicitly from the string to avoid the patchable length getter.
      let len = 0;
      for (let i = 0; i < s.length; i++) {
        const c = _charCodeAt.call(s, i);
        if (c < 0x80) len += 1;
        else if (c < 0x800) len += 2;
        else if (c >= 0xd800 && c <= 0xdbff) {
          // surrogate pair -> 4 bytes total, skip low surrogate
          len += 4;
          i++;
        } else len += 3;
      }
      return { bytes, len };
    }
    // Manual fallback (no TextEncoder).
    const out = [];
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      let c = _charCodeAt.call(s, i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        const c2 = _charCodeAt.call(s, i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) out[n++] = c;
      else if (c < 0x800) {
        out[n++] = 0xc0 | (c >> 6);
        out[n++] = 0x80 | (c & 0x3f);
      } else if (c < 0x10000) {
        out[n++] = 0xe0 | (c >> 12);
        out[n++] = 0x80 | ((c >> 6) & 0x3f);
        out[n++] = 0x80 | (c & 0x3f);
      } else {
        out[n++] = 0xf0 | (c >> 18);
        out[n++] = 0x80 | ((c >> 12) & 0x3f);
        out[n++] = 0x80 | ((c >> 6) & 0x3f);
        out[n++] = 0x80 | (c & 0x3f);
      }
    }
    const bytes = new U8(n);
    for (let i = 0; i < n; i++) bytes[i] = out[i];
    return { bytes, len: n };
  }

  function toHex(bytes, len) {
    let s = "";
    for (let i = 0; i < len; i++) s += HEX[bytes[i] & 0xff];
    return s;
  }

  /** HMAC-SHA256 over UTF-8 strings, returns lowercase hex (64 chars). */
  function hmacSha256Hex(keyStr, msgStr) {
    const BLOCK = 64;
    const keyEnc = utf8Bytes(keyStr);
    let key = keyEnc.bytes;
    let keyLen = keyEnc.len;
    if (keyLen > BLOCK) {
      key = sha256(key, keyLen);
      keyLen = 32;
    }
    const ipadded = new U8(BLOCK);
    const opadded = new U8(BLOCK);
    for (let i = 0; i < BLOCK; i++) {
      const kb = i < keyLen ? key[i] & 0xff : 0;
      ipadded[i] = kb ^ 0x36;
      opadded[i] = kb ^ 0x5c;
    }
    const msgEnc = utf8Bytes(msgStr);
    const innerInput = new U8(BLOCK + msgEnc.len);
    for (let i = 0; i < BLOCK; i++) innerInput[i] = ipadded[i];
    for (let i = 0; i < msgEnc.len; i++) innerInput[BLOCK + i] = msgEnc.bytes[i] & 0xff;
    const inner = sha256(innerInput, BLOCK + msgEnc.len);
    const outerInput = new U8(BLOCK + 32);
    for (let i = 0; i < BLOCK; i++) outerInput[i] = opadded[i];
    for (let i = 0; i < 32; i++) outerInput[BLOCK + i] = inner[i];
    return toHex(sha256(outerInput, BLOCK + 32), 32);
  }

  /**
   * Deterministic JSON-like serialization (sorted object keys, recursive) using
   * only captured natives, so the page cannot influence the canonical string by
   * patching JSON.stringify / Object.keys / Array.prototype.sort etc.
   * Skips own properties named `skipKey` at any depth. Non-finite numbers
   * serialize to "null"; undefined/function/symbol values are omitted (null
   * inside arrays) — identical on signer and verifier.
   */
  function stableStringify(value, skipKey) {
    function ser(v) {
      if (v === null) return "null";
      const t = typeof v;
      if (t === "number") return _isFinite(v) ? _String(v) : "null";
      if (t === "boolean") return v ? "true" : "false";
      if (t === "string") return _jsonStringify(v);
      if (t === "undefined" || t === "function" || t === "symbol") return undefined;
      if (_isArray(v)) {
        let s = "[";
        for (let i = 0; i < v.length; i++) {
          const part = ser(v[i]);
          if (i > 0) s += ",";
          s += part === undefined ? "null" : part;
        }
        return s + "]";
      }
      if (t === "object") {
        const keys = _objectKeys(v);
        _arraySort.call(keys);
        let s = "{";
        let first = true;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (k === skipKey) continue;
          const part = ser(v[k]);
          if (part === undefined) continue;
          if (!first) s += ",";
          first = false;
          s += _jsonStringify(k) + ":" + part;
        }
        return s + "}";
      }
      return undefined;
    }
    const out = ser(value);
    return out === undefined ? "null" : out;
  }

  function randomHexKey(byteLen) {
    const n = typeof byteLen === "number" && byteLen > 0 ? byteLen : 32;
    try {
      if (_getRandomValues) {
        const buf = new U8(n);
        _getRandomValues(buf);
        return toHex(buf, n);
      }
    } catch (_e) {}
    // Last-resort fallback (non-cryptographic) — keeps the channel functional.
    let s = "";
    for (let i = 0; i < n; i++) s += HEX[_floor(Math.random() * 256) & 0xff];
    return s;
  }

  const api = {
    v: 1,
    hmacSha256Hex,
    stableStringify,
    randomHexKey,
  };
  // Freeze so the page cannot swap methods on the shared object to steal the key.
  try {
    _freeze(api);
  } catch (_e) {}

  fbPublish(api);
})();
