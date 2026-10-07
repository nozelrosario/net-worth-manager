import React, { useState, useMemo } from 'react';

export default function SpendsTab({ formatCurrency, data }) {
  const [showLogModal, setShowLogModal] = useState(false);
  const [newTxn, setNewTxn] = useState({ 
    Date: new Date().toISOString().split('T')[0], 
    'Merchant/Description': '', 
    Category: 'Groceries', 
    Amount: '', 
    Type: 'Expense', 
    'Account/Card': '',
    'Is Transfer': false,
    Tags: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All Records');

  const txns = data?.transactions || [];

  const handleLogTxn = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSubmitting(false);
          if (res && res.status === 'error') {
            alert('Error: ' + res.message);
          } else {
            setShowLogModal(false);
            alert('Record added successfully! (Refresh page to see changes)');
          }
        })
        .withFailureHandler((err) => {
          setIsSubmitting(false);
          alert('Network/Server Error: ' + err.message);
        })
        .addRecord('Transactions', {
           ...newTxn,
           'Txn ID': '',
           Amount: Number(newTxn.Amount)
        });
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        setShowLogModal(false);
        alert('Transaction logged (preview)');
      }, 1000);
    }
  };

  const filteredTxns = useMemo(() => {
    return txns.filter(txn => {
      const searchStr = `${txn['Merchant/Description'] || ''} ${txn.Category || ''} ${txn['Account/Card'] || ''} ${txn.Tags || ''}`.toLowerCase();
      if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) return false;
      
      const isTransfer = txn['Is Transfer'] === 'TRUE' || txn['Is Transfer'] === true || String(txn.Category || '').toLowerCase().includes('transfer');
      const isCash = String(txn['Account/Card'] || '').toLowerCase().includes('cash');

      if (filterType === 'Spends') return txn.Type === 'Expense' && !isTransfer;
      if (filterType === 'Transfers') return isTransfer;
      if (filterType === 'Cash Logs') return isCash;
      
      return true;
    }).sort((a, b) => new Date(b.Date || 0) - new Date(a.Date || 0));
  }, [txns, searchQuery, filterType]);

  const groupedTxns = useMemo(() => {
    const groups = {};
    filteredTxns.forEach(txn => {
      const dateKey = txn.Date ? new Date(txn.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(txn);
    });
    return Object.keys(groups).map(date => ({ date, events: groups[date] }));
  }, [filteredTxns]);

  const { inflow, outflow } = useMemo(() => {
    let inflow = 0, outflow = 0;
    txns.forEach(t => {
      const isTransfer = t['Is Transfer'] === 'TRUE' || t['Is Transfer'] === true || String(t.Category || '').toLowerCase().includes('transfer');
      if (!isTransfer) {
        if (t.Type === 'Income') inflow += Number(t.Amount || 0);
        if (t.Type === 'Expense') outflow += Number(t.Amount || 0);
      }
    });
    return { inflow, outflow };
  }, [txns]);

  const netSurplus = inflow - outflow;
  const surplusPercent = inflow > 0 ? Math.max(0, Math.min(100, (netSurplus / inflow) * 100)) : 0;
  
  const pendingVerifications = txns.filter(t => String(t.Tags || '').toLowerCase().includes('pending'));

  const renderTxnCard = (txn) => {
    const isTransfer = txn['Is Transfer'] === 'TRUE' || txn['Is Transfer'] === true || String(txn.Category || '').toLowerCase().includes('transfer');
    const isIncome = txn.Type === 'Income';
    const hasSplits = txn['Split JSON'] && txn['Split JSON'].length > 2; // Assuming JSON string "[]" or similar
    
    let splits = [];
    try {
      if (hasSplits) splits = JSON.parse(txn['Split JSON']);
    } catch(e) {}

    if (isTransfer) {
      return (
        <div key={txn['Txn ID']} className="bg-surface-layer1/50 border border-dashed border-border-prominent rounded-xl p-3.5 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-lg bg-surface-layer2 border border-border-subtle flex items-center justify-center text-text-secondary">
                <span className="material-symbols-outlined text-[20px]">sync_alt</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{txn['Merchant/Description'] || 'Internal Transfer'}</h3>
                <div className="mt-1 flex items-center space-x-1.5">
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] bg-surface-layer2 text-text-secondary border border-border-subtle">
                    <span className="material-symbols-outlined text-[12px] text-wealth-emerald">check_circle</span>
                    <span>Self-Payment / Transfer</span>
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                  Excluded from spends calculation.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-bold text-text-secondary tabular-nums">{formatCurrency(txn.Amount)}</span>
              <span className="block text-xs text-text-muted mt-1">Excluded</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={txn['Txn ID']} className="bg-surface-layer1 border border-border-subtle rounded-xl p-3.5 hover:border-border-prominent transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={`w-10 h-10 rounded-lg bg-surface-layer2 border border-border-subtle flex items-center justify-center ${isIncome ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
              <span className="material-symbols-outlined text-[20px]">{isIncome ? 'south_west' : (String(txn['Account/Card']||'').toLowerCase().includes('cash') ? 'payments' : 'credit_card')}</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-text-primary">{txn['Merchant/Description'] || txn.Category}</h3>
                {hasSplits && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-primary-accent/10 text-primary-accent border border-primary-accent/20">
                    Split ({splits.length})
                  </span>
                )}
                {!hasSplits && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-layer2 text-text-secondary border border-border-subtle">
                    {txn.Category}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">{txn['Account/Card'] || 'Main Account'}</p>
              {txn.Tags && (
                <p className="text-xs text-text-muted mt-1">{txn.Tags}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className={`text-base font-bold tabular-nums ${isIncome ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
              {isIncome ? '+' : '-'}{formatCurrency(txn.Amount)}
            </span>
          </div>
        </div>
        {hasSplits && splits.length > 0 && (
          <div className="ml-4 mt-3 pl-3 border-l-2 border-primary-accent/40 space-y-2 bg-surface-layer2/50 p-2.5 rounded-r-lg">
            {splits.map((split, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-1.5 text-text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-accent"></span>
                  <span>{split.Category}</span>
                </div>
                <span className="tabular-nums font-semibold text-text-primary">{formatCurrency(split.Amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-text-primary">Cashflow & Spends</h2>
        <button onClick={() => setShowLogModal(true)} className="flex items-center space-x-1 px-3 py-1.5 bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle rounded-full text-primary-accent transition-transform active:scale-95">
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          <span className="text-sm font-semibold">+ Log</span>
        </button>
      </div>

      {/* Hero Monthly Cash Flow Ribbon */}
      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-primary-accent/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <span className="text-sm text-text-secondary">Net Cash Position</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-wealth-emerald/10 text-wealth-emerald border border-wealth-emerald/20 font-semibold">
            {surplusPercent.toFixed(1)}% Saved
          </span>
        </div>
        
        {/* Metric Grid */}
        <div className="grid grid-cols-3 gap-2 pt-3.5 pb-2 text-left">
          <div className="flex flex-col">
            <span className="text-xs text-text-muted">Monthly Inflow</span>
            <span className="text-base font-bold text-wealth-emerald tabular-nums mt-0.5">{formatCurrency(inflow)}</span>
          </div>
          <div className="flex flex-col border-l border-border-subtle pl-2.5">
            <span className="text-xs text-text-muted">Net Spends</span>
            <span className="text-base font-bold text-text-primary tabular-nums mt-0.5">{formatCurrency(outflow)}</span>
          </div>
          <div className="flex flex-col border-l border-border-subtle pl-2.5">
            <span className="text-xs text-text-muted">Net Surplus</span>
            <span className="text-base font-bold text-wealth-emerald tabular-nums mt-0.5">{formatCurrency(netSurplus)}</span>
          </div>
        </div>

        {/* Savings Ratio Progress Bar */}
        <div className="mt-3">
          <div className="w-full h-1.5 bg-surface-layer2 rounded-full overflow-hidden flex">
            <div className="h-full bg-wealth-emerald rounded-full" style={{ width: `${surplusPercent}%` }}></div>
            <div className="h-full bg-liability-rose/70" style={{ width: `${100 - surplusPercent}%` }}></div>
          </div>
        </div>
      </div>

      {/* Pending Verification Inbox */}
      {pendingVerifications.length > 0 && (
        <section className="bg-surface-layer1 border border-bullion-amber/40 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-bullion-amber/15 flex items-center justify-center text-bullion-amber">
                <span className="material-symbols-outlined text-[16px]">priority_high</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{pendingVerifications.length} Verifications Pending</h2>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-bullion-amber/15 text-bullion-amber font-semibold border border-bullion-amber/30">Action Required</span>
          </div>
          {pendingVerifications.map(txn => (
            <div key={txn['Txn ID']} className="mt-3 bg-surface-layer2/80 rounded-lg p-3 border border-border-subtle">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm text-text-primary font-medium">{txn['Merchant/Description'] || txn.Category}</h4>
                  <p className="text-xs text-text-secondary">{txn.Date} • {txn['Account/Card']}</p>
                </div>
                <span className="text-sm font-bold text-liability-rose tabular-nums">-{formatCurrency(txn.Amount)}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button className="px-2 py-1 text-xs bg-surface-layer1 hover:bg-border-prominent rounded border border-border-subtle text-text-primary">Categorize</button>
                <button className="px-2 py-1 text-xs bg-surface-layer1 hover:bg-border-prominent rounded border border-border-subtle text-text-primary">Split</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Stream */}
      <section className="space-y-3">
        {/* Search & Filter Controls */}
        <div className="space-y-2">
          <div className="relative">
            <span className="material-symbols-outlined text-[18px] text-text-muted absolute left-3 top-1/2 -translate-y-1/2">search</span>
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface-layer1 border border-border-subtle focus:border-primary-accent focus:ring-0 rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none" 
              placeholder="Search merchant, tag, or bank..." 
              type="text"
            />
          </div>
          
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
            {['All Records', 'Spends', 'Transfers', 'Cash Logs'].map(tab => (
              <button 
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${filterType === tab ? 'bg-primary-accent text-white shadow-sm' : 'bg-surface-layer1 hover:bg-surface-layer2 text-text-secondary border border-border-subtle'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Grouped Transactions */}
        {groupedTxns.length === 0 ? (
          <p className="text-center text-text-muted py-8 text-sm">No transactions found.</p>
        ) : (
          groupedTxns.map(group => (
            <div key={group.date} className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-xs text-text-muted uppercase tracking-wider px-1">
                <span>{group.date}</span>
                <span className="tabular-nums font-mono">{group.events.length} Events</span>
              </div>
              {group.events.map(txn => renderTxnCard(txn))}
            </div>
          ))
        )}
      </section>
      
      {/* Add Transaction Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowLogModal(false)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
             <h3 className="text-lg font-bold mb-4 text-white">Log Transaction</h3>
             <form onSubmit={handleLogTxn} className="space-y-4">
               <div className="flex gap-2">
                 <div className="flex-1">
                   <label className="block text-xs text-text-secondary mb-1">Type</label>
                   <select value={newTxn.Type} onChange={e => setNewTxn({...newTxn, Type: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent outline-none">
                     <option>Expense</option>
                     <option>Income</option>
                   </select>
                 </div>
                 <div className="flex-1">
                   <label className="block text-xs text-text-secondary mb-1">Date</label>
                   <input required value={newTxn.Date} onChange={e => setNewTxn({...newTxn, Date: e.target.value})} type="date" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent outline-none" />
                 </div>
               </div>
               <div>
                 <label className="block text-xs text-text-secondary mb-1">Merchant / Description</label>
                 <input required value={newTxn['Merchant/Description']} onChange={e => setNewTxn({...newTxn, 'Merchant/Description': e.target.value})} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent outline-none" placeholder="e.g. Swiggy" />
               </div>
               <div className="flex gap-2">
                 <div className="flex-1">
                   <label className="block text-xs text-text-secondary mb-1">Category</label>
                   <input required value={newTxn.Category} onChange={e => setNewTxn({...newTxn, Category: e.target.value})} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent outline-none" placeholder="e.g. Dining" />
                 </div>
                 <div className="flex-1">
                   <label className="block text-xs text-text-secondary mb-1">Amount (₹)</label>
                   <input required value={newTxn.Amount} onChange={e => setNewTxn({...newTxn, Amount: e.target.value})} type="number" step="0.01" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent outline-none" placeholder="1000" />
                 </div>
               </div>
               <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="isTransfer" checked={newTxn['Is Transfer']} onChange={e => setNewTxn({...newTxn, 'Is Transfer': e.target.checked})} className="rounded bg-surface-layer2 border-border-subtle text-primary-accent focus:ring-0" />
                  <label htmlFor="isTransfer" className="text-xs text-text-secondary">Mark as Internal Transfer</label>
               </div>
               <div className="pt-2 flex gap-3">
                 <button type="button" onClick={() => setShowLogModal(false)} className="flex-1 px-4 py-2 bg-surface-layer2 text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-layer2/80">Cancel</button>
                 <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save'}</button>
               </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}
