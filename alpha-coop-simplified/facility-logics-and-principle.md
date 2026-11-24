# Alpha Coop Cooperative Desk: Full Logic & Principles Specification

> Source of truth: `alpha-coop-simplified/index.html` + `alpha-coop-simplified/src/**`.
> `index-old.html` and `script-original.js` are **obsolete** and must be ignored. They are 2–3 revisions behind and missing logic.

---

## 1. What the app is

This is an internal, PIN-protected **office desk tool** for a Nigerian staff cooperative (currency ₦, staff IDs like `LIRS/9999`). Cooperative officers use it to:

1. Look up a member from a Google Sheets ledger by Staff ID or name.
2. Appraise one of three **facilities**:
   - **Cash Loan** (`cash`): money paid out to the member, repaid through payroll.
   - **Purchase / Asset Finance** (`purchase`): the coop buys an item for the member, who repays it with 10% interest.
   - **Savings Withdrawal** (`withdrawal`): the member exits or withdraws savings, and debts are settled from those savings.
3. See a pass/fail audit against the two core policies, a counter-offer ("proposable amount") when the request fails, and a WhatsApp-ready text report.

Tech: vanilla HTML + CSS + ES modules (no framework, no build step). Entry point is `<script type="module" src="./src/main.js">`. The tests use `node:test` (`node --test src/engine`).

---

## 2. File architecture

| File | Responsibility |
|---|---|
| `src/config/constants.js` | Sheet API URL, PIN (`"2026"`), crypto salt, deduction rates (0.40 default, 0.50 swap), default monthly savings (10,000), inactivity timeout (1h) |
| `src/engine/underwriting.js` | **Pure** calculation engine (no DOM). `getTieredDuration()`, `calculateUnderwriting()` |
| `src/state/appState.js` | Central mutable state + pub/sub + session appraisal history |
| `src/services/ledgerService.js` | Ledger cache, Google Sheets fetch, fuzzy member search, profile extraction |
| `src/crypto/alphaCrypto.js` | Hand-rolled SHA-256 + ChaCha20 used to decrypt the sheet payload and cache |
| `src/main.js` | Orchestrator: reads the DOM, calls the engine, wires events, exposes `window.*` bridge functions for inline `onclick` |
| `src/ui/results.js` | Renders the empty state, member profile card and appraisal result panel |
| `src/ui/share.js` | Builds WhatsApp/clipboard text, plus share and copy helpers |
| `src/ui/auth.js` | PIN lock screen, session unlock, 1-hour inactivity auto-lock |
| `src/ui/historyDrawer.js` | Side drawer listing past appraisals in the session, with restore and delete |
| `src/ui/scenarios.js` + `src/data/scenarios.js` | Quick-scenario chips per facility (test presets) |
| `src/ui/onboarding.js` | 10-step coachmark tour (key `alpha_coop_onboarded`) |
| `src/ui/theme.js` | Dark/light theme (`localStorage.alpha_theme`, default dark) |
| `src/utils/formatters.js` | Number parsing (with math expressions), ₦ formatting, dates, fuzzy key lookup |
| `src/utils/dom.js` | Field get/set helpers and money-input behaviour |

---

## 3. Core underwriting principles (the business rules)

There are two universal policies for Cash and Purchase:

- **Policy 1: Savings Limit (×2).** The amount borrowed or financed can never exceed **2 × current thrift savings**.
- **Policy 2: Payslip Deduction Cap.** The member's **total monthly payslip deductions after the new facility** must not exceed **gross salary × deduction rate**. The rate defaults to **40%**. The officer can switch it to **50%**, or set a custom value between **5% and 95%** (whole numbers) with the pencil button.

A request is **eligible** only if **both** policies pass. In **Capacity-only (inquiry) mode**, the app instead computes the **maximum** amount that satisfies both policies, and the result is "eligible" if that maximum is above 0.

### Input glossary (form field → engine param)

