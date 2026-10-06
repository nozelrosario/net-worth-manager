import React from 'react';

export default function SpendsTab({ formatCurrency }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold">Cashflow & Spends</h2>
        <button className="text-primary-accent text-sm font-medium bg-primary-accent/10 px-3 py-1.5 rounded-lg">+ Log Cash</button>
      </div>
      
      {/* Monthly Cash Flow Ribbon */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-surface-layer1 border border-border-subtle rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-muted uppercase mb-1">Inflow</p>
          <p className="text-sm font-bold text-wealth-emerald tabular-nums">{formatCurrency(210000)}</p>
        </div>
        <div className="flex-1 bg-surface-layer1 border border-border-subtle rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-muted uppercase mb-1">Outflow</p>
          <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(64200)}</p>
        </div>
        <div className="flex-1 bg-surface-layer1 border border-border-subtle rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-muted uppercase mb-1">Saved</p>
          <p className="text-sm font-bold text-primary-accent tabular-nums">{formatCurrency(145800)}</p>
        </div>
      </div>

      <div className="bg-bullion-amber/10 border border-bullion-amber/20 rounded-xl p-4">
        <p className="text-sm font-medium text-bullion-amber">2 Transactions Need Verification</p>
        <div className="mt-3 bg-surface-layer2 rounded-lg p-3">
          <p className="text-sm font-medium">POS BLR XX2019</p>
          <p className="text-xs text-text-muted">Today, 2:15 PM • {formatCurrency(3200)}</p>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <span className="whitespace-nowrap px-2.5 py-1 bg-surface-layer1 border border-border-subtle rounded text-xs text-text-secondary">Groceries</span>
            <span className="whitespace-nowrap px-2.5 py-1 bg-surface-layer1 border border-border-subtle rounded text-xs text-text-secondary">Shopping</span>
            <span className="whitespace-nowrap px-2.5 py-1 bg-surface-layer1 border border-border-subtle rounded text-xs text-text-secondary">Hardware</span>
            <span className="whitespace-nowrap px-2.5 py-1 bg-surface-layer1 border border-border-subtle rounded text-xs text-liability-rose">Ignore</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        <h3 className="text-sm font-semibold text-text-secondary">Recent Transactions</h3>
        
        <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-layer2 flex items-center justify-center text-lg">🍔</div>
              <div>
                <p className="text-sm font-medium">Swiggy</p>
                <p className="text-[11px] text-text-muted mt-0.5">HDFC Bank XX4091 • Member: Self</p>
                <span className="inline-block mt-1 bg-surface-layer2 text-[10px] px-2 py-0.5 rounded text-text-secondary">Dining</span>
              </div>
            </div>
            <p className="text-sm font-bold text-white">-{formatCurrency(1450)}</p>
          </div>
        </div>

        <div className="bg-surface-layer1 border border-dashed border-border-subtle rounded-xl p-4 opacity-75">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-layer2 flex items-center justify-center text-lg">🔄</div>
              <div>
                <p className="text-sm font-medium">HDFC Savings ➔ ICICI Credit</p>
                <span className="inline-block mt-1 bg-surface-layer2 text-[10px] px-2 py-0.5 rounded text-text-secondary">Self-Payment / Transfer</span>
              </div>
            </div>
            <p className="text-sm font-bold text-text-secondary">{formatCurrency(45000)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
