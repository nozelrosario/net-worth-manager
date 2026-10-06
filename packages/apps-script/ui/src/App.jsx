import React, { useState, useEffect } from 'react';
import { Shield, Home, PieChart, Receipt, Vault, Lock, Eye, EyeOff, Bell } from 'lucide-react';
import HomeTab from './screens/HomeTab';
import AssetsTab from './screens/AssetsTab';
import SpendsTab from './screens/SpendsTab';
import SafeTab from './screens/SafeTab';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data via google script api
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setData(res);
          setLoading(false);
        })
        .withFailureHandler(() => setLoading(false))
        .getDashboardData();
    } else {
      setTimeout(() => setLoading(false), 1000);
    }
  }, []);

  const formatCurrency = (val) => {
    if (isPrivacyMode) return '₹ ••••••';
    if (!val) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-root">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-surface-layer2 border-t-wealth-emerald rounded-full animate-spin"></div>
          <p className="text-text-secondary text-sm">Synchronizing Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background-root text-text-primary overflow-hidden">
      {/* App Bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background-root/90 backdrop-blur border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-accent text-white flex items-center justify-center font-bold text-sm">
            F
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-base leading-tight">Net Worth Manager</h1>
            <span className="text-text-secondary text-xs">All Family (Combined) ▾</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-text-secondary">
          <button onClick={() => setIsPrivacyMode(!isPrivacyMode)}>
            {isPrivacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <div className="relative">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-bullion-amber rounded-full"></span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {activeTab === 'home' && <HomeTab formatCurrency={formatCurrency} />}
        {activeTab === 'assets' && <AssetsTab formatCurrency={formatCurrency} />}
        {activeTab === 'spends' && <SpendsTab formatCurrency={formatCurrency} />}
        {activeTab === 'safe' && <SafeTab formatCurrency={formatCurrency} />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface-layer1 border-t border-border-subtle flex items-center justify-around px-2 z-50">
        <NavButton icon={Home} label="Dashboard" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <NavButton icon={PieChart} label="Assets" active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} />
        <NavButton icon={Receipt} label="Spends" active={activeTab === 'spends'} onClick={() => setActiveTab('spends')} />
        <NavButton icon={Shield} label="Family Safe" active={activeTab === 'safe'} onClick={() => setActiveTab('safe')} />
      </nav>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${active ? 'text-primary-accent' : 'text-text-muted hover:text-text-secondary'}`}>
      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
