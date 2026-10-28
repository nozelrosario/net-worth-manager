/**
 * Financial Math & Actuarial Engine for Insurance & Protection (LIC, Term, Health & General)
 * Implements Balance Sheet vs Cashflow separation, Human Life Value (HLV) defense score,
 * Surrender Value & Accretion modeling, Renewal & Grace Period Watchdog, and Indian Income Tax Audit
 * (Section 80C, Section 80D, and Budget 2023 Section 10(10D) ₹5 Lakhs cap).
 */

export const INSURANCE_CONSTANTS = {
  DEFAULT_GRACE_PERIOD_DAYS: 30,
  MONTHLY_NACH_GRACE_PERIOD_DAYS: 15,
  HLV_EXPENSE_MULTIPLIER: 15, // 15x annual living expenses
  SEC_80C_MAX_LIMIT: 150000,  // Max Section 80C deduction (₹1.5 Lakhs)
  SEC_80D_SELF_LIMIT: 25000,  // Max Section 80D deduction for Self/Family
  SEC_80D_PARENTS_LIMIT: 50000, // Max Section 80D deduction for Senior Citizen Parents
  SEC_10_10D_PREMIUM_CAP: 500000, // Budget 2023 threshold for non-ULIP life insurance (₹5 Lakhs/yr)
  BUDGET_2023_EFFECTIVE_DATE: '2023-04-01'
};

/**
 * Checks if an asset belongs to Insurance / LIC
 */
export function isInsuranceAsset(asset) {
  if (!asset) return false;
  const cat = (asset.Category || '').toLowerCase();
  const name = (asset.Name || '').toLowerCase();
  const inst = (asset['Institution/Location'] || '').toLowerCase();
  const d = asset['Details JSON'] || {};
  const subType = (d['Policy Type'] || d['Insurance Type'] || '').toLowerCase();

  return (
    cat.includes('insurance') ||
    cat.includes('lic') ||
    cat.includes('policy') ||
    subType.includes('endowment') ||
    subType.includes('money back') ||
    subType.includes('whole life') ||
    subType.includes('ulip') ||
    subType.includes('term') ||
    subType.includes('health') ||
    name.includes('lic') ||
    name.includes('jeevan') ||
    name.includes('term insurance') ||
    name.includes('health insurance') ||
    name.includes('policy') ||
    name.includes('insurance') ||
    inst.includes('lic') ||
    inst.includes('life insurance') ||
    inst.includes('prudential') ||
    inst.includes('hdfc life') ||
    inst.includes('sbi life') ||
    inst.includes('max life') ||
    inst.includes('star health') ||
    inst.includes('care health') ||
    inst.includes('niva bupa') ||
    inst.includes('icici lombard') ||
    inst.includes('ergo')
  );
}

/**
 * Detects the granular policy subtype
 */
export function detectPolicyType(asset) {
  const d = asset?.['Details JSON'] || {};
  const explicit = (d['Policy Type'] || d['Insurance Type'] || '').toLowerCase();
  const name = (asset?.Name || '').toLowerCase();
  const cat = (asset?.Category || '').toLowerCase();

  if (explicit.includes('term') || name.includes('term') || explicit.includes('pure risk')) {
    return 'Pure Term Insurance';
  }
  if (explicit.includes('health') || name.includes('health') || cat.includes('medical') || explicit.includes('mediclaim')) {
    return 'Health Insurance';
  }
  if (explicit.includes('ulip') || name.includes('ulip') || explicit.includes('unit linked')) {
    return 'ULIP';
  }
  if (explicit.includes('money back') || name.includes('money back')) {
    return 'Money Back Plan';
  }
  if (explicit.includes('whole life') || name.includes('whole life') || name.includes('umang')) {
    return 'Whole Life Plan';
  }
  if (explicit.includes('pension') || explicit.includes('annuity') || name.includes('shanti') || name.includes('saral pension')) {
    return 'Pension & Annuity';
  }
  if (explicit.includes('motor') || explicit.includes('vehicle') || name.includes('car insurance') || name.includes('bike insurance')) {
    return 'Motor & Vehicle';
  }
  if (explicit.includes('home') || explicit.includes('property')) {
    return 'Home & Property';
  }
  // Default traditional policy
  return 'Endowment Plan';
}

