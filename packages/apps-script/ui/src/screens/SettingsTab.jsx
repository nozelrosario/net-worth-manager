import React, { useState, useEffect } from 'react';
import { Users, Shield, Save, Settings as SettingsIcon, X, Edit2, Sparkles, Sliders, ExternalLink, CheckCircle2, RefreshCw, Landmark, Cloud, Moon, ALargeSmall } from 'lucide-react';
import { getSafeStorage, setSafeStorage } from '../utils/storage';
import { isPinConfigured, isAppShell } from '../utils/securityUtils';
import { Badge } from '../components/Badge';

export default function SettingsTab({ 
  data, 
  onRefresh, 
  showMessage, 
  onOpenSecurityModal, 
  onOpenRebalancer, 
  onOpenRetirementPlanner, 
  onOpenInsuranceHub,
  darkMode,
  onToggleDarkMode,
  textMode = 'standard',
  onSelectTextMode
}) {
  const [teamEmailsText, setTeamEmailsText] = useState('');
  const [teamRole, setTeamRole] = useState('editor');
  const [memberName, setMemberName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [profileRelation, setProfileRelation] = useState('');
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileRelation, setEditProfileRelation] = useState('');
  const [isUpdateProfileSubmitting, setIsUpdateProfileSubmitting] = useState(false);
  const familyProfiles = data?.familyProfiles || [];

  const savedKey = data?.settings?.find(s => s['Setting Key'] === 'GeminiApiKey')?.['Setting Value'] || getSafeStorage('nwm_gemini_api_key', '');
  const [apiKeyInput, setApiKeyInput] = useState(savedKey);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySavedFeedback, setKeySavedFeedback] = useState(false);

  useEffect(() => {
    if (savedKey) setApiKeyInput(savedKey);
  }, [savedKey]);

  const handleSaveGeminiKey = (e) => {
    e.preventDefault();
    setIsSavingKey(true);
    setKeySavedFeedback(false);
    const cleanKey = (apiKeyInput || '').trim();
    setSafeStorage('nwm_gemini_api_key', cleanKey);
    const token = getSafeStorage('nwm_session_token');

    if (window.google?.script?.run?.upsertSetting) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSavingKey(false);
          setKeySavedFeedback(true);
          showMessage(res?.message || 'Gemini API Key saved successfully!');
          if (onRefresh) onRefresh();
          setTimeout(() => setKeySavedFeedback(false), 3500);
        })
        .withFailureHandler((err) => {
          setIsSavingKey(false);
          showMessage('Error saving key: ' + err.message, true);
        })
        .upsertSetting('GeminiApiKey', cleanKey, token);
    } else {
      setTimeout(() => {
        setIsSavingKey(false);
        setKeySavedFeedback(true);
        showMessage('Gemini API Key saved (preview)');
        setTimeout(() => setKeySavedFeedback(false), 3500);
      }, 500);
    }
  };

  const savedFolder = data?.settings?.find(s => s['Setting Key'] === 'SmsDriveFolder')?.['Setting Value'] || 'SMSBackupRestore';
  const lastSyncEpochStr = data?.settings?.find(s => s['Setting Key'] === 'SmsLastProcessedDate')?.['Setting Value'] || '0';
  const [smsFolderInput, setSmsFolderInput] = useState(savedFolder);
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  useEffect(() => {
    if (savedFolder) setSmsFolderInput(savedFolder);
  }, [savedFolder]);

  const handleSaveSmsFolder = (e) => {
    e.preventDefault();
    setIsSavingFolder(true);
    const token = getSafeStorage('nwm_session_token');
    if (window.google?.script?.run?.upsertSetting) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSavingFolder(false);
          showMessage(res?.message || 'SMS Backup folder updated!');
          if (onRefresh) onRefresh();
        })
        .withFailureHandler((err) => {
          setIsSavingFolder(false);
          showMessage('Error saving folder: ' + err.message, true);
        })
        .upsertSetting('SmsDriveFolder', smsFolderInput.trim(), token);
    } else {
      setTimeout(() => {
        setIsSavingFolder(false);
        showMessage('SMS Backup folder updated (preview)');
      }, 500);
    }
  };

  const handleResetSmsSync = () => {
    if (!window.confirm('Resetting the sync date will allow re-scanning older messages. Continue?')) return;
    const token = getSafeStorage('nwm_session_token');
    if (window.google?.script?.run?.upsertSetting) {
      window.google.script.run
        .withSuccessHandler(() => {
          showMessage('SMS sync watermark reset to beginning.');
          if (onRefresh) onRefresh();
        })
        .upsertSetting('SmsLastProcessedDate', '0', token);
    } else {
      showMessage('SMS sync watermark reset (preview)');
    }
  };


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

  const handleAddFamilyProfile = (e) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    
    setIsProfileSubmitting(true);
    const newRecord = {
      'Profile ID': '',
      'Name': profileName.trim(),
      'Relation': profileRelation.trim(),
      'Ownership %': '',
      'Notes': ''
    };

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsProfileSubmitting(false);
          showMessage(res.message);
          if (res.status === 'success') {
            setProfileName('');
            setProfileRelation('');
            onRefresh();
          }
        })
        .withFailureHandler((err) => {
          setIsProfileSubmitting(false);
          showMessage('Error: ' + err.message, true);
        })
        .addRecord('FamilyProfiles', newRecord, getSafeStorage('nwm_session_token'));
    } else {
      setTimeout(() => {
        setIsProfileSubmitting(false);
        showMessage('Profile added (preview)');
      }, 1000);
    }
  };

  
  const handleEditClick = (p) => {
    setEditingProfileId(p['Profile ID']);
    setEditProfileName(p.Name || '');
    setEditProfileRelation(p.Relation || '');
  };

  const handleCancelEdit = () => {
    setEditingProfileId(null);
    setEditProfileName('');
    setEditProfileRelation('');
  };

  const handleUpdateFamilyProfile = (e) => {
    e.preventDefault();
    if (!editProfileName.trim() || !editingProfileId) return;
    
    setIsUpdateProfileSubmitting(true);
    const updateData = {
      'Name': editProfileName.trim(),
      'Relation': editProfileRelation.trim()
    };

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsUpdateProfileSubmitting(false);
          showMessage(res.message);
          if (res.status === 'success') {
            handleCancelEdit();
            onRefresh();
          }
        })
        .withFailureHandler((err) => {
          setIsUpdateProfileSubmitting(false);
          showMessage('Error: ' + err.message, true);
        })
        .updateRecord('FamilyProfiles', 'Profile ID', editingProfileId, updateData, getSafeStorage('nwm_session_token'));
    } else {
      setTimeout(() => {
        setIsUpdateProfileSubmitting(false);
        showMessage('Profile updated (preview)');
        handleCancelEdit();
      }, 1000);
    }
  };
  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-typ-title font-bold tracking-tight text-text-primary">Admin Settings</h2>
          <div className="flex items-center flex-wrap gap-2 mt-1">
            <span className="text-typ-footnote text-text-muted">
              Access Control & Asset Categories
            </span>
            <span className="text-text-muted text-typ-caption">•</span>
            <span className="text-typ-footnote text-text-muted">Family Office Config</span>
          </div>
        </div>
      </div>

      {/* Device Appearance & Typography */}
      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-text-primary">
            <ALargeSmall size={20} className="text-primary-accent" />
            <h3 className="font-semibold text-typ-body-sm">Appearance & Typography</h3>
          </div>
          <Badge variant="indigo" size="xs">Device Preference</Badge>
        </div>
        <p className="text-typ-label text-text-secondary leading-relaxed mb-4">
          Control interface contrast and typography density. Settings are saved locally on this device.
        </p>

        <div className="space-y-3">
          {/* Dark Mode Row */}
          {onToggleDarkMode && (
            <div className="flex items-center justify-between p-3 bg-surface-layer2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <Moon size={16} className="text-text-secondary" />
                <div>
                  <p className="text-typ-label font-semibold text-text-primary">Dark Mode</p>
                  <p className="text-typ-caption text-text-muted">High-contrast OLED palette</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleDarkMode}
                className={`w-10 h-5 rounded-full flex items-center p-0.5 border border-border-subtle transition-colors cursor-pointer ${
                  darkMode ? 'bg-primary-accent justify-end' : 'bg-surface-layer3 justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-xs"></div>
              </button>
            </div>
          )}

          {/* Typography Scale Density Setting */}
          <div className="p-3 bg-surface-layer2 rounded-lg border border-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-typ-label font-semibold text-text-primary">Typography Density</p>
                <p className="text-typ-caption text-text-muted">
                  {textMode === 'compact' ? 'Compact — balanced text density' : textMode === 'comfortable' ? 'Comfortable — large accessible typography' : 'Standard — spacious readable typography'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-surface-layer1 p-1 rounded-lg border border-border-subtle mt-2">
              <button
                type="button"
                onClick={() => onSelectTextMode && onSelectTextMode('compact')}
                className={`py-1.5 px-2 rounded-md text-typ-label font-semibold transition-all flex flex-col items-center gap-0.5 ${
                  textMode === 'compact'
                    ? 'bg-primary-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-layer2'
                }`}
              >
                <span>Compact</span>
                <span className="text-typ-micro opacity-75 font-normal">Balanced</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTextMode && onSelectTextMode('standard')}
                className={`py-1.5 px-2 rounded-md text-typ-label font-semibold transition-all flex flex-col items-center gap-0.5 ${
                  textMode === 'standard'
                    ? 'bg-primary-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-layer2'
                }`}
              >
                <span>Standard</span>
                <span className="text-typ-micro opacity-75 font-normal">Spacious</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTextMode && onSelectTextMode('comfortable')}
                className={`py-1.5 px-2 rounded-md text-typ-label font-semibold transition-all flex flex-col items-center gap-0.5 ${
                  textMode === 'comfortable'
                    ? 'bg-primary-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-layer2'
                }`}
              >
                <span>Comfortable</span>
                <span className="text-typ-micro opacity-75 font-normal">Large Text</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
         <div className="flex items-center gap-2 mb-4 text-text-primary">
            <SettingsIcon size={20} className="text-primary-accent" />
            <h3 className="font-semibold">App Configuration</h3>
         </div>
         
         <CategoryEditor 
           title="Asset Categories"
           defaultCategories="Equity, Real Estate, Gold, Cash/FD, Liabilities"
           settingKey="AssetCategories"
           data={data}
           onRefresh={onRefresh}
           showMessage={showMessage}
         />
         <CategoryEditor 
           title="Spend Categories"
           defaultCategories="Dining, Groceries, Utilities, Rent, Travel, Entertainment, Healthcare, Education, Shopping, General Expense, Other"
           settingKey="SpendCategories"
           data={data}
           onRefresh={onRefresh}
           showMessage={showMessage}
         />
         <CategoryEditor 
           title="Safe Document Categories"
           defaultCategories="Identity, Finance, Property, Medical, Vehicle, Education, Tax, Other"
           settingKey="SafeCategories"
           data={data}
           onRefresh={onRefresh}
           showMessage={showMessage}
         />
      </section>

      {/* AI Portfolio Advisor & Rebalance Config */}
      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
         <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-text-primary">
               <Sparkles size={18} className="text-wealth-emerald" />
               <h3 className="font-semibold text-typ-body-sm">AI Portfolio Advisor & Targets</h3>
            </div>
            <Badge variant="emerald" dot size="xs">
              Zero Tax Inflow
            </Badge>
         </div>

         <p className="text-typ-label text-text-secondary leading-relaxed mb-4">
            Configure target asset allocation benchmarks (Moderate, Aggressive, Conservative, All-Weather, Custom) and optional Google Gemini API key for deep narrative synthesis.
         </p>

         {/* Direct Gemini API Key Config */}
         <form onSubmit={handleSaveGeminiKey} className="space-y-2 mb-4 bg-surface-layer2/50 p-3 rounded-xl border border-border-subtle">
            <div className="flex items-center justify-between">
               <label className="text-typ-label font-semibold text-text-primary flex items-center gap-1.5">
                  <Sparkles size={13} className="text-wealth-emerald" />
                  Google Gemini API Key
               </label>
               <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-typ-caption text-primary-accent hover:underline flex items-center gap-0.5"
               >
                  Get Free Key <ExternalLink size={10} />
               </a>
            </div>

            <div className="flex gap-2">
               <input 
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-1 bg-surface-layer1 border border-white/[0.08] focus:border-primary-accent/70 rounded-lg px-3 py-1.5 text-typ-label text-text-primary focus:outline-none font-mono"
               />
               <button
                  type="submit"
                  disabled={isSavingKey}
                  className="px-3 py-1.5 rounded-lg bg-primary-accent text-white font-semibold text-typ-label hover:bg-primary-accent/90 disabled:opacity-50 flex items-center gap-1 shadow-sm"
               >
                  {isSavingKey ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  <span>{isSavingKey ? 'Saving...' : 'Save Key'}</span>
               </button>
            </div>

            {keySavedFeedback && (
               <p className="text-typ-caption text-wealth-emerald font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  API Key saved and active for AI Advisory!
               </p>
            )}

            <p className="text-typ-caption text-text-muted">
               100% free forever (1,500 requests/day). If left blank, offline heuristics advisor is used.
            </p>
         </form>

         {onOpenRebalancer && (
           <button
             type="button"
             onClick={onOpenRebalancer}
             className="w-full py-2.5 px-4 rounded-xl bg-surface-layer2 hover:bg-surface-layer2/80 border border-white/[0.08] hover:border-white/[0.14] text-text-primary text-typ-label font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]"
           >
             <Sliders size={14} className="text-primary-accent" />
             <span>Configure Target Allocation & Rebalance</span>
           </button>
         )}

         {onOpenRetirementPlanner && (
           <button
             type="button"
             onClick={onOpenRetirementPlanner}
             className="w-full py-2.5 px-4 rounded-xl bg-surface-layer2 hover:bg-surface-layer2/80 border border-border-subtle hover:border-sky-500/40 text-text-primary text-typ-label font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] mt-2"
           >
             <Landmark size={14} className="text-sky-400" />
             <span>Retirement &amp; Pension Hub (EPF, PPF &amp; NPS)</span>
           </button>
         )}

         {onOpenInsuranceHub && (
           <button
             type="button"
             onClick={onOpenInsuranceHub}
             className="w-full py-2.5 px-4 rounded-xl bg-surface-layer2 hover:bg-surface-layer2/80 border border-border-subtle hover:border-emerald-500/40 text-text-primary text-typ-label font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] mt-2"
           >
             <Shield size={14} className="text-emerald-400" />
             <span>Insurance &amp; Protection Hub (LIC, Term &amp; Health)</span>
           </button>
         )}
      </section>

      {/* SMS Expense & Transfer Ingestion Config */}
      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-text-primary">
            <Cloud size={18} className="text-primary-accent" />
            <h3 className="font-semibold text-typ-body-sm">SMS Expense Ingestion (Google Drive)</h3>
          </div>
          <Badge variant="indigo" size="xs">Auto-Incremental</Badge>
        </div>
        <p className="text-typ-label text-text-secondary leading-relaxed mb-4">
          Reads incremental XML exports produced by the <b>SMS Backup &amp; Restore</b> Android app to detect spends, internal transfers, and investment debits.
        </p>

        <form onSubmit={handleSaveSmsFolder} className="space-y-3 bg-surface-layer2/50 p-3 rounded-xl border border-border-subtle">
          <div>
            <label className="block text-typ-label font-semibold text-text-primary mb-1">
              Drive Backup Folder Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={smsFolderInput}
                onChange={e => setSmsFolderInput(e.target.value)}
                placeholder="SMSBackupRestore"
                className="flex-1 bg-surface-layer1 border border-border-subtle focus:border-primary-accent/70 rounded-lg px-3 py-1.5 text-typ-label text-text-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSavingFolder}
                className="px-3 py-1.5 rounded-lg bg-primary-accent text-white font-semibold text-typ-label hover:bg-primary-accent/90 disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                {isSavingFolder ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                <span>{isSavingFolder ? 'Saving...' : 'Save Folder'}</span>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 text-typ-footnote">
            <span className="text-text-muted">
              Watermark: {lastSyncEpochStr && lastSyncEpochStr !== '0' ? new Date(parseInt(lastSyncEpochStr, 10)).toLocaleDateString() : 'None (Full scan)'}
            </span>
            <button
              type="button"
              onClick={handleResetSmsSync}
              className="text-text-muted hover:text-liability-rose hover:underline"
            >
              Reset Sync Date
            </button>
          </div>
        </form>
      </section>

      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
         <div className="flex items-center gap-2 mb-4 text-text-primary">
            <Users size={20} className="text-primary-accent" />
            <h3 className="font-semibold">Team Management</h3>
         </div>
         
         <form onSubmit={handleUpdateTeam} className="space-y-4 border-b border-border-subtle pb-6 mb-4">
           <div>
             <label className="block text-typ-label text-text-secondary mb-1">Member Name (e.g. Spouse)</label>
             <input required value={memberName} onChange={e => setMemberName(e.target.value)} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent" placeholder="Spouse" />
           </div>
           <div>
             <label className="block text-typ-label text-text-secondary mb-1">Google Emails (Comma separated)</label>
             <input required value={teamEmailsText} onChange={e => setTeamEmailsText(e.target.value)} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent" placeholder="email1@gmail.com, email2@gmail.com" />
           </div>
           <div>
             <label className="block text-typ-label text-text-secondary mb-1">Role</label>
             <select value={teamRole} onChange={e => setTeamRole(e.target.value)} className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent">
               <option value="editor">Editor (Can add/edit records)</option>
               <option value="readonly">Read-Only (Can only view dashboards)</option>
             </select>
           </div>
           <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 py-2 bg-primary-accent text-white rounded-lg text-typ-body-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 mt-2">
             <Save size={16} />
             {isSubmitting ? 'Saving...' : 'Update Team Member'}
           </button>
         </form>

         <div className="space-y-3">
            <h4 className="text-typ-body-sm font-semibold text-text-secondary mb-2">Current Authorized Team</h4>
            {teamMembers.map((member, i) => (
              <div key={i} className="flex flex-col gap-1 p-3 bg-surface-layer2 rounded-lg border border-border-subtle">
                 <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary text-typ-body-sm">{member.name}</span>
                    <Badge variant="neutral" size="xs">{member.role}</Badge>
                 </div>
                 <span className="text-typ-label text-text-muted">{member.emails}</span>
              </div>
            ))}
         </div>
      </section>

      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
         <div className="flex items-center gap-2 mb-4 text-text-primary">
            <Users size={20} className="text-primary-accent" />
            <h3 className="font-semibold">Family Profiles</h3>
         </div>
         <p className="text-typ-label text-text-muted mb-4">Add family members who don't need app access but are associated with assets, safe documents, or spends.</p>
         
         <form onSubmit={handleAddFamilyProfile} className="space-y-4 border-b border-border-subtle pb-6 mb-4">
           <div>
             <label className="block text-typ-label text-text-secondary mb-1">Name (e.g. Son, Daughter)</label>
             <input required value={profileName} onChange={e => setProfileName(e.target.value)} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent" placeholder="John" />
           </div>
           <div>
             <label className="block text-typ-label text-text-secondary mb-1">Relation (Optional)</label>
             <input value={profileRelation} onChange={e => setProfileRelation(e.target.value)} type="text" className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent" placeholder="e.g. Son" />
           </div>
           <button type="submit" disabled={isProfileSubmitting} className="w-full flex items-center justify-center gap-2 py-2 bg-primary-accent text-white rounded-lg text-typ-body-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 mt-2">
             <Save size={16} />
             {isProfileSubmitting ? 'Saving...' : 'Add Family Profile'}
           </button>
         </form>

         <div className="space-y-3">
            <h4 className="text-typ-body-sm font-semibold text-text-secondary mb-2">Current Family Profiles</h4>
            {familyProfiles.map((p, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 bg-surface-layer2 rounded-lg border border-border-subtle">
                 {editingProfileId === p['Profile ID'] ? (
                   <form onSubmit={handleUpdateFamilyProfile} className="flex flex-col gap-2">
                     <input required value={editProfileName} onChange={e => setEditProfileName(e.target.value)} type="text" className="w-full bg-surface-layer1 border border-border-subtle rounded-lg px-2 py-1 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent" placeholder="Name" />
                     <input value={editProfileRelation} onChange={e => setEditProfileRelation(e.target.value)} type="text" className="w-full bg-surface-layer1 border border-border-subtle rounded-lg px-2 py-1 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent" placeholder="Relation" />
                     <div className="flex gap-2 justify-end mt-1">
                       <button type="button" onClick={handleCancelEdit} className="px-3 py-1 bg-surface-layer1 border border-border-subtle text-text-primary rounded-lg text-typ-label hover:bg-surface-layer1/80">Cancel</button>
                       <button type="submit" disabled={isUpdateProfileSubmitting} className="px-3 py-1 bg-primary-accent text-white rounded-lg text-typ-label hover:bg-primary-accent/90 disabled:opacity-50">{isUpdateProfileSubmitting ? 'Saving...' : 'Save'}</button>
                     </div>
                   </form>
                 ) : (
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary text-typ-body-sm">{p.Name}</span>
                        {p.Relation && <Badge variant="neutral" size="xs">{p.Relation}</Badge>}
                      </div>
                      <button onClick={() => handleEditClick(p)} className="text-text-muted hover:text-primary-accent p-1"><Edit2 size={14} /></button>
                   </div>
                 )}
              </div>
            ))}
            {familyProfiles.length === 0 && (
              <p className="text-typ-label text-text-muted">No family profiles added yet.</p>
            )}
         </div>
      </section>

      <section className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
         <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-text-primary">
               <Shield size={20} className="text-primary-accent" />
               <h3 className="font-semibold">Access Control & Security</h3>
            </div>
            <button
               type="button"
               onClick={onOpenSecurityModal}
               className="text-typ-label bg-primary-accent text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-accent/90 transition-colors"
            >
               Configure
            </button>
         </div>
         <p className="text-typ-label text-text-muted mb-3">
            Container-aware security policies: PIN app lock for mobile shell, session-based ephemeral isolation and idle timeout for web browsers.
         </p>
         <div className="grid grid-cols-2 gap-2 text-typ-label">
            <div className="bg-surface-layer2 p-2.5 rounded-lg border border-border-subtle flex items-center justify-between">
               <span className="text-text-secondary">App Lock (PIN)</span>
               <span className={`font-semibold ${isPinConfigured() ? 'text-wealth-emerald' : 'text-text-muted'}`}>
                  {isPinConfigured() ? 'Enabled' : 'Disabled'}
               </span>
            </div>
            <div className="bg-surface-layer2 p-2.5 rounded-lg border border-border-subtle flex items-center justify-between">
               <span className="text-text-secondary">Platform Tier</span>
               <span className="font-semibold text-primary-accent">
                  {isAppShell() ? 'Mobile Shell' : 'Web Browser'}
               </span>
            </div>
         </div>
      </section>
    </div>
  );
}

const CategoryEditor = ({ title, defaultCategories, settingKey, data, onRefresh, showMessage }) => {
  const savedCategories = data?.settings?.find(s => s['Setting Key'] === settingKey)?.['Setting Value'] || defaultCategories;
  const [categories, setCategories] = useState(savedCategories.split(',').map(s => s.trim()).filter(Boolean));
  const [newCat, setNewCat] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
     setCategories(savedCategories.split(',').map(s => s.trim()).filter(Boolean));
  }, [savedCategories]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newCat.trim() || categories.includes(newCat.trim())) return;
    setCategories([...categories, newCat.trim()]);
    setNewCat('');
  };

  const handleRemove = (cat) => {
    setCategories(categories.filter(c => c !== cat));
  };

  const handleSave = () => {
    setIsSubmitting(true);
    const val = categories.join(', ');
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
        .upsertSetting(settingKey, val, getSafeStorage('nwm_session_token'));
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        showMessage(`${title} updated (preview)`);
      }, 1000);
    }
  };

  return (
    <div className="mb-6 border-b border-border-subtle pb-6 last:border-0 last:pb-0">
      <label className="block text-typ-body-sm font-semibold text-text-primary mb-2">{title}</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map(cat => (
          <div key={cat} className="flex items-center gap-1 bg-surface-layer2 text-text-primary px-3 py-1 rounded-full text-typ-body-sm border border-border-subtle">
            {cat}
            <button type="button" onClick={() => handleRemove(cat)} className="text-text-muted hover:text-liability-rose ml-1 flex items-center justify-center p-0.5"><X size={12} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input 
          value={newCat} 
          onChange={e => setNewCat(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(e); }}
          type="text" 
          placeholder="New Category" 
          className="flex-1 bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-typ-body-sm focus:outline-none focus:border-primary-accent" 
        />
        <button type="button" onClick={handleAdd} className="px-4 py-2 bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle text-text-primary rounded-lg text-typ-body-sm font-medium transition-colors">Add</button>
      </div>
      <button type="button" onClick={handleSave} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 py-2 bg-primary-accent text-white rounded-lg text-typ-body-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 mt-3">
        <Save size={16} />
        {isSubmitting ? 'Saving...' : 'Save ' + title}
      </button>
    </div>
  );
};
