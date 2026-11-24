export type FacilityType = "cash" | "purchase" | "special" | "withdrawal";
export type WithdrawalType = "voluntary" | "retirement";
export type DownPaymentMode = "zero" | "30" | "custom_pct" | "custom_amt";
export type DownPaymentCustomType = "pct" | "amt";
export type ThemeMode = "dark" | "light";
export type ScenarioTone = "good" | "bad" | "neutral";
export type LedgerSyncState = "idle" | "syncing" | "fresh" | "cached" | "error";

export interface MemberRecord {
  [key: string]: unknown;
  gross?: number | string;
  coopDed?: number | string;
  monthlySavings?: number | string;
  totalBank?: number | string;
}

export interface MemberProfile {
  name: string;
  staff: string;
  savings: number;
  loan: number;
  commodity: number;
  commodityPrincipal: number;
  commodityInterest: number;
  purchase: number;
  sharesSavings: number;
  landLoan: number;
  formNo: string;
  asAt: string;
}

export interface UnderwritingParams {
  facility?: FacilityType;
  name?: string;
  staff?: string;
  gross?: number;
  savings?: number;
  existingLoan?: number;
  existingPurchase?: number;
  existingCommodity?: number;
  totalBank?: number;
  requested?: number;
  duration?: number;
  isInquiry?: boolean;
  deductionRate?: number;
  coopDed?: number;
  monthlySavings?: number;
  otherDed?: number;
  purchaseDownPayment?: boolean;
  downPaymentMode?: DownPaymentMode;
  downPaymentVal?: number;
  withdrawalType?: WithdrawalType;
  specialInterestRate?: number;
}

export interface UnderwritingResult {
  facility: FacilityType;
  name: string;
  staff: string;
  duration: number;
  deductionRate?: number;
  specialInterestRate?: number;
  isInquiry?: boolean;
  amount: number;
  monthly: number;
  totalCoopMonthly: number;
  eligible: boolean;
  zeroPayout?: boolean;
  needsProposal: boolean;
  savingsLimit: number;
  maxDeduction: number;
  allowance?: number;
  savingsPass: boolean;
  payrollPass: boolean;
  interest: number;
  upfrontCharge?: number;
  loanOffset?: number;
  net: number;
  maximum?: number;
  counter?: number;
  counterNet?: number;
  counterMonthly?: number;
  counterTotalMonthly?: number;
  counterDown?: number;
  counterFinanced?: number;
  down?: number;
  financed?: number;
  isDownPaymentActive?: boolean;
  downPaymentMode?: DownPaymentMode;
  downPaymentVal?: number;
  totalRepayment?: number;
  principalMonthly?: number;
  interestMonthly?: number;
  totalBank?: number;
  coopDed?: number;
  monthlySavings?: number;
  otherDed?: number;
  nonCoop?: number;
  newDeduction: number;
  existingDeductions?: number;
  existingLoan: number;
  existingPurchase?: number;
  existingCommodity?: number;
  savings: number;
  gross?: number;
  hasExistingCoop?: boolean;
  effectiveSavingsDeduction?: number;
  withdrawalType?: WithdrawalType;
  isRetirement?: boolean;
  feeRate?: number;
  withdrawalFee?: number;
  totalLiabilities?: number;
  totalDeductions?: number;
  netDisbursement?: number;
  deficit?: number;
}

export interface AppraisalInputs {
  facility: FacilityType;
  name: string;
  staff: string;
  gross: number;
  savings: number;
  existingLoan: number;
  existingPurchase: number;
  existingCommodity: number;
  totalBank: number;
  requested: number;
  duration: number;
  isInquiry: boolean;
  deductionRate: number;
  coopDed: number;
  monthlySavings: number;
  otherDed: number;
  purchaseDownPayment: boolean;
  downPaymentMode: DownPaymentMode;
  downPaymentVal: number;
  withdrawalType: WithdrawalType;
  specialInterestRate: number;
}

export interface AppraisalHistoryItem {
  id: string;
  timestamp: number;
  facility: FacilityType;
  name: string;
  staff: string;
  amount: number;
  net: number;
  duration: number;
  eligible: boolean;
  isInquiry: boolean;
  monthly: number;
  totalCoopMonthly: number;
  savings: number;
  existingLoan: number;
  existingPurchase: number;
  existingCommodity: number;
  withdrawalType: WithdrawalType;
  inputs: AppraisalInputs;
  result: UnderwritingResult;
}

export interface ScenarioData {
  name?: string;
  staff?: string;
  FormNo?: string;
  gross?: number;
  savings?: number;
  existingLoan?: number;
  loanBal?: number;
  existingPurchase?: number;
  existingCommodity?: number;
  totalBank?: number;
  coopDed?: number;
  monthlySavings?: number;
  otherDed?: number;
  requested?: number | string;
  duration?: number;
  downPayment?: boolean;
  dp?: boolean;
  withdrawalType?: WithdrawalType;
  specialInterestRate?: number;
  inquiry?: boolean;
}

export interface ScenarioItem {
  label: string;
  tone: ScenarioTone;
  data: ScenarioData;
}

export interface LedgerSyncInfo {
  status: LedgerSyncState;
  count: number;
  lastSync: number | null;
  source: "default" | "cache" | "live";
}
