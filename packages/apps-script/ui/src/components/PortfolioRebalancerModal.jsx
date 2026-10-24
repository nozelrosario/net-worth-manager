import React, { useState, useEffect, useMemo } from 'react';
import useModalBack from '../hooks/useModalBack';
import { 
  ArrowLeft, Sparkles, Sliders, AlertTriangle, TrendingUp, TrendingDown, 
  CheckCircle2, Info, Copy, Check, RefreshCw, X, Shield, ChevronRight, 
  HelpCircle, ExternalLink, Flame, DollarSign, Wallet
} from 'lucide-react';
import { 
  RISK_PROFILES, 
  CATEGORY_COLORS, 
  CORE_CATEGORIES,
  calculatePortfolioAlignment, 
  simulateInflowRebalancing, 
  calculateCashDrag, 
  auditConcentrationRisk,
  normalizeTargetAllocation
} from '../utils/portfolioMath';
import { getSafeStorage, setSafeStorage } from '../utils/storage';

export default function PortfolioRebalancerModal({ 
  isOpen, 
  onClose, 
  data, 
  formatCurrency, 
  showMessage,
  onRefresh 
}) {
  useModalBack(isOpen, onClose);

  const assets = data?.assets || [];
  const transactions = data?.transactions || [];
  const settings = data?.settings || [];

  // Saved settings resolution
  const savedProfileName = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'RiskProfile');
    return s?.['Setting Value'] || 'Moderate';
  }, [settings]);

  const savedTargetMap = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'TargetAllocation');
    if (s?.['Setting Value']) {
      try {
        return JSON.parse(s['Setting Value']);
      } catch (e) {
        // Fallback
      }
    }
    return RISK_PROFILES[savedProfileName]?.target || RISK_PROFILES.Moderate.target;
  }, [settings, savedProfileName]);

  const savedGeminiKey = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'GeminiApiKey');
    return s?.['Setting Value'] || getSafeStorage('nwm_gemini_api_key', '');
  }, [settings]);

  const [selectedProfile, setSelectedProfile] = useState(savedProfileName);
  const [targetAllocation, setTargetAllocation] = useState(savedTargetMap);
  const [inflowAmount, setInflowAmount] = useState(50000);
  const [customInflowInput, setCustomInflowInput] = useState('50000');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  
  // Customizer state
  const [tempProfile, setTempProfile] = useState(savedProfileName);
  const [tempTargets, setTempTargets] = useState({ ...savedTargetMap });
  const [tempApiKey, setTempApiKey] = useState(savedGeminiKey);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [customizerFeedback, setCustomizerFeedback] = useState(null);

  // AI Insights state
  const [aiInsights, setAiInsights] = useState(null);
  const [aiModelUsed, setAiModelUsed] = useState('');
  const [aiTimestamp, setAiTimestamp] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync state if settings change from backend
  useEffect(() => {
    setSelectedProfile(savedProfileName);
    setTargetAllocation(savedTargetMap);
    setTempProfile(savedProfileName);
    setTempTargets({ ...savedTargetMap });
    setTempApiKey(savedGeminiKey);
  }, [savedProfileName, savedTargetMap, savedGeminiKey]);

  // Perform continuous deterministic calculations
  const simulation = useMemo(() => {
    return simulateInflowRebalancing(assets, targetAllocation, inflowAmount);
  }, [assets, targetAllocation, inflowAmount]);

  const cashDrag = useMemo(() => {
    return calculateCashDrag(assets, transactions);
  }, [assets, transactions]);

  const concentration = useMemo(() => {
    return auditConcentrationRisk(assets);
  }, [assets]);

  // Handle Quick Chips
  const handleChipSelect = (amt) => {
    setInflowAmount(amt);
    setCustomInflowInput(String(amt));
  };

  const handleCustomInputChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setCustomInflowInput(raw);
    const num = Number(raw) || 0;
    setInflowAmount(num);
  };

  // Generate AI or Heuristic insights on demand
  const handleGenerateAIInsights = (forceRefresh = false) => {
    if (isLoadingAI) return;
    setIsLoadingAI(true);

    const rebalancePayload = {
      netWorth: simulation.netWorth,
      totalGrossAssets: simulation.totalGrossAssets,
      alignmentScore: simulation.alignmentScore,
      inflowAmount: simulation.inflowAmount,
      projectedAlignmentScore: simulation.projectedAlignmentScore,
      cashRunwayMonths: cashDrag.runwayMonths,
      excessCashDrag: cashDrag.excessCashDrag,
      breakdown: simulation.projectedBreakdown.map(b => ({
        category: b.category,
        currentPct: b.currentPct,
        targetPct: b.targetPct,
        driftPct: b.projectedDrift,
        allocatedRupees: b.allocatedRupees,
        projectedPct: b.projectedPct,
        status: b.status
      })),
      concentrationAlerts: concentration.alerts.map(a => ({
        category: a.category,
        percentage: a.percentage,
        message: a.message
      }))
    };

    const token = getSafeStorage('nwm_session_token');
    const keyToUse = tempApiKey || savedGeminiKey;

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsLoadingAI(false);
          if (res?.status === 'success') {
            setAiInsights(res.insights);
            setAiModelUsed(res.modelUsed || 'AI Advisor');
            setAiTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          } else {
            showMessage(res?.message || 'Error generating insights', true);
          }
        })
        .withFailureHandler((err) => {
          setIsLoadingAI(false);
          showMessage('AI Generation Error: ' + err.message, true);
        })
        .generatePortfolioInsights(rebalancePayload, keyToUse, token);
    } else {
      // Offline / Prototype preview fallback
      setTimeout(() => {
        setIsLoadingAI(false);
        const gain = Math.max(0, simulation.projectedAlignmentScore - simulation.alignmentScore);
        const text = `### 📊 Portfolio Diagnosis & Health
• **Structural Alignment:** Portfolio health score is **${simulation.alignmentScore}/100**. Your asset distribution aligns with your **${selectedProfile}** benchmark with tactical drift in high-growth segments.

### 💡 Smart Inflow & Tax-Efficient Deployment
• **Non-Taxable Rebalance:** Deploying ₹${Number(inflowAmount).toLocaleString('en-IN')} of fresh capital lifts your alignment score to **${simulation.projectedAlignmentScore}/100** (+${gain} pts) **without selling any existing holdings**.
• **Tax Protection:** Avoiding asset sales preserves capital compounding and sidesteps Section 112A (12.5% LTCG) and Section 111A (20% STCG) liabilities.

### 🎯 Tactical Asset Allocations
${simulation.projectedBreakdown.filter(b => b.allocatedRupees > 0).map(b => `• **${b.category}:** Allocate ₹${Number(b.allocatedRupees).toLocaleString('en-IN')} (Target: ${b.targetPct}%). ${b.tacticalNote}`).join('\n')}

### ⚠️ Cash Drag & Runway Optimization
• **Runway:** Total liquid reserves provide **${cashDrag.runwayMonths} months** of runway. Excess cash of ₹${Number(cashDrag.excessCashDrag).toLocaleString('en-IN')} beyond the 6-month buffer can be productively redeployed into high-yielding debt or index funds.`;

        setAiInsights(text);
        setAiModelUsed('Preview Heuristics Advisor');
        setAiTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }, 700);
    }
  };

  // Automatically fetch initial insights if not already present
  useEffect(() => {
    if (isOpen && !aiInsights && !isLoadingAI) {
      handleGenerateAIInsights();
    }
  }, [isOpen]);

  // Save Target Profile and Gemini Key
  const handleSaveCustomizer = () => {
    setCustomizerFeedback(null);
    const total = Object.values(tempTargets).reduce((s, v) => s + (Number(v) || 0), 0);
    if (total !== 100) {
      const msg = `Target percentages must sum to 100% (currently ${total}%). Please adjust sliders.`;
      setCustomizerFeedback({ text: msg, isError: true });
      showMessage(msg, true);
      return;
    }

    setIsSavingSettings(true);
    const token = getSafeStorage('nwm_session_token');
    const cleanApiKey = tempApiKey ? tempApiKey.trim() : '';

    // Always immediately persist key in local storage so it is active right away
    setSafeStorage('nwm_gemini_api_key', cleanApiKey);

    const payload = JSON.stringify(tempTargets);

    function finishSave(successMsg) {
      setIsSavingSettings(false);
      setSelectedProfile(tempProfile);
      setTargetAllocation({ ...tempTargets });
      setCustomizerFeedback({ text: '✓ ' + (successMsg || 'Settings saved successfully!'), isError: false });
      showMessage(successMsg || 'Settings saved successfully!');
      if (onRefresh) onRefresh();
      setTimeout(() => {
        setShowCustomizer(false);
        setCustomizerFeedback(null);
        // Refresh AI advisory insights with the updated key/targets
        handleGenerateAIInsights(true);
      }, 700);
    }

    if (window.google?.script?.run?.savePortfolioSettings) {
      window.google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'error') {
            setIsSavingSettings(false);
            setCustomizerFeedback({ text: res.message || 'Error saving settings', isError: true });
            showMessage(res.message, true);
          } else {
            finishSave(res?.message || 'Portfolio settings & AI Key saved!');
          }
        })
        .withFailureHandler((err) => {
          setIsSavingSettings(false);
          setCustomizerFeedback({ text: 'Error: ' + err.message, isError: true });
          showMessage('Error saving settings: ' + err.message, true);
        })
        .savePortfolioSettings(payload, tempProfile, cleanApiKey, token);
    } else if (window.google?.script?.run?.upsertSetting) {
      // Fallback
      window.google.script.run
        .withSuccessHandler(() => {
          if (cleanApiKey) {
            window.google.script.run
              .withSuccessHandler(() => finishSave('Settings saved!'))
              .withFailureHandler(() => finishSave('Settings saved!'))
              .upsertSetting('GeminiApiKey', cleanApiKey, token);
          } else {
            finishSave('Settings saved!');
          }
        })
        .withFailureHandler((err) => {
          setIsSavingSettings(false);
          setCustomizerFeedback({ text: 'Error: ' + err.message, isError: true });
          showMessage('Error: ' + err.message, true);
        })
        .upsertSetting('TargetAllocation', payload, token);
    } else {
      setTimeout(() => {
        finishSave('Settings updated (preview)');
      }, 400);
    }
  };

  const handleCopyPlan = () => {
    const lines = [
      `Net Worth Manager — Smart Rebalance Blueprint`,
      `Target Profile: ${selectedProfile}`,
      `Fresh Capital Inflow: ₹${Number(inflowAmount).toLocaleString('en-IN')}`,
      `Current Alignment: ${simulation.alignmentScore}/100 → Projected: ${simulation.projectedAlignmentScore}/100`,
      ``,
      `Recommended Deployments:`,
      ...simulation.projectedBreakdown.map(b => 
        `• ${b.category}: +₹${Number(b.allocatedRupees).toLocaleString('en-IN')} (Target: ${b.targetPct}% | Proj: ${b.projectedPct}%)`
      ),
      ``,
      `Cash Runway: ${cashDrag.runwayMonths} months (Excess Drag: ₹${Number(cashDrag.excessCashDrag).toLocaleString('en-IN')})`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showMessage('Rebalance plan copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background-root text-text-primary overflow-y-auto flex justify-center selection:bg-primary-accent selection:text-white antialiased">
      {/* 393px OLED Container / Fluid Responsive Wrapper */}
      <main className="w-full max-w-[440px] bg-background-root min-h-screen flex flex-col relative pb-32 shadow-2xl">
        
        {/* 1. Sticky Header / Top App Bar */}
        <header className="sticky top-0 z-40 bg-background-root/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <button 
              onClick={onClose}
              aria-label="Go back" 
              className="w-8 h-8 rounded-full border border-border-subtle bg-surface-layer1 flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-95 transition-all"
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-text-primary tracking-tight">AI Portfolio Advisor</h1>
              <p className="text-[10px] text-text-muted">Smart Inflow Engine • Zero Tax</p>
            </div>
          </div>

          <button 
            onClick={() => setShowCustomizer(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-layer1 border border-border-prominent text-text-secondary hover:text-text-primary active:scale-95 transition-all text-xs font-medium"
          >
            <span className="text-[11px] font-semibold text-text-primary">{selectedProfile}</span>
            <Sliders size={12} className="text-text-muted" />
          </button>
        </header>

        {/* Scrollable Content Canvas */}
        <div className="px-4 flex flex-col gap-3.5 pt-3.5">
          
          {/* 2. Portfolio Health & Drift Hero Card */}
          <section className="bg-surface-layer1 rounded-xl p-4 border border-border-subtle relative overflow-hidden shadow-sm">
            {/* Ambient Subtle Indigo Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-accent/15 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total Portfolio Wealth</span>
                <div className="text-2xl font-bold text-text-primary tabular-nums tracking-tight">
                  {formatCurrency(simulation.netWorth)}
                </div>
                {simulation.maxOverweight && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-liability-rose/10 border border-liability-rose/25 text-liability-rose text-[10px] font-medium">
                    <AlertTriangle size={11} />
                    <span>+{simulation.maxOverweight.drift.toFixed(1)}% {simulation.maxOverweight.name} Overweight</span>
                  </div>
                )}
              </div>

              {/* Alignment Score Gauge Dial */}
              <div className="relative flex flex-col items-center justify-center w-16 h-16 rounded-full bg-surface-layer2 border-2 border-wealth-emerald/40 shadow-inner">
                <span className="text-lg font-bold text-wealth-emerald leading-none tabular-nums">
                  {simulation.alignmentScore}
                </span>
                <span className="text-[9px] text-text-muted mt-0.5">/100</span>
                <span className="text-[7px] font-bold uppercase tracking-wider text-wealth-emerald">
                  {simulation.healthLabel}
                </span>
              </div>
            </div>

            {/* Inflow Adjustment Indicator Badge */}
            <div className="mt-3.5 pt-2.5 border-t border-border-subtle/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bullion-amber opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-bullion-amber"></span>
                </span>
                <span className="text-text-secondary text-[11px]">
                  {simulation.totalAbsDrift > 4 ? 'Requires Inflow Adjustment' : 'Portfolio In Healthy Range'}
                </span>
              </div>
              <span className="text-[10px] text-wealth-emerald font-medium">
                No-sale rebalance active
              </span>
            </div>
          </section>

          {/* 3. Allocation Visualizer (Current vs Target vs Projected) */}
          <section className="bg-surface-layer1 rounded-xl p-4 border border-border-subtle flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-text-primary">Allocation Alignment</h2>
                <p className="text-[11px] text-text-muted">Target profile drift comparison</p>
              </div>
              <span className="text-[11px] font-medium text-text-muted">
                Drift: ±{simulation.totalAbsDrift}%
              </span>
            </div>

            {/* Legend Pills */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {CORE_CATEGORIES.map(cat => {
                const conf = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
                const tgt = targetAllocation[cat] || 0;
                return (
                  <span 
                    key={cat}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-layer2 text-text-secondary text-[10px] font-medium border border-border-subtle"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${conf.bgClass}`}></span>
                    {conf.label}: {tgt}%
                  </span>
                );
              })}
            </div>

            {/* Segmented Stacked Progress Bars */}
            <div className="space-y-2.5 pt-1">
              {/* Bar 1: Current */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-text-secondary">1. Current Allocation</span>
                  <span className="text-text-muted font-mono">{simulation.alignmentScore}/100</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface-layer2 flex overflow-hidden border border-border-subtle">
                  {simulation.breakdown.map(b => {
                    const conf = CATEGORY_COLORS[b.category] || CATEGORY_COLORS.Other;
                    return (
                      <div 
                        key={b.category} 
                        className={conf.bgClass} 
                        style={{ width: `${Math.max(0, b.currentPct)}%` }}
                        title={`${b.category}: ${b.currentPct}%`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Bar 2: Target Model */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-text-secondary">2. Target Benchmark ({selectedProfile})</span>
                  <span className="text-primary-accent font-medium text-[10px]">Benchmark</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface-layer2 flex overflow-hidden border border-border-subtle opacity-75">
                  {CORE_CATEGORIES.map(cat => {
                    const conf = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
                    const pct = Number(targetAllocation[cat] || 0);
                    return (
                      <div 
                        key={cat} 
                        className={conf.bgClass} 
                        style={{ width: `${pct}%` }}
                        title={`${cat} Target: ${pct}%`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Bar 3: Projected Post-Inflow */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-wealth-emerald font-medium">3. Projected Post-Inflow (+₹{Number(inflowAmount).toLocaleString('en-IN')})</span>
                  <span className="text-wealth-emerald font-semibold text-[10px]">
                    {simulation.projectedAlignmentScore}/100 
                    {simulation.scoreImprovement > 0 && ` (+${simulation.scoreImprovement})`}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface-layer2 flex overflow-hidden border border-wealth-emerald/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                  {simulation.projectedBreakdown.map(b => {
                    const conf = CATEGORY_COLORS[b.category] || CATEGORY_COLORS.Other;
                    return (
                      <div 
                        key={b.category} 
                        className={conf.bgClass} 
                        style={{ width: `${Math.max(0, b.projectedPct)}%` }}
                        title={`${b.category} Projected: ${b.projectedPct}%`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 4. Smart Inflow Rebalance Simulator */}
          <section className="bg-surface-layer1 rounded-xl p-4 border border-border-subtle flex flex-col gap-3 shadow-sm">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <Wallet size={14} className="text-primary-accent" />
                <span>Deploy Fresh Capital</span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Rebalance without selling to minimize Section 112A capital gains tax.
              </p>
            </div>

            {/* Quick Chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {[25000, 50000, 100000, 250000].map(amt => (
                <button
                  key={amt}
                  onClick={() => handleChipSelect(amt)}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition-all tabular-nums ${
                    inflowAmount === amt
                      ? 'bg-primary-accent/15 border-primary-accent text-primary-accent shadow-sm'
                      : 'bg-surface-layer2 border-border-subtle text-text-secondary hover:text-text-primary'
                  }`}
                >
                  ₹{amt >= 100000 ? `${amt / 100000}L` : `${amt / 1000}k`}
                </button>
              ))}
            </div>

            {/* Custom Amount Input & Slider */}
            <div className="space-y-2">
              <div className="relative flex items-center">
                <span className="absolute left-3 text-text-muted font-bold text-sm">₹</span>
                <input 
                  type="text"
                  value={customInflowInput}
                  onChange={handleCustomInputChange}
                  placeholder="Enter investment amount"
                  className="w-full bg-surface-layer2 border border-border-prominent rounded-lg pl-7 pr-16 py-2 text-sm font-bold text-text-primary tabular-nums focus:outline-none focus:border-primary-accent"
                />
                <span className="absolute right-3 text-[10px] text-text-muted font-semibold uppercase">
                  Inflow
                </span>
              </div>

              <input 
                type="range"
                min="0"
                max="500000"
                step="5000"
                value={inflowAmount}
                onChange={(e) => handleChipSelect(Number(e.target.value))}
                className="w-full accent-primary-accent h-1.5 bg-surface-layer2 rounded-lg cursor-pointer"
              />
            </div>
          </section>

          {/* 5. Rebalance Allocation Execution Breakdown */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-text-primary">Recommended Deployments</h3>
              <span className="text-[10px] text-text-muted">Proportional Shortfall Engine</span>
            </div>

            <div className="space-y-2">
              {simulation.projectedBreakdown.map(item => {
                const conf = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
                const isUnder = item.status === 'underweight';
                const isOver = item.status === 'overweight';
                const hasAlloc = item.allocatedRupees > 0;

                return (
                  <div 
                    key={item.category}
                    className="bg-surface-layer1 border border-border-subtle rounded-xl p-3 flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${conf.bgClass}`}></span>
                        <span className="text-xs font-semibold text-text-primary">{item.category}</span>
                      </div>

                      {/* Status Tag */}
                      {isUnder && (
                        <span className="text-[10px] font-semibold text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded-full">
                          {item.currentPct - item.targetPct}% Underweight
                        </span>
                      )}
                      {isOver && (
                        <span className="text-[10px] font-semibold text-liability-rose bg-liability-rose/10 border border-liability-rose/20 px-2 py-0.5 rounded-full">
                          +{item.currentPct - item.targetPct}% Overweight
                        </span>
                      )}
                      {!isUnder && !isOver && (
                        <span className="text-[10px] font-semibold text-wealth-emerald bg-wealth-emerald/10 border border-wealth-emerald/20 px-2 py-0.5 rounded-full">
                          On Target ({item.targetPct}%)
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-[10px] text-text-muted">Current → Projected:</span>
                        <span className="text-xs font-medium text-text-secondary ml-1 tabular-nums">
                          {item.currentPct}% → <strong className="text-text-primary">{item.projectedPct}%</strong> (Target: {item.targetPct}%)
                        </span>
                      </div>

                      <div className="text-right">
                        {hasAlloc ? (
                          <span className="text-sm font-bold text-wealth-emerald tabular-nums">
                            +{formatCurrency(item.allocatedRupees)}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-text-muted">
                            ₹0 (Hold)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tactical Tip Note */}
                    <div className="text-[10px] text-text-muted bg-surface-layer2/60 px-2 py-1 rounded border border-border-subtle/50 mt-0.5">
                      {item.tacticalNote}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 6. Cash Drag & Concentration Risk Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Cash Drag Card */}
            <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                    <Flame size={12} className="text-bullion-amber" />
                    Cash Drag & Runway
                  </span>
                  <span className="text-[10px] font-mono text-bullion-amber">
                    {cashDrag.runwayMonths} Mos
                  </span>
                </div>
                <p className="text-sm font-bold text-text-primary tabular-nums">
                  {formatCurrency(cashDrag.totalLiquidCash)}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  6-Mo Emergency Buffer: {formatCurrency(cashDrag.emergencyReserveTarget)}
                </p>
              </div>

              {cashDrag.hasCashDrag ? (
                <div className="mt-2 text-[10px] bg-bullion-amber/10 border border-bullion-amber/20 text-bullion-amber p-1.5 rounded font-medium">
                  ⚠️ {formatCurrency(cashDrag.excessCashDrag)} excess idle cash drag identified (~1.4% annual drag).
                </div>
              ) : (
                <div className="mt-2 text-[10px] bg-wealth-emerald/10 border border-wealth-emerald/20 text-wealth-emerald p-1.5 rounded font-medium">
                  ✓ Healthy liquid emergency cushion maintained.
                </div>
              )}
            </div>

            {/* Concentration Risk Card */}
            <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                    <Shield size={12} className="text-primary-accent" />
                    Asset Concentration
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    Max 15% Cap
                  </span>
                </div>
                <p className="text-sm font-bold text-text-primary">
                  {concentration.alerts.length === 0 ? 'No Critical Skew' : `${concentration.alerts.length} Alert(s)`}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Audit against single-stock drawdown risks
                </p>
              </div>

              {concentration.alerts.length > 0 ? (
                <div className="mt-2 text-[10px] bg-liability-rose/10 border border-liability-rose/20 text-liability-rose p-1.5 rounded font-medium">
                  ⚠️ {concentration.alerts[0].name} exceeds threshold ({concentration.alerts[0].percentage}%).
                </div>
              ) : (
                <div className="mt-2 text-[10px] bg-wealth-emerald/10 border border-wealth-emerald/20 text-wealth-emerald p-1.5 rounded font-medium">
                  ✓ Equity holdings well-diversified.
                </div>
              )}
            </div>
          </section>

          {/* 7. Gemini AI Strategic Synthesis */}
          <section className="bg-surface-layer1 border border-primary-accent/30 rounded-xl p-4 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={16} className="text-wealth-emerald animate-pulse" />
                <h3 className="text-xs font-semibold text-text-primary">
                  {aiModelUsed.includes('Gemini') ? 'Gemini AI Advisory Synthesis' : 'Financial Strategic Synthesis'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {aiTimestamp && (
                  <span className="text-[9px] text-text-muted">{aiTimestamp}</span>
                )}
                <button 
                  onClick={() => handleGenerateAIInsights(true)}
                  disabled={isLoadingAI}
                  className="p-1 rounded bg-surface-layer2 text-text-secondary hover:text-text-primary disabled:opacity-50 transition-all"
                  title="Refresh AI Insights"
                >
                  <RefreshCw size={12} className={isLoadingAI ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {isLoadingAI ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-text-muted">
                <RefreshCw size={20} className="animate-spin text-primary-accent" />
                <p className="text-xs">Analyzing portfolio & tax dynamics...</p>
              </div>
            ) : aiInsights ? (
              <div className="text-[11px] leading-relaxed text-text-secondary space-y-2 whitespace-pre-line">
                {aiInsights}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-text-muted">Tap refresh to synthesize recommendations.</p>
              </div>
            )}

            <div className="mt-3 pt-2 border-t border-border-subtle/80 flex items-center justify-between text-[10px] text-text-muted">
              <span>SEBI RIA Compliance Guidelines • Zero Sales</span>
              <button 
                onClick={handleCopyPlan}
                className="flex items-center gap-1 text-primary-accent hover:underline font-medium"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy Strategy'}
              </button>
            </div>
          </section>

        </div>

        {/* 8. Sticky Bottom Action Dock */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background-root/95 backdrop-blur-md border-t border-border-subtle p-3 flex justify-center">
          <div className="w-full max-w-[440px] flex gap-2">
            <button 
              onClick={() => setShowApplyModal(true)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-primary-accent hover:bg-primary-accent/90 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-primary-accent/25 active:scale-[0.98] transition-all"
            >
              <CheckCircle2 size={15} />
              <span>Apply Rebalance Plan</span>
            </button>
            <button 
              onClick={handleCopyPlan}
              className="py-2.5 px-3.5 rounded-xl bg-surface-layer1 border border-border-prominent text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center justify-center gap-1 active:scale-[0.98] transition-all"
            >
              {copied ? <Check size={14} className="text-wealth-emerald" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Export'}</span>
            </button>
          </div>
        </div>

        {/* --- MODAL 1: Target Profile & Gemini Key Customizer --- */}
        {showCustomizer && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-surface-layer1 border border-border-prominent rounded-2xl p-4 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <h3 className="text-sm font-semibold text-text-primary">Customize Target Benchmark</h3>
                <button onClick={() => setShowCustomizer(false)} className="text-text-muted hover:text-text-primary">
                  <X size={18} />
                </button>
              </div>

              {/* Profile Presets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-text-secondary">Benchmark Profile</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.keys(RISK_PROFILES).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setTempProfile(k);
                        setTempTargets({ ...RISK_PROFILES[k].target });
                      }}
                      className={`p-2 rounded-lg text-left border text-xs transition-all ${
                        tempProfile === k 
                          ? 'border-primary-accent bg-primary-accent/15 text-primary-accent font-semibold' 
                          : 'border-border-subtle bg-surface-layer2 text-text-secondary'
                      }`}
                    >
                      <div className="font-medium">{k}</div>
                      <div className="text-[9px] text-text-muted mt-0.5 truncate">{RISK_PROFILES[k].name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders for each Category */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
                  <span>Category Targets (%)</span>
                  <span className={`font-mono ${Object.values(tempTargets).reduce((a, b) => a + (Number(b) || 0), 0) === 100 ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
                    Total: {Object.values(tempTargets).reduce((a, b) => a + (Number(b) || 0), 0)}%
                  </span>
                </div>

                {CORE_CATEGORIES.map(cat => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{cat}</span>
                      <span className="font-bold text-text-primary tabular-nums">{tempTargets[cat] || 0}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={tempTargets[cat] || 0}
                      onChange={(e) => {
                        setTempProfile('Custom');
                        setCustomizerFeedback(null);
                        setTempTargets(prev => ({
                          ...prev,
                          [cat]: Number(e.target.value)
                        }));
                      }}
                      className="w-full accent-primary-accent h-1.5 bg-surface-layer2 rounded-lg cursor-pointer"
                    />
                  </div>
                ))}
              </div>

              {/* Optional Gemini API Key Field */}
              <div className="space-y-1.5 pt-2 border-t border-border-subtle">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                    <Sparkles size={12} className="text-wealth-emerald" />
                    Google Gemini API Key (Optional)
                  </label>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary-accent hover:underline flex items-center gap-0.5"
                  >
                    Get Free Key <ExternalLink size={9} />
                  </a>
                </div>
                <input 
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => {
                    setTempApiKey(e.target.value);
                    setCustomizerFeedback(null);
                  }}
                  placeholder="AIzaSy..."
                  className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary-accent font-mono"
                />
                <p className="text-[9px] text-text-muted">
                  Gemini Flash is 100% free forever (1,500 requests/day). Stored securely in your sheet.
                </p>
              </div>

              {/* Inline Feedback Message */}
              {customizerFeedback && (
                <div className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                  customizerFeedback.isError 
                    ? 'bg-liability-rose/15 border border-liability-rose/30 text-liability-rose' 
                    : 'bg-wealth-emerald/15 border border-wealth-emerald/30 text-wealth-emerald'
                }`}>
                  {customizerFeedback.isError ? <AlertTriangle size={14} className="flex-shrink-0" /> : <CheckCircle2 size={14} className="flex-shrink-0" />}
                  <span>{customizerFeedback.text}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomizer(false);
                    setCustomizerFeedback(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-surface-layer2 text-text-secondary font-semibold text-xs hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomizer}
                  disabled={isSavingSettings}
                  className="flex-1 py-2 rounded-xl bg-primary-accent text-white font-semibold text-xs hover:bg-primary-accent/90 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-primary-accent/20"
                >
                  {isSavingSettings ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Settings</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL 2: Apply Plan Confirmation --- */}
        {showApplyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-surface-layer1 border border-border-prominent rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-wealth-emerald">
                <CheckCircle2 size={20} />
                <h3 className="text-sm font-semibold text-text-primary">Execution Blueprint Ready</h3>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">
                To execute this rebalance with ₹{Number(inflowAmount).toLocaleString('en-IN')}, deploy your fresh savings into the following instruments:
              </p>

              <div className="space-y-1.5 bg-surface-layer2/50 p-2.5 rounded-xl border border-border-subtle text-xs">
                {simulation.projectedBreakdown.filter(b => b.allocatedRupees > 0).map(b => (
                  <div key={b.category} className="flex justify-between py-1 border-b border-border-subtle/40 last:border-0">
                    <span className="text-text-secondary font-medium">{b.category}</span>
                    <span className="font-bold text-wealth-emerald tabular-nums">+{formatCurrency(b.allocatedRupees)}</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-text-muted">
                Tip: Once you complete your investments in your broker or bank, simply add them under the <strong>Assets</strong> tab to watch your portfolio alignment score reach <strong>{simulation.projectedAlignmentScore}/100</strong>!
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2 rounded-xl bg-primary-accent text-white font-semibold text-xs"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
