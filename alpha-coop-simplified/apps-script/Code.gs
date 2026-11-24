/**
 * ============================================================================
 * ALPHA COOPERATIVE DESK — ENCRYPTED GOOGLE APPS SCRIPT API
 * ============================================================================
 * Security & Schema Resilience:
 * - Reads OFFICE_PIN from ScriptProperties (`OFFICE_PIN`) so credentials do not
 *   need to live in source; falls back to "2026" if not yet configured.
 * - Resolves columns by header name (case/punctuation-insensitive), so adding,
 *   removing, or reordering columns in the Google Sheet never shifts values.
 * - Supports both the legacy sheet layout and the 17-column layout:
 *   s/n | Name | FormNo | Empl. No | Date | Admin Fee | Entrance Fee |
 *   Shares Savings | Thrift Savings | Normal Loan | Interest | Commodity Loan |
 *   LAND Loan | Land Subscription | Fence Subscription |
 *   PURCHASE/ASSET FINANCE | Mortgage Subscription
 * - Supports both `doPost` (preferred so PIN is not in URL query logs) and
 *   `doGet` for backward compatibility, plus failed-attempt rate limiting via
 *   CacheService.
 * ============================================================================
 */

function getOfficePin() {
  try {
    var propPin = PropertiesService.getScriptProperties().getProperty('OFFICE_PIN');
    if (propPin && String(propPin).trim()) {
      return String(propPin).trim();
    }
  } catch (_) {}
  return "2026";
}

