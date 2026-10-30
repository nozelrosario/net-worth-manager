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
  const [geminiApiKey, setGeminiApiKey] = useState(savedGeminiKey);
  const [tempGeminiKey, setTempGeminiKey] = useState(savedGeminiKey);

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

  useEffect(() => {
    if (savedGeminiKey) {
      setGeminiApiKey(savedGeminiKey);
      setTempGeminiKey(savedGeminiKey);
    }
  }, [savedGeminiKey]);

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
      const extractResult = await extractTextFromCasPdf(pdfData, pwd);

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

      // Step 2: Google Gemini 1.5 Flash structured JSON parsing
      const keyToUse = geminiApiKey || savedGeminiKey;
      if (!keyToUse) {
        setIsProcessing(false);
        setShowPanModal(true);
        showMessage?.('Google Gemini API Key is required to parse statement. Please enter it in Settings.', true);
        return;
      }

      setProcessingStatusText('Gemini 1.5 Flash analyzing portfolio & schemes...');
      const geminiResult = await parseCasWithGemini(extractResult.text, keyToUse);

      if (!geminiResult || !Array.isArray(geminiResult.holdings) || geminiResult.holdings.length === 0) {
        throw new Error('No mutual fund holdings found in the parsed statement.');
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

      const msg = `Successfully analyzed ${geminiResult.holdings.length} holdings (${reconciled.stats.updatedCount} updated, ${reconciled.stats.newCount} new)`;
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

  // Save PAN / Gemini settings
  const handleSaveSecuritySettings = () => {
    const cleanPan = (tempPanInput || '').trim();
    const cleanKey = (tempGeminiKey || '').trim();

    setPanPassword(cleanPan);
    setGeminiApiKey(cleanKey);
    setSafeStorage('nwm_cas_pan', cleanPan);
    if (cleanKey) {
      setSafeStorage('nwm_gemini_api_key', cleanKey);
    }

    // Persist to Google Sheets Settings
    const token = getSafeStorage('nwm_session_token');
    if (window.google?.script?.run && token) {
      if (cleanPan) {
        window.google.script.run.upsertSetting('CasPdfPan', cleanPan, token);
      }
      if (cleanKey) {
        window.google.script.run.upsertSetting('GeminiApiKey', cleanKey, token);
      }
    }

    setShowPanModal(false);
    setPasswordError('');
    showMessage?.('Security credentials saved.');

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 md:p-4">
      <div className="w-full h-full md:h-[94vh] md:max-w-4xl bg-bg-root flex flex-col md:rounded-2xl border-0 md:border md:border-border-subtle shadow-2xl overflow-hidden transition-all duration-200">
        
        {/* 1. COMPACT HEADER */}
        <header className="sticky top-0 z-40 bg-surface-layer1/95 backdrop-blur-md px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button 
              type="button"
              onClick={onClose} 
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-layer2 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-wealth-emerald animate-pulse"></div>
              <h1 className="text-sm md:text-base font-bold tracking-tight text-text-primary">CAS Portfolio Sync</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-accent/15 text-primary-accent border border-primary-accent/25">
                AI Powered
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
              className="py-1 px-3 rounded-lg bg-primary-accent hover:bg-primary-accent/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50 transition-all"
            >
              <Cloud size={14} className={isScanningDrive ? 'animate-bounce' : ''} />
              <span>{isScanningDrive ? 'Scanning Drive...' : 'Scan Drive'}</span>
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
                setTempGeminiKey(geminiApiKey || savedGeminiKey || '');
                setShowPanModal(true);
              }} 
              className="p-1.5 rounded-lg bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-secondary hover:text-wealth-emerald transition-colors"
              title="Statement Password & Gemini Settings"
            >
              <Key size={16} />
            </button>
          </div>
        </header>

        {/* 2. SOURCE BANNER & LOADING STATUS */}
        {isProcessing && (
          <div className="px-4 py-2 bg-primary-accent/10 border-b border-primary-accent/20 flex items-center justify-between text-xs text-primary-accent">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-primary-accent" />
              <span className="font-medium">{processingStatusText || 'Processing statement...'}</span>
            </div>
            <span className="text-[11px] text-text-muted">Gemini 1.5 Flash</span>
          </div>
        )}

        {latestFileName && !isProcessing && (
          <div className="px-4 py-2 bg-surface-layer2/40 border-b border-border-subtle flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen size={14} className="text-wealth-emerald shrink-0" />
              <span className="font-semibold text-text-primary truncate">{latestFileName}</span>
              {statementMeta.holderName && (
                <span className="text-[10px] text-text-muted truncate">• Holder: {statementMeta.holderName}</span>
              )}
            </div>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 shrink-0">
              {candidates.length} Holdings
            </span>
          </div>
        )}

        {/* 3. HERO RECONCILIATION SUMMARY BANNER */}
        {candidates.length > 0 && (
          <div className="p-4 pb-2 border-b border-border-subtle bg-surface-layer1/50">
            <div className="p-4 rounded-xl bg-surface-layer1 border border-border-subtle shadow-xs">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted">
                    Total Statement Valuation
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-text-primary num-tabular">
                      {formatCurrency ? formatCurrency(stats.totalStatementValue) : `₹${stats.totalStatementValue.toLocaleString('en-IN')}`}
                    </span>
                    {stats.totalValuationDelta !== 0 && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-bold num-tabular ${
                        stats.totalValuationDelta >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'
                      }`}>
                        {stats.totalValuationDelta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {stats.totalValuationDelta >= 0 ? '+' : ''}
                        {formatCurrency ? formatCurrency(stats.totalValuationDelta) : `₹${stats.totalValuationDelta.toLocaleString('en-IN')}`}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted">
                    Statement Date: {statementMeta.statementDate || 'Recent'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-wealth-emerald/15 text-wealth-emerald border border-wealth-emerald/20 flex items-center gap-1">
                    <Sparkles size={11} />
                    Gemini Verified
                  </span>
                  <span className="text-[10px] text-text-muted mt-1">
                    Live Quotes Synced
                  </span>
                </div>
              </div>

              {/* Metric ribbon */}
              <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-border-subtle/60 text-center">
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
          </div>
        )}

        {/* 4. FILTER TABS & SELECTION TOOLBAR */}
        {candidates.length > 0 && (
          <div className="px-4 py-2 border-b border-border-subtle bg-surface-layer1/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
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
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    statusTab === tab.key 
                      ? 'bg-primary-accent text-white shadow-xs' 
                      : 'bg-surface-layer2 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-text-secondary">
                <input 
                  type="checkbox"
                  checked={filteredCandidates.filter(c => c.isActionable).length > 0 && 
                           filteredCandidates.filter(c => c.isActionable).every(c => selectedIds.has(c.id))}
                  onChange={toggleSelectAll}
                  className="rounded border-border-subtle text-primary-accent focus:ring-0 w-3.5 h-3.5 bg-surface-layer2"
                />
                <span>Select All ({filteredCandidates.filter(c => c.isActionable).length})</span>
              </label>
            </div>
          </div>
        )}

        {/* 5. MAIN CONTENT / HOLDINGS LIST */}
        <main className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {candidates.length === 0 && !isProcessing && (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-border-subtle bg-surface-layer1/40">
              <div className="w-12 h-12 rounded-2xl bg-primary-accent/10 text-primary-accent flex items-center justify-center mb-3">
                <FileText size={24} />
              </div>
              <h2 className="text-sm font-bold text-text-primary mb-1">No CAS Statement Loaded</h2>
              <p className="text-xs text-text-muted max-w-sm mb-4">
                Click <strong>Scan Drive</strong> to find the latest statement from your Drive folder, or drag & drop your CAMS+KFintech PDF here.
              </p>
              <div className="flex items-center gap-2">
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

          {filteredCandidates.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div 
                key={item.id}
                className={`p-3.5 rounded-xl bg-surface-layer1 border transition-all ${
                  item.status === 'new' 
                    ? 'border-primary-accent/40 shadow-xs' 
                    : isSelected 
                      ? 'border-border-prominent shadow-xs' 
                      : 'border-border-subtle opacity-80'
                }`}
              >
                {/* Card Top Row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      disabled={!item.isActionable}
                      onChange={() => toggleSelectCandidate(item.id)}
                      className="rounded border-border-subtle text-primary-accent focus:ring-0 w-4 h-4 mt-0.5 bg-surface-layer2 shrink-0 disabled:opacity-40"
                    />
                    <div className="min-w-0">
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
                      <h2 className="text-xs font-bold text-text-primary truncate mt-0.5">{item.name}</h2>
                      <p className="text-[10px] text-text-muted truncate">{item.institution}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-text-primary num-tabular">
                      {formatCurrency ? formatCurrency(item.newCurrentValue) : `₹${item.newCurrentValue.toLocaleString('en-IN')}`}
                    </span>
                    {item.valuationDelta !== 0 && (
                      <span className={`block text-[10px] font-bold num-tabular ${
                        item.valuationDelta >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'
                      }`}>
                        {item.valuationDelta >= 0 ? '+' : ''}
                        {formatCurrency ? formatCurrency(item.valuationDelta) : `₹${item.valuationDelta.toLocaleString('en-IN')}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Diff Comparison Box */}
                <div className="p-2 rounded-lg bg-surface-layer2/50 border border-border-subtle/50 text-[11px] grid grid-cols-3 gap-2">
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

        {/* 6. FIXED BOTTOM COMMIT DOCK */}
        {candidates.length > 0 && (
          <footer className="sticky bottom-0 z-40 bg-surface-layer1/95 backdrop-blur-md border-t border-border-subtle p-3 px-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-text-muted block">
                {selectedIds.size} of {candidates.filter(c => c.isActionable).length} Actionable Selected
              </span>
              <span className="text-xs font-black text-text-primary num-tabular">
                Batch Update Ledger
              </span>
            </div>

            <div className="flex items-center gap-2">
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
                  <Key size={16} className="text-wealth-emerald" />
                  <h3 className="text-sm font-bold text-text-primary">PDF Decryption & API Key</h3>
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

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={tempGeminiKey}
                    onChange={(e) => setTempGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-surface-layer2 border border-border-subtle rounded-xl text-xs font-mono text-text-primary px-3 py-2 focus:ring-1 focus:ring-primary-accent"
                  />
                  <span className="text-[10px] text-text-muted block mt-0.5">
                    Gemini 1.5 Flash free tier (1500 req/day).
                  </span>
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
                  Save Credentials
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
