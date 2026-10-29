import useModalBack from "../hooks/useModalBack";
import React, { useState, useEffect, useMemo } from 'react';
import { getSafeStorage } from '../utils/storage';
import { Badge } from '../components/Badge';
import { 
  ArrowRightLeft, 
  CheckCircle, 
  ArrowDownLeft, 
  Banknote, 
  CreditCard, 
  PlusCircle, 
  AlertCircle, 
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Flame,
  Users,
  PieChart,
  Wallet,
  X,
  Calendar,
  Plus,
  Trash2,
  Cloud
} from 'lucide-react';
import SmsInboxModal from '../components/SmsInboxModal';

export default function SpendsTab({ formatCurrency, data, onRefresh, showMessage }) {
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSmsInbox, setShowSmsInbox] = useState(false);
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
  const [selectedSegment, setSelectedSegment] = useState('beneficiary'); // 'beneficiary' | 'category' | 'account'
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('');

  // Parse comma-separated Beneficiary string from newTxn into an array
  const selectedBeneficiaries = useMemo(() => {
    const raw = String(newTxn.Beneficiary || '').trim();
    if (!raw || raw.toLowerCase() === 'whole family') return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }, [newTxn.Beneficiary]);

  const txns = data?.transactions || [];
  const profiles = data?.familyProfiles || [];

  const getMonthKeyFromDate = (dateVal) => {
    if (!dateVal) return null;
    const str = String(dateVal).trim();
    if (/^\d{4}-\d{2}/.test(str)) return str.slice(0, 7);
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}`;
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return null;
  };

  const handleImportSuccess = (importedList) => {
    if (!importedList || importedList.length === 0) return;
    const firstDate = importedList[0]?.Date;
    const targetMonth = getMonthKeyFromDate(firstDate);
    if (targetMonth) {
      setSelectedMonth(targetMonth);
    } else {
      setSelectedMonth('ALL');
    }
    // Optimistically update txns in data so the entry appears immediately
    if (data) {
      if (!data.transactions) data.transactions = [];
      importedList.forEach(item => {
        if (!data.transactions.some(t => t['Txn ID'] === item['Txn ID'])) {
          data.transactions.unshift(item);
        }
      });
    }
    // Reset filters that could hide the imported transaction
    setSearchQuery('');
    setFilterType('All Records');
    setBeneficiaryFilter('');
  };

  const availableMonths = useMemo(() => {
    const set = new Set();
    const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    set.add(currentMonthKey);
    txns.forEach(t => {
      const k = getMonthKeyFromDate(t.Date);
      if (k) set.add(k);
    });
    return Array.from(set).sort().reverse();
  }, [txns]);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  });

  const currentMonthIndex = availableMonths.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    if (selectedMonth === 'ALL') {
      setSelectedMonth(availableMonths[0] || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
      return;
    }
    if (currentMonthIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentMonthIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 'ALL') return;
    if (currentMonthIndex > 0) {
      setSelectedMonth(availableMonths[currentMonthIndex - 1]);
    }
  };

  const formatMonthName = (monthKey) => {
    if (monthKey === 'ALL') return 'All Time';
    const [year, month] = monthKey.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const defaultCategories = 'Dining, Groceries, Utilities, Rent, Travel, Entertainment, Healthcare, Education, Shopping, Insurance, Investment / Insurance, General Expense, Other';
  const customCategoriesStr = data?.settings?.find(s => s['Setting Key'] === 'SpendCategories')?.['Setting Value'] || defaultCategories;
  let categoriesList = customCategoriesStr.split(',').map(s => s.trim()).filter(Boolean);
  if (!categoriesList.includes('Insurance')) {
    categoriesList.splice(categoriesList.length - 1, 0, 'Insurance');
  }
  if (!categoriesList.includes('Investment / Insurance')) {
    categoriesList.splice(categoriesList.length - 1, 0, 'Investment / Insurance');
  }
  if (!categoriesList.includes('General Expense')) {
    categoriesList.splice(Math.max(0, categoriesList.length - 1), 0, 'General Expense');
  }
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
    let cleanDate = txn.Date || '';
    if (cleanDate) {
      if (typeof cleanDate === 'string' && cleanDate.includes('T')) {
        cleanDate = cleanDate.split('T')[0];
      } else {
        const d = new Date(cleanDate);
        if (!isNaN(d.getTime())) {
          cleanDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }
    }
    setNewTxn({ 
      ...txn, 
      Date: cleanDate || new Date().toISOString().split('T')[0],
      Amount: Math.abs(txn.Amount) 
    }); // Amount usually stored/handled depending on type, abs for form
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

  const isTransfer = (t) => {
    return t['Is Transfer'] === 'TRUE' || t['Is Transfer'] === true || String(t.Category || '').toLowerCase().includes('transfer');
  };

  // Monthly stats map for all months (for MoM & 6-month trends)
  const monthlyStatsMap = useMemo(() => {
    const map = {};
    txns.forEach(t => {
      if (t.Type === 'Expense' && !isTransfer(t)) {
        const k = getMonthKeyFromDate(t.Date);
        if (k) {
          map[k] = (map[k] || 0) + Number(t.Amount || 0);
        }
      }
    });
    return map;
  }, [txns]);

  // Last 6 months trend
  const recent6Months = useMemo(() => {
    const months = [];
    const baseDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const amount = monthlyStatsMap[key] || 0;
      months.push({ key, label, amount });
    }
    const maxAmount = Math.max(...months.map(m => m.amount), 1);
    return months.map(m => ({
      ...m,
      percent: Math.round((m.amount / maxAmount) * 100)
    }));
  }, [monthlyStatsMap]);

  // Selected Month Spends, MoM, Daily Burn & Projected Spend
  const {
    selectedMonthSpend,
    prevMonthSpend,
    momDiff,
    momPct,
    dailyBurn,
    projectedSpend,
    txnMonthCount,
    avgTxnAmount,
    daysElapsed,
    totalDaysInMonth
  } = useMemo(() => {
    let spend = 0;
    let count = 0;

    if (selectedMonth === 'ALL') {
      txns.forEach(t => {
        if (t.Type === 'Expense' && !isTransfer(t)) {
          spend += Number(t.Amount || 0);
          count++;
        }
      });
      return {
        selectedMonthSpend: spend,
        prevMonthSpend: 0,
        momDiff: 0,
        momPct: null,
        dailyBurn: count > 0 ? spend / count : 0,
        projectedSpend: spend,
        txnMonthCount: count,
        avgTxnAmount: count > 0 ? spend / count : 0,
        daysElapsed: 0,
        totalDaysInMonth: 0
      };
    }

    txns.forEach(t => {
      const k = getMonthKeyFromDate(t.Date);
      if (k === selectedMonth && t.Type === 'Expense' && !isTransfer(t)) {
        spend += Number(t.Amount || 0);
        count++;
      }
    });

    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const pSpend = monthlyStatsMap[prevKey] || 0;

    const diff = spend - pSpend;
    const pct = pSpend > 0 ? (diff / pSpend) * 100 : null;

    const now = new Date();
    const isCurrentCalendarMonth = (now.getFullYear() === year && now.getMonth() + 1 === month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const elapsed = isCurrentCalendarMonth ? Math.max(1, now.getDate()) : daysInMonth;

    const burn = elapsed > 0 ? spend / elapsed : 0;
    const projected = isCurrentCalendarMonth ? burn * daysInMonth : spend;
    const avg = count > 0 ? spend / count : 0;

    return {
      selectedMonthSpend: spend,
      prevMonthSpend: pSpend,
      momDiff: diff,
      momPct: pct,
      dailyBurn: burn,
      projectedSpend: projected,
      txnMonthCount: count,
      avgTxnAmount: avg,
      daysElapsed: elapsed,
      totalDaysInMonth: daysInMonth
    };
  }, [txns, selectedMonth, monthlyStatsMap]);

  // Segmented Breakdown for the selected month
  const breakdownData = useMemo(() => {
    const beneficiaryMap = {};
    const categoryMap = {};
    const accountMap = {};

    txns.forEach(t => {
      if (t.Type === 'Expense' && !isTransfer(t)) {
        const k = getMonthKeyFromDate(t.Date);
        if (selectedMonth === 'ALL' || k === selectedMonth) {
          const amt = Number(t.Amount || 0);

          const rawBen = String(t.Beneficiary || '').trim();
          if (!rawBen || rawBen.toLowerCase() === 'whole family') {
            beneficiaryMap['Whole Family'] = (beneficiaryMap['Whole Family'] || 0) + amt;
          } else {
            const bens = rawBen.split(',').map(b => b.trim()).filter(Boolean);
            if (bens.length === 0) {
              beneficiaryMap['Whole Family'] = (beneficiaryMap['Whole Family'] || 0) + amt;
            } else {
              const splitAmt = amt / bens.length;
              bens.forEach(b => {
                beneficiaryMap[b] = (beneficiaryMap[b] || 0) + splitAmt;
              });
            }
          }

          const cat = String(t.Category || 'Other').trim();
          categoryMap[cat] = (categoryMap[cat] || 0) + amt;

          const acc = String(t['Account/Card'] || 'Main Account').trim();
          accountMap[acc] = (accountMap[acc] || 0) + amt;
        }
      }
    });

    const toSortedList = (map) => {
      const total = Object.values(map).reduce((a, b) => a + b, 0);
      return Object.entries(map)
        .map(([name, amount]) => ({
          name,
          amount,
          percent: total > 0 ? (amount / total) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);
    };

    return {
      beneficiary: toSortedList(beneficiaryMap),
      category: toSortedList(categoryMap),
      account: toSortedList(accountMap)
    };
  }, [txns, selectedMonth]);

  const filteredTxns = useMemo(() => {
    return txns.filter(txn => {
      // Month filter
      if (selectedMonth !== 'ALL') {
        const k = getMonthKeyFromDate(txn.Date);
        if (k !== selectedMonth) return false;
      }

      // Beneficiary filter (supports multiple comma-separated tagged members)
      if (beneficiaryFilter) {
        const rawBen = String(txn.Beneficiary || '').trim();
        const bens = rawBen ? rawBen.split(',').map(b => b.trim()).filter(Boolean) : [];
        if (beneficiaryFilter === 'Whole Family') {
          if (bens.length > 0 && !bens.includes('Whole Family')) return false;
        } else {
          if (!bens.includes(beneficiaryFilter)) return false;
        }
      }

      // Category filter
      if (filterType !== 'All Records') {
        if (txn.Category !== filterType) return false;
      }

      // Search query
      const searchStr = `${txn['Merchant/Description'] || ''} ${txn.Category || ''} ${txn['Account/Card'] || ''} ${txn.Tags || ''} ${txn.Beneficiary || ''}`.toLowerCase();
      if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) return false;

      return true;
    }).sort((a, b) => new Date(b.Date || 0) - new Date(a.Date || 0));
  }, [txns, searchQuery, filterType, beneficiaryFilter, selectedMonth]);

  const groupedTxns = useMemo(() => {
    const groups = {};
    filteredTxns.forEach(txn => {
      let dateKey = 'Unknown Date';
      if (txn.Date) {
        let d = new Date(txn.Date);
        if (isNaN(d.getTime())) {
          const dmyMatch = String(txn.Date).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          if (dmyMatch) {
            d = new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`);
          }
        }
        if (!isNaN(d.getTime())) {
          dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(txn);
    });
    return Object.keys(groups).map(date => ({ date, events: groups[date] }));
  }, [filteredTxns]);

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
          className="bg-surface-layer1/50 border border-dashed border-border-prominent rounded-xl p-3 sm:p-3.5 relative cursor-pointer hover:border-primary-accent/50 transition-colors group"
        >
          <div className="flex items-start justify-between gap-2.5 min-w-0">
            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-layer2 border border-border-subtle flex items-center justify-center text-text-secondary shrink-0 mt-0.5">
                <ArrowRightLeft size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-typ-body-sm sm:text-typ-body font-semibold text-text-primary group-hover:text-primary-accent transition-colors break-words line-clamp-2 leading-snug">
                    {txn['Merchant/Description'] || 'Internal Transfer'}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-typ-caption bg-surface-layer2 text-text-secondary border border-border-subtle shrink-0 font-medium">
                    <CheckCircle size={11} className="text-wealth-emerald" />
                    <span>Transfer</span>
                  </span>
                </div>
                <p className="text-typ-footnote sm:text-typ-label text-text-muted mt-1 leading-relaxed truncate">
                  {txn['Account/Card'] ? `${txn['Account/Card']} • ` : ''}Excluded from spends calculation.
                </p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end shrink-0 pl-1">
              <span className="text-typ-body-sm sm:text-typ-body font-bold text-text-secondary tabular-nums whitespace-nowrap">
                {formatCurrency(txn.Amount)}
              </span>
              <span className="block text-typ-caption sm:text-typ-label text-text-muted mt-0.5 font-medium">Excluded</span>
              <span className="text-primary-accent/70 text-typ-footnote mt-1 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">Edit</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        key={txn['Txn ID']} 
        onClick={() => openEditModal(txn)}
        className="bg-surface-layer1 border border-border-subtle rounded-xl p-3 sm:p-3.5 hover:border-primary-accent/50 cursor-pointer transition-colors group shadow-sm"
      >
        <div className="flex items-start justify-between gap-2.5 min-w-0">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-layer2 border border-border-subtle flex items-center justify-center shrink-0 mt-0.5 ${isIncome ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
              {isIncome ? <ArrowDownLeft size={18} className="sm:w-5 sm:h-5" /> : (String(txn['Account/Card']||'').toLowerCase().includes('cash') ? <Banknote size={18} className="sm:w-5 sm:h-5" /> : <CreditCard size={18} className="sm:w-5 sm:h-5" />)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-typ-body-sm sm:text-typ-body font-semibold text-text-primary group-hover:text-primary-accent transition-colors break-words line-clamp-2 leading-snug">
                  {txn['Merchant/Description'] || txn.Category}
                </h3>
                {hasSplits ? (
                  <span className="px-2 py-0.5 rounded-full text-typ-caption sm:text-typ-label bg-primary-accent/10 text-primary-accent border border-primary-accent/20 shrink-0 font-medium">
                    Split ({splits.length})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-typ-caption bg-surface-layer2 text-text-secondary border border-border-subtle shrink-0">
                    {txn.Category}
                  </span>
                )}
              </div>
              <p className="text-typ-footnote sm:text-typ-label text-text-secondary mt-0.5 truncate">
                {txn['Account/Card'] || 'Main Account'}
                {txn.Beneficiary && txn.Beneficiary !== 'Whole Family' && ` • For: ${txn.Beneficiary}`}
              </p>
              {txn.Tags && (
                <p className="text-typ-caption sm:text-typ-footnote text-text-muted mt-0.5 truncate">{txn.Tags}</p>
              )}
            </div>
          </div>
          <div className="text-right flex flex-col items-end shrink-0 pl-1">
            <span className={`text-typ-body-sm sm:text-typ-body font-bold tabular-nums whitespace-nowrap ${isIncome ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
              {isIncome ? '+' : '-'}{formatCurrency(txn.Amount)}
            </span>
            <span className="text-primary-accent/70 text-typ-footnote mt-1 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">Edit</span>
          </div>
        </div>
        {hasSplits && splits.length > 0 && (
          <div className="ml-4 mt-2.5 pl-3 border-l-2 border-primary-accent/40 space-y-1.5 bg-surface-layer2/50 p-2.5 rounded-r-lg">
            {splits.map((split, idx) => (
              <div key={idx} className="flex items-center justify-between text-typ-label sm:text-typ-body-sm gap-2">
                <div className="flex items-center space-x-1.5 text-text-primary min-w-0 flex-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-accent shrink-0"></span>
                  <span className="truncate">{split.Category}</span>
                </div>
                <span className="tabular-nums font-semibold text-text-primary shrink-0 whitespace-nowrap">{formatCurrency(split.Amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-typ-title font-bold tracking-tight text-text-primary">Cashflow & Spends</h2>
          <div className="flex items-center flex-wrap gap-2 mt-1">
            <span className="text-typ-footnote text-text-muted">
              {selectedMonth === 'ALL' ? 'All-Time Outflow Analysis' : `Tracking for ${formatMonthName(selectedMonth)}`}
            </span>
            <span className="text-text-muted text-typ-caption">•</span>
            <button
              type="button"
              onClick={() => setSelectedMonth(selectedMonth === 'ALL' ? (availableMonths[0] || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`) : 'ALL')}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-typ-footnote font-medium border transition-all active:scale-95 ${
                selectedMonth === 'ALL'
                  ? 'bg-primary-accent text-white border-primary-accent shadow-xs'
                  : 'bg-surface-layer1 text-text-secondary hover:text-text-primary border-border-subtle shadow-xs'
              }`}
            >
              {selectedMonth === 'ALL' ? 'Switch to Monthly' : 'View All-Time'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            type="button"
            onClick={() => setShowSmsInbox(true)} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-layer1 hover:bg-surface-layer2 text-text-primary border border-border-subtle rounded-lg text-typ-label font-semibold shadow-xs transition-all active:scale-95"
            title="Scan SMS backups from Google Drive or upload XML"
          >
            <Cloud size={14} className="text-primary-accent" />
            <span>SMS Inbox</span>
          </button>
          <button 
            type="button"
            onClick={openAddModal} 
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-accent hover:bg-primary-accent/90 text-white rounded-lg text-typ-label font-semibold shadow-md shadow-primary-accent/20 transition-all active:scale-95"
          >
            <Plus size={14} />
            <span>Log Spend</span>
          </button>
        </div>
      </div>

      {/* Month Navigator Sub-bar */}
      {selectedMonth !== 'ALL' && (
        <div className="flex items-center justify-between bg-surface-layer1 border border-border-subtle rounded-xl px-3 py-1.5 shadow-xs">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={currentMonthIndex >= availableMonths.length - 1}
            className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Previous Month"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center space-x-1.5 text-text-primary">
            <Calendar size={14} className="text-primary-accent" />
            <span className="text-typ-label font-bold tracking-wide">
              {formatMonthName(selectedMonth)}
            </span>
            {daysElapsed > 0 && totalDaysInMonth > 0 && (
              <span className="text-typ-caption text-text-muted">
                ({daysElapsed}/{totalDaysInMonth}d)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            disabled={currentMonthIndex <= 0}
            className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Next Month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Hero Spend Cockpit & Burn Matrix */}
      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 relative overflow-hidden shadow-sm">
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-primary-accent/10 rounded-full blur-2xl pointer-events-none"></div>
        
        {/* Top Header: Total Spend & MoM Pill */}
        <div className="flex items-start justify-between pb-3 border-b border-border-subtle">
          <div>
            <span className="text-typ-label text-text-muted uppercase tracking-wider font-medium">
              {selectedMonth === 'ALL' ? 'All-Time Outflow' : `${formatMonthName(selectedMonth)} Outflow`}
            </span>
            <div className="text-typ-heading font-bold text-text-primary tabular-nums mt-0.5">
              {formatCurrency(selectedMonthSpend)}
            </div>
          </div>

          {selectedMonth !== 'ALL' && (
            <div className="flex flex-col items-end">
              {momPct !== null ? (
                <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-typ-label font-semibold border ${
                  momDiff <= 0 
                    ? 'bg-wealth-emerald/10 text-wealth-emerald border-wealth-emerald/20' 
                    : 'bg-liability-rose/10 text-liability-rose border-liability-rose/20'
                }`}>
                  {momDiff <= 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                  <span>
                    {momDiff <= 0 ? '↓ ' : '↑ '}
                    {Math.abs(momPct).toFixed(1)}% vs prev
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-typ-label font-medium bg-surface-layer2 text-text-muted border border-border-subtle">
                  Baseline
                </span>
              )}
              {prevMonthSpend > 0 && (
                <span className="text-typ-caption text-text-muted mt-1 tabular-nums">
                  Prev: {formatCurrency(prevMonthSpend)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3-Metric Subgrid: Daily Burn, Projected Pace, Volume */}
        <div className="grid grid-cols-3 gap-2 pt-3 pb-2 text-left">
          <div className="flex flex-col">
            <span className="text-typ-footnote text-text-muted flex items-center gap-1">
              <Flame size={12} className="text-bullion-amber" /> Daily Burn
            </span>
            <span className="text-typ-body font-bold text-bullion-amber tabular-nums mt-0.5">
              {formatCurrency(dailyBurn)}
              <span className="text-typ-caption font-normal text-text-muted">/d</span>
            </span>
          </div>
          <div className="flex flex-col border-l border-border-subtle pl-2.5">
            <span className="text-typ-footnote text-text-muted">Projected Pace</span>
            <span className="text-typ-body font-bold text-text-primary tabular-nums mt-0.5">
              {formatCurrency(projectedSpend)}
            </span>
          </div>
          <div className="flex flex-col border-l border-border-subtle pl-2.5">
            <span className="text-typ-footnote text-text-muted">Volume</span>
            <span className="text-typ-body font-bold text-primary-accent tabular-nums mt-0.5">
              {txnMonthCount} <span className="text-typ-caption font-normal text-text-muted">txns</span>
            </span>
          </div>
        </div>

        {/* 6-Month Spend Trend Sparkline */}
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center justify-between text-typ-footnote text-text-muted mb-2">
            <span className="font-medium flex items-center gap-1">
              <Calendar size={12} /> 6-Month Spend Trajectory
            </span>
            <span className="text-typ-caption">Tap bar to view</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 items-end h-14">
            {recent6Months.map(m => {
              const isSelected = m.key === selectedMonth;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMonth(m.key)}
                  className={`flex flex-col items-center justify-end h-full rounded-md p-1 transition-all ${
                    isSelected 
                      ? 'bg-primary-accent/15 border border-primary-accent/40' 
                      : 'hover:bg-surface-layer2 border border-transparent'
                  }`}
                  title={`${m.label}: ${formatCurrency(m.amount)}`}
                >
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div 
                      className={`w-full max-w-[16px] rounded-t transition-all ${
                        isSelected 
                          ? 'bg-primary-accent shadow-sm shadow-primary-accent/50' 
                          : m.amount > 0 ? 'bg-slate-300 dark:bg-surface-layer2 hover:bg-slate-400 dark:hover:bg-border-prominent' : 'bg-slate-100 dark:bg-surface-layer2/50'
                      }`}
                      style={{ height: `${Math.max(m.percent, 8)}%` }}
                    ></div>
                  </div>
                  <span className={`text-typ-caption mt-1 font-medium ${
                    isSelected ? 'text-primary-accent font-bold' : 'text-text-muted'
                  }`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Segmented Top Spends Drawer */}
        <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex gap-1 bg-surface-layer2 p-0.5 rounded-lg border border-border-subtle shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSegment('beneficiary')}
                className={`px-2 sm:px-2.5 py-1 text-typ-footnote sm:text-typ-label font-medium rounded-md transition-all flex items-center gap-1 ${
                  selectedSegment === 'beneficiary'
                    ? 'bg-primary-accent text-white shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Users size={12} /> Beneficiary
              </button>
              <button
                type="button"
                onClick={() => setSelectedSegment('category')}
                className={`px-2 sm:px-2.5 py-1 text-typ-footnote sm:text-typ-label font-medium rounded-md transition-all flex items-center gap-1 ${
                  selectedSegment === 'category'
                    ? 'bg-primary-accent text-white shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <PieChart size={12} /> Category
              </button>
              <button
                type="button"
                onClick={() => setSelectedSegment('account')}
                className={`px-2 sm:px-2.5 py-1 text-typ-footnote sm:text-typ-label font-medium rounded-md transition-all flex items-center gap-1 ${
                  selectedSegment === 'account'
                    ? 'bg-primary-accent text-white shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Wallet size={12} /> Card/Bank
              </button>
            </div>
            <span className="text-typ-caption text-text-muted shrink-0 pl-3 sm:pl-4 whitespace-nowrap">Tap to filter</span>
          </div>

          {/* Active Segment Breakdown List */}
          <div className="space-y-1.5 pt-1">
            {breakdownData[selectedSegment].length === 0 ? (
              <p className="text-typ-label text-text-muted py-2 text-center">No spend data in this view.</p>
            ) : (
              breakdownData[selectedSegment].slice(0, 4).map((item) => {
                const isFilterActive = (selectedSegment === 'beneficiary' && beneficiaryFilter === item.name) ||
                                       (selectedSegment === 'category' && filterType === item.name);
                return (
                  <div
                    key={item.name}
                    onClick={() => {
                      if (selectedSegment === 'beneficiary') {
                        setBeneficiaryFilter(beneficiaryFilter === item.name ? '' : item.name);
                      } else if (selectedSegment === 'category') {
                        setFilterType(filterType === item.name ? 'All Records' : item.name);
                      }
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      isFilterActive 
                        ? 'bg-primary-accent/15 border border-primary-accent/40' 
                        : 'bg-surface-layer2/60 hover:bg-surface-layer2 border border-border-subtle/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-typ-label mb-1">
                      <span className="font-medium text-text-primary truncate max-w-[180px] flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isFilterActive ? 'bg-primary-accent' : 'bg-text-secondary'}`}></span>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold tabular-nums text-text-primary">{formatCurrency(item.amount)}</span>
                        <span className="text-typ-caption text-text-muted tabular-nums w-8 text-right">{item.percent.toFixed(0)}%</span>
                      </div>
                    </div>
                    {/* Horizontal Mini Bar */}
                    <div className="w-full h-1 bg-surface-layer2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary-accent rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(3, item.percent))}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
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
                <h2 className="text-typ-body-sm font-semibold text-text-primary">{pendingVerifications.length} Verifications Pending</h2>
              </div>
            </div>
            <Badge variant="amber" dot size="sm">Action Required</Badge>
          </div>
          {pendingVerifications.map(txn => (
            <div key={txn['Txn ID']} className="mt-3 bg-surface-layer2/80 rounded-lg p-3 border border-border-subtle">
              <div className="flex items-start justify-between gap-2.5 min-w-0">
                <div className="min-w-0 flex-1">
                  <h4 className="text-typ-body-sm text-text-primary font-medium break-words line-clamp-2 leading-snug">{txn['Merchant/Description'] || txn.Category}</h4>
                  <p className="text-typ-label text-text-secondary truncate mt-0.5">{txn.Date} • {txn['Account/Card']}</p>
                </div>
                <span className="text-typ-body-sm font-bold text-liability-rose tabular-nums shrink-0 whitespace-nowrap pl-1">-{formatCurrency(txn.Amount)}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button className="px-2 py-1 text-typ-label bg-surface-layer1 hover:bg-border-prominent rounded border border-border-subtle text-text-primary">Categorize</button>
                <button className="px-2 py-1 text-typ-label bg-surface-layer1 hover:bg-border-prominent rounded border border-border-subtle text-text-primary">Split</button>
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
              className="w-full bg-surface-layer1 border border-border-subtle focus:border-primary-accent focus:ring-0 rounded-lg pl-9 pr-3 py-2 text-typ-body-sm text-text-primary placeholder:text-text-muted outline-none" 
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
                className={`px-3 py-1 rounded-full text-typ-label font-medium whitespace-nowrap flex-shrink-0 transition-colors ${filterType === tab ? 'bg-primary-accent text-white shadow-sm font-semibold' : 'bg-surface-layer1 hover:bg-surface-layer2 text-text-secondary hover:text-text-primary border border-border-subtle shadow-xs'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Active Filter Chips */}
          {(beneficiaryFilter || filterType !== 'All Records' || selectedMonth !== 'ALL') && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-typ-label">
              <span className="text-text-muted text-typ-footnote">Filtered:</span>
              {selectedMonth !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-layer2 border border-border-subtle text-text-secondary text-typ-footnote">
                  <span>{formatMonthName(selectedMonth)}</span>
                  <button type="button" onClick={() => setSelectedMonth('ALL')} className="hover:text-text-primary transition-colors" title="Remove month filter"><X size={10} /></button>
                </span>
              )}
              {beneficiaryFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-accent/15 border border-primary-accent/40 text-primary-accent text-typ-footnote font-medium">
                  <span>For: {beneficiaryFilter}</span>
                  <button type="button" onClick={() => setBeneficiaryFilter('')} className="hover:text-text-primary transition-colors" title="Remove beneficiary filter"><X size={10} /></button>
                </span>
              )}
              {filterType !== 'All Records' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-accent/15 border border-primary-accent/40 text-primary-accent text-typ-footnote font-medium">
                  <span>Cat: {filterType}</span>
                  <button type="button" onClick={() => setFilterType('All Records')} className="hover:text-text-primary transition-colors" title="Remove category filter"><X size={10} /></button>
                </span>
              )}
              <button 
                type="button"
                onClick={() => {
                  setBeneficiaryFilter('');
                  setFilterType('All Records');
                  setSelectedMonth('ALL');
                }}
                className="text-typ-footnote text-text-muted hover:text-text-primary underline ml-1 transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Grouped Transactions */}
        {groupedTxns.length === 0 ? (
          <p className="text-center text-text-muted py-8 text-typ-body-sm">No transactions found.</p>
        ) : (
          groupedTxns.map(group => (
            <div key={group.date} className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-typ-label text-text-muted uppercase tracking-wider px-1">
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
        <div className="fixed inset-0 z-50 no-swipe flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4" onClick={() => setShowLogModal(false)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
             {/* Pinned Modal Header */}
             <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-layer1 flex-shrink-0">
               <div>
                 <h3 className="text-typ-body sm:text-typ-subtitle font-bold text-text-primary leading-tight">
                   {editingTxnId ? 'Edit Transaction' : 'Log Transaction'}
                 </h3>
                 <p className="text-typ-footnote text-text-muted mt-0.5">
                   Record expense or income against family ledger
                 </p>
               </div>
               <button 
                 type="button" 
                 onClick={() => setShowLogModal(false)}
                 className="text-text-muted hover:text-text-primary p-1.5 hover:bg-surface-layer2 rounded-lg transition-colors"
                 title="Close"
               >
                 <X size={18} />
               </button>
             </div>

             <form onSubmit={handleSaveTxn} className="flex flex-col flex-1 min-h-0 overflow-hidden">
               {/* Scrollable Form Body */}
               <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
                 <div className="flex gap-2">
                   <div className="flex-1">
                     <label className="block text-typ-label text-text-secondary mb-1">Type</label>
                     <select value={newTxn.Type} onChange={e => setNewTxn({...newTxn, Type: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent outline-none">
                       <option>Expense</option>
                       <option>Income</option>
                     </select>
                   </div>
                   <div className="flex-1">
                     <label className="block text-typ-label text-text-secondary mb-1">Date</label>
                     <input required value={newTxn.Date} onChange={e => setNewTxn({...newTxn, Date: e.target.value})} type="date" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent outline-none" />
                   </div>
                 </div>
                 <div>
                   <label className="block text-typ-label text-text-secondary mb-1">Merchant / Description</label>
                   <input required value={newTxn['Merchant/Description']} onChange={e => setNewTxn({...newTxn, 'Merchant/Description': e.target.value})} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent outline-none" placeholder="e.g. Swiggy" />
                 </div>
                 <div>
                   <div className="flex items-center justify-between mb-1.5">
                     <label className="block text-typ-label text-text-secondary">For Whom (Beneficiaries)</label>
                     <span className="text-typ-caption text-text-muted">
                       {selectedBeneficiaries.length === 0
                         ? 'Whole Family'
                         : selectedBeneficiaries.length === 1
                         ? '1 member'
                         : `Equal split (${selectedBeneficiaries.length} members)`}
                     </span>
                   </div>
                   <div className="flex flex-wrap gap-1.5 p-2 bg-surface-layer2/50 border border-border-subtle rounded-lg">
                     <button
                       type="button"
                       onClick={() => setNewTxn({ ...newTxn, Beneficiary: '' })}
                       className={`px-2.5 py-1 rounded-md text-typ-caption font-medium transition-all ${
                         selectedBeneficiaries.length === 0
                           ? 'bg-primary-accent text-white shadow-xs font-semibold'
                           : 'bg-surface-layer2 text-text-secondary hover:text-text-primary hover:bg-surface-layer1 border border-border-subtle'
                       }`}
                     >
                       Whole Family
                     </button>
                     {profiles.map((p) => {
                       const isSelected = selectedBeneficiaries.includes(p.Name);
                       return (
                         <button
                           key={p.Name}
                           type="button"
                           onClick={() => {
                             let next;
                             if (isSelected) {
                               next = selectedBeneficiaries.filter((name) => name !== p.Name);
                             } else {
                               next = [...selectedBeneficiaries, p.Name];
                             }
                             setNewTxn({ ...newTxn, Beneficiary: next.join(', ') });
                           }}
                           className={`px-2.5 py-1 rounded-md text-typ-caption font-medium transition-all flex items-center gap-1 ${
                             isSelected
                               ? 'bg-primary-accent text-white shadow-xs font-semibold'
                               : 'bg-surface-layer2 text-text-secondary hover:text-text-primary hover:bg-surface-layer1 border border-border-subtle'
                           }`}
                         >
                           {p.Name}
                         </button>
                       );
                     })}
                     {/* Preserve any custom beneficiaries from existing record not in profiles list */}
                     {selectedBeneficiaries
                       .filter((b) => !profiles.some((p) => p.Name === b))
                       .map((customName) => (
                         <button
                           key={customName}
                           type="button"
                           onClick={() => {
                             const next = selectedBeneficiaries.filter((name) => name !== customName);
                             setNewTxn({ ...newTxn, Beneficiary: next.join(', ') });
                           }}
                           className="px-2.5 py-1 rounded-md text-typ-caption font-semibold bg-primary-accent text-white shadow-xs flex items-center gap-1"
                         >
                           {customName}
                         </button>
                       ))}
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <div className="flex-1">
                     <label className="block text-typ-label text-text-secondary mb-1">Category</label>
                     <select value={newTxn.Category || categoriesList[0] || ''} onChange={e => setNewTxn({...newTxn, Category: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent outline-none">
                       {newTxn.Category && !categoriesList.includes(newTxn.Category) && (
                         <option key={newTxn.Category} value={newTxn.Category}>{newTxn.Category}</option>
                       )}
                       {categoriesList.map(cat => (
                         <option key={cat} value={cat}>{cat}</option>
                       ))}
                     </select>
                   </div>
                   <div className="flex-1">
                     <label className="block text-typ-label text-text-secondary mb-1">Amount (₹)</label>
                     <input required value={newTxn.Amount} onChange={e => setNewTxn({...newTxn, Amount: e.target.value})} type="number" step="0.01" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent outline-none" placeholder="1000" />
                   </div>
                 </div>
                 <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="isTransfer" checked={newTxn['Is Transfer']} onChange={e => setNewTxn({...newTxn, 'Is Transfer': e.target.checked})} className="rounded bg-surface-layer2 border-border-subtle text-primary-accent focus:ring-0" />
                    <label htmlFor="isTransfer" className="text-typ-label text-text-secondary">Mark as Internal Transfer</label>
                 </div>
               </div>

               {/* Pinned Action Footer */}
               <div className="p-4 border-t border-border-subtle bg-surface-layer1 flex-shrink-0 flex flex-col gap-2.5">
                 <div className="flex gap-3">
                   <button type="button" onClick={() => setShowLogModal(false)} className="flex-1 px-4 py-2 bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle text-text-primary rounded-lg text-typ-body-sm font-medium transition-colors">Cancel</button>
                   <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-primary-accent hover:bg-primary-accent/90 text-white rounded-lg text-typ-body-sm font-medium shadow-md shadow-primary-accent/20 transition-all active:scale-95 disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save'}</button>
                 </div>
                 {editingTxnId && (
                   <button type="button" onClick={() => handleDelete(editingTxnId)} disabled={isSubmitting} className="w-full px-4 py-2 bg-liability-rose/10 text-liability-rose border border-liability-rose/20 rounded-lg text-typ-body-sm font-medium hover:bg-liability-rose/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                     <Trash2 size={14} />
                     <span>{isSubmitting ? 'Deleting...' : 'Delete Transaction'}</span>
                   </button>
                 )}
               </div>
             </form>
           </div>
        </div>
      )}

      {/* SMS Expense & Transfer Review Inbox Modal */}
      <SmsInboxModal
        isOpen={showSmsInbox}
        onClose={() => setShowSmsInbox(false)}
        data={data}
        formatCurrency={formatCurrency}
        showMessage={showMessage}
        onRefresh={onRefresh}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
