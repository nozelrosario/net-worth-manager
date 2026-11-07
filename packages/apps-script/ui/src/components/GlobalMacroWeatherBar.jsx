import React, { useState, useMemo } from 'react';
import { 
  Sun, CloudSun, CloudRain, Zap, ChevronDown, ChevronUp, Globe, 
  TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Activity, Info
} from 'lucide-react';
import { calculateMacroRegime, extractMacroQuotes, MACRO_REGIMES } from '../utils/macroMath';
import { Badge } from './Badge';

export default function GlobalMacroWeatherBar({ 
  marketQuotes = [], 
  className = '',
  defaultExpanded = false 
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const macroData = useMemo(() => {
    return extractMacroQuotes(marketQuotes);
  }, [marketQuotes]);

  const regimeData = useMemo(() => {
    return calculateMacroRegime(macroData);
  }, [macroData]);

  const { score, regime, summary, tacticalGuidance, colorClass, badgeVariant, indicators } = regimeData;

  const renderWeatherIcon = (reg, className = 'w-5 h-5') => {
    switch (reg) {
      case MACRO_REGIMES.RISK_ON:
        return <Sun className={`${className} text-emerald-400`} />;
      case MACRO_REGIMES.NEUTRAL:
        return <CloudSun className={`${className} text-sky-400`} />;
      case MACRO_REGIMES.RISK_OFF:
        return <CloudRain className={`${className} text-amber-400`} />;
      case MACRO_REGIMES.PANIC:
        return <Zap className={`${className} text-rose-400`} />;
      default:
        return <Sun className={`${className} text-emerald-400`} />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'safe':
        return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>;
      case 'caution':
        return <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>;
      case 'alert':
        return <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>;
      default:
        return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>;
    }
  };

  return (
    <div className={`rounded-xl border border-border-subtle bg-surface-layer1 shadow-md overflow-hidden ${className}`}>
      {/* Collapsible Accordion Header */}
      <div 
        onClick={() => setIsExpanded(prev => !prev)}
        className="cursor-pointer p-3.5 flex items-center justify-between hover:bg-surface-layer2/60 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-layer2 border border-border-prominent flex items-center justify-center relative">
            {renderWeatherIcon(regime, 'w-5 h-5')}
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                regime === MACRO_REGIMES.RISK_ON ? 'bg-emerald-400' :
                regime === MACRO_REGIMES.NEUTRAL ? 'bg-sky-400' :
                regime === MACRO_REGIMES.RISK_OFF ? 'bg-amber-400' : 'bg-rose-500'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                regime === MACRO_REGIMES.RISK_ON ? 'bg-emerald-400' :
                regime === MACRO_REGIMES.NEUTRAL ? 'bg-sky-400' :
                regime === MACRO_REGIMES.RISK_OFF ? 'bg-amber-400' : 'bg-rose-500'
              }`}></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider text-text-muted uppercase">Macro Weather</span>
              <Badge variant={badgeVariant} size="sm">
                {regime}
              </Badge>
            </div>
            <p className="text-typ-footnote text-text-secondary mt-0.5 line-clamp-1">
              {summary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Progress Ring Badge */}
          <div className="flex items-center gap-1.5 bg-surface-layer2 border border-border-subtle px-2 py-1 rounded-md">
            <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 36 36">
              <path 
                className="text-border-subtle" 
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="4" 
              />
              <path 
                className={colorClass} 
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                fill="none" 
                stroke="currentColor" 
                strokeDasharray={`${score}, 100`} 
                strokeLinecap="round" 
                strokeWidth="4" 
              />
            </svg>
            <span className="text-typ-caption font-bold text-text-primary tabular-nums">
              {score}/100
            </span>
          </div>

          <div className="text-text-muted">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Expanded Macro Regime Cockpit */}
      {isExpanded && (
        <div className="border-t border-border-subtle/80 bg-surface-layer1/80">
          <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-primary-accent to-amber-500"></div>

          {/* Subheader */}
          <div className="p-3.5 pb-2.5 border-b border-border-subtle/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary-accent" />
              <div>
                <h3 className="text-typ-body font-bold text-text-primary">
                  Global Macro Cockpit (Screen 22)
                </h3>
                <p className="text-[11px] text-text-muted">
                  Institutional indicators streamed via native Google Finance formulas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-layer2 border border-border-prominent">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Live Sync</span>
            </div>
          </div>

          {/* 6-Indicator Quantitative Weather Grid (2x3) */}
          <div className="p-3.5 grid grid-cols-2 gap-2.5">
            {/* Tile 1: US 10Y Yield */}
            <div className="bg-surface-layer2/90 rounded-lg p-2.5 border border-border-subtle flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[11px] font-medium">US 10Y Yield</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-surface-layer1 border border-border-subtle font-mono">TNX</span>
              </div>
              <div className="my-1">
                <div className="text-typ-title font-bold tabular-nums text-text-primary">
                  {indicators.tnx.value}
                </div>
                <div className="text-[10px] text-text-secondary truncate mt-0.5">
                  {indicators.tnx.label}
                </div>
              </div>
              <div className="text-[9px] text-text-muted border-t border-border-subtle/40 pt-1 flex items-center justify-between">
                <span>Safe: &lt;4.50%</span>
                {getStatusBadge(indicators.tnx.status)}
              </div>
            </div>

            {/* Tile 2: USD / INR */}
            <div className="bg-surface-layer2/90 rounded-lg p-2.5 border border-border-subtle flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[11px] font-medium">USD / INR</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-surface-layer1 border border-border-subtle font-mono">FX</span>
              </div>
              <div className="my-1">
                <div className="text-typ-title font-bold tabular-nums text-text-primary">
                  {indicators.usdinr.value}
                </div>
                <div className="text-[10px] text-text-secondary truncate mt-0.5">
                  {indicators.usdinr.label}
                </div>
              </div>
              <div className="text-[9px] text-text-muted border-t border-border-subtle/40 pt-1 flex items-center justify-between">
                <span>Safe: &lt;₹84.50</span>
                {getStatusBadge(indicators.usdinr.status)}
              </div>
            </div>

            {/* Tile 3: Brent Crude */}
            <div className="bg-surface-layer2/90 rounded-lg p-2.5 border border-border-subtle flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[11px] font-medium">Brent Crude</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-surface-layer1 border border-border-subtle font-mono">OIL</span>
              </div>
              <div className="my-1">
                <div className="text-typ-title font-bold tabular-nums text-text-primary">
                  {indicators.brent.value}
                </div>
                <div className="text-[10px] text-text-secondary truncate mt-0.5">
                  {indicators.brent.label}
                </div>
              </div>
              <div className="text-[9px] text-text-muted border-t border-border-subtle/40 pt-1 flex items-center justify-between">
                <span>Safe: &lt;$90/bbl</span>
                {getStatusBadge(indicators.brent.status)}
              </div>
            </div>

            {/* Tile 4: India VIX */}
            <div className="bg-surface-layer2/90 rounded-lg p-2.5 border border-border-subtle flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[11px] font-medium">India VIX</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-surface-layer1 border border-border-subtle font-mono">VIX</span>
              </div>
              <div className="my-1">
                <div className="text-typ-title font-bold tabular-nums text-text-primary">
                  {indicators.vix.value}
                </div>
                <div className="text-[10px] text-text-secondary truncate mt-0.5">
                  {indicators.vix.label}
                </div>
              </div>
              <div className="text-[9px] text-text-muted border-t border-border-subtle/40 pt-1 flex items-center justify-between">
                <span>Dip Buy: &gt;22</span>
                {getStatusBadge(indicators.vix.status)}
              </div>
            </div>

            {/* Tile 5: Gold / Silver Ratio */}
            <div className="bg-surface-layer2/90 rounded-lg p-2.5 border border-border-subtle flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[11px] font-medium">Gold / Silver</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-surface-layer1 border border-border-subtle font-mono">XAU/XAG</span>
              </div>
              <div className="my-1">
                <div className="text-typ-title font-bold tabular-nums text-text-primary">
                  {indicators.goldSilverRatio.value}
                </div>
                <div className="text-[10px] text-text-secondary truncate mt-0.5">
                  {indicators.goldSilverRatio.label}
                </div>
              </div>
              <div className="text-[9px] text-text-muted border-t border-border-subtle/40 pt-1 flex items-center justify-between">
                <span>Defense: &gt;85</span>
                {getStatusBadge(indicators.goldSilverRatio.status)}
              </div>
            </div>

            {/* Tile 6: Nifty 200 EMA */}
            <div className="bg-surface-layer2/90 rounded-lg p-2.5 border border-border-subtle flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[11px] font-medium">Nifty Trend</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-surface-layer1 border border-border-subtle font-mono">200 EMA</span>
              </div>
              <div className="my-1">
                <div className="text-typ-title font-bold tabular-nums text-text-primary">
                  {indicators.niftyTrend.value}
                </div>
                <div className="text-[10px] text-text-secondary truncate mt-0.5">
                  {indicators.niftyTrend.label}
                </div>
              </div>
              <div className="text-[9px] text-text-muted border-t border-border-subtle/40 pt-1 flex items-center justify-between">
                <span>Filter: &gt;200 EMA</span>
                {getStatusBadge(indicators.niftyTrend.status)}
              </div>
            </div>
          </div>

          {/* Tactical Action Banner */}
          <div className="p-3.5 pt-0">
            <div className="bg-surface-layer2/80 rounded-lg p-3 border border-border-subtle flex items-start gap-2.5">
              <Activity className="w-4 h-4 text-primary-accent shrink-0 mt-0.5" />
              <div className="text-[11px] text-text-secondary leading-relaxed">
                <span className="font-semibold text-text-primary">Tactical Inflow Guidance: </span>
                {tacticalGuidance}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
