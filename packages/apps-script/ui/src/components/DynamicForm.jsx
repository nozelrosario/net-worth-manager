import React, { useState } from 'react';
import { assetSchemas } from '../config/assetSchemas';
import { Upload, Paperclip, FileText, Trash2, ExternalLink, Link as LinkIcon, Lock } from 'lucide-react';

// Utility to get nested object value (e.g., 'Details JSON.Interest Rate')
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Utility to set nested object value returning a new object
const setNestedValue = (obj, path, value) => {
  const parts = path.split('.');
  const newObj = { ...obj };
  let current = newObj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current[parts[i]] = { ...current[parts[i]] };
    current = current[parts[i]];
  }
  
  if (value === '' || value === undefined) {
      delete current[parts[parts.length - 1]];
  } else {
      current[parts[parts.length - 1]] = value;
  }
  
  return newObj;
};

export default function DynamicForm({ 
  category, 
  formData, 
  setFormData, 
  profiles, 
  onSubmit, 
  onCancel, 
  isSubmitting, 
  isEditing, 
  onDelete,
  attachedFiles = [],
  setAttachedFiles,
  uploadProgress = ''
}) {
  const [linkInput, setLinkInput] = useState('');

  // Use specific schema if available, else default, but Liabilities uses specific. 
  // Need to map user categories to our schemas. If exact match doesn't exist, use default.
  // We can do a loose match or exact match.
  let schemaKey = 'default';
  const catLower = (category || '').toLowerCase();
  
  if (catLower.includes('fd') || catLower.includes('fixed') || catLower.includes('cash')) schemaKey = 'Cash/FD';
  else if (catLower.includes('equity') || catLower.includes('stock')) schemaKey = 'Equity';
  else if (catLower.includes('mutual')) schemaKey = 'Mutual Funds';
  else if (catLower.includes('real estate') || catLower.includes('property')) schemaKey = 'Real Estate';
  else if (catLower.includes('gold')) schemaKey = 'Gold';
  else if (catLower.includes('provident') || catLower.includes('epf') || catLower.includes('ppf') || catLower.includes('nps')) schemaKey = 'Provident Funds';
  else if (catLower.includes('bond') || catLower.includes('debenture')) schemaKey = 'Bonds';
  else if (catLower.includes('liabilit') || catLower.includes('loan')) schemaKey = 'Liabilities';
  
  const schema = assetSchemas[schemaKey] || assetSchemas['default'];

  const handleChange = (name, value) => {
    setFormData(setNestedValue(formData, name, value));
  };

  const handleFileSelect = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (setAttachedFiles) {
          setAttachedFiles(prev => [...prev, {
            id: 'new_' + Math.random().toString(36).substring(2, 9),
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64: ev.target.result,
            isNewUpload: true
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeFile = (id) => {
    if (setAttachedFiles) {
      setAttachedFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) return;
    if (setAttachedFiles) {
      setAttachedFiles(prev => [...prev, {
        id: 'link_' + Math.random().toString(36).substring(2, 9),
        name: linkInput.trim().substring(0, 30) + '...',
        url: linkInput.trim(),
        isLink: true
      }]);
    }
    setLinkInput('');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto px-1 pb-2 scrollbar-hide">
        {schema.fields.map(field => {
          if (field.condition && !field.condition(formData)) return null;
          
          const value = getNestedValue(formData, field.name) || '';
          
          if (field.type === 'checkbox') {
            return (
              <div key={field.name} className="flex items-center gap-2 mt-4 md:col-span-2">
                <input 
                  type="checkbox" 
                  checked={!!value} 
                  onChange={e => handleChange(field.name, e.target.checked)} 
                  className="rounded bg-surface-layer2 border-border-subtle text-primary-accent focus:ring-0" 
                  id={field.name}
                />
                <label htmlFor={field.name} className="text-sm text-text-primary">{field.label}</label>
              </div>
            );
          }

          if (field.type === 'select') {
             return (
               <div key={field.name} className="md:col-span-2">
                 <label className="block text-xs text-text-secondary mb-1">{field.label}</label>
                 <select 
                   value={value} 
                   onChange={e => handleChange(field.name, e.target.value)} 
                   required={field.required}
                   className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent"
                 >
                   <option value="">Select...</option>
                   {field.options.map(opt => (
                     <option key={opt} value={opt}>{opt}</option>
                   ))}
                 </select>
               </div>
             );
          }

          if (field.name === 'Owner' && profiles && profiles.length > 0) {
            return (
              <div key={field.name} className="md:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">{field.label}</label>
                <select 
                  value={value} 
                  onChange={e => handleChange(field.name, e.target.value)} 
                  required={field.required}
                  className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent"
                >
                  <option value="">Self</option>
                  <option value="Joint">Joint</option>
                  {profiles.map(p => (
                    <option key={p.Name} value={p.Name}>{p.Name}</option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={field.name} className={field.name === 'Name' ? "md:col-span-2" : ""}>
              <label className="block text-xs text-text-secondary mb-1">{field.label} {field.required && <span className="text-liability-rose">*</span>}</label>
              <input 
                required={field.required} 
                value={value} 
                onChange={e => handleChange(field.name, e.target.type === 'number' ? Number(e.target.value) : e.target.value)} 
                type={field.type} 
                step={field.step}
                className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" 
                placeholder={field.placeholder} 
              />
            </div>
          );
        })}

        {/* Supporting Documents Section */}
        <div className="md:col-span-2 border-t border-border-subtle pt-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Paperclip size={14} className="text-primary-accent" />
                Supporting Documents
              </label>
              <p className="text-[11px] text-text-muted mt-0.5">
                Attach FD certificates, 7/12 extract PDFs, property deeds, etc. Synced to Family Safe.
              </p>
            </div>
            {attachedFiles.length > 0 && (
              <span className="text-[10px] text-primary-accent bg-primary-accent/15 px-2 py-0.5 rounded-full font-semibold border border-primary-accent/20">
                {attachedFiles.length} {attachedFiles.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>

          {/* Attached Files List */}
          {attachedFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              {attachedFiles.map(f => (
                <div 
                  key={f.id} 
                  className="flex justify-between items-center bg-surface-layer2 p-2.5 rounded-xl border border-border-subtle hover:border-border-prominent transition-colors"
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden flex-1 mr-2">
                    {f.isLink ? (
                      <LinkIcon size={15} className="text-blue-400 flex-shrink-0" />
                    ) : (
                      <FileText size={15} className="text-wealth-emerald flex-shrink-0" />
                    )}
                    <div className="truncate flex-1">
                      <p className="text-xs text-text-primary truncate font-medium">{f.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {f.isNewUpload ? (
                          <span className="text-[10px] text-primary-accent bg-primary-accent/10 px-1.5 py-0.2 rounded font-medium">Ready to upload</span>
                        ) : (
                          <span className="text-[10px] text-wealth-emerald bg-wealth-emerald/10 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                            <Lock size={9} /> In Family Safe
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

          {/* File Attachment Controls */}
          <div className="space-y-2">
            <div className="relative">
              <input 
                type="file" 
                multiple 
                onChange={handleFileSelect} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                id="asset-supporting-docs-file"
              />
              <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 border border-dashed border-border-prominent rounded-lg text-xs font-medium text-text-secondary hover:text-white hover:border-primary-accent transition-colors bg-surface-layer2/40 cursor-pointer">
                <Upload size={14} className="text-primary-accent" />
                <span>Attach Files from Device (PDF, Image, Docs)</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <input 
                value={linkInput} 
                onChange={e => setLinkInput(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                type="text" 
                placeholder="Or paste Google Drive URL..." 
                className="flex-1 bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-primary-accent" 
              />
              <button 
                type="button" 
                onClick={handleAddLink} 
                className="px-3 py-1.5 bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle rounded-lg text-xs font-medium transition-colors text-text-secondary hover:text-white"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="pt-4 flex flex-col gap-3 border-t border-border-subtle mt-2">
         <div className="flex gap-3">
           <button 
             type="button" 
             onClick={onCancel} 
             disabled={isSubmitting} 
             className="flex-1 px-4 py-2 bg-surface-layer2 text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-layer2/80 transition-colors disabled:opacity-50"
           >
             Cancel
           </button>
           <button 
             type="submit" 
             disabled={isSubmitting} 
             className="flex-1 px-4 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
           >
             {isSubmitting ? (uploadProgress || 'Saving...') : 'Save Asset'}
           </button>
         </div>
         {isEditing && (
           <button 
             type="button" 
             onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }} 
             disabled={isSubmitting} 
             className="w-full px-4 py-2 bg-liability-rose/10 text-liability-rose border border-liability-rose/20 rounded-lg text-sm font-medium hover:bg-liability-rose/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
           >
             <Trash2 size={14} />
             <span>Delete Asset</span>
           </button>
         )}
       </div>
    </form>
  );
}
