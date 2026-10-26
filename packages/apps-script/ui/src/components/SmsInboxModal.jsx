import React, { useState, useEffect, useMemo, useRef } from 'react';
import useModalBack from '../hooks/useModalBack';
import { 
  ArrowLeft, Cloud, RefreshCw, Upload, Check, X, Shield, 
  ArrowRightLeft, TrendingDown, Landmark, Sparkles, Filter, 
  Settings, CheckSquare, Square, ChevronDown, ChevronRight,
  Eye, FileText, AlertCircle, AlertTriangle, Trash2, CheckCircle2,
  Edit2, SlidersHorizontal
} from 'lucide-react';
import { Badge } from './Badge';
import { parseSmsXml, extractFinancialCandidate, deduplicateAndClassify } from '../utils/smsParser';

export default function SmsInboxModal({
  isOpen,
  onClose,
  data,
  formatCurrency,
  showMessage,
  onRefresh
}) {
  useModalBack(isOpen, onClose);

  // Settings from global app data
  const settings = data?.settings || [];
  const existingTransactions = data?.transactions || [];
  const existingAssets = data?.assets || [];
  const familyProfiles = data?.familyProfiles || [];

  const defaultFolderName = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'SmsDriveFolder');
    return s ? s['Setting Value'] : 'SMSBackupRestore';
  }, [settings]);

  const lastProcessedEpoch = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'SmsLastProcessedDate');
    return s && s['Setting Value'] ? parseInt(s['Setting Value'], 10) : 0;
  }, [settings]);

  // Component state
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({
    totalCandidates: 0,
    pendingCount: 0,
    totalPendingAmount: 0,
    transfersCount: 0,
    totalTransferAmount: 0,
    investmentsCount: 0,
    totalInvestmentAmount: 0,
    duplicatesFiltered: 0
  });

  const [activeFilter, setActiveFilter] = useState('all'); // all | spends | transfers | investments | high_value
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [driveFolder, setDriveFolder] = useState(defaultFolderName);
  const [latestFileName, setLatestFileName] = useState('');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [showRawSmsId, setShowRawSmsId] = useState(null);

  const fileInputRef = useRef(null);

  // Sync folder name state when default changes
  useEffect(() => {
    setDriveFolder(defaultFolderName);
  }, [defaultFolderName]);

  // Process raw XML string into candidate records
  const processXmlContent = (xmlString, sourceFileName = '') => {
    try {
      const rawSmsList = parseSmsXml(xmlString);
      if (!rawSmsList || rawSmsList.length === 0) {
        showMessage?.('No SMS messages found in the provided file.', true);
        return;
      }

      // Extract candidate transactions
      const rawCandidates = [];
      for (const sms of rawSmsList) {
        const item = extractFinancialCandidate(sms, {
          userName: data?.userInfo?.activeEmail || 'Nozel Rosario',
          existingAssets,
          familyProfiles
        });
        if (item) {
          rawCandidates.push(item);
        }
      }

      // Deduplicate and classify
      const result = deduplicateAndClassify(rawCandidates, existingTransactions, lastProcessedEpoch);
      setCandidates(result.candidates);
      setStats(result.stats);

      // Select all valid candidates by default
      const initialSelected = new Set(result.candidates.map(c => c.id));
      setSelectedIds(initialSelected);

      if (sourceFileName) {
        setLatestFileName(sourceFileName);
      }

      showMessage?.(
        `Loaded ${result.candidates.length} transactions (${result.stats.duplicatesFiltered} duplicates filtered)`
      );
    } catch (err) {
      console.error('Error processing SMS XML:', err);
      showMessage?.('Failed to parse SMS backup file: ' + err.message, true);
    }
  };

  // Google Drive Scan
  const handleScanDrive = () => {
    setIsScanningDrive(true);
    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsScanningDrive(false);
          if (res && res.status === 'success' && res.xmlContent) {
            processXmlContent(res.xmlContent, res.fileName);
          } else if (res && res.status === 'not_found') {
            showMessage?.(res.message || 'Google Drive folder not found.', true);
          } else if (res && res.status === 'no_backups') {
            showMessage?.(res.message || 'No XML backup files found in folder.', true);
          } else {
            showMessage?.(res?.message || 'Error scanning Google Drive.', true);
          }
        })
        .withFailureHandler((err) => {
          setIsScanningDrive(false);
          showMessage?.('Google Drive Scan Error: ' + err.message, true);
        })
        .scanDriveForSmsBackup(driveFolder, token);
    } else {
      setTimeout(() => {
        setIsScanningDrive(false);
        showMessage?.('Preview mode: Please choose or drag an XML file to test.');
      }, 700);
    }
  };

  // Manual File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
      showMessage?.('Please select a valid .xml backup file created by SMS Backup & Restore.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        processXmlContent(content, file.name);
      }
    };
    reader.onerror = () => {
      showMessage?.('Error reading selected file.', true);
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save Drive folder setting
  const handleSaveDriveFolder = (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          if (res?.status === 'success') {
            showMessage?.('Backup folder saved.');
            setShowSettingsDrawer(false);
            onRefresh?.();
          } else {
            showMessage?.(res?.message || 'Failed to save folder setting', true);
          }
        })
        .upsertSetting('SmsDriveFolder', driveFolder.trim(), token);
    } else {
      showMessage?.('Folder updated to ' + driveFolder);
      setShowSettingsDrawer(false);
    }
  };

  // Reset sync watermark
  const handleResetSyncDate = () => {
    if (!window.confirm('Reset sync date to re-scan older messages?')) return;
    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler(() => {
          showMessage?.('Sync date reset.');
          onRefresh?.();
        })
        .upsertSetting('SmsLastProcessedDate', '0', token);
    } else {
      showMessage?.('Sync watermark reset.');
    }
  };

  // Toggle selection for all filtered candidates
  const handleToggleSelectAll = (checked) => {
    if (checked) {
      const newSet = new Set(selectedIds);
      filteredList.forEach(c => newSet.add(c.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      filteredList.forEach(c => newSet.delete(c.id));
      setSelectedIds(newSet);
    }
  };

  const handleToggleSingle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Inline modification of candidate record
  const updateCandidate = (id, updates) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  // Dismiss a candidate
  const handleDismiss = (id) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Dismiss all selected
  const handleBatchDismiss = () => {
    if (selectedIds.size === 0) return;
    setCandidates(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    showMessage?.('Dismissed selected items.');
  };

  // Import single transaction
  const handleImportSingle = (candidate) => {
    handleBatchImport([candidate]);
  };

  // Batch import selected transactions
  const handleBatchImport = (itemsToImport) => {
    const targetItems = itemsToImport || candidates.filter(c => selectedIds.has(c.id));
    if (!targetItems || targetItems.length === 0) {
      showMessage?.('Please select at least one transaction to import.', true);
      return;
    }

    setIsImporting(true);
    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');

    let maxEpoch = lastProcessedEpoch;
    targetItems.forEach(t => {
      if (t.rawDate && t.rawDate > maxEpoch) {
        maxEpoch = t.rawDate;
      }
    });

    const formatted = targetItems.map(item => ({
      'Txn ID': `TXN_SMS_${item.rawDate}_${Math.round(item.amount)}`,
      Date: item.dateStr,
      Type: item.type === 'Transfer' ? 'Transfer' : (item.type === 'Investment' ? 'Investment' : (item.type === 'Income / Refund' ? 'Income' : 'Expense')),
      Amount: item.amount,
      Category: item.category,
      'Account/Card': item.account,
      'Merchant/Description': item.payee,
      Tags: `SMS Ingestion, ${item.bank}`,
      'Is Transfer': item.isTransfer,
      Beneficiary: item.payee,
      'Split JSON': ''
    }));

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsImporting(false);
          if (res?.status === 'success') {
            const importedIds = new Set(targetItems.map(t => t.id));
            setCandidates(prev => prev.filter(c => !importedIds.has(c.id)));
            setSelectedIds(prev => {
              const next = new Set(prev);
              importedIds.forEach(id => next.delete(id));
              return next;
            });
            showMessage?.(`Imported ${res.importedCount} transactions!`);
            onRefresh?.();
          } else {
            showMessage?.(res?.message || 'Error importing transactions', true);
          }
        })
        .withFailureHandler((err) => {
          setIsImporting(false);
          showMessage?.('Import error: ' + err.message, true);
        })
        .batchImportSmsTransactions(formatted, maxEpoch, token);
    } else {
      setTimeout(() => {
        setIsImporting(false);
        const importedIds = new Set(targetItems.map(t => t.id));
        setCandidates(prev => prev.filter(c => !importedIds.has(c.id)));
        showMessage?.(`[Preview] Imported ${targetItems.length} transactions.`);
      }, 400);
    }
  };

  // Filter computation
  const filteredList = useMemo(() => {
    return candidates.filter(item => {
      if (activeFilter === 'spends' && item.type !== 'Spend') return false;
      if (activeFilter === 'transfers' && item.type !== 'Transfer') return false;
      if (activeFilter === 'investments' && item.type !== 'Investment') return false;
      if (activeFilter === 'high_value' && item.amount < 5000) return false;
      return true;
    });
  }, [candidates, activeFilter]);

  const allFilteredSelected = filteredList.length > 0 && filteredList.every(c => selectedIds.has(c.id));

  // Compact currency formatter helper (e.g. ₹12.5k / ₹1.4L)
  const formatCompactVal = (val) => {
    if (!val || val === 0) return '₹0';
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${Math.round(val)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/75 backdrop-blur-md p-1 sm:p-4 select-none">
      <div className="w-full max-w-2xl h-[96vh] sm:h-[92vh] max-h-[880px] rounded-2xl sm:rounded-3xl bg-surface-layer1 border border-border-subtle shadow-2xl flex flex-col overflow-hidden text-text-primary animate-in fade-in zoom-in-95 duration-150">
        
        {/* 1. ULTRA-COMPACT HEADER (Slim ~48px) */}
        <header className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-surface-layer1/90 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-layer2 transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-text-primary truncate">
                SMS Spends Inbox
              </h2>
              <Badge variant="indigo" size="xs">
                {candidates.length}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Quick Drive Scan CTA */}
            <button
              onClick={handleScanDrive}
              disabled={isScanningDrive}
              className="py-1 px-2.5 rounded-lg bg-primary-accent text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
              title="Scan Drive Backup"
            >
              <RefreshCw size={12} className={isScanningDrive ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isScanningDrive ? 'Scanning...' : 'Scan Drive'}</span>
            </button>

            {/* Quick Upload CTA */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-primary text-[11px] font-medium flex items-center gap-1 active:scale-95 transition-all"
              title="Upload XML Backup"
            >
              <Upload size={13} className="text-text-secondary" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-primary-accent hover:bg-surface-layer2 transition-colors"
              title="Settings"
            >
              <Settings size={15} />
            </button>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-layer2 transition-colors"
            >
              <X size={16} />
            </button>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xml"
              className="hidden"
            />
          </div>
        </header>

        {/* 2. Optional Settings Drawer */}
        {showSettingsDrawer && (
          <div className="p-3 bg-surface-layer2 border-b border-border-subtle space-y-2 shrink-0 animate-in slide-in-from-top-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-primary flex items-center gap-1">
                <Settings size={13} className="text-primary-accent" />
                Drive Backup Settings
              </span>
              <button onClick={() => setShowSettingsDrawer(false)} className="text-text-muted hover:text-text-primary text-[11px]">
                Close
              </button>
            </div>
            <form onSubmit={handleSaveDriveFolder} className="flex gap-2">
              <input
                type="text"
                value={driveFolder}
                onChange={(e) => setDriveFolder(e.target.value)}
                placeholder="SMSBackupRestore"
                className="flex-1 text-xs px-2.5 py-1 rounded-lg bg-surface-layer1 border border-border-subtle text-text-primary"
              />
              <button type="submit" className="py-1 px-3 rounded-lg bg-primary-accent text-white font-semibold text-xs">
                Save
              </button>
              <button
                type="button"
                onClick={handleResetSyncDate}
                className="py-1 px-2 rounded-lg border border-border-subtle bg-surface-layer1 text-text-secondary text-xs"
              >
                Reset Date
              </button>
            </form>
          </div>
        )}

        {/* 3. STREAMLINED FILTER PILLS WITH EMBEDDED METRIC COUNTERS (Slim ~36px) */}
        <div className="px-3 py-1.5 border-b border-border-subtle shrink-0 flex items-center justify-between gap-2 bg-surface-layer1/60">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-full font-semibold transition-all whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-primary-accent text-white shadow-xs'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({candidates.length})
            </button>
            <button
              onClick={() => setActiveFilter('spends')}
              className={`px-2.5 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                activeFilter === 'spends'
                  ? 'bg-rose-500/20 text-rose-500 font-bold border border-rose-500/30'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              Spends ({stats.pendingCount} • {formatCompactVal(stats.totalPendingAmount)})
            </button>
            <button
              onClick={() => setActiveFilter('transfers')}
              className={`px-2.5 py-1 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                activeFilter === 'transfers'
                  ? 'bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-bullion-amber"></span>
              Transfers ({stats.transfersCount} • {formatCompactVal(stats.totalTransferAmount)})
            </button>
            <button
              onClick={() => setActiveFilter('investments')}
              className={`px-2.5 py-1 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                activeFilter === 'investments'
                  ? 'bg-emerald-500/20 text-emerald-500 font-bold border border-emerald-500/30'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald"></span>
              Investments ({stats.investmentsCount} • {formatCompactVal(stats.totalInvestmentAmount)})
            </button>
            <button
              onClick={() => setActiveFilter('high_value')}
              className={`px-2.5 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                activeFilter === 'high_value'
                  ? 'bg-primary-accent text-white shadow-xs'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              &gt;₹5k
            </button>
          </div>
        </div>

        {/* 4. COMPACT SELECTION & BATCH ACTIONS SUB-BAR (~28px) */}
        <div className="px-3 py-1 bg-surface-layer2/40 border-b border-border-subtle shrink-0 flex items-center justify-between text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary font-medium select-none">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={(e) => handleToggleSelectAll(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary-accent border-border-prominent focus:ring-0 bg-surface-layer1"
            />
            <span>Select All ({selectedIds.size}/{filteredList.length})</span>
          </label>

          <div className="flex items-center gap-2">
            {stats.duplicatesFiltered > 0 && (
              <span className="hidden sm:inline text-text-muted text-[10px]">
                🛡️ {stats.duplicatesFiltered} duplicates blocked
              </span>
            )}
            <button
              onClick={() => handleBatchImport()}
              disabled={selectedIds.size === 0 || isImporting}
              className="py-0.5 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 font-semibold active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1"
            >
              <Check size={12} />
              <span>Import ({selectedIds.size})</span>
            </button>
            <button
              onClick={handleBatchDismiss}
              disabled={selectedIds.size === 0}
              className="text-text-muted hover:text-liability-rose transition-colors disabled:opacity-40"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* 5. EXPANSIVE SCROLLABLE TRANSACTIONS LIST (Takes 80%+ of Viewport) */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 bg-bg-root">
          {filteredList.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-text-muted space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-surface-layer2 flex items-center justify-center text-emerald-500">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Inbox Clean</h3>
                <p className="text-xs text-text-muted max-w-xs mt-0.5">
                  No pending SMS transactions. Tap "Scan Drive" or upload an XML backup to detect spends.
                </p>
              </div>
              <button
                onClick={handleScanDrive}
                className="py-1.5 px-3.5 rounded-xl bg-primary-accent text-white text-xs font-semibold hover:opacity-95 shadow-xs transition-all"
              >
                Scan Google Drive Now
              </button>
            </div>
          ) : (
            filteredList.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isExpanded = expandedCardId === item.id;
              const isRawOpen = showRawSmsId === item.id;

              return (
                <article
                  key={item.id}
                  className={`rounded-xl p-2.5 sm:p-3 bg-surface-layer1 border transition-all duration-150 shadow-xs ${
                    isSelected ? 'border-primary-accent/40 bg-surface-layer1' : 'border-border-subtle/80 opacity-95'
                  }`}
                >
                  {/* COMPACT MAIN ROW (~45px) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSingle(item.id)}
                        className="w-4 h-4 rounded text-primary-accent border-border-prominent bg-surface-layer1 focus:ring-0 shrink-0"
                      />

                      {/* Payee + Bank Pill */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-text-primary truncate max-w-[150px] sm:max-w-[240px]">
                            {item.payee}
                          </span>
                          <span className="text-[10px] text-text-muted bg-surface-layer2 px-1.5 py-0.2 rounded font-mono shrink-0">
                            {item.bank} {item.accountDigits ? `••${item.accountDigits}` : ''}
                          </span>
                        </div>

                        {/* Date + Tags Line */}
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary mt-0.5">
                          <span className="text-text-muted num-tabular">{item.dateStr}</span>
                          <span className="text-text-muted">•</span>
                          {item.type === 'Transfer' ? (
                            <span className="text-bullion-amber font-semibold">Transfer</span>
                          ) : item.type === 'Investment' ? (
                            <span className="text-wealth-emerald font-semibold">Investment</span>
                          ) : (
                            <span>{item.category}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount + Quick Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`text-sm sm:text-base font-bold num-tabular text-right ${
                          item.type === 'Transfer'
                            ? 'text-bullion-amber'
                            : item.type === 'Investment' || item.type === 'Income / Refund'
                            ? 'text-wealth-emerald'
                            : 'text-liability-rose'
                        }`}
                      >
                        {item.type === 'Income / Refund' ? '+' : item.type === 'Transfer' ? '' : '-'}
                        {formatCurrency ? formatCurrency(item.amount) : `₹${item.amount.toLocaleString('en-IN')}`}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleImportSingle(item)}
                        className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 flex items-center justify-center transition-all active:scale-90"
                        title="Confirm & Import"
                      >
                        <Check size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedCardId(isExpanded ? null : item.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          isExpanded ? 'bg-primary-accent/15 text-primary-accent' : 'text-text-muted hover:bg-surface-layer2'
                        }`}
                        title="Edit / Details"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDismiss(item.id)}
                        className="w-7 h-7 rounded-lg text-text-muted hover:text-liability-rose hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                        title="Dismiss"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* INLINE EXPANDED EDITING CONTROLS (Only visible when Edit/Details tapped) */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-border-subtle/60 space-y-2.5 text-xs animate-in slide-in-from-top-1">
                      {/* Classification Switcher */}
                      <div className="p-0.5 rounded-lg bg-surface-layer2 flex text-center text-[11px] font-medium">
                        <button
                          type="button"
                          onClick={() =>
                            updateCandidate(item.id, {
                              type: 'Spend',
                              isTransfer: false,
                              category: item.category === 'Internal Transfer' ? 'General Expense' : item.category
                            })
                          }
                          className={`flex-1 py-1 rounded-md transition-all ${
                            item.type === 'Spend'
                              ? 'bg-surface-layer1 shadow-xs text-liability-rose font-bold'
                              : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          Spend
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateCandidate(item.id, {
                              type: 'Transfer',
                              isTransfer: true,
                              category: 'Internal Transfer'
                            })
                          }
                          className={`flex-1 py-1 rounded-md transition-all ${
                            item.type === 'Transfer'
                              ? 'bg-surface-layer1 shadow-xs text-bullion-amber font-bold'
                              : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateCandidate(item.id, {
                              type: 'Investment',
                              isTransfer: false,
                              category: 'Investment / Insurance'
                            })
                          }
                          className={`flex-1 py-1 rounded-md transition-all ${
                            item.type === 'Investment'
                              ? 'bg-surface-layer1 shadow-xs text-wealth-emerald font-bold'
                              : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          Investment
                        </button>
                      </div>

                      {/* Payee, Category & Account Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <label className="text-[10px] text-text-muted block mb-0.5">Payee / Merchant:</label>
                          <input
                            type="text"
                            value={item.payee}
                            onChange={(e) => updateCandidate(item.id, { payee: e.target.value })}
                            className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-2 py-1 text-text-primary font-medium focus:ring-1 focus:ring-primary-accent"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-text-muted block mb-0.5">Category:</label>
                          <select
                            value={item.category}
                            onChange={(e) => updateCandidate(item.id, { category: e.target.value })}
                            className="w-full bg-surface-layer2 border border-border-subtle rounded-lg py-1 px-2 text-text-primary font-medium focus:ring-1 focus:ring-primary-accent"
                          >
                            <option value="Groceries">Groceries</option>
                            <option value="Dining & Food">Dining & Food</option>
                            <option value="Shopping">Shopping</option>
                            <option value="Utilities">Utilities & Bills</option>
                            <option value="Travel & Fuel">Travel & Fuel</option>
                            <option value="Healthcare">Healthcare</option>
                            <option value="Internal Transfer">Internal Transfer</option>
                            <option value="Investment / Insurance">Investment / Insurance</option>
                            <option value="General Expense">General Expense</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-text-muted block mb-0.5">Asset Account:</label>
                          <select
                            value={item.account}
                            onChange={(e) => updateCandidate(item.id, { account: e.target.value })}
                            className="w-full bg-surface-layer2 border border-border-subtle rounded-lg py-1 px-2 text-text-primary font-medium focus:ring-1 focus:ring-primary-accent"
                          >
                            <option value={item.account}>{item.account}</option>
                            {existingAssets.map((asset) => (
                              <option key={asset['Asset ID']} value={asset.Name}>
                                {asset.Name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Raw SMS Snippet Toggle */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowRawSmsId(isRawOpen ? null : item.id)}
                          className="text-[10px] text-text-muted hover:text-primary-accent flex items-center gap-1"
                        >
                          <ChevronRight size={11} className={`transition-transform ${isRawOpen ? 'rotate-90' : ''}`} />
                          <span>{isRawOpen ? 'Hide raw message' : 'View raw SMS text'}</span>
                        </button>
                        {isRawOpen && (
                          <div className="mt-1 p-2 rounded-lg bg-surface-layer2 font-mono text-[9px] text-text-secondary leading-relaxed border border-border-subtle/60">
                            {item.body}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* 6. COMPACT BOTTOM FOOTER (~44px) */}
        <footer className="px-3 py-2 sm:px-4 sm:py-2.5 border-t border-border-subtle shrink-0 flex items-center justify-between bg-surface-layer1 text-xs">
          <div className="text-text-muted text-[11px] flex items-center gap-1">
            <Shield size={12} className="text-emerald-500" />
            <span className="hidden sm:inline">On-Device Parsing • Zero Credentials Stored</span>
            <span className="sm:hidden">{selectedIds.size} selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-1 px-3 rounded-lg border border-border-subtle text-text-secondary hover:bg-surface-layer2 transition-colors text-xs font-medium"
            >
              Close
            </button>
            <button
              onClick={() => handleBatchImport()}
              disabled={selectedIds.size === 0 || isImporting}
              className="py-1 px-3.5 rounded-lg bg-primary-accent text-white font-semibold hover:opacity-95 shadow-xs transition-all disabled:opacity-40 flex items-center gap-1 text-xs"
            >
              <Check size={13} />
              <span>{isImporting ? 'Importing...' : `Import Selected (${selectedIds.size})`}</span>
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