| Field ID | Param | Meaning |
|---|---|---|
| `inp_staff` | `staff` | Staff ID / Empl. No (defaults to `"No ID"`) |
| `inp_name` | `name` | Member name (defaults to `"Member"`) |
| `inp_savings` | `savings` | Current thrift savings balance |
| `inp_existingLoan` | `existingLoan` | Outstanding normal (cash) loan balance |
| `inp_existingPurchase` | `existingPurchase` | Outstanding purchase/asset-finance balance (used **only** by Withdrawal) |
| `inp_gross` | `gross` | Gross monthly salary |
| `inp_totalBank` | `totalBank` | **Total** monthly deductions currently on the payslip (coop and non-coop) |
| `inp_coopDed` | `coopDed` | The part of `totalBank` that is the current cooperative deduction |
| `inp_monthlySavings` | `monthlySavings` | Monthly savings contribution. Blank means 10,000. Used by Cash only |
| `inp_otherDed` | `otherDed` | Other monthly deductions to add |
| `inp_requested` | `requested` | Requested amount (Cash) or purchase price (Purchase) |
| `inp_duration` | `duration` | Months |
| `chk_inquiry` | `isInquiry` | Capacity-only mode |
| state | `deductionRate` | 0.40 / 0.50 / custom |
| state | `downPaymentMode`, `downPaymentVal` | Purchase only |
| state | `withdrawalType` | `voluntary` / `retirement` |

All money inputs are parsed with `parseNumber()`. It strips commas, evaluates simple math expressions (`300000+50000`) and returns 0 for empty or invalid input.

---

## 4. Cash Loan logic (`facility === "cash"`)

### 4.1 Duration
- Allowed range is 1–24 months. If the value is invalid or 0, it falls back to **3**.
- **Tiered auto-duration** (`getTieredDuration`) applies to Cash only and is based on the requested amount:

  | Requested | Duration |
  |---|---|
  | < ₦50,000 | 3 months |
  | ₦50,000 – ₦200,000 | 12 months |
  | ₦200,001 – ₦600,000 | 18 months |
  | > ₦600,000 | 24 months |
  | empty / 0 | 3 months |

- When the requested amount changes, the duration is recalculated automatically **unless** the officer typed into the duration field. That sets `isDurationOverridden = true`.
- The override is cleared (back to tiered) by: switching to the Cash tab, applying a counter-offer, loading a member, `restoreTierDuration()`, or reset.
- On `change` (blur), an out-of-range duration is corrected: a value above 24 becomes 24, and 0 or blank becomes 3.

### 4.2 Formulas
```
savingsLimit  = savings × 2
maxDeduction  = gross × deductionRate
nonCoop       = max(0, totalBank − coopDed)          // non-coop bank deductions that stay
allowance     = max(0, maxDeduction − nonCoop − monthlySavings − otherDed)   // monthly room for loan repayment
maximum       = max(0, min(savingsLimit, allowance × duration))

amount        = (isInquiry || requested === 0) ? maximum : requested
monthly       = amount / duration                     // NO interest in the monthly; the charge is taken upfront
totalCoopMonthly = monthly + monthlySavings + otherDed
newDeduction  = nonCoop + totalCoopMonthly

savingsPass   = amount ≤ savingsLimit
payrollPass   = newDeduction ≤ maxDeduction
eligible      = isInquiry ? (maximum > 0) : (savingsPass && payrollPass)

upfrontCharge = amount × 10%                          // flat 10%, independent of duration
net           = max(0, amount − upfrontCharge − existingLoan)   // existing loan is paid off from proceeds
zeroPayout    = !isInquiry && eligible && (amount − upfrontCharge − existingLoan) ≤ 0
needsProposal = !eligible || zeroPayout
```

**Key principle:** the **existing coop deduction is replaced** by the new loan. That is why `coopDed` is subtracted out of `totalBank`. The old loan is liquidated from the new disbursement (`net` deducts `existingLoan`), so its repayment line disappears from the payslip and the new coop line is `loan monthly + savings + other`.

### 4.3 Counter-offer ("What You Can Get?")
```
counterNet          = max(0, maximum × 0.90 − existingLoan)
counter             = (needsProposal && counterNet > 0 && maximum > 0) ? maximum : 0
counterMonthly      = counter / duration
counterTotalMonthly = counterMonthly > 0 ? counterMonthly + monthlySavings + otherDed : 0
```
- If `counter > 0`, an accordion shows the proposable amount, net disbursed, monthly deduction and duration, with an **"Apply Proposable Amount"** button. The button calls `applyCounterOffer(counter)`, which sets `inp_requested`, clears the duration override, re-tiers the duration, recalculates and scrolls to the result.
  - Note: applying re-tiers the duration, so the result may differ from the one previewed at the old duration.