/**
 * Determines whether the policy is investment-backed (has cash surrender / maturity value)
 * versus pure defensive protection (Value = ₹0)
 */
export function isInvestmentBackedPolicy(policyType) {
  return [
    'Endowment Plan',
    'Money Back Plan',
    'Whole Life Plan',
    'ULIP',
    'Pension & Annuity'
  ].includes(policyType);
}

/**
 * Converts any installment premium into an annualized premium
 */
export function calculateAnnualizedPremium(amount, frequency) {
  const num = Number(amount) || 0;
  if (num <= 0) return 0;
  const freq = (frequency || 'Yearly').toLowerCase();

  if (freq.includes('half')) return num * 2;
  if (freq.includes('quarter')) return num * 4;
  if (freq.includes('month')) return num * 12;
  if (freq.includes('single')) return 0; // one-time
  return num; // Default yearly
}

/**
 * Parses and computes detailed metrics for a single insurance policy
 */
export function calculatePolicyMetrics(asset) {
  const d = asset?.['Details JSON'] || {};
  const policyType = detectPolicyType(asset);
  const isInvestment = isInvestmentBackedPolicy(policyType);

  const policyNo = asset?.Identifiers || d['Policy Number'] || '—';
  const insurer = asset?.['Institution/Location'] || d['Insurer'] || 'LIC';
  const doc = asset?.['Acquisition Date'] || d['Policy Date'] || d['DOC'] || '';

  const cost = Number(asset?.Cost || 0);
  const currentValue = isInvestment ? Number(asset?.['Current Value'] || 0) : 0;
  const netAccretion = isInvestment ? (currentValue - cost) : 0;
  const accretionPct = (isInvestment && cost > 0) ? ((currentValue - cost) / cost) * 100 : 0;

  const sumAssured = Number(d['Sum Assured'] || d['Life Cover'] || d['Basic Sum Assured'] || 0);
  const healthCover = Number(d['Health Cover'] || d['Sum Insured'] || 0);

  const premiumAmount = Number(d['Premium Amount'] || d['Installment Premium'] || 0);
  const premiumFrequency = d['Premium Frequency'] || d['Frequency'] || 'Yearly';
  const annualPremium = calculateAnnualizedPremium(premiumAmount, premiumFrequency);

  const policyTerm = Number(d['Policy Term'] || d['Term'] || 0);
  const ppt = Number(d['Premium Paying Term'] || d['PPT'] || policyTerm || 0);

  // Calculate PPT completion progress
  let paidYears = 0;
  if (annualPremium > 0 && cost > 0) {
    paidYears = Math.min(ppt, Math.max(1, Math.round(cost / annualPremium)));
  } else if (doc) {
    const start = new Date(doc);
    if (!isNaN(start.getTime())) {
      const elapsedYears = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      paidYears = Math.min(ppt, Math.max(0, Math.floor(elapsedYears)));
    }
  }
  const pptProgressPct = ppt > 0 ? Math.min(100, Math.max(0, (paidYears / ppt) * 100)) : 0;

  // Next Premium Due Date & Grace Period Calculation
  const nextDueDateStr = d['Next Due Date'] || d['Due Date'] || '';
  let daysUntilDue = null;
  let isDueSoon = false;
  let isOverdue = false;
  let isInGracePeriod = false;
  let isLapsed = false;
  const gracePeriodDays = Number(d['Grace Period Days'] || (premiumFrequency.toLowerCase().includes('month') ? INSURANCE_CONSTANTS.MONTHLY_NACH_GRACE_PERIOD_DAYS : INSURANCE_CONSTANTS.DEFAULT_GRACE_PERIOD_DAYS));

  if (nextDueDateStr) {
    const dueDate = new Date(nextDueDateStr);
    if (!isNaN(dueDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue >= 0 && daysUntilDue <= 30) {
        isDueSoon = true;
      } else if (daysUntilDue < 0) {
        isOverdue = true;
        if (Math.abs(daysUntilDue) <= gracePeriodDays) {
          isInGracePeriod = true;
        } else {
          isLapsed = true;
        }
      }
    }
  }

  // Budget 2023 Section 10(10D) ₹5 Lakhs Cap Check for non-ULIP policies
  let isBudget2023Taxable = false;
  if (isInvestment && policyType !== 'ULIP' && doc >= INSURANCE_CONSTANTS.BUDGET_2023_EFFECTIVE_DATE) {
    if (annualPremium > INSURANCE_CONSTANTS.SEC_10_10D_PREMIUM_CAP) {
      isBudget2023Taxable = true;
    }
  }

  return {
    assetId: asset?.['Asset ID'],
    name: asset?.Name || 'Insurance Policy',
    category: asset?.Category || 'Life Insurance / LIC',
    policyNo,
    insurer,
    doc,
    policyType,
    isInvestment,
    cost,
    currentValue,
    netAccretion,
    accretionPct,
    sumAssured,
    healthCover,
    premiumAmount,
    premiumFrequency,
    annualPremium,
    policyTerm,
    ppt,
    paidYears,
    pptProgressPct,
    nextDueDate: nextDueDateStr,
    daysUntilDue,
    gracePeriodDays,
    isDueSoon,
    isOverdue,
    isInGracePeriod,
    isLapsed,
    maturityDate: d['Maturity Date'] || '',
    expectedMaturityAmount: Number(d['Expected Maturity Amount'] || d['Maturity Amount'] || 0),
    servicingBranch: d['Servicing Branch'] || '—',
    owner: asset?.Owner || d['Life Assured'] || 'Self',
    nominee: asset?.Nominee || d['Nominee'] || '—',
    isBudget2023Taxable,
    rawAsset: asset
  };
}

