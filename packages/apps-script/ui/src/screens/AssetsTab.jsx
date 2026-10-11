import useModalBack from "../hooks/useModalBack";
import { getSafeStorage } from "../utils/storage";
import React, { useState } from 'react';
import DynamicForm from "../components/DynamicForm";
import { AlertTriangle, Trash2, Lock, Paperclip } from 'lucide-react';

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

export default function AssetsTab({ formatCurrency, data, onRefresh, showMessage }) {
  const [filter, setFilter] = useState('All Assets');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [newAsset, setNewAsset] = useState({ Name: '', Category: 'Equity', 'Current Value': '', Owner: '' });
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useModalBack(showAddModal, () => {
    if (deleteConfirmAsset) {
      setDeleteConfirmAsset(null);
    } else {
      setShowAddModal(false);
    }
  });

  const assets = data?.assets || [];
  
  const defaultCategories = 'Equity, Real Estate, Gold, Cash/FD, Liabilities';
  const customCategoriesStr = data?.settings?.find(s => s['Setting Key'] === 'AssetCategories')?.['Setting Value'] || defaultCategories;
  const categoriesList = customCategoriesStr.split(',').map(s => s.trim()).filter(Boolean);
  const profiles = data?.familyProfiles || [];
  
  const filters = ['All Assets', ...categoriesList];
  
  const filteredAssets = filter === 'All Assets' 
    ? assets 
    : assets.filter(a => a.Category === filter);

  const openAddModal = () => {
    setEditingAssetId(null);
    setNewAsset({ Name: '', Category: categoriesList[0] || 'Equity', 'Current Value': '', Owner: '', 'Details JSON': {} });
    setAttachedFiles([]);
    setUploadProgress('');
    setDeleteConfirmAsset(null);
    setShowAddModal(true);
  };

  const openEditModal = (asset) => {
    setEditingAssetId(asset['Asset ID']);
    let details = {};
    try {
      details = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
    } catch (e) {
      details = {};
    }
    
    let files = [];
    if (details['Files JSON']) {
      try {
        files = typeof details['Files JSON'] === 'string' ? JSON.parse(details['Files JSON']) : details['Files JSON'];
      } catch (e) {
        files = [];
      }
    }
    setAttachedFiles(Array.isArray(files) ? files : []);
    setUploadProgress('');
    setDeleteConfirmAsset(null);
    setNewAsset({ ...asset, 'Details JSON': details });
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
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold">Assets & Liabilities</h2>
        <button onClick={openAddModal} className="text-primary-accent text-sm font-medium bg-primary-accent/10 px-3 py-1.5 rounded-lg">+ Add Asset</button>
      </div>
      <div 
        className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide no-swipe"
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseMove={e => e.stopPropagation()}
      >
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${f === filter ? 'bg-primary-accent text-white' : 'bg-surface-layer2 text-text-secondary border border-border-subtle hover:bg-surface-layer1'}`}>
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
          try {
            const det = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
            const files = det['Files JSON'];
            if (Array.isArray(files)) docCount = files.length;
            else if (typeof files === 'string') docCount = JSON.parse(files).length;
          } catch (e) {}

          return (
            <div 
              key={asset['Asset ID'] || i} 
              onClick={() => openEditModal(asset)}
              className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 shadow-sm cursor-pointer hover:border-primary-accent/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-medium text-white">{asset.Name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted">{asset.Category}</span>
                    {docCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-primary-accent bg-primary-accent/10 px-1.5 py-0.5 rounded border border-primary-accent/20 font-medium">
                        <Paperclip size={10} />
                        {docCount} {docCount === 1 ? 'doc' : 'docs'}
                      </span>
                    )}
                  </div>
                </div>
                <span className="bg-surface-layer2 text-[10px] px-2 py-1 rounded text-text-secondary border border-border-subtle">{asset.Owner || 'Self'}</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-text-secondary">Current Value</p>
                  <p className={`text-lg font-bold tabular-nums mt-0.5 ${asset.Category === 'Liabilities' ? 'text-liability-rose' : 'text-wealth-emerald'}`}>{formatCurrency(asset['Current Value'])}</p>
                </div>
                <div className="text-primary-accent/70 text-xs">Edit</div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Add/Edit Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 no-swipe flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
             <h3 className="text-lg font-bold mb-4 text-white">{editingAssetId ? 'Edit Asset' : 'Add New Asset'}</h3>
             
             {!editingAssetId && (
               <div className="mb-4">
                 <label className="block text-xs text-text-secondary mb-1">Asset Category</label>
                 <select value={newAsset.Category || categoriesList[0] || ''} onChange={e => setNewAsset({...newAsset, Category: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent">
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
                <h3 className="text-base font-bold text-white">Delete Asset</h3>
                <p className="text-xs text-text-muted">
                  {deleteConfirmAsset.hasDocuments ? 'Confirm document retention' : 'Permanent action'}
                </p>
              </div>
            </div>

            {deleteConfirmAsset.hasDocuments ? (
              <div className="bg-surface-layer2/60 border border-border-subtle rounded-xl p-3 text-xs leading-relaxed text-text-secondary space-y-2">
                <p>
                  <strong className="text-white">"{deleteConfirmAsset.assetName}"</strong> has{' '}
                  <strong className="text-primary-accent">{deleteConfirmAsset.fileCount} supporting document(s)</strong> linked in <strong className="text-white">Family Safe</strong>.
                </p>
                <p>
                  Do you also want to permanently delete the supporting documents from Family Safe and Google Drive?
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                Are you sure you want to delete <strong className="text-white">"{deleteConfirmAsset.assetName}"</strong>? This will permanently remove the asset record.
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
                    className="w-full py-2.5 px-4 bg-surface-layer2 hover:bg-surface-layer1 border border-border-prominent text-text-primary rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
                className="w-full py-2 px-4 text-text-muted hover:text-white text-xs font-medium transition-colors"
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
