import React, { useMemo } from 'react';
import { Shield, Sparkles, TrendingUp, TrendingDown, ChevronRight, Sliders, ArrowUpRight, Landmark, HeartPulse } from 'lucide-react';
import { calculatePortfolioAlignment, RISK_PROFILES } from '../utils/portfolioMath';
import { Badge } from '../components/Badge';
import { calculateConsolidatedInsurance, formatInLakhsOrCrores } from '../utils/insuranceMath';

export default function HomeTab({ formatCurrency, data, onOpenRebalancer, onOpenRetirementPlanner, onOpenInsuranceHub }) {
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
  
  const equity = assets.filter(a => a.Category === 'Equity').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const mf = assets.filter(a => a.Category === 'Mutual Funds').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const property = assets.filter(a => a.Category === 'Real Estate').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const gold = assets.filter(a => a.Category === 'Gold').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const cash = assets.filter(a => a.Category === 'Cash/FD').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
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
  const totalExpense = txns.filter(t => t.Type === 'Expense').reduce((sum, t) => sum + Number(t.Amount || 0), 0);
  const totalIncome = txns.filter(t => t.Type === 'Income').reduce((sum, t) => sum + Number(t.Amount || 0), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Consolidated Hero */}
      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-accent/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        
        <div className="flex items-center justify-between mb-1 gap-2">
          <p className="text-[11px] font-bold text-text-muted tracking-wider uppercase">Consolidated Family Net Worth</p>
          {liveAssets.length > 0 && (
            <Badge variant="emerald" dot pulse size="sm">
              Live Rates Active
            </Badge>
          )}
        </div>
        
        <h2 className="text-4xl font-bold tabular-nums tracking-tight text-text-primary mb-2">{formatCurrency(totalNetWorth)}</h2>

        {/* Live Market Portfolio Return Ribbon */}
        {liveAssets.length > 0 && totalLiveCost > 0 && (
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className="text-text-muted">Market Portfolio Gain:</span>
            <span className={`font-semibold tabular-nums flex items-center gap-1 ${totalLivePnl >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
              {totalLivePnl >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {totalLivePnl >= 0 ? '+' : ''}{formatCurrency(totalLivePnl)} ({totalLivePnlPct >= 0 ? '+' : ''}{totalLivePnlPct.toFixed(1)}%)
            </span>
          </div>
        )}
        
        {/* Progress bar */}
        <div className="h-2 w-full bg-surface-layer2 rounded-full overflow-hidden flex mb-3">
          <div className="bg-primary-accent" style={{width: `${ePct}%`}} title={`Equity: ${ePct.toFixed(1)}%`}></div>
          <div className="bg-indigo-400" style={{width: `${mfPct}%`}} title={`Mutual Funds: ${mfPct.toFixed(1)}%`}></div>
          <div className="bg-teal-500" style={{width: `${pPct}%`}} title={`Property: ${pPct.toFixed(1)}%`}></div>
          <div className="bg-bullion-amber" style={{width: `${gPct}%`}} title={`Gold: ${gPct.toFixed(1)}%`}></div>
          <div className="bg-wealth-emerald" style={{width: `${cPct}%`}} title={`Cash/FD: ${cPct.toFixed(1)}%`}></div>
          {retPct > 0 && <div className="bg-sky-500" style={{width: `${retPct}%`}} title={`Retirement: ${retPct.toFixed(1)}%`}></div>}
          {oPct > 0 && <div className="bg-purple-500" style={{width: `${oPct}%`}} title={`Other: ${oPct.toFixed(1)}%`}></div>}
        </div>
        
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-accent"></span><span className="text-text-secondary">Equity: {formatCurrency(equity)}</span></div>
          {mf > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400"></span><span className="text-text-secondary">Mutual Funds: {formatCurrency(mf)}</span></div>}
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-bullion-amber"></span><span className="text-text-secondary">Gold: {formatCurrency(gold)}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-500"></span><span className="text-text-secondary">Property: {formatCurrency(property)}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-wealth-emerald"></span><span className="text-text-secondary">Cash/FD: {formatCurrency(cash)}</span></div>
          {retirement > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500"></span><span className="text-text-secondary">Retirement: {formatCurrency(retirement)}</span></div>}
          {liabilities > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-liability-rose"></span><span className="text-liability-rose">Liabilities: -{formatCurrency(liabilities)}</span></div>}
        </div>
      </div>

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
                  <h3 className="text-xs font-semibold text-text-primary group-hover:text-sky-400 transition-colors truncate">
                    Retirement &amp; Pension Hub
                  </h3>
                  <Badge variant="emerald" dot size="xs">
                    8.25% EPF / NPS
                  </Badge>
                </div>
                <p className="text-[10px] text-text-muted truncate">Running balance accrual, Age 60 forecaster &amp; tax perks</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 shrink-0">
              <span className="hidden sm:inline">View Hub</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary text-[11px]">Retirement Corpus:</span>
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
                  <h3 className="text-xs font-semibold text-text-primary group-hover:text-emerald-400 transition-colors truncate">
                    Insurance &amp; Protection Hub
                  </h3>
                  <Badge variant="emerald" dot size="xs">
                    {insuranceData.hlv.coverageRatio}% HLV Shielded
                  </Badge>
                </div>
                <p className="text-[10px] text-text-muted truncate">LIC endowment, term life, health floater &amp; premium tracker</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 shrink-0">
              <span className="hidden sm:inline">View Hub</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary text-[11px]">Total Life Cover:</span>
              <span className="font-bold text-emerald-400 tabular-nums">₹{formatInLakhsOrCrores(insuranceData.totalLifeCover)}</span>
              {insuranceData.totalHealthCover > 0 && (
                <>
                  <span className="text-text-muted text-[10px]">•</span>
                  <span className="text-text-secondary text-[11px]">Health:</span>
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
                  <h3 className="text-xs font-semibold text-text-primary group-hover:text-primary-accent transition-colors truncate">
                    AI Portfolio Advisor & Rebalance
                  </h3>
                  <Badge variant="emerald" dot size="xs">
                    Zero Tax
                  </Badge>
                </div>
                <p className="text-[10px] text-text-muted truncate">Smart fresh capital deployment & risk audit</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-primary-accent shrink-0">
              <span className="hidden sm:inline">Rebalance</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary text-[11px]">Alignment Score:</span>
              <span className="font-bold text-wealth-emerald tabular-nums">{alignment.alignmentScore}/100</span>
              <span className="text-[10px] text-text-muted">({alignment.healthLabel})</span>
            </div>

            {alignment.maxOverweight ? (
              <Badge variant="rose" dot size="xs">
                +{alignment.maxOverweight.drift.toFixed(1)}% {alignment.maxOverweight.name}
              </Badge>
            ) : (
              <Badge variant="emerald" dot size="xs">
                Balanced
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div 
          onClick={onOpenRebalancer}
          className={`bg-surface-layer1 border border-white/[0.08] rounded-xl p-4 shadow-sm ${onOpenRebalancer ? 'cursor-pointer hover:border-bullion-amber/30 transition-all active:scale-[0.98]' : ''}`}
        >
          <p className="text-xs text-text-secondary mb-1">Liquid Buffer & Drag</p>
          <p className="text-lg font-bold text-text-primary tabular-nums">{formatCurrency(cash)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">{totalExpense > 0 ? (cash / (totalExpense/12)).toFixed(1) : 0} Mos Runway</p>
          <div className="mt-3">
            <Badge variant="amber" dot size="xs">
              Check Cash Drag
            </Badge>
          </div>
        </div>
        <div className="bg-surface-layer1 border border-white/[0.08] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-text-secondary mb-1">This Month's Cashflow</p>
          <p className="text-lg font-bold text-liability-rose tabular-nums">-{formatCurrency(totalExpense)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Inflow: {formatCurrency(totalIncome)}</p>
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
