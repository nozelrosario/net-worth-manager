import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { setSafeStorage } from '../utils/storage';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email'); // 'email' or 'otp'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError('');

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsLoading(false);
          if (res.status === 'error') {
            setError(res.message);
          } else {
            setStep('otp');
          }
        })
        .withFailureHandler((err) => {
          setIsLoading(false);
          setError(err.message);
        })
        .sendVerificationCode(email);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        setStep('otp');
      }, 1000);
    }
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (!otp) return;
    setIsLoading(true);
    setError('');

    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsLoading(false);
          if (res.status === 'error') {
            setError(res.message);
          } else {
            // Save token
            setSafeStorage('nwm_session_token', res.sessionToken);
            onLoginSuccess(res.sessionToken);
          }
        })
        .withFailureHandler((err) => {
          setIsLoading(false);
          setError(err.message);
        })
        .verifyEmailCode(email, otp);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        setSafeStorage('nwm_session_token', 'mock_token');
        onLoginSuccess('mock_token');
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background-root text-text-primary p-6 items-center justify-center">
      <div className="w-full max-w-sm bg-surface-layer1 border border-border-subtle rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-primary-accent/20 rounded-full flex items-center justify-center text-primary-accent mb-3">
            <Shield size={24} />
          </div>
          <h2 className="text-xl font-bold text-center">Net Worth Manager</h2>
          <p className="text-sm text-text-secondary text-center mt-1">
            {step === 'email' ? 'Sign in to access your family vault' : 'Enter the verification code sent to your email'}
          </p>
        </div>

        {error && (
          <div className="bg-liability-rose/10 border border-liability-rose/30 text-liability-rose text-xs p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email Address</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary-accent" 
                placeholder="you@family.com" 
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading || !email} 
              className="w-full py-2.5 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Sending Code...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">6-Digit Code</label>
              <input 
                type="text" 
                required 
                maxLength={6}
                value={otp} 
                onChange={e => setOtp(e.target.value)} 
                className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-4 py-2.5 text-white text-center tracking-widest text-lg font-mono focus:outline-none focus:border-primary-accent" 
                placeholder="000000" 
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading || otp.length < 6} 
              className="w-full py-2.5 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Sign In'}
            </button>
            <button 
              type="button" 
              onClick={() => setStep('email')} 
              className="w-full py-2 text-text-muted hover:text-text-primary text-xs transition-colors"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
