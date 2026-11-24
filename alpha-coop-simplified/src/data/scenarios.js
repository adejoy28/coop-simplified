// ==========================================================================
//  ALPHA COOP — PRESET TEST SCENARIOS
// ==========================================================================

export const scenarios = {
  cash: [
    {
      label: "Eligible loan",
      tone: "good",
      data: {
        name: "KAYODE BALOGUN",
        staff: "EMP-1021",
        FormNo: "001021",
        gross: 650000,
        savings: 500000,
        existingLoan: 150000,
        totalBank: 210000,
        coopDed: 80000,
        monthlySavings: 15000,
        otherDed: 0,
        requested: 600000,
        duration: 18,
        inquiry: false
      }
    },
    {
      label: "Savings limit fail",
      tone: "bad",
      data: {
        name: "EMEKA NWOSU",
        staff: "EMP-3042",
        FormNo: "003042",
        gross: 550000,
        savings: 200000,
        existingLoan: 100000,
        totalBank: 190000,
        coopDed: 50000,
        monthlySavings: 10000,
        otherDed: 0,
        requested: 800000,
        duration: 12,
        inquiry: false
      }
    },
    {
      label: "Payslip deduction fail",
      tone: "bad",
      data: {
        name: "YUSUF MOHAMMED",
        staff: "EMP-4180",
        FormNo: "004180",
        gross: 400000,
        savings: 800000,
        existingLoan: 0,
        totalBank: 130000,
        coopDed: 0,
        monthlySavings: 10000,
        otherDed: 0,
        requested: 600000,
        duration: 12,
        inquiry: false
      }
    },
    {
      label: "New deductions exceed cap",
      tone: "bad",
      data: {
        name: "SEGUN ADEWALE",
        staff: "EMP-5520",
        FormNo: "005520",
        gross: 320000,
        savings: 500000,
        existingLoan: 0,
        totalBank: 140000,
        coopDed: 0,
        monthlySavings: 10000,
        otherDed: 0,
        requested: 250000,
        duration: 12,
        inquiry: false
      }
    },
    {
      label: "Zero payout",
      tone: "bad",
      data: {
        name: "AISHA BELLO",
        staff: "EMP-5198",
        FormNo: "005198",
        gross: 600000,
        savings: 450000,
        existingLoan: 380000,
        totalBank: 120000,
        coopDed: 0,
        monthlySavings: 15000,
        otherDed: 0,
        requested: 200000,
        duration: 12,
        inquiry: false
      }
    },
    {
      label: "Capacity inquiry",
      tone: "neutral",
      data: {
        name: "TOLU OGUNLEWE",
        staff: "EMP-6004",
        FormNo: "006004",
        gross: 700000,
        savings: 600000,
        existingLoan: 200000,
        totalBank: 220000,
        coopDed: 90000,
        monthlySavings: 20000,
        otherDed: 0,
        requested: "",
        duration: 24,
        inquiry: true
      }
    }
  ],
  purchase: [
    {
      label: "Phone purchase (VIHO)",
      tone: "good",
      data: {
        name: "DEMOLA AKANMI",
        staff: "EMP-7110",
        FormNo: "000607",
        gross: 300000,
        savings: 55000,
        existingLoan: 850000,
        totalBank: 0,
        coopDed: 97917,
        monthlySavings: 5000,
        otherDed: 0,
        requested: 110000,
        duration: 9,
        downPayment: false,
        inquiry: false
      }
    },
    {
      label: "Eligible · zero down",
      tone: "good",
      data: {
        name: "CHINAZA EZE",
        staff: "EMP-7110",
        FormNo: "007110",
        gross: 580000,
        savings: 450000,
        existingLoan: 100000,
        totalBank: 180000,
        requested: 320000,
        duration: 9,
        downPayment: false,
        inquiry: false
      }
    },
    {
      label: "Eligible · 30% down",
      tone: "good",
      data: {
        name: "CHINAZA EZE",
        staff: "EMP-7110",
        FormNo: "007110",
        gross: 580000,
        savings: 450000,
        existingLoan: 100000,
        totalBank: 180000,
        requested: 600000,
        duration: 9,
        downPayment: true,
        inquiry: false
      }
    },
    {
      label: "Payslip deduction fail",
      tone: "bad",
      data: {
        name: "IBRAHIM DANLADI",
        staff: "EMP-6731",
        FormNo: "006731",
        gross: 350000,
        savings: 600000,
        existingLoan: 0,
        totalBank: 110000,
        coopDed: 0,
        monthlySavings: 10000,
        otherDed: 0,
        requested: 450000,
        duration: 9,
        downPayment: false,
        inquiry: false
      }
    },
    {
      label: "Counter offer",
      tone: "bad",
      data: {
        name: "BABATUNDE ALAO",
        staff: "EMP-8245",
        FormNo: "008245",
        gross: 420000,
        savings: 220000,
        existingLoan: 60000,
        totalBank: 140000,
        requested: 850000,
        duration: 9,
        downPayment: true,
        inquiry: false
      }
    },
    {
      label: "Purchase capacity",
      tone: "neutral",
      data: {
        name: "FUNKE ADELEKE",
        staff: "EMP-9031",
        FormNo: "009031",
        gross: 640000,
        savings: 500000,
        existingLoan: 100000,
        totalBank: 190000,
        requested: "",
        duration: 9,
        downPayment: true,
        inquiry: true
      }
    }
  ],
  withdrawal: [
    {
      label: "Voluntary (Debts cleared)",
      tone: "good",
      data: {
        name: "ADEMOLA THOMAS",
        staff: "LIRS/9999",
        FormNo: "000780",
        savings: 1610278,
        existingLoan: 80138,
        existingPurchase: 0,
        existingCommodity: 0,
        withdrawalType: "voluntary"
      }
    },
    {
      label: "Retirement (0% charge)",
      tone: "good",
      data: {
        name: "OLUSEGUN DEMOL",
        staff: "LIRS/9997",
        FormNo: "000607",
        savings: 1850000,
        existingLoan: 0,
        existingPurchase: 120000,
        existingCommodity: 150000,
        withdrawalType: "retirement"
      }
    },
    {
      label: "Deficit (Debts > Savings)",
      tone: "bad",
      data: {
        name: "CHIDI OKONKWO",
        staff: "LIRS/1042",
        FormNo: "001042",
        savings: 250000,
        existingLoan: 350000,
        existingPurchase: 80000,
        existingCommodity: 50000,
        withdrawalType: "voluntary"
      }
    }
  ],
  special: [
    {
      label: "Special loan · 20% (12 mos)",
      tone: "good",
      data: {
        name: "OLUSEGUN DEMOL",
        staff: "LIRS/9997",
        FormNo: "000607",
        gross: 300000,
        savings: 55000,
        existingLoan: 850000,
        existingCommodity: 150000,
        totalBank: 0,
        coopDed: 97917,
        monthlySavings: 0,
        otherDed: 0,
        requested: 300000,
        duration: 12,
        specialInterestRate: 0.20,
        inquiry: false
      }
    },
    {
      label: "Special loan · 20% (24 mos)",
      tone: "good",
      data: {
        name: "KAYODE BALOGUN",
        staff: "EMP-1021",
        FormNo: "001021",
        gross: 650000,
        savings: 500000,
        existingLoan: 150000,
        existingCommodity: 0,
        totalBank: 210000,
        coopDed: 80000,
        monthlySavings: 0,
        otherDed: 0,
        requested: 600000,
        duration: 24,
        specialInterestRate: 0.20,
        inquiry: false
      }
    },
    {
      label: "Special loan · 10% rate",
      tone: "neutral",
      data: {
        name: "FUNKE ADELEKE",
        staff: "EMP-9031",
        FormNo: "009031",
        gross: 640000,
        savings: 500000,
        existingLoan: 100000,
        existingCommodity: 80000,
        totalBank: 190000,
        coopDed: 60000,
        monthlySavings: 0,
        otherDed: 0,
        requested: 240000,
        duration: 12,
        specialInterestRate: 0.10,
        inquiry: false
      }
    }
  ]
};
