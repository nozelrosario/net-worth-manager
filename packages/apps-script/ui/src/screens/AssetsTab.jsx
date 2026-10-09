import { getSafeStorage } from "../utils/storage";
import React, { useState } from 'react';
import DynamicForm from "../components/DynamicForm";

export default function AssetsTab({ formatCurrency, data, onRefresh, showMessage }) {
  const [filter, setFilter] = useState('All Assets');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [newAsset, setNewAsset] = useState({ Name: '', Category: 'Equity', 'Current Value': '', Owner: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setNewAsset({ Name: '', Category: categoriesList[0] || 'Equity', 'Current Value': '', Owner: '' });
    setShowAddModal(true);
  };

  const openEditModal = (asset) => {
    setEditingAssetId(asset['Asset ID']);
    setNewAsset({ ...asset });
    setShowAddModal(true);
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this asset?")) return;
    setIsSubmitting(true);
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSubmitting(false);
          setShowAddModal(false);
          if (onRefresh) onRefresh();
          showMessage(res.message);
        })
        .withFailureHandler((err) => {
          setIsSubmitting(false);
          showMessage('Error: ' + err.message, true);
        })
        .deleteRecord('Assets', 'Asset ID', id, getSafeStorage('nwm_session_token'));
    } else {
      setTimeout(() => { setIsSubmitting(false); setShowAddModal(false); showMessage('Deleted (preview)'); }, 1000);
    }
  };

  const handleSaveAsset = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (window.google?.script?.run) {
      const token = getSafeStorage('nwm_session_token');
      const handler = window.google.script.run
        .withSuccessHandler((res) => {
          setIsSubmitting(false);
          setShowAddModal(false);
          if (onRefresh) onRefresh();
          showMessage(res.message);
        })
        .withFailureHandler((err) => {
          setIsSubmitting(false);
          showMessage('Error: ' + err.message, true);
        });

      if (editingAssetId) {
         handler.updateRecord('Assets', 'Asset ID', editingAssetId, newAsset, token);
      } else {
         handler.addRecord('Assets', {
           ...newAsset,
           'Asset ID': '',
           'Acquisition Date': newAsset['Acquisition Date'] || new Date().toISOString().split('T')[0]
         }, token);
      }
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        setShowAddModal(false);
        showMessage(editingAssetId ? 'Asset updated (preview)' : 'Asset added (preview)');
      }, 1000);
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
        {filteredAssets.map((asset, i) => (
          <div 
            key={asset['Asset ID'] || i} 
            onClick={() => openEditModal(asset)}
            className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 shadow-sm cursor-pointer hover:border-primary-accent/50 transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm font-medium text-white">{asset.Name}</p>
                <p className="text-xs text-text-muted mt-0.5">{asset.Category}</p>
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
        ))}
      </div>
      
      {/* Add/Edit Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
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
               onDelete={() => handleDelete(editingAssetId)}
             />
           </div>
        </div>
      )}
    </div>
  );
}