/**
 * Consolidated Insurance Metrics across all assets
 */
export function calculateConsolidatedInsurance(assets = [], livingExpensesAnnual = 1200000, totalLiabilities = 0, liquidAssets = 0) {
  const insuranceAssets = assets.filter(isInsuranceAsset);
  const parsedPolicies = insuranceAssets.map(calculatePolicyMetrics);

  let totalLifeCover = 0;
  let totalTermCover = 0;
  let totalEndowmentCover = 0;
  let totalHealthCover = 0;
  let totalAnnualPremium = 0;
  let annualLifePremium = 0;
  let annualHealthPremium = 0;
  let totalCumulativeCost = 0;
  let totalSurrenderValue = 0;

  parsedPolicies.forEach(p => {
    totalAnnualPremium += p.annualPremium;

    if (p.policyType === 'Health Insurance') {
      totalHealthCover += p.healthCover;
      annualHealthPremium += p.annualPremium;
    } else if (p.policyType === 'Pure Term Insurance') {
      totalLifeCover += p.sumAssured;
      totalTermCover += p.sumAssured;
      annualLifePremium += p.annualPremium;
    } else if (p.isInvestment) {
      totalLifeCover += p.sumAssured;
      totalEndowmentCover += p.sumAssured;
      annualLifePremium += p.annualPremium;
      totalCumulativeCost += p.cost;
      totalSurrenderValue += p.currentValue;
    } else {
      // General / Motor
      totalAnnualPremium += p.annualPremium;
    }
  });

  const totalNetAccretion = totalSurrenderValue - totalCumulativeCost;
  const overallAccretionPct = totalCumulativeCost > 0 ? (totalNetAccretion / totalCumulativeCost) * 100 : 0;

  // Upcoming Renewals & Grace Period Watchdog (sorted by proximity)
  const upcomingRenewals = parsedPolicies
    .filter(p => p.daysUntilDue !== null && (p.isDueSoon || p.isOverdue))
    .sort((a, b) => (a.daysUntilDue || 0) - (b.daysUntilDue || 0));

  // Human Life Value (HLV) Defense Calculations
  const hlv = calculateHumanLifeValue(livingExpensesAnnual, totalLiabilities, liquidAssets, totalLifeCover);

  // Tax Exemption Audit (Section 80C and Section 80D)
  const taxAudit = calculateInsuranceTaxAudit(parsedPolicies);

  return {
    policiesCount: parsedPolicies.length,
    policies: parsedPolicies,
    totalLifeCover,
    totalTermCover,
    totalEndowmentCover,
    totalHealthCover,
    totalAnnualPremium,
    annualLifePremium,
    annualHealthPremium,
    totalCumulativeCost,
    totalSurrenderValue,
    totalNetAccretion,
    overallAccretionPct,
    upcomingRenewals,
    hlv,
    taxAudit
  };
}