// ----------------------------------------------------------------------------
// CRYPTOGRAPHIC ENGINE (ChaCha20 + SHA-256 in pure JS)
// ----------------------------------------------------------------------------
const AlphaCrypto = (function() {
  function sha256(str) {
    function rotr(n, s) { return (n >>> s) | (n << (32 - s)); }
    var K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0x0bef9a3f,0xc67178f2
    ];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var b = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 128) b.push(c);
      else if (c < 2048) { b.push((c >> 6) | 192); b.push((c & 63) | 128); }
      else { b.push((c >> 12) | 224); b.push(((c >> 6) & 63) | 128); b.push((c & 63) | 128); }
    }
    var l = b.length * 8;
    b.push(0x80);
    while ((b.length % 64) !== 56) b.push(0);
    for (var i = 7; i >= 0; i--) b.push((l >>> (i * 8)) & 255);
    for (var i = 0; i < b.length; i += 64) {
      var w = new Int32Array(64);
      for (var j = 0; j < 16; j++) {
        w[j] = (b[i+j*4]<<24) | (b[i+j*4+1]<<16) | (b[i+j*4+2]<<8) | (b[i+j*4+3]);
      }
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(w[j-15], 7) ^ rotr(w[j-15], 18) ^ (w[j-15] >>> 3);
        var s1 = rotr(w[j-2], 17) ^ rotr(w[j-2], 19) ^ (w[j-2] >>> 10);
        w[j] = (w[j-16] + s0 + w[j-7] + s1) | 0;
      }
      var a = H[0], e = H[1], c_ = H[2], d = H[3], e_ = H[4], f = H[5], g = H[6], h = H[7];
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(e_, 6) ^ rotr(e_, 11) ^ rotr(e_, 25);
        var ch = (e_ & f) ^ ((~e_) & g);
        var temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & e) ^ (a & c_) ^ (e & c_);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e_; e_ = (d + temp1) | 0;
        d = c_; c_ = e; e = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + e) | 0; H[2] = (H[2] + c_) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e_) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var res = new Uint8Array(32);
    for (var i = 0; i < 8; i++) {
      res[i*4] = (H[i] >>> 24) & 255; res[i*4+1] = (H[i] >>> 16) & 255;
      res[i*4+2] = (H[i] >>> 8) & 255; res[i*4+3] = H[i] & 255;
    }
    return res;
  }

  function chacha20(keyBytes, nonceBytes, counter, inputBytes) {
    function rotl(a, b) { return ((a << b) | (a >>> (32 - b))) | 0; }
    function qr(s, a, b, c, d) {
      s[a] = (s[a] + s[b]) | 0; s[d] = rotl(s[d] ^ s[a], 16);
      s[c] = (s[c] + s[d]) | 0; s[b] = rotl(s[b] ^ s[c], 12);
      s[a] = (s[a] + s[b]) | 0; s[d] = rotl(s[d] ^ s[a], 8);
      s[c] = (s[c] + s[d]) | 0; s[b] = rotl(s[b] ^ s[c], 7);
    }
    var key = new Int32Array(8);
    for (var i = 0; i < 8; i++) {
      key[i] = keyBytes[i*4] | (keyBytes[i*4+1] << 8) | (keyBytes[i*4+2] << 16) | (keyBytes[i*4+3] << 24);
    }
    var nonce = new Int32Array(3);
    for (var i = 0; i < 3; i++) {
      nonce[i] = nonceBytes[i*4] | (nonceBytes[i*4+1] << 8) | (nonceBytes[i*4+2] << 16) | (nonceBytes[i*4+3] << 24);
    }
    var output = new Uint8Array(inputBytes.length);
    var state = new Int32Array(16);
    var working = new Int32Array(16);
    var block = new Uint8Array(64);
    var pos = 0;
    var currentCounter = counter;
    while (pos < inputBytes.length) {
      state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574;
      for (var i = 0; i < 8; i++) state[4 + i] = key[i];
      state[12] = currentCounter;
      state[13] = nonce[0]; state[14] = nonce[1]; state[15] = nonce[2];
      for (var i = 0; i < 16; i++) working[i] = state[i];
      for (var i = 0; i < 10; i++) {
        qr(working, 0, 4, 8, 12); qr(working, 1, 5, 9, 13); qr(working, 2, 6, 10, 14); qr(working, 3, 7, 11, 15);
        qr(working, 0, 5, 10, 15); qr(working, 1, 6, 11, 12); qr(working, 2, 7, 8, 13); qr(working, 3, 4, 9, 14);
      }
      for (var i = 0; i < 16; i++) {
        var val = (working[i] + state[i]) | 0;
        block[i*4] = val & 255; block[i*4+1] = (val >>> 8) & 255;
        block[i*4+2] = (val >>> 16) & 255; block[i*4+3] = (val >>> 24) & 255;
      }
      var take = Math.min(64, inputBytes.length - pos);
      for (var i = 0; i < take; i++) output[pos + i] = inputBytes[pos + i] ^ block[i];
      pos += take;
      currentCounter++;
    }
    return output;
  }

  function utf8Encode(s) {
    var b = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) b.push(c);
      else if (c < 2048) { b.push((c >> 6) | 192); b.push((c & 63) | 128); }
      else { b.push((c >> 12) | 224); b.push(((c >> 6) & 63) | 128); b.push((c & 63) | 128); }
    }
    return new Uint8Array(b);
  }

  function utf8Decode(b) {
    var s = '';
    var i = 0;
    while (i < b.length) {
      var c = b[i++];
      if (c < 128) s += String.fromCharCode(c);
      else if (c > 191 && c < 224) s += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
      else s += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    }
    return s;
  }

  function toHex(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) {
      var h = b[i].toString(16);
      s += (h.length < 2 ? '0' : '') + h;
    }
    return s;
  }

  function fromHex(h) {
    var b = new Uint8Array(h.length / 2);
    for (var i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i*2, 2), 16);
    return b;
  }

  const SALT = 'AlphaCoop@Lagos#2026';

  function deriveKey(pin) {
    return sha256(SALT + '::' + pin + '::' + SALT);
  }

  return {
    encrypt: function(text, pin) {
      var key = deriveKey(pin);
      var nonce = new Uint8Array(12);
      for (var i = 0; i < 12; i++) nonce[i] = (Math.random() * 256) | 0;
      var hashHeader = toHex(sha256('CHECK::' + text).slice(0, 8));
      var payload = utf8Encode(hashHeader + ':::' + text);
      var enc = chacha20(key, nonce, 1, payload);
      return toHex(nonce) + ':' + toHex(enc);
    },
    decrypt: function(ciphertext, pin) {
      var parts = ciphertext.split(':');
      if (parts.length !== 2) throw new Error('Invalid format');
      var nonce = fromHex(parts[0]);
      var enc = fromHex(parts[1]);
      var key = deriveKey(pin);
      var dec = chacha20(key, nonce, 1, enc);
      var text = utf8Decode(dec);
      var sepIdx = text.indexOf(':::');
      if (sepIdx === -1) throw new Error('Decryption failed');
      var hashHeader = text.slice(0, sepIdx);
      var original = text.slice(sepIdx + 3);
      var expectedHash = toHex(sha256('CHECK::' + original).slice(0, 8));
      if (hashHeader !== expectedHash) throw new Error('Decryption failed');
      return original;
    }
  };
})();

