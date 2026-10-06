import React from 'react';

export default function AssetsTab({ formatCurrency }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold">Assets & Liabilities</h2>
        <button className="text-primary-accent text-sm font-medium bg-primary-accent/10 px-3 py-1.5 rounded-lg">+ Add Asset</button>
      </div>
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
        {['All Assets', 'Market-Linked', 'Precious Metals', 'Real Estate', 'Fixed Deposits', 'Liabilities'].map(f => (
          <button key={f} className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full ${f === 'All Assets' ? 'bg-primary-accent text-white' : 'bg-surface-layer2 text-text-secondary border border-border-subtle'}`}>
            {f}
          </button>
        ))}
      </div>
      
      {/* Asset List */}
      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-sm font-medium text-white">Parag Parikh Flexi Cap Fund</p>
            <p className="text-xs text-text-muted mt-0.5">Direct Growth • Folio 10482910</p>
          </div>
          <span className="bg-surface-layer2 text-[10px] px-2 py-1 rounded text-text-secondary border border-border-subtle">Self (100%)</span>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-text-secondary">Current Value</p>
            <p className="text-lg font-bold tabular-nums text-wealth-emerald mt-0.5">{formatCurrency(154956)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary">Units: 1,840.12</p>
            <p className="text-xs text-wealth-emerald mt-0.5 font-medium">+18.4% XIRR</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-sm font-medium text-white">24K Minted Gold Bars</p>
            <p className="text-xs text-text-muted mt-0.5">500.00g • Spot: ₹7,240/g</p>
          </div>
          <span className="bg-surface-layer2 text-[10px] px-2 py-1 rounded text-text-secondary border border-border-subtle">Home Safe</span>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-text-secondary">Current Value</p>
            <p className="text-lg font-bold tabular-nums text-bullion-amber mt-0.5">{formatCurrency(3620000)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
