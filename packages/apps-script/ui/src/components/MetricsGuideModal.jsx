import React, { useState, useMemo } from 'react';
import { 
  X, Search, BookOpen, Sparkles, TrendingUp, Shield, 
  HelpCircle, ExternalLink, Lightbulb, CheckCircle2, 
  Layers, Compass, DollarSign, Activity, AlertCircle 
} from 'lucide-react';
import useModalBack from '../hooks/useModalBack';
import { Badge } from './Badge';

export const GUIDE_ITEMS = [
  // 1. Core Health & Drift
  {
    id: 'alignment-score',
    category: 'core',
    name: 'Portfolio Alignment Score',
    tag: '0% – 100% Health',
    tagVariant: 'indigo',
    keywords: 'alignment score similarity percentage drift health target',
    summary: 'Measures how closely your current asset allocation matches your intended target risk profile.',
    formula: 'Score = 100 - (0.5 × Sum of Absolute Category Drifts)',
    interpretation: '90%–100%: Optimal allocation. 75%–89%: Moderate drift (ideal for fresh inflow rebalancing). <75%: High drift.',
    actionablePlaybook: 'Do not sell assets (which triggers capital gains tax and exit loads). Use the Inflow Simulator to route upcoming monthly SIPs and savings into underweighted buckets until your score reaches >90%.'
  },
  {
    id: 'category-drift',
    category: 'core',
    name: 'Category Drift (Δ%)',
    tag: 'Over / Underweight',
    tagVariant: 'amber',
    keywords: 'drift underweight overweight percentage delta rebalance shortfall',
    summary: 'The percentage point difference between what you actually hold in an asset class vs. your targeted risk plan.',
    formula: 'Drift = Current Asset % - Target Asset %',
    interpretation: 'Positive (+%): Overweight. Negative (-%): Underweight (defensively starved).',
    actionablePlaybook: 'Negative drift points out where your portfolio is under-allocated. Direct fresh savings toward negative drift categories to buy assets at relatively lower valuations.'
  },
  {
    id: 'cash-drag',
    category: 'core',
    name: 'Cash Drag (₹ and %)',
    tag: 'Opportunity Cost',
    tagVariant: 'rose',
    keywords: 'cash drag idle cash inflation penalty liquid interest yield',
    summary: 'The invisible annual wealth penalty caused by keeping excess idle cash sitting in low-yield savings accounts instead of inflation-beating assets.',
    formula: 'Cash Drag = (Excess Cash above 6M Buffer) × (Expected Portfolio Return - 3.0%)',
    interpretation: 'Holding ₹10 Lakhs idle beyond emergency needs creates an invisible drag of ₹70,000 to ₹90,000 every single year against inflation.',
    actionablePlaybook: 'Retain 6 to 12 months in an emergency liquid fund. Move remaining idle balances into Target Maturity Funds (TMFs) locking in ~7.4% sovereign yields or Arbitrage Funds.'
  },
  {
    id: 'emergency-runway',
    category: 'core',
    name: 'Emergency Runway (Months)',
    tag: 'Defense Buffer',
    tagVariant: 'emerald',
    keywords: 'emergency runway months liquid buffer survival living expenses',
    summary: 'The number of months your household can sustain current living expenses with zero income, relying strictly on immediate liquid cash and deposits.',
    formula: 'Runway = Liquid Bank & Cash Balances ÷ Average Monthly Spends',
    interpretation: 'Salaried: 6 to 9 Months. Self-employed / Business: 12 to 18 Months. Below 3 Months: High vulnerability.',
    actionablePlaybook: 'If your runway is below 6 months, pause discretionary equity lump sums until your liquid emergency buffer is restored.'
  },

  // 2. Global Macro Radar
  {
    id: 'macro-regime',
    category: 'macro',
    name: 'Composite Macro Regime Score',
    tag: '0 – 100 Gauge',
    tagVariant: 'sky',
    keywords: 'macro regime weather score risk on risk off stagflation gauge',
    summary: 'A multi-factor health score synthesizing global liquidity, interest rates, currency volatility, and domestic market momentum into 4 regimes.',
    formula: 'Synthesized from TNX, USD/INR, India VIX, Nifty 200 EMA, Silver/Gold & Brent Crude.',
    interpretation: 'Risk-On (70–100): Bullish equity expansion. Neutral (40–69): Steady-state. Risk-Off (<40): Stress/panic, prioritize safety. Stagflation Alert: High crude + rising yields.',
    actionablePlaybook: 'Check the Macro Weather Bar before deploying lump sums. In Risk-Off regimes, do not panic sell; direct new monthly tranches into defensive yields and gold.'
  },
  {
    id: 'us-10y-yield',
    category: 'macro',
    name: 'US 10Y Treasury Yield (TNX)',
    tag: 'Global Hurdle Rate',
    tagVariant: 'amber',
    keywords: 'us 10y tnx yield treasury bond fii outflow dollar hurdle',
    summary: 'The interest rate paid by the US Government on 10-year debt. It serves as the baseline hurdle rate for global financial institutions.',
    formula: 'Real-time ticker INDEXCBOE:TNX streaming via Google Finance.',
    interpretation: 'When US yields rise above 4.30%–4.50%, foreign institutional investors (FIIs) pull capital from emerging markets (India) to earn guaranteed dollar yields.',
    actionablePlaybook: 'Surging US yields create foreign selling pressure on Indian large-caps. Use these temporary FII pullbacks to buy high-quality index funds at attractive valuations.'
  },
  {
    id: 'usd-inr',
    category: 'macro',
    name: 'USD / INR Exchange Rate',
    tag: 'Currency Health',
    tagVariant: 'rose',
    keywords: 'usdinr exchange rate dollar currency depreciation rupee hedge',
    summary: 'Measures how many Rupees are required to buy 1 US Dollar. The INR has depreciated at ~3.2% to 3.5% annually over the last 30 years.',
    formula: 'Real-time ticker CURRENCY:USDINR.',
    interpretation: 'A 100% India-denominated portfolio is exposed to currency depreciation. Holding Gold and International Feeder ETFs provides an automatic dollar hedge.',
    actionablePlaybook: 'Allocate 10%–15% of your net worth to Gold (SGBs) and US equity feeder ETFs to capture international currency alpha automatically.'
  },
  {
    id: 'india-vix',
    category: 'macro',
    name: 'India VIX (Volatility Index)',
    tag: 'Fear Gauge',
    tagVariant: 'indigo',
    keywords: 'india vix volatility index fear gauge panic crash dip',
    summary: 'Measures expected 30-day volatility in the Nifty 50 options market. Known globally as the stock market fear gauge.',
    formula: 'Real-time ticker INDEXNSE:INDIAVIX.',
    interpretation: 'VIX < 13: Complacency. VIX 13–18: Normal market range. VIX > 22: Extreme fear & panic.',
    actionablePlaybook: 'Spikes in VIX (>20) historically mark the most profitable long-term SIP buying windows. Never stop investments when VIX is high.'
  },
  {
    id: 'nifty-200-ema',
    category: 'macro',
    name: 'Nifty 50 vs. 200 EMA',
    tag: 'Trend Filter',
    tagVariant: 'emerald',
    keywords: '200 ema nifty moving average trend dual momentum bull bear',
    summary: 'The 200-day Exponential Moving Average is the institutional benchmark separating structural bull markets from bear markets.',
    formula: 'INDEXNSE:NIFTY_50 compared against its 200-Day Exponential Moving Average.',
    interpretation: 'CMP > 200 EMA: Structural Bull (Full 1.25x tactical multiplier). CMP < 200 EMA: Structural Bear (Defensive 0.50x caution multiplier).',
    actionablePlaybook: 'When Nifty breaks below its 200 EMA, Net Worth Manager slows down fresh equity deployment, parking safety tranches in arbitrage/liquid funds.'
  },

  // 3. Quant HRP & CVaR Stress
  {
    id: 'hrp-weights',
    category: 'quant',
    name: 'ML Hierarchical Risk Parity (HRP)',
    tag: 'Optimal Diversification',
    tagVariant: 'indigo',
    keywords: 'hrp hierarchical risk parity lopez de prado machine learning clustering',
    summary: 'A machine-learning risk allocation model that groups correlated Indian assets without the dangerous matrix inversion errors of traditional Markowitz models.',
    formula: 'Tree clustering via distance metric d = sqrt((1-rho)/2) + quasi-diagonalization + recursive bisection.',
    interpretation: 'Unlike classical models that over-concentrate in low-volatility debt, HRP creates genuine multi-asset risk parity tailored for Indian market cycles.',
    actionablePlaybook: 'Switch to the ML-HRP preset in the Rebalancer to see the mathematically optimal risk parity target for your asset holdings.'
  },
  {
    id: 'cvar-stress',
    category: 'quant',
    name: 'CVaR 95% (Expected Shortfall)',
    tag: 'Tail Risk Stress Test',
    tagVariant: 'rose',
    keywords: 'cvar conditional value at risk expected shortfall tail risk black swan drawdown',
    summary: 'Quantifies the average loss your portfolio would suffer in the worst 5% of monthly market shocks (e.g. 2008 Lehman collapse or March 2020 COVID shock).',
    formula: 'CVaR_0.95 = Expected loss given loss exceeds VaR_0.95.',
    interpretation: 'Nifty 50 Pure Equity: ~ -18.4% monthly worst case. Balanced User Portfolio: ~ -8.5% to -11.5%. All-Weather: ~ -5.8%.',
    actionablePlaybook: 'Review the Rupee drawdown figure (e.g. ≈ ₹3.8L). If this exceeds your emotional tolerance, increase your allocation to Sovereign TMFs and Gold.'
  },
  {
    id: 'diversification-ratio',
    category: 'quant',
    name: 'Diversification Ratio (DR)',
    tag: 'Risk Multiplier',
    tagVariant: 'emerald',
    keywords: 'diversification ratio dr correlation buffer choueifaty',
    summary: 'Measures how effectively non-correlated assets (Gold, Sovereign Debt, Real Estate) cancel out the downside volatility of your stocks.',
    formula: 'DR = Weighted Sum of Individual Volatilities ÷ Total Portfolio Volatility.',
    interpretation: 'DR = 1.0x: Zero diversification (100% single asset). DR > 1.4x: Institutional-level risk mitigation.',
    actionablePlaybook: 'Aim for a DR above 1.4x. Every 0.1x boost reduces emotional anxiety during market crashes without sacrificing long-term returns.'
  },

  // 4. Modern Instruments & Yield
  {
    id: 'target-maturity-funds',
    category: 'instruments',
    name: 'Target Maturity Funds (TMFs)',
    tag: 'FD Replacement',
    tagVariant: 'emerald',
    keywords: 'target maturity funds tmf bharat bond g-sec fixed deposit fd ytm',
    summary: 'Passive index debt funds holding Central G-Secs or AAA PSU bonds that mature in a defined target year (e.g., 2028, 2030, 2032).',
    formula: 'Yield to Maturity (YTM) locked through roll-down duration.',
    interpretation: 'Zero credit default risk (sovereign backed), locked peak multi-year yields (7.25%–7.50%), and zero interest-rate risk at maturity.',
    actionablePlaybook: 'Match your planned liabilities (e.g., child college fee in 2030) with an equivalent TMF maturity year to eliminate reinvestment risk completely.'
  },
  {
    id: 'reits-invits',
    category: 'instruments',
    name: 'REITs & InvITs',
    tag: 'Fractional Real Estate',
    tagVariant: 'sky',
    keywords: 'reits invits real estate commercial nexus embassy brookfield distribution yield ltv',
    summary: 'SEBI-regulated trusts owning portfolios of commercial Grade-A office parks, shopping malls (Nexus Select), or power grids (PowerGrid InvIT).',
    formula: 'Yield = Annual Cash Distributions ÷ Market Price per Unit.',
    interpretation: 'Generates 6.8% to 8.2% cash distribution yields paid quarterly, with portions partially tax-exempt under Section 10(23FD).',
    actionablePlaybook: 'Replace illiquid, tenant-hassle physical real estate with liquid, publicly traded REIT units offering immediate commercial diversification.'
  },
  {
    id: 'sgb-arbitrage',
    category: 'instruments',
    name: 'SGB Secondary Market Arbitrage',
    tag: 'Guaranteed Alpha',
    tagVariant: 'amber',
    keywords: 'sgb sovereign gold bonds secondary market discount rbi tax free coupon',
    summary: 'Sovereign Gold Bonds traded on NSE/BSE by retail holders seeking early cash liquidity before their 8-year maturity.',
    formula: 'Discount = (Spot Gold Price - Traded SGB Price) ÷ Spot Gold Price.',
    interpretation: 'Available at a 2.0% to 4.5% discount to spot gold, with zero GST, 2.50% annual coupon, and 100% tax-free capital gains at maturity.',
    actionablePlaybook: 'Never buy physical jewelry or digital gold for financial investment. Buy secondary market SGB series maturing in 2029–2032 directly in your demat account.'
  },
  {
    id: 'factor-etfs',
    category: 'instruments',
    name: 'Factor / Smart Beta ETFs',
    tag: 'Rule-Based Alpha',
    tagVariant: 'indigo',
    keywords: 'factor etfs smart beta momentum low vol alpha ter fees expense',
    summary: 'Systematic ETFs selecting stocks based on proven quantitative factors (Momentum, Quality, Low Volatility) with ultra-low expense ratios.',
    formula: 'Nifty 200 Momentum 30 (MOM30IETFS), Alpha Low Volatility 30 (ALPV30IETFS).',
    interpretation: 'Delivers historical 16%–21% CAGR with 0.20%–0.30% TER vs. 1.50%–2.00% charged by active mutual fund managers.',
    actionablePlaybook: 'Allocate a portion of your satellite equity portfolio to factor ETFs to capture systematic factor premiums without active manager bias.'
  },

  // 5. Retirement & Protection
  {
    id: 'epf-ppf',
    category: 'protection',
    name: 'EPF & PPF Compounding (EEE)',
    tag: 'Sovereign Debt',
    tagVariant: 'emerald',
    keywords: 'epf ppf provident fund retirement eee compounding sovereign',
    summary: 'Statutory government retirement engines enjoying full Exempt-Exempt-Exempt (EEE) status.',
    formula: 'EPF: 8.25% p.a. | PPF: 7.10% p.a. sovereign guaranteed compounding.',
    interpretation: 'Provides the risk-free debt bedrock of your overall portfolio, giving you the security needed to hold volatile growth equities.',
    actionablePlaybook: 'Treat your EPF and PPF balances as your core debt foundation rather than separate isolated accounts.'
  },
  {
    id: 'term-hlv',
    category: 'protection',
    name: 'Human Life Value (HLV) & Term Cover',
    tag: 'Income Protection',
    tagVariant: 'rose',
    keywords: 'human life value hlv term insurance life cover protection nominee',
    summary: 'The economic present value of future earnings that your family depends upon in the event of an untimely demise.',
    formula: 'Required Term Cover = (10x to 15x Annual Income) + Outstanding Liabilities - Liquid Assets.',
    interpretation: 'Ensures that your family can maintain their current standard of living and achieve all life goals even in your absence.',
    actionablePlaybook: 'Avoid traditional endowment and money-back policies. Purchase pure term insurance up to age 60–65 and invest the premium savings into index equities.'
  }
];

