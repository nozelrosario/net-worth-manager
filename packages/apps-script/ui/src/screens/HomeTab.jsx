import React from 'react';
import { Shield } from 'lucide-react';

export default function HomeTab({ formatCurrency, data }) {
  const assets = data?.assets || [];
  
  const totalNetWorth = assets.reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  
  const equity = assets.filter(a => a.Category === 'Equity').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const property = assets.filter(a => a.Category === 'Real Estate').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const gold = assets.filter(a => a.Category === 'Gold').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  const cash = assets.filter(a => a.Category === 'Cash/FD').reduce((sum, a) => sum + Number(a["Current Value"] || 0), 0);
  
  const ePct = totalNetWorth ? (equity / totalNetWorth) * 100 : 0;
  const pPct = totalNetWorth ? (property / totalNetWorth) * 100 : 0;
  const gPct = totalNetWorth ? (gold / totalNetWorth) * 100 : 0;
  const cPct = totalNetWorth ? (cash / totalNetWorth) * 100 : 0;

  const txns = data?.transactions || [];
  const totalExpense = txns.filter(t => t.Type === 'Expense').reduce((sum, t) => sum + Number(t.Amount || 0), 0);
  const totalIncome = txns.filter(t => t.Type === 'Income').reduce((sum, t) => sum + Number(t.Amount || 0), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Consolidated Hero */}
      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-accent/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <p className="text-[11px] font-bold text-text-muted tracking-wider uppercase mb-1">Consolidated Family Net Worth</p>
        <h2 className="text-4xl font-bold tabular-nums tracking-tight text-white mb-3">{formatCurrency(totalNetWorth)}</h2>
        
        {/* Progress bar */}
        <div className="h-2 w-full bg-surface-layer2 rounded-full overflow-hidden flex mb-3">
          <div className="bg-primary-accent" style={{width: `${ePct}%`}}></div>
          <div className="bg-teal-500" style={{width: `${pPct}%`}}></div>
          <div className="bg-bullion-amber" style={{width: `${gPct}%`}}></div>
          <div className="bg-wealth-emerald" style={{width: `${cPct}%`}}></div>
        </div>
        
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-accent"></span><span className="text-text-secondary">Equity: {formatCurrency(equity)}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-500"></span><span className="text-text-secondary">Property: {formatCurrency(property)}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-bullion-amber"></span><span className="text-text-secondary">Gold: {formatCurrency(gold)}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-wealth-emerald"></span><span className="text-text-secondary">Cash/FD: {formatCurrency(cash)}</span></div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
          <p className="text-xs text-text-secondary mb-1">Liquid Buffer & Drag</p>
          <p className="text-lg font-bold text-white tabular-nums">{formatCurrency(cash)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">{totalExpense > 0 ? (cash / (totalExpense/12)).toFixed(1) : 0} Mos Runway</p>
          <div className="mt-3 inline-flex items-center text-[10px] bg-bullion-amber/10 text-bullion-amber px-2 py-1 rounded">⚠️ Check Cash Drag</div>
        </div>
        <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
          <p className="text-xs text-text-secondary mb-1">This Month's Cashflow</p>
          <p className="text-lg font-bold text-liability-rose tabular-nums">-{formatCurrency(totalExpense)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Inflow: {formatCurrency(totalIncome)}</p>
          <div className="mt-3 inline-flex items-center text-[10px] bg-surface-layer2 text-text-secondary px-2 py-1 rounded">{savingsRate.toFixed(1)}% Savings Rate</div>
        </div>
      </div>

    </div>
  );
}
