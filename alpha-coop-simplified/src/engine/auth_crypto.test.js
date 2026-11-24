import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyPinDigest } from "../ui/auth.js";
import { AlphaCrypto } from "../crypto/alphaCrypto.js";

test("Office PIN 2026 is accepted and wrong PINs are rejected", () => {
  assert.equal(verifyPinDigest("2026"), true);
  assert.equal(verifyPinDigest(" 2026 "), true);
  assert.equal(verifyPinDigest("2025"), false);
  assert.equal(verifyPinDigest(""), false);
});

test("Apps Script payload encryption is decryptable by the browser client", () => {
  const source = readFileSync(new URL("../../apps-script/Code.gs", import.meta.url), "utf8");
  const start = source.indexOf("const AlphaCrypto");
  const end = source.indexOf("// DATA & HEADER RESOLUTION HELPERS");
  const ServerCrypto = new Function(`${source.slice(start, end)}; return AlphaCrypto;`)();

  const payload = JSON.stringify([{ staff: "LIRS/9997", name: "Olusegun Demol", savings: 55000 }]);
  const cipher = ServerCrypto.encrypt(payload, "2026");
  assert.equal(AlphaCrypto.decrypt(cipher, "2026"), payload);
  assert.throws(() => AlphaCrypto.decrypt(cipher, "1111"));
});

