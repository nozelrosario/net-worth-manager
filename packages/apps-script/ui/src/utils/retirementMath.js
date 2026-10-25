// Financial Math & Actuarial Engine for Retirement & Pension (EPF, VPF, PPF & NPS)
// Provides accurate EPFO monthly running balance interest accretion, NPS look-through
// asset class deconstruction (Class E vs C/G), Age 60 compounding forecaster,
// 60/40 lump sum vs lifetime annuity calculations, and Indian Income Tax shield audit.

export const RETIREMENT_RATES = {
  EPF_DEFAULT: 8.25,        // EPFO declared interest rate (% p.a.)
  PPF_DEFAULT: 7.10,        // Ministry of Finance statutory PPF rate (% p.a.)
  NPS_CLASS_E: 12.0,        // Historic long-term CAGR for NPS Asset Class E (Equity)
  NPS_CLASS_C: 8.5,         // Historic long-term yield for NPS Asset Class C (Corporate Bonds)
  NPS_CLASS_G: 7.2,         // Historic long-term yield for NPS Asset Class G (Govt Securities)
  NPS_CLASS_A: 9.0,         // Historic long-term yield for NPS Asset Class A (Alternative Assets)
  ANNUITY_RATE_DEFAULT: 7.0 // Prevailing lifelong immediate annuity rate (% p.a.)
};

/**
 * Checks if an asset belongs to Retirement & Pension
 */
export function isRetirementAsset(asset) {
  if (!asset) return false;
  const cat = (asset.Category || '').toLowerCase();
  const name = (asset.Name || '').toLowerCase();
  const inst = (asset['Institution/Location'] || '').toLowerCase();
  const subType = (asset['Details JSON']?.['Retirement Type'] || asset['Details JSON']?.['Fund Type'] || '').toLowerCase();

  return (
    cat.includes('retire') ||
    cat.includes('pension') ||
    cat.includes('provident') ||
    subType.includes('epf') ||
    subType.includes('ppf') ||
    subType.includes('nps') ||
    subType.includes('vpf') ||
    subType.includes('superannuation') ||
    name.includes('epf') ||
    name.includes('ppf') ||
    name.includes('nps') ||
    name.includes('provident') ||
    name.includes('pension') ||
    inst.includes('epfo') ||
    inst.includes('pfrda')
  );
}

/**
 * Detects the specific subtype of a retirement asset
 */
export function detectRetirementSubType(asset) {
  const d = asset?.['Details JSON'] || {};
  const explicit = (d['Retirement Type'] || d['Fund Type'] || '').toLowerCase();
  const name = (asset?.Name || '').toLowerCase();
  const cat = (asset?.Category || '').toLowerCase();

  if (explicit.includes('nps tier 2') || name.includes('nps tier 2') || name.includes('tier ii')) {
    return 'NPS Tier 2';
  }
  if (explicit.includes('nps') || name.includes('nps') || explicit.includes('pran')) {
    return 'NPS Tier 1';
  }
  if (explicit.includes('ppf') || name.includes('ppf') || explicit.includes('public provident')) {
    return 'PPF';
  }
  if (explicit.includes('superannuation') || name.includes('superannuation')) {
    return 'Superannuation';
  }
  if (explicit.includes('gratuity') || name.includes('gratuity')) {
    return 'Gratuity';
  }
  // Default to EPF / VPF
  return 'EPF / VPF';
}

/**
 * Parses and processes a single retirement asset with detailed sub-ledger math
 */
