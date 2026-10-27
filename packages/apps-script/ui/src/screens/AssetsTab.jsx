import useModalBack from "../hooks/useModalBack";
import { getSafeStorage } from "../utils/storage";
import React, { useState, useEffect } from 'react';
import DynamicForm, { calculatePerformance } from "../components/DynamicForm";
import { Badge } from "../components/Badge";
import { AlertTriangle, Trash2, Lock, Paperclip, RefreshCw, Sparkles, TrendingUp, TrendingDown, X, Plus, Shield, Landmark, HeartPulse } from 'lucide-react';
import { isInsuranceAsset, calculatePolicyMetrics } from "../utils/insuranceMath";

const getSafeCategoryForAsset = (assetCategory) => {
  const cat = (assetCategory || '').toLowerCase();
  if (cat.includes('real estate') || cat.includes('plot') || cat.includes('land') || cat.includes('property') || cat.includes('flat') || cat.includes('house')) {
    return 'Property';
  }
  if (cat.includes('vehicle') || cat.includes('car') || cat.includes('bike')) {
    return 'Vehicle';
  }
  if (cat.includes('medical') || cat.includes('health') || cat.includes('insurance')) {
    return 'Medical';
  }
  if (cat.includes('tax')) {
    return 'Tax';
  }
  return 'Finance';
};