- If the request needs a proposal but there is no positive counter, an advisory is shown instead. It covers two cases: zero payout even at the maximum, or no borrowing capacity at all.
- If `net ≤ 0 && amount > 0`, a "Zero Payout Warning" advisory appears.

---

## 5. Purchase / Asset Finance logic (`facility === "purchase"`)

### 5.1 Duration
- Allowed range is 1–9 months. If the value is invalid or 0, it falls back to **9**. Switching to the Purchase tab forces the field to `9`. There is no tiering.

### 5.2 Tab-switch side effects (in `switchFacility('purchase')`)
1. The current `inp_monthlySavings` value (if > 0) is remembered in `state.lastSavingsInput`, then **the field is set to 0**. **Principle:** under purchase, savings are already part of the existing coop deduction, so adding them again would double-count. Switching back to Cash restores the remembered value (default 10,000).
2. If `coopDed > 0` and `otherDed === 0`, **`coopDed` is copied into `inp_otherDed`** ("sync current coop deduction into ongoing deductions"). ⚠️ See §12. With the engine formula below, this can double-count the coop deduction.
3. The down-payment controls are shown.

### 5.3 Down payment modes
| Mode | `downPaymentVal` | Down |
|---|---|---|
| `zero` (default) | 0 | 0 |
| `30` | 0.30 | 30% of the purchase amount |
| `custom_pct` | whole number such as `15` (the engine treats a value > 1 as /100) | pct × amount. The UI accepts 0 < pct < 95 |
| `custom_amt` | ₦ amount | `min(amount, val)` |

The legacy boolean `purchaseDownPayment = true` with mode `zero` is upgraded to `30`. Scenarios use `downPayment: true/false`, which maps to `30`/`zero`.

A live hint `"₦X down · ₦Y financed"` (`dpCalculatedHint`) updates as the purchase amount is typed.

### 5.4 Formulas
```
savingsLimit  = savings × 2
maxDeduction  = gross × deductionRate
nonCoop       = max(0, totalBank − coopDed)
hasExistingCoop = coopDed > 0

existingDeductions = hasExistingCoop
                     ? max(totalBank, coopDed + otherDed)
                     : totalBank + otherDed
// The existing coop deduction is KEPT (purchase sits on top of it). It is not replaced as in Cash.
// monthlySavings is ignored (treated as 0) to avoid double-deducting savings.

allowance     = max(0, maxDeduction − existingDeductions)
maxFinanced   = max(0, min(savingsLimit, allowance × duration / 1.10))   // /1.10 because repayment includes 10% interest

maximum (gross purchase price the member can afford, grossed up for the down payment):
  zero        → maxFinanced
  30          → maxFinanced / 0.70
  custom_pct  → pct < 1 ? maxFinanced / (1 − pct) : maxFinanced
  custom_amt  → maxFinanced + dpVal

amount        = (isInquiry || requested === 0) ? maximum : requested
{down, financed} = resolve(amount) per the mode table
interest      = financed × 10%                 // flat 10%, ADDED to the repayment (unlike Cash)
totalRepayment= financed + interest
monthly       = totalRepayment / duration
totalCoopMonthly = monthly + (hasExistingCoop ? coopDed : 0) + otherDed
newDeduction  = existingDeductions + monthly

savingsPass   = financed ≤ savingsLimit         // tested on FINANCED, not the full purchase price
payrollPass   = newDeduction ≤ maxDeduction
eligible      = isInquiry ? (maximum > 0) : (savingsPass && payrollPass)
needsProposal = !eligible
counter       = needsProposal && maximum > 0 ? maximum : 0
{counterDown, counterFinanced} = resolve(counter)
counterMonthly      = counterFinanced × 1.10 / duration
counterTotalMonthly = counterMonthly + (hasExistingCoop ? coopDed : 0) + otherDed
net = 0 (nothing is disbursed in cash). counterNet = counter
isDownPaymentActive = mode !== "zero" && down > 0
```