export function processRetirementAccount(asset) {
  const subType = detectRetirementSubType(asset);
  const d = asset?.['Details JSON'] || {};
  const currentVal = Number(asset?.['Current Value'] || 0);
  const costVal = Number(asset?.Cost || currentVal);

  if (subType === 'EPF / VPF') {
    const uan = asset?.Identifiers || d['UAN'] || d['Account Number'] || '—';
    const memberId = d['Member ID'] || '';
    const empShare = Number(d['Employee Share']) || Math.round(currentVal * 0.48);
    const emprShare = Number(d['Employer Share']) || Math.round(currentVal * 0.44);
    const epsShare = Number(d['EPS Pension Share'] || d['Pension Share']) || Math.round(currentVal * 0.08);

    const monthlyEmp = Number(d['Monthly Employee Contribution']) || Number(d['Monthly Contribution']) || 0;
    const monthlyEmpr = Number(d['Monthly Employer Contribution']) || monthlyEmp; // standard matching
    const monthlyVpf = Number(d['Monthly VPF Contribution']) || Number(d['VPF Amount']) || 0;
    const totalMonthly = monthlyEmp + monthlyEmpr + monthlyVpf;

    const rate = Number(d['Interest Rate']) || RETIREMENT_RATES.EPF_DEFAULT;
    
    // FY Running-Balance Accrual Calculation
    // Assumes average holding period of monthly inflows is 6 months over a financial year
    const accruedInterestFY = Math.round((currentVal * (rate / 100)) + (totalMonthly * 12 * (rate / 100) * 0.5));

    // Rule 9D Check: Employee Share + VPF > ₹2.5L/year is taxable
    const annualEmployeeInflow = (monthlyEmp + monthlyVpf) * 12;
    const isTaxableRule9D = annualEmployeeInflow > 250000;
    const taxableAmount = Math.max(0, annualEmployeeInflow - 250000);

    return {
      subType,
      id: asset?.ID || asset?.Name,
      name: asset?.Name || 'EPFO Provident Fund',
      institution: asset?.['Institution/Location'] || 'EPFO',
      identifier: uan,
      memberId,
      currentValue: currentVal,
      cost: costVal,
      rate,
      monthlyInflow: totalMonthly,
      monthlyEmp,
      monthlyEmpr,
      monthlyVpf,
      empShare,
      emprShare,
      epsShare,
      accruedInterestFY,
      isTaxableRule9D,
      taxableAmount,
      equityPortion: 0,
      debtPortion: currentVal,
      owner: asset?.Owner || 'Primary Holder'
    };
  }

  if (subType === 'NPS Tier 1' || subType === 'NPS Tier 2') {
    const pran = asset?.Identifiers || d['PRAN'] || d['Account Number'] || '—';
    const pfm = asset?.['Institution/Location'] || d['PFM'] || d['Pension Fund Manager'] || 'HDFC Pension';
    const choice = d['Investment Choice'] || 'Active Choice';

    // Asset allocation percentages (E, C, G, A)
    let e = Number(d['Allocation Equity E'] || d['Equity E %']);
    let c = Number(d['Allocation Corp Debt C'] || d['Corp Debt C %']);
    let g = Number(d['Allocation Govt Sec G'] || d['Govt Sec G %']);
    let a = Number(d['Allocation Alternative A'] || d['Alternative A %']) || 0;

    // Fallbacks if not set
    if (isNaN(e) || isNaN(c) || isNaN(g) || (e + c + g + a) === 0) {
      if (choice.includes('Aggressive') || choice.includes('LC75')) {
        e = 75; c = 15; g = 10; a = 0;
      } else if (choice.includes('Conservative') || choice.includes('LC25')) {
        e = 25; c = 45; g = 30; a = 0;
      } else {
        // Moderate / Default
        e = 60; c = 25; g = 15; a = 0;
      }
    }

    const monthlySelf = Number(d['Monthly Self SIP'] || d['Monthly Contribution'] || 0);
    const monthlyEmployer = Number(d['Monthly Employer 80CCD2'] || d['Employer Contribution'] || 0);
    const totalMonthly = monthlySelf + monthlyEmployer;

    // Look-through values
    const equityPortion = Math.round(currentVal * (e / 100));
    const debtPortion = Math.round(currentVal * ((c + g) / 100));
    const altPortion = Math.round(currentVal * (a / 100));

    // Weighted expected annual return
    const weightedRate = (
      (e * RETIREMENT_RATES.NPS_CLASS_E) +
      (c * RETIREMENT_RATES.NPS_CLASS_C) +
      (g * RETIREMENT_RATES.NPS_CLASS_G) +
      (a * RETIREMENT_RATES.NPS_CLASS_A)
    ) / 100;

    const accruedInterestFY = Math.round((currentVal * (weightedRate / 100)) + (totalMonthly * 12 * (weightedRate / 100) * 0.5));

    return {
      subType,
      id: asset?.ID || asset?.Name,
      name: asset?.Name || (subType === 'NPS Tier 1' ? 'National Pension System' : 'NPS Tier 2 Voluntary'),
      institution: pfm,
      identifier: pran,
      currentValue: currentVal,
      cost: costVal,
      pnl: currentVal - costVal,
      pnlPct: costVal > 0 ? ((currentVal - costVal) / costVal) * 100 : 0,
      rate: Number(weightedRate.toFixed(2)),
      monthlyInflow: totalMonthly,
      monthlySelf,
      monthlyEmployer,
      choice,
      allocations: { e, c, g, a },
      equityPortion,
      debtPortion,
      altPortion,
      accruedInterestFY,
      isTier1: subType === 'NPS Tier 1',
      owner: asset?.Owner || 'Primary Holder'
    };
  }

  if (subType === 'PPF') {
    const acctNum = asset?.Identifiers || d['Account Number'] || '—';
    const bank = asset?.['Institution/Location'] || 'State Bank of India';
    const rate = Number(d['Interest Rate']) || RETIREMENT_RATES.PPF_DEFAULT;
    const fyDeposit = Number(d['FY Deposit Amount'] || d['Annual Deposit'] || 0);
    const openDate = d['Account Open Date'] || asset?.['Acquisition Date'] || '';
    const maturityDate = d['Maturity Date'] || '';
    const extBlock = d['Extension Block'] || 'Original 15 Years';

    const accruedInterestFY = Math.round((currentVal + fyDeposit) * (rate / 100));

    // Calculate years remaining if dates exist
    let yearsRemaining = 7; // realistic default
    if (maturityDate) {
      const mat = new Date(maturityDate);
      const now = new Date();
      if (!isNaN(mat.getTime())) {
        const diffYears = (mat - now) / (1000 * 60 * 60 * 24 * 365.25);
        yearsRemaining = Math.max(0, Math.round(diffYears * 10) / 10);
      }
    }

    return {
      subType,
      id: asset?.ID || asset?.Name,
      name: asset?.Name || 'Public Provident Fund',
      institution: bank,
      identifier: acctNum,
      currentValue: currentVal,
      cost: costVal,
      rate,
      monthlyInflow: Math.round(fyDeposit / 12),
      fyDeposit,
      openDate,
      maturityDate,
      extensionBlock: extBlock,
      yearsRemaining,
      accruedInterestFY,
      equityPortion: 0,
      debtPortion: currentVal,
      owner: asset?.Owner || 'Primary Holder'
    };
  }

  // Superannuation or Gratuity
  return {
    subType,
    id: asset?.ID || asset?.Name,
    name: asset?.Name || subType,
    institution: asset?.['Institution/Location'] || 'Corporate Trust',
    identifier: asset?.Identifiers || '—',
    currentValue: currentVal,
    cost: costVal,
    rate: 7.5,
    monthlyInflow: 0,
    accruedInterestFY: Math.round(currentVal * 0.075),
    equityPortion: 0,
    debtPortion: currentVal,
    owner: asset?.Owner || 'Primary Holder'
  };
}