/**
 * Human Life Value (HLV) & Protection Adequacy Formula:
 * Required Life Cover = (15x Annual Living Expenses) + Total Outstanding Debt - Liquid Net Worth
 */
export function calculateHumanLifeValue(annualLivingExpenses = 1200000, totalLiabilities = 0, liquidAssets = 0, currentLifeCover = 0) {
  const expenseCoverNeeded = Math.round(annualLivingExpenses * INSURANCE_CONSTANTS.HLV_EXPENSE_MULTIPLIER);
  const grossProtectionRequired = expenseCoverNeeded + totalLiabilities;
  const netProtectionRequired = Math.max(0, grossProtectionRequired - liquidAssets);

  const coverageRatio = netProtectionRequired > 0 
    ? Math.min(100, Math.round((currentLifeCover / netProtectionRequired) * 100))
    : 100;

  const deficit = Math.max(0, netProtectionRequired - currentLifeCover);
  const surplus = Math.max(0, currentLifeCover - netProtectionRequired);

  let status = 'adequate';
  let message = 'Your family is adequately shielded against debt and long-term living expenses.';

  if (coverageRatio < 50) {
    status = 'critical';
    message = `Critical Underinsurance Gap: You need ₹${formatInLakhsOrCrores(deficit)} in additional term life cover to protect liabilities and family expenses.`;
  } else if (coverageRatio < 85) {
    status = 'moderate';
    message = `Moderate Protection Gap: Consider enhancing your term cover by ₹${formatInLakhsOrCrores(deficit)} to fully insulate future family goals.`;
  }

  return {
    annualLivingExpenses,
    expenseCoverNeeded,
    totalLiabilities,
    liquidAssets,
    netProtectionRequired,
    currentLifeCover,
    coverageRatio,
    deficit,
    surplus,
    status,
    message
  };
}

/**
 * Calculates Section 80C & Section 80D tax deductions and Budget 2023 flags
 */
export function calculateInsuranceTaxAudit(policies = []) {
  let eligible80CLife = 0;
  let eligible80DHealth = 0;
  let highPremiumPoliciesCount = 0;

  policies.forEach(p => {
    if (p.policyType !== 'Health Insurance' && p.policyType !== 'Motor & Vehicle' && p.policyType !== 'Home & Property') {
      eligible80CLife += p.annualPremium;
    }
    if (p.policyType === 'Health Insurance') {
      eligible80DHealth += p.annualPremium;
    }
    if (p.isBudget2023Taxable) {
      highPremiumPoliciesCount++;
    }
  });

  const claimed80C = Math.min(INSURANCE_CONSTANTS.SEC_80C_MAX_LIMIT, eligible80CLife);
  const claimed80D = Math.min(INSURANCE_CONSTANTS.SEC_80D_SELF_LIMIT, eligible80DHealth);
  
  // Tax saved in 30% slab (+ 4% cess = 31.2%)
  const estimatedTaxSavings = Math.round((claimed80C + claimed80D) * 0.312);

  return {
    eligible80CLife,
    claimed80C,
    eligible80DHealth,
    claimed80D,
    estimatedTaxSavings,
    highPremiumPoliciesCount,
    hasHighPremiumAlert: highPremiumPoliciesCount > 0
  };
}

/**
 * Helper to format large numbers in Lakhs and Crores
 */
export function formatInLakhsOrCrores(amount) {
  const num = Number(amount) || 0;
  if (num >= 10000000) {
    return (num / 10000000).toFixed(2) + ' Cr';
  }
  if (num >= 100000) {
    return (num / 100000).toFixed(1) + ' Lakhs';
  }
  return num.toLocaleString('en-IN');
}
