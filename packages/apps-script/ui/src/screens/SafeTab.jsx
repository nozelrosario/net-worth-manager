import React, { useState } from 'react';
import { Lock, FileText, User, PlusCircle, Link as LinkIcon, Upload, Trash2, ExternalLink, X, File } from 'lucide-react';
import { getSafeStorage } from '../utils/storage';

export default function SafeTab({ formatCurrency, data, onRefresh, showMessage }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
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

  const safeDocs = data?.safe || [];
  const profiles = data?.familyProfiles || [];
  
  const categories = ['Identity', 'Property', 'Tax', 'Insurance', 'Will & Trust', 'Investment', 'Other'];
  
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedFiles(prev => [...prev, {
          id: Math.random().toString(), // temporary ID
          name: file.name,
          mimeType: file.type,
          base64: ev.target.result,
          isNewUpload: true
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddLink = () => {
    if (!newEntry.linkInput) return;
    setAttachedFiles(prev => [...prev, {
      id: Math.random().toString(),
      name: newEntry.linkInput.substring(0, 30) + '...',
      url: newEntry.linkInput,
      isLink: true
    }]);
    setNewEntry({ ...newEntry, linkInput: '' });
  };

  const removeFile = (id) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFilesSequential = async (filesToUpload, token) => {
    const uploaded = [];
    for (let i = 0; i < filesToUpload.length; i++) {
      const f = filesToUpload[i];
      setUploadProgress(`Uploading ${i+1} of ${filesToUpload.length}...`);
      
      const result = await new Promise((resolve, reject) => {
        window.google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .uploadFileToDrive(f.base64, f.name, f.mimeType, token);
      });
      
      if (result.status === 'success') {
        uploaded.push({
          name: result.fileName,
          url: result.fileUrl,
          id: result.fileId,
          mimeType: result.mimeType
        });
      } else {
        throw new Error(result.message);
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
        const links = attachedFiles.filter(f => !f.isNewUpload).map(f => ({
          name: f.name, url: f.url, isLink: true
        }));
        
        let uploadedFiles = [];
        if (filesToUpload.length > 0) {
          uploadedFiles = await uploadFilesSequential(filesToUpload, token);
        }
        
        const finalFilesJSON = JSON.stringify([...uploadedFiles, ...links]);
        
        // 2. Save record to DB
        setUploadProgress('Saving record...');
        
        const payload = {
          'Document ID': '',
          Name: newEntry.Name,
          Category: newEntry.Category,
          Owner: newEntry.Owner,
          Description: newEntry.Description,
          'Files JSON': finalFilesJSON,
          'Date Added': new Date().toISOString().split('T')[0]
        };
        
        window.google.script.run
          .withSuccessHandler((res) => {
            setIsSubmitting(false);
            setUploadProgress('');
            setShowAddModal(false);
            if (onRefresh) onRefresh();
            showMessage(res.message);
          })
          .withFailureHandler((err) => {
            setIsSubmitting(false);
            setUploadProgress('');
            showMessage('Error: ' + err.message, true);
          })
          .addRecord('Safe', payload, token);
          
      } else {
        setTimeout(() => {
          setIsSubmitting(false);
          setUploadProgress('');
          setShowAddModal(false);
          showMessage('Document saved (preview)');
        }, 1500);
      }
    } catch (err) {
      setIsSubmitting(false);
      setUploadProgress('');
      showMessage('Upload Failed: ' + err.message, true);
    }
  };
  
  const resetForm = () => {
    setNewEntry({
      Name: '', Category: 'Identity', Owner: '', Description: '', linkInput: ''
    });
    setAttachedFiles([]);
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
              <div key={doc['Document ID'] || i} className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{doc.Name}</h4>
                    <p className="text-xs text-text-secondary mt-0.5">{doc.Category} • {doc.Owner || 'Self'}</p>
                  </div>
                  <span className="text-[10px] text-text-muted bg-surface-layer2 px-2 py-1 rounded">{new Date(doc['Date Added']).toLocaleDateString()}</span>
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

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
             <h3 className="text-lg font-bold mb-4 text-white">Add to Family Safe</h3>
             
             <form onSubmit={handleSaveEntry} className="space-y-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Entry Title</label>
                  <input required value={newEntry.Name} onChange={e => setNewEntry({...newEntry, Name: e.target.value})} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" placeholder="e.g. Life Insurance Policy 2026" />
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-text-secondary mb-1">Category</label>
                    <select value={newEntry.Category} onChange={e => setNewEntry({...newEntry, Category: e.target.value})} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent">
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
                  <label className="block text-xs text-text-secondary mb-2">Attached Documents</label>
                  
                  {/* File List */}
                  {attachedFiles.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {attachedFiles.map(f => (
                        <div key={f.id} className="flex justify-between items-center bg-surface-layer2 p-2 rounded-lg border border-border-subtle">
                          <div className="flex items-center space-x-2 overflow-hidden">
                            {f.isLink ? <LinkIcon size={14} className="text-blue-400 flex-shrink-0" /> : <File size={14} className="text-wealth-emerald flex-shrink-0" />}
                            <span className="text-xs text-text-primary truncate">{f.name}</span>
                          </div>
                          <button type="button" onClick={() => removeFile(f.id)} className="text-liability-rose p-1 hover:bg-liability-rose/10 rounded">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <div className="relative w-full">
                      <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-border-prominent rounded-lg text-sm text-text-primary hover:border-primary-accent transition-colors bg-surface-layer2/30">
                        <Upload size={16} />
                        <span>Upload Files to Drive</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input value={newEntry.linkInput} onChange={e => setNewEntry({...newEntry, linkInput: e.target.value})} type="text" placeholder="Paste Google Drive URL..." className="flex-1 bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-accent" />
                      <button type="button" onClick={handleAddLink} className="px-3 py-2 bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle rounded-lg text-xs font-medium transition-colors">Add Link</button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 mt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-surface-layer2 text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-layer2/80">Cancel</button>
                  <button type="submit" disabled={isSubmitting || (!newEntry.Name && attachedFiles.length === 0)} className="flex-1 px-4 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 flex justify-center items-center">
                    {isSubmitting ? uploadProgress || 'Saving...' : 'Save Entry'}
                  </button>
                </div>
             </form>
           </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setPreviewDoc(null)}>
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
                  <iframe src={previewDoc.url.replace('/view', '/preview')} className="w-full h-full rounded border-none bg-white" title="Preview"></iframe>
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
