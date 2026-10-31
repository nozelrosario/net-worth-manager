import React, { useState, useEffect, useMemo, useRef } from 'react';
import useModalBack from '../hooks/useModalBack';
import { 
  ArrowLeft, Cloud, RefreshCw, Upload, Check, X, Shield, 
  ArrowRightLeft, TrendingDown, Landmark, Sparkles, Filter, 
  Settings, CheckSquare, Square, ChevronDown, ChevronRight,
  Eye, FileText, AlertCircle, AlertTriangle, Trash2, CheckCircle2,
  Edit2, SlidersHorizontal, RotateCcw, EyeOff, Search
} from 'lucide-react';
import { Badge } from './Badge';
import { parseSmsXml, extractFinancialCandidate, deduplicateAndClassify, matchesSmsTextSearch } from '../utils/smsParser';

export default function SmsInboxModal({
  isOpen,
  onClose,
  data,
  formatCurrency,
  showMessage,
  onRefresh,
  onImportSuccess
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

  const ignoredHashesFromSettings = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'SmsIgnoredHashes');
    if (!s || !s['Setting Value']) return [];
    try {
      const parsed = JSON.parse(s['Setting Value']);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }, [settings]);

  const defaultCategories = 'Dining, Groceries, Utilities, Rent, Travel, Entertainment, Healthcare, Education, Shopping, Insurance, Investment / Insurance, General Expense, Other';

  const customCategoriesStr = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'SpendCategories');
    return s && s['Setting Value'] ? s['Setting Value'] : defaultCategories;
  }, [settings]);

  const expenseCategories = useMemo(() => {
    let list = customCategoriesStr.split(',').map(s => s.trim()).filter(Boolean);
    if (!list.includes('Internal Transfer')) {
      list.push('Internal Transfer');
    }
    if (!list.includes('Investment / Insurance')) {
      list.push('Investment / Insurance');
    }
    if (!list.includes('General Expense')) {
      list.splice(Math.max(0, list.length - 2), 0, 'General Expense');
    }
    return list;
  }, [customCategoriesStr]);

  // Component state
  const [candidates, setCandidates] = useState([]);
  const [ignoredHashes, setIgnoredHashes] = useState([]);
  const [stats, setStats] = useState({
    totalCandidates: 0,
    newCount: 0,
    importedCount: 0,
    ignoredCount: 0,
    pendingCount: 0,
    totalPendingAmount: 0,
    totalNewAmount: 0,
    transfersCount: 0,
    totalTransferAmount: 0,
    investmentsCount: 0,
    totalInvestmentAmount: 0,
    spendsCount: 0,
    duplicatesFiltered: 0
  });

  // Primary Status Filter: 'new' (DEFAULT) | 'imported' | 'ignored' | 'all'
  const [statusTab, setStatusTab] = useState('new');
  // Secondary Sub-filter for types
  const [typeFilter, setTypeFilter] = useState('all'); // all | spends | transfers | investments | high_value
  // Free-text Search Query Filter
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [driveFolder, setDriveFolder] = useState(defaultFolderName);
  const [latestFileName, setLatestFileName] = useState('');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [showRawSmsId, setShowRawSmsId] = useState(null);
  const [isManualFile, setIsManualFile] = useState(false);
  const [cachedXml, setCachedXml] = useState(null);

  const fileInputRef = useRef(null);

  // Sync folder name and ignored hashes state when defaults change
  useEffect(() => {
    setDriveFolder(defaultFolderName);
  }, [defaultFolderName]);

  useEffect(() => {
    setIgnoredHashes(ignoredHashesFromSettings);
  }, [ignoredHashesFromSettings]);

  // Process raw XML string into candidate records
  const processXmlContent = (xmlString, sourceFileName = '', isManualUpload = false, bypassWatermark = false) => {
    try {
      setIsManualFile(isManualUpload);
      setCachedXml({ xmlString, sourceFileName, isManualUpload });

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

      // Deduplicate and classify with existing ledger transactions and ignored registry.
      // Database cross-checking and deterministic hashes prevent duplicate entries.
      const result = deduplicateAndClassify(
        rawCandidates,
        existingTransactions,
        ignoredHashes
      );
      setCandidates(result.candidates);
      setStats(result.stats);

      // Start with empty selection by default to prevent accidental batch imports
      setSelectedIds(new Set());

      // Reset to 'new' tab on file load
      setStatusTab('new');
      setTypeFilter('all');
      setSearchQuery('');

      if (sourceFileName) {
        setLatestFileName(sourceFileName);
      }

      const newItemsCount = result.stats.newCount || 0;
      const importedItemsCount = result.stats.importedCount || 0;
      const ignoredItemsCount = result.stats.ignoredCount || 0;

      if (newItemsCount > 0) {
        showMessage?.(
          `Loaded ${newItemsCount} new actionable transactions (${importedItemsCount} already in ledger, ${ignoredItemsCount} ignored)`
        );
      } else if (importedItemsCount > 0) {
        showMessage?.(
          `All ${importedItemsCount} transactions in this backup are already saved in your ledger.`
        );
      } else {
        showMessage?.('No financial debit or credit transactions found in file.', true);
      }
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
            processXmlContent(res.xmlContent, res.fileName, false /* isManualUpload */);
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
        processXmlContent(content, file.name, true /* isManualUpload */);
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
    const selectable = filteredList.filter(c => c.status === 'new');
    if (checked) {
      const newSet = new Set(selectedIds);
      selectable.forEach(c => newSet.add(c.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      selectable.forEach(c => newSet.delete(c.id));
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

  // Ignore a single candidate and persist hash to Settings
  const handleIgnoreSingle = (candidate) => {
    const id = candidate.id;
    const fp = candidate.fingerprint || id;

    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'ignored', isIgnored: true, selected: false } : c));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setIgnoredHashes(prev => [...prev, fp]);
    setStats(prev => ({
      ...prev,
      newCount: Math.max(0, (prev.newCount || 0) - 1),
      pendingCount: Math.max(0, (prev.pendingCount || 0) - 1),
      ignoredCount: (prev.ignoredCount || 0) + 1,
      totalPendingAmount: Math.max(0, (prev.totalPendingAmount || 0) - candidate.amount)
    }));

    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          if (res?.status === 'success') {
            showMessage?.('Transaction marked as ignored.');
          }
        })
        .withFailureHandler((err) => {
          console.error('Failed to ignore transaction:', err);
        })
        .ignoreSmsTransactions([fp], token);
    } else {
      showMessage?.('Marked as ignored.');
    }
  };

  // Restore an ignored candidate back to new
  const handleRestoreSingle = (candidate) => {
    const id = candidate.id;
    const fp = candidate.fingerprint || id;

    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'new', isNew: true, isIgnored: false, selected: false } : c));
    setIgnoredHashes(prev => prev.filter(h => h !== fp));
    setStats(prev => ({
      ...prev,
      newCount: (prev.newCount || 0) + 1,
      pendingCount: (prev.pendingCount || 0) + 1,
      ignoredCount: Math.max(0, (prev.ignoredCount || 0) - 1),
      totalPendingAmount: (prev.totalPendingAmount || 0) + candidate.amount
    }));

    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          if (res?.status === 'success') {
            showMessage?.('Transaction restored to Inbox.');
          }
        })
        .withFailureHandler((err) => {
          console.error('Failed to restore transaction:', err);
        })
        .unignoreSmsTransaction(fp, token);
    } else {
      showMessage?.('Restored to Inbox.');
    }
  };

  // Batch ignore selected candidates
  const handleBatchIgnore = () => {
    const targetItems = candidates.filter(c => selectedIds.has(c.id) && c.status === 'new');
    if (!targetItems || targetItems.length === 0) {
      showMessage?.('Please select at least one pending transaction to ignore.', true);
      return;
    }

    const hashesToIgnore = targetItems.map(c => c.fingerprint || c.id);
    const idsToIgnore = new Set(targetItems.map(c => c.id));

    setCandidates(prev => prev.map(c => idsToIgnore.has(c.id) ? { ...c, status: 'ignored', isIgnored: true, selected: false } : c));
    setSelectedIds(new Set());
    setIgnoredHashes(prev => [...prev, ...hashesToIgnore]);

    let deductedAmount = 0;
    targetItems.forEach(t => { deductedAmount += t.amount; });

    setStats(prev => ({
      ...prev,
      newCount: Math.max(0, (prev.newCount || 0) - targetItems.length),
      pendingCount: Math.max(0, (prev.pendingCount || 0) - targetItems.length),
      ignoredCount: (prev.ignoredCount || 0) + targetItems.length,
      totalPendingAmount: Math.max(0, (prev.totalPendingAmount || 0) - deductedAmount)
    }));

    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          showMessage?.(`Ignored ${targetItems.length} transactions.`);
        })
        .ignoreSmsTransactions(hashesToIgnore, token);
    } else {
      showMessage?.(`Ignored ${targetItems.length} transactions.`);
    }
  };

  // Import single transaction
  const handleImportSingle = (candidate) => {
    handleBatchImport([candidate]);
  };

  // Batch import selected transactions
  const handleBatchImport = (itemsToImport) => {
    const isSingle = Boolean(itemsToImport && itemsToImport.length === 1);
    const targetItems = itemsToImport || candidates.filter(c => selectedIds.has(c.id) && c.status === 'new');
    if (!targetItems || targetItems.length === 0) {
      showMessage?.('Please select at least one transaction to import.', true);
      return;
    }

    // Safety check: Prompt confirmation when batch importing multiple transactions
    if (!isSingle && targetItems.length > 1) {
      if (!window.confirm(`Are you sure you want to import ${targetItems.length} selected transactions into your ledger?`)) {
        return;
      }
    }

    setIsImporting(true);
    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');

    let maxEpoch = 0;
    // Only advance the Drive sync watermark for automated Drive scans (not manual file uploads)
    if (!isManualFile) {
      maxEpoch = lastProcessedEpoch;
      targetItems.forEach(t => {
        if (t.rawDate && t.rawDate > maxEpoch) {
          maxEpoch = t.rawDate;
        }
      });
    }

    const formatted = targetItems.map(item => ({
      'Txn ID': `TXN_SMS_${item.fingerprint}`,
      Date: item.dateStr || item.Date || new Date().toISOString().split('T')[0],
      Type: item.type === 'Transfer' ? 'Transfer' : (item.type === 'Investment' ? 'Investment' : (item.type === 'Income / Refund' ? 'Income' : 'Expense')),
      Amount: Number(item.amount),
      Category: item.category,
      'Account/Card': item.account,
      'Merchant/Description': item.payee || 'Expense',
      Tags: `SMS Ingestion, ${item.bank}, SMS_REF:${item.fingerprint}`,
      'Is Transfer': item.isTransfer || false,
      Beneficiary: (item.beneficiary && item.beneficiary.trim()) ? item.beneficiary.trim() : 'Whole Family',
      'Split JSON': '',
      Notes: `Imported from SMS (Ref: ${item.refNo || item.fingerprint})`
    }));

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsImporting(false);
          if (res?.status === 'success') {
            const importedIds = new Set(targetItems.map(t => t.id));
            setCandidates(prev => prev.map(c => importedIds.has(c.id) ? { ...c, status: 'imported', isImported: true, selected: false } : c));
            setSelectedIds(prev => {
              const next = new Set(prev);
              importedIds.forEach(id => next.delete(id));
              return next;
            });

            let importedAmt = 0;
            targetItems.forEach(t => { importedAmt += t.amount; });

            setStats(prev => ({
              ...prev,
              newCount: Math.max(0, (prev.newCount || 0) - targetItems.length),
              pendingCount: Math.max(0, (prev.pendingCount || 0) - targetItems.length),
              importedCount: (prev.importedCount || 0) + targetItems.length,
              totalPendingAmount: Math.max(0, (prev.totalPendingAmount || 0) - importedAmt),
              totalNewAmount: Math.max(0, (prev.totalNewAmount || 0) - importedAmt)
            }));

            showMessage?.(`Imported ${res.importedCount} transactions!`);
            onImportSuccess?.(formatted);
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
        setCandidates(prev => prev.map(c => importedIds.has(c.id) ? { ...c, status: 'imported', isImported: true, selected: false } : c));
        setSelectedIds(prev => {
          const next = new Set(prev);
          importedIds.forEach(id => next.delete(id));
          return next;
        });

        let importedAmt = 0;
        targetItems.forEach(t => { importedAmt += t.amount; });

        setStats(prev => ({
          ...prev,
          newCount: Math.max(0, (prev.newCount || 0) - targetItems.length),
          pendingCount: Math.max(0, (prev.pendingCount || 0) - targetItems.length),
          importedCount: (prev.importedCount || 0) + targetItems.length,
          totalPendingAmount: Math.max(0, (prev.totalPendingAmount || 0) - importedAmt),
          totalNewAmount: Math.max(0, (prev.totalNewAmount || 0) - importedAmt)
        }));

        showMessage?.(`Imported ${targetItems.length} transactions! (Preview mode)`);
        onImportSuccess?.(formatted);
        onRefresh?.();
      }, 400);
    }
  };

  // Filter computation
  const filteredList = useMemo(() => {
    return candidates.filter(item => {
      // 1. Primary Status Filter
      if (statusTab === 'new' && item.status !== 'new') return false;
      if (statusTab === 'imported' && item.status !== 'imported') return false;
      if (statusTab === 'ignored' && item.status !== 'ignored') return false;

      // 2. Type Sub-Filter
      if (typeFilter === 'spends' && item.type !== 'Spend') return false;
      if (typeFilter === 'transfers' && item.type !== 'Transfer') return false;
      if (typeFilter === 'investments' && item.type !== 'Investment') return false;
      if (typeFilter === 'high_value' && item.amount < 5000) return false;

      // 3. Free-text Search Filter
      if (searchQuery && !matchesSmsTextSearch(item, searchQuery)) return false;

      return true;
    });
  }, [candidates, statusTab, typeFilter, searchQuery]);

  const selectableFilteredCount = useMemo(() => {
    return filteredList.filter(c => c.status === 'new').length;
  }, [filteredList]);

  const selectedFilteredCount = useMemo(() => {
    return filteredList.filter(c => c.status === 'new' && selectedIds.has(c.id)).length;
  }, [filteredList, selectedIds]);

  const allFilteredSelected = useMemo(() => {
    return selectableFilteredCount > 0 && selectedFilteredCount === selectableFilteredCount;
  }, [selectableFilteredCount, selectedFilteredCount]);

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
              <h2 className="text-typ-body-sm sm:text-typ-body font-bold tracking-tight text-text-primary truncate">
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
              className="py-1 px-2.5 rounded-lg bg-primary-accent text-white text-typ-footnote font-semibold flex items-center gap-1 shadow-xs hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
              title="Scan Drive Backup"
            >
              <RefreshCw size={12} className={isScanningDrive ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isScanningDrive ? 'Scanning...' : 'Scan Drive'}</span>
            </button>

            {/* Quick Upload CTA */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-primary text-typ-footnote font-medium flex items-center gap-1 active:scale-95 transition-all"
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
          <div className="p-3 bg-surface-layer2 border-b border-border-subtle space-y-2 shrink-0 animate-in slide-in-from-top-2 text-typ-label">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-primary flex items-center gap-1">
                <Settings size={13} className="text-primary-accent" />
                Drive Backup Settings
              </span>
              <button onClick={() => setShowSettingsDrawer(false)} className="text-text-muted hover:text-text-primary text-typ-footnote">
                Close
              </button>
            </div>
            <form onSubmit={handleSaveDriveFolder} className="flex gap-2">
              <input
                type="text"
                value={driveFolder}
                onChange={(e) => setDriveFolder(e.target.value)}
                placeholder="SMSBackupRestore"
                className="flex-1 text-typ-label px-2.5 py-1 rounded-lg bg-surface-layer1 border border-border-subtle text-text-primary"
              />
              <button type="submit" className="py-1 px-3 rounded-lg bg-primary-accent text-white font-semibold text-typ-label">
                Save
              </button>
              <button
                type="button"
                onClick={handleResetSyncDate}
                className="py-1 px-2 rounded-lg border border-border-subtle bg-surface-layer1 text-text-secondary text-typ-label"
              >
                Reset Date
              </button>
            </form>
          </div>
        )}

        {/* 3. PRIMARY STATUS FILTER RIBBON (Default to 'New') */}
        <div className="px-3 py-1.5 border-b border-border-subtle shrink-0 flex items-center justify-between gap-1.5 bg-surface-layer1/80">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-typ-label font-semibold">
            {/* New / Pending (Default) */}
            <button
              type="button"
              onClick={() => { setStatusTab('new'); setTypeFilter('all'); }}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                statusTab === 'new'
                  ? 'bg-primary-accent text-white shadow-xs'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>New</span>
              <span className={`px-1.5 py-0.2 rounded-full text-typ-caption font-bold ${
                statusTab === 'new' ? 'bg-white/20 text-white' : 'bg-surface-layer3 text-text-muted'
              }`}>
                {stats.newCount || 0}
              </span>
            </button>

            {/* Already Imported */}
            <button
              type="button"
              onClick={() => { setStatusTab('imported'); setTypeFilter('all'); }}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                statusTab === 'imported'
                  ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 font-bold'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <Check size={12} className={statusTab === 'imported' ? 'text-emerald-500' : 'text-text-muted'} />
              <span>Already Imported</span>
              <span className={`px-1.5 py-0.2 rounded-full text-typ-caption font-bold ${
                statusTab === 'imported' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-layer3 text-text-muted'
              }`}>
                {stats.importedCount || 0}
              </span>
            </button>

            {/* Ignored */}
            <button
              type="button"
              onClick={() => { setStatusTab('ignored'); setTypeFilter('all'); }}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                statusTab === 'ignored'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 font-bold'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <EyeOff size={12} className={statusTab === 'ignored' ? 'text-amber-500' : 'text-text-muted'} />
              <span>Ignored</span>
              <span className={`px-1.5 py-0.2 rounded-full text-typ-caption font-bold ${
                statusTab === 'ignored' ? 'bg-amber-500/20 text-amber-400' : 'bg-surface-layer3 text-text-muted'
              }`}>
                {stats.ignoredCount || 0}
              </span>
            </button>

            {/* All */}
            <button
              type="button"
              onClick={() => { setStatusTab('all'); setTypeFilter('all'); }}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${
                statusTab === 'all'
                  ? 'bg-surface-layer3 text-text-primary font-bold border border-border-prominent'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>All ({candidates.length})</span>
            </button>
          </div>
        </div>

        {/* 3B. CATEGORY SUB-FILTERS (Shown for 'new' or 'all') */}
        {(statusTab === 'new' || statusTab === 'all') && candidates.length > 0 && (
          <div className="px-3 py-1 border-b border-border-subtle shrink-0 flex items-center gap-1 overflow-x-auto no-scrollbar text-typ-footnote bg-surface-layer1/40">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2 py-0.5 rounded-full font-medium transition-all whitespace-nowrap ${
                typeFilter === 'all'
                  ? 'bg-surface-layer3 text-text-primary font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              All {statusTab === 'new' ? 'New' : ''}
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('spends')}
              className={`px-2 py-0.5 rounded-full font-medium transition-all whitespace-nowrap ${
                typeFilter === 'spends'
                  ? 'bg-rose-500/20 text-rose-500 font-bold border border-rose-500/30'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Spends ({stats.spendsCount || stats.pendingCount} • {formatCompactVal(stats.totalPendingAmount)})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('transfers')}
              className={`px-2 py-0.5 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                typeFilter === 'transfers'
                  ? 'bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-bullion-amber"></span>
              Transfers ({stats.transfersCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('investments')}
              className={`px-2 py-0.5 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                typeFilter === 'investments'
                  ? 'bg-emerald-500/20 text-emerald-500 font-bold border border-emerald-500/30'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald"></span>
              Investments ({stats.investmentsCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('high_value')}
              className={`px-2 py-0.5 rounded-full font-medium transition-all whitespace-nowrap ${
                typeFilter === 'high_value'
                  ? 'bg-primary-accent/20 text-primary-accent font-bold border border-primary-accent/30'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              &gt;₹5k
            </button>
          </div>
        )}

        {/* 3C. TEXT SEARCH FILTER BAR */}
        {candidates.length > 0 && (
          <div className="px-3 py-1.5 border-b border-border-subtle shrink-0 bg-surface-layer1/60 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                placeholder="Search merchant, bank, message, ref no..."
                className="w-full bg-surface-layer2/80 hover:bg-surface-layer2 focus:bg-surface-layer1 border border-border-subtle focus:border-primary-accent rounded-lg pl-8 pr-7 py-1 text-typ-footnote text-text-primary placeholder:text-text-muted outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-layer3 transition-colors"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <span className="text-typ-caption text-text-muted shrink-0 font-medium font-mono">
                {filteredList.length} {filteredList.length === 1 ? 'match' : 'matches'}
              </span>
            )}
          </div>
        )}

        {/* 4. COMPACT SELECTION & BATCH ACTIONS SUB-BAR (~28px) */}
        <div className="px-3 py-1 bg-surface-layer2/40 border-b border-border-subtle shrink-0 flex items-center justify-between text-typ-footnote">
          {statusTab === 'new' ? (
            <>
              <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary font-medium select-none">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  disabled={selectableFilteredCount === 0}
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-primary-accent border-border-prominent focus:ring-0 bg-surface-layer1 disabled:opacity-40"
                />
                <span>Select All ({selectedFilteredCount}/{selectableFilteredCount})</span>
                {selectedIds.size > selectedFilteredCount && (
                  <span className="text-typ-micro text-text-muted hidden sm:inline">
                    ({selectedIds.size} total)
                  </span>
                )}
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBatchImport()}
                  disabled={selectedIds.size === 0 || isImporting}
                  className="py-0.5 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 font-semibold active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1"
                >
                  <Check size={12} />
                  <span>Import ({selectedIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchIgnore}
                  disabled={selectedIds.size === 0}
                  className="text-text-muted hover:text-amber-500 transition-colors disabled:opacity-40 flex items-center gap-0.5"
                  title="Ignore selected transactions"
                >
                  <EyeOff size={11} />
                  <span>Ignore</span>
                </button>
              </div>
            </>
          ) : statusTab === 'imported' ? (
            <div className="w-full flex items-center justify-between text-text-muted">
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <CheckCircle2 size={12} />
                <span>
                  {searchQuery.trim()
                    ? `${filteredList.length} imported transactions match "${searchQuery.trim()}"`
                    : `${filteredList.length} transactions already recorded in your ledger`}
                </span>
              </span>
              <span className="text-typ-caption font-mono">Duplicates Blocked</span>
            </div>
          ) : statusTab === 'ignored' ? (
            <div className="w-full flex items-center justify-between text-text-muted">
              <span className="flex items-center gap-1 text-amber-500 font-medium">
                <EyeOff size={12} />
                <span>
                  {searchQuery.trim()
                    ? `${filteredList.length} ignored transactions match "${searchQuery.trim()}"`
                    : `${filteredList.length} transactions dismissed from inbox`}
                </span>
              </span>
              <span className="text-typ-caption">Tap 'Restore' to return any to Inbox</span>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between text-text-muted">
              <span>
                {searchQuery.trim()
                  ? `${filteredList.length} parsed transactions match "${searchQuery.trim()}"`
                  : `Showing all ${filteredList.length} parsed transactions`}
              </span>
              <span className="text-typ-caption">Audit Stream</span>
            </div>
          )}
        </div>

        {/* 5. EXPANSIVE SCROLLABLE TRANSACTIONS LIST */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 bg-background-root">
          {filteredList.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-text-muted space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-layer2 flex items-center justify-center text-emerald-500">
                {searchQuery.trim() ? (
                  <Search size={22} className="text-text-muted" />
                ) : (
                  <CheckCircle2 size={24} />
                )}
              </div>
              <div>
                <h3 className="text-typ-body-sm font-bold text-text-primary">
                  {searchQuery.trim()
                    ? `No transactions match "${searchQuery.trim()}"`
                    : statusTab === 'new' && (stats.importedCount > 0 || stats.ignoredCount > 0)
                    ? 'All Caught Up!'
                    : statusTab === 'imported'
                    ? 'No Imported Transactions Found'
                    : statusTab === 'ignored'
                    ? 'No Ignored Transactions'
                    : 'Inbox Clean'}
                </h3>
                <p className="text-typ-label text-text-muted max-w-xs mt-0.5">
                  {searchQuery.trim()
                    ? 'Try searching by a different merchant name, bank, category, or check for typos.'
                    : statusTab === 'new' && stats.importedCount > 0
                    ? `All ${stats.importedCount} transactions in this file are already saved in your ledger.`
                    : statusTab === 'new' && stats.ignoredCount > 0
                    ? `All pending transactions have been ignored. Check the Ignored tab to review.`
                    : 'No SMS transactions matching current view. Tap "Scan Drive" or upload an XML backup.'}
                </p>
              </div>

              {searchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="py-1.5 px-3.5 rounded-xl border border-border-subtle bg-surface-layer2 hover:bg-surface-layer3 text-text-primary text-typ-label font-semibold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>Clear Search Filter</span>
                </button>
              ) : (
                <>
                  {statusTab === 'new' && stats.importedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusTab('imported')}
                      className="py-1.5 px-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 text-typ-label font-semibold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                    >
                      <Check size={13} />
                      <span>View Already Imported ({stats.importedCount})</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-1.5 px-3.5 rounded-xl border border-border-subtle bg-surface-layer1 text-text-secondary hover:text-text-primary text-typ-label font-semibold shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Upload size={13} />
                      <span>Choose File</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleScanDrive}
                      className="py-1.5 px-3.5 rounded-xl bg-primary-accent text-white text-typ-label font-semibold hover:opacity-95 shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Cloud size={13} />
                      <span>Scan Drive</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            filteredList.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isExpanded = expandedCardId === item.id;
              const isRawOpen = showRawSmsId === item.id;
              const isImportedItem = item.status === 'imported';
              const isIgnoredItem = item.status === 'ignored';

              return (
                <article
                  key={item.id}
                  className={`rounded-xl p-2.5 sm:p-3 transition-all duration-150 shadow-xs relative overflow-hidden ${
                    item.type === 'Transfer'
                      ? 'border-l-[3px] border-l-amber-500'
                      : item.type === 'Investment'
                      ? 'border-l-[3px] border-l-emerald-500'
                      : item.type === 'Income / Refund'
                      ? 'border-l-[3px] border-l-teal-500'
                      : 'border-l-[3px] border-l-rose-500'
                  } ${
                    isSelected
                      ? 'bg-primary-accent/[0.06] border-y border-r border-primary-accent/40'
                      : isImportedItem
                      ? 'bg-surface-layer1/60 opacity-80 border-y border-r border-border-subtle/30'
                      : isIgnoredItem
                      ? 'bg-surface-layer1/50 opacity-70 border-y border-r border-border-subtle/30'
                      : 'bg-surface-layer1 border-y border-r border-border-subtle/50 dark:border-white/[0.04] hover:bg-surface-layer2/40'
                  }`}
                >
                  {/* COMPACT MAIN ROW (~48px) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Checkbox or Status Icon */}
                      {item.status === 'new' ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSingle(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded text-primary-accent border-border-prominent bg-surface-layer1 focus:ring-0 shrink-0 cursor-pointer"
                        />
                      ) : isImportedItem ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0" title="Already Saved in Ledger">
                          <Check size={10} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0" title="Ignored">
                          <EyeOff size={10} />
                        </div>
                      )}

                      {/* Payee + Preview + Metadata */}
                      <div
                        className="min-w-0 flex-1 cursor-pointer select-none group"
                        onClick={() => setExpandedCardId(isExpanded ? null : item.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedCardId(isExpanded ? null : item.id);
                          }
                        }}
                        title={isExpanded ? 'Collapse row' : 'Click title to expand & edit'}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-typ-label font-bold text-text-primary group-hover:text-primary-accent transition-colors truncate max-w-[150px] sm:max-w-[240px]">
                            {item.payee}
                          </span>
                          <span className="text-typ-caption text-text-muted bg-surface-layer2 px-1.5 py-0.2 rounded font-mono shrink-0">
                            {item.bank} {item.accountDigits ? `••${item.accountDigits}` : ''}
                          </span>
                          {isImportedItem && (
                            <span className="text-typ-caption text-emerald-500 bg-emerald-500/10 px-1.5 py-0.2 rounded font-semibold shrink-0">
                              ✓ Saved
                            </span>
                          )}
                          {isIgnoredItem && (
                            <span className="text-typ-caption text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded font-semibold shrink-0">
                              Ignored
                            </span>
                          )}
                        </div>

                        {/* Transaction Preview Text Snippet */}
                        {(item.previewSnippet || item.body) && (
                          <p className="text-typ-footnote text-text-muted/80 line-clamp-1 italic tracking-tight mt-0.5 max-w-[210px] sm:max-w-md">
                            "{item.previewSnippet || item.body}"
                          </p>
                        )}

                        {/* Date + Category/Tags Line */}
                        <div className="flex items-center gap-1.5 text-typ-caption text-text-secondary mt-0.5">
                          <span className="text-text-muted font-mono">{item.dateStr}</span>
                          <span className="text-text-muted/60">•</span>
                          {item.type === 'Transfer' ? (
                            <span className="text-bullion-amber font-semibold">Transfer</span>
                          ) : item.type === 'Investment' ? (
                            <span className="text-wealth-emerald font-semibold">Investment</span>
                          ) : (
                            <span>{item.category}</span>
                          )}
                          {item.refNo && (
                            <>
                              <span className="text-text-muted/60 hidden sm:inline">•</span>
                              <span className="text-text-muted/70 font-mono text-typ-micro hidden sm:inline">Ref: {item.refNo}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount + Status-Specific Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`text-typ-body-sm sm:text-typ-body font-bold num-tabular text-right ${
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

                      {item.status === 'new' ? (
                        <>
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
                            onClick={() => handleIgnoreSingle(item)}
                            className="w-7 h-7 rounded-lg text-text-muted hover:text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-colors"
                            title="Ignore SMS"
                          >
                            <EyeOff size={13} />
                          </button>
                        </>
                      ) : isImportedItem ? (
                        <div className="flex items-center gap-1">
                          <span className="py-0.5 px-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-typ-caption font-bold flex items-center gap-1">
                            <Check size={11} /> Saved
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedCardId(isExpanded ? null : item.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-layer2"
                            title="View Details"
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRestoreSingle(item)}
                            className="py-0.5 px-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 text-typ-caption font-bold flex items-center gap-1 active:scale-95 transition-all"
                            title="Restore to Inbox"
                          >
                            <RotateCcw size={11} /> Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedCardId(isExpanded ? null : item.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-layer2"
                            title="View Details"
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* INLINE EXPANDED CONTROLS */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-border-subtle/60 space-y-2.5 text-typ-label animate-in slide-in-from-top-1">
                      {item.status === 'new' && (
                        <div className="p-0.5 rounded-lg bg-surface-layer2 flex text-center text-typ-footnote font-medium">
                          <button
                            type="button"
                            onClick={() =>
                              updateCandidate(item.id, {
                                type: 'Spend',
                                isTransfer: false,
                                category: item.category === 'Internal Transfer' ? (expenseCategories[0] || 'Other') : item.category
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
                      )}

                      {/* Payee, Date, Category, Account & Beneficiary Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-typ-footnote">
                        <div>
                          <label className="text-typ-caption text-text-muted block mb-0.5">Payee / Merchant:</label>
                          <input
                            type="text"
                            value={item.payee}
                            disabled={item.status !== 'new'}
                            onChange={(e) => updateCandidate(item.id, { payee: e.target.value })}
                            className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-2 py-1 text-text-primary font-medium focus:ring-1 focus:ring-primary-accent disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="text-typ-caption text-text-muted block mb-0.5">Date:</label>
                          <input
                            type="date"
                            value={item.dateStr || ''}
                            disabled={item.status !== 'new'}
                            onChange={(e) => updateCandidate(item.id, { dateStr: e.target.value, Date: e.target.value })}
                            className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-2 py-1 text-text-primary font-mono focus:ring-1 focus:ring-primary-accent disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="text-typ-caption text-text-muted block mb-0.5">Category:</label>
                          <select
                            value={item.category}
                            disabled={item.status !== 'new'}
                            onChange={(e) => updateCandidate(item.id, { category: e.target.value })}
                            className="w-full bg-surface-layer2 border border-border-subtle rounded-lg py-1 px-2 text-text-primary font-medium focus:ring-1 focus:ring-primary-accent disabled:opacity-60"
                          >
                            {/* If current candidate category is not yet in expenseCategories (e.g. from SMS parser), preserve it as an option */}
                            {item.category && !expenseCategories.includes(item.category) && (
                              <option key={item.category} value={item.category}>
                                {item.category}
                              </option>
                            )}
                            {expenseCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-typ-caption text-text-muted block mb-0.5">Asset Account:</label>
                          <select
                            value={item.account}
                            disabled={item.status !== 'new'}
                            onChange={(e) => updateCandidate(item.id, { account: e.target.value })}
                            className="w-full bg-surface-layer2 border border-border-subtle rounded-lg py-1 px-2 text-text-primary font-medium focus:ring-1 focus:ring-primary-accent disabled:opacity-60"
                          >
                            <option value={item.account}>{item.account}</option>
                            {existingAssets.map((asset) => (
                              <option key={asset['Asset ID']} value={asset.Name}>
                                {asset.Name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-typ-caption text-text-muted block">For Whom:</label>
                            <span className="text-typ-micro text-text-muted">
                              {(() => {
                                const raw = String(item.beneficiary || '').trim();
                                if (!raw || raw === 'Whole Family') return 'Whole Family';
                                const count = raw.split(',').filter(Boolean).length;
                                return count === 1 ? '1 member' : `Split ${count} ways`;
                              })()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 p-1 bg-surface-layer2 border border-border-subtle rounded-lg">
                            {(() => {
                              const raw = String(item.beneficiary || '').trim();
                              const selectedBens = (!raw || raw === 'Whole Family') ? [] : raw.split(',').map(s => s.trim()).filter(Boolean);
                              return (
                                <>
                                  <button
                                    type="button"
                                    disabled={item.status !== 'new'}
                                    onClick={() => updateCandidate(item.id, { beneficiary: 'Whole Family' })}
                                    className={`px-2 py-0.5 rounded text-typ-micro font-medium transition-all ${
                                      selectedBens.length === 0
                                        ? 'bg-primary-accent text-white font-semibold'
                                        : 'bg-surface-layer1 text-text-secondary hover:text-text-primary'
                                    }`}
                                  >
                                    All
                                  </button>
                                  {familyProfiles.map((profile) => {
                                    const isSel = selectedBens.includes(profile.Name);
                                    return (
                                      <button
                                        key={profile.Name || profile['Profile ID']}
                                        type="button"
                                        disabled={item.status !== 'new'}
                                        onClick={() => {
                                          let next;
                                          if (isSel) {
                                            next = selectedBens.filter(n => n !== profile.Name);
                                          } else {
                                            next = [...selectedBens, profile.Name];
                                          }
                                          updateCandidate(item.id, {
                                            beneficiary: next.length > 0 ? next.join(', ') : 'Whole Family'
                                          });
                                        }}
                                        className={`px-2 py-0.5 rounded text-typ-micro font-medium transition-all ${
                                          isSel
                                            ? 'bg-primary-accent text-white font-semibold'
                                            : 'bg-surface-layer1 text-text-secondary hover:text-text-primary'
                                        }`}
                                      >
                                        {profile.Name}
                                      </button>
                                    );
                                  })}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Fingerprint & Raw SMS Snippet Toggle */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-typ-caption text-text-muted">
                          <span className="font-mono truncate max-w-[280px]">ID: {item.fingerprint}</span>
                          <button
                            type="button"
                            onClick={() => setShowRawSmsId(isRawOpen ? null : item.id)}
                            className="text-text-muted hover:text-primary-accent flex items-center gap-1"
                          >
                            <ChevronRight size={11} className={`transition-transform ${isRawOpen ? 'rotate-90' : ''}`} />
                            <span>{isRawOpen ? 'Hide raw message' : 'View raw SMS text'}</span>
                          </button>
                        </div>
                        {isRawOpen && (
                          <div className="mt-1 p-2 rounded-lg bg-surface-layer2 font-mono text-typ-micro text-text-secondary leading-relaxed border border-border-subtle/60 select-text">
                            {item.body}
                          </div>
                        )}
                      </div>

                      {/* Save & Import Button in Expanded View */}
                      {item.status === 'new' && (
                        <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
                          <span className="text-typ-micro text-text-muted">
                            Will record as <span className="font-semibold text-text-primary">{item.type === 'Transfer' ? 'Transfer' : (item.type === 'Investment' ? 'Investment' : 'Expense')}</span>
                          </span>
                          <button
                            type="button"
                            disabled={isImporting}
                            onClick={() => handleImportSingle(item)}
                            className="py-1 px-3 rounded-lg bg-primary-accent hover:opacity-95 text-white font-semibold text-typ-footnote flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Check size={12} />
                            <span>Save & Import Transaction</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* 6. COMPACT BOTTOM FOOTER (~44px) */}
        <footer className="px-3 py-2 sm:px-4 sm:py-2.5 border-t border-border-subtle shrink-0 flex items-center justify-between bg-surface-layer1 text-typ-label">
          <div className="text-text-muted text-typ-footnote flex items-center gap-1">
            <Shield size={12} className="text-emerald-500" />
            <span className="hidden sm:inline">On-Device Parsing • Deterministic Ledger Sync</span>
            <span className="sm:hidden">{selectedIds.size} selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-1 px-3 rounded-lg border border-border-subtle text-text-secondary hover:bg-surface-layer2 transition-colors text-typ-label font-medium"
            >
              Close
            </button>
            {statusTab === 'new' && (
              <button
                type="button"
                onClick={() => handleBatchImport()}
                disabled={selectedIds.size === 0 || isImporting}
                className="py-1 px-3.5 rounded-lg bg-primary-accent text-white font-semibold hover:opacity-95 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-typ-label"
              >
                <Check size={13} />
                <span>
                  {isImporting
                    ? 'Importing...'
                    : selectedIds.size > 0
                    ? `Import Selected (${selectedIds.size})`
                    : 'Select to Import'}
                </span>
              </button>
            )}
          </div>
        </footer>

      </div>
    </div>
  );
}
