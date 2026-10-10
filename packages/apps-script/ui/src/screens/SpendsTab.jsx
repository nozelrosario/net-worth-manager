import useModalBack from "../hooks/useModalBack";
import React, { useState, useMemo } from 'react';
import { getSafeStorage } from '../utils/storage';
import { ArrowRightLeft, CheckCircle, ArrowDownLeft, Banknote, CreditCard, PlusCircle, AlertCircle, Search } from 'lucide-react';

export default function SpendsTab({ formatCurrency, data, onRefresh, showMessage }) {
  const [showLogModal, setShowLogModal] = useState(false);
  useModalBack(showLogModal, () => setShowLogModal(false));
  const [editingTxnId, setEditingTxnId] = useState(null);
  
  useEffect(() => {
    const pending = sessionStorage.getItem('pending_sms_expense');
    if (pending && !showLogModal) {
      try {
        const data = JSON.parse(pending);
        setNewTxn(prev => ({ 
          ...prev, 
          Amount: data.amount, 
          Notes: data.notes, 
          Date: data.date 
        }));
        setShowLogModal(true);
        sessionStorage.removeItem('pending_sms_expense');
      } catch (e) {}
    }
  }, [showLogModal]);

  const [newTxn, setNewTxn] = useState({ 
    Date: new Date().toISOString().split('T')[0], 
    'Merchant/Description': '', 
    Beneficiary: '',
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
  const profiles = data?.familyProfiles || [];

  const defaultCategories = 'Dining, Groceries, Utilities, Rent, Travel, Entertainment, Healthcare, Education, Shopping, Other';
  const customCategoriesStr = data?.settings?.find(s => s['Setting Key'] === 'SpendCategories')?.['Setting Value'] || defaultCategories;
  const categoriesList = customCategoriesStr.split(',').map(s => s.trim()).filter(Boolean);
  const filters = ['All Records', ...categoriesList];

  const openAddModal = () => {
    setEditingTxnId(null);
    setNewTxn({ 
      Date: new Date().toISOString().split('T')[0], 
      'Merchant/Description': '', 
      Beneficiary: '',
      Category: categoriesList[0] || 'Groceries', 
      Amount: '', 
      Type: 'Expense', 
      'Account/Card': '',
      'Is Transfer': false,
      Tags: ''
    });
    setShowLogModal(true);
  };

  const openEditModal = (txn) => {
    setEditingTxnId(txn['Txn ID']);
    setNewTxn({ ...txn, Amount: Math.abs(txn.Amount) }); // Amount usually stored/handled depending on type, abs for form
    setShowLogModal(true);
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    setIsSubmitting(true);
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSubmitting(false);
          setShowLogModal(false);
          if (onRefresh) onRefresh();
          showMessage(res.message);
        })
        .withFailureHandler((err) => {
          setIsSubmitting(false);
          showMessage('Error: ' + err.message, true);
        })
        .deleteRecord('Transactions', 'Txn ID', id, getSafeStorage('nwm_session_token'));
    } else {
      setTimeout(() => { setIsSubmitting(false); setShowLogModal(false); showMessage('Deleted (preview)'); }, 1000);
    }
  };

  const handleSaveTxn = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (window.google?.script?.run) {
      const token = getSafeStorage('nwm_session_token');
      const handler = window.google.script.run
        .withSuccessHandler((res) => {
          setIsSubmitting(false);
          if (res && res.status === 'error') {
            showMessage('Error: ' + res.message, true);
          } else {
            setShowLogModal(false);
            if (onRefresh) onRefresh();
            showMessage(res.message || 'Record saved successfully!');
          }
        })
        .withFailureHandler((err) => {
          setIsSubmitting(false);
          showMessage('Network/Server Error: ' + err.message, true);
        });

      const payload = {
        ...newTxn,
        Amount: Number(newTxn.Amount)
      };

      if (editingTxnId) {
         handler.updateRecord('Transactions', 'Txn ID', editingTxnId, payload, token);
      } else {
         payload['Txn ID'] = '';
         handler.addRecord('Transactions', payload, token);
      }
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        setShowLogModal(false);
        showMessage(editingTxnId ? 'Transaction updated (preview)' : 'Transaction logged (preview)');
      }, 1000);
    }
  };

  const filteredTxns = useMemo(() => {
    return txns.filter(txn => {
      const searchStr = `${txn['Merchant/Description'] || ''} ${txn.Category || ''} ${txn['Account/Card'] || ''} ${txn.Tags || ''}`.toLowerCase();
      if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) return false;
      
      const isTransfer = txn['Is Transfer'] === 'TRUE' || txn['Is Transfer'] === true || String(txn.Category || '').toLowerCase().includes('transfer');
      const isCash = String(txn['Account/Card'] || '').toLowerCase().includes('cash');

      if (filterType !== 'All Records') {
         return txn.Category === filterType;
      }
      
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
        <div 
          key={txn['Txn ID']} 
          onClick={() => openEditModal(txn)}
          className="bg-surface-layer1/50 border border-dashed border-border-prominent rounded-xl p-3.5 relative cursor-pointer hover:border-primary-accent/50 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-lg bg-surface-layer2 border border-border-subtle flex items-center justify-center text-text-secondary">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary group-hover:text-primary-accent transition-colors">{txn['Merchant/Description'] || 'Internal Transfer'}</h3>
                <div className="mt-1 flex items-center space-x-1.5">
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] bg-surface-layer2 text-text-secondary border border-border-subtle">
                    <CheckCircle size={12} className="text-wealth-emerald" />
                    <span>Self-Payment / Transfer</span>
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                  Excluded from spends calculation.
                </p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-base font-bold text-text-secondary tabular-nums">{formatCurrency(txn.Amount)}</span>
              <span className="block text-xs text-text-muted mt-1">Excluded</span>
              <span className="text-primary-accent/70 text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        key={txn['Txn ID']} 
        onClick={() => openEditModal(txn)}
        className="bg-surface-layer1 border border-border-subtle rounded-xl p-3.5 hover:border-primary-accent/50 cursor-pointer transition-colors group"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={`w-10 h-10 rounded-lg bg-surface-layer2 border border-border-subtle flex items-center justify-center ${isIncome ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
              {isIncome ? <ArrowDownLeft size={20} /> : (String(txn['Account/Card']||'').toLowerCase().includes('cash') ? <Banknote size={20} /> : <CreditCard size={20} />)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-text-primary group-hover:text-primary-accent transition-colors">{txn['Merchant/Description'] || txn.Category}</h3>
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
              <p className="text-[12px] text-text-secondary mt-0.5">
                {txn['Account/Card'] || 'Main Account'}
                {txn.Beneficiary && ` • For: ${txn.Beneficiary}`}
              </p>
              {txn.Tags && (
                <p className="text-xs text-text-muted mt-1">{txn.Tags}</p>
              )}
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className={`text-base font-bold tabular-nums ${isIncome ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
              {isIncome ? '+' : '-'}{formatCurrency(txn.Amount)}
            </span>
            <span className="text-primary-accent/70 text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
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
        <button onClick={openAddModal} className="flex items-center space-x-1 px-3 py-1.5 bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle rounded-full text-primary-accent transition-transform active:scale-95">
          <PlusCircle size={16} />
          <span className="text-sm font-semibold">Log</span>
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
                <AlertCircle size={16} />
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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center">
              <Search size={18} />
            </div>
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface-layer1 border border-border-subtle focus:border-primary-accent focus:ring-0 rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none" 
              placeholder="Search merchant, tag, or bank..." 
              type="text"
            />
          </div>
          
          <div 
            className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1 no-swipe"
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onMouseMove={e => e.stopPropagation()}
          >
            {filters.map(tab => (
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
        <div className="fixed inset-0 z-50 no-swipe flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowLogModal(false)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
             <h3 className="text-lg font-bold mb-4 text-white">{editingTxnId ? 'Edit Transaction' : 'Log Transaction'}</h3>
             <form onSubmit={handleSaveTxn} className="space-y-4">
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
               <div>
                 <label className="block text-xs text-text-secondary mb-1">For Whom (Beneficiary)</label>
                 <select value={newTxn.Beneficiary || ''} onChange={e => setNewTxn({...newTxn, Beneficiary: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent outline-none">
                   <option value="">Whole Family</option>
                   {profiles.map(p => <option key={p.Name} value={p.Name}>{p.Name}</option>)}
                 </select>
               </div>
               <div className="flex gap-2">
                 <div className="flex-1">
                   <label className="block text-xs text-text-secondary mb-1">Category</label>
                   <select value={newTxn.Category || categoriesList[0] || ''} onChange={e => setNewTxn({...newTxn, Category: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent outline-none">
                     {categoriesList.map(cat => (
                       <option key={cat} value={cat}>{cat}</option>
                     ))}
                   </select>
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
               <div className="pt-2 flex flex-col gap-3">
                 <div className="flex gap-3">
                   <button type="button" onClick={() => setShowLogModal(false)} className="flex-1 px-4 py-2 bg-surface-layer2 text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-layer2/80">Cancel</button>
                   <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save'}</button>
                 </div>
                 {editingTxnId && (
                   <button type="button" onClick={() => handleDelete(editingTxnId)} disabled={isSubmitting} className="w-full px-4 py-2 bg-liability-rose/10 text-liability-rose border border-liability-rose/20 rounded-lg text-sm font-medium hover:bg-liability-rose/20 disabled:opacity-50">
                     {isSubmitting ? 'Deleting...' : 'Delete Transaction'}
                   </button>
                 )}
               </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}