export default function AssetsTab({ formatCurrency, data, onRefresh, showMessage, onOpenRebalancer, onOpenRetirementPlanner, onOpenInsuranceHub }) {
  const [filter, setFilter] = useState('All Assets');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [newAsset, setNewAsset] = useState({ Name: '', Category: 'Equity', 'Current Value': '', Owner: '' });
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingRates, setIsSyncingRates] = useState(false);

  useModalBack(showAddModal, () => {
    if (deleteConfirmAsset) {
      setDeleteConfirmAsset(null);
    } else {
      setShowAddModal(false);
    }
  });

  const assets = data?.assets || [];
  
  const defaultCategories = 'Equity, Mutual Funds, Gold, Cash/FD, Real Estate, Retirement & Pension, Life Insurance / LIC, Liabilities';
  const customCategoriesStr = data?.settings?.find(s => s['Setting Key'] === 'AssetCategories')?.['Setting Value'] || defaultCategories;
  let categoriesList = customCategoriesStr.split(',').map(s => s.trim()).filter(Boolean);
  if (!categoriesList.includes('Retirement & Pension') && !categoriesList.includes('Provident Funds')) {
    const liabIdx = categoriesList.indexOf('Liabilities');
    if (liabIdx !== -1) {
      categoriesList.splice(liabIdx, 0, 'Retirement & Pension');
    } else {
      categoriesList.push('Retirement & Pension');
    }
  }
  if (!categoriesList.includes('Life Insurance / LIC') && !categoriesList.includes('Insurance')) {
    const liabIdx = categoriesList.indexOf('Liabilities');
    if (liabIdx !== -1) {
      categoriesList.splice(liabIdx, 0, 'Life Insurance / LIC');
    } else {
      categoriesList.push('Life Insurance / LIC');
    }
  }
  const profiles = data?.familyProfiles || [];
  
  const filters = ['All Assets', ...categoriesList];
  
  const filteredAssets = filter === 'All Assets' 
    ? assets 
    : assets.filter(a => {
        if (filter === 'Retirement & Pension') {
          return a.Category === 'Retirement & Pension' || a.Category === 'Provident Funds' || (a.Category || '').toLowerCase().includes('retire') || (a.Category || '').toLowerCase().includes('provident');
        }
        if (filter === 'Life Insurance / LIC' || filter === 'Insurance') {
          return a.Category === 'Life Insurance / LIC' || a.Category === 'Insurance' || (a.Category || '').toLowerCase().includes('insurance') || (a.Category || '').toLowerCase().includes('lic');
        }
        return a.Category === filter;
      });

  const handleSyncRates = () => {
    setIsSyncingRates(true);
    if (window.google?.script?.run) {
      const token = getSafeStorage('nwm_session_token');
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSyncingRates(false);
          if (onRefresh) onRefresh();
          showMessage(res?.message || 'Live market valuations synchronized!');
        })
        .withFailureHandler((err) => {
          setIsSyncingRates(false);
          showMessage('Sync Error: ' + err.message, true);
        })
        .syncLiveValuationsToSheet(token);
    } else {
      setTimeout(() => {
        setIsSyncingRates(false);
        if (onRefresh) onRefresh();
        showMessage('Live market valuations synchronized (preview)');
      }, 1000);
    }
  };

  const openAddModal = (initialCategory) => {
    setEditingAssetId(null);
    let catToUse = initialCategory;
    if (!catToUse) {
      if (filter !== 'All Assets') {
        catToUse = filter;
      } else {
        catToUse = categoriesList[0] || 'Equity';
      }
    }
    const isInsur = (catToUse || '').toLowerCase().includes('insur') || (catToUse || '').toLowerCase().includes('lic');
    setNewAsset({ 
      Name: '', 
      Category: catToUse, 
      'Current Value': '', 
      Owner: '', 
      'Details JSON': isInsur ? {
        'Policy Type': 'Endowment Plan (Savings + Life Cover)',
        'Premium Frequency': 'Yearly',
        'Grace Period Days': 30
      } : { 'Live Tracking': true } 
    });
    setAttachedFiles([]);
    setUploadProgress('');
    setDeleteConfirmAsset(null);
    setShowAddModal(true);
  };

  useEffect(() => {
    const prefill = sessionStorage.getItem('nwm_prefill_asset_category');
    if (prefill) {
      sessionStorage.removeItem('nwm_prefill_asset_category');
      openAddModal(prefill);
    }
  }, []);

  const openEditModal = (asset) => {
    setEditingAssetId(asset['Asset ID']);
    let details = {};
    try {
      details = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
    } catch (e) {
      details = {};
    }
    
    const safeDocId = details['Safe Document ID'];
    const safeDoc = safeDocId && data?.safe ? data.safe.find(s => String(s['Document ID']) === String(safeDocId)) : null;
    let files = [];
    if (safeDoc && safeDoc['Files JSON']) {
      try {
        files = typeof safeDoc['Files JSON'] === 'string' ? JSON.parse(safeDoc['Files JSON']) : safeDoc['Files JSON'];
      } catch (e) {}
    } else if (details['Files JSON']) {
      try {
        files = typeof details['Files JSON'] === 'string' ? JSON.parse(details['Files JSON']) : details['Files JSON'];
      } catch (e) {
        files = [];
      }
    }
    setAttachedFiles(Array.isArray(files) ? files : []);
    setUploadProgress('');
    setDeleteConfirmAsset(null);
    let acqDate = asset['Acquisition Date'];
    if (typeof acqDate === 'string' && acqDate.includes('T')) {
      acqDate = acqDate.split('T')[0];
    }
    setNewAsset({ ...asset, 'Acquisition Date': acqDate, 'Details JSON': details });
    setShowAddModal(true);
  };

  const handleDelete = () => {
    const currentAsset = assets.find(a => String(a['Asset ID']) === String(editingAssetId)) || newAsset;
    let details = {};
    try {
      details = typeof currentAsset['Details JSON'] === 'string' ? JSON.parse(currentAsset['Details JSON']) : (currentAsset['Details JSON'] || {});
    } catch (e) {}

    let formDetails = {};
    try {
      formDetails = typeof newAsset['Details JSON'] === 'string' ? JSON.parse(newAsset['Details JSON']) : (newAsset['Details JSON'] || {});
    } catch (e) {}

    const safeDocId = details['Safe Document ID'] || formDetails['Safe Document ID'];
    const files = details['Files JSON'] || formDetails['Files JSON'];
    const hasFiles = (Array.isArray(files) && files.length > 0) || (attachedFiles && attachedFiles.length > 0);
    const fileCount = (Array.isArray(files) ? files.length : 0) || (attachedFiles ? attachedFiles.length : 0);
    const assetName = newAsset.Name || currentAsset.Name || 'Asset';

    setDeleteConfirmAsset({
      assetId: editingAssetId,
      assetName: assetName,
      safeDocId: safeDocId,
      hasDocuments: !!(safeDocId || hasFiles),
      fileCount: fileCount
    });
  };

  const confirmDeleteAsset = async (assetId, safeDocId, deleteDocuments) => {
    setIsSubmitting(true);
    setUploadProgress(deleteDocuments ? 'Deleting asset & documents...' : 'Deleting asset...');

    if (window.google?.script?.run) {
      const token = getSafeStorage('nwm_session_token');
      try {
        if (deleteDocuments && safeDocId) {
          await new Promise((resolve) => {
            window.google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler((err) => {
                console.warn('Error deleting safe document, proceeding with asset deletion:', err);
                resolve();
              })
              .deleteSafeDocument(safeDocId, token);
          });
        }

        await new Promise((resolve, reject) => {
          window.google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            .deleteRecord('Assets', 'Asset ID', assetId, token);
        });

        setIsSubmitting(false);
        setUploadProgress('');
        setDeleteConfirmAsset(null);
        setShowAddModal(false);
        if (onRefresh) onRefresh();
        showMessage(deleteDocuments ? 'Asset and supporting documents deleted.' : 'Asset deleted.');
      } catch (err) {
        setIsSubmitting(false);
        setUploadProgress('');
        showMessage('Delete Error: ' + err.message, true);
      }
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        setUploadProgress('');
        setDeleteConfirmAsset(null);
        setShowAddModal(false);
        showMessage(deleteDocuments ? 'Asset & documents deleted (preview)' : 'Asset deleted (preview)');
      }, 1000);
    }
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadProgress('Preparing...');

    try {
      const token = getSafeStorage('nwm_session_token');
      let details = {};
      try {
        details = typeof newAsset['Details JSON'] === 'string' ? JSON.parse(newAsset['Details JSON']) : (newAsset['Details JSON'] || {});
      } catch (e) {
        details = {};
      }

      if (window.google?.script?.run) {
        // 1. Upload newly attached files to Drive
        const filesToUpload = attachedFiles.filter(f => f.isNewUpload);
        const existingFiles = attachedFiles.filter(f => !f.isNewUpload);
        const safeCategory = getSafeCategoryForAsset(newAsset.Category);

        let newlyUploaded = [];
        if (filesToUpload.length > 0) {
          for (let i = 0; i < filesToUpload.length; i++) {
            const f = filesToUpload[i];
            setUploadProgress(`Uploading ${i + 1} of ${filesToUpload.length}...`);
            const uploadRes = await new Promise((resolve, reject) => {
              window.google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .uploadFileToDrive(f.base64, f.name, f.mimeType, safeCategory, token);
            });

            if (uploadRes && uploadRes.status === 'success') {
              newlyUploaded.push({
                name: uploadRes.fileName,
                url: uploadRes.fileUrl,
                id: uploadRes.fileId,
                mimeType: uploadRes.mimeType
              });
            } else {
              throw new Error(uploadRes?.message || `Failed to upload ${f.name}`);
            }
          }
        }

        const finalFiles = [...existingFiles, ...newlyUploaded];
        let safeDocId = details['Safe Document ID'];

        // 2. Sync with Family Safe
        if (finalFiles.length > 0) {
          setUploadProgress('Saving to Family Safe...');
          const safePayload = {
            Name: `${newAsset.Name} - Supporting Documents`,
            Category: safeCategory,
            Owner: newAsset.Owner || 'Self',
            Description: `Supporting documents for asset: ${newAsset.Name} (${newAsset.Category})`,
            'Files JSON': JSON.stringify(finalFiles),
            'Date Added': new Date().toISOString().split('T')[0]
          };

          if (safeDocId) {
            await new Promise((resolve, reject) => {
              window.google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .updateRecord('Safe', 'Document ID', safeDocId, safePayload, token);
            });
          } else {
            const safeRes = await new Promise((resolve, reject) => {
              window.google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .addRecord('Safe', { 'Document ID': '', ...safePayload }, token);
            });
            if (safeRes && safeRes.id) {
              safeDocId = safeRes.id;
            }
          }
        }

        // 3. Update Asset record with updated Details JSON
        setUploadProgress('Saving asset...');
        const finalDetails = {
          ...details,
          'Files JSON': finalFiles,
          'Safe Document ID': safeDocId || ''
        };

        const assetPayload = {
          ...newAsset,
          'Details JSON': finalDetails
        };

        if (editingAssetId) {
          await new Promise((resolve, reject) => {
            window.google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .updateRecord('Assets', 'Asset ID', editingAssetId, assetPayload, token);
          });
        } else {
          await new Promise((resolve, reject) => {
            window.google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .addRecord('Assets', {
                ...assetPayload,
                'Asset ID': '',
                'Acquisition Date': assetPayload['Acquisition Date'] || new Date().toISOString().split('T')[0]
              }, token);
          });
        }

        setIsSubmitting(false);
        setUploadProgress('');
        setShowAddModal(false);
        if (onRefresh) onRefresh();
        showMessage(editingAssetId ? 'Asset updated successfully' : 'Asset added successfully');
      } else {
        setTimeout(() => {
          setIsSubmitting(false);
          setUploadProgress('');
          setShowAddModal(false);
          showMessage(editingAssetId ? 'Asset updated (preview)' : 'Asset added (preview)');
        }, 1000);
      }
    } catch (err) {
      setIsSubmitting(false);
      setUploadProgress('');
      showMessage('Save Error: ' + err.message, true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Assets & Liabilities</h2>
          <div className="flex items-center flex-wrap gap-2 mt-1">
            <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald animate-pulse"></span>
              Google Finance & AMFI Live
            </span>
            <span className="text-text-muted text-[10px]">•</span>
            <button 
              type="button"
              onClick={handleSyncRates} 
              disabled={isSyncingRates}
              title="Refresh and sync live valuations to spreadsheet"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-wealth-emerald/10 hover:bg-wealth-emerald/20 border border-wealth-emerald/25 text-wealth-emerald rounded-full text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={10} className={isSyncingRates ? 'animate-spin' : ''} />
              <span>{isSyncingRates ? 'Syncing...' : 'Sync Rates'}</span>
            </button>
            {onOpenRebalancer && (
              <>
                <span className="text-text-muted text-[10px]">•</span>
                <button 
                  type="button"
                  onClick={onOpenRebalancer} 
                  title="Open AI Portfolio Rebalancer & Asset Allocation Advisor"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-accent/10 hover:bg-primary-accent/20 border border-primary-accent/25 text-primary-accent rounded-full text-[11px] font-medium transition-all active:scale-95"
                >
                  <Sparkles size={10} />
                  <span>AI Rebalance</span>
                </button>
              </>
            )}
            {onOpenRetirementPlanner && (
              <>
                <span className="text-text-muted text-[10px]">•</span>
                <button 
                  type="button"
                  onClick={onOpenRetirementPlanner} 
                  title="Open Retirement & Pension Hub (EPF, PPF & NPS)"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 text-sky-400 rounded-full text-[11px] font-medium transition-all active:scale-95"
                >
                  <Shield size={10} />
                  <span>Retirement Hub</span>
                </button>
              </>
            )}
            {onOpenInsuranceHub && (
              <>
                <span className="text-text-muted text-[10px]">•</span>
                <button 
                  type="button"
                  onClick={onOpenInsuranceHub} 
                  title="Open Insurance & Protection Hub (LIC, Term, Health)"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 rounded-full text-[11px] font-medium transition-all active:scale-95"
                >
                  <Shield size={10} />
                  <span>Insurance Hub</span>
                </button>
              </>
            )}
          </div>
        </div>
        <button 
          type="button"
          onClick={openAddModal} 
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-accent hover:bg-primary-accent/90 text-white rounded-lg text-xs font-semibold shadow-md shadow-primary-accent/20 transition-all active:scale-95 flex-shrink-0"
        >
          <Plus size={14} />
          <span>Add Asset</span>
        </button>
      </div>
      <div 
        className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide no-swipe"
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseMove={e => e.stopPropagation()}
      >
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${f === filter ? 'bg-primary-accent text-white shadow-sm font-semibold' : 'bg-surface-layer1 hover:bg-surface-layer2 text-text-secondary hover:text-text-primary border border-border-subtle shadow-xs'}`}>
            {f}
          </button>
        ))}
      </div>
      
      {/* Asset List */}
      <div className="space-y-3">
        {filteredAssets.length === 0 && (
           <p className="text-text-secondary text-sm text-center py-8">No assets found for this category.</p>
        )}
        {filteredAssets.map((asset, i) => {
          let docCount = 0;
          let det = {};
          try {
            det = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
            const files = det['Files JSON'];
            if (Array.isArray(files)) docCount = files.length;
            else if (typeof files === 'string') docCount = JSON.parse(files).length;
          } catch (e) {}

          const cat = asset.Category;
          let holdingSummary = '';
          if (cat === 'Equity' && (det['Quantity'] || det['Units'])) {
            const q = det['Quantity'] || det['Units'];
            holdingSummary = `${q} shares` + (det['Average Buy Price'] ? ` @ avg ₹${det['Average Buy Price']}` : '');
          } else if (cat === 'Gold') {
            const ff = String(det['Form Factor'] || '');
            if (ff.includes('ETF') || ff.includes('SGB')) {
              holdingSummary = `${det['Units'] || det['Quantity'] || 0} units`;
            } else {
              holdingSummary = `${det['Weight (Grams)'] || 0}g` + (det['Purity'] ? ` (${det['Purity'].split(' ')[0]})` : '');
            }
          } else if (cat === 'Mutual Funds' && (det['Units'] || det['Quantity'])) {
            const u = det['Units'] || det['Quantity'];
            holdingSummary = `${u} units` + (det['Average NAV'] ? ` @ avg ₹${det['Average NAV']}` : '');
          } else if ((cat || '').toLowerCase().includes('retire') || (cat || '').toLowerCase().includes('provident')) {
            const rt = det['Retirement Type'] || det['Fund Type'] || 'Retirement';
            if (det['Interest Rate']) {
              holdingSummary = `${det['Interest Rate']}% p.a. • ${rt}`;
            } else if (det['Allocation Equity E']) {
              holdingSummary = `E:${det['Allocation Equity E']}% C:${det['Allocation Corp Debt C'] || 0}% • ${rt}`;
            } else {
              holdingSummary = rt;
            }
          } else if (isInsuranceAsset(asset)) {
            const polMetrics = calculatePolicyMetrics(asset);
            const coverStr = polMetrics.sumAssured > 0 
              ? `Cover: ₹${(polMetrics.sumAssured / 100000).toFixed(0)}L` 
              : (polMetrics.healthCover > 0 ? `Cover: ₹${(polMetrics.healthCover / 100000).toFixed(0)}L` : '');
            const dueStr = polMetrics.nextDueDate ? `Due: ${polMetrics.nextDueDate}` : '';
            holdingSummary = [polMetrics.policyType, coverStr, dueStr].filter(Boolean).join(' • ');
          }

          const isLive = asset['Is Live'] || (asset['Live Price'] && Number(asset['Live Price']) > 0);
          const pnl = asset['P&L'];
          const pnlPct = asset['P&L %'];
          const polMetrics = isInsuranceAsset(asset) ? calculatePolicyMetrics(asset) : null;

          const perf = (asset['CAGR'] !== undefined && asset['CAGR'] !== null)
            ? { holdingStr: asset['Holding Period'], cagr: asset['CAGR'], taxTag: asset['Tax Tag'], taxLabel: asset['Tax Label'] }
            : calculatePerformance(asset.Cost, asset['Current Value'], asset['Acquisition Date'], asset.Category);

          return (
            <div 
              key={asset['Asset ID'] || i} 
              onClick={() => openEditModal(asset)}
              className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 shadow-sm cursor-pointer hover:border-primary-accent/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{asset.Name}</p>
                    {isLive && (
                      <Badge variant="emerald" dot pulse size="xs">
                        Live
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-2 mt-0.5">
                    <span className="text-xs text-text-muted">{asset.Category}</span>
                    {holdingSummary && (
                      <>
                        <span className="text-text-muted text-[10px]">•</span>
                        <span className="text-xs text-text-secondary">{holdingSummary}</span>
                      </>
                    )}
                    {perf?.holdingStr && (
                      <>
                        <span className="text-text-muted text-[10px]">•</span>
                        <span className="text-[11px] text-text-muted">Held: {perf.holdingStr}</span>
                      </>
                    )}
                    {perf?.taxTag && (
                      <span 
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${perf.taxTag === 'LTCG' ? 'bg-wealth-emerald/15 text-wealth-emerald border-wealth-emerald/30' : 'bg-bullion-amber/15 text-bullion-amber border-bullion-amber/30'}`}
                        title={perf.taxLabel}
                      >
                        {perf.taxTag}
                      </span>
                    )}
                    {docCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-primary-accent bg-primary-accent/10 px-1.5 py-0.5 rounded border border-primary-accent/20 font-medium">
                        <Paperclip size={10} />
                        {docCount} {docCount === 1 ? 'doc' : 'docs'}
                      </span>
                    )}
                    {polMetrics?.isOverdue && (
                      <Badge variant="rose" size="xs">Grace Period Active</Badge>
                    )}
                    {polMetrics?.isDueSoon && (
                      <Badge variant="amber" size="xs">Due in {polMetrics.daysUntilDue}d</Badge>
                    )}
                  </div>
                </div>
                <span className="bg-surface-layer2 text-[10px] px-2 py-1 rounded text-text-secondary border border-border-subtle">{asset.Owner || 'Self'}</span>
              </div>

              <div className="flex justify-between items-end border-t border-border-subtle/40 pt-2 mt-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-text-secondary">Current Value</p>
                    {isLive && asset['Live Price'] && (
                      <span className="text-[10px] text-text-muted">
                        (@ {formatCurrency(asset['Live Price'])}{cat === 'Gold' && !String(det['Form Factor'] || '').includes('ETF') && !String(det['Form Factor'] || '').includes('SGB') ? '/g' : ''})
                      </span>
                    )}
                  </div>
                  <p className={`text-lg font-bold tabular-nums mt-0.5 ${asset.Category === 'Liabilities' ? 'text-liability-rose' : 'text-wealth-emerald'}`}>{formatCurrency(asset['Current Value'])}</p>
                </div>
                
                <div className="text-right">
                  {pnl !== undefined && Number(asset.Cost) > 0 ? (
                    <div>
                      <p className="text-[10px] text-text-muted">Total Return</p>
                      <p className={`text-xs font-semibold tabular-nums ${pnl >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct}%)
                      </p>
                      {perf?.cagr !== undefined && perf?.cagr !== null && (
                        <p className="text-[10px] font-medium text-primary-accent tabular-nums">
                          {perf.cagr >= 0 ? '+' : ''}{perf.cagr}% p.a.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-primary-accent/70 text-xs hover:text-primary-accent">Edit</div>
                  )}
                </div>
              </div>

              {polMetrics?.ppt > 0 && polMetrics?.isInvestment && (
                <div className="mt-2 pt-2 border-t border-border-subtle/30">
                  <div className="flex justify-between text-[10px] text-text-muted mb-1">
                    <span>Premium Term ({polMetrics.paidYears} / {polMetrics.ppt} Yrs)</span>
                    <span className="font-semibold text-text-secondary">{polMetrics.pptProgressPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 w-full bg-surface-layer2 rounded-full overflow-hidden">
                    <div className="bg-primary-accent h-full rounded-full" style={{ width: `${polMetrics.pptProgressPct}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Add/Edit Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 no-swipe flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4" onClick={() => setShowAddModal(false)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-lg md:max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
             {/* Pinned Modal Header */}
             <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-layer1 flex-shrink-0">
               <div>
                 <h3 className="text-base sm:text-lg font-bold text-text-primary leading-tight">
                   {editingAssetId ? 'Edit Asset' : 'Add New Asset'}
                 </h3>
                 <p className="text-[11px] text-text-muted mt-0.5">
                   {newAsset.Category || categoriesList[0] || 'Asset'} Details & Live Valuation
                 </p>
               </div>
               <button 
                 type="button" 
                 onClick={() => setShowAddModal(false)}
                 className="text-text-muted hover:text-text-primary p-1.5 hover:bg-surface-layer2 rounded-lg transition-colors"
                 title="Close"
               >
                 <X size={18} />
               </button>
             </div>
             
             {!editingAssetId && (
               <div className="px-5 pt-3 pb-2 border-b border-border-subtle/50 bg-surface-layer2/30 flex-shrink-0">
                 <label className="block text-xs text-text-secondary mb-1">Asset Category</label>
                 <select 
                   value={newAsset.Category || categoriesList[0] || ''} 
                   onChange={e => {
                     const newCat = e.target.value;
                     const isIns = (newCat || '').toLowerCase().includes('insur') || (newCat || '').toLowerCase().includes('lic');
                     setNewAsset(prev => ({
                       ...prev, 
                       Category: newCat,
                       'Details JSON': isIns ? {
                         ...(prev['Details JSON'] || {}),
                         'Policy Type': prev['Details JSON']?.['Policy Type'] || 'Endowment Plan (Savings + Life Cover)',
                         'Premium Frequency': prev['Details JSON']?.['Premium Frequency'] || 'Yearly',
                         'Grace Period Days': prev['Details JSON']?.['Grace Period Days'] || 30
                       } : prev['Details JSON']
                     }));
                   }} 
                   className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-1.5 text-text-primary text-xs focus:outline-none focus:border-primary-accent"
                 >
                   {categoriesList.map(cat => (
                     <option key={cat} value={cat}>{cat}</option>
                   ))}
                 </select>
               </div>
             )}

             <DynamicForm 
               category={newAsset.Category || categoriesList[0] || ''}
               formData={newAsset}
               setFormData={setNewAsset}
               profiles={profiles}
               onSubmit={handleSaveAsset}
               onCancel={() => setShowAddModal(false)}
               isSubmitting={isSubmitting}
               isEditing={!!editingAssetId}
               onDelete={handleDelete}
               attachedFiles={attachedFiles}
               setAttachedFiles={setAttachedFiles}
               uploadProgress={uploadProgress}
               marketQuotes={data?.marketQuotesMap || {}}
               formatCurrency={formatCurrency}
             />
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Assets */}
      {deleteConfirmAsset && (
        <div 
          className="fixed inset-0 z-[60] no-swipe flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" 
          onClick={() => !isSubmitting && setDeleteConfirmAsset(null)}
        >
          <div 
            className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-liability-rose/15 text-liability-rose">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Delete Asset</h3>
                <p className="text-xs text-text-muted">
                  {deleteConfirmAsset.hasDocuments ? 'Confirm document retention' : 'Permanent action'}
                </p>
              </div>
            </div>

            {deleteConfirmAsset.hasDocuments ? (
              <div className="bg-surface-layer2/60 border border-border-subtle rounded-xl p-3 text-xs leading-relaxed text-text-secondary space-y-2">
                <p>
                  <strong className="text-text-primary">"{deleteConfirmAsset.assetName}"</strong> has{' '}
                  <strong className="text-primary-accent">{deleteConfirmAsset.fileCount} supporting document(s)</strong> linked in <strong className="text-text-primary">Family Safe</strong>.
                </p>
                <p>
                  Do you also want to permanently delete the supporting documents from Family Safe and Google Drive?
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                Are you sure you want to delete <strong className="text-text-primary">"{deleteConfirmAsset.assetName}"</strong>? This will permanently remove the asset record.
              </p>
            )}

            <div className="space-y-2 pt-2">
              {deleteConfirmAsset.hasDocuments ? (
                <>
                  <button 
                    type="button" 
                    disabled={isSubmitting}
                    onClick={() => confirmDeleteAsset(deleteConfirmAsset.assetId, deleteConfirmAsset.safeDocId, true)}
                    className="w-full py-2.5 px-4 bg-liability-rose hover:bg-liability-rose/90 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>{isSubmitting ? (uploadProgress || 'Deleting...') : 'Delete Asset & Supporting Documents'}</span>
                  </button>

                  <button 
                    type="button" 
                    disabled={isSubmitting}
                    onClick={() => confirmDeleteAsset(deleteConfirmAsset.assetId, deleteConfirmAsset.safeDocId, false)}
                    className="w-full py-2.5 px-4 bg-surface-layer2 hover:bg-surface-layer1 border border-white/[0.08] hover:border-white/[0.14] text-text-primary rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Lock size={14} className="text-wealth-emerald" />
                    <span>{isSubmitting ? (uploadProgress || 'Deleting...') : 'Delete Asset Only (Keep in Family Safe)'}</span>
                  </button>
                </>
              ) : (
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => confirmDeleteAsset(deleteConfirmAsset.assetId, null, false)}
                  className="w-full py-2.5 px-4 bg-liability-rose hover:bg-liability-rose/90 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  <span>{isSubmitting ? (uploadProgress || 'Deleting...') : 'Delete Asset'}</span>
                </button>
              )}

              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => setDeleteConfirmAsset(null)}
                className="w-full py-2 px-4 text-text-muted hover:text-text-primary text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
