import React, { useState, useEffect, useMemo, useRef } from 'react';
import useModalBack from '../hooks/useModalBack';
import { 
  ArrowLeft, Cloud, RefreshCw, Upload, Check, X, Shield, 
  ArrowRightLeft, TrendingDown, Landmark, Sparkles, Filter, 
  Settings, CheckSquare, Square, ChevronDown, ChevronRight,
  Eye, FileText, AlertCircle, AlertTriangle, Trash2, CheckCircle2
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
  const [latestFileMeta, setLatestFileMeta] = useState(null);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSmsId, setExpandedSmsId] = useState(null);

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
        `Loaded ${result.candidates.length} suggested transactions (${result.stats.duplicatesFiltered} duplicates filtered)`
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
            setLatestFileMeta({
              fileName: res.fileName,
              fileSize: res.fileSize,
              lastModified: res.lastModified
            });
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
      // Standalone dev preview simulator
      setTimeout(() => {
        setIsScanningDrive(false);
        showMessage?.('Running in local preview mode. Please upload the XML file manually to test.');
      }, 800);
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
    // Reset file input
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
            showMessage?.('Backup folder configuration saved.');
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
    if (!window.confirm('Resetting the sync date will allow re-scanning older messages from the backup. Continue?')) {
      return;
    }
    const token = sessionStorage.getItem('nwm_session_token') || localStorage.getItem('nwm_session_token');
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler(() => {
          showMessage?.('Sync date reset. Scan Google Drive again to ingest historical messages.');
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
    showMessage?.('Dismissed selected suggestions.');
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

    // Calculate maximum epoch in this import batch for watermark tracking
    let maxEpoch = lastProcessedEpoch;
    targetItems.forEach(t => {
      if (t.rawDate && t.rawDate > maxEpoch) {
        maxEpoch = t.rawDate;
      }
    });

    // Format for backend Transactions sheet
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
            showMessage?.(`Successfully imported ${res.importedCount} transactions into your records!`);
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
      }, 500);
    }
  };

  // Filter and search computation
  const filteredList = useMemo(() => {
    return candidates.filter(item => {
      // Type filter
      if (activeFilter === 'spends' && item.type !== 'Spend') return false;
      if (activeFilter === 'transfers' && item.type !== 'Transfer') return false;
      if (activeFilter === 'investments' && item.type !== 'Investment') return false;
      if (activeFilter === 'high_value' && item.amount < 5000) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPayee = item.payee.toLowerCase().includes(q);
        const matchBank = item.bank.toLowerCase().includes(q);
        const matchCategory = item.category.toLowerCase().includes(q);
        const matchBody = item.body.toLowerCase().includes(q);
        if (!matchPayee && !matchBank && !matchCategory && !matchBody) return false;
      }

      return true;
    });
  }, [candidates, activeFilter, searchQuery]);

  const allFilteredSelected = filteredList.length > 0 && filteredList.every(c => selectedIds.has(c.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-4 select-none">
      <div className="w-full max-w-3xl h-[95vh] max-h-[880px] rounded-3xl bg-surface-layer1 border border-border-subtle shadow-2xl flex flex-col overflow-hidden text-text-primary animate-in fade-in zoom-in-95 duration-150">
        
        {/* 1. Modal Top Bar */}
        <header className="px-4 py-3.5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-surface-layer1/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-layer2 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-text-primary">
                  SMS Spends & Transfer Inbox
                </h2>
                <Badge variant="indigo" size="xs">
                  {candidates.length} New
                </Badge>
              </div>
              <p className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                <Cloud size={12} className="text-primary-accent" />
                <span>Incremental Drive Sync Active</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="emerald" size="sm" dot pulse>
              Drive Connected
            </Badge>
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-primary-accent hover:bg-surface-layer2 transition-colors"
              title="Drive Folder Settings"
            >
              <Settings size={17} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-layer2 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* 2. Optional Settings Drawer */}
        {showSettingsDrawer && (
          <div className="p-4 bg-surface-layer2 border-b border-border-subtle space-y-3 shrink-0 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Settings size={14} className="text-primary-accent" />
                <span>SMS Backup & Restore Configuration</span>
              </span>
              <button onClick={() => setShowSettingsDrawer(false)} className="text-text-muted hover:text-text-primary text-xs">
                Close
              </button>
            </div>
            <form onSubmit={handleSaveDriveFolder} className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-text-muted font-medium block mb-1">
                  Google Drive Backup Folder Name
                </label>
                <input
                  type="text"
                  value={driveFolder}
                  onChange={(e) => setDriveFolder(e.target.value)}
                  placeholder="e.g. SMSBackupRestore"
                  className="w-full text-xs px-3 py-1.5 rounded-xl bg-surface-layer1 border border-border-subtle text-text-primary focus:ring-1 focus:ring-primary-accent"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="py-1.5 px-3 rounded-xl bg-primary-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Save Folder
                </button>
                <button
                  type="button"
                  onClick={handleResetSyncDate}
                  className="py-1.5 px-3 rounded-xl border border-border-subtle bg-surface-layer1 text-text-secondary hover:bg-surface-layer3 text-xs font-medium transition-colors"
                  title="Resets watermark so you can re-scan historical backups"
                >
                  Reset Sync Date
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 3. Ingestion Source & Action Bar */}
        <div className="px-4 py-3 bg-surface-layer2/40 border-b border-border-subtle shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="w-8 h-8 rounded-xl bg-primary-accent/12 text-primary-accent flex items-center justify-center shrink-0">
              <Cloud size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <span>Google Drive / {driveFolder}</span>
              </div>
              <div className="text-[10px] text-text-muted num-tabular truncate max-w-[280px]">
                {latestFileName ? `Latest: ${latestFileName}` : 'Auto-monitors incremental XML backups'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleScanDrive}
              disabled={isScanningDrive}
              className="flex-1 sm:flex-none py-1.5 px-3 rounded-xl bg-primary-accent text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 active:scale-98 transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={isScanningDrive ? 'animate-spin' : ''} />
              <span>{isScanningDrive ? 'Scanning Drive...' : 'Scan Drive Backup'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none py-1.5 px-3 rounded-xl bg-surface-layer1 border border-border-subtle hover:bg-surface-layer2 text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition-all"
            >
              <Upload size={13} className="text-text-secondary" />
              <span>Upload XML File</span>
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
        </div>

        {/* 4. Metric Ribbon */}
        <div className="px-4 py-2.5 border-b border-border-subtle shrink-0 grid grid-cols-4 gap-2 text-center bg-surface-layer1">
          <div className="p-2 rounded-xl bg-surface-layer2/60 border border-border-subtle/70">
            <div className="text-[10px] font-medium text-text-muted">Pending Spends</div>
            <div className="text-sm font-bold text-primary-accent num-tabular mt-0.5">
              {stats.pendingCount}
            </div>
            <div className="text-[9px] text-text-muted num-tabular">
              {formatCurrency ? formatCurrency(stats.totalPendingAmount) : `₹${stats.totalPendingAmount.toLocaleString('en-IN')}`}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Transfers</div>
            <div className="text-sm font-bold text-bullion-amber num-tabular mt-0.5">
              {stats.transfersCount}
            </div>
            <div className="text-[9px] text-amber-600/80 dark:text-amber-400/80 num-tabular">
              {formatCurrency ? formatCurrency(stats.totalTransferAmount) : `₹${stats.totalTransferAmount.toLocaleString('en-IN')}`}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Investments</div>
            <div className="text-sm font-bold text-wealth-emerald num-tabular mt-0.5">
              {stats.investmentsCount}
            </div>
            <div className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 num-tabular">
              {formatCurrency ? formatCurrency(stats.totalInvestmentAmount) : `₹${stats.totalInvestmentAmount.toLocaleString('en-IN')}`}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-surface-layer2/60 border border-border-subtle/70">
            <div className="text-[10px] font-medium text-text-muted">Filtered</div>
            <div className="text-sm font-bold text-text-secondary num-tabular mt-0.5">
              {stats.duplicatesFiltered}
            </div>
            <div className="text-[9px] text-text-muted">Duplicates / Noise</div>
          </div>
        </div>

        {/* 5. Filter Pills & Batch Bar */}
        <div className="px-4 py-2 border-b border-border-subtle shrink-0 flex flex-wrap items-center justify-between gap-2 bg-surface-layer1">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                activeFilter === 'all'
                  ? 'bg-primary-accent text-white shadow-xs'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({candidates.length})
            </button>
            <button
              onClick={() => setActiveFilter('spends')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeFilter === 'spends'
                  ? 'bg-primary-accent text-white shadow-xs'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              Spends ({stats.pendingCount})
            </button>
            <button
              onClick={() => setActiveFilter('transfers')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                activeFilter === 'transfers'
                  ? 'bg-bullion-amber text-white shadow-xs'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-bullion-amber"></span>
              Transfers ({stats.transfersCount})
            </button>
            <button
              onClick={() => setActiveFilter('investments')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                activeFilter === 'investments'
                  ? 'bg-wealth-emerald text-white shadow-xs'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald"></span>
              Investments ({stats.investmentsCount})
            </button>
            <button
              onClick={() => setActiveFilter('high_value')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeFilter === 'high_value'
                  ? 'bg-primary-accent text-white shadow-xs'
                  : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
              }`}
            >
              High Value (&gt;₹5k)
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary font-medium select-none">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded text-primary-accent border-border-prominent focus:ring-primary-accent/20 bg-surface-layer1"
              />
              <span>Select ({selectedIds.size})</span>
            </label>

            <button
              onClick={() => handleBatchImport()}
              disabled={selectedIds.size === 0 || isImporting}
              className="py-1 px-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 font-semibold active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1"
            >
              <Check size={14} />
              <span>{isImporting ? 'Importing...' : `Import (${selectedIds.size})`}</span>
            </button>

            <button
              onClick={handleBatchDismiss}
              disabled={selectedIds.size === 0}
              className="py-1 px-2 text-text-muted hover:text-liability-rose hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-40"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* 6. Candidates Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg-root">
          {filteredList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-text-muted space-y-3">
              <div className="w-14 h-14 rounded-full bg-surface-layer2 flex items-center justify-center text-text-secondary">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Inbox Clean & Up-to-Date</h3>
                <p className="text-xs text-text-muted max-w-xs mt-1">
                  No unreviewed SMS transactions pending. Tap "Scan Drive Backup" or upload an incremental backup XML to detect new expenses.
                </p>
              </div>
              <button
                onClick={handleScanDrive}
                className="py-2 px-4 rounded-xl bg-primary-accent text-white text-xs font-semibold hover:opacity-95 shadow-xs transition-all"
              >
                Scan Google Drive Now
              </button>
            </div>
          ) : (
            filteredList.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isExpanded = expandedSmsId === item.id;

              return (
                <article
                  key={item.id}
                  className={`rounded-2xl p-3.5 bg-surface-layer1 border transition-all duration-150 space-y-3 shadow-xs ${
                    isSelected ? 'border-primary-accent/40 shadow-sm' : 'border-border-subtle'
                  }`}
                >
                  {/* Top Row: Checkbox, Bank Badge, Date, Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSingle(item.id)}
                        className="mt-1 w-4 h-4 rounded text-primary-accent border-border-prominent bg-surface-layer1 focus:ring-primary-accent/20"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          {item.type === 'Transfer' ? (
                            <Badge variant="amber" size="xs" dot>
                              Internal Transfer
                            </Badge>
                          ) : item.type === 'Investment' ? (
                            <Badge variant="emerald" size="xs" dot>
                              Investment / 80C
                            </Badge>
                          ) : item.type === 'Income / Refund' ? (
                            <Badge variant="emerald" size="xs">
                              Refund / Reversal
                            </Badge>
                          ) : (
                            <Badge variant="rose" size="xs">
                              Spend
                            </Badge>
                          )}
                          <span className="text-[11px] text-text-muted num-tabular">{item.dateStr}</span>
                        </div>

                        {/* Editable Payee */}
                        <div className="mt-1">
                          <input
                            type="text"
                            value={item.payee}
                            onChange={(e) => updateCandidate(item.id, { payee: e.target.value })}
                            className="text-sm font-bold text-text-primary bg-transparent border-b border-transparent hover:border-border-prominent focus:border-primary-accent px-0 py-0.5 focus:outline-none w-full"
                          />
                        </div>

                        <div className="text-[11px] text-text-secondary flex items-center gap-1.5 mt-0.5">
                          <span className="font-medium">{item.bank}</span>
                          {item.accountDigits && (
                            <>
                              <span className="text-text-muted">•</span>
                              <span className="font-mono text-text-muted">••{item.accountDigits}</span>
                            </>
                          )}
                          {item.refNo && (
                            <>
                              <span className="text-text-muted">•</span>
                              <span className="text-[10px] text-text-muted font-mono">Ref: {item.refNo}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-base font-bold num-tabular ${
                          item.type === 'Transfer'
                            ? 'text-bullion-amber'
                            : item.type === 'Investment'
                            ? 'text-wealth-emerald'
                            : item.type === 'Income / Refund'
                            ? 'text-wealth-emerald'
                            : 'text-liability-rose'
                        }`}
                      >
                        {item.type === 'Income / Refund' ? '+' : item.type === 'Transfer' ? '' : '-'}
                        {formatCurrency ? formatCurrency(item.amount) : `₹${item.amount.toLocaleString('en-IN')}`}
                      </div>
                      <span className="text-[10px] text-text-muted">{item.category}</span>
                    </div>
                  </div>

                  {/* Classification Switcher Pill */}
                  <div className="p-1 rounded-xl bg-surface-layer2 flex text-center text-xs font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        updateCandidate(item.id, {
                          type: 'Spend',
                          isTransfer: false,
                          category: item.category === 'Internal Transfer' ? 'General Expense' : item.category
                        })
                      }
                      className={`flex-1 py-1 rounded-lg transition-all ${
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
                      className={`flex-1 py-1 rounded-lg transition-all ${
                        item.type === 'Transfer'
                          ? 'bg-surface-layer1 shadow-xs text-bullion-amber font-bold'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Internal Transfer
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
                      className={`flex-1 py-1 rounded-lg transition-all ${
                        item.type === 'Investment'
                          ? 'bg-surface-layer1 shadow-xs text-wealth-emerald font-bold'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Investment
                    </button>
                  </div>

                  {/* Account & Category Selector Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-text-muted shrink-0">Category:</span>
                      <select
                        value={item.category}
                        onChange={(e) => updateCandidate(item.id, { category: e.target.value })}
                        className="w-full bg-surface-layer2 border border-border-subtle rounded-lg text-xs py-1 px-2 text-text-primary font-medium focus:ring-1 focus:ring-primary-accent"
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

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-text-muted shrink-0">Account:</span>
                      <select
                        value={item.account}
                        onChange={(e) => updateCandidate(item.id, { account: e.target.value })}
                        className="w-full bg-surface-layer2 border border-border-subtle rounded-lg text-xs py-1 px-2 text-text-primary font-medium focus:ring-1 focus:ring-primary-accent"
                      >
                        <option value={item.account}>{item.account}</option>
                        {existingAssets.map((asset) => (
                          <option key={asset['Asset ID']} value={asset.Name}>
                            {asset.Name} ({asset.Category})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Expandable Raw SMS Text */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedSmsId(isExpanded ? null : item.id)}
                      className="text-[11px] text-text-muted hover:text-primary-accent flex items-center gap-1 transition-colors"
                    >
                      <ChevronRight size={13} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <span>{isExpanded ? 'Hide Raw SMS text' : 'View Raw SMS text'}</span>
                    </button>
                    {isExpanded && (
                      <div className="mt-2 p-2.5 rounded-xl bg-surface-layer2/80 font-mono text-[10px] text-text-secondary leading-relaxed border border-border-subtle animate-in fade-in">
                        {item.body}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
                    <span className="text-[10px] text-text-muted">
                      {item.isTransfer ? (
                        <span className="flex items-center gap-1 text-bullion-amber">
                          <Shield size={12} /> Excluded from Net Spend Drag
                        </span>
                      ) : item.type === 'Investment' ? (
                        <span className="flex items-center gap-1 text-wealth-emerald">
                          <CheckCircle2 size={12} /> Section 80C Tax-Advantaged
                        </span>
                      ) : (
                        <span>Verified Bank Debited SMS</span>
                      )}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDismiss(item.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-liability-rose hover:bg-rose-500/10 transition-colors"
                        title="Dismiss"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportSingle(item)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <Check size={14} />
                        <span>Confirm & Import</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* 7. Modal Bottom Sticky Footer */}
        <footer className="px-4 py-3 border-t border-border-subtle shrink-0 flex items-center justify-between bg-surface-layer1 text-xs">
          <div className="text-text-muted flex items-center gap-1.5">
            <Shield size={14} className="text-emerald-500" />
            <span>On-Device NLP Extraction • Zero Credentials Stored</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-1.5 px-3 rounded-xl border border-border-subtle text-text-secondary hover:bg-surface-layer2 transition-colors font-medium"
            >
              Close
            </button>
            <button
              onClick={() => handleBatchImport()}
              disabled={selectedIds.size === 0 || isImporting}
              className="py-1.5 px-4 rounded-xl bg-primary-accent text-white font-semibold hover:opacity-95 shadow-xs transition-all disabled:opacity-40 flex items-center gap-1.5"
            >
              <Check size={15} />
              <span>{isImporting ? 'Importing...' : `Import Selected (${selectedIds.size})`}</span>
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
