import React, { useState, useEffect, useMemo } from 'react';
import useModalBack from '../hooks/useModalBack';
import { 
  ArrowLeft, Sparkles, Sliders, AlertTriangle, TrendingUp, TrendingDown, 
  CheckCircle2, Info, Copy, Check, RefreshCw, X, Shield, ChevronRight, 
  HelpCircle, ExternalLink, Flame, DollarSign, Wallet, Radar, Compass,
  Layers, Zap, BarChart3, PieChart, ArrowUpRight, Key
} from 'lucide-react';
import GeminiApiKeyModal from './GeminiApiKeyModal';
import { 
  RISK_PROFILES, 
  CATEGORY_COLORS, 
  CORE_CATEGORIES,
  calculatePortfolioAlignment, 
  simulateInflowRebalancing, 
  calculateCashDrag, 
  auditConcentrationRisk,
  normalizeTargetAllocation,
  analyzePortfolioLookThrough,
  calculateTaxArbitrageOpportunity,
  getCuratedProductRecommendations
} from '../utils/portfolioMath';
import { calculateRetirementPortfolio, isRetirementAsset } from '../utils/retirementMath';
import { calculateConsolidatedInsurance, isInsuranceAsset } from '../utils/insuranceMath';
import RichTextRenderer from './RichTextRenderer';
import { getSafeStorage, setSafeStorage } from '../utils/storage';
import { Badge } from './Badge';

/**
 * Checks whether an asset is an ELSS tax saver fund
 */