/**
 * Aggregates all retirement assets into a consolidated summary
 */
export function calculateRetirementPortfolio(assets = []) {
  const retirementAssets = (assets || []).filter(isRetirementAsset);
  const accounts = retirementAssets.map(processRetirementAccount);

  let totalRetirementCorpus = 0;
  let totalCost = 0;
  let totalMonthlyInflow = 0;
  let totalAccruedInterestFY = 0;
  let totalEquityPortion = 0;
  let totalDebtPortion = 0;
  let totalAltPortion = 0;

  accounts.forEach(acc => {
    totalRetirementCorpus += acc.currentValue;
    totalCost += acc.cost;
    totalMonthlyInflow += acc.monthlyInflow;
    totalAccruedInterestFY += acc.accruedInterestFY;
    totalEquityPortion += (acc.equityPortion || 0);
    totalDebtPortion += (acc.debtPortion || 0);
    totalAltPortion += (acc.altPortion || 0);
  });

  const equityPct = totalRetirementCorpus > 0 ? Math.round((totalEquityPortion / totalRetirementCorpus) * 100) : 0;
  const debtPct = totalRetirementCorpus > 0 ? Math.round((totalDebtPortion / totalRetirementCorpus) * 100) : 0;
  const altPct = Math.max(0, 100 - equityPct - debtPct);

  // Effective weighted yield across all retirement holdings
  let weightedYieldSum = 0;
  accounts.forEach(acc => {
    weightedYieldSum += (acc.currentValue * acc.rate);
  });
  const effectiveWeightedYield = totalRetirementCorpus > 0 
    ? Number((weightedYieldSum / totalRetirementCorpus).toFixed(2)) 
    : 8.5;

  return {
    accountsCount: accounts.length,
    accounts,
    totalRetirementCorpus,
    totalCost,
    totalPnl: totalRetirementCorpus - totalCost,
    totalMonthlyInflow,
    annualRecurringInflow: totalMonthlyInflow * 12,
    totalAccruedInterestFY,
    effectiveWeightedYield,
    underlyingAllocation: {
      equityPortion: totalEquityPortion,
      equityPct,
      debtPortion: totalDebtPortion,
      debtPct,
      altPortion: totalAltPortion,
      altPct
    }
  };
}