export default function MetricsGuideModal({ isOpen, onClose }) {
  useModalBack(isOpen, onClose);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return GUIDE_ITEMS.filter(item => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q) ||
        item.interpretation.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex items-start justify-between gap-3 bg-gradient-to-r from-primary-accent/15 via-transparent to-emerald-500/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-accent/20 border border-primary-accent/30 flex items-center justify-center text-primary-accent shrink-0 mt-0.5">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-typ-subtitle font-bold text-text-primary">
                  Portfolio Metrics &amp; Quant Guide
                </h3>
                <Badge variant="indigo" size="xs">Plain English</Badge>
              </div>
              <p className="text-typ-caption text-text-muted mt-0.5">
                Understand every stat, formula, stress test, and how to use them to grow wealth.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-layer2 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Category Pills */}
        <div className="p-3 sm:p-4 border-b border-border-subtle space-y-3 bg-surface-layer2/50">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search stats, terms, formulas (e.g. CVaR, Drift, TNX, TMF)..."
              className="w-full bg-surface-layer1 border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-typ-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-accent/70"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Terms' },
              { id: 'core', label: '1. Health & Drift' },
              { id: 'macro', label: '2. Macro Radar' },
              { id: 'quant', label: '3. ML HRP & CVaR' },
              { id: 'instruments', label: '4. Modern Assets' },
              { id: 'protection', label: '5. Protection' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-typ-footnote font-semibold transition-all ${
                  activeCategory === tab.id
                    ? 'bg-primary-accent text-white shadow-xs'
                    : 'bg-surface-layer1 text-text-secondary hover:text-text-primary hover:bg-surface-layer2 border border-border-subtle'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <HelpCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-typ-body font-semibold">No metrics matched "{searchQuery}"</p>
              <p className="text-typ-caption mt-1">Try searching for "CVaR", "Drift", "Yield", or "SGB".</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div 
                key={item.id} 
                className="p-4 rounded-xl bg-surface-layer2/80 border border-border-subtle flex flex-col gap-3 hover:border-white/[0.14] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-typ-body font-bold text-text-primary flex items-center gap-2">
                      {item.name}
                    </h4>
                    <p className="text-typ-caption text-text-secondary mt-1 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                  <Badge variant={item.tagVariant} size="xs" className="shrink-0">
                    {item.tag}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-typ-caption bg-surface-layer1/80 p-2.5 rounded-lg border border-white/[0.04]">
                  <div>
                    <span className="text-text-muted font-semibold uppercase text-[10px] tracking-wider block">Formula / Basis</span>
                    <span className="font-mono text-[11px] text-text-primary break-all">{item.formula}</span>
                  </div>
                  <div className="pt-1 border-t border-border-subtle/40">
                    <span className="text-text-muted font-semibold uppercase text-[10px] tracking-wider block">Benchmark Interpretation</span>
                    <span className="text-text-secondary">{item.interpretation}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2">
                  <Lightbulb size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-typ-caption">
                    <strong className="text-emerald-400 block mb-0.5">How to Take Action</strong>
                    <span className="text-text-secondary leading-snug">{item.actionablePlaybook}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Note */}
        <div className="p-3 border-t border-border-subtle bg-surface-layer2/50 flex items-center justify-between text-typ-caption text-text-muted">
          <span>Net Worth Manager Institutional Handbook v2.0</span>
          <span className="text-primary-accent font-medium">Zero-Sale Rebalancing</span>
        </div>
      </div>
    </div>
  );
}
