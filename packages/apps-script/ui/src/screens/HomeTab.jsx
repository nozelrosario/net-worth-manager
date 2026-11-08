import React, { useMemo } from 'react';
import { Shield, Sparkles, TrendingUp, TrendingDown, ChevronRight, Sliders, ArrowUpRight, Landmark, HeartPulse, HelpCircle } from 'lucide-react';
import { calculatePortfolioAlignment, calculateCashDrag, isCashCategory, RISK_PROFILES } from '../utils/portfolioMath';
import { Badge } from '../components/Badge';
import { calculateConsolidatedInsurance, formatInLakhsOrCrores } from '../utils/insuranceMath';
import GlobalMacroWeatherBar from '../components/GlobalMacroWeatherBar';
import { getSafeStorage } from '../utils/storage';

export default function HomeTab({ 
  formatCurrency, 
  data, 
  onOpenRebalancer, 
  onOpenRetirementPlanner, 
  onOpenInsuranceHub,
  onNavigateToCategory,
  onNavigateToAsset,
  onOpenGuide
}) {
  const assets = data?.assets || [];
  const settings = data?.settings || [];

  const targetMap = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'TargetAllocation');
    if (s?.['Setting Value']) {
      try {
        return JSON.parse(s['Setting Value']);
      } catch (e) {}
    }
    const profileName = settings.find(item => item['Setting Key'] === 'RiskProfile')?.['Setting Value'] || 'Moderate';
    return RISK_PROFILES[profileName]?.target || RISK_PROFILES.Moderate.target;
  }, [settings]);

  const alignment = useMemo(() => {
    return calculatePortfolioAlignment(assets, targetMap);
  }, [assets, targetMap]);

  const insuranceData = useMemo(() => {
    return calculateConsolidatedInsurance(assets);
  }, [assets]);

  const showMacroWeather = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'EnableMacroWeather');
    if (s && s['Setting Value'] !== undefined) {
      return s['Setting Value'] !== 'false';
    }
    return getSafeStorage('nwm_enable_macro_weather', 'true') !== 'false';
  }, [settings]);
  
  const equity = assets.filter(a => a.Category === 'Equity').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const mf = assets.filter(a => a.Category === 'Mutual Funds').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const property = assets.filter(a => a.Category === 'Real Estate').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const gold = assets.filter(a => a.Category === 'Gold').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const cash = assets.filter(a => isCashCategory(a.Category, a)).reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const retirement = assets.filter(a => 
    a.Category === 'Retirement & Pension' || 
    a.Category === 'Provident Funds' ||
    (a.Category || '').toLowerCase().includes('retire') ||
    (a.Category || '').toLowerCase().includes('provident') ||
    (a.Category || '').toLowerCase().includes('epf') ||
    (a.Category || '').toLowerCase().includes('ppf') ||
    (a.Category || '').toLowerCase().includes('nps')
  ).reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const liabilities = assets.filter(a => a.Category === 'Liabilities').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const otherAssets = assets.filter(a => 
    !['Equity', 'Mutual Funds', 'Real Estate', 'Gold', 'Cash/FD', 'Liabilities', 'Retirement & Pension', 'Provident Funds'].includes(a.Category) &&
    !(a.Category || '').toLowerCase().includes('retire') &&
    !(a.Category || '').toLowerCase().includes('provident') &&
    !(a.Category || '').toLowerCase().includes('epf') &&
    !(a.Category || '').toLowerCase().includes('ppf') &&
    !(a.Category || '').toLowerCase().includes('nps')
  ).reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  
  const totalGrossAssets = equity + mf + property + gold + cash + retirement + otherAssets;
  const totalNetWorth = totalGrossAssets - liabilities;

  const totalForBar = totalGrossAssets || 1;
  const ePct = (equity / totalForBar) * 100;
  const mfPct = (mf / totalForBar) * 100;
  const pPct = (property / totalForBar) * 100;
  const gPct = (gold / totalForBar) * 100;
  const cPct = (cash / totalForBar) * 100;
  const retPct = (retirement / totalForBar) * 100;
  const oPct = (otherAssets / totalForBar) * 100;

  // Live Market Portfolio Returns Calculation
  const liveAssets = assets.filter(a => a['Is Live'] || a['Live Price']);
  const totalLivePnl = liveAssets.reduce((sum, a) => sum + Number(a['P&L'] || 0), 0);
  const totalLiveCost = liveAssets.reduce((sum, a) => sum + Number(a['Cost'] || 0), 0);
  const totalLivePnlPct = totalLiveCost > 0 ? (totalLivePnl / totalLiveCost) * 100 : 0;

  const txns = data?.transactions || [];
  const cashDrag = useMemo(() => {
    return calculateCashDrag(assets, txns);
  }, [assets, txns]);

  const totalExpense = txns.filter(t => t.Type === 'Expense').reduce((sum, t) => sum + Number(t.Amount || 0), 0);
  const totalIncome = txns.filter(t => t.Type === 'Income').reduce((sum, t) => sum + Number(t.Amount || 0), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Consolidated Hero */}
      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-accent/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        
        <div className="flex items-center justify-between mb-1 gap-2">
          <p className="text-typ-footnote font-bold text-text-muted tracking-wider uppercase">Consolidated Family Net Worth</p>
          {liveAssets.length > 0 && (
            <Badge variant="emerald" dot pulse size="sm">
              Live Rates Active
            </Badge>
          )}
        </div>
        
        <h2 className="text-typ-display font-bold tabular-nums tracking-tight text-text-primary mb-2">{formatCurrency(totalNetWorth)}</h2>

        {/* Live Market Portfolio Return Ribbon */}
        {liveAssets.length > 0 && totalLiveCost > 0 && (
          <div 
            onClick={() => onNavigateToCategory && onNavigateToCategory('Equity')}
            className={`mb-3 flex items-center gap-2 text-typ-label ${onNavigateToCategory ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            title="View equity portfolio in Assets tab"
          >
            <span className="text-text-muted">Market Portfolio Gain:</span>
            <span className={`font-semibold tabular-nums flex items-center gap-1 ${totalLivePnl >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
              {totalLivePnl >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {totalLivePnl >= 0 ? '+' : ''}{formatCurrency(totalLivePnl)} ({totalLivePnlPct >= 0 ? '+' : ''}{totalLivePnlPct.toFixed(1)}%)
            </span>
          </div>
        )}
        
        {/* Progress bar with category cross-linking */}
        <div className="h-2 w-full bg-surface-layer2 rounded-full overflow-hidden flex mb-3">
          <div onClick={() => onNavigateToCategory && onNavigateToCategory('Equity')} className="bg-primary-accent hover:opacity-80 transition-opacity cursor-pointer" style={{width: `${ePct}%`}} title={`Equity: ${ePct.toFixed(1)}% (Click to view)`}></div>
          <div onClick={() => onNavigateToCategory && onNavigateToCategory('Mutual Funds')} className="bg-indigo-400 hover:opacity-80 transition-opacity cursor-pointer" style={{width: `${mfPct}%`}} title={`Mutual Funds: ${mfPct.toFixed(1)}% (Click to view)`}></div>
          <div onClick={() => onNavigateToCategory && onNavigateToCategory('Real Estate')} className="bg-teal-500 hover:opacity-80 transition-opacity cursor-pointer" style={{width: `${pPct}%`}} title={`Property: ${pPct.toFixed(1)}% (Click to view)`}></div>
          <div onClick={() => onNavigateToCategory && onNavigateToCategory('Gold')} className="bg-bullion-amber hover:opacity-80 transition-opacity cursor-pointer" style={{width: `${gPct}%`}} title={`Gold: ${gPct.toFixed(1)}% (Click to view)`}></div>
          <div onClick={() => onNavigateToCategory && onNavigateToCategory('Cash/FD')} className="bg-wealth-emerald hover:opacity-80 transition-opacity cursor-pointer" style={{width: `${cPct}%`}} title={`Cash/FD: ${cPct.toFixed(1)}% (Click to view)`}></div>
          {retPct > 0 && <div onClick={() => onNavigateToCategory && onNavigateToCategory('Retirement & Pension')} className="bg-sky-500 hover:opacity-80 transition-opacity cursor-pointer" style={{width: `${retPct}%`}} title={`Retirement: ${retPct.toFixed(1)}% (Click to view)`}></div>}
          {oPct > 0 && <div onClick={() => onNavigateToCategory && onNavigateToCategory('All Assets')} className="bg-purple-500 hover:opacity-80 transition-opacity cursor-pointer" style={{width: `${oPct}%`}} title={`Other: ${oPct.toFixed(1)}% (Click to view)`}></div>}
        </div>
        
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-typ-label">
          <button 
            type="button" 
            onClick={() => onNavigateToCategory && onNavigateToCategory('Equity')}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
            title="View Equity assets"
          >
            <span className="w-2 h-2 rounded-full bg-primary-accent group-hover:scale-125 transition-transform"></span>
            <span className="text-text-secondary group-hover:text-text-primary">Equity: {formatCurrency(equity)}</span>
          </button>
          {mf > 0 && (
            <button 
              type="button" 
              onClick={() => onNavigateToCategory && onNavigateToCategory('Mutual Funds')}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
              title="View Mutual Fund assets"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform"></span>
              <span className="text-text-secondary group-hover:text-text-primary">Mutual Funds: {formatCurrency(mf)}</span>
            </button>
          )}
          <button 
            type="button" 
            onClick={() => onNavigateToCategory && onNavigateToCategory('Gold')}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
            title="View Gold assets"
          >
            <span className="w-2 h-2 rounded-full bg-bullion-amber group-hover:scale-125 transition-transform"></span>
            <span className="text-text-secondary group-hover:text-text-primary">Gold: {formatCurrency(gold)}</span>
          </button>
          <button 
            type="button" 
            onClick={() => onNavigateToCategory && onNavigateToCategory('Real Estate')}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
            title="View Property assets"
          >
            <span className="w-2 h-2 rounded-full bg-teal-500 group-hover:scale-125 transition-transform"></span>
            <span className="text-text-secondary group-hover:text-text-primary">Property: {formatCurrency(property)}</span>
          </button>
          <button 
            type="button" 
            onClick={() => onNavigateToCategory && onNavigateToCategory('Cash/FD')}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
            title="View Cash/FD assets"
          >
            <span className="w-2 h-2 rounded-full bg-wealth-emerald group-hover:scale-125 transition-transform"></span>
            <span className="text-text-secondary group-hover:text-text-primary">Cash/FD: {formatCurrency(cash)}</span>
          </button>
          {retirement > 0 && (
            <button 
              type="button" 
              onClick={() => onNavigateToCategory && onNavigateToCategory('Retirement & Pension')}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
              title="View Retirement assets"
            >
              <span className="w-2 h-2 rounded-full bg-sky-500 group-hover:scale-125 transition-transform"></span>
              <span className="text-text-secondary group-hover:text-text-primary">Retirement: {formatCurrency(retirement)}</span>
            </button>
          )}
          {liabilities > 0 && (
            <button 
              type="button" 
              onClick={() => onNavigateToCategory && onNavigateToCategory('Liabilities')}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
              title="View Liabilities"
            >
              <span className="w-2 h-2 rounded-full bg-liability-rose group-hover:scale-125 transition-transform"></span>
              <span className="text-liability-rose">Liabilities: -{formatCurrency(liabilities)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Macro Weather Dashboard & Regime Panel (Screen 22) */}
      {showMacroWeather && (
        <GlobalMacroWeatherBar 
          marketQuotes={data?.marketQuotes || data?.marketQuotesMap} 
          defaultExpanded={false}
          onOpenGuide={onOpenGuide}
        />
      )}

      {/* Retirement & Pension Hub Banner */}
      {onOpenRetirementPlanner && (
        <div 
          onClick={onOpenRetirementPlanner}
          className="bg-surface-layer1 border border-border-subtle hover:border-sky-500/40 rounded-xl p-4 shadow-sm relative overflow-hidden cursor-pointer transition-all active:scale-[0.99] group"
        >
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400 border border-sky-500/25 shadow-sm shrink-0">
                <Landmark size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-typ-label font-semibold text-text-primary group-hover:text-sky-400 transition-colors truncate">
                    Retirement &amp; Pension Hub
                  </h3>
                  <Badge variant="emerald" dot size="xs">
                    8.25% EPF / NPS
                  </Badge>
                </div>
                <p className="text-typ-caption text-text-muted truncate">Running balance accrual, Age 60 forecaster &amp; tax perks</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-typ-footnote font-semibold text-sky-400 shrink-0">
              <span className="hidden sm:inline">View Hub</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-typ-label">
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary text-typ-footnote">Retirement Corpus:</span>
              <span className="font-bold text-sky-400 tabular-nums">{formatCurrency(retirement)}</span>
            </div>
            <Badge variant="emerald" dot size="xs">
              EEE Tax-Shielded
            </Badge>
          </div>
        </div>
      )}

      {/* Insurance & Protection Hub Banner */}
      {onOpenInsuranceHub && (
        <div 
          onClick={onOpenInsuranceHub}
          className="bg-surface-layer1 border border-border-subtle hover:border-emerald-500/40 rounded-xl p-4 shadow-sm relative overflow-hidden cursor-pointer transition-all active:scale-[0.99] group"
        >
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/25 shadow-sm shrink-0">
                <Shield size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-typ-label font-semibold text-text-primary group-hover:text-emerald-400 transition-colors truncate">
                    Insurance &amp; Protection Hub
                  </h3>
                  <Badge variant="emerald" dot size="xs">
                    {insuranceData.hlv.coverageRatio}% HLV Shielded
                  </Badge>
                </div>
                <p className="text-typ-caption text-text-muted truncate">LIC endowment, term life, health floater &amp; premium tracker</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-typ-footnote font-semibold text-emerald-400 shrink-0">
              <span className="hidden sm:inline">View Hub</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-typ-label">
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary text-typ-footnote">Total Life Cover:</span>
              <span className="font-bold text-emerald-400 tabular-nums">₹{formatInLakhsOrCrores(insuranceData.totalLifeCover)}</span>
              {insuranceData.totalHealthCover > 0 && (
                <>
                  <span className="text-text-muted text-typ-caption">•</span>
                  <span className="text-text-secondary text-typ-footnote">Health:</span>
                  <span className="font-bold text-cyan-400 tabular-nums">₹{formatInLakhsOrCrores(insuranceData.totalHealthCover)}</span>
                </>
              )}
            </div>
            <Badge variant="emerald" dot size="xs">
              Sec 80C &amp; 80D
            </Badge>
          </div>
        </div>
      )}

      {/* AI Portfolio Advisor & Rebalance Banner */}
      {onOpenRebalancer && (
        <div 
          onClick={onOpenRebalancer}
          className="bg-surface-layer1 border border-white/[0.08] hover:border-primary-accent/40 rounded-xl p-4 shadow-sm relative overflow-hidden cursor-pointer transition-all active:scale-[0.99] group"
        >
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary-accent/15 flex items-center justify-center text-primary-accent border border-primary-accent/25 shadow-sm shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-typ-label font-semibold text-text-primary group-hover:text-primary-accent transition-colors truncate">
                    AI Portfolio Advisor & Rebalance
                  </h3>
                  <Badge variant="emerald" dot size="xs">
                    Zero Tax
                  </Badge>
                </div>
                <p className="text-typ-caption text-text-muted truncate">Smart fresh capital deployment & risk audit</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-typ-footnote font-semibold text-primary-accent shrink-0">
              <span className="hidden sm:inline">Rebalance</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-typ-label">
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary text-typ-footnote">Alignment Score:</span>
              <span className="font-bold text-wealth-emerald tabular-nums">{alignment.alignmentScore}/100</span>
              <span className="text-typ-caption text-text-muted">({alignment.healthLabel})</span>
            </div>

            <div className="flex items-center gap-2">
              {alignment.maxOverweight ? (
                <Badge variant="rose" dot size="xs">
                  +{alignment.maxOverweight.drift.toFixed(1)}% {alignment.maxOverweight.name}
                </Badge>
              ) : (
                <Badge variant="emerald" dot size="xs">
                  Balanced
                </Badge>
              )}
              {onOpenGuide && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenGuide(); }}
                  className="text-text-muted hover:text-primary-accent p-0.5 rounded transition-colors"
                  title="What does Alignment Score mean?"
                >
                  <HelpCircle size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div 
          onClick={onOpenRebalancer}
          className={`bg-surface-layer1 border border-white/[0.08] rounded-xl p-4 shadow-sm ${onOpenRebalancer ? 'cursor-pointer hover:border-bullion-amber/30 transition-all active:scale-[0.98]' : ''}`}
        >
          <p className="text-typ-label text-text-secondary mb-1">Liquid Buffer & Drag</p>
          <p className="text-typ-subtitle font-bold text-text-primary tabular-nums">{formatCurrency(cashDrag.totalLiquidCash)}</p>
          <p className="text-typ-footnote text-text-muted mt-0.5">{cashDrag.runwayMonths} Mos Runway</p>
          <div className="mt-3">
            {cashDrag.excessCashDrag > 0 ? (
              <Badge variant="amber" dot size="xs">
                ⚠️ {formatCurrency(cashDrag.excessCashDrag)} Drag
              </Badge>
            ) : cashDrag.idleSavingsSurplus > 50000 ? (
              <Badge variant="amber" dot size="xs">
                ⚠️ Low Yield Drag
              </Badge>
            ) : cashDrag.runwayMonths < 3 && cashDrag.totalLiquidCash > 0 ? (
              <Badge variant="rose" dot size="xs">
                Low Buffer ({cashDrag.runwayMonths}m)
              </Badge>
            ) : cashDrag.totalLiquidCash === 0 ? (
              <Badge variant="neutral" size="xs">
                No Cash Logged
              </Badge>
            ) : (
              <Badge variant="emerald" dot size="xs">
                ✓ Buffer Healthy
              </Badge>
            )}
          </div>
        </div>
        <div className="bg-surface-layer1 border border-white/[0.08] rounded-xl p-4 shadow-sm">
          <p className="text-typ-label text-text-secondary mb-1">This Month's Cashflow</p>
          <p className="text-typ-subtitle font-bold text-liability-rose tabular-nums">-{formatCurrency(totalExpense)}</p>
          <p className="text-typ-footnote text-text-muted mt-0.5">Inflow: {formatCurrency(totalIncome)}</p>
          <div className="mt-3">
            <Badge variant="neutral" size="xs">
              {savingsRate.toFixed(1)}% Savings Rate
            </Badge>
          </div>
        </div>
      </div>

    </div>
  );
}