### 5.5 Cash vs Purchase: the key differences
| | Cash | Purchase |
|---|---|---|
| 10% charge | Deducted **upfront** from the payout | **Added** to the repayment |
| Existing coop deduction | **Replaced** | **Kept**; the new purchase is added on top |
| Existing loan | Paid off from proceeds | Ignored in the calculation |
| Monthly savings | Added to deductions | Forced to 0 (already inside coopDed) |
| Savings ×2 tested on | Amount requested | Amount financed (after down payment) |
| Duration | 1–24, tiered | 1–9, default 9 |
| Down payment | n/a | zero / 30% / custom % / custom ₦ |

---

## 6. Withdrawal logic (`facility === "withdrawal"`)

The payroll, deductions and request sections are hidden. Only the balances section (savings, loan, purchase) and the Voluntary/Retirement toggle are visible. The deduction cap, gross salary and duration are irrelevant here.

```
feeRate          = withdrawalType === "retirement" ? 0 : 0.05
withdrawalFee    = savings × feeRate
totalLiabilities = max(0, existingLoan) + max(0, existingPurchase)
totalDeductions  = withdrawalFee + totalLiabilities
netDisbursement  = savings − totalDeductions        // may be negative
eligible         = savings > 0 && netDisbursement ≥ 0
deficit          = netDisbursement < 0 ? |netDisbursement| : 0
net              = max(0, netDisbursement)
```
- The status is "Settlement ready" or "Deficit balance". If `netDisbursement ≤ 0 && savings > 0`, a Deficit Notice advisory is shown.
- The result shows two cards: **(1) Settlement Breakdown** (savings, fee or "Waived", loan payoff, purchase payoff, net) and **(2) Liabilities & Clearance** ("CLEARED" or "ACTION REQUIRED").
- **Principle:** all coop debts (loan and purchase) are liquidated from savings before anything is paid to the member. Voluntary exit costs 5% of savings. Retirement is free.

---

## 7. Result panel (`ui/results.js`)

- **Empty state:** "Ready to assess".
- **Member profile** (after a lookup, before a calculation): savings tile, loan tile (if > 0), purchase tile (if > 0), and an "Online Member Portal" box showing `www.tacmsl.com` with **Username = FormNo** and **Password = Staff ID**. Share and copy buttons are included.
- **Cash/Purchase appraisal:**
  - Header: name, staff ID and facility. The badge reads Eligible, Capacity ready (inquiry) or Not eligible.
  - 4 tiles: Amount (with the down/financed split for purchase), Net Disbursed (cash) or Total Repayment (purchase), Monthly Deduction (`totalCoopMonthly` with a breakdown) and Duration.
  - Audit card 1, "Savings Limit (x2)": PASS/FAIL with the excess amount.
  - Audit card 2, "Payslip Deduction Check": PASS/FAIL with row-by-row deductions, `newDeduction` against `maxDeduction (cap%)`. A hidden `cap-ratio-badge` showing % of gross exists but has `display:none`.
  - Proposal accordion or advisory (see §4.3).
  - Share/copy buttons at the top and bottom.
- **Withdrawal:** see §6.

---

## 8. Share text (`ui/share.js`)

The text is sent with `wa.me/?text=…` (anchor-click) or copied to the clipboard (with an `execCommand` fallback when not in a secure context). The button shows "Copied!" for 2 seconds.

- **Profile:** `Name (Staff)` / `As at <date>` / Savings / Loan / Purchase / `www.tacmsl.com ( pls type in your browser)` / Username = FormNo / Password = Staff.
- **Cash:** member, duration, financial standing, disbursement breakdown (amount, 10% charge, loan payoff, net), monthly payroll breakdown and status. It adds a zero-payout notice and a **PROPOSABLE OFFER** block when relevant.
- **Purchase:** uses `counter` instead of `amount` when a proposal is needed. It covers the access line, purchase amount, down payment and financed amount, 10% interest, total repayment, duration, monthly repayment, current coop deduction, monthly coop deduction and total payslip deduction against the cap.
- **Withdrawal:** breakdown, `*Net Disbursement*` and the clearance or deficit notice.
- Money format: `formatMoney` always shows 2 decimals (₦1,234.00). `formatAppraisalMoney` shows decimals only when needed (or when forced). Negative values are clamped to 0 for display.

