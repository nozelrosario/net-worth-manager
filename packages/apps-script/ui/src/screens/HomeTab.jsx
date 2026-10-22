import React from 'react';
import { Shield, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

export default function HomeTab({ formatCurrency, data }) {
  const assets = data?.assets || [];
  
  const equity = assets.filter(a => a.Category === 'Equity').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const mf = assets.filter(a => a.Category === 'Mutual Funds').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const property = assets.filter(a => a.Category === 'Real Estate').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const gold = assets.filter(a => a.Category === 'Gold').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const cash = assets.filter(a => a.Category === 'Cash/FD').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const liabilities = assets.filter(a => a.Category === 'Liabilities').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const otherAssets = assets.filter(a => !['Equity', 'Mutual Funds', 'Real Estate', 'Gold', 'Cash/FD', 'Liabilities'].includes(a.Category)).reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  
  const totalGrossAssets = equity + mf + property + gold + cash + otherAssets;
  const totalNetWorth = totalGrossAssets - liabilities;

  const totalForBar = totalGrossAssets || 1;
  const ePct = (equity / totalForBar) * 100;
  const mfPct = (mf / totalForBar) * 100;
  const pPct = (property / totalForBar) * 100;
  const gPct = (gold / totalForBar) * 100;
  const cPct = (cash / totalForBar) * 100;
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
        
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-bold text-text-muted tracking-wider uppercase">Consolidated Family Net Worth</p>
          {liveAssets.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] text-wealth-emerald bg-wealth-emerald/10 border border-wealth-emerald/20 px-2 py-0.5 rounded-full font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald animate-pulse"></span>
              Live Rates Active
            </span>
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
          {oPct > 0 && <div className="bg-purple-500" style={{width: `${oPct}%`}} title={`Other: ${oPct.toFixed(1)}%`}></div>}
        </div>
        
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-accent"></span><span className="text-text-secondary">Equity: {formatCurrency(equity)}</span></div>
          {mf > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400"></span><span className="text-text-secondary">Mutual Funds: {formatCurrency(mf)}</span></div>}
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-bullion-amber"></span><span className="text-text-secondary">Gold: {formatCurrency(gold)}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-500"></span><span className="text-text-secondary">Property: {formatCurrency(property)}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-wealth-emerald"></span><span className="text-text-secondary">Cash/FD: {formatCurrency(cash)}</span></div>
          {liabilities > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-liability-rose"></span><span className="text-liability-rose">Liabilities: -{formatCurrency(liabilities)}</span></div>}
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 shadow-sm">
          <p className="text-xs text-text-secondary mb-1">Liquid Buffer & Drag</p>
          <p className="text-lg font-bold text-text-primary tabular-nums">{formatCurrency(cash)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">{totalExpense > 0 ? (cash / (totalExpense/12)).toFixed(1) : 0} Mos Runway</p>
          <div className="mt-3 inline-flex items-center text-[10px] bg-bullion-amber/10 text-bullion-amber font-medium px-2 py-1 rounded-md border border-bullion-amber/25">⚠️ Check Cash Drag</div>
        </div>
        <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 shadow-sm">
          <p className="text-xs text-text-secondary mb-1">This Month's Cashflow</p>
          <p className="text-lg font-bold text-liability-rose tabular-nums">-{formatCurrency(totalExpense)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Inflow: {formatCurrency(totalIncome)}</p>
          <div className="mt-3 inline-flex items-center text-[10px] bg-surface-layer2 text-text-secondary font-medium px-2 py-1 rounded-md border border-border-subtle">{savingsRate.toFixed(1)}% Savings Rate</div>
        </div>
      </div>

    </div>
  );
}
