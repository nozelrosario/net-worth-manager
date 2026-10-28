import React, { useState, useMemo } from 'react';
import useModalBack from '../hooks/useModalBack';
import { 
  ArrowLeft, Shield, Sparkles, CheckCircle2, AlertCircle, 
  Copy, Check, Plus, Sliders, ChevronRight, FolderLock, ExternalLink, 
  Calendar, RefreshCw, Award, PieChart, Heart, HeartPulse, Stethoscope, 
  Car, Home, FileText, X, AlertTriangle, ArrowUpRight, Clock, DollarSign, Wallet
} from 'lucide-react';
import { 
  calculateConsolidatedInsurance, 
  calculateHumanLifeValue, 
  formatInLakhsOrCrores,
  INSURANCE_CONSTANTS 
} from '../utils/insuranceMath';
import { Badge } from './Badge';
import { getSafeStorage } from '../utils/storage';

export default function InsuranceHubModal({
  isOpen,
  onClose,
  data,
  formatCurrency,
  showMessage,
  onOpenAddAsset,
  onOpenEditAsset,
  onRefresh,
  onNavigateToSafe
}) {
  useModalBack(isOpen, onClose);

  const assets = data?.assets || [];
  const transactions = data?.transactions || [];

  // Derive annual living expenses from spends if available, else default to ₹12,00,000
  const estimatedAnnualExpenses = useMemo(() => {
    const expenses = transactions
      .filter(t => t.Type === 'Expense' || (!t.Type && Number(t.Amount) > 0 && !t['Is Transfer']))
      .reduce((sum, t) => sum + Math.abs(Number(t.Amount || 0)), 0);
    
    // If we have some expense transactions, extrapolate to annual or use default
    return expenses > 100000 ? Math.round(expenses * 1.2) : 1200000;
  }, [transactions]);

  // Derive total outstanding liabilities
  const totalLiabilities = useMemo(() => {
    return assets
      .filter(a => a.Category === 'Liabilities')
      .reduce((sum, a) => sum + Number(a['Current Value'] || a.Cost || 0), 0);
  }, [assets]);

  // Derive liquid assets (Cash/FD + Mutual Funds)
  const liquidAssets = useMemo(() => {
    return assets
      .filter(a => a.Category === 'Cash/FD' || a.Category === 'Mutual Funds')
      .reduce((sum, a) => sum + Number(a['Current Value'] || 0), 0);
  }, [assets]);

  // Interactive controls for HLV calculation
  const [annualExpensesInput, setAnnualExpensesInput] = useState(estimatedAnnualExpenses);
  const [activeCategoryTab, setActiveCategoryTab] = useState('all'); // all | life | health | motor
  const [copied, setCopied] = useState(false);
  const [isLoggingPremium, setIsLoggingPremium] = useState(false);
  const [selectedPolicyForPayment, setSelectedPolicyForPayment] = useState(null);
  const [paymentAccount, setPaymentAccount] = useState('Primary Bank A/c');

  // Consolidated Insurance metrics
  const insuranceData = useMemo(() => {
    return calculateConsolidatedInsurance(assets, annualExpensesInput, totalLiabilities, liquidAssets);
  }, [assets, annualExpensesInput, totalLiabilities, liquidAssets]);

  // Copy Emergency Family Protection & Claim Kit to Clipboard
  const handleCopyClaimKit = () => {
    const lines = [
      `=== FAMILY EMERGENCY INSURANCE & CLAIM KIT ===`,
      `Generated from Net Worth Manager`,
      ``,
      `--- TOTAL COVER SUMMARY ---`,
      `Total Life Protection Cover: ₹${formatInLakhsOrCrores(insuranceData.totalLifeCover)}`,
      `Total Health Insurance Cover: ₹${formatInLakhsOrCrores(insuranceData.totalHealthCover)}`,
      `Annual Premium Drag: ${formatCurrency(insuranceData.totalAnnualPremium)}/year`,
      `Family Protection Defense Score: ${insuranceData.hlv.coverageRatio}%`,
      ``,
      `--- ACTIVE POLICIES & NOMINEES ---`
    ];

    insuranceData.policies.forEach((p, idx) => {
      lines.push(`${idx + 1}. ${p.name} (${p.insurer})`);
      lines.push(`   • Policy No: ${p.policyNo}`);
      lines.push(`   • Type: ${p.policyType}`);
      if (p.sumAssured > 0) lines.push(`   • Sum Assured: ₹${formatInLakhsOrCrores(p.sumAssured)}`);
      if (p.healthCover > 0) lines.push(`   • Health Sum Insured: ₹${formatInLakhsOrCrores(p.healthCover)}`);
      lines.push(`   • Regular Premium: ${formatCurrency(p.premiumAmount)} (${p.premiumFrequency})`);
      lines.push(`   • Next Due Date: ${p.nextDueDate || 'N/A'}`);
      lines.push(`   • Nominee: ${p.nominee}`);
      lines.push(`   • Servicing Branch: ${p.servicingBranch}`);
      lines.push(``);
    });

    lines.push(`--- EMERGENCY CLAIM CONTACTS ---`);
    lines.push(`LIC Claim Toll-Free: 1800-227-717 / SMS LICHELP to 9222492224`);
    lines.push(`Health TPA / Cashless Card Details stored in Family Safe.`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    showMessage('Emergency Insurance & Claim Kit copied to clipboard!');
  };

  // Quick Action: Log Premium Paid & Increment Cumulative Cost
  const handleExecutePremiumPayment = (policy) => {
    if (!policy) return;
    setIsLoggingPremium(true);

    const premiumAmt = policy.premiumAmount || policy.annualPremium || 0;
    const todayStr = new Date().toISOString().split('T')[0];

    // Advance next due date by 1 year (or frequency interval)
    let advancedDueDate = '';
    if (policy.nextDueDate) {
      const d = new Date(policy.nextDueDate);
      if (!isNaN(d.getTime())) {
        const freq = (policy.premiumFrequency || 'Yearly').toLowerCase();
        if (freq.includes('month')) {
          d.setMonth(d.getMonth() + 1);
        } else if (freq.includes('quarter')) {
          d.setMonth(d.getMonth() + 3);
        } else if (freq.includes('half')) {
          d.setMonth(d.getMonth() + 6);
        } else {
          d.setFullYear(d.getFullYear() + 1);
        }
        advancedDueDate = d.toISOString().split('T')[0];
      }
    }

    const newCumulativeCost = Number(policy.cost || 0) + Number(premiumAmt);
    const updatedDetails = {
      ...(typeof policy.rawAsset?.['Details JSON'] === 'string' 
        ? JSON.parse(policy.rawAsset['Details JSON'] || '{}') 
        : (policy.rawAsset?.['Details JSON'] || {}))
    };
    if (advancedDueDate) {
      updatedDetails['Next Due Date'] = advancedDueDate;
    }

    const token = getSafeStorage('nwm_session_token');

    if (window.google?.script?.run) {
      // 1. Add Transaction
      const txnRecord = {
        'Txn ID': `TXN_PREM_${Date.now()}`,
        Date: todayStr,
        Type: policy.isInvestment ? 'Investment' : 'Expense',
        Amount: Number(premiumAmt),
        Category: policy.isInvestment ? 'Investment / Insurance' : 'Insurance',
        'Account/Card': paymentAccount,
        'Merchant/Description': `Premium Paid: ${policy.name} (${policy.policyNo})`,
        Tags: `Insurance Premium, Sec 80C, Policy_${policy.policyNo}`
      };

      window.google.script.run
        .withSuccessHandler(() => {
          // 2. Update Asset Cost & Next Due Date
          const updatedAsset = {
            ...policy.rawAsset,
            Cost: newCumulativeCost,
            'Details JSON': JSON.stringify(updatedDetails)
          };

          window.google.script.run
            .withSuccessHandler(() => {
              setIsLoggingPremium(false);
              setSelectedPolicyForPayment(null);
              if (onRefresh) onRefresh();
              showMessage(`Premium of ${formatCurrency(premiumAmt)} logged! Cumulative cost updated to ${formatCurrency(newCumulativeCost)}.`);
            })
            .withFailureHandler((err) => {
              setIsLoggingPremium(false);
              showMessage('Asset Update Error: ' + err.message, true);
            })
            .updateRecord('Assets', 'Asset ID', policy.assetId, updatedAsset, token);
        })
        .withFailureHandler((err) => {
          setIsLoggingPremium(false);
          showMessage('Transaction Error: ' + err.message, true);
        })
        .addRecord('Transactions', txnRecord, token);
    } else {
      // Local preview / mock handler
      setTimeout(() => {
        setIsLoggingPremium(false);
        setSelectedPolicyForPayment(null);
        if (onRefresh) onRefresh();
        showMessage(`Premium of ${formatCurrency(premiumAmt)} logged (preview)!`);
      }, 700);
    }
  };

  if (!isOpen) return null;

  // Filter policies based on active tab
  const filteredPolicies = insuranceData.policies.filter(p => {
    if (activeCategoryTab === 'all') return true;
    if (activeCategoryTab === 'life') {
      return p.policyType.includes('Endowment') || p.policyType.includes('Term') || p.policyType.includes('ULIP') || p.policyType.includes('Money Back') || p.policyType.includes('Whole Life');
    }
    if (activeCategoryTab === 'health') {
      return p.policyType.includes('Health');
    }
    if (activeCategoryTab === 'motor') {
      return p.policyType.includes('Motor') || p.policyType.includes('Home');
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto no-scrollbar animate-fadeIn">
      <div className="bg-background-root border border-border-subtle rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative text-text-primary my-auto">
        
        {/* TOP MODAL APP BAR */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-background-root/95 backdrop-blur-xl border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:bg-surface-layer1 hover:text-text-primary active:scale-95 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-text-primary leading-tight">
                  Insurance &amp; Protection Hub
                </h2>
                <Badge variant="emerald" size="xs" dot pulse>
                  Sec 80C &amp; 80D
                </Badge>
              </div>
              <p className="text-[11px] text-text-muted">LIC, Term Life, Health &amp; Family Defense Moat</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClaimKit}
              className="px-2.5 py-1.5 rounded-xl bg-surface-layer1 border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-prominent text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Copy Emergency Claim Kit"
            >
              {copied ? <Check size={14} className="text-wealth-emerald" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Claim Kit'}</span>
            </button>
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-layer1 transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-4">

          {/* 1. CONSOLIDATED DEFENSE MOAT HERO CARD */}
          <section className="rounded-2xl p-4 sm:p-5 bg-surface-layer1 border border-border-subtle relative overflow-hidden shadow-lg">
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-primary-accent/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                <Shield size={14} className="text-primary-accent" />
                Consolidated Protection Moat
              </span>
              <Badge 
                variant={insuranceData.hlv.status === 'adequate' ? 'emerald' : insuranceData.hlv.status === 'moderate' ? 'amber' : 'rose'} 
                size="sm"
                dot
              >
                {insuranceData.hlv.coverageRatio}% HLV Shielded
              </Badge>
            </div>

            {/* Triad Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
              <div className="bg-surface-layer2/70 rounded-xl p-3 border border-border-subtle/60">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <Shield size={14} className="text-primary-accent" />
                  <span>Total Life Cover</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-text-primary num-tabular">
                  ₹{formatInLakhsOrCrores(insuranceData.totalLifeCover)}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  Term: ₹{formatInLakhsOrCrores(insuranceData.totalTermCover)} • LIC: ₹{formatInLakhsOrCrores(insuranceData.totalEndowmentCover)}
                </div>
              </div>

              <div className="bg-surface-layer2/70 rounded-xl p-3 border border-border-subtle/60">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <HeartPulse size={14} className="text-cyan-400" />
                  <span>Health Cover</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-cyan-400 num-tabular">
                  ₹{formatInLakhsOrCrores(insuranceData.totalHealthCover)}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  Base + Super Top-up Floater
                </div>
              </div>

              <div className="bg-surface-layer2/70 rounded-xl p-3 border border-border-subtle/60">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <Wallet size={14} className="text-bullion-amber" />
                  <span>Annual Premium Drag</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-text-primary num-tabular">
                  {formatCurrency(insuranceData.totalAnnualPremium)}
                </div>
                <div className="text-[10px] text-wealth-emerald font-medium mt-0.5">
                  ~{formatCurrency(insuranceData.taxAudit.estimatedTaxSaved)} Tax Shielded (30%)
                </div>
              </div>
            </div>

            {/* Accretion Ribbon for Investment-Backed Policies */}
            {insuranceData.totalSurrenderValue > 0 && (
              <div className="pt-3 border-t border-border-subtle/60 flex flex-wrap items-center justify-between text-xs gap-2">
                <div>
                  <span className="text-text-muted">Total Cumulative Cost: </span>
                  <span className="font-semibold text-text-primary num-tabular">{formatCurrency(insuranceData.totalCumulativeCost)}</span>
                  <span className="text-text-muted mx-1.5">•</span>
                  <span className="text-text-muted">Surrender Value: </span>
                  <span className="font-semibold text-wealth-emerald num-tabular">{formatCurrency(insuranceData.totalSurrenderValue)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="emerald" size="xs">
                    ▲ +{formatCurrency(insuranceData.totalNetAccretion)} (+{insuranceData.overallAccretionPct.toFixed(1)}% Accretion)
                  </Badge>
                </div>
              </div>
            )}
          </section>

          {/* 2. RENEWAL WATCHDOG & GRACE PERIOD ALERT RIBBON */}
          {insuranceData.upcomingRenewals.length > 0 && (
            <section className="rounded-xl p-3.5 bg-bullion-amber/10 border border-bullion-amber/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-bullion-amber animate-pulse"></span>
                  <h3 className="text-xs font-bold text-bullion-amber flex items-center gap-1.5">
                    <Clock size={14} />
                    Upcoming Premium Renewals ({insuranceData.upcomingRenewals.length})
                  </h3>
                </div>
                <span className="text-[10px] text-bullion-amber font-mono">Next 30 Days</span>
              </div>

              <div className="space-y-2 pt-1">
                {insuranceData.upcomingRenewals.map(p => (
                  <div key={p.assetId} className="flex flex-wrap items-center justify-between p-2.5 rounded-lg bg-surface-layer2/70 border border-bullion-amber/20 text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-bullion-amber/20 flex items-center justify-center text-bullion-amber shrink-0 font-bold text-xs">
                        {p.insurer.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-text-primary truncate">{p.name}</div>
                        <div className="text-[10px] text-text-muted">
                          Due: <span className="font-medium text-bullion-amber">{p.nextDueDate}</span>
                          {p.daysUntilDue !== null && (
                            <span className="ml-1">
                              ({p.daysUntilDue >= 0 ? `in ${p.daysUntilDue} days` : `${Math.abs(p.daysUntilDue)} days overdue - Grace Period`})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <span className="font-bold text-text-primary num-tabular text-right">
                        {formatCurrency(p.premiumAmount || p.annualPremium)}
                      </span>
                      <button
                        onClick={() => setSelectedPolicyForPayment(p)}
                        className="px-2.5 py-1 rounded-lg bg-bullion-amber text-black font-semibold text-[11px] hover:bg-bullion-amber/90 transition-all active:scale-95 shadow-xs"
                      >
                        Log Premium
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. CATEGORY FILTER CHIPS & ADD POLICY CTA */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => setActiveCategoryTab('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  activeCategoryTab === 'all'
                    ? 'bg-primary-accent text-white shadow-xs'
                    : 'bg-surface-layer1 border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                All Policies ({insuranceData.policiesCount})
              </button>
              <button
                onClick={() => setActiveCategoryTab('life')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  activeCategoryTab === 'life'
                    ? 'bg-primary-accent text-white shadow-xs'
                    : 'bg-surface-layer1 border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                Life &amp; LIC
              </button>
              <button
                onClick={() => setActiveCategoryTab('health')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  activeCategoryTab === 'health'
                    ? 'bg-primary-accent text-white shadow-xs'
                    : 'bg-surface-layer1 border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                Health
              </button>
              <button
                onClick={() => setActiveCategoryTab('motor')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  activeCategoryTab === 'motor'
                    ? 'bg-primary-accent text-white shadow-xs'
                    : 'bg-surface-layer1 border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                Motor &amp; General
              </button>
            </div>

            <button
              onClick={() => {
                onClose();
                if (onOpenAddAsset) onOpenAddAsset('Life Insurance / LIC');
              }}
              className="px-3 py-1 rounded-xl bg-primary-accent/15 border border-primary-accent/30 text-primary-accent hover:bg-primary-accent hover:text-white text-xs font-semibold flex items-center gap-1 transition-all shrink-0 active:scale-95"
            >
              <Plus size={14} />
              <span>Add Policy</span>
            </button>
          </div>

          {/* 4. ACTIVE POLICIES LIST */}
          <div className="space-y-3">
            {filteredPolicies.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-surface-layer1 border border-border-subtle space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-accent/10 border border-primary-accent/20 flex items-center justify-center mx-auto text-primary-accent">
                  <Shield size={24} />
                </div>
                <h4 className="text-sm font-bold text-text-primary">No Insurance Policies Tracked</h4>
                <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                  Track your LIC endowment plans, pure term insurance, and family health floaters with automated premium schedules and cashflow syncing.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenAddAsset) onOpenAddAsset('Life Insurance / LIC');
                  }}
                  className="px-4 py-2 rounded-xl bg-primary-accent text-white text-xs font-semibold shadow-xs hover:bg-primary-accent/90 transition-all inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add First Policy</span>
                </button>
              </div>
            ) : (
              filteredPolicies.map(policy => (
                <article 
                  key={policy.assetId}
                  className="rounded-xl sm:rounded-2xl p-4 bg-surface-layer1 border border-border-subtle space-y-3 relative hover:border-border-prominent transition-all shadow-xs"
                >
                  {/* Policy Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-wealth-emerald"></span>
                        <h4 className="text-sm sm:text-base font-bold text-text-primary truncate">{policy.name}</h4>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">
                        Policy #{policy.policyNo} • {policy.insurer}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge 
                        variant={policy.isInvestment ? 'emerald' : policy.policyType.includes('Health') ? 'sky' : 'indigo'} 
                        size="xs"
                      >
                        {policy.policyType}
                      </Badge>
                      <span className="text-[10px] text-text-muted">
                        {policy.policyType.includes('Health') ? 'Sec 80D' : 'Sec 80C'}
                      </span>
                    </div>
                  </div>

                  {/* Financial Values Grid */}
                  <div className="grid grid-cols-2 gap-3 py-2.5 px-3 rounded-xl bg-surface-layer2/50 border border-border-subtle/40">
                    <div>
                      <span className="text-[11px] text-text-muted">
                        {policy.isInvestment ? 'Current Surrender Value' : 'Life / Sum Insured'}
                      </span>
                      <div className={`text-base sm:text-lg font-bold num-tabular ${policy.isInvestment ? 'text-wealth-emerald' : 'text-primary-accent'}`}>
                        {policy.isInvestment 
                          ? formatCurrency(policy.currentValue)
                          : (policy.sumAssured > 0 ? `₹${formatInLakhsOrCrores(policy.sumAssured)}` : `₹${formatInLakhsOrCrores(policy.healthCover)}`)}
                      </div>
                      {policy.isInvestment && policy.cost > 0 && (
                        <div className="text-[10px] text-wealth-emerald font-medium">
                          {policy.netAccretion >= 0 ? '+' : ''}{formatCurrency(policy.netAccretion)} ({policy.accretionPct.toFixed(1)}%)
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] text-text-muted">
                        {policy.isInvestment ? 'Cumulative Premiums Paid' : 'Annual Premium'}
                      </span>
                      <div className="text-base sm:text-lg font-bold text-text-primary num-tabular">
                        {policy.isInvestment ? formatCurrency(policy.cost) : formatCurrency(policy.annualPremium)}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {policy.ppt > 0 ? `${policy.paidYears} of ${policy.ppt} Years Paid` : policy.premiumFrequency}
                      </div>
                    </div>
                  </div>

                  {/* PPT Completion Progress Bar for Endowment / Traditional Policies */}
                  {policy.ppt > 0 && policy.isInvestment && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>Premium Term Progress ({policy.paidYears} / {policy.ppt} Years)</span>
                        <span className="font-semibold text-text-secondary">{policy.pptProgressPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-layer2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary-accent h-full rounded-full transition-all duration-500" 
                          style={{ width: `${policy.pptProgressPct}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Metadata Chips / Key Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-xs pt-1 border-t border-border-subtle/50 text-text-secondary">
                    {policy.sumAssured > 0 && (
                      <div>Life Cover: <span className="font-semibold text-text-primary num-tabular">₹{formatInLakhsOrCrores(policy.sumAssured)}</span></div>
                    )}
                    <div>Premium: <span className="font-semibold text-text-primary num-tabular">{formatCurrency(policy.premiumAmount)} ({policy.premiumFrequency})</span></div>
                    <div>Next Due: <span className={`font-semibold ${policy.isOverdue ? 'text-liability-rose' : policy.isDueSoon ? 'text-bullion-amber' : 'text-text-primary'}`}>
                      {policy.nextDueDate || '—'}
                    </span></div>
                    {policy.maturityDate && (
                      <div>Maturity: <span className="font-semibold text-text-primary">{policy.maturityDate}</span></div>
                    )}
                    {policy.expectedMaturityAmount > 0 && (
                      <div>Est. Corpus: <span className="font-semibold text-wealth-emerald num-tabular">₹{formatInLakhsOrCrores(policy.expectedMaturityAmount)}</span></div>
                    )}
                    <div>Nominee: <span className="font-semibold text-text-primary truncate">{policy.nominee}</span></div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 flex items-center justify-between border-t border-border-subtle/50 text-xs">
                    <button
                      onClick={() => setSelectedPolicyForPayment(policy)}
                      className="inline-flex items-center gap-1 text-primary-accent hover:text-primary-accent/80 font-semibold text-[11px] transition-colors"
                    >
                      <Plus size={14} />
                      <span>Log Premium ({formatCurrency(policy.premiumAmount || policy.annualPremium)})</span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-text-muted">
                      {onNavigateToSafe && (
                        <button 
                          onClick={() => {
                            onClose();
                            onNavigateToSafe();
                          }}
                          className="hover:text-text-primary flex items-center gap-1 transition-colors"
                          title="View Policy Document in Safe"
                        >
                          <FolderLock size={13} />
                          <span>Safe PDF</span>
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          onClose();
                          if (onOpenEditAsset) onOpenEditAsset(policy.rawAsset);
                        }}
                        className="hover:text-text-primary flex items-center gap-1 transition-colors"
                      >
                        <Sliders size={13} />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* 5. HUMAN LIFE VALUE (HLV) AUDIT & DEFENSE METER */}
          <section className="rounded-2xl p-4 sm:p-5 bg-surface-layer1 border border-border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Shield size={16} className="text-primary-accent" />
                Human Life Value (HLV) Defense Audit
              </h3>
              <Badge 
                variant={insuranceData.hlv.status === 'adequate' ? 'emerald' : insuranceData.hlv.status === 'moderate' ? 'amber' : 'rose'} 
                size="xs"
              >
                {insuranceData.hlv.status === 'adequate' ? 'Adequately Shielded' : 'Protection Gap'}
              </Badge>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Based on your annual household living expenses (<span className="text-text-primary font-semibold">{formatCurrency(insuranceData.hlv.annualLivingExpenses)}/yr</span>) and active debt (<span className="text-text-primary font-semibold">{formatCurrency(insuranceData.hlv.totalLiabilities)}</span>), your recommended life cover is <span className="text-text-primary font-semibold">₹{formatInLakhsOrCrores(insuranceData.hlv.netProtectionRequired)}</span>.
            </p>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-text-muted">Coverage Ratio (₹{formatInLakhsOrCrores(insuranceData.totalLifeCover)} / ₹{formatInLakhsOrCrores(insuranceData.hlv.netProtectionRequired)})</span>
                <span className={`font-semibold ${insuranceData.hlv.coverageRatio >= 85 ? 'text-wealth-emerald' : 'text-bullion-amber'}`}>
                  {insuranceData.hlv.coverageRatio}% Protected
                </span>
              </div>
              <div className="h-2 w-full bg-surface-layer2 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full transition-all duration-500 ${insuranceData.hlv.coverageRatio >= 85 ? 'bg-wealth-emerald' : 'bg-bullion-amber'}`}
                  style={{ width: `${Math.min(100, insuranceData.hlv.coverageRatio)}%` }}
                ></div>
              </div>
            </div>

            <div className="text-[11px] text-text-muted flex items-start gap-1.5 pt-1">
              <CheckCircle2 size={14} className="text-wealth-emerald shrink-0 mt-0.5" />
              <span>{insuranceData.hlv.message}</span>
            </div>
          </section>

          {/* 6. TAX SHIELD AUDIT (SECTION 80C & 80D) */}
          <section className="rounded-2xl p-4 bg-surface-layer1 border border-border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Award size={16} className="text-wealth-emerald" />
                Insurance Tax Shields (FY 2026-27)
              </h3>
              <span className="text-xs font-bold text-wealth-emerald num-tabular">
                +{formatCurrency(insuranceData.taxAudit.estimatedTaxSaved)} Saved
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-layer2/60 border border-border-subtle/50 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-text-primary">Section 80C (Life Insurance)</span>
                  <span className="text-text-muted text-[10px]">Cap: ₹1.5L</span>
                </div>
                <div className="text-sm font-bold text-text-primary num-tabular">
                  {formatCurrency(insuranceData.taxAudit.claimed80C)}
                </div>
                <p className="text-[10px] text-text-muted">
                  Premiums paid towards LIC &amp; term life eligible for deduction.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-layer2/60 border border-border-subtle/50 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-text-primary">Section 80D (Health Insurance)</span>
                  <span className="text-text-muted text-[10px]">Cap: ₹25k / ₹50k</span>
                </div>
                <div className="text-sm font-bold text-cyan-400 num-tabular">
                  {formatCurrency(insuranceData.taxAudit.claimed80D)}
                </div>
                <p className="text-[10px] text-text-muted">
                  Dedicated health insurance exemption outside of 80C.
                </p>
              </div>
            </div>

            {insuranceData.taxAudit.hasHighPremiumAlert && (
              <div className="p-2.5 rounded-lg bg-liability-rose/10 border border-liability-rose/30 text-[11px] text-liability-rose flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>
                  Budget 2023 Alert: One or more non-ULIP life policies issued after 1 Apr 2023 exceed the ₹5,00,000 annual premium threshold; maturity proceeds will be taxable under Other Sources.
                </span>
              </div>
            )}
          </section>

        </div>

        {/* LOG PREMIUM PAYMENT DIALOG MODAL */}
        {selectedPolicyForPayment && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-scaleUp">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-base font-bold text-text-primary">Log Premium Payment</h4>
                  <p className="text-xs text-text-muted truncate max-w-[240px]">{selectedPolicyForPayment.name}</p>
                </div>
                <button 
                  onClick={() => setSelectedPolicyForPayment(null)}
                  className="text-text-muted hover:text-text-primary p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-text-muted block mb-1">Premium Amount (₹)</label>
                  <input
                    type="number"
                    defaultValue={selectedPolicyForPayment.premiumAmount || selectedPolicyForPayment.annualPremium}
                    id="modal-prem-amt"
                    className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary font-semibold focus:outline-none focus:border-primary-accent"
                  />
                </div>

                <div>
                  <label className="text-text-muted block mb-1">Debited From Account / Card</label>
                  <input
                    type="text"
                    value={paymentAccount}
                    onChange={(e) => setPaymentAccount(e.target.value)}
                    placeholder="e.g. SBI A/c ••4089"
                    className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-primary-accent"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-surface-layer2/80 border border-border-subtle/60 text-[11px] text-text-secondary space-y-1">
                  <div className="flex justify-between">
                    <span>Double-Entry Action:</span>
                    <span className="text-wealth-emerald font-semibold">Expense + Cost Accretion</span>
                  </div>
                  <p className="text-text-muted">
                    Debits your bank account and increases this policy's cumulative cost base to preserve true net worth.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPolicyForPayment(null)}
                  className="flex-1 py-2 rounded-xl bg-surface-layer2 border border-border-subtle text-text-secondary hover:text-text-primary font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isLoggingPremium}
                  onClick={() => {
                    const el = document.getElementById('modal-prem-amt');
                    const amt = el ? Number(el.value) : selectedPolicyForPayment.premiumAmount;
                    handleExecutePremiumPayment({
                      ...selectedPolicyForPayment,
                      premiumAmount: amt
                    });
                  }}
                  className="flex-1 py-2 rounded-xl bg-primary-accent text-white font-semibold text-xs hover:bg-primary-accent/90 transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isLoggingPremium ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Confirm Pay</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
