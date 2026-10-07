import React, { useState, useEffect } from 'react';
import { Users, Shield, Save, Settings as SettingsIcon } from 'lucide-react';
import { getSafeStorage } from '../utils/storage';

export default function SettingsTab({ data, onRefresh, showMessage }) {
  const [teamEmailsText, setTeamEmailsText] = useState('');
  const [teamRole, setTeamRole] = useState('editor');
  const [memberName, setMemberName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const defaultCategories = 'Equity, Real Estate, Gold, Cash/FD, Liabilities';
  const savedCategories = data?.settings?.find(s => s['Setting Key'] === 'AssetCategories')?.['Setting Value'] || defaultCategories;
  const [assetCategoriesText, setAssetCategoriesText] = useState(savedCategories);

  useEffect(() => {
    setAssetCategoriesText(savedCategories);
  }, [savedCategories]);

  useEffect(() => {
    // Fetch team config from backend
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          if (res.status === 'success') {
             // Map team members and their emails
             const membersList = res.team.map(name => ({
               name: name,
               emails: (res.teamEmails[name] || []).join(', '),
               role: 'editor' // Backend doesn't expose roles perfectly to UI yet in getTeamConfig, but this is a start
             }));
             setTeamMembers(membersList);
          }
        })
        .getFormData(null, getSafeStorage('nwm_session_token'));
    } else {
      // Mock data
      setTeamMembers([
        { name: 'Admin', emails: 'demo@family.com', role: 'admin' },
        { name: 'Spouse', emails: 'spouse@family.com', role: 'editor' }
      ]);
    }
  }, []);

  const handleUpdateTeam = (e) => {
    e.preventDefault();
    if (!memberName.trim() || !teamEmailsText.trim()) {
       showMessage("Please provide both a member name and at least one email.", true);
       return;
    }
    
    setIsSubmitting(true);
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSubmitting(false);
          showMessage(res.message);
          if (res.status === 'success') {
            setMemberName('');
            setTeamEmailsText('');
            // Reload page or re-fetch team
            window.location.reload();
          }
        })
        .withFailureHandler((err) => {
          setIsSubmitting(false);
          showMessage('Error: ' + err.message, true);
        })
        .updateTeamMemberEmails(memberName, teamEmailsText, teamRole, getSafeStorage('nwm_session_token'));
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        showMessage('Team updated (preview)');
      }, 1000);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-text-primary">Admin Settings</h2>
      </div>

      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
         <div className="flex items-center gap-2 mb-4 text-text-primary">
            <SettingsIcon size={20} className="text-primary-accent" />
            <h3 className="font-semibold">App Configuration</h3>
         </div>
         
         <form onSubmit={(e) => {
           e.preventDefault();
           if (!assetCategoriesText.trim()) return;
           setIsSubmitting(true);
           if (window.google?.script?.run) {
             window.google.script.run
               .withSuccessHandler((res) => {
                 setIsSubmitting(false);
                 showMessage(res.message);
                 if (onRefresh) onRefresh();
               })
               .withFailureHandler((err) => {
                 setIsSubmitting(false);
                 showMessage('Error: ' + err.message, true);
               })
               .upsertSetting('AssetCategories', assetCategoriesText, getSafeStorage('nwm_session_token'));
           } else {
             setTimeout(() => {
               setIsSubmitting(false);
               showMessage('Categories updated (preview)');
             }, 1000);
           }
         }} className="space-y-4 border-b border-border-subtle pb-6 mb-4">
           <div>
             <label className="block text-xs text-text-secondary mb-1">Asset Categories (Comma separated)</label>
             <input required value={assetCategoriesText} onChange={e => setAssetCategoriesText(e.target.value)} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" placeholder="Equity, Real Estate, Gold, Cash/FD, Liabilities" />
           </div>
           <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 mt-2">
             <Save size={16} />
             {isSubmitting ? 'Saving...' : 'Update Categories'}
           </button>
         </form>
      </section>

      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
         <div className="flex items-center gap-2 mb-4 text-text-primary">
            <Users size={20} className="text-primary-accent" />
            <h3 className="font-semibold">Team Management</h3>
         </div>
         
         <form onSubmit={handleUpdateTeam} className="space-y-4 border-b border-border-subtle pb-6 mb-4">
           <div>
             <label className="block text-xs text-text-secondary mb-1">Member Name (e.g. Spouse)</label>
             <input required value={memberName} onChange={e => setMemberName(e.target.value)} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" placeholder="Spouse" />
           </div>
           <div>
             <label className="block text-xs text-text-secondary mb-1">Google Emails (Comma separated)</label>
             <input required value={teamEmailsText} onChange={e => setTeamEmailsText(e.target.value)} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent" placeholder="email1@gmail.com, email2@gmail.com" />
           </div>
           <div>
             <label className="block text-xs text-text-secondary mb-1">Role</label>
             <select value={teamRole} onChange={e => setTeamRole(e.target.value)} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent">
               <option value="editor">Editor (Can add/edit records)</option>
               <option value="readonly">Read-Only (Can only view dashboards)</option>
             </select>
           </div>
           <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 mt-2">
             <Save size={16} />
             {isSubmitting ? 'Saving...' : 'Update Team Member'}
           </button>
         </form>

         <div className="space-y-3">
            <h4 className="text-sm font-semibold text-text-secondary mb-2">Current Authorized Team</h4>
            {teamMembers.map((member, i) => (
              <div key={i} className="flex flex-col gap-1 p-3 bg-surface-layer2 rounded-lg border border-border-subtle">
                 <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary text-sm">{member.name}</span>
                    <span className="text-[10px] uppercase tracking-wider bg-surface-layer1 border border-border-subtle px-2 py-0.5 rounded-full text-text-secondary">{member.role}</span>
                 </div>
                 <span className="text-xs text-text-muted">{member.emails}</span>
              </div>
            ))}
         </div>
      </section>

      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 opacity-50">
         <div className="flex items-center gap-2 mb-4 text-text-primary">
            <Shield size={20} className="text-text-secondary" />
            <h3 className="font-semibold">Security Settings (Coming Soon)</h3>
         </div>
         <p className="text-xs text-text-muted">Two-factor authentication and session controls will be available in a future update.</p>
      </section>
    </div>
  );
}
