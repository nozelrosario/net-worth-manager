import React from 'react';
import { Lock, FileText, User } from 'lucide-react';

export default function SafeTab({ formatCurrency, data }) {
  const profiles = data?.familyProfiles || [];
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold">Family Safe</h2>
      </div>

      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Lock size={80} /></div>
        <p className="text-sm font-medium text-white mb-2">Master Document Vault</p>
        <p className="text-xs text-text-secondary mb-4 max-w-[80%]">Securely store and share critical family documents, wills, and nominations.</p>
        <button className="bg-white text-background-root text-sm font-bold px-4 py-2 rounded-lg">Access Vault</button>
      </div>

      <h3 className="text-sm font-semibold mt-6 mb-2">Family Profiles</h3>
      <div className="space-y-3">
        {profiles.length > 0 ? profiles.map((p, i) => (
          <div key={p.ID || i} className="flex justify-between items-center p-4 bg-surface-layer1 border border-border-subtle rounded-xl">
             <div className="flex gap-3 items-center">
               <div className="w-10 h-10 rounded-full bg-surface-layer2 flex items-center justify-center text-text-secondary">
                 <User size={20} />
               </div>
               <div>
                 <p className="text-sm font-medium text-white">{p.Name}</p>
                 <p className="text-[10px] text-text-muted mt-0.5">{p.Role || 'Member'}</p>
               </div>
             </div>
             <button className="text-xs text-primary-accent border border-primary-accent/30 px-3 py-1.5 rounded-lg hover:bg-primary-accent/10">View</button>
          </div>
        )) : (
          <div className="text-center py-6 text-text-secondary text-sm bg-surface-layer1 border border-border-subtle rounded-xl">No profiles found.</div>
        )}
      </div>
    </div>
  );
}
