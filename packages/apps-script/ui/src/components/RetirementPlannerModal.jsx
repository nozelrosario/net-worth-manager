import React, { useState, useMemo } from 'react';
import useModalBack from '../hooks/useModalBack';
import { 
  ArrowLeft, Shield, TrendingUp, Sparkles, CheckCircle2, AlertCircle, 
  Copy, Check, Plus, Sliders, ChevronRight, FolderLock, ExternalLink, 
  HelpCircle, Calendar, RefreshCw, Award, PieChart, Coins, Landmark, DollarSign
} from 'lucide-react';
import { 
  calculateRetirementPortfolio, 
  calculatePensionProjection, 
  auditRetirementTaxShield,
  RETIREMENT_RATES 
} from '../utils/retirementMath';
import { Badge } from './Badge';

export default function RetirementPlannerModal({
  isOpen,
  onClose,
  data,
  formatCurrency,
  showMessage,
  onOpenAddAsset
}) {
  useModalBack(isOpen, onClose);

  const assets = data?.assets || [];

  // Retirement calculations
  const retirementSummary = useMemo(() => {
    return calculateRetirementPortfolio(assets);
  }, [assets]);

  const taxAudit = useMemo(() => {
    return auditRetirementTaxShield(retirementSummary);
  }, [retirementSummary]);

  // Simulator controls
  const [currentAge, setCurrentAge] = useState(32);
  const [retirementAge, setRetirementAge] = useState(60);
  const [stepUpPct, setStepUpPct] = useState(5);
  const [expectedReturnPct, setExpectedReturnPct] = useState(retirementSummary.effectiveWeightedYield || 9.8);
  const [copied, setCopied] = useState(false);
  const [activeAccountTab, setActiveAccountTab] = useState('all'); // all, epf, nps, ppf

  // Run projection
  const projection = useMemo(() => {
    return calculatePensionProjection({
      currentCorpus: retirementSummary.totalRetirementCorpus,
      monthlyInflow: retirementSummary.totalMonthlyInflow,
      currentAge,
      retirementAge,
      expectedReturnPct,
      stepUpPct,
      annuityPct: 40,
      annuityRatePct: RETIREMENT_RATES.ANNUITY_RATE_DEFAULT,
      inflationPct: 5.5
    });
  }, [retirementSummary, currentAge, retirementAge, expectedReturnPct, stepUpPct]);

  // Copy blueprint to clipboard
  const handleCopySummary = () => {
    const lines = [
      `=== NET WORTH MANAGER: RETIREMENT & PENSION BLUEPRINT ===`,
      `Total Retirement Corpus: ${formatCurrency(retirementSummary.totalRetirementCorpus)}`,
      `Monthly Inflow: +${formatCurrency(retirementSummary.totalMonthlyInflow)}/mo`,
      `Estimated FY Interest Accrual: +${formatCurrency(retirementSummary.totalAccruedInterestFY)}`,
      `Asset Allocation: ${retirementSummary.underlyingAllocation.debtPct}% Sovereign Debt | ${retirementSummary.underlyingAllocation.equityPct}% NPS Equity`,
      ``,
      `--- AGE ${retirementAge} RETIREMENT FORECAST ---`,
      `Projected Nominal Corpus: ${formatCurrency(projection.finalCorpus)}`,
      `60% Tax-Free Lump Sum: ${formatCurrency(projection.lumpSumAmount)}`,
      `40% Annuity Corpus: ${formatCurrency(projection.annuityCorpus)}`,
      `Estimated Monthly Pension: ${formatCurrency(projection.projectedMonthlyPension)}/mo`,
      `Inflation-Adjusted Purchasing Power: ${formatCurrency(projection.realMonthlyPension)}/mo (at 5.5% inflation)`,
      ``,
      `--- TAX SHIELD & PERKS AUDIT ---`,
      `Sec 80C Claimed: ${formatCurrency(taxAudit.sec80C.claimed)} / ₹1,50,000`,
      `Sec 80CCD(1B) Exclusive Claimed: ${formatCurrency(taxAudit.sec80CCD1B.claimed)} / ₹50,000`,
      `Sec 80CCD(2) Corporate Perk: ${formatCurrency(taxAudit.sec80CCD2.claimed)}/yr`,
      `Estimated Annual Tax Saved: ${formatCurrency(taxAudit.estimatedTaxSaved)} (at 30% slab + cess)`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showMessage('Retirement & Pension blueprint copied to clipboard!');
  };

  const copyText = (txt, label) => {
    navigator.clipboard.writeText(txt);
    showMessage(`${label} copied to clipboard!`);
  };

  if (!isOpen) return null;

  const filteredAccounts = retirementSummary.accounts.filter(acc => {
    if (activeAccountTab === 'all') return true;
    if (activeAccountTab === 'epf') return acc.subType.includes('EPF');
    if (activeAccountTab === 'nps') return acc.subType.includes('NPS');
    if (activeAccountTab === 'ppf') return acc.subType.includes('PPF');
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-background-root text-text-primary overflow-y-auto flex justify-center selection:bg-primary-accent selection:text-white antialiased">
      {/* Responsive Container: Sleek mobile OLED or fluid desktop/tablet dashboard */}
      <main className="w-full max-w-[420px] md:max-w-2xl lg:max-w-4xl min-h-screen bg-background-root flex flex-col relative pb-32 shadow-2xl transition-all">
        
        {/* 1. Sticky Header / Top App Bar */}
        <header className="sticky top-0 z-40 bg-surface-layer1/95 md:bg-surface-layer1/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <button 
              onClick={onClose} 
              aria-label="Go back"
              className="w-8 h-8 rounded-full border border-border-subtle bg-surface-layer2/80 hover:bg-surface-layer2 flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-95 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-typ-body-sm md:text-typ-body font-bold text-text-primary tracking-tight flex items-center gap-1.5">
                Retirement &amp; Pension Hub
              </h1>
              <p className="text-typ-caption md:text-typ-label text-text-muted">EPF • NPS • PPF • Superannuation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="emerald" dot pulse size="sm">
              EEE Tax-Shield
            </Badge>
          </div>
        </header>

        {/* Content Body */}
        <div className="px-4 md:px-6 flex flex-col gap-4 pt-4">

          {/* 2. Hero Card: Consolidated Retirement Corpus */}
          <section className="bg-gradient-to-br from-surface-layer1 via-surface-layer1 to-primary-accent/5 rounded-2xl p-4 md:p-6 border border-border-subtle relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-typ-footnote md:text-typ-label font-semibold tracking-wider text-text-muted uppercase flex items-center gap-1.5">
                <Landmark size={14} className="text-primary-accent" />
                Consolidated Retirement Corpus
              </span>
              <Badge variant="emerald" size="xs" icon={<TrendingUp size={12} />}>
                +{formatCurrency(retirementSummary.totalMonthlyInflow)}/mo Inflow
              </Badge>
            </div>

            <div className="text-typ-heading md:text-typ-display font-extrabold tracking-tight text-text-primary tabular-nums flex items-baseline gap-2">
              <span>{formatCurrency(retirementSummary.totalRetirementCorpus)}</span>
              <span className="text-typ-label md:text-typ-body-sm font-medium text-text-muted">total vault</span>
            </div>

            {/* Micro Stats Grid */}
            <div className="mt-4 pt-3.5 border-t border-border-subtle grid grid-cols-2 sm:grid-cols-3 gap-3 text-typ-label">
              <div>
                <div className="text-typ-caption md:text-typ-label text-text-muted">Est. Interest This FY</div>
                <div className="text-typ-label md:text-typ-body-sm font-bold text-wealth-emerald tabular-nums">
                  +{formatCurrency(retirementSummary.totalAccruedInterestFY)}
                </div>
              </div>
              <div>
                <div className="text-typ-caption md:text-typ-label text-text-muted">Effective Weighted Return</div>
                <div className="text-typ-label md:text-typ-body-sm font-bold text-primary-accent tabular-nums">
                  {retirementSummary.effectiveWeightedYield}% p.a.
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-typ-caption md:text-typ-label text-text-muted">Active Accounts</div>
                <div className="text-typ-label md:text-typ-body-sm font-bold text-text-primary tabular-nums">
                  {retirementSummary.accountsCount} Vault Accounts
                </div>
              </div>
            </div>

            {/* True Underlying Asset Allocation (Fixed Income vs Equity) */}
            <div className="mt-4 pt-3 border-t border-border-subtle/60">
              <div className="flex items-center justify-between text-typ-footnote md:text-typ-label mb-1.5">
                <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary-accent"></span>
                  Fixed Income &amp; Sovereign Debt ({retirementSummary.underlyingAllocation.debtPct}%)
                </span>
                <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-wealth-emerald"></span>
                  NPS Equity Class E ({retirementSummary.underlyingAllocation.equityPct}%)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-surface-layer2 flex overflow-hidden border border-border-subtle">
                <div 
                  className="h-full bg-primary-accent transition-all duration-500 rounded-l-full" 
                  style={{ width: `${retirementSummary.underlyingAllocation.debtPct}%` }}
                  title={`Fixed Income / Debt: ${formatCurrency(retirementSummary.underlyingAllocation.debtPortion)}`}
                />
                <div 
                  className="h-full bg-wealth-emerald transition-all duration-500 rounded-r-full" 
                  style={{ width: `${retirementSummary.underlyingAllocation.equityPct}%` }}
                  title={`NPS Equity: ${formatCurrency(retirementSummary.underlyingAllocation.equityPortion)}`}
                />
              </div>
            </div>
          </section>

          {/* 3. Filter Chips & Quick Add */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: `All (${retirementSummary.accountsCount})` },
                { id: 'epf', label: 'EPF & VPF' },
                { id: 'nps', label: 'NPS' },
                { id: 'ppf', label: 'PPF' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveAccountTab(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-typ-label font-semibold whitespace-nowrap transition-all ${
                    activeAccountTab === t.id
                      ? 'bg-primary-accent text-white shadow-sm'
                      : 'bg-surface-layer1 text-text-secondary hover:text-text-primary border border-border-subtle hover:bg-surface-layer2'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => onOpenAddAsset && onOpenAddAsset('Retirement & Pension')}
              className="px-3 py-1.5 rounded-xl bg-surface-layer1 hover:bg-surface-layer2 text-primary-accent border border-primary-accent/30 text-typ-label font-semibold flex items-center gap-1 flex-shrink-0 active:scale-95 transition-all shadow-xs"
            >
              <Plus size={14} /> Add Account
            </button>
          </div>

          {/* 4. Active Accounts List */}
          <div className="flex flex-col gap-3">
            {filteredAccounts.length === 0 ? (
              <div className="bg-surface-layer1 border border-border-subtle rounded-2xl p-6 text-center text-text-secondary">
                <Shield size={28} className="mx-auto mb-2 text-primary-accent/40" />
                <p className="text-typ-label font-medium">No retirement accounts found under this filter.</p>
                <p className="text-typ-footnote text-text-muted mt-1">Tap below to add an EPF, PPF or NPS account.</p>
                <button
                  onClick={() => onOpenAddAsset && onOpenAddAsset('Retirement & Pension')}
                  className="mt-3 px-4 py-2 bg-primary-accent text-white rounded-xl text-typ-label font-semibold"
                >
                  Add Retirement Account
                </button>
              </div>
            ) : (
              filteredAccounts.map((acc, idx) => (
                <div 
                  key={acc.id || idx}
                  className="bg-surface-layer1 rounded-xl p-3.5 md:p-4 border border-border-subtle hover:border-border-prominent transition-all shadow-xs"
                >
                  {/* Account Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        acc.subType.includes('EPF') ? 'bg-primary-accent/15 text-primary-accent border border-primary-accent/30' :
                        acc.subType.includes('NPS') ? 'bg-wealth-emerald/15 text-wealth-emerald border border-wealth-emerald/30' :
                        'bg-bullion-amber/15 text-bullion-amber border border-bullion-amber/30'
                      }`}>
                        {acc.subType.includes('EPF') ? <Landmark size={20} /> :
                         acc.subType.includes('NPS') ? <Shield size={20} /> :
                         <Coins size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-typ-label md:text-typ-body-sm font-bold text-text-primary">{acc.name}</h3>
                          <span className="text-typ-micro font-semibold bg-surface-layer2 text-text-secondary px-1.5 py-0.5 rounded border border-border-subtle">
                            {acc.subType}
                          </span>
                        </div>
                        <div className="text-typ-caption md:text-typ-label text-text-muted flex items-center gap-1 mt-0.5">
                          <span>{acc.institution}</span>
                          {acc.identifier && acc.identifier !== '—' && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-text-secondary">{acc.identifier}</span>
                              <button 
                                onClick={() => copyText(acc.identifier, 'Account ID')} 
                                className="text-text-muted hover:text-text-primary ml-0.5"
                                title="Copy ID"
                              >
                                <Copy size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-typ-label md:text-typ-body-sm font-bold text-text-primary tabular-nums">
                        {formatCurrency(acc.currentValue)}
                      </div>
                      <div className="mt-0.5">
                        <Badge variant="emerald" size="xs">
                          {acc.rate}% p.a.
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Subtype-Specific Metrics */}
                  {acc.subType.includes('EPF') && (
                    <div className="mt-3 pt-2.5 border-t border-border-subtle space-y-2">
                      <div className="grid grid-cols-3 gap-2 bg-surface-layer2/60 rounded-xl p-2 border border-border-subtle/50 text-center">
                        <div>
                          <div className="text-typ-micro md:text-typ-caption text-text-muted">Employee Share</div>
                          <div className="text-typ-footnote md:text-typ-label font-semibold text-text-primary tabular-nums">{formatCurrency(acc.empShare)}</div>
                        </div>
                        <div>
                          <div className="text-typ-micro md:text-typ-caption text-text-muted">Employer Share</div>
                          <div className="text-typ-footnote md:text-typ-label font-semibold text-text-primary tabular-nums">{formatCurrency(acc.emprShare)}</div>
                        </div>
                        <div>
                          <div className="text-typ-micro md:text-typ-caption text-text-muted">Pension (EPS)</div>
                          <div className="text-typ-footnote md:text-typ-label font-semibold text-text-primary tabular-nums">{formatCurrency(acc.epsShare)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-typ-caption md:text-typ-label text-text-muted">
                        <span>Monthly Recurring: <strong className="text-text-primary">+{formatCurrency(acc.monthlyInflow)}/mo</strong></span>
                        {acc.isTaxableRule9D ? (
                          <span className="text-liability-rose flex items-center gap-0.5 font-medium">
                            <AlertCircle size={12} /> Rule 9D Taxable ({formatCurrency(acc.taxableAmount)})
                          </span>
                        ) : (
                          <span className="text-wealth-emerald flex items-center gap-0.5 font-medium">
                            <CheckCircle2 size={12} /> Rule 9D EEE Tax-Free
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {acc.subType.includes('NPS') && (
                    <div className="mt-3 pt-2.5 border-t border-border-subtle space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-typ-caption md:text-typ-label text-text-muted mb-1">
                          <span>Asset Allocation: {acc.choice}</span>
                          <span className="font-mono text-text-secondary">
                            E: {acc.allocations?.e}% | C: {acc.allocations?.c}% | G: {acc.allocations?.g}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-layer2 flex overflow-hidden border border-border-subtle">
                          <div className="h-full bg-wealth-emerald" style={{ width: `${acc.allocations?.e || 60}%` }} title={`Equity: ${acc.allocations?.e}%`} />
                          <div className="h-full bg-primary-accent" style={{ width: `${acc.allocations?.c || 25}%` }} title={`Corporate Debt: ${acc.allocations?.c}%`} />
                          <div className="h-full bg-bullion-amber" style={{ width: `${acc.allocations?.g || 15}%` }} title={`Govt Securities: ${acc.allocations?.g}%`} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-typ-caption md:text-typ-label text-text-muted">
                        <span>Monthly SIP: <strong className="text-text-primary">+{formatCurrency(acc.monthlyInflow)}/mo</strong></span>
                        {acc.isTier1 && (
                          <span className="text-primary-accent flex items-center gap-0.5 font-medium">
                            <Award size={12} /> Sec 80CCD(1B) Eligible
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {acc.subType.includes('PPF') && (
                    <div className="mt-3 pt-2.5 border-t border-border-subtle space-y-2">
                      <div className="flex items-center justify-between text-typ-caption md:text-typ-label text-text-muted bg-surface-layer2/60 rounded-xl px-2.5 py-1.5 border border-border-subtle/50">
                        <span>FY Deposit: <strong className="text-text-primary">{formatCurrency(acc.fyDeposit)} / ₹1.5L</strong></span>
                        <span className="font-medium text-text-secondary">
                          {acc.yearsRemaining > 0 ? `${acc.yearsRemaining}y left (${acc.extensionBlock})` : 'Matured'}
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>

          {/* 5. Retirement Corpus & Pension Forecaster at Age 60 */}
          <section className="bg-surface-layer1 rounded-2xl p-4 md:p-6 border border-border-subtle flex flex-col gap-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-accent/15 border border-primary-accent/30 flex items-center justify-center text-primary-accent">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-typ-label md:text-typ-body-sm font-bold text-text-primary">Age 60 Retirement &amp; Pension Forecaster</h3>
                  <p className="text-typ-caption md:text-typ-label text-text-muted">Deterministic compound accumulation with step-up</p>
                </div>
              </div>
              <Badge variant="indigo" size="xs">
                {projection.yearsToRetire} Yrs Horizon
              </Badge>
            </div>

            {/* Projected Metric Big Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div className="bg-surface-layer2/80 rounded-xl p-3.5 border border-border-subtle">
                <div className="text-typ-caption md:text-typ-label text-text-muted">Projected Nominal Corpus at Age {retirementAge}</div>
                <div className="text-typ-title md:text-typ-heading font-extrabold text-wealth-emerald tabular-nums mt-0.5">
                  {formatCurrency(projection.finalCorpus)}
                </div>
                <div className="text-typ-caption text-text-secondary mt-1">
                  Deposited: {formatCurrency(projection.totalDeposited)} • Gains: +{formatCurrency(projection.totalGrowthInterest)}
                </div>
              </div>

              <div className="bg-surface-layer2/80 rounded-xl p-3.5 border border-border-subtle">
                <div className="text-typ-caption md:text-typ-label text-text-muted">Projected Monthly Lifetime Pension</div>
                <div className="text-typ-title md:text-typ-heading font-extrabold text-primary-accent tabular-nums mt-0.5">
                  {formatCurrency(projection.projectedMonthlyPension)}<span className="text-typ-label text-text-muted font-normal">/mo</span>
                </div>
                <div className="text-typ-caption text-text-secondary mt-1">
                  At {RETIREMENT_RATES.ANNUITY_RATE_DEFAULT}% lifelong annuity rate
                </div>
              </div>
            </div>

            {/* 60/40 PFRDA Rule Split Box */}
            <div className="bg-background-root/80 rounded-xl p-3 border border-border-subtle grid grid-cols-2 gap-3 text-typ-label">
              <div>
                <div className="text-typ-caption md:text-typ-label text-text-muted">60% Tax-Free Lump Sum</div>
                <div className="text-typ-label md:text-typ-body-sm font-bold text-text-primary tabular-nums mt-0.5">
                  {formatCurrency(projection.lumpSumAmount)}
                </div>
                <div className="text-typ-micro text-text-muted">Immediate cash withdrawal</div>
              </div>
              <div className="border-l border-border-subtle pl-3">
                <div className="text-typ-caption md:text-typ-label text-text-muted">40% Mandatory Annuity Corpus</div>
                <div className="text-typ-label md:text-typ-body-sm font-bold text-text-primary tabular-nums mt-0.5">
                  {formatCurrency(projection.annuityCorpus)}
                </div>
                <div className="text-typ-micro text-text-muted">Deploys to LIC / HDFC Life</div>
              </div>
            </div>

            {/* Interactive Sliders */}
            <div className="flex flex-col gap-3 pt-2">
              <div>
                <div className="flex justify-between text-typ-footnote md:text-typ-label text-text-secondary mb-1">
                  <span>Target Retirement Age:</span>
                  <span className="font-bold text-text-primary font-mono">{retirementAge} Years ({projection.yearsToRetire}y away)</span>
                </div>
                <input
                  type="range"
                  min="45"
                  max="65"
                  step="1"
                  value={retirementAge}
                  onChange={(e) => setRetirementAge(Number(e.target.value))}
                  className="w-full h-2 bg-surface-layer2 rounded-lg appearance-none cursor-pointer accent-primary-accent"
                />
              </div>

              <div>
                <div className="flex justify-between text-typ-footnote md:text-typ-label text-text-secondary mb-1">
                  <span>Annual Step-up Inflow Escalation:</span>
                  <span className="font-bold text-wealth-emerald font-mono">+{stepUpPct}% / year</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={stepUpPct}
                  onChange={(e) => setStepUpPct(Number(e.target.value))}
                  className="w-full h-2 bg-surface-layer2 rounded-lg appearance-none cursor-pointer accent-wealth-emerald"
                />
              </div>
            </div>

            <div className="text-typ-caption md:text-typ-label text-text-muted bg-surface-layer2/50 p-2.5 rounded-lg border border-border-subtle flex items-center justify-between">
              <span>Inflation-adjusted real buying power (5.5% inflation):</span>
              <strong className="text-text-primary font-mono">{formatCurrency(projection.realMonthlyPension)}/mo in today's money</strong>
            </div>
          </section>

          {/* 6. Tax Exemption & Salary Perk Audit Card */}
          <section className="bg-surface-layer1 rounded-2xl p-4 md:p-6 border border-border-subtle flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-wealth-emerald/15 border border-wealth-emerald/30 flex items-center justify-center text-wealth-emerald">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="text-typ-label md:text-typ-body-sm font-bold text-text-primary">Tax Exemption &amp; Perk Audit (FY 2024-25)</h3>
                  <p className="text-typ-caption md:text-typ-label text-text-muted">Indian Income Tax Act Deductions</p>
                </div>
              </div>
              <Badge variant="emerald" dot size="xs">
                {formatCurrency(taxAudit.estimatedTaxSaved)} Direct Tax Saved
              </Badge>
            </div>

            <div className="space-y-3 pt-1">
              {/* Section 80C */}
              <div>
                <div className="flex justify-between text-typ-footnote md:text-typ-label mb-1">
                  <span className="text-text-secondary">Sec 80C (EPF Employee Share + PPF)</span>
                  <span className={`font-mono font-bold ${taxAudit.sec80C.isMaxed ? 'text-wealth-emerald' : 'text-text-primary'}`}>
                    {formatCurrency(taxAudit.sec80C.claimed)} / ₹1,50,000 {taxAudit.sec80C.isMaxed ? '(Maxed)' : ''}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-layer2 overflow-hidden border border-border-subtle">
                  <div 
                    className="h-full bg-wealth-emerald rounded-full transition-all duration-500" 
                    style={{ width: `${taxAudit.sec80C.percentage}%` }} 
                  />
                </div>
              </div>

              {/* Section 80CCD(1B) */}
              <div>
                <div className="flex justify-between text-typ-footnote md:text-typ-label mb-1">
                  <span className="text-text-secondary">Sec 80CCD(1B) (Exclusive NPS Tier 1 Self)</span>
                  <span className={`font-mono font-bold ${taxAudit.sec80CCD1B.isMaxed ? 'text-wealth-emerald' : 'text-text-primary'}`}>
                    {formatCurrency(taxAudit.sec80CCD1B.claimed)} / ₹50,000 {taxAudit.sec80CCD1B.isMaxed ? '(Maxed)' : ''}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-layer2 overflow-hidden border border-border-subtle">
                  <div 
                    className="h-full bg-wealth-emerald rounded-full transition-all duration-500" 
                    style={{ width: `${taxAudit.sec80CCD1B.percentage}%` }} 
                  />
                </div>
              </div>

              {/* Section 80CCD(2) */}
              <div>
                <div className="flex justify-between text-typ-footnote md:text-typ-label mb-1">
                  <span className="text-text-secondary">Sec 80CCD(2) (Corporate Employer NPS Perk)</span>
                  <span className="font-mono font-bold text-primary-accent">
                    {formatCurrency(taxAudit.sec80CCD2.claimed)} / year (0 cap under 80C)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-layer2 overflow-hidden border border-border-subtle">
                  <div 
                    className="h-full bg-primary-accent rounded-full transition-all duration-500" 
                    style={{ width: taxAudit.sec80CCD2.claimed > 0 ? '100%' : '0%' }} 
                  />
                </div>
              </div>
            </div>

            <div className="text-typ-caption md:text-typ-label text-text-muted mt-1">
              *Calculated based on 30% tax bracket + 4% Health &amp; Education Cess (31.2% marginal tax rate).
            </div>
          </section>

          {/* 7. Family Safe Vault Integration Card */}
          <section className="bg-surface-layer1 rounded-xl p-3.5 border border-border-subtle flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface-layer2 flex items-center justify-center text-text-secondary flex-shrink-0">
                <FolderLock size={18} />
              </div>
              <div>
                <div className="text-typ-label font-semibold text-text-primary">Family Safe Vault Documents</div>
                <div className="text-typ-caption text-text-muted">EPFO Passbooks, PRAN Cards &amp; PPF Scans</div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                // User will be able to navigate to SafeTab
              }}
              className="px-3 py-1.5 rounded-lg bg-surface-layer2 hover:bg-surface-layer2/80 text-text-primary text-typ-footnote font-medium border border-border-prominent transition-all shadow-xs"
            >
              Open Safe
            </button>
          </section>

        </div>

        {/* 8. Floating Sticky Action Bar */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] md:max-w-2xl lg:max-w-4xl bg-surface-layer1/95 md:bg-surface-layer1/90 backdrop-blur-xl border-t border-border-subtle p-3.5 z-50 flex items-center gap-2.5">
          <button
            onClick={() => onOpenAddAsset && onOpenAddAsset('Retirement & Pension')}
            className="flex-1 py-3 px-4 rounded-xl bg-primary-accent hover:bg-primary-accent/90 active:scale-98 text-white font-semibold text-typ-label flex items-center justify-center gap-1.5 shadow-lg shadow-primary-accent/20 transition-all"
            type="button"
          >
            <Plus size={16} />
            Add Retirement Account
          </button>
          <button
            onClick={handleCopySummary}
            className="py-3 px-3.5 rounded-xl bg-surface-layer2 hover:bg-surface-layer1 border border-border-prominent active:scale-98 text-text-primary font-medium text-typ-label flex items-center justify-center transition-all shadow-xs"
            title="Copy Blueprint"
            type="button"
          >
            {copied ? <Check size={18} className="text-wealth-emerald" /> : <Copy size={18} />}
          </button>
        </div>

      </main>
    </div>
  );
}