// ----------------------------------------------------------------------------
// DATA & HEADER RESOLUTION HELPERS
// ----------------------------------------------------------------------------
function parseCurrency(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  var str = String(val).replace(/[^0-9.-]/g, '');
  var num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function normalizeHeaderKey(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildColumnMap(headerRow) {
  var rawMap = {};
  for (var idx = 0; idx < headerRow.length; idx++) {
    var clean = normalizeHeaderKey(headerRow[idx]);
    if (clean && rawMap[clean] === undefined) {
      rawMap[clean] = idx;
    }
  }

  function findCol(candidates, fallbackIdx) {
    for (var i = 0; i < candidates.length; i++) {
      var key = normalizeHeaderKey(candidates[i]);
      if (rawMap[key] !== undefined) return rawMap[key];
    }
    return fallbackIdx;
  }

  return {
    name: findCol(['Name', 'Member Name'], 1),
    formNo: findCol(['FormNo', 'Form No', 'Form'], 2),
    staff: findCol(['Empl. No', 'Empl No', 'Staff ID', 'staffId', 'staff'], 3),
    date: findCol(['Date', 'As At', 'asAt'], 4),
    adminFee: findCol(['Admin Fee'], -1),
    entranceFee: findCol(['Entrance Fee'], -1),
    sharesSavings: findCol(['Shares Savings', 'Share Savings', 'Shares'], -1),
    savings: findCol(['Thrift Savings', 'Savings', 'Thrift'], 6),
    loan: findCol(['Normal Loan', 'Loan', 'Normal'], 7),
    interest: findCol(['Interest'], 8),
    commodity: findCol(['Commodity Loan', 'Special Loan', 'Commodity'], -1),
    landLoan: findCol(['LAND Loan', 'Land Loan'], -1),
    landSub: findCol(['Land Subscription'], -1),
    fenceSub: findCol(['Fence Subscription'], -1),
    purchase: findCol([
      'PURCHASE/ASSET FINANCE',
      'Purchase/Asset Finance',
      'Purchase / Asset Finance',
      'Asset Finance',
      'Purchase Loan',
      'Purchase'
    ], 9),
    mortgageSub: findCol(['Mortgage Subscription'], -1)
  };
}

function cellAt(row, idx) {
  return (idx !== undefined && idx >= 0 && idx < row.length) ? row[idx] : '';
}

function mapRowToMember(row, cols) {
  var empl = String(cellAt(row, cols.staff) || '').trim();
  var name = String(cellAt(row, cols.name) || '').trim();
  var form = String(cellAt(row, cols.formNo) || '').trim();
  var rawDate = cellAt(row, cols.date);
  var dateStr = '';
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone() || 'Africa/Lagos', 'MMMM d, yyyy');
  } else if (rawDate) {
    dateStr = String(rawDate).trim();
  }

  var purchaseVal = parseCurrency(cellAt(row, cols.purchase));
  var commodityPrincipal = parseCurrency(cellAt(row, cols.commodity));
  var interestVal = parseCurrency(cellAt(row, cols.interest));
  var commodityVal = commodityPrincipal + interestVal;

  return {
    staff: empl,
    staffId: empl,
    name: name,
    formNo: form,
    date: dateStr,
    savings: parseCurrency(cellAt(row, cols.savings)),
    loan: parseCurrency(cellAt(row, cols.loan)),
    interest: interestVal,
    commodityPrincipal: commodityPrincipal,
    commodityInterest: interestVal,
    commodity: commodityVal,
    commodityLoan: commodityVal,
    purchase: purchaseVal,
    purchaseLoan: purchaseVal,
    sharesSavings: parseCurrency(cellAt(row, cols.sharesSavings)),
    landLoan: parseCurrency(cellAt(row, cols.landLoan)),
    landSubscription: parseCurrency(cellAt(row, cols.landSub)),
    fenceSubscription: parseCurrency(cellAt(row, cols.fenceSub)),
    mortgageSubscription: parseCurrency(cellAt(row, cols.mortgageSub))
  };
}

