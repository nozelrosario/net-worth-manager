import React, { useState, useEffect, useMemo, useRef } from 'react';
import useModalBack from '../hooks/useModalBack';
import { 
  ArrowLeft, Cloud, RefreshCw, Upload, Check, X, Shield, 
  Sparkles, Filter, Settings, CheckSquare, Square, ChevronDown, 
  ChevronRight, Eye, EyeOff, FileText, AlertCircle, AlertTriangle, 
  CheckCircle2, Key, HelpCircle, TrendingUp, TrendingDown,
  FolderOpen, Lock, ExternalLink
} from 'lucide-react';
import { Badge } from './Badge';
import GeminiApiKeyModal from './GeminiApiKeyModal';
import { getSafeStorage, setSafeStorage } from '../utils/storage';
import { 
  extractTextFromCasPdf, 
  parseCasWithGemini, 
  reconcileCasWithLedger 
} from '../utils/casParser';

export default function CasSyncModal({
  isOpen,
  onClose,
  data,
  formatCurrency,
  showMessage,
  onRefresh,
  onSyncSuccess
}) {
  useModalBack(isOpen, onClose);

  // Global settings & data
  const settings = data?.settings || [];
  const existingAssets = data?.assets || [];
  const marketQuotes = data?.marketQuotes || [];
  const familyProfiles = data?.familyProfiles || [];
  const activeEmail = data?.userInfo?.activeEmail || '';

  const defaultFolderName = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'CasDriveFolder');
    return s && s['Setting Value'] ? s['Setting Value'] : 'Net Worth Manager/CAS Imports';
  }, [settings]);

  const savedPanFromSettings = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'CasPdfPan');
    return s && s['Setting Value'] ? s['Setting Value'] : getSafeStorage('nwm_cas_pan', '');
  }, [settings]);

  const savedGeminiKey = useMemo(() => {
    const s = settings.find(item => item['Setting Key'] === 'GeminiApiKey');
    return s && s['Setting Value'] ? s['Setting Value'] : getSafeStorage('nwm_gemini_api_key', '');
  }, [settings]);

  // Component state
  const [driveFolder, setDriveFolder] = useState(defaultFolderName);
  const [panPassword, setPanPassword] = useState(savedPanFromSettings);
  const [tempPanInput, setTempPanInput] = useState(savedPanFromSettings);
  const [showPassword, setShowPassword] = useState(false);
  const geminiApiKey = savedGeminiKey;

  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [statusTab, setStatusTab] = useState('all'); // all | updated | new | redeemed | unchanged
  const [stats, setStats] = useState({
    totalHoldings: 0,
    updatedCount: 0,
    newCount: 0,
    sipsCreditedCount: 0,
    totalStatementValue: 0,
    totalInvestedCost: 0,
    totalValuationDelta: 0,
    actionableCount: 0
  });

  const [statementMeta, setStatementMeta] = useState({
    holderName: '',
    detectedOwner: '',
    statementDate: ''
  });

  const [latestFileName, setLatestFileName] = useState('');
  const [cachedPdfData, setCachedPdfData] = useState(null);

  // Modals state
  const [showPanModal, setShowPanModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const fileInputRef = useRef(null);

  // Sync defaults when settings load
  useEffect(() => {
    setDriveFolder(defaultFolderName);
  }, [defaultFolderName]);

  useEffect(() => {
    if (savedPanFromSettings) {
      setPanPassword(savedPanFromSettings);
      setTempPanInput(savedPanFromSettings);
    }
  }, [savedPanFromSettings]);

  // Core processor: PDF Extraction -> Gemini Structured Output -> Reconciliation
  const processPdfContent = async (pdfData, sourceFileName = '', passwordToUse = null) => {
    const pwd = passwordToUse !== null ? passwordToUse : panPassword;
    setIsProcessing(true);
    setPasswordError('');
    setCachedPdfData(pdfData);
    if (sourceFileName) {
      setLatestFileName(sourceFileName);
    }

    try {
      // Step 1: In-memory PDF text extraction via PDF.js CDN
      setProcessingStatusText('Unlocking PDF & extracting text...');
      const extractResult = await extractTextFromCasPdf(pdfData, pwd, (statusText) => {
        setProcessingStatusText(statusText);
      });

      if (extractResult.status === 'password_required') {
        setIsProcessing(false);
        setTempPanInput(pwd || '');
        setPasswordError('Statement is password-protected or incorrect password. Please enter the password you set during CAMS export or your PAN.');
        setShowPanModal(true);
        showMessage?.('Statement is password-protected. Please enter your password or PAN to unlock.', false);
        return;
      }

      if (extractResult.status !== 'success' || !extractResult.text) {
        throw new Error(extractResult.message || 'Failed to extract text from statement.');
      }

      // Step 2: Google Gemini Flash structured JSON parsing
      const keyToUse = savedGeminiKey;
      if (!keyToUse) {
        setIsProcessing(false);
        setShowApiKeyModal(true);
        showMessage?.('Google Gemini API Key is required to parse statement. Please configure your key in the settings.', true);
        return;
      }

      setProcessingStatusText('Gemini AI analyzing portfolio & schemes...');
      const geminiResult = await parseCasWithGemini(extractResult.text, keyToUse, (statusText) => {
        setProcessingStatusText(statusText);
      });

      if (!geminiResult || !Array.isArray(geminiResult.holdings) || geminiResult.holdings.length === 0) {
        throw new Error('No mutual fund holdings found in the parsed statement. Please verify that the export format was "Summary".');
      }

      // Step 3: Snapshot Reconciliation with existing database
      setProcessingStatusText('Reconciling units, SIPs & live valuations...');
      const reconciled = reconcileCasWithLedger(
        geminiResult,
        existingAssets,
        marketQuotes,
        familyProfiles,
        activeEmail
      );

      setCandidates(reconciled.candidates);
      setStats(reconciled.stats);
      setStatementMeta(reconciled.statementMeta);

      // Pre-select all actionable candidate records by default
      const actionableIds = new Set();
      for (const item of reconciled.candidates) {
        if (item.isActionable) {
          actionableIds.add(item.id);
        }
      }
      setSelectedIds(actionableIds);
      setStatusTab('all');

      setIsProcessing(false);
      setProcessingStatusText('');

      const msg = `Successfully analyzed ${geminiResult.holdings.length} holdings (${reconciled.stats.updatedCount} updated, ${reconciled.stats.newCount} new). Review items and click "Update Ledger" to import.`;
      showMessage?.(msg);
    } catch (err) {
      console.error('Error processing CAS statement:', err);
      setIsProcessing(false);
      setProcessingStatusText('');
      showMessage?.(`CAS Parse Error: ${err.message}`, true);
    }
  };

  // Google Drive Scan Trigger
  const handleScanDrive = () => {
    setIsScanningDrive(true);
    const token = getSafeStorage('nwm_session_token');

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsScanningDrive(false);
          if (res && res.status === 'success' && res.base64Data) {
            processPdfContent(res.base64Data, res.fileName);
          } else if (res && res.status === 'not_found') {
            showMessage?.(res.message || 'Google Drive folder not found.', true);
          } else if (res && res.status === 'no_backups') {
            showMessage?.(res.message || 'No CAS .pdf files found in Drive folder.', true);
          } else {
            showMessage?.(res?.message || 'Failed to scan Google Drive for CAS.', true);
          }
        })
        .withFailureHandler((err) => {
          setIsScanningDrive(false);
          showMessage?.('Drive Scan Error: ' + err.message, true);
        })
        .scanDriveForCas(driveFolder, token);
    } else {
      // Local demo fallback
      setTimeout(() => {
        setIsScanningDrive(false);
        showMessage?.('Drive scan simulation completed (Preview mode)');
      }, 800);
    }
  };

  // Drag & drop manual file upload
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showMessage?.('Please upload a valid .pdf CAS statement.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result;
      if (arrayBuffer) {
        processPdfContent(arrayBuffer, file.name);
      }
    };
    reader.onerror = () => {
      showMessage?.('Failed to read uploaded file.', true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDropFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showMessage?.('Please upload a valid .pdf CAS statement.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result;
      if (arrayBuffer) {
        processPdfContent(arrayBuffer, file.name);
      }
    };
    reader.onerror = () => {
      showMessage?.('Failed to read dropped file.', true);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOverFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Save CAS PDF password setting
  const handleSaveSecuritySettings = () => {
    const cleanPan = (tempPanInput || '').trim();

    setPanPassword(cleanPan);
    setSafeStorage('nwm_cas_pan', cleanPan);

    // Persist to Google Sheets Settings
    const token = getSafeStorage('nwm_session_token');
    if (window.google?.script?.run && token) {
      if (cleanPan) {
        window.google.script.run.upsertSetting('CasPdfPan', cleanPan, token);
      }
    }

    setShowPanModal(false);
    setPasswordError('');
    showMessage?.('Statement decryption password saved.');

    // If we have cached PDF data that failed previously, re-try processing with new password
    if (cachedPdfData) {
      processPdfContent(cachedPdfData, latestFileName, cleanPan);
    }
  };

  // Selection toggles
  const filteredCandidates = useMemo(() => {
    if (statusTab === 'all') return candidates;
    if (statusTab === 'updated') return candidates.filter(c => c.status === 'updated');
    if (statusTab === 'new') return candidates.filter(c => c.status === 'new');
    if (statusTab === 'redeemed') return candidates.filter(c => c.status === 'redeemed');
    if (statusTab === 'unchanged') return candidates.filter(c => c.status === 'unchanged');
    return candidates;
  }, [candidates, statusTab]);

  const toggleSelectCandidate = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allFilteredIds = filteredCandidates.filter(c => c.isActionable).map(c => c.id);
    const areAllSelected = allFilteredIds.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (areAllSelected) {
        for (const id of allFilteredIds) next.delete(id);
      } else {
        for (const id of allFilteredIds) next.add(id);
      }
      return next;
    });
  };

  // Card-level owner change
  const handleOwnerChange = (candidateId, newOwner) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return { ...c, owner: newOwner };
      }
      return c;
    }));
  };

  // Batch commit to Google Sheets database
  const handleCommitSync = () => {
    const selectedItems = candidates.filter(c => selectedIds.has(c.id));
    if (selectedItems.length === 0) {
      showMessage?.('No holdings selected for synchronization.', true);
      return;
    }

    const assetsToUpdate = [];
    const assetsToInsert = [];

    for (const item of selectedItems) {
      if (item.isExisting && item.assetId) {
        assetsToUpdate.push({
          'Asset ID': item.assetId,
          'Current Value': item.newCurrentValue,
          'Cost': item.newCost,
          'Identifiers': item.folioNumber,
          'Institution/Location': item.institution,
          'Details JSON': {
            'Units': item.newUnits,
            'Average NAV': item.effectiveNav,
            'ISIN': item.isin,
            'Live Tracking': true,
            'Statement NAV': item.statementNav
          }
        });
      } else {
        assetsToInsert.push({
          'Name': item.name,
          'Category': 'Mutual Funds',
          'Type': 'Investment',
          'Owner': item.owner || activeEmail || 'Single',
          'Status': 'Active',
          'Cost': item.newCost,
          'Current Value': item.newCurrentValue,
          'Institution/Location': item.institution,
          'Identifiers': item.folioNumber,
          'Details JSON': {
            'Units': item.newUnits,
            'Average NAV': item.effectiveNav,
            'ISIN': item.isin,
            'Live Tracking': true,
            'Statement NAV': item.statementNav
          }
        });
      }
    }

    setIsSyncing(true);
    const token = getSafeStorage('nwm_session_token');

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSyncing(false);
          if (res && res.status === 'success') {
            showMessage?.(res.message || 'Successfully synchronized portfolio!');
            if (onRefresh) onRefresh();
            if (onSyncSuccess) onSyncSuccess();
            onClose();
          } else {
            showMessage?.(res?.message || 'Failed to sync assets to database.', true);
          }
        })
        .withFailureHandler((err) => {
          setIsSyncing(false);
          showMessage?.('Batch Sync Error: ' + err.message, true);
        })
        .batchSyncCasAssets(assetsToUpdate, assetsToInsert, statementMeta.statementDate, token);
    } else {
      setTimeout(() => {
        setIsSyncing(false);
        showMessage?.(`Synced ${selectedItems.length} holdings to ledger (preview mode)`);
        if (onRefresh) onRefresh();
        onClose();
      }, 1000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 md:p-4">
      <div className="w-full h-full md:h-[94vh] md:max-w-4xl bg-background-root text-text-primary flex flex-col md:rounded-2xl border-0 md:border md:border-border-subtle shadow-2xl overflow-hidden transition-all duration-200">
        
        {/* 1. COMPACT STICKY HEADER */}
        <header className="sticky top-0 z-40 bg-background-root/95 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button 
              type="button"
              onClick={onClose} 
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-layer2 transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-wealth-emerald animate-pulse shrink-0"></div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-text-primary truncate">CAS Portfolio Sync</h1>
              <span className="hidden xs:inline px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-accent/15 text-primary-accent border border-primary-accent/25 shrink-0">
                AI Powered
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button 
              type="button"
              onClick={() => setShowGuideModal(true)} 
              className="p-1.5 rounded-lg bg-surface-layer2 hover:bg-surface-layer3 text-text-secondary hover:text-primary-accent transition-colors"
              title="How to Export CAS from CAMS"
            >
              <HelpCircle size={16} />
            </button>

            <button 
              type="button"
              onClick={handleScanDrive} 
              disabled={isScanningDrive || isProcessing}
              className="py-1 px-2.5 sm:px-3 rounded-lg bg-primary-accent hover:bg-primary-accent/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50 transition-all"
              title="Scan Drive for CAS"
            >
              <Cloud size={14} className={isScanningDrive ? 'animate-bounce' : ''} />
              <span className="hidden sm:inline">{isScanningDrive ? 'Scanning...' : 'Scan Drive'}</span>
            </button>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileInputChange} 
              accept=".pdf" 
              className="hidden" 
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()} 
              disabled={isProcessing}
              className="p-1.5 rounded-lg bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-secondary hover:text-primary-accent transition-colors"
              title="Upload CAS PDF manually"
            >
              <Upload size={16} />
            </button>

            <button 
              type="button"
              onClick={() => {
                setTempPanInput(panPassword || '');
                setShowPanModal(true);
              }} 
              className="p-1.5 rounded-lg bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
              title="CAS Statement Password (PAN)"
            >
              <Lock size={16} />
            </button>

            <button 
              type="button"
              onClick={() => setShowApiKeyModal(true)} 
              className="p-1.5 rounded-lg bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-secondary hover:text-wealth-emerald transition-colors"
              title="Google Gemini API Key Settings"
            >
              <Key size={16} />
            </button>
          </div>
        </header>

        {/* 2. SOURCE BANNER & LOADING STATUS */}
        {isProcessing && (
          <div className="px-3 sm:px-4 py-2 bg-primary-accent/10 border-b border-primary-accent/20 flex items-center justify-between text-xs text-primary-accent animate-pulse shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCw size={14} className="animate-spin text-primary-accent shrink-0" />
              <span className="font-semibold truncate">{processingStatusText || 'Processing statement...'}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsProcessing(false);
                setProcessingStatusText('');
              }}
              className="text-[11px] underline text-text-muted hover:text-text-primary px-2 py-0.5 shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {latestFileName && !isProcessing && (
          <div className="px-3 sm:px-4 py-1.5 bg-surface-layer1 border-b border-border-subtle flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <FolderOpen size={13} className="text-wealth-emerald shrink-0" />
              <span className="font-semibold text-text-primary truncate max-w-[160px] sm:max-w-xs">{latestFileName}</span>
              {statementMeta.holderName && (
                <span className="text-[10px] text-text-muted truncate hidden sm:inline">• Holder: {statementMeta.holderName}</span>
              )}
            </div>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 shrink-0">
              {candidates.length} Holdings
            </span>
          </div>
        )}

        {/* 3. SCROLLABLE MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 pb-32">
          
          {/* HERO RECONCILIATION SUMMARY BANNER */}
          {candidates.length > 0 && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-surface-layer1 border border-border-subtle shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted">
                  Total Statement Valuation
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-wealth-emerald/15 text-wealth-emerald border border-wealth-emerald/20 flex items-center gap-1 shrink-0">
                  <Sparkles size={11} />
                  Gemini Verified
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-xl sm:text-2xl font-black text-text-primary num-tabular">
                  {formatCurrency ? formatCurrency(stats.totalStatementValue) : `₹${stats.totalStatementValue.toLocaleString('en-IN')}`}
                </span>
                {stats.totalValuationDelta !== 0 && (
                  <span className={`inline-flex items-center gap-0.5 text-xs sm:text-sm font-bold num-tabular ${
                    stats.totalValuationDelta >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'
                  }`}>
                    {stats.totalValuationDelta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {stats.totalValuationDelta >= 0 ? '+' : ''}
                    {formatCurrency ? formatCurrency(stats.totalValuationDelta) : `₹${stats.totalValuationDelta.toLocaleString('en-IN')}`}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-text-muted">
                <span>Statement Date: {statementMeta.statementDate || 'Recent'}</span>
                <span>Live Quotes Synced</span>
              </div>

              {/* Metric ribbon */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-subtle/60 text-center">
                <div className="p-1.5 rounded-lg bg-surface-layer2/50">
                  <span className="block text-[9px] text-text-muted uppercase font-medium">SIPs Credited</span>
                  <span className="text-xs font-bold text-wealth-emerald num-tabular">
                    {stats.sipsCreditedCount} Funds
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-surface-layer2/50">
                  <span className="block text-[9px] text-text-muted uppercase font-medium">Updated Funds</span>
                  <span className="text-xs font-bold text-text-primary num-tabular">
                    {stats.updatedCount} / {stats.totalHoldings}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-surface-layer2/50">
                  <span className="block text-[9px] text-text-muted uppercase font-medium">New Detected</span>
                  <span className="text-xs font-bold text-primary-accent num-tabular">
                    {stats.newCount} New
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* FILTER TABS & SELECTION TOOLBAR (STICKY ON SCROLL) */}
          {candidates.length > 0 && (
            <div className="sticky top-0 z-30 bg-background-root/95 backdrop-blur-md -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 border-y border-border-subtle flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[calc(100%-120px)] sm:max-w-none">
                {[
                  { key: 'all', label: `All (${candidates.length})` },
                  { key: 'updated', label: `Updated / SIP (${stats.updatedCount})` },
                  { key: 'new', label: `New (${stats.newCount})` },
                  { key: 'redeemed', label: 'Redeemed (0)' },
                  { key: 'unchanged', label: 'Unchanged' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusTab(tab.key)}
                    className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      statusTab === tab.key 
                        ? 'bg-primary-accent text-white shadow-xs' 
                        : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-text-secondary select-none">
                  <input 
                    type="checkbox"
                    checked={filteredCandidates.filter(c => c.isActionable).length > 0 && 
                             filteredCandidates.filter(c => c.isActionable).every(c => selectedIds.has(c.id))}
                    onChange={toggleSelectAll}
                    className="rounded border-border-subtle text-primary-accent focus:ring-0 w-3.5 h-3.5 bg-surface-layer2 cursor-pointer"
                  />
                  <span>Select All ({filteredCandidates.filter(c => c.isActionable).length})</span>
                </label>
              </div>
            </div>
          )}

          {/* EMPTY DROPZONE STATE */}
          {candidates.length === 0 && !isProcessing && (
            <div 
              onDragOver={handleDragOverFile}
              onDrop={handleDropFile}
              className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-6 rounded-2xl border-2 border-dashed border-border-subtle hover:border-primary-accent/50 bg-surface-layer1/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-accent/10 text-primary-accent flex items-center justify-center mb-3">
                <FileText size={24} />
              </div>
              <h2 className="text-sm font-bold text-text-primary mb-1">No CAS Statement Loaded</h2>
              <p className="text-xs text-text-muted max-w-sm mb-4">
                Click <strong>Scan Drive</strong> to find the latest statement from your Drive folder, or drag & drop your CAMS+KFintech PDF here.
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={handleScanDrive}
                  disabled={isScanningDrive}
                  className="px-3.5 py-1.5 rounded-xl bg-primary-accent hover:bg-primary-accent/90 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Cloud size={14} />
                  <span>Scan Drive</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  <span>Upload PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-surface-layer2 text-text-muted hover:text-text-primary text-xs font-medium"
                >
                  Export Guide
                </button>
              </div>
            </div>
          )}

          {/* CANDIDATES HOLDINGS CARDS */}
          {filteredCandidates.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div 
                key={item.id}
                className={`p-3 sm:p-3.5 rounded-xl bg-surface-layer1 border transition-all ${
                  item.status === 'new' 
                    ? 'border-primary-accent/40 shadow-xs' 
                    : isSelected 
                      ? 'border-border-prominent shadow-xs' 
                      : 'border-border-subtle opacity-80'
                }`}
              >
                {/* Card Top Row */}
                <div className="flex items-start justify-between gap-2.5 mb-2.5">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      disabled={!item.isActionable}
                      onChange={() => toggleSelectCandidate(item.id)}
                      className="rounded border-border-subtle text-primary-accent focus:ring-0 w-4 h-4 mt-0.5 bg-surface-layer2 shrink-0 disabled:opacity-40 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${
                          item.status === 'new'
                            ? 'bg-primary-accent/15 text-primary-accent border-primary-accent/25'
                            : item.unitsDelta > 0.005
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-surface-layer2 text-text-muted border-border-subtle'
                        }`}>
                          {item.statusLabel}
                        </span>
                        {item.folioNumber && (
                          <span className="text-[10px] text-text-muted">Folio: {item.folioNumber}</span>
                        )}
                        {item.isin && (
                          <span className="text-[10px] text-text-muted">• {item.isin}</span>
                        )}
                      </div>
                      <h2 className="text-xs font-bold text-text-primary line-clamp-2 mt-1 leading-snug">{item.name}</h2>
                      <p className="text-[10px] text-text-muted truncate mt-0.5">{item.institution}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-black text-text-primary num-tabular">
                      {formatCurrency ? formatCurrency(item.newCurrentValue) : `₹${item.newCurrentValue.toLocaleString('en-IN')}`}
                    </span>
                    {item.valuationDelta !== 0 && (
                      <span className={`block text-[10px] font-bold num-tabular mt-0.5 ${
                        item.valuationDelta >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'
                      }`}>
                        {item.valuationDelta >= 0 ? '+' : ''}
                        {formatCurrency ? formatCurrency(item.valuationDelta) : `₹${item.valuationDelta.toLocaleString('en-IN')}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Diff Comparison Box */}
                <div className="p-2 rounded-lg bg-surface-layer2/50 border border-border-subtle/50 text-[11px] grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-text-muted block font-medium">Units Balance</span>
                    {item.isExisting && (
                      <span className="text-text-secondary font-semibold num-tabular text-[10px] line-through mr-1">
                        {item.oldUnits.toFixed(3)}
                      </span>
                    )}
                    <span className="text-wealth-emerald font-bold num-tabular text-[11px]">
                      {item.newUnits.toFixed(3)}
                    </span>
                    {item.unitsDelta > 0 && (
                      <span className="text-[9px] text-wealth-emerald block font-medium">
                        (+{item.unitsDelta.toFixed(3)})
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-text-muted block font-medium">NAV</span>
                    <span className="text-text-primary font-bold num-tabular text-[11px]">
                      ₹{item.effectiveNav.toFixed(2)}
                    </span>
                    {item.liveNav && (
                      <span className="text-[9px] text-sky-400 block font-medium">Live AMFI</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-text-muted block font-medium">Invested Cost</span>
                    {item.isExisting && item.oldCost > 0 && (
                      <span className="text-text-secondary font-semibold num-tabular text-[10px] line-through mr-1">
                        ₹{item.oldCost.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span className="text-text-primary font-bold num-tabular text-[11px]">
                      ₹{item.newCost.toLocaleString('en-IN')}
                    </span>
                    {item.costDelta > 0 && (
                      <span className="text-[9px] text-text-muted block">
                        (+₹{item.costDelta.toLocaleString('en-IN')})
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer: Owner Selector */}
                <div className="mt-2.5 pt-2 border-t border-border-subtle/40 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-muted">Owner:</span>
                    <select
                      value={item.owner}
                      onChange={(e) => handleOwnerChange(item.id, e.target.value)}
                      className="bg-surface-layer2 border border-border-subtle rounded-md text-[10px] font-semibold text-text-primary px-1.5 py-0.5 focus:ring-0"
                    >
                      {familyProfiles.map((p, pIdx) => {
                        const name = p.Name || p['Profile Name'];
                        return <option key={pIdx} value={name}>{name}</option>;
                      })}
                      {familyProfiles.length === 0 && (
                        <>
                          <option value="Nozel Rosario">Nozel Rosario</option>
                          <option value="Maria Rosario">Maria Rosario</option>
                          <option value="Joint">Joint</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-text-muted">
                    {item.isExisting ? (
                      <>
                        <CheckCircle2 size={12} className="text-wealth-emerald" />
                        <span>Matched Existing Asset</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} className="text-primary-accent" />
                        <span>New Holding</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </main>

        {/* 4. FIXED BOTTOM COMMIT DOCK */}
        {candidates.length > 0 && (
          <footer className="sticky bottom-0 z-40 bg-background-root/98 backdrop-blur-md border-t border-border-subtle p-3 px-4 flex items-center justify-between gap-3 shrink-0 shadow-lg">
            <div className="min-w-0">
              <span className="text-[10px] text-text-muted block">
                {selectedIds.size} of {candidates.filter(c => c.isActionable).length} Actionable Selected
              </span>
              <span className="text-xs font-black text-text-primary num-tabular">
                Batch Update Ledger
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-surface-layer2 hover:bg-surface-layer3 text-text-secondary text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitSync}
                disabled={isSyncing || selectedIds.size === 0}
                className="px-4 py-1.5 rounded-xl bg-primary-accent hover:bg-primary-accent/90 text-white text-xs font-bold shadow-md shadow-primary-accent/25 flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Updating Sheet...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Update Ledger ({selectedIds.size})</span>
                  </>
                )}
              </button>
            </div>
          </footer>
        )}

        {/* MODAL 1: HOW TO EXPORT CAS GUIDE */}
        {showGuideModal && (
          <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-surface-layer1 border border-border-subtle p-5 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-3 border-b border-border-subtle/50 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary-accent/15 text-primary-accent flex items-center justify-center">
                    <HelpCircle size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">How to Export CAS from CAMS</h3>
                    <p className="text-[10px] text-text-muted">Step-by-step guide for statement export</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowGuideModal(false)} 
                  className="text-text-muted hover:text-text-primary"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-text-secondary">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-surface-layer2 text-primary-accent font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <strong className="text-text-primary block font-semibold">Open CAMS eCAS Portal</strong>
                    <p className="text-[11px] text-text-muted mt-0.5">Visit the official CAMS Online CAS generation page:</p>
                    <a 
                      href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-accent hover:underline mt-1 bg-primary-accent/10 px-2 py-0.5 rounded-md"
                    >
                      <span>camsonline.com/Investors/Statements/Consolidated-Account-Statement</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-surface-layer2 text-primary-accent font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <strong className="text-text-primary block font-semibold">Select Statement Type: "Summary"</strong>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Choose <strong className="text-text-primary">Summary (Holdings only)</strong> rather than Detailed. This gives a fast 1–3 page balance sheet of all funds across both CAMS & KFintech without decades of transaction logs.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-surface-layer2 text-primary-accent font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <strong className="text-text-primary block font-semibold">Enter Registered Email & PAN</strong>
                    <p className="text-[11px] text-text-muted mt-0.5">Provide the primary email ID and PAN registered across your mutual fund folios.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-text-primary">
                  <Lock size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-400 block font-bold text-[11px] uppercase tracking-wider">Password Setting Guidance</strong>
                    <ul className="list-disc list-inside space-y-1 text-[10px] text-text-muted mt-1">
                      <li><strong class="text-text-primary">Recommended:</strong> Set your password as your <strong class="text-text-primary">PAN in UPPERCASE</strong> (e.g. <code className="font-mono bg-surface-layer2 px-1 rounded">ABCDE1234F</code>) for 1-tap auto-unlock.</li>
                      <li><strong class="text-text-primary">If Custom Password:</strong> Enter that same password in the app before syncing.</li>
                      <li><strong class="text-text-primary">Monthly Auto-Email CAS:</strong> Statements sent automatically every month are <strong class="text-text-primary">always locked with your PAN in uppercase</strong>.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-surface-layer2 text-wealth-emerald font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">5</span>
                  <div>
                    <strong className="text-text-primary block font-semibold">Drop PDF into Google Drive or Upload</strong>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Save the emailed PDF into Google Drive folder <code className="font-mono bg-surface-layer2 px-1 rounded text-[10px]">Net Worth Manager/CAS Imports/</code>, or drag & drop it directly into this modal!
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-primary-accent text-white text-xs font-bold"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: PAN & SECURITY SETTINGS */}
        {showPanModal && (
          <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-surface-layer1 border border-border-subtle p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-wealth-emerald" />
                  <h3 className="text-sm font-bold text-text-primary">Statement Decryption Password</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowPanModal(false)} 
                  className="text-text-muted hover:text-text-primary"
                >
                  <X size={18} />
                </button>
              </div>

              {passwordError && (
                <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              <p className="text-xs text-text-muted mb-4">
                CAS statements are password-protected with your PAN or custom export password. Decryption occurs 100% in-memory on your device.
              </p>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-text-secondary">
                      Your PAN or CAS Export Password
                    </label>
                    {tempPanInput && (
                      <button
                        type="button"
                        onClick={() => setTempPanInput(tempPanInput.toUpperCase())}
                        className="text-[10px] text-primary-accent hover:underline font-medium"
                        title="Convert to uppercase if using PAN"
                      >
                        Convert to Uppercase
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={tempPanInput}
                      onChange={(e) => setTempPanInput(e.target.value)}
                      placeholder="e.g. ABCDE1234F or custom password"
                      className="w-full bg-surface-layer2 border border-border-subtle rounded-xl text-xs font-mono font-medium text-text-primary px-3 py-2 pr-9 focus:ring-1 focus:ring-primary-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-border-subtle/70">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[11px] font-semibold text-text-secondary">
                        Google Gemini API Key
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {savedGeminiKey ? 'Active & Configured' : 'Not configured (offline)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPanModal(false);
                        setShowApiKeyModal(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-primary-accent text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Key size={12} />
                      <span>{savedGeminiKey ? 'Edit Key' : 'Configure Key'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPanModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-surface-layer2 text-text-secondary text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSecuritySettings}
                  className="px-4 py-1.5 rounded-xl bg-wealth-emerald text-white text-xs font-bold"
                >
                  Save Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unified Gemini API Key Modal */}
        <GeminiApiKeyModal
          isOpen={showApiKeyModal}
          onClose={() => setShowApiKeyModal(false)}
          settings={settings}
          onRefresh={onRefresh}
          showMessage={showMessage}
        />

      </div>
    </div>
  );
}
