import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Lock, Delete, AlertCircle, KeyRound } from 'lucide-react';
import { verifyPin, getRemainingLockoutTime, clearPinConfig } from '../utils/securityUtils';

export default function AppLockScreen({ onUnlockSuccess, onForgotPin, title, subtitle }) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(() => getRemainingLockoutTime());
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const timerRef = useRef(null);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining > 0) {
      timerRef.current = setInterval(() => {
        setLockoutRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setErrorMsg('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutRemaining]);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
    }, 400);
  }, []);

  const handleVerify = useCallback(async (pinToVerify) => {
    if (isVerifying || lockoutRemaining > 0) return;
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const result = await verifyPin(pinToVerify);
      if (result.success) {
        setPin('');
        setIsVerifying(false);
        if (onUnlockSuccess) onUnlockSuccess();
      } else {
        triggerShake();
        if (result.lockedOut) {
          setLockoutRemaining(result.remainingSeconds || 30);
          setErrorMsg(`Security Lockout: Try again in ${result.remainingSeconds || 30}s`);
        } else {
          const attemptsMsg = result.attemptsLeft !== undefined 
            ? ` (${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'attempt' : 'attempts'} left)`
            : '';
          setErrorMsg(`Incorrect PIN${attemptsMsg}`);
        }
        setPin('');
        setIsVerifying(false);
      }
    } catch (e) {
      triggerShake();
      setErrorMsg('Authentication error. Please retry.');
      setPin('');
      setIsVerifying(false);
    }
  }, [isVerifying, lockoutRemaining, onUnlockSuccess, triggerShake]);

  const handleDigit = useCallback((digit) => {
    if (lockoutRemaining > 0 || isVerifying) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');
      if (nextPin.length === 4) {
        // Auto verify upon 4th digit
        setTimeout(() => handleVerify(nextPin), 60);
      }
    }
  }, [pin, lockoutRemaining, isVerifying, handleVerify]);

  const handleBackspace = useCallback(() => {
    if (lockoutRemaining > 0 || isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  }, [lockoutRemaining, isVerifying]);

  const handleClear = useCallback(() => {
    if (lockoutRemaining > 0 || isVerifying) return;
    setPin('');
    setErrorMsg('');
  }, [lockoutRemaining, isVerifying]);

  // Hardware keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (lockoutRemaining > 0) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear, lockoutRemaining]);

  const handleForgotPinClick = () => {
    setShowForgotConfirm(true);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-background-root text-text-primary px-6 py-10 select-none no-swipe">
      {/* Header Info */}
      <div className="flex flex-col items-center mt-4">
        <div className="w-16 h-16 rounded-2xl bg-primary-accent/10 border border-primary-accent/30 flex items-center justify-center text-primary-accent shadow-lg mb-4">
          <Shield size={32} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-center">
          {title || 'Net Worth Vault'}
        </h2>
        <p className="text-sm text-text-secondary mt-1 text-center">
          {subtitle || 'Enter your 4-digit security PIN'}
        </p>

        {/* Masked PIN Dots Indicator */}
        <div className={`flex items-center gap-4 mt-8 ${isShaking ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                  isFilled
                    ? 'bg-primary-accent border-primary-accent scale-110 shadow-[0_0_12px_rgba(99,102,241,0.6)]'
                    : 'border-border-prominent bg-surface-layer2 scale-100'
                }`}
              />
            );
          })}
        </div>

        {/* Error or Lockout Message Banner */}
        <div className="h-10 mt-3 flex items-center justify-center">
          {lockoutRemaining > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-liability-rose/15 border border-liability-rose/30 text-liability-rose text-xs font-medium animate-pulse">
              <AlertCircle size={14} />
              <span>Locked out for {lockoutRemaining}s</span>
            </div>
          ) : errorMsg ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-liability-rose/15 border border-liability-rose/30 text-liability-rose text-xs font-medium">
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Numeric Keypad Grid */}
      <div className="w-full max-w-xs mb-2">
        <div className="grid grid-cols-3 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={lockoutRemaining > 0 || isVerifying}
              onClick={() => handleDigit(String(num))}
              className="h-16 rounded-2xl bg-surface-layer1 border border-border-subtle flex items-center justify-center text-2xl font-semibold text-text-primary shadow-xs hover:border-border-prominent active:scale-95 active:bg-primary-accent/15 transition-all duration-100 disabled:opacity-40 disabled:pointer-events-none"
            >
              {num}
            </button>
          ))}
          
          {/* Row 4: Clear, 0, Backspace */}
          <button
            type="button"
            disabled={lockoutRemaining > 0 || isVerifying || pin.length === 0}
            onClick={handleClear}
            className="h-16 rounded-2xl bg-surface-layer1 border border-border-subtle flex items-center justify-center text-sm font-semibold text-text-muted hover:text-text-primary hover:border-border-prominent active:scale-95 transition-all duration-100 disabled:opacity-30 disabled:pointer-events-none"
          >
            Clear
          </button>
          
          <button
            type="button"
            disabled={lockoutRemaining > 0 || isVerifying}
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-surface-layer1 border border-border-subtle flex items-center justify-center text-2xl font-semibold text-text-primary shadow-xs hover:border-border-prominent active:scale-95 active:bg-primary-accent/15 transition-all duration-100 disabled:opacity-40 disabled:pointer-events-none"
          >
            0
          </button>
          
          <button
            type="button"
            disabled={lockoutRemaining > 0 || isVerifying || pin.length === 0}
            onClick={handleBackspace}
            aria-label="Backspace"
            className="h-16 rounded-2xl bg-surface-layer1 border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-prominent active:scale-95 active:bg-liability-rose/15 transition-all duration-100 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Delete size={22} />
          </button>
        </div>
      </div>

      {/* Forgot PIN Recovery Trigger */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={handleForgotPinClick}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary-accent font-medium py-2 px-3 rounded-lg transition-colors"
        >
          <KeyRound size={14} />
          <span>Forgot PIN? Sign In with OTP</span>
        </button>
      </div>

      {/* Forgot PIN Confirmation Dialog */}
      {showForgotConfirm && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setShowForgotConfirm(false)}
        >
          <div 
            className="bg-surface-layer1 border border-border-subtle rounded-2xl p-5 max-w-xs w-full text-center shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-primary-accent/15 text-primary-accent flex items-center justify-center mx-auto">
              <KeyRound size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-text-primary">Reset PIN via OTP?</h3>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                Your stored PIN will be cleared and you will be routed to Email OTP verification.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForgotConfirm(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-border-subtle text-xs font-medium text-text-secondary hover:bg-surface-layer2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgotConfirm(false);
                  clearPinConfig();
                  if (onForgotPin) onForgotPin();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary-accent text-white text-xs font-semibold hover:bg-primary-accent/90 transition-colors shadow-xs"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