function getLedgerData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Sheet2') || ss.getSheetByName('Members_Ledger') || ss.getActiveSheet();
  if (!sheet) return null;
  return sheet.getDataRange().getValues();
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------------------
// REQUEST HANDLER (Shared by doGet and doPost)
// ----------------------------------------------------------------------------
function handleRequest(params) {
  try {
    var cache = CacheService.getScriptCache();
    var failCount = parseInt(cache.get('pin_fail_count') || '0', 10);
    if (failCount >= 10) {
      return createJsonResponse({
        status: "rate_limited",
        message: "Too many failed PIN attempts. Try again in 15 minutes."
      });
    }

    var expectedPin = getOfficePin();
    var pin = String(params.pin || '').trim();
    if (!pin || pin !== expectedPin) {
      try { cache.put('pin_fail_count', String(failCount + 1), 900); } catch (_) {}
      return createJsonResponse({ status: "invalid_pin", message: "Unauthorized: Valid office PIN required." });
    }

    // ------------------------------------------------------------------------
    // 1. BULK PREFETCH (Encrypted in transit)
    // ------------------------------------------------------------------------
    if (params.action === 'all' || params.all === '1' || params.prefetch === '1') {
      var cachedEncrypted = cache.get('all_members_enc_v4');
      if (cachedEncrypted) {
        return createJsonResponse({ status: "success", encrypted: true, payload: cachedEncrypted });
      }

      var data = getLedgerData();
      if (!data || data.length < 2) {
        return createJsonResponse({ status: "error", message: "No member data in sheet." });
      }

      var cols = buildColumnMap(data[0]);
      var members = [];
      for (var i = 1; i < data.length; i++) {
        var member = mapRowToMember(data[i], cols);
        if (member.staff || member.name) {
          members.push(member);
        }
      }

      var encryptedPayload = AlphaCrypto.encrypt(JSON.stringify(members), expectedPin);
      try { cache.put('all_members_enc_v4', encryptedPayload, 1200); } catch (_) {}
      return createJsonResponse({ status: "success", encrypted: true, payload: encryptedPayload });
    }

    // ------------------------------------------------------------------------
    // 2. SINGLE SEARCH (Encrypted return)
    // ------------------------------------------------------------------------
    var staffQuery = String(params.staffId || params.emplNo || params.formNo || params.query || params.id || '').trim();
    if (!staffQuery) {
      return createJsonResponse({ status: "empty_query", message: "Please provide a Staff ID or Name." });
    }

    var cleanQuery = staffQuery.toLowerCase();
    var queryDigits = cleanQuery.replace(/[^0-9]/g, '');

    var data = getLedgerData();
    if (!data || data.length < 2) {
      return createJsonResponse({ status: "error", message: "No ledger records found." });
    }

    var cols = buildColumnMap(data[0]);
    var matchedMember = null;
    for (var i = 1; i < data.length; i++) {
      var candidate = mapRowToMember(data[i], cols);
      var lowerEmpl = candidate.staff.toLowerCase();
      var lowerForm = candidate.formNo.toLowerCase();
      var lowerName = candidate.name.toLowerCase();
      var emplDigits = lowerEmpl.replace(/[^0-9]/g, '');

      if (lowerEmpl === cleanQuery || lowerForm === cleanQuery || lowerName === cleanQuery) {
        matchedMember = candidate;
        break;
      }
      if (lowerEmpl.indexOf(cleanQuery) !== -1) {
        matchedMember = candidate;
        break;
      }
      if (queryDigits.length >= 2 && emplDigits) {
        if (emplDigits === queryDigits || emplDigits.endsWith(queryDigits) || parseInt(emplDigits, 10) === parseInt(queryDigits, 10)) {
          matchedMember = candidate;
          break;
        }
      }
      if (lowerName.indexOf(cleanQuery) !== -1) {
        matchedMember = candidate;
        break;
      }
    }

    if (!matchedMember) {
      return createJsonResponse({
        status: "not_found",
        message: 'Member "' + staffQuery + '" not found'
      });
    }

    var encryptedRecord = AlphaCrypto.encrypt(JSON.stringify(matchedMember), expectedPin);
    return createJsonResponse({
      status: "success",
      encrypted: true,
      payload: encryptedRecord
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Error: " + err.toString()
    });
  }
}

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  return handleRequest(params);
}

function doPost(e) {
  var params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      if (body && typeof body === 'object') {
        Object.assign(params, body);
      }
    } catch (_) {}
  }
  return handleRequest(params);
}