/**
 * Projects retirement corpus and monthly pension annuity at Age 60
 */
export function calculatePensionProjection({
  currentCorpus = 0,
  monthlyInflow = 0,
  currentAge = 32,
  retirementAge = 60,
  expectedReturnPct = 9.8,
  stepUpPct = 5,
  annuityPct = 40,
  annuityRatePct = RETIREMENT_RATES.ANNUITY_RATE_DEFAULT,
  inflationPct = 5.5
}) {
  const yearsToRetire = Math.max(1, Number(retirementAge) - Number(currentAge));
  const r = (Number(expectedReturnPct) || 9.8) / 100;
  const s = (Number(stepUpPct) || 0) / 100;

  let corpus = Number(currentCorpus) || 0;
  let currentYearMonthlyInflow = Number(monthlyInflow) || 0;
  let totalDeposited = corpus;

  const trajectory = [];

  for (let year = 1; year <= yearsToRetire; year++) {
    const annualInflow = currentYearMonthlyInflow * 12;
    totalDeposited += annualInflow;

    // Corpus compounds for the year, fresh inflows earn interest for half year on average
    corpus = (corpus * (1 + r)) + (annualInflow * (1 + r / 2));
    currentYearMonthlyInflow *= (1 + s);

    if (year % 5 === 0 || year === yearsToRetire) {
      trajectory.push({
        year,
        age: Number(currentAge) + year,
        corpus: Math.round(corpus),
        totalDeposited: Math.round(totalDeposited)
      });
    }
  }

  const finalCorpus = Math.round(corpus);
  const totalGrowthInterest = Math.max(0, finalCorpus - Math.round(totalDeposited));

  // 60% Tax-Free Lump Sum & 40% Mandatory Annuity (PFRDA Rule)
  const safeAnnuityPct = Math.min(100, Math.max(0, Number(annuityPct) || 40));
  const lumpSumPct = 100 - safeAnnuityPct;

  const lumpSumAmount = Math.round(finalCorpus * (lumpSumPct / 100));
  const annuityCorpus = Math.round(finalCorpus * (safeAnnuityPct / 100));

  // Monthly Pension = (Annuity Corpus * Annuity Rate) / 12
  const projectedMonthlyPension = Math.round((annuityCorpus * ((Number(annuityRatePct) || 7.0) / 100)) / 12);

  // Inflation-adjusted purchasing power
  const inflationDiscount = Math.pow(1 + (Number(inflationPct) || 5.5) / 100, yearsToRetire);
  const realCorpus = Math.round(finalCorpus / inflationDiscount);
  const realMonthlyPension = Math.round(projectedMonthlyPension / inflationDiscount);

  return {
    yearsToRetire,
    targetAge: Number(retirementAge),
    finalCorpus,
    totalDeposited: Math.round(totalDeposited),
    totalGrowthInterest,
    lumpSumAmount,
    lumpSumPct,
    annuityCorpus,
    annuityPct: safeAnnuityPct,
    projectedMonthlyPension,
    realCorpus,
    realMonthlyPension,
    trajectory
  };
}

