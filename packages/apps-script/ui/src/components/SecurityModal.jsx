import React, { useState, useEffect } from 'react';
import { 
  Shield, X, Smartphone, Globe, Lock, Unlock, KeyRound, 
  Clock, CheckCircle2, AlertCircle, LogOut, Laptop, ChevronRight, ArrowLeft 
} from 'lucide-react';
import useModalBack from '../hooks/useModalBack';
import { 
  isAppShell, getPinConfig, savePinConfig, updatePinConfig, 
  clearPinConfig, verifyPin, hashPin, getRememberMePreference, 
  setRememberMePreference, getBrowserIdleTimeoutMinutes, setBrowserIdleTimeoutMinutes 
} from '../utils/securityUtils';
import { setSafeStorage } from '../utils/storage';

export default function SecurityModal({ isOpen, onClose, userEmail, onSignOut, showMessage }) {
  useModalBack(isOpen, onClose);

  const [pinConfig, setPinConfig] = useState(() => getPinConfig());
  const [appShellMode] = useState(() => isAppShell());
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [idleTimeout, setIdleTimeout] = useState(() => getBrowserIdleTimeoutMinutes());

  // Wizard state: 'overview' | 'wizard' | 'disable_confirm'
  const [viewMode, setViewMode] = useState('overview');
  // Wizard sub-step: 'current' | 'new' | 'confirm'
  const [wizardStep, setWizardStep] = useState('new');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [wizardError, setWizardError] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPinConfig(getPinConfig());
      setRememberMe(getRememberMePreference());
      setIdleTimeout(getBrowserIdleTimeoutMinutes());
      setViewMode('overview');
      setWizardError('');
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPinEnabled = Boolean(pinConfig && pinConfig.isEnabled && pinConfig.hash);
  const autoLockTimeout = pinConfig?.autoLockTimeout ?? 0;

  // Handle PIN toggle change
  const handleTogglePin = () => {
    setWizardError('');
    if (isPinEnabled) {
      // Disabling PIN requires verifying current PIN first
      setViewMode('disable_confirm');
      setCurrentPinInput('');
    } else {
      // Enabling PIN: if previously had a PIN or first time
      setViewMode('wizard');
      setWizardStep('new');
      setNewPinInput('');
      setConfirmPinInput('');
    }
  };

  // Start Change PIN wizard
  const handleStartChangePin = () => {
    setWizardError('');
    setViewMode('wizard');
    setWizardStep('current');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
  };

  // Handle verify current PIN in wizard
  const handleVerifyCurrentPin = async (e) => {
    e.preventDefault();
    if (currentPinInput.length !== 4) {
      setWizardError('Please enter your 4-digit PIN');
      return;
    }
    setWizardLoading(true);
    setWizardError('');

    try {
      const result = await verifyPin(currentPinInput);
      setWizardLoading(false);
      if (result.success) {
        setWizardStep('new');
        setWizardError('');
      } else {
        setWizardError(result.lockedOut 
          ? `Locked out for ${result.remainingSeconds}s` 
          : 'Current PIN is incorrect');
      }
    } catch (err) {
      setWizardLoading(false);
      setWizardError('Verification failed. Try again.');
    }
  };

  // Handle disable PIN after verifying current PIN
  const handleConfirmDisablePin = async (e) => {
    e.preventDefault();
    if (currentPinInput.length !== 4) {
      setWizardError('Please enter your 4-digit PIN');
      return;
    }
    setWizardLoading(true);
    setWizardError('');

    try {
      const result = await verifyPin(currentPinInput);
      setWizardLoading(false);
      if (result.success) {
        updatePinConfig({ isEnabled: false });
        setPinConfig(getPinConfig());
        setViewMode('overview');
        if (showMessage) showMessage('PIN App Lock disabled');
      } else {
        setWizardError(result.lockedOut 
          ? `Locked out for ${result.remainingSeconds}s` 
          : 'Incorrect PIN. Unable to disable.');
      }
    } catch (err) {
      setWizardLoading(false);
      setWizardError('Verification failed. Try again.');
    }
  };

  // Handle New PIN submit in wizard
  const handleNewPinSubmit = (e) => {
    e.preventDefault();
    if (newPinInput.length !== 4) {
      setWizardError('PIN must be exactly 4 digits');
      return;
    }
    setWizardError('');
    setWizardStep('confirm');
  };

  // Handle Confirm New PIN submit in wizard
  const handleConfirmPinSubmit = async (e) => {
    e.preventDefault();
    if (confirmPinInput !== newPinInput) {
      setWizardError('PINs do not match. Please re-enter.');
      return;
    }
    setWizardLoading(true);
    setWizardError('');

    try {
      const updated = await savePinConfig(newPinInput, autoLockTimeout);
      setWizardLoading(false);
      setPinConfig(updated);
      setViewMode('overview');
      if (showMessage) showMessage('Security PIN successfully configured');
    } catch (err) {
      setWizardLoading(false);
      setWizardError('Failed to save PIN. Try again.');
    }
  };

  // Handle Auto-Lock Timeout update
  const handleTimeoutChange = (newTimeout) => {
    const val = Number(newTimeout);
    updatePinConfig({ autoLockTimeout: val });
    setPinConfig(getPinConfig());
    if (showMessage) {
      const label = val === 0 ? 'Immediately' : `${val / 60} min`;
      showMessage(`Auto-lock set to ${label}`);
    }
  };

  // Handle Remember Me preference update for web browser
  const handleToggleRememberMe = () => {
    const nextVal = !rememberMe;
    setRememberMe(nextVal);
    setRememberMePreference(nextVal);
    // Sync current session token to new storage engine
    const currentToken = localStorage.getItem('nwm_session_token') || sessionStorage.getItem('nwm_session_token');
    if (currentToken) {
      setSafeStorage('nwm_session_token', currentToken);
    }
    if (showMessage) {
      showMessage(nextVal ? 'Persistent login activated' : 'Ephemeral session activated');
    }
  };

  // Handle Browser Inactivity Timeout
  const handleIdleTimeoutChange = (minutes) => {
    const val = Number(minutes);
    setIdleTimeout(val);
    setBrowserIdleTimeoutMinutes(val);
    if (showMessage) showMessage(`Inactivity lock set to ${val} minutes`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-swipe"
      onClick={onClose}
    >
      <div 
        className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 px-5 border-b border-border-subtle flex items-center justify-between bg-surface-layer2/40">
          <div className="flex items-center gap-2.5">
            {viewMode !== 'overview' && (
              <button 
                onClick={() => setViewMode('overview')}
                className="p-1 -ml-1 text-text-muted hover:text-text-primary rounded-lg transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-primary-accent/15 border border-primary-accent/30 flex items-center justify-center text-primary-accent">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-base leading-tight">
                {viewMode === 'wizard' ? (isPinEnabled ? 'Change PIN' : 'Set Security PIN') : (viewMode === 'disable_confirm' ? 'Disable PIN' : 'Security & Access Control')}
              </h3>
              <p className="text-[11px] text-text-muted leading-tight mt-0.5">
                {viewMode === 'overview' ? 'Dual-tier platform security configuration' : '4-digit cryptographic vault lock'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {viewMode === 'overview' ? (
            <>
              {/* Environment Status Badge */}
              <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-layer2/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    appShellMode 
                      ? 'bg-wealth-emerald/15 text-wealth-emerald border border-wealth-emerald/30' 
                      : 'bg-primary-accent/15 text-primary-accent border border-primary-accent/30'
                  }`}>
                    {appShellMode ? <Smartphone size={20} /> : <Globe size={20} />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <span>{appShellMode ? 'Mobile App Shell' : 'Web Browser Session'}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                        appShellMode 
                          ? 'bg-wealth-emerald/20 text-wealth-emerald' 
                          : 'bg-primary-accent/20 text-primary-accent'
                      }`}>
                        {appShellMode ? 'Encrypted Container' : 'Browser Sandbox'}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {appShellMode 
                        ? 'Hardware-sandboxed Expo WebView runtime' 
                        : 'Web browser environment with tab-scoped storage'}
                    </p>
                  </div>
                </div>
              </div>

              {/* PIN App Lock Section */}
              <div className="border border-border-subtle rounded-xl p-4 bg-surface-layer2/30 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isPinEnabled ? 'bg-wealth-emerald/15 text-wealth-emerald' : 'bg-surface-layer3 text-text-muted'}`}>
                      {isPinEnabled ? <Lock size={18} /> : <Unlock size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">PIN App Lock</h4>
                      <p className="text-xs text-text-muted">
                        {isPinEnabled ? 'Vault protected with 4-digit PIN' : 'Require PIN on launch & resume'}
                      </p>
                    </div>
                  </div>
                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={handleTogglePin}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      isPinEnabled ? 'bg-primary-accent justify-end' : 'bg-surface-layer3 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>

                {/* Sub-controls when PIN is enabled */}
                {isPinEnabled && (
                  <div className="pt-3 border-t border-border-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Security Credentials</span>
                      <button
                        type="button"
                        onClick={handleStartChangePin}
                        className="text-xs text-primary-accent hover:text-primary-accent/80 font-medium flex items-center gap-1"
                      >
                        <KeyRound size={13} />
                        <span>Change PIN</span>
                      </button>
                    </div>

                    {/* Auto-Lock Grace Period Selector */}
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                        <Clock size={13} className="text-text-muted" />
                        <span>Auto-Lock Grace Period</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Immediate', val: 0 },
                          { label: '1 min', val: 60 },
                          { label: '5 min', val: 300 },
                          { label: '15 min', val: 900 }
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => handleTimeoutChange(opt.val)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                              autoLockTimeout === opt.val
                                ? 'bg-primary-accent text-white shadow-xs'
                                : 'bg-surface-layer1 border border-border-subtle text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-text-muted mt-1.5">
                        {autoLockTimeout === 0 
                          ? 'Locks immediately when switching apps or locking phone.' 
                          : `Re-entry allowed without PIN for up to ${autoLockTimeout / 60} minutes after backgrounding.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Web Browser Specific Controls */}
              {!appShellMode && (
                <div className="border border-border-subtle rounded-xl p-4 bg-surface-layer2/30 space-y-3.5">
                  <div className="flex items-center gap-2 text-text-primary font-semibold text-sm">
                    <Laptop size={16} className="text-primary-accent" />
                    <span>Browser Session Security</span>
                  </div>

                  {/* Keep me signed in toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-semibold text-text-primary">Keep Me Signed In</h5>
                      <p className="text-[11px] text-text-muted max-w-[240px]">
                        {rememberMe 
                          ? 'Stored in device localStorage (persistent across browser restarts).' 
                          : 'Ephemeral session (purged automatically when browser tab is closed).'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleRememberMe}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        rememberMe ? 'bg-primary-accent justify-end' : 'bg-surface-layer3 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                    </button>
                  </div>

                  {/* Inactivity Idle Timeout */}
                  <div className="pt-3 border-t border-border-subtle">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                      <Clock size={13} className="text-text-muted" />
                      <span>Inactivity Lockout (Browser)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '5 min', val: 5 },
                        { label: '15 min', val: 15 },
                        { label: '30 min', val: 30 }
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => handleIdleTimeoutChange(opt.val)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                            idleTimeout === opt.val
                              ? 'bg-primary-accent text-white shadow-xs'
                              : 'bg-surface-layer1 border border-border-subtle text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Session Audit & Sign Out */}
              <div className="pt-2">
                <div className="text-[11px] text-text-muted mb-2 px-1">
                  Active User: <span className="text-text-primary font-medium">{userEmail || 'Authenticated Session'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onSignOut) onSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-medium text-liability-rose bg-liability-rose/10 hover:bg-liability-rose/15 border border-liability-rose/25 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Sign Out on this Device</span>
                </button>
              </div>
            </>
          ) : viewMode === 'disable_confirm' ? (
            /* Disable PIN Confirmation View */
            <form onSubmit={handleConfirmDisablePin} className="space-y-4 py-2">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-liability-rose/15 text-liability-rose flex items-center justify-center mx-auto mb-2">
                  <Unlock size={24} />
                </div>
                <h4 className="text-sm font-bold text-text-primary">Disable PIN Protection?</h4>
                <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
                  Please enter your current 4-digit PIN to confirm removing app lock security.
                </p>
              </div>

              {wizardError && (
                <div className="p-2.5 rounded-lg bg-liability-rose/15 border border-liability-rose/30 text-liability-rose text-xs text-center flex items-center justify-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{wizardError}</span>
                </div>
              )}

              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  required
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-surface-layer2 border border-border-subtle rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-text-primary focus:outline-none focus:border-primary-accent"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('overview')}
                  className="flex-1 py-2.5 rounded-xl border border-border-subtle text-xs font-medium text-text-secondary hover:bg-surface-layer2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={currentPinInput.length !== 4 || wizardLoading}
                  className="flex-1 py-2.5 rounded-xl bg-liability-rose text-white text-xs font-semibold hover:bg-liability-rose/90 disabled:opacity-50"
                >
                  {wizardLoading ? 'Verifying...' : 'Disable PIN'}
                </button>
              </div>
            </form>
          ) : (
            /* Guided Wizard View (Set or Change PIN) */
            <div className="py-2 space-y-4">
              {wizardStep === 'current' && (
                <form onSubmit={handleVerifyCurrentPin} className="space-y-4">
                  <div className="text-center">
                    <h4 className="text-sm font-bold text-text-primary">Enter Current PIN</h4>
                    <p className="text-xs text-text-muted mt-1">
                      Verify your identity to proceed with changing your PIN.
                    </p>
                  </div>

                  {wizardError && (
                    <div className="p-2.5 rounded-lg bg-liability-rose/15 border border-liability-rose/30 text-liability-rose text-xs text-center flex items-center justify-center gap-1.5">
                      <AlertCircle size={14} />
                      <span>{wizardError}</span>
                    </div>
                  )}

                  <div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      autoFocus
                      required
                      value={currentPinInput}
                      onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full bg-surface-layer2 border border-border-subtle rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-text-primary focus:outline-none focus:border-primary-accent"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={currentPinInput.length !== 4 || wizardLoading}
                    className="w-full py-2.5 rounded-xl bg-primary-accent text-white text-xs font-semibold hover:bg-primary-accent/90 disabled:opacity-50"
                  >
                    {wizardLoading ? 'Verifying...' : 'Next'}
                  </button>
                </form>
              )}

              {wizardStep === 'new' && (
                <form onSubmit={handleNewPinSubmit} className="space-y-4">
                  <div className="text-center">
                    <h4 className="text-sm font-bold text-text-primary">Create New PIN</h4>
                    <p className="text-xs text-text-muted mt-1">
                      Choose a memorable 4-digit code to protect your vault.
                    </p>
                  </div>

                  {wizardError && (
                    <div className="p-2.5 rounded-lg bg-liability-rose/15 border border-liability-rose/30 text-liability-rose text-xs text-center flex items-center justify-center gap-1.5">
                      <AlertCircle size={14} />
                      <span>{wizardError}</span>
                    </div>
                  )}

                  <div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      autoFocus
                      required
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full bg-surface-layer2 border border-border-subtle rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-text-primary focus:outline-none focus:border-primary-accent"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={newPinInput.length !== 4}
                    className="w-full py-2.5 rounded-xl bg-primary-accent text-white text-xs font-semibold hover:bg-primary-accent/90 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </form>
              )}

              {wizardStep === 'confirm' && (
                <form onSubmit={handleConfirmPinSubmit} className="space-y-4">
                  <div className="text-center">
                    <h4 className="text-sm font-bold text-text-primary">Confirm New PIN</h4>
                    <p className="text-xs text-text-muted mt-1">
                      Re-enter the 4-digit PIN to ensure accuracy.
                    </p>
                  </div>

                  {wizardError && (
                    <div className="p-2.5 rounded-lg bg-liability-rose/15 border border-liability-rose/30 text-liability-rose text-xs text-center flex items-center justify-center gap-1.5">
                      <AlertCircle size={14} />
                      <span>{wizardError}</span>
                    </div>
                  )}

                  <div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      autoFocus
                      required
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full bg-surface-layer2 border border-border-subtle rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-text-primary focus:outline-none focus:border-primary-accent"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setWizardStep('new'); setWizardError(''); }}
                      className="flex-1 py-2.5 rounded-xl border border-border-subtle text-xs font-medium text-text-secondary hover:bg-surface-layer2"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={confirmPinInput.length !== 4 || wizardLoading}
                      className="flex-1 py-2.5 rounded-xl bg-wealth-emerald text-white text-xs font-semibold hover:bg-wealth-emerald/90 disabled:opacity-50"
                    >
                      {wizardLoading ? 'Saving...' : 'Save PIN'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
