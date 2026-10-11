import useModalBack from "../hooks/useModalBack";
import React, { useState } from 'react';
import { Lock, FileText, User, PlusCircle, Link as LinkIcon, Upload, Trash2, ExternalLink, X, File, Pencil } from 'lucide-react';
import { getSafeStorage } from '../utils/storage';

export default function SafeTab({ formatCurrency, data, onRefresh, showMessage }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  useModalBack(showAddModal, () => {
    setShowAddModal(false);
    setEditingDocId(null);
  });
  const [previewDoc, setPreviewDoc] = useState(null);
  useModalBack(!!previewDoc, () => setPreviewDoc(null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  
  const [newEntry, setNewEntry] = useState({
    Name: '',
    Category: 'Identity',
    Owner: '',
    Description: '',
    linkInput: ''
  });
  
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [filesToRemove, setFilesToRemove] = useState([]);

  const safeDocs = data?.safe || [];
  const profiles = data?.familyProfiles || [];
  
  const defaultSafeCategories = 'Identity, Finance, Property, Medical, Vehicle, Education, Tax, Other';
  const customSafeCategoriesStr = data?.settings?.find(s => s['Setting Key'] === 'SafeCategories')?.['Setting Value'] || defaultSafeCategories;
  const categoriesList = customSafeCategoriesStr.split(',').map(s => s.trim()).filter(Boolean);
  
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedFiles(prev => [...prev, {
          id: 'new_' + Math.random().toString(36).substring(2, 9),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64: ev.target.result,
          isNewUpload: true
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddLink = () => {
    if (!newEntry.linkInput || !newEntry.linkInput.trim()) return;
    setAttachedFiles(prev => [...prev, {
      id: 'link_' + Math.random().toString(36).substring(2, 9),
      name: newEntry.linkInput.trim().substring(0, 30) + '...',
      url: newEntry.linkInput.trim(),
      isLink: true
    }]);
    setNewEntry({ ...newEntry, linkInput: '' });
  };

  const removeFile = (id) => {
    const fileToRemove = attachedFiles.find(f => f.id === id);
    if (fileToRemove && !fileToRemove.isNewUpload && !fileToRemove.isLink && fileToRemove.id) {
      setFilesToRemove(prev => [...prev, fileToRemove.id]);
    }
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFilesSequential = async (filesToUpload, category, token) => {
    const uploaded = [];
    for (let i = 0; i < filesToUpload.length; i++) {
      const f = filesToUpload[i];
      setUploadProgress(`Uploading ${i+1} of ${filesToUpload.length}...`);
      
      const result = await new Promise((resolve, reject) => {
        window.google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .uploadFileToDrive(f.base64, f.name, f.mimeType, category, token);
      });
      
      if (result && result.status === 'success') {
        uploaded.push({
          name: result.fileName,
          url: result.fileUrl,
          id: result.fileId,
          mimeType: result.mimeType
        });
      } else {
        throw new Error(result?.message || 'File upload failed');
      }
    }
    return uploaded;
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadProgress('Preparing...');
    
    try {
      if (window.google?.script?.run) {
        const token = getSafeStorage('nwm_session_token');
        
        // 1. Upload new files to Drive
        const filesToUpload = attachedFiles.filter(f => f.isNewUpload);
        const existingFiles = attachedFiles.filter(f => !f.isNewUpload).map(f => ({
          name: f.name,
          url: f.url,
          id: f.id,
          mimeType: f.mimeType,
          isLink: f.isLink
        }));
        
        if (newEntry.linkInput && newEntry.linkInput.trim()) {
           existingFiles.push({
             name: newEntry.linkInput.trim().substring(0, 30) + '...',
             url: newEntry.linkInput.trim(),
             isLink: true
           });
        }
        
        let uploadedFiles = [];
        if (filesToUpload.length > 0) {
          uploadedFiles = await uploadFilesSequential(filesToUpload, newEntry.Category, token);
        }
        
        const finalFiles = [...existingFiles, ...uploadedFiles];
        const finalFilesJSON = JSON.stringify(finalFiles);
        
        // 2. Trash removed Drive files if any
        if (filesToRemove.length > 0) {
          for (const fid of filesToRemove) {
            try {
              await new Promise((resolve) => {
                window.google.script.run
                  .withSuccessHandler(resolve)
                  .withFailureHandler(resolve)
                  .trashDriveFile(fid, token);
              });
            } catch(err) {}
          }
        }

        // 3. Save or Update record in DB
        setUploadProgress('Saving record...');
        
        const payload = {
          Name: newEntry.Name,
          Category: newEntry.Category,
          Owner: newEntry.Owner,
          Description: newEntry.Description,
          'Files JSON': finalFilesJSON
        };

        if (editingDocId) {
          await new Promise((resolve, reject) => {
            window.google.script.run
              .withSuccessHandler((res) => {
                setIsSubmitting(false);
                setUploadProgress('');
                setShowAddModal(false);
                setEditingDocId(null);
                if (onRefresh) onRefresh();
                showMessage(res.message || 'Document updated successfully');
                resolve(res);
              })
              .withFailureHandler((err) => {
                setIsSubmitting(false);
                setUploadProgress('');
                showMessage('Error: ' + err.message, true);
                reject(err);
              })
              .updateRecord('Safe', 'Document ID', editingDocId, payload, token);
          });
        } else {
          const addPayload = {
            'Document ID': '',
            ...payload,
            'Date Added': new Date().toISOString().split('T')[0]
          };
          await new Promise((resolve, reject) => {
            window.google.script.run
              .withSuccessHandler((res) => {
                setIsSubmitting(false);
                setUploadProgress('');
                setShowAddModal(false);
                setEditingDocId(null);
                if (onRefresh) onRefresh();
                showMessage(res.message || 'Document saved successfully');
                resolve(res);
              })
              .withFailureHandler((err) => {
                setIsSubmitting(false);
                setUploadProgress('');
                showMessage('Error: ' + err.message, true);
                reject(err);
              })
              .addRecord('Safe', addPayload, token);
          });
        }
      } else {
        setTimeout(() => {
          setIsSubmitting(false);
          setUploadProgress('');
          setShowAddModal(false);
          setEditingDocId(null);
          showMessage(editingDocId ? 'Document updated (preview)' : 'Document saved (preview)');
        }, 1500);
      }
    } catch (err) {
      setIsSubmitting(false);
      setUploadProgress('');
      showMessage('Operation Failed: ' + err.message, true);
    }
  };

  const handleDeleteEntry = (docId) => {
    if (!window.confirm("Are you sure you want to delete this entry? Associated Drive files will be moved to Trash.")) return;
    setIsSubmitting(true);
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSubmitting(false);
          if (onRefresh) onRefresh();
          showMessage(res.message);
        })
        .withFailureHandler((err) => {
          setIsSubmitting(false);
          showMessage('Delete Error: ' + err.message, true);
        })
        .deleteSafeDocument(docId, getSafeStorage('nwm_session_token'));
    } else {
      setTimeout(() => { setIsSubmitting(false); showMessage('Deleted (preview)'); }, 1000);
    }
  };
  
  const resetForm = () => {
    setEditingDocId(null);
    setNewEntry({
      Name: '', Category: categoriesList[0] || 'Identity', Owner: '', Description: '', linkInput: ''
    });
    setAttachedFiles([]);
    setFilesToRemove([]);
    setShowAddModal(true);
  };

  const openEditModal = (doc) => {
    setEditingDocId(doc['Document ID']);
    setNewEntry({
      Name: doc.Name || '',
      Category: doc.Category || categoriesList[0] || 'Identity',
      Owner: doc.Owner || '',
      Description: doc.Description || '',
      linkInput: ''
    });
    const files = getFilesList(doc['Files JSON']);
    setAttachedFiles(Array.isArray(files) ? files.map(f => ({ ...f, id: f.id || Math.random().toString() })) : []);
    setFilesToRemove([]);
    setShowAddModal(true);
  };

  const getFilesList = (jsonStr) => {
    try {
      return JSON.parse(jsonStr || '[]');
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold">Family Safe</h2>
        <button onClick={resetForm} className="flex items-center space-x-1 px-3 py-1.5 bg-primary-accent/10 hover:bg-primary-accent/20 border border-primary-accent/20 rounded-full text-primary-accent transition-transform active:scale-95">
          <PlusCircle size={16} />
          <span className="text-sm font-semibold">New Entry</span>
        </button>
      </div>

      <div className="bg-gradient-to-br from-surface-layer1 to-surface-layer2 border border-border-subtle rounded-xl p-5 relative overflow-hidden shadow-lg">
        <div className="absolute -right-4 -top-4 p-4 opacity-[0.03]"><Lock size={120} /></div>
        <p className="text-sm font-medium text-white mb-2 flex items-center gap-2"><Lock size={16} className="text-wealth-emerald" /> Secure Document Vault</p>
        <p className="text-xs text-text-secondary max-w-[85%] leading-relaxed">
          Store critical family documents. Files are securely uploaded directly to a "Family Safe" folder in your connected Google Drive.
        </p>
      </div>

      {/* Document List */}
      <div className="space-y-3 mt-6">
        <h3 className="text-sm font-semibold text-text-primary">Saved Documents</h3>
        {safeDocs.length === 0 ? (
           <p className="text-text-secondary text-sm text-center py-8">No documents found. Add your first entry.</p>
        ) : (
          safeDocs.map((doc, i) => {
            const files = getFilesList(doc['Files JSON']);
            return (
              <div key={doc['Document ID'] || i} className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 shadow-sm hover:border-border-prominent transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{doc.Name}</h4>
                    <p className="text-xs text-text-secondary mt-0.5">{doc.Category} • {doc.Owner || 'Self'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] text-text-muted bg-surface-layer2 px-2 py-1 rounded">{new Date(doc['Date Added']).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEditModal(doc)} 
                        className="text-primary-accent p-1.5 hover:bg-primary-accent/10 rounded-lg transition-colors"
                        title="Edit entry"
                      >
                        <Pencil size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteEntry(doc['Document ID'])} 
                        className="text-liability-rose p-1.5 hover:bg-liability-rose/10 rounded-lg transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                {doc.Description && (
                  <p className="text-xs text-text-muted mt-2 italic">"{doc.Description}"</p>
                )}
                <div className="mt-4 space-y-2">
                  {files.map((f, idx) => (
                    <div key={idx} onClick={() => setPreviewDoc(f)} className="flex items-center justify-between p-2 rounded-lg bg-surface-layer2/50 border border-border-subtle cursor-pointer hover:border-primary-accent/50 hover:bg-surface-layer2 transition-colors">
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <FileText size={14} className="text-primary-accent flex-shrink-0" />
                        <span className="text-xs text-text-primary truncate">{f.name || 'Untitled Document'}</span>
                      </div>
                      <ExternalLink size={14} className="text-text-muted flex-shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 no-swipe flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowAddModal(false); setEditingDocId(null); }}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
             <h3 className="text-lg font-bold mb-4 text-white">{editingDocId ? 'Edit Safe Document' : 'Add to Family Safe'}</h3>
             
             <form onSubmit={handleSaveEntry} className="space-y-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Entry Title</label>
                  <input required value={newEntry.Name} onChange={e => setNewEntry({...newEntry, Name: e.target.value})} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" placeholder="e.g. Life Insurance Policy 2026" />
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-text-secondary mb-1">Category</label>
                    <select value={newEntry.Category} onChange={e => setNewEntry({...newEntry, Category: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent">
                      {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-text-secondary mb-1">Owner</label>
                    <select value={newEntry.Owner} onChange={e => setNewEntry({...newEntry, Owner: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent">
                      <option value="">Self</option>
                      {profiles.map(p => <option key={p.Name} value={p.Name}>{p.Name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1">Description (Optional)</label>
                  <textarea value={newEntry.Description} onChange={e => setNewEntry({...newEntry, Description: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent h-20 resize-none" placeholder="Brief details about these documents..." />
                </div>

                <div className="pt-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-text-secondary font-medium">Attached Documents</label>
                    {attachedFiles.length > 0 && (
                      <span className="text-[10px] text-primary-accent bg-primary-accent/15 px-2 py-0.5 rounded-full font-semibold border border-primary-accent/20">
                        {attachedFiles.length} {attachedFiles.length === 1 ? 'file' : 'files'}
                      </span>
                    )}
                  </div>
                  
                  {/* File List */}
                  {attachedFiles.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {attachedFiles.map(f => (
                        <div key={f.id} className="flex justify-between items-center bg-surface-layer2 p-2.5 rounded-lg border border-border-subtle hover:border-border-prominent transition-colors">
                          <div className="flex items-center space-x-2 overflow-hidden flex-1 mr-2">
                            {f.isLink ? <LinkIcon size={14} className="text-blue-400 flex-shrink-0" /> : <File size={14} className="text-wealth-emerald flex-shrink-0" />}
                            <div className="truncate flex-1">
                              <span className="text-xs text-text-primary truncate block font-medium">{f.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {f.isNewUpload ? (
                                  <span className="text-[10px] text-primary-accent bg-primary-accent/10 px-1.5 py-0.2 rounded font-medium">Ready to upload</span>
                                ) : (
                                  <span className="text-[10px] text-wealth-emerald bg-wealth-emerald/10 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                                    <Lock size={9} /> Saved
                                  </span>
                                )}
                                {f.url && (
                                  <a 
                                    href={f.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={e => e.stopPropagation()} 
                                    className="text-[10px] text-text-muted hover:text-primary-accent flex items-center gap-1 underline underline-offset-2"
                                  >
                                    View <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => removeFile(f.id)} 
                            className="text-text-muted hover:text-liability-rose p-1.5 hover:bg-liability-rose/10 rounded-lg transition-colors flex-shrink-0"
                            title="Remove file"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <div className="relative w-full">
                      <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <div className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-border-prominent rounded-lg text-sm text-text-primary hover:border-primary-accent transition-colors bg-surface-layer2/30 cursor-pointer">
                        <Upload size={16} className="text-primary-accent" />
                        <span>Upload Files to Drive</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        value={newEntry.linkInput} 
                        onChange={e => setNewEntry({...newEntry, linkInput: e.target.value})} 
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                        type="text" 
                        placeholder="Paste Google Drive URL..." 
                        className="flex-1 bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-accent" 
                      />
                      <button type="button" onClick={handleAddLink} className="px-3 py-2 bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle rounded-lg text-xs font-medium transition-colors">Add Link</button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3 mt-4 border-t border-border-subtle">
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => { setShowAddModal(false); setEditingDocId(null); }} 
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-surface-layer2 text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-layer2/80 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting || (!newEntry.Name && attachedFiles.length === 0)} 
                      className="flex-1 px-4 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 flex justify-center items-center gap-2 transition-all active:scale-95"
                    >
                      {isSubmitting ? (uploadProgress || 'Saving...') : (editingDocId ? 'Save Changes' : 'Save Entry')}
                    </button>
                  </div>
                  {editingDocId && (
                    <button 
                      type="button" 
                      disabled={isSubmitting}
                      onClick={() => {
                        const idToDelete = editingDocId;
                        setShowAddModal(false);
                        setEditingDocId(null);
                        handleDeleteEntry(idToDelete);
                      }}
                      className="w-full px-4 py-2 bg-liability-rose/10 text-liability-rose border border-liability-rose/20 rounded-lg text-sm font-medium hover:bg-liability-rose/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} />
                      <span>Delete Document Entry</span>
                    </button>
                  )}
                </div>
             </form>
           </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex no-swipe items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setPreviewDoc(null)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-layer2">
               <div className="flex items-center gap-2 overflow-hidden">
                 {previewDoc.isLink ? <LinkIcon size={18} className="text-blue-400" /> : <FileText size={18} className="text-primary-accent" />}
                 <h3 className="text-sm font-bold text-white truncate">{previewDoc.name}</h3>
               </div>
               <div className="flex items-center gap-3">
                 {previewDoc.url && (
                   <a href={previewDoc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-primary-accent text-white px-3 py-1.5 rounded-lg hover:bg-primary-accent/90">
                     <ExternalLink size={14} /> Open Native Viewer
                   </a>
                 )}
                 <button onClick={() => setPreviewDoc(null)} className="p-1 hover:bg-surface-layer1 rounded-lg text-text-secondary">
                   <X size={20} />
                 </button>
               </div>
             </div>
             <div className="flex-1 bg-background-root/50 flex items-center justify-center p-4">
               {previewDoc.url ? (
                  <div className="text-center text-text-secondary flex flex-col items-center max-w-sm mx-auto">
                    <Lock size={48} className="text-primary-accent/50 mb-4" />
                    <h4 className="text-white font-medium mb-2">Secure Document</h4>
                    <p className="text-sm text-text-muted mb-6">
                      For your privacy and security, embedded previews of Drive documents are disabled to prevent third-party tracking.
                    </p>
                    <a href={previewDoc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary-accent text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-accent/90 transition-transform active:scale-95">
                      <ExternalLink size={18} /> Open in Native Viewer
                    </a>
                  </div>
               ) : (
                  <div className="text-center text-text-secondary">
                    <FileText size={48} className="mx-auto mb-3 opacity-20" />
                    <p>No preview available for this document.</p>
                  </div>
               )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