---

## 9. Member ledger & lookup (`services/ledgerService.js`)

### 9.1 Data source
- A Google Apps Script web app (`SHEET_API_URL`).
  - `GET ?action=all&pin=2026` returns the full ledger.
  - `GET ?staffId=X&query=X&pin=2026` returns a single member (10s timeout via `AbortController`).
- Response shape: `{status:"success", encrypted:true, payload:"<nonceHex>:<cipherHex>"}` or `{status:"success", data:[...] | {...}}`.
- Encrypted payloads are decrypted with `AlphaCrypto.decrypt(payload, "2026")`:
  - The key is `SHA256(SALT + "::" + pin + "::" + SALT)`.
  - The cipher is ChaCha20 (counter 1, 12-byte nonce).
  - The plaintext is `"<first 8 bytes of SHA256('CHECK::'+text) as hex>:::<text>"`, and the integrity is verified on decrypt.

### 9.2 Ledger row shape (sheet columns)
`S/N, Name, FormNo, Empl. No, Pin, Date, Thrift Savings, Normal Loan, Interest, PURCHASE/ASSET FINANCE, Mortgage Subscription`. Optional extra keys: `gross, coopDed, monthlySavings, totalBank`.
- `Interest` and `Mortgage Subscription` are **not used** anywhere in the calculations.
- `findKeyVal()` matches keys exactly first, then case- and punctuation-insensitively, so key variants (`Empl No`, `staffId`, `savings`, etc.) all work.
- `FormNo` is zero-padded to 6 digits. `Date` is normalised to `"Month D, YYYY"`. If `Date` is missing, the app uses the last day of the previous month.

### 9.3 Caching & sync
- In memory, `localLedgerCache` starts with **2 hard-coded demo members**.
- On boot, `initLedgerCache()` loads `localStorage.alpha_coop_encrypted_cache` (encrypted) and `alpha_coop_sync_meta` (`{lastSync, memberCount, status}`), then always calls `prefetchLedger()` in the background.
- Sync status values: `idle | syncing | fresh | cached | error`. The masthead badge shows "Cached: Just now / 5m ago / 14:32 / Yesterday, 14:32 / Oct 3, 14:32". Clicking the badge (or pressing Enter/Space on it) forces a re-sync.
- When a fetch fails, the status is `cached` if more than 2 records are held (meaning real data exists), otherwise `error`.

### 9.4 Search scoring (`findMatchingMembers(query, max, fieldHint)`)
Each record's score is the highest of these:
- **Staff:** exact or digits-equal match scores 100 (hint=staff) or 90. Digits ending in the query (≥2 digits) or numerically equal scores 85/75. A substring match scores 70/60.
- **Name:** exact match scores 100 (hint=name) or 85. Starts-with (≥2 chars) scores 85/70. Contains (≥3 chars) scores 70/55.
- **FormNo:** an exact or digits match scores 100 (hint=form), 40 (hint=staff) or 50 otherwise. A numerically equal match scores 30/45. Contains scores 20/35. Form scores are deliberately low when searching by staff, to avoid collisions.

Results are sorted by score and the top N returned.

### 9.5 Lookup UX
- Both the Staff ID and Name inputs have autocomplete: up to 5 suggestions on every keystroke. Enter runs a full fetch and Escape closes the list. Clicking outside closes the dropdowns and popovers.
- Staff fetch: the local cache is checked first, then the remote endpoint. Name fetch: the local name match is tried first, then the remote endpoint with the query as staffId.
- `applyMemberRecord(member)`:
  1. **Resets all financial fields and the cap to 40%** so no stale data carries over between members.
  2. Fills staff, name, savings, loan, purchase and, if present, gross, coopDed, monthlySavings and totalBank.
  3. Re-tiers the duration (Cash).
  4. Shows the status message "✓ Found: … · Savings · Loan · Purchase".
  5. Stores `currentMemberProfile`, clears `lastResult` and renders the profile card.
- If the officer edits the Staff or Name input so it no longer matches the loaded profile, the financial fields are reset automatically.

---

## 10. State, events & reactivity

