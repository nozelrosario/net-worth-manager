import React from 'react';
import { assetSchemas } from '../config/assetSchemas';

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

export default function DynamicForm({ category, formData, setFormData, onSubmit, onCancel, isSubmitting, isEditing, onDelete }) {
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto px-1 pb-2 scrollbar-hide">
        {schema.fields.map(field => {
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
      </div>
      
      <div className="pt-4 flex flex-col gap-3 border-t border-border-subtle mt-2">
         <div className="flex gap-3">
           <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-surface-layer2 text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-layer2/80 transition-colors">Cancel</button>
           <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 transition-all active:scale-95">
             {isSubmitting ? 'Saving...' : 'Save Asset'}
           </button>
         </div>
         {isEditing && (
           <button type="button" onClick={onDelete} disabled={isSubmitting} className="w-full px-4 py-2 bg-liability-rose/10 text-liability-rose border border-liability-rose/20 rounded-lg text-sm font-medium hover:bg-liability-rose/20 disabled:opacity-50 transition-colors">
             {isSubmitting ? 'Deleting...' : 'Delete Asset'}
           </button>
         )}
       </div>
    </form>
  );
}
