import React, { useState } from 'react';

export default function SpendsTab({ formatCurrency, data }) {
  const [showLogModal, setShowLogModal] = useState(false);
  const [newTxn, setNewTxn] = useState({ Date: '', 'Merchant/Description': '', Category: 'Groceries', Amount: '', Type: 'Expense', 'Account/Card': '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const txns = data?.transactions || [];
  
  const handleLogTxn = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSubmitting(false);
          setShowLogModal(false);
          alert(res.message);
        })
        .withFailureHandler((err) => {
          setIsSubmitting(false);
          alert('Error: ' + err.message);
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

  const totalExpense = txns.filter(t => t.Type === 'Expense').reduce((sum, t) => sum + Number(t.Amount || 0), 0) || 64200;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold">Spends & Cashflow</h2>
        <button onClick={() => setShowLogModal(true)} className="text-primary-accent text-sm font-medium bg-primary-accent/10 px-3 py-1.5 rounded-lg">+ Log Cash</button>
      </div>

      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-5 text-center">
        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">September Spends</p>
        <p className="text-3xl font-bold text-liability-rose tabular-nums">{formatCurrency(totalExpense)}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 bg-surface-layer2 text-text-secondary px-3 py-1 rounded-full text-xs">
           <span>Budget: {formatCurrency(80000)}</span>
           <span className="w-1 h-1 rounded-full bg-border-subtle mx-1"></span>
           <span className="text-wealth-emerald">{Math.round(((80000-totalExpense)/80000)*100)}% Left</span>
        </div>
      </div>

      <h3 className="text-sm font-semibold mt-6 mb-2">Recent Transactions</h3>
      <div className="space-y-3">
        {txns.length === 0 && (
          <p className="text-text-secondary text-sm text-center py-8">No transactions logged yet.</p>
        )}
        {txns.slice(0, 10).map((txn, i) => (
          <div key={txn['Txn ID'] || i} className="flex justify-between items-center p-3 bg-surface-layer1 border border-border-subtle rounded-xl">
            <div className="flex gap-3 items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${txn.Type === 'Income' ? 'bg-wealth-emerald/10 text-wealth-emerald' : 'bg-surface-layer2 text-text-secondary'}`}>
                {txn.Type === 'Income' ? '⬇' : '💸'}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{txn['Merchant/Description'] || txn.Category}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{new Date(txn.Date || new Date()).toLocaleDateString()} • {txn['Account/Card'] || 'Cash'}</p>
              </div>
            </div>
            <p className={`font-bold tabular-nums text-sm ${txn.Type === 'Income' ? 'text-wealth-emerald' : 'text-white'}`}>
              {txn.Type === 'Income' ? '+' : '-'}{formatCurrency(txn.Amount)}
            </p>
          </div>
        ))}
      </div>
      
      {/* Add Transaction Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowLogModal(false)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
             <h3 className="text-lg font-bold mb-4 text-white">Log Transaction</h3>
             <form onSubmit={handleLogTxn} className="space-y-4">
               <div>
                 <label className="block text-xs text-text-secondary mb-1">Type</label>
                 <select value={newTxn.Type} onChange={e => setNewTxn({...newTxn, Type: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent">
                   <option>Expense</option>
                   <option>Income</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs text-text-secondary mb-1">Date</label>
                 <input required value={newTxn.Date} onChange={e => setNewTxn({...newTxn, Date: e.target.value})} type="date" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" />
               </div>
               <div>
                 <label className="block text-xs text-text-secondary mb-1">Description / Merchant</label>
                 <input required value={newTxn['Merchant/Description']} onChange={e => setNewTxn({...newTxn, 'Merchant/Description': e.target.value})} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" placeholder="e.g. Groceries" />
               </div>
               <div>
                 <label className="block text-xs text-text-secondary mb-1">Amount (₹)</label>
                 <input required value={newTxn.Amount} onChange={e => setNewTxn({...newTxn, Amount: e.target.value})} type="number" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" placeholder="5000" />
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