### 10.1 State (`appState.js`)
```
facility: 'cash'|'purchase'|'withdrawal'
withdrawalType: 'voluntary'|'retirement'
purchaseDownPayment: bool, downPaymentMode, downPaymentVal, downPaymentCustomType: 'pct'|'amt'
deductionRate: number, customDeductionRate: number|null
isDurationOverridden: bool
lastSavingsInput: number (default 10000)
lastResult: engine result | null
currentMemberProfile: profile | null
history: appraisal records (sessionStorage 'alpha_coop_appraisal_history', max 25)
```

### 10.2 Recalculation triggers
These all call `calculateEligibility()`:
- The Calculate button.
- Typing in the requested amount or duration, **if a result already exists** (live update).
- Changing the cap, down payment mode, inquiry toggle or withdrawal type, if a result exists or gross/savings is filled.
- Switching facility, if a result exists. Otherwise the profile card is re-rendered if a member is loaded.
- Loading a scenario.

### 10.3 Appraisal history
- Every `calculateEligibility()` call pushes a record:
  - Fields: `id, timestamp, facility, name, staff, amount, net, duration, eligible, isInquiry, monthly, totalCoopMonthly, savings, existingLoan, existingPurchase, withdrawalType`.
  - Full `inputs`, plus the full `result`.
- Duplicates (same member by staff or name, same amount and same facility) replace the older record, and the new one goes first.
- The drawer shows cards with facility, PASS/FAIL/READY, duration or withdrawal type, the amount and the monthly deduction (or net payout). Each card has a ✕ delete button. There is also a Clear-all button and a time-ago label.
- Clicking a card calls `restoreAppraisal(item)`. This switches the tab, fills every field, sets the cap, down payment, withdrawal type and inquiry mode, then renders the **stored** result.
- History lives in sessionStorage, so it is cleared when the tab closes.

### 10.4 Reset (`resetForm` / floating "Clear" button)
- Clears all fields and sets monthly savings back to 10,000.
- Sets withdrawal to voluntary, inquiry off, down payment to zero and the cap to 40%.
- Clears `lastResult` and the profile, and resets the duration to the facility default.
- Shows the empty result panel.

---

## 11. Auth, security model, UX extras

- **Lock screen:** the body has `is-locked`. The masthead and `.app-shell` have the `inert` attribute until unlock.
  - The PIN (`2026`) is checked client-side. It also auto-unlocks as soon as the typed value matches.
  - Unlock state is kept in `sessionStorage` (`alpha_coop_unlocked`, `alpha_coop_last_active`).
- **Inactivity:** the desk locks after 1 hour with no activity (mouse, key, touch, scroll or input; writes are throttled to every 2s). The timeout is also re-checked on `visibilitychange` and `focus`.
- Every action entry point (`calculateEligibility`, `switchFacility`, `fetchMember`, `loadScenario`) first checks `isDeskUnlocked()`.
- **Money inputs** (`.money-input`):
  - Comma formatting happens as you type, and the cursor position is preserved.
  - Math expressions are allowed. On blur or Enter, the expression is evaluated, the formatted result is displayed, and the formula is kept in `data-calc-formula` (shown in the tooltip and restored on focus).
  - Evaluation uses `Function()` behind a strict whitelist regex: digits, spaces, `+-*/.()` only.
- **Scenarios:** preset chips per facility. Cash has eligible, savings fail, payslip fail, deductions exceed cap, zero payout and capacity inquiry. Purchase has VIHO phone, zero down, 30% down, payslip fail, counter offer and capacity. Withdrawal has voluntary, retirement and deficit. Chips support drag-scroll with momentum.
- The **Quick request chips** (Max / 50% / Clear Loan) are **intentionally disabled** (early `return` in `updateQuickRequestChips`). The code is kept for later.
- The masthead facility badge cycles cash → purchase → withdrawal. The masthead also shows "Savings ×2 · Deduction N%".
- Onboarding: a 10-step tour that starts after the first unlock. It can be replayed with the "?" button.

---

## 12. Known issues / inconsistencies found while documenting (please review, don't silently "fix")

