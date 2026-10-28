import React from 'react';
import { Shield } from 'lucide-react';

export default function PrivacyCurtain({ onResume }) {
  return (
    <div
      onClick={onResume}
      className="fixed inset-0 z-[9990] flex flex-col items-center justify-center bg-background-root/98 backdrop-blur-2xl text-text-primary px-6 cursor-pointer select-none no-swipe transition-all"
    >
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-primary-accent/15 border border-primary-accent/40 flex items-center justify-center text-primary-accent shadow-2xl">
          <Shield size={40} className="animate-pulse" />
        </div>
        <div className="absolute -inset-1 rounded-3xl bg-primary-accent/20 blur-xl -z-10 animate-pulse" />
      </div>
      <h3 className="text-typ-subtitle font-bold tracking-tight text-center">Net Worth Vault</h3>
      <p className="text-typ-label text-text-muted mt-1.5 text-center max-w-xs">
        Financial Intelligence Shielded • Tap to Resume
      </p>
    </div>
  );
}