/**
 * Audits tax deductions and exemptions under the Indian Income Tax Act (80C, 80CCD(1B), 80CCD(2), Rule 9D)
 */
export function auditRetirementTaxShield(retirementSummary) {
  const accounts = retirementSummary?.accounts || [];

  let annual80CContributions = 0;
  let annual80CCD1BContributions = 0;
  let annual80CCD2Employer = 0;
  let rule9DAlerts = [];

  accounts.forEach(acc => {
    if (acc.subType === 'EPF / VPF') {
      const annualEmpShare = acc.monthlyEmp * 12;
      const annualVpf = acc.monthlyVpf * 12;
      annual80CContributions += (annualEmpShare + annualVpf);

      if (acc.isTaxableRule9D) {
        rule9DAlerts.push({
          accountName: acc.name,
          annualContribution: (annualEmpShare + annualVpf),
          taxableExcess: acc.taxableAmount
        });
      }
    } else if (acc.subType === 'PPF') {
      annual80CContributions += acc.fyDeposit;
    } else if (acc.subType === 'NPS Tier 1') {
      const annualSelf = acc.monthlySelf * 12;
      const annualEmpr = acc.monthlyEmployer * 12;
      annual80CCD1BContributions += annualSelf;
      annual80CCD2Employer += annualEmpr;
    }
  });

  // Statutory Caps
  const CAP_80C = 150000;
  const CAP_80CCD1B = 50000;

  const utilized80C = Math.min(CAP_80C, Math.round(annual80CContributions));
  const remaining80C = Math.max(0, CAP_80C - utilized80C);
  const pct80C = Math.min(100, Math.round((utilized80C / CAP_80C) * 100));

  const utilized80CCD1B = Math.min(CAP_80CCD1B, Math.round(annual80CCD1BContributions));
  const remaining80CCD1B = Math.max(0, CAP_80CCD1B - utilized80CCD1B);
  const pct80CCD1B = Math.min(100, Math.round((utilized80CCD1B / CAP_80CCD1B) * 100));

  // 80CCD(2) has no upper absolute cap other than 10% of salary
  const utilized80CCD2 = Math.round(annual80CCD2Employer);

  const totalDeductionsClaimed = utilized80C + utilized80CCD1B + utilized80CCD2;

  // Assuming 30% slab + 4% Health & Education Cess = 31.2% marginal tax rate
  const marginalTaxRate = 0.312;
  const estimatedTaxSaved = Math.round(totalDeductionsClaimed * marginalTaxRate);

  return {
    sec80C: {
      claimed: utilized80C,
      cap: CAP_80C,
      remaining: remaining80C,
      percentage: pct80C,
      isMaxed: utilized80C >= CAP_80C
    },
    sec80CCD1B: {
      claimed: utilized80CCD1B,
      cap: CAP_80CCD1B,
      remaining: remaining80CCD1B,
      percentage: pct80CCD1B,
      isMaxed: utilized80CCD1B >= CAP_80CCD1B
    },
    sec80CCD2: {
      claimed: utilized80CCD2,
      note: 'Corporate NPS 10% salary perk with 0 cap under 80C'
    },
    totalDeductionsClaimed,
    estimatedTaxSaved,
    rule9DAlerts
  };
}

/**
 * Returns deconstructed equity and debt weights to feed into the Portfolio Rebalancer
 */
export function deconstructRetirementForRebalancer(assets = []) {
  const summary = calculateRetirementPortfolio(assets);
  return {
    retirementEquityValue: summary.underlyingAllocation.equityPortion,
    retirementDebtValue: summary.underlyingAllocation.debtPortion,
    totalRetirementCorpus: summary.totalRetirementCorpus
  };
}