1. **Purchase double-counting of coop deduction.** When switching to Purchase with `coopDed > 0` and `otherDed` empty, `coopDed` is copied into `otherDed`. The engine then computes `existingDeductions = max(totalBank, coopDed + otherDed)` and `totalCoopMonthly = monthly + coopDed + otherDed`, so the coop deduction is counted **twice**. Scenarios don't hit this because `loadScenario` sets `otherDed` explicitly.
2. **Custom down payment of exactly 1%.** `pct = dpVal > 1 ? dpVal/100 : dpVal`, so `1` is read as 100%. That means down = full price and financed = 0.
3. **Stale formula in the disabled quick chips.** The purchase branch there uses `max(totalBank, coopDed) + otherDed` and `totalBank + monthlySavings + otherDed`, which doesn't match the engine. This is dead code today, but it will be wrong if it is re-enabled.
4. **Autocomplete display keys.** The suggestion dropdown reads `m.name / m.staff / m.savings / m.loan`. Raw ledger rows use `Name / Empl. No / Thrift Savings / Normal Loan`, so suggestions may show "Member", "No ID" and ₦0 unless the sheet returns lowercase keys. The fix is to use `extractMemberProfile()`.
5. **Remote-record cache check:** `localLedgerCache.some(m => m.staff === record.staffId)` compares mismatched keys, so remote records can be pushed into the cache more than once.
6. **Withdrawal with net exactly 0** is `eligible = true` but still shows the "Deficit Notice" advisory (`netDisbursement <= 0`).
7. **`restoreAppraisal`** calls `switchFacility`, `setDeductionCap` and `toggleInquiryMode`. Each of these may call `calculateEligibility()`, which adds extra history entries before the stored result is rendered.
8. **Applying a cash counter-offer re-tiers the duration.** The applied result can therefore differ from the previewed proposal, which was computed at the old duration.
9. **Security (existing, flagged only):**
   - The PIN `2026` is hard-coded in client JS and shown on the lock screen ("Default: 2026").
   - The crypto key is derived from a public salt plus that PIN, so the encryption is obfuscation only.
   - The Apps Script URL is public.
   - Ledger values (names, IDs) are injected with `innerHTML` in the autocomplete, the result panel and the history drawer, which is an XSS risk if sheet data is ever untrusted.
   - Real member portal credentials (FormNo/StaffID) are displayed and shared.

---

## 13. Worked examples (verify any rewrite against these)

**Cash (unit test):** gross 650,000 · savings 500,000 · totalBank 100,000 · coopDed 0 · monthlySavings 10,000 · otherDed 0 · requested 400,000 · 12 months · cap 40%
- maxDed 260,000 · nonCoop 100,000 · allowance 150,000 · maximum min(1,000,000, 1,800,000) = 1,000,000
- monthly 33,333.33 · totalCoop 43,333.33 · newDed 143,333.33 ≤ 260,000 ✅ · 400,000 ≤ 1,000,000 ✅
- upfront 40,000 · net **360,000** · ELIGIBLE

**Purchase (unit test):** same member, purchase 300,000 · 9 months · zero down
- existingDed 100,000 · allowance 160,000 · maxFinanced min(1,000,000, 1,309,090.91) = 1,000,000
- interest 30,000 · totalRepayment **330,000** · monthly 36,666.67 · newDed 136,666.67 ✅ · ELIGIBLE

**Purchase (VIHO scenario):** gross 300,000 · savings 55,000 · coopDed 97,917 · totalBank 0 · otherDed 0 · purchase 110,000 · 9 months · zero down
- maxDed 120,000 · existingDed max(0, 97,917) = 97,917 · allowance 22,083 · maxFinanced min(110,000, 180,679) = 110,000
- interest 11,000 · total 121,000 · monthly 13,444.44 · newDed 111,361.44 ≤ 120,000 ✅ · financed 110,000 ≤ 110,000 ✅ · ELIGIBLE

**Withdrawal (integration test):** savings 1,850,000 · loan 300,000 · purchase 120,000
- Voluntary: fee 92,500 · deductions 512,500 · net **1,337,500** ✅
- Retirement: fee 0 · deductions 420,000 · net **1,430,000** ✅

**Withdrawal deficit:** savings 200,000 · loan 200,000 · purchase 50,000 · voluntary
- fee 10,000 · deductions 260,000 · net −60,000 → not eligible, deficit **60,000**
