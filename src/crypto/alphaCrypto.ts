import { CRYPTO_SALT } from "../config/constants.ts";

function rotr(n: number, s: number): number {
  return (n >>> s) | (n << (32 - s));
}

function rotl(a: number, b: number): number {
  return ((a << b) | (a >>> (32 - b))) | 0;
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0x0bef9a3f, 0xc67178f2
];

export function sha256(str: string): Uint8Array {
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const b: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) b.push(c);
    else if (c < 2048) { b.push((c >> 6) | 192); b.push((c & 63) | 128); }
    else { b.push((c >> 12) | 224); b.push(((c >> 6) & 63) | 128); b.push((c & 63) | 128); }
  }
  const l = b.length * 8;
  b.push(0x80);
  while ((b.length % 64) !== 56) b.push(0);
  for (let i = 7; i >= 0; i--) b.push((l >>> (i * 8)) & 255);
  for (let i = 0; i < b.length; i += 64) {
    const w = new Int32Array(64);
    for (let j = 0; j < 16; j++) {
      w[j] = (b[i + j * 4] << 24) | (b[i + j * 4 + 1] << 16) | (b[i + j * 4 + 2] << 8) | b[i + j * 4 + 3];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = H[0], e = H[1], c_ = H[2], d = H[3], e_ = H[4], f = H[5], g = H[6], h = H[7];
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e_, 6) ^ rotr(e_, 11) ^ rotr(e_, 25);
      const ch = (e_ & f) ^ ((~e_) & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & e) ^ (a & c_) ^ (e & c_);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e_; e_ = (d + temp1) | 0;
      d = c_; c_ = e; e = a; a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + e) | 0; H[2] = (H[2] + c_) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e_) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const res = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    res[i * 4] = (H[i] >>> 24) & 255;
    res[i * 4 + 1] = (H[i] >>> 16) & 255;
    res[i * 4 + 2] = (H[i] >>> 8) & 255;
    res[i * 4 + 3] = H[i] & 255;
  }
  return res;
}

function chacha20(keyBytes: Uint8Array, nonceBytes: Uint8Array, counter: number, inputBytes: Uint8Array): Uint8Array {
  function qr(s: Int32Array, a: number, b: number, c: number, d: number) {
    s[a] = (s[a] + s[b]) | 0; s[d] = rotl(s[d] ^ s[a], 16);
    s[c] = (s[c] + s[d]) | 0; s[b] = rotl(s[b] ^ s[c], 12);
    s[a] = (s[a] + s[b]) | 0; s[d] = rotl(s[d] ^ s[a], 8);
    s[c] = (s[c] + s[d]) | 0; s[b] = rotl(s[b] ^ s[c], 7);
  }
  const key = new Int32Array(8);
  for (let i = 0; i < 8; i++) {
    key[i] = keyBytes[i * 4] | (keyBytes[i * 4 + 1] << 8) | (keyBytes[i * 4 + 2] << 16) | (keyBytes[i * 4 + 3] << 24);
  }
  const nonce = new Int32Array(3);
  for (let i = 0; i < 3; i++) {
    nonce[i] = nonceBytes[i * 4] | (nonceBytes[i * 4 + 1] << 8) | (nonceBytes[i * 4 + 2] << 16) | (nonceBytes[i * 4 + 3] << 24);
  }
  const output = new Uint8Array(inputBytes.length);
  const state = new Int32Array(16);
  const working = new Int32Array(16);
  const block = new Uint8Array(64);
  let pos = 0;
  let currentCounter = counter;
  while (pos < inputBytes.length) {
    state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574;
    for (let i = 0; i < 8; i++) state[4 + i] = key[i];
    state[12] = currentCounter;
    state[13] = nonce[0]; state[14] = nonce[1]; state[15] = nonce[2];
    for (let i = 0; i < 16; i++) working[i] = state[i];
    for (let i = 0; i < 10; i++) {
      qr(working, 0, 4, 8, 12); qr(working, 1, 5, 9, 13); qr(working, 2, 6, 10, 14); qr(working, 3, 7, 11, 15);
      qr(working, 0, 5, 10, 15); qr(working, 1, 6, 11, 12); qr(working, 2, 7, 8, 13); qr(working, 3, 4, 9, 14);
    }
    for (let i = 0; i < 16; i++) {
      const val = (working[i] + state[i]) | 0;
      block[i * 4] = val & 255;
      block[i * 4 + 1] = (val >>> 8) & 255;
      block[i * 4 + 2] = (val >>> 16) & 255;
      block[i * 4 + 3] = (val >>> 24) & 255;
    }
    const take = Math.min(64, inputBytes.length - pos);
    for (let i = 0; i < take; i++) output[pos + i] = inputBytes[pos + i] ^ block[i];
    pos += take;
    currentCounter++;
  }
  return output;
}

export function utf8Encode(s: string): Uint8Array {
  const b: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) b.push(c);
    else if (c < 2048) { b.push((c >> 6) | 192); b.push((c & 63) | 128); }
    else { b.push((c >> 12) | 224); b.push(((c >> 6) & 63) | 128); b.push((c & 63) | 128); }
  }
  return new Uint8Array(b);
}

export function utf8Decode(b: Uint8Array): string {
  let s = "";
  let i = 0;
  while (i < b.length) {
    const c = b[i++];
    if (c < 128) s += String.fromCharCode(c);
    else if (c > 191 && c < 224) s += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
    else s += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
  }
  return s;
}

export function toHex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) {
    const h = b[i].toString(16);
    s += (h.length < 2 ? "0" : "") + h;
  }
  return s;
}

export function fromHex(h: string): Uint8Array {
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
  return b;
}

export function deriveKey(pin: string): Uint8Array {
  return sha256(`${CRYPTO_SALT}::${pin}::${CRYPTO_SALT}`);
}

export const AlphaCrypto = {
  encrypt(text: string, pin: string): string {
    const key = deriveKey(pin);
    const nonce = new Uint8Array(12);
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      globalThis.crypto.getRandomValues(nonce);
    } else {
      for (let i = 0; i < 12; i++) nonce[i] = (Math.random() * 256) | 0;
    }
    const hashHeader = toHex(sha256("CHECK::" + text).slice(0, 8));
    const payload = utf8Encode(hashHeader + ":::" + text);
    const enc = chacha20(key, nonce, 1, payload);
    return toHex(nonce) + ":" + toHex(enc);
  },

  decrypt(ciphertext: string, pin: string): string {
    const parts = ciphertext.split(":");
    if (parts.length !== 2) throw new Error("Invalid format");
    const nonce = fromHex(parts[0]);
    const enc = fromHex(parts[1]);
    const key = deriveKey(pin);
    const dec = chacha20(key, nonce, 1, enc);
    const text = utf8Decode(dec);
    const sepIdx = text.indexOf(":::");
    if (sepIdx === -1) throw new Error("Decryption failed");
    const hashHeader = text.slice(0, sepIdx);
    const original = text.slice(sepIdx + 3);
    const expectedHash = toHex(sha256("CHECK::" + original).slice(0, 8));
    if (hashHeader !== expectedHash) throw new Error("Decryption failed");
    return original;
  }
};
