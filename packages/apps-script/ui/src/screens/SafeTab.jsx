import React from 'react';
import { Lock, FileText, Phone, Key, ShieldAlert } from 'lucide-react';

export default function SafeTab({ formatCurrency }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-xl font-bold">Family Safe</h2>
          <p className="text-xs text-text-secondary">Net Worth Manager Succession Ledger</p>
        </div>
      </div>
      
      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4 flex gap-4 items-center">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="absolute w-full h-full transform -rotate-90">
            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-surface-layer2" />
            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="175" strokeDashoffset="14" className="text-wealth-emerald" />
          </svg>
          <span className="text-sm font-bold">92%</span>
        </div>
        <div>
          <h3 className="font-bold text-sm">Nominees Verified</h3>
          <p className="text-xs text-bullion-amber mt-1">1 Account Missing Nominee</p>
          <p className="text-xs text-liability-rose">1 Locker Key Undocumented</p>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-primary-accent to-purple-600 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm mb-3">
            <Lock size={20} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Generate Master ICE Kit</h3>
          <p className="text-xs text-white/80 leading-relaxed mb-4">
            Compiles a secure, password-protected PDF containing all folio IDs, bank accounts, locker locations, and claim contacts for your executor.
          </p>
          <button className="w-full py-2.5 bg-white text-primary-accent font-bold text-sm rounded-lg shadow-sm">
            Export Master ICE Kit
          </button>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        <h3 className="text-sm font-semibold text-text-secondary">Protection & Insurance</h3>
        
        <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm font-medium text-white">HDFC Ergo Optima Restore</p>
              <p className="text-xs text-text-muted mt-0.5">Health Floater • Policy #2819-0019</p>
            </div>
            <div className="w-8 h-8 rounded bg-surface-layer2 flex items-center justify-center">
              <ShieldAlert size={16} className="text-primary-accent" />
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border-subtle">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondary">Sum Assured</span>
              <span className="font-medium text-white">{formatCurrency(2500000)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondary">TPA Helpline</span>
              <a href="tel:1800266600" className="flex items-center gap-1 text-primary-accent font-medium">
                <Phone size={12} /> 1800-2666-00
              </a>
            </div>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-text-secondary mt-6">Asset & Key Locator</h3>
        <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-4">
          <div className="flex gap-3 mb-2">
            <Key size={18} className="text-bullion-amber mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Bank of Baroda Locker #42</p>
              <p className="text-[11px] text-text-muted mt-0.5">Bandra West Branch • Co-signatory: Spouse</p>
            </div>
          </div>
          <div className="mt-2 ml-7 p-2.5 bg-surface-layer2 rounded text-[11px] text-text-secondary border border-border-subtle">
            <span className="font-medium text-white">Physical Key:</span> Master Godrej Safe (Bedroom), Locker #2, Silver Key Tag.
          </div>
        </div>
      </div>
    </div>
  );
}