export function isElssAsset(asset) {
  if (!asset) return false;
  const name = String(asset.Name || '').toLowerCase();
  const cat = String(asset.Category || '').toLowerCase();
  const det = asset['Details JSON'];
  let subType = '';
  try {
    const d = typeof det === 'string' ? JSON.parse(det) : (det || {});
    subType = String(d['Sub-Type'] || asset['Sub-Type'] || '').toLowerCase();
  } catch (e) {
    subType = String(asset['Sub-Type'] || '').toLowerCase();
  }
  return (
    name.includes('elss') ||
    name.includes('tax saver') ||
    name.includes('tax saving') ||
    name.includes('tax plan') ||
    subType.includes('elss') ||
    (cat.includes('mutual') && (name.includes('elss') || name.includes('tax saver')))
  );
}

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
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // Customizer state
  const [tempProfile, setTempProfile] = useState(savedProfileName);
  const [tempTargets, setTempTargets] = useState({ ...savedTargetMap });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [customizerFeedback, setCustomizerFeedback] = useState(null);

  // AI Insights state
  const [aiInsights, setAiInsights] = useState(null);
  const [aiModelUsed, setAiModelUsed] = useState('');
  const [aiTimestamp, setAiTimestamp] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [copied, setCopied] = useState(false);

  // Product Discovery & Overlap Radar State
  const [activeTab, setActiveTab] = useState('rebalance'); // 'rebalance' | 'products'
  const [productFilter, setProductFilter] = useState('all');
  const [productIntelligence, setProductIntelligence] = useState(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productModelUsed, setProductModelUsed] = useState('');
  const [showDeployGuide, setShowDeployGuide] = useState(false);

  // Sync state if settings change from backend
  useEffect(() => {
    setSelectedProfile(savedProfileName);
    setTargetAllocation(savedTargetMap);
    setTempProfile(savedProfileName);
    setTempTargets({ ...savedTargetMap });
  }, [savedProfileName, savedTargetMap]);

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

  // Local look-through and tax arbitrage calculations
  const localLookThrough = useMemo(() => {
    return analyzePortfolioLookThrough(assets);
  }, [assets]);

  const localTaxArbitrage = useMemo(() => {
    return calculateTaxArbitrageOpportunity(assets);
  }, [assets]);

  const localProductRecs = useMemo(() => {
    return getCuratedProductRecommendations(simulation.projectedBreakdown);
  }, [simulation.projectedBreakdown]);

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

    const retirementSummary = calculateRetirementPortfolio(assets);
    const insuranceSummary = calculateConsolidatedInsurance(assets);
    const elssAssets = assets.filter(isElssAsset);
    const liabilitiesAssets = assets.filter(a => a.Category === 'Liabilities' || (a.Category || '').toLowerCase().includes('loan'));
    const topHoldings = assets
      .filter(a => !isRetirementAsset(a) && !isInsuranceAsset(a) && a.Category !== 'Liabilities')
      .sort((a, b) => (Number(b['Current Value']) || 0) - (Number(a['Current Value']) || 0))
      .slice(0, 10)
      .map(a => ({
        name: a.Name,
        category: a.Category,
        currentValue: Number(a['Current Value'] || 0)
      }));

    const rebalancePayload = {
      netWorth: simulation.netWorth,
      totalGrossAssets: simulation.totalGrossAssets,
      coreInvestableAssets: simulation.coreInvestableAssets,
      alignmentScore: simulation.alignmentScore,
      healthLabel: simulation.healthLabel,
      targetProfile: selectedProfile,
      inflowAmount: simulation.inflowAmount,
      projectedAlignmentScore: simulation.projectedAlignmentScore,
      cashRunwayMonths: cashDrag.runwayMonths,
      totalLiquidCash: cashDrag.totalLiquidCash,
      emergencyReserveTarget: cashDrag.emergencyReserveTarget,
      excessCashDrag: cashDrag.excessCashDrag,
      idleSavingsSurplus: cashDrag.idleSavingsSurplus,
      annualOpportunityCost: cashDrag.annualOpportunityCost,
      breakdown: simulation.projectedBreakdown.map(b => ({
        category: b.category,
        currentValue: b.currentValue,
        currentPct: b.currentPct,
        targetPct: b.targetPct,
        driftPct: b.projectedDrift,
        allocatedRupees: b.allocatedRupees,
        projectedPct: b.projectedPct,
        status: b.status,
        tacticalNote: b.tacticalNote
      })),
      retirement: {
        totalCorpus: retirementSummary.totalRetirementCorpus,
        accountsCount: retirementSummary.accounts.length,
        accounts: retirementSummary.accounts.map(a => ({
          name: a.name,
          subType: a.subType,
          currentValue: a.currentValue,
          interestRate: a.interestRate || null
        }))
      },
      insurance: {
        policiesCount: insuranceSummary.policiesCount,
        totalLifeCover: insuranceSummary.totalLifeCover,
        totalTermCover: insuranceSummary.totalTermCover,
        totalHealthCover: insuranceSummary.totalHealthCover,
        totalAnnualPremium: insuranceSummary.totalAnnualPremium,
        totalSurrenderValue: insuranceSummary.totalSurrenderValue,
        policies: insuranceSummary.policies.map(p => ({
          name: p.name,
          insurer: p.insurer,
          policyType: p.policyType,
          isInvestment: p.isInvestment,
          sumAssured: p.sumAssured,
          annualPremium: p.annualPremium,
          currentValue: p.currentValue
        }))
      },
      elss: {
        totalElssValue: elssAssets.reduce((s, a) => s + (Number(a['Current Value']) || 0), 0),
        holdings: elssAssets.map(a => ({
          name: a.Name,
          currentValue: Number(a['Current Value'] || 0),
          cost: Number(a.Cost || 0)
        }))
      },
      liabilities: {
        totalLiabilities: simulation.totalLiabilities,
        loans: liabilitiesAssets.map(a => ({
          name: a.Name,
          currentBalance: Number(a['Current Value'] || 0)
        }))
      },
      topHoldings,
      concentrationAlerts: concentration.alerts.map(a => ({
        category: a.category,
        percentage: a.percentage,
        message: a.message
      }))
    };

    const token = getSafeStorage('nwm_session_token');
    const keyToUse = savedGeminiKey;

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

        const text = `### 📊 1. Macro Balance Sheet Architecture & Alignment Health
• **Total Net Worth:** Your audited balance sheet stands at **₹${Number(simulation.netWorth).toLocaleString('en-IN')}** across core investable holdings and sovereign retirement vaults.
• **Alignment Score (${simulation.alignmentScore}/100):** Portfolio health reflects your **${selectedProfile}** target benchmark with disciplined asset diversification.

### 💡 2. Smart Inflow Steering (Zero-Tax Non-Sale Rebalancing)
• **Tax-Preserving Capital Injection:** Deploying fresh capital of **₹${Number(inflowAmount).toLocaleString('en-IN')}** improves your alignment health to **${simulation.projectedAlignmentScore}/100** (+${gain} pts) **strictly without selling a single asset**.
• **Section 112A & 111A Capital Gains Shield:** By utilizing inflow steering instead of traditional sell-and-rebuy rebalancing, you avoid triggering 12.5% Long-Term Capital Gains (LTCG) and 20% Short-Term Capital Gains (STCG) taxes.
${simulation.projectedBreakdown.filter(b => b.allocatedRupees > 0).map(b => `• **${b.category} (${b.projectedDrift < 0 ? `${b.projectedDrift}% Underweight` : `Target: ${b.targetPct}%`}):** Deploy **₹${Number(b.allocatedRupees).toLocaleString('en-IN')}**. ${b.tacticalNote}`).join('\n')}

### ⚠️ 3. Liquid Buffer, Cash Drag & Yield Arbitrage
• **Liquid Runway:** Your liquid reserves provide **${cashDrag.runwayMonths} months** of living expenses (₹${Number(cashDrag.totalLiquidCash).toLocaleString('en-IN')}).
${cashDrag.excessCashDrag > 0 ? `• **Excess Cash Drag Alert:** Approximately **₹${Number(cashDrag.excessCashDrag).toLocaleString('en-IN')}** sits idle beyond your recommended 6-month emergency reserve (~₹${Number(cashDrag.emergencyReserveTarget).toLocaleString('en-IN')}). Systematically deploy this surplus into underweight growth assets to eliminate ~₹${Number(cashDrag.excessCashOpportunityCost).toLocaleString('en-IN')}/year in opportunity drag.` : cashDrag.idleSavingsSurplus > 50000 ? `• **Savings Yield Drag Alert:** You hold **₹${Number(cashDrag.idleSavingsSurplus).toLocaleString('en-IN')}** in standard low-yield savings accounts earning only ~2.7-3.0%. Move this to auto-sweep FDs or Arbitrage Funds to capture an extra ~₹${Number(cashDrag.savingsYieldLoss).toLocaleString('en-IN')}/year net yield.` : `• **Emergency Cushion:** Liquid buffer is healthy and fulfills family emergency requirements.`}

### 🏛️ 4. Sovereign Retirement & Pension Strategy (EPF, PPF, NPS)
${retirementSummary.totalRetirementCorpus > 0 ? `• **Sovereign Retirement Wealth:** Your locked retirement corpus totals **₹${Number(retirementSummary.totalRetirementCorpus).toLocaleString('en-IN')}** across sovereign accounts.
${retirementSummary.accounts.map(a => `  - **${a.name} (${a.subType}):** Current balance ₹${Number(a.currentValue).toLocaleString('en-IN')}${a.interestRate ? ` earning ${a.interestRate}% guaranteed tax-free return.` : '.'}`).join('\n')}
• **Asset Allocation Synergy:** Sovereign retirement funds act as high-quality, zero-default sovereign debt. This risk-free fixed income anchor allows you to take higher equity exposure in your discretionary portfolio.
• **Section 80CCD(1B) Optimization:** Ensure you maximize the ₹50,000 exclusive NPS tax deduction under the Old Tax Regime to harvest ~₹15,600 in tax savings.` : `• **Retirement Planning Action:** No formal EPF or NPS accounts are logged. Consider opening an NPS Tier 1 account to capture the exclusive Section 80CCD(1B) ₹50,000 deduction and compound long-term retirement wealth.`}

### 🛡️ 5. Tax-Saving & Insurance Protection Audit (ELSS & LIC)
${elssAssets.length > 0 ? `• **ELSS Tax-Saver Funds:** You hold **₹${Number(elssAssets.reduce((s, a) => s + (Number(a['Current Value']) || 0), 0)).toLocaleString('en-IN')}** across ELSS mutual funds under Section 80C. Units completed past the 3-year lock-in can be systematically harvested up to the ₹1.25L annual tax-free LTCG threshold or reallocated into broad-market index funds.` : `• **Section 80C ELSS Strategy:** If utilizing the Old Tax Regime, consider ELSS funds for the lowest lock-in period (3 years vs 15 years in PPF) and superior equity compounding.`}
${insuranceSummary.policiesCount > 0 ? `• **Protection Coverage:** Pure term life insurance provides **₹${Number(insuranceSummary.totalTermCover).toLocaleString('en-IN')}** of risk cover with an annual premium commitment of **₹${Number(insuranceSummary.totalAnnualPremium).toLocaleString('en-IN')}**.
${insuranceSummary.totalSurrenderValue > 0 ? `• **Traditional LIC / Endowment Plans:** You have **₹${Number(insuranceSummary.totalSurrenderValue).toLocaleString('en-IN')}** accumulated in endowment/traditional policies. Traditional plans typically yield only 4.5% to 5.5% IRR; ensure premium commitments do not exceed Section 10(10D) limits (₹5 Lakhs annual aggregate cap under Budget 2023).` : ''}
${insuranceSummary.totalHealthCover > 0 ? `• **Health Insurance:** Family medical cover of **₹${Number(insuranceSummary.totalHealthCover).toLocaleString('en-IN')}** is active, eligible for Section 80D deductions.` : ''}` : `• **Family Protection Priority:** No active term life or health policies logged. Secure a pure term life cover of 10-15x annual family living expenses and comprehensive health insurance before expanding illiquid assets.`}

### 🎯 6. Actionable 30-Day Execution Roadmap
1. **Direct Fresh Capital:** Allocate proposed inflow of ₹${Number(inflowAmount).toLocaleString('en-IN')} strictly into underweight segments to lift alignment score to ${simulation.projectedAlignmentScore}/100.
2. **Eliminate Cash Drag:** Sweep low-yield savings balance exceeding 1.5 months of expenses into 7.10%+ callable fixed deposits or arbitrage funds.
3. **Retirement & Tax Audit:** Review ELSS mature units for tax-loss harvesting and ensure NPS ₹50,000 contribution is utilized.
4. **Maintain Pure Protection:** Verify pure term life coverage is at least 10x annual expenses without commingling insurance with investments.`;

        setAiInsights(text);
        setAiModelUsed('Preview Heuristics Advisor');
        setAiTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }, 700);
    }
  };

  // Generate Product Intelligence & Overlap analysis
  const handleGenerateProductIntelligence = (forceRefresh = false) => {
    if (isLoadingProducts || (productIntelligence && !forceRefresh)) return;
    setIsLoadingProducts(true);

    const payload = {
      holdings: assets.map(a => ({
        category: a.Category,
        name: a.Name,
        currentValue: Number(a['Current Value'] || 0),
        percentage: simulation.totalGrossAssets > 0 ? Number(((Number(a['Current Value'] || 0) / simulation.totalGrossAssets) * 100).toFixed(1)) : 0
      })),
      breakdown: simulation.projectedBreakdown.map(b => ({
        category: b.category,
        currentPct: b.currentPct,
        targetPct: b.targetPct,
        allocatedRupees: b.allocatedRupees,
        status: b.status
      }))
    };

    const token = getSafeStorage('nwm_session_token');
    const keyToUse = savedGeminiKey;

    function fallbackLocalProducts() {
      setProductIntelligence({
        macroRegime: { peRatio: "21.8", valuationStatus: "Fair Valuation Zone", gsecYield: "6.84%" },
        overlapAnalysis: {
          overlapDetected: localLookThrough.hasHighOverlap,
          overlapPercentage: localLookThrough.overlapPercentage,
          schemePair: localLookThrough.overlappingPair,
          commonHoldings: localLookThrough.commonHoldings,
          note: localLookThrough.hasHighOverlap 
            ? "High common weight in top bluechip heavyweights. Allocate fresh capital to non-overlapping market-cap segments." 
            : "Healthy diversification across schemes."
        },
        sectorExposure: localLookThrough.sectorExposure,
        marketCapSplit: localLookThrough.marketCapSplit,
        taxArbitrageSwitch: {
          title: "Debt vs Arbitrage Switch",
          potentialSavingsRupees: localTaxArbitrage.potentialSavingsRupees,
          description: "In the 30% tax bracket, Bank FDs are taxed at ~31.2%, while Arbitrage Funds enjoy equity capital gains taxation (12.5% LTCG / 20% STCG with ₹1.25L annual exemption), unlocking an extra ~1.5% net post-tax yield."
        },
        productRecommendations: localProductRecs
      });
      setProductModelUsed('Deterministic Intelligence Engine');
    }

    if (window.google?.script?.run?.generateProductIntelligence) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsLoadingProducts(false);
          if (res?.status === 'success' && res.data) {
            setProductIntelligence(res.data);
            setProductModelUsed(res.modelUsed || 'AI Advisor');
          } else {
            fallbackLocalProducts();
          }
        })
        .withFailureHandler(() => {
          setIsLoadingProducts(false);
          fallbackLocalProducts();
        })
        .generateProductIntelligence(payload, keyToUse, token);
    } else {
      setTimeout(() => {
        setIsLoadingProducts(false);
        fallbackLocalProducts();
      }, 500);
    }
  };

  const handleCopyProductStrategy = () => {
    const activeData = productIntelligence || {
      overlapAnalysis: { overlapPercentage: localLookThrough.overlapPercentage, schemePair: localLookThrough.overlappingPair },
      taxArbitrageSwitch: { potentialSavingsRupees: localTaxArbitrage.potentialSavingsRupees },
      productRecommendations: localProductRecs
    };
    const lines = [
      `Net Worth Manager — AI Product Discovery & Overlap Blueprint`,
      `Generated: ${new Date().toLocaleDateString('en-IN')}`,
      ``,
      `--- PORTFOLIO OVERLAP & LOOK-THROUGH ---`,
      `Fund Overlap: ${activeData.overlapAnalysis?.overlapPercentage || 0}% (${activeData.overlapAnalysis?.schemePair || 'Holdings'})`,
      `Large Cap: ${localLookThrough.marketCapSplit.largeCap}% | Mid Cap: ${localLookThrough.marketCapSplit.midCap}% | Small Cap: ${localLookThrough.marketCapSplit.smallCap}%`,
      ``,
      `--- TAX & YIELD ARBITRAGE SWITCH ---`,
      `Est. Annual Savings: ₹${Number(activeData.taxArbitrageSwitch?.potentialSavingsRupees || 14200).toLocaleString('en-IN')}`,
      `Strategy: Shift idle Bank FDs to Arbitrage Funds for 12.5% LTCG vs 31.2% slab tax`,
      ``,
      `--- CURATED ZERO-COMMISSION DIRECT PRODUCTS ---`,
      ...(activeData.productRecommendations || []).map(p => `• [${p.category}] ${p.name} (TER: ${p.ter} | Tag: ${p.tag})\n  Why: ${p.why}`)
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showMessage('Product discovery strategy copied to clipboard!');
  };

  // Automatically fetch initial insights if not already present
  useEffect(() => {
    if (isOpen && !aiInsights && !isLoadingAI) {
      handleGenerateAIInsights();
    }
  }, [isOpen]);

  // Save Target Profile Benchmark
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
        // Refresh AI advisory insights with the updated targets
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
            finishSave(res?.message || 'Portfolio benchmark settings saved!');
          }
        })
        .withFailureHandler((err) => {
          setIsSavingSettings(false);
          setCustomizerFeedback({ text: 'Error: ' + err.message, isError: true });
          showMessage('Error saving settings: ' + err.message, true);
        })
        .savePortfolioSettings(payload, tempProfile, undefined, token);
    } else if (window.google?.script?.run?.upsertSetting) {
      // Fallback
      window.google.script.run
        .withSuccessHandler(() => finishSave('Settings saved!'))
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
      `Cash Runway: ${cashDrag.runwayMonths} months (${cashDrag.excessCashDrag > 0 ? `Excess Drag: ₹${Number(cashDrag.excessCashDrag).toLocaleString('en-IN')}` : cashDrag.idleSavingsSurplus > 50000 ? `Idle Savings Drag: ₹${Number(cashDrag.idleSavingsSurplus).toLocaleString('en-IN')}` : 'Buffer Healthy'})`
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
        <header className="sticky top-0 z-40 bg-background-root/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <button 
              onClick={onClose}
              aria-label="Go back" 
              className="w-8 h-8 rounded-full border border-white/[0.08] bg-surface-layer1/80 hover:bg-surface-layer2 flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-95 transition-all"
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <h1 className="text-typ-body-sm font-semibold text-text-primary tracking-tight">AI Portfolio Advisor</h1>
              <p className="text-typ-caption text-text-muted">Smart Inflow Engine • Zero Tax</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={() => setShowApiKeyModal(true)}
              title="Gemini AI API Key Settings"
              className="p-1.5 rounded-lg bg-surface-layer2/80 hover:bg-surface-layer2 border border-white/[0.1] text-text-secondary hover:text-wealth-emerald active:scale-95 transition-all"
            >
              <Key size={15} />
            </button>
            <button 
              onClick={() => setShowCustomizer(true)}
              title="Customize Target Benchmark"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-layer2/80 hover:bg-surface-layer2 border border-white/[0.1] text-text-secondary hover:text-text-primary active:scale-95 transition-all text-typ-label font-medium"
            >
              <span className="text-typ-footnote font-semibold text-text-primary">{selectedProfile}</span>
              <Sliders size={12} className="text-text-muted" />
            </button>
          </div>
        </header>

        {/* Segmented Mode Navigation Bar */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex p-1 bg-surface-layer2/80 rounded-xl border border-white/[0.06] text-typ-label font-semibold">
            <button
              onClick={() => setActiveTab('rebalance')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'rebalance'
                  ? 'bg-primary-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Wallet size={13} />
              <span>1. Allocation Plan</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('products');
                if (!productIntelligence) handleGenerateProductIntelligence();
              }}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'products'
                  ? 'bg-primary-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Compass size={13} />
              <span>2. Product Discovery & Overlap</span>
              {localLookThrough.hasHighOverlap && (
                <span className="w-1.5 h-1.5 rounded-full bg-bullion-amber"></span>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content Canvas - TAB 1: Allocation Plan */}
        {activeTab === 'rebalance' && (
          <div className="px-4 flex flex-col gap-3.5 pt-2">
          
          {/* 2. Portfolio Health & Drift Hero Card */}
          <section className="bg-surface-layer1 rounded-xl p-4 border border-white/[0.08] relative overflow-hidden shadow-sm">
            {/* Ambient Subtle Indigo Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-accent/15 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-typ-caption font-bold text-text-muted uppercase tracking-wider">Total Portfolio Wealth</span>
                <div className="text-typ-heading font-bold text-text-primary tabular-nums tracking-tight">
                  {formatCurrency(simulation.netWorth)}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {/* Maximum Overweight Segment Pill */}
                  {simulation.maxOverweight && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-liability-rose/10 border border-liability-rose/25 text-liability-rose text-typ-caption font-medium">
                      <AlertTriangle size={11} />
                      <span>+{simulation.maxOverweight.drift.toFixed(1)}% {simulation.maxOverweight.name} Overweight</span>
                    </div>
                  )}

                  {/* Cash Drift Pill */}
                  {simulation.cashItem && simulation.cashItem.status === 'overweight' && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bullion-amber/10 border border-bullion-amber/25 text-bullion-amber text-typ-caption font-medium">
                      <TrendingUp size={11} />
                      <span>+{simulation.cashItem.driftPct}% Cash Drift</span>
                    </div>
                  )}
                  {simulation.cashItem && simulation.cashItem.status === 'underweight' && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-400 text-typ-caption font-medium">
                      <TrendingDown size={11} />
                      <span>{simulation.cashItem.driftPct}% Cash Shortfall</span>
                    </div>
                  )}
                  {simulation.cashItem && simulation.cashItem.status === 'aligned' && simulation.cashItem.currentValue > 0 && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-wealth-emerald/10 border border-wealth-emerald/25 text-wealth-emerald text-typ-caption font-medium">
                      <CheckCircle2 size={11} />
                      <span>Cash Aligned ({simulation.cashItem.targetPct}%)</span>
                    </div>
                  )}

                  {/* Cash Drag Pill */}
                  {cashDrag.excessCashDrag > 0 && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bullion-amber/10 border border-bullion-amber/25 text-bullion-amber text-typ-caption font-medium">
                      <Flame size={11} />
                      <span>{formatCurrency(cashDrag.excessCashDrag)} Cash Drag</span>
                    </div>
                  )}
                  {cashDrag.excessCashDrag === 0 && cashDrag.idleSavingsSurplus > 50000 && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bullion-amber/10 border border-bullion-amber/25 text-bullion-amber text-typ-caption font-medium">
                      <Flame size={11} />
                      <span>{formatCurrency(cashDrag.idleSavingsSurplus)} Idle Savings Drag</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Alignment Score Gauge Dial (Refined non-overflowing circle with clean status badge) */}
              <div 
                className="flex flex-col items-center gap-1 flex-shrink-0"
                title={`Portfolio Alignment Health Score: ${simulation.alignmentScore}/100 against ${selectedProfile} risk profile target`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Health Score
                </span>
                <div className={`relative flex flex-col items-center justify-center w-[74px] h-[74px] rounded-full bg-surface-layer2/90 border-2 transition-all ${
                  simulation.alignmentScore >= 80 
                    ? 'border-wealth-emerald/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                    : simulation.alignmentScore >= 60 
                    ? 'border-bullion-amber/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                    : 'border-liability-rose/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                }`}>
                  <span className={`text-typ-heading font-black tabular-nums leading-none ${
                    simulation.alignmentScore >= 80 ? 'text-wealth-emerald' : simulation.alignmentScore >= 60 ? 'text-bullion-amber' : 'text-liability-rose'
                  }`}>
                    {simulation.alignmentScore}
                  </span>
                  <span className="text-typ-micro uppercase tracking-wider text-text-muted font-bold mt-0.5">
                    / 100
                  </span>
                </div>
                <span className={`text-typ-micro font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border text-center leading-none whitespace-nowrap ${
                  simulation.alignmentScore >= 80 
                    ? 'bg-wealth-emerald/15 border-wealth-emerald/30 text-wealth-emerald' 
                    : simulation.alignmentScore >= 60 
                    ? 'bg-bullion-amber/15 border-bullion-amber/30 text-bullion-amber' 
                    : 'bg-liability-rose/15 border-liability-rose/30 text-liability-rose'
                }`}>
                  {simulation.healthLabel}
                </span>
              </div>
            </div>

            {/* Inflow Adjustment Indicator Badge */}
            <div className="mt-3.5 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-typ-label">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bullion-amber opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-bullion-amber"></span>
                </span>
                <span className="text-text-secondary text-typ-footnote">
                  {simulation.totalAbsDrift > 4 ? 'Requires Inflow Adjustment' : 'Portfolio In Healthy Range'}
                </span>
              </div>
              <span className="text-typ-caption text-wealth-emerald font-medium">
                No-sale rebalance active
              </span>
            </div>
          </section>

          {/* 3. Allocation Visualizer (Current vs Target vs Projected) */}
          <section className="bg-surface-layer1 rounded-xl p-4 border border-white/[0.08] flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-typ-label font-semibold text-text-primary">Allocation Alignment</h2>
                <p className="text-typ-footnote text-text-muted">Target profile drift comparison</p>
              </div>
              <span className="text-typ-footnote font-medium text-text-muted">
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
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-layer2 text-text-secondary text-typ-caption font-medium border border-white/[0.06]"
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
                <div className="flex justify-between text-typ-footnote mb-1">
                  <span className="text-text-secondary">1. Current Allocation</span>
                  <span className="text-text-muted font-mono">{simulation.alignmentScore}/100</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface-layer2 flex overflow-hidden border border-white/[0.06]">
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
                <div className="flex justify-between text-typ-footnote mb-1">
                  <span className="text-text-secondary">2. Target Benchmark ({selectedProfile})</span>
                  <span className="text-primary-accent font-medium text-typ-caption">Benchmark</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface-layer2 flex overflow-hidden border border-white/[0.06] opacity-75">
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
                <div className="flex justify-between text-typ-footnote mb-1">
                  <span className="text-wealth-emerald font-medium">3. Projected Post-Inflow (+₹{Number(inflowAmount).toLocaleString('en-IN')})</span>
                  <span className="text-wealth-emerald font-semibold text-typ-caption">
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
          <section className="bg-surface-layer1 rounded-xl p-4 border border-white/[0.08] flex flex-col gap-3 shadow-sm">
            <div>
              <div className="flex items-center gap-1.5 text-typ-label font-semibold text-text-primary">
                <Wallet size={14} className="text-primary-accent" />
                <span>Deploy Fresh Capital</span>
              </div>
              <p className="text-typ-footnote text-text-muted mt-0.5">
                Rebalance without selling to minimize Section 112A capital gains tax.
              </p>
            </div>

            {/* Quick Chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {[25000, 50000, 100000, 250000].map(amt => (
                <button
                  key={amt}
                  onClick={() => handleChipSelect(amt)}
                  className={`py-1.5 px-1 rounded-lg text-typ-footnote font-semibold border transition-all tabular-nums ${
                    inflowAmount === amt
                      ? 'bg-primary-accent/20 border-primary-accent/50 text-primary-accent shadow-sm'
                      : 'bg-surface-layer2/60 border-white/[0.06] hover:border-white/[0.14] text-text-secondary hover:text-text-primary'
                  }`}
                >
                  ₹{amt >= 100000 ? `${amt / 100000}L` : `${amt / 1000}k`}
                </button>
              ))}
            </div>

            {/* Custom Amount Input & Slider */}
            <div className="space-y-2">
              <div className="relative flex items-center">
                <span className="absolute left-3 text-text-muted font-bold text-typ-body-sm">₹</span>
                <input 
                  type="text"
                  value={customInflowInput}
                  onChange={handleCustomInputChange}
                  placeholder="Enter investment amount"
                  className="w-full bg-surface-layer2/70 border border-white/[0.1] rounded-lg pl-7 pr-16 py-2 text-typ-body-sm font-bold text-text-primary tabular-nums focus:outline-none focus:border-primary-accent/80 transition-colors"
                />
                <span className="absolute right-3 text-typ-caption text-text-muted font-semibold uppercase">
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
              <h3 className="text-typ-label font-semibold text-text-primary">Recommended Deployments</h3>
              <span className="text-typ-caption text-text-muted">Proportional Shortfall Engine</span>
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
                    className="bg-surface-layer1 border border-white/[0.07] hover:border-white/[0.12] rounded-xl p-3 flex flex-col gap-1.5 shadow-sm transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${conf.bgClass}`}></span>
                        <span className="text-typ-label font-semibold text-text-primary">{item.category}</span>
                      </div>

                      {/* Status Tag */}
                      {isUnder && (
                        <Badge variant="sky" size="xs">
                          {Math.abs(item.currentPct - item.targetPct).toFixed(1)}% Underweight
                        </Badge>
                      )}
                      {isOver && (
                        <Badge variant="rose" size="xs">
                          +{Math.abs(item.currentPct - item.targetPct).toFixed(1)}% Overweight
                        </Badge>
                      )}
                      {!isUnder && !isOver && (
                        <Badge variant="emerald" dot size="xs">
                          On Target ({item.targetPct}%)
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-typ-caption text-text-muted">Current → Projected:</span>
                        <span className="text-typ-label font-medium text-text-secondary ml-1 tabular-nums">
                          {item.currentPct}% → <strong className="text-text-primary">{item.projectedPct}%</strong> (Target: {item.targetPct}%)
                        </span>
                      </div>

                      <div className="text-right">
                        {hasAlloc ? (
                          <span className="text-typ-body-sm font-bold text-wealth-emerald tabular-nums">
                            +{formatCurrency(item.allocatedRupees)}
                          </span>
                        ) : (
                          <span className="text-typ-label font-medium text-text-muted">
                            ₹0 (Hold)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tactical Tip Note */}
                    <div className="text-typ-caption text-text-muted bg-surface-layer2/40 px-2.5 py-1.5 rounded-lg border border-white/[0.04] mt-0.5">
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
            <div className="bg-surface-layer1 border border-white/[0.07] rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-typ-footnote font-semibold text-text-secondary flex items-center gap-1">
                    <Flame size={12} className="text-bullion-amber" />
                    Cash Drag & Runway
                  </span>
                  <span className="text-typ-caption font-mono text-bullion-amber">
                    {cashDrag.runwayMonths} Mos
                  </span>
                </div>
                <p className="text-typ-body-sm font-bold text-text-primary tabular-nums">
                  {formatCurrency(cashDrag.totalLiquidCash)}
                </p>
                <p className="text-typ-caption text-text-muted mt-0.5">
                  6-Mo Emergency Buffer: {formatCurrency(cashDrag.emergencyReserveTarget)}
                </p>
              </div>

              {cashDrag.totalLiquidCash === 0 ? (
                <div className="mt-2 text-typ-caption bg-surface-layer2 border border-white/[0.08] text-text-muted p-1.5 rounded font-medium">
                  ℹ️ No liquid cash assets logged. Add a savings or FD account to audit runway.
                </div>
              ) : cashDrag.excessCashDrag > 0 ? (
                <div className="mt-2 text-typ-caption bg-bullion-amber/10 border border-bullion-amber/20 text-bullion-amber p-1.5 rounded font-medium">
                  ⚠️ {formatCurrency(cashDrag.excessCashDrag)} excess idle cash drag identified beyond 6-month buffer (~{formatCurrency(cashDrag.excessCashOpportunityCost)}/yr opportunity cost).
                </div>
              ) : cashDrag.idleSavingsSurplus > 50000 ? (
                <div className="mt-2 text-typ-caption bg-bullion-amber/10 border border-bullion-amber/20 text-bullion-amber p-1.5 rounded font-medium">
                  ⚠️ {formatCurrency(cashDrag.idleSavingsSurplus)} idle in low-yield savings (~{formatCurrency(cashDrag.savingsYieldLoss)}/yr yield loss). Move to auto-sweep FD or liquid fund.
                </div>
              ) : cashDrag.isLowBuffer ? (
                <div className="mt-2 text-typ-caption bg-liability-rose/10 border border-liability-rose/20 text-liability-rose p-1.5 rounded font-medium">
                  ⚠️ Low reserve: {cashDrag.runwayMonths} mos runway (Goal: 6 mos / {formatCurrency(cashDrag.emergencyReserveTarget)}).
                </div>
              ) : (
                <div className="mt-2 text-typ-caption bg-wealth-emerald/10 border border-wealth-emerald/20 text-wealth-emerald p-1.5 rounded font-medium">
                  ✓ Healthy liquid emergency cushion maintained ({cashDrag.runwayMonths} mos runway).
                </div>
              )}
            </div>

            {/* Concentration Risk Card */}
            <div className="bg-surface-layer1 border border-white/[0.07] rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-typ-footnote font-semibold text-text-secondary flex items-center gap-1">
                    <Shield size={12} className="text-primary-accent" />
                    Asset Concentration
                  </span>
                  <span className="text-typ-caption font-mono text-text-muted">
                    Max 15% Cap
                  </span>
                </div>
                <p className="text-typ-body-sm font-bold text-text-primary">
                  {concentration.alerts.length === 0 ? 'No Critical Skew' : `${concentration.alerts.length} Alert(s)`}
                </p>
                <p className="text-typ-caption text-text-muted mt-0.5">
                  Audit against single-stock drawdown risks
                </p>
              </div>

              {concentration.alerts.length > 0 ? (
                <div className="mt-2 text-typ-caption bg-liability-rose/10 border border-liability-rose/20 text-liability-rose p-1.5 rounded font-medium">
                  ⚠️ {concentration.alerts[0].name} exceeds threshold ({concentration.alerts[0].percentage}%).
                </div>
              ) : (
                <div className="mt-2 text-typ-caption bg-wealth-emerald/10 border border-wealth-emerald/20 text-wealth-emerald p-1.5 rounded font-medium">
                  ✓ Equity holdings well-diversified.
                </div>
              )}
            </div>
          </section>

          {/* 7. Gemini AI Strategic Synthesis */}
          <section className="bg-surface-layer1 border border-primary-accent/25 rounded-2xl p-4 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={16} className="text-wealth-emerald animate-pulse" />
                <h3 className="text-typ-label font-semibold text-text-primary">
                  {aiModelUsed.includes('Gemini') ? 'Gemini AI Advisory Synthesis' : 'Financial Strategic Synthesis'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {aiTimestamp && (
                  <span className="text-typ-micro text-text-muted">{aiTimestamp}</span>
                )}
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(true)}
                  className="p-1.5 rounded-lg bg-surface-layer2/60 border border-white/[0.06] text-text-secondary hover:text-wealth-emerald transition-all"
                  title="Configure Gemini API Key"
                >
                  <Key size={12} />
                </button>
                <button 
                  onClick={() => handleGenerateAIInsights(true)}
                  disabled={isLoadingAI}
                  className="p-1.5 rounded-lg bg-surface-layer2/60 border border-white/[0.06] text-text-secondary hover:text-text-primary disabled:opacity-50 transition-all"
                  title="Refresh AI Insights"
                >
                  <RefreshCw size={12} className={isLoadingAI ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {isLoadingAI ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-text-muted">
                <RefreshCw size={20} className="animate-spin text-primary-accent" />
                <p className="text-typ-label">Analyzing portfolio & tax dynamics...</p>
              </div>
            ) : aiInsights ? (
              <div className="p-3.5 rounded-xl bg-surface-layer2/40 border border-white/[0.06] shadow-inner">
                <RichTextRenderer content={aiInsights} />
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-typ-label text-text-muted">Tap refresh to synthesize recommendations.</p>
              </div>
            )}

            <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-typ-caption text-text-muted">
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

          {/* Quick Switch Callout to Products & Overlap */}
          <div 
            onClick={() => {
              setActiveTab('products');
              if (!productIntelligence) handleGenerateProductIntelligence();
            }}
            className="bg-surface-layer1 border border-primary-accent/30 hover:border-primary-accent/60 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all group shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-accent/15 flex items-center justify-center text-primary-accent border border-primary-accent/25">
                <Compass size={16} />
              </div>
              <div>
                <div className="text-typ-label font-semibold text-text-primary group-hover:text-primary-accent transition-colors flex items-center gap-1.5">
                  <span>Explore Direct Products & Overlap Radar</span>
                  <Badge variant="emerald" dot size="xs">
                    New
                  </Badge>
                </div>
                <div className="text-typ-caption text-text-muted">
                  Find mutual funds, ETFs, & SGBs matching your shortfalls
                </div>
              </div>
            </div>
            <ChevronRight size={15} className="text-primary-accent group-hover:translate-x-0.5 transition-transform" />
          </div>

        </div>
        )}

        {/* Scrollable Content Canvas - TAB 2: Product Discovery & Overlap */}
        {activeTab === 'products' && (
          <div className="px-4 flex flex-col gap-3.5 pt-2">
            
            {/* 1. Macro & Valuation Regime Ticker */}
            <section className="bg-surface-layer1 rounded-xl p-3 border border-white/[0.07] flex items-center justify-between text-typ-label shadow-sm">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-primary-accent/15 text-primary-accent border border-primary-accent/20">
                  <TrendingUp size={14} />
                </span>
                <div>
                  <div className="text-typ-footnote font-semibold text-text-primary">Macro & Valuation Regime</div>
                  <div className="text-typ-micro text-text-muted">
                    {productIntelligence?.macroRegime?.valuationStatus || 'Fair Valuation Zone'} • 10Y G-Sec: {productIntelligence?.macroRegime?.gsecYield || '6.84%'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="emerald" size="xs" className="font-mono">
                  P/E {productIntelligence?.macroRegime?.peRatio || '21.8'}
                </Badge>
                <button
                  onClick={() => handleGenerateProductIntelligence(true)}
                  disabled={isLoadingProducts}
                  className="p-1 rounded bg-surface-layer2 text-text-secondary hover:text-text-primary transition-all disabled:opacity-50"
                  title="Refresh market intelligence"
                >
                  <RefreshCw size={11} className={isLoadingProducts ? "animate-spin" : ""} />
                </button>
              </div>
            </section>

            {/* 2. Portfolio Look-Through & Overlap Radar Card */}
            <section className="bg-surface-layer1 rounded-2xl p-4 border border-white/[0.08] flex flex-col gap-3 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Radar size={16} className="text-bullion-amber animate-pulse" />
                  <h2 className="text-typ-label font-semibold text-text-primary">Portfolio Look-Through & Overlap</h2>
                </div>
                <Badge 
                  variant={(productIntelligence?.overlapAnalysis?.overlapPercentage || localLookThrough.overlapPercentage) >= 40 ? 'rose' : 'emerald'} 
                  dot 
                  size="xs"
                >
                  {(productIntelligence?.overlapAnalysis?.overlapPercentage || localLookThrough.overlapPercentage) >= 40 ? 'High Duplication' : 'Well Diversified'}
                </Badge>
              </div>

              {/* Overlap Alert Card */}
              <div className="bg-surface-layer2/60 border border-bullion-amber/25 rounded-xl p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-typ-footnote font-semibold text-bullion-amber flex items-center gap-1">
                    <AlertTriangle size={13} />
                    {productIntelligence?.overlapAnalysis?.overlapPercentage || localLookThrough.overlapPercentage}% Fund Overlap Identified
                  </span>
                  <span className="text-typ-micro font-mono text-text-muted">
                    {localLookThrough.equityHoldingsCount} Schemes
                  </span>
                </div>
                <p className="text-typ-footnote text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">{productIntelligence?.overlapAnalysis?.schemePair || localLookThrough.overlappingPair}</strong> share common heavyweights in <span className="text-text-primary">{localLookThrough.commonHoldings.slice(0, 4).join(', ')}</span>.
                </p>
                <div className="text-typ-micro text-text-muted pt-1 border-t border-white/[0.04]">
                  💡 {productIntelligence?.overlapAnalysis?.note || "Allocate fresh capital to non-overlapping market-cap segments."}
                </div>
              </div>

              {/* Sector Exposure Heatmap Chips */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex justify-between items-center text-typ-caption text-text-secondary">
                  <span className="font-semibold">Underlying Sector Skew</span>
                  <span className="text-liability-rose font-mono">Financials Skewed</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(productIntelligence?.sectorExposure || localLookThrough.sectorExposure).map(sec => (
                    <span 
                      key={sec.sector}
                      className={`px-2 py-1 rounded-lg border text-typ-caption font-medium flex items-center gap-1 ${
                        sec.status === 'overweight' 
                          ? 'bg-liability-rose/10 border-liability-rose/25 text-liability-rose font-semibold' 
                          : 'bg-surface-layer2 border-white/[0.06] text-text-secondary'
                      }`}
                    >
                      <span>{sec.sector}</span>
                      <strong className={`tabular-nums ${sec.status === 'overweight' ? 'text-liability-rose' : 'text-text-primary'}`}>
                        {sec.percentage}%
                      </strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Market Cap True Split Bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-typ-caption text-text-muted">
                  <span className="font-medium">Market Cap Exposure</span>
                  <span className="text-text-secondary font-mono">
                    Large: {productIntelligence?.marketCapSplit?.largeCap || localLookThrough.marketCapSplit.largeCap}% • Mid: {productIntelligence?.marketCapSplit?.midCap || localLookThrough.marketCapSplit.midCap}% • Small: {productIntelligence?.marketCapSplit?.smallCap || localLookThrough.marketCapSplit.smallCap}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-layer2 flex overflow-hidden border border-white/[0.06]">
                  <div className="bg-[#6366F1] h-full" style={{ width: `${productIntelligence?.marketCapSplit?.largeCap || 68}%` }} title="Large Cap"></div>
                  <div className="bg-[#38BDF8] h-full" style={{ width: `${productIntelligence?.marketCapSplit?.midCap || 22}%` }} title="Mid Cap"></div>
                  <div className="bg-[#F59E0B] h-full" style={{ width: `${productIntelligence?.marketCapSplit?.smallCap || 10}%` }} title="Small Cap"></div>
                </div>
              </div>
            </section>

            {/* 3. Tactical Tax & Yield Arbitrage Switch */}
            <section className="bg-surface-layer1 rounded-2xl p-4 border border-wealth-emerald/25 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap size={15} className="text-wealth-emerald" />
                  <h2 className="text-typ-label font-semibold text-text-primary">
                    {productIntelligence?.taxArbitrageSwitch?.title || "Debt vs Arbitrage Switch"}
                  </h2>
                </div>
                <Badge variant="emerald" dot size="xs">
                  +₹{Number(productIntelligence?.taxArbitrageSwitch?.potentialSavingsRupees || localTaxArbitrage.potentialSavingsRupees).toLocaleString('en-IN')} / Yr
                </Badge>
              </div>

              <p className="text-typ-footnote text-text-secondary leading-relaxed">
                {productIntelligence?.taxArbitrageSwitch?.description || localTaxArbitrage.description || 
                  "In the 30% tax bracket, Bank FDs are taxed at ~31.2%, while Arbitrage Funds enjoy equity capital gains taxation (12.5% LTCG / 20% STCG with ₹1.25L exemption), unlocking an extra ~1.5% net post-tax yield."}
              </p>
            </section>

            {/* 4. Curated Product Recommendations */}
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-typ-label font-semibold text-text-primary">Curated Direct Product Recommendations</h3>
                  <p className="text-typ-caption text-text-muted">Targeted solutions for your underweight shortfall</p>
                </div>
                <Badge variant="emerald" size="xs">
                  Zero Commission Direct
                </Badge>
              </div>

              {/* Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {['all', 'Equity', 'Gold', 'Cash/FD', 'Mutual Funds'].map(f => (
                  <button
                    key={f}
                    onClick={() => setProductFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-typ-caption font-semibold transition-all whitespace-nowrap border ${
                      productFilter === f
                        ? 'bg-primary-accent/20 border-primary-accent/50 text-primary-accent shadow-sm'
                        : 'bg-surface-layer2/80 border-white/[0.06] text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {f === 'all' ? 'All Ideas' : f}
                  </button>
                ))}
              </div>

              {/* Product Cards List */}
              <div className="space-y-2.5">
                {(productIntelligence?.productRecommendations || localProductRecs)
                  .filter(p => productFilter === 'all' || p.category === productFilter)
                  .map(prod => (
                    <div 
                      key={prod.id || prod.name}
                      className="bg-surface-layer1 border border-white/[0.07] hover:border-white/[0.14] rounded-xl p-3.5 flex flex-col gap-2 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              prod.category === 'Equity' ? 'bg-[#6366F1]' :
                              prod.category === 'Gold' ? 'bg-[#F59E0B]' :
                              prod.category === 'Cash/FD' ? 'bg-[#10B981]' : 'bg-[#8B5CF6]'
                            }`}></span>
                            <span className="text-typ-label font-semibold text-text-primary">{prod.name}</span>
                          </div>
                          <span className="text-typ-caption text-text-muted">{prod.category} • Direct Growth</span>
                        </div>
                        <Badge variant="emerald" size="xs">
                          {prod.tag}
                        </Badge>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-1.5 py-1 text-center bg-surface-layer2/50 rounded-lg border border-white/[0.04]">
                        <div>
                          <div className="text-typ-micro text-text-muted">Expense Ratio</div>
                          <div className="text-typ-label font-bold text-text-primary tabular-nums">{prod.ter}</div>
                        </div>
                        <div>
                          <div className="text-typ-micro text-text-muted">Tracking / Risk</div>
                          <div className="text-typ-label font-bold text-wealth-emerald tabular-nums">{prod.trackingError}</div>
                        </div>
                        <div>
                          <div className="text-typ-micro text-text-muted">3Y CAGR / Return</div>
                          <div className="text-typ-label font-bold text-text-primary tabular-nums">{prod.cagr3Y}</div>
                        </div>
                      </div>

                      <p className="text-typ-caption text-text-secondary leading-relaxed">
                        <strong className="text-text-primary">Why:</strong> {prod.why}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-typ-micro text-text-muted">
                        <span>{prod.taxNote}</span>
                        <button
                          onClick={() => setShowDeployGuide(true)}
                          className="text-primary-accent hover:underline font-semibold flex items-center gap-0.5"
                        >
                          How to Invest <ArrowUpRight size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            {/* 5. SEBI Regulatory & Compliance Disclaimer */}
            <section className="p-3 rounded-xl bg-surface-layer2/40 border border-white/[0.06] text-typ-caption text-text-muted space-y-1">
              <div className="font-semibold text-text-secondary flex items-center gap-1">
                <Shield size={12} className="text-primary-accent" />
                <span>SEBI Compliance & Disclosure</span>
              </div>
              <p className="leading-relaxed">
                Automated algorithmic research & portfolio look-through for educational purposes only. Not SEBI registered investment advice. Users should consult a qualified financial advisor before executing trades.
              </p>
            </section>

          </div>
        )}

        {/* 8. Sticky Bottom Action Dock */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background-root/95 backdrop-blur-md border-t border-white/[0.07] p-3 flex justify-center">
          <div className="w-full max-w-[440px] flex gap-2">
            {activeTab === 'rebalance' ? (
              <>
                <button 
                  onClick={() => setShowApplyModal(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary-accent hover:bg-primary-accent/90 text-white font-semibold text-typ-label flex items-center justify-center gap-1.5 shadow-lg shadow-primary-accent/25 active:scale-[0.98] transition-all"
                >
                  <CheckCircle2 size={15} />
                  <span>Apply Rebalance Plan</span>
                </button>
                <button 
                  onClick={handleCopyPlan}
                  className="py-2.5 px-3.5 rounded-xl bg-surface-layer1 hover:bg-surface-layer2/80 border border-white/[0.08] hover:border-white/[0.14] text-text-secondary hover:text-text-primary text-typ-label font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-sm"
                >
                  {copied ? <Check size={14} className="text-wealth-emerald" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Export'}</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setShowDeployGuide(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary-accent hover:bg-primary-accent/90 text-white font-semibold text-typ-label flex items-center justify-center gap-1.5 shadow-lg shadow-primary-accent/25 active:scale-[0.98] transition-all"
                >
                  <ExternalLink size={15} />
                  <span>Deploy via Broker / MF Central</span>
                </button>
                <button 
                  onClick={handleCopyProductStrategy}
                  className="py-2.5 px-3.5 rounded-xl bg-surface-layer1 hover:bg-surface-layer2/80 border border-white/[0.08] hover:border-white/[0.14] text-text-secondary hover:text-text-primary text-typ-label font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-sm"
                >
                  {copied ? <Check size={14} className="text-wealth-emerald" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Export'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* --- MODAL 3: How to Deploy Direct Guide --- */}
        {showDeployGuide && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-surface-layer1 border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                <div className="flex items-center gap-2 text-primary-accent">
                  <Compass size={18} />
                  <h3 className="text-typ-body-sm font-semibold text-text-primary">Deploy Zero-Commission Direct</h3>
                </div>
                <button onClick={() => setShowDeployGuide(false)} className="text-text-muted hover:text-text-primary">
                  <X size={18} />
                </button>
              </div>

              <p className="text-typ-label text-text-secondary leading-relaxed">
                To maximize returns and save up to <strong>1.5% annually</strong> on distributor commissions, always invest in <strong>Direct Growth</strong> plans:
              </p>

              <div className="space-y-2 text-typ-label">
                <div className="p-2.5 rounded-xl bg-surface-layer2/50 border border-white/[0.06] space-y-1">
                  <div className="font-semibold text-text-primary flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald"></span>
                    <span>1. MF Central / CAMS / KFintech</span>
                  </div>
                  <p className="text-typ-footnote text-text-muted">
                    Official unified portals for 100% direct mutual fund investments with zero intermediary commissions.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-surface-layer2/50 border border-white/[0.06] space-y-1">
                  <div className="font-semibold text-text-primary flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-accent"></span>
                    <span>2. Direct Brokers (Zerodha / Groww / AngelOne)</span>
                  </div>
                  <p className="text-typ-footnote text-text-muted">
                    Use your demat account to purchase SGB secondary market tranches (discount to spot) and Index ETFs with near-zero tracking error.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowDeployGuide(false)}
                  className="w-full py-2.5 rounded-xl bg-primary-accent text-white font-semibold text-typ-label hover:bg-primary-accent/90 transition-all shadow-md shadow-primary-accent/20"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL 1: Target Profile & Gemini Key Customizer --- */}
        {showCustomizer && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-surface-layer1 border border-white/[0.1] rounded-2xl p-4 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5">
                <h3 className="text-typ-body-sm font-semibold text-text-primary">Customize Target Benchmark</h3>
                <button onClick={() => setShowCustomizer(false)} className="text-text-muted hover:text-text-primary">
                  <X size={18} />
                </button>
              </div>

              {/* Profile Presets */}
              <div className="space-y-1.5">
                <label className="text-typ-footnote font-semibold text-text-secondary">Benchmark Profile</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.keys(RISK_PROFILES).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setTempProfile(k);
                        setTempTargets({ ...RISK_PROFILES[k].target });
                      }}
                      className={`p-2.5 rounded-xl text-left border text-typ-label transition-all ${
                        tempProfile === k 
                          ? 'border-primary-accent/60 bg-primary-accent/15 text-primary-accent font-semibold shadow-sm' 
                          : 'border-white/[0.06] bg-surface-layer2/60 hover:border-white/[0.12] text-text-secondary'
                      }`}
                    >
                      <div className="font-medium">{k}</div>
                      <div className="text-typ-micro text-text-muted mt-0.5 truncate">{RISK_PROFILES[k].name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders for each Category */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-typ-footnote font-semibold text-text-secondary">
                  <span>Category Targets (%)</span>
                  <span className={`font-mono ${Object.values(tempTargets).reduce((a, b) => a + (Number(b) || 0), 0) === 100 ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
                    Total: {Object.values(tempTargets).reduce((a, b) => a + (Number(b) || 0), 0)}%
                  </span>
                </div>

                {CORE_CATEGORIES.map(cat => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-typ-label">
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

              {/* Inline Feedback Message */}
              {customizerFeedback && (
                <div className={`p-2 rounded-lg text-typ-label font-medium flex items-center gap-1.5 ${
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
                  className="flex-1 py-2.5 rounded-xl bg-surface-layer2/80 hover:bg-surface-layer2 border border-white/[0.06] text-text-secondary font-semibold text-typ-label hover:text-text-primary transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomizer}
                  disabled={isSavingSettings}
                  className="flex-1 py-2 rounded-xl bg-primary-accent text-white font-semibold text-typ-label hover:bg-primary-accent/90 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-primary-accent/20"
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
            <div className="w-full max-w-sm bg-surface-layer1 border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-wealth-emerald">
                <CheckCircle2 size={20} />
                <h3 className="text-typ-body-sm font-semibold text-text-primary">Execution Blueprint Ready</h3>
              </div>

              <p className="text-typ-label text-text-secondary leading-relaxed">
                To execute this rebalance with ₹{Number(inflowAmount).toLocaleString('en-IN')}, deploy your fresh savings into the following instruments:
              </p>

              <div className="space-y-1.5 bg-surface-layer2/40 p-3 rounded-xl border border-white/[0.06] text-typ-label">
                {simulation.projectedBreakdown.filter(b => b.allocatedRupees > 0).map(b => (
                  <div key={b.category} className="flex justify-between py-1 border-b border-white/[0.05] last:border-0">
                    <span className="text-text-secondary font-medium">{b.category}</span>
                    <span className="font-bold text-wealth-emerald tabular-nums">+{formatCurrency(b.allocatedRupees)}</span>
                  </div>
                ))}
              </div>

              <p className="text-typ-caption text-text-muted">
                Tip: Once you complete your investments in your broker or bank, simply add them under the <strong>Assets</strong> tab to watch your portfolio alignment score reach <strong>{simulation.projectedAlignmentScore}/100</strong>!
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-primary-accent text-white font-semibold text-typ-label hover:bg-primary-accent/90 transition-all shadow-md shadow-primary-accent/20"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unified Gemini API Key Modal */}
        <GeminiApiKeyModal
          isOpen={showApiKeyModal}
          onClose={() => setShowApiKeyModal(false)}
          settings={settings}
          onRefresh={onRefresh}
          showMessage={showMessage}
        />

      </main>
    </div>
  );
}
