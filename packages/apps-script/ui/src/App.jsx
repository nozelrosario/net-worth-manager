import React, { useState, useEffect } from 'react';
import { Shield, Home, PieChart, Receipt, Vault, Eye, EyeOff, Bell, User, LogOut, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import HomeTab from './screens/HomeTab';
import AssetsTab from './screens/AssetsTab';
import SpendsTab from './screens/SpendsTab';
import SafeTab from './screens/SafeTab';
import SettingsTab from './screens/SettingsTab';

const TABS = ['home', 'assets', 'spends', 'safe', 'settings'];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshData = () => {
    setIsSyncing(true);
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setData(res);
          setIsSyncing(false);
        })
        .withFailureHandler(() => setIsSyncing(false))
        .getDashboardData();
    } else {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  useEffect(() => {
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setData(res);
          setLoading(false);
        })
        .withFailureHandler(() => setLoading(false))
        .getDashboardData();
    } else {
      setTimeout(() => {
         setData({
           userInfo: { activeEmail: 'demo@family.com', userRole: 'admin', isOwner: true },
           assets: [], transactions: [], familyProfiles: [], events: [], settings: []
         });
         setLoading(false);
      }, 1000);
    }
  }, []);

  const formatCurrency = (val) => {
    if (isPrivacyMode) return '₹ ••••••';
    if (!val) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN');
  };

  const handleSwipe = (dir) => {
    const currentIndex = TABS.indexOf(activeTab);
    if (dir === 'Left' && currentIndex < TABS.length - 1) {
      setActiveTab(TABS[currentIndex + 1]);
    } else if (dir === 'Right' && currentIndex > 0) {
      setActiveTab(TABS[currentIndex - 1]);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('Left'),
    onSwipedRight: () => handleSwipe('Right'),
    trackMouse: true,
  });

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

  const userInitial = data?.userInfo?.activeEmail ? data.userInfo.activeEmail.charAt(0).toUpperCase() : 'U';

  return (
    <div className="flex flex-col h-screen bg-background-root text-text-primary overflow-hidden">
      {/* App Bar */}
      <header className={`sticky top-0 z-50 px-4 py-3 bg-background-root/90 backdrop-blur border-b border-border-subtle transition-all duration-300 ${headerExpanded ? 'pb-4 shadow-md' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowUserModal(true)}>
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-primary-accent text-white flex items-center justify-center font-bold text-sm shadow-sm border border-border-subtle">
                {userInitial}
              </div>
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background-root ${isSyncing ? 'bg-bullion-amber animate-pulse' : 'bg-wealth-emerald'}`}></div>
            </div>
            <div className="flex flex-col" onClick={(e) => { e.stopPropagation(); setHeaderExpanded(!headerExpanded); }}>
              <h1 className="font-bold text-base leading-tight tracking-tight">Net Worth Manager</h1>
              <span className="text-text-secondary text-xs flex items-center gap-1">
                {data?.userInfo?.userRole === 'admin' ? 'Family Admin' : 'Family Member'} {headerExpanded ? '▴' : '▾'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-text-secondary">
            <button onClick={() => setIsPrivacyMode(!isPrivacyMode)} className="p-1.5 rounded-full hover:bg-surface-layer1 transition-colors">
              {isPrivacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <div className="relative p-1.5 rounded-full hover:bg-surface-layer1 transition-colors cursor-pointer">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-bullion-amber rounded-full"></span>
            </div>
          </div>
        </div>
        
        {headerExpanded && (
          <div className="mt-4 pt-4 border-t border-border-subtle flex justify-around text-xs text-text-secondary">
             <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white" onClick={refreshData}>
               <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
               <span>Sync</span>
             </div>
             <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white">
               <Shield size={18} />
               <span>Security</span>
             </div>
          </div>
        )}
      </header>

      {/* User Session Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowUserModal(false)}>
          <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-[85%] max-w-sm overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 flex flex-col items-center border-b border-border-subtle relative bg-gradient-to-b from-primary-accent/10 to-transparent">
              <div className="w-16 h-16 rounded-full bg-primary-accent text-white flex items-center justify-center font-bold text-2xl shadow-inner mb-3">
                {userInitial}
              </div>
              <h3 className="text-lg font-bold text-white">{data?.userInfo?.activeEmail}</h3>
              <p className="text-sm text-primary-accent font-medium mt-1 uppercase tracking-wider">{data?.userInfo?.userRole}</p>
            </div>
            <div className="p-2">
              <button className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm text-text-primary hover:bg-surface-layer2 transition-colors">
                <User size={18} className="text-text-secondary" /> Profile Settings
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm text-liability-rose hover:bg-liability-rose/10 transition-colors mt-1">
                <LogOut size={18} /> Sign Out (Device)
              </button>
            </div>
            <div className="p-4 bg-surface-layer2 text-center text-xs text-text-muted">
              App Version 2.0.1 • Encrypted Session
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area with Swiping */}
      <main {...swipeHandlers} className="flex-1 overflow-y-auto p-4 pb-24 space-y-4 touch-pan-y">
        {activeTab === 'home' && <HomeTab formatCurrency={formatCurrency} data={data} />}
        {activeTab === 'assets' && <AssetsTab formatCurrency={formatCurrency} data={data} />}
        {activeTab === 'spends' && <SpendsTab formatCurrency={formatCurrency} data={data} />}
        {activeTab === 'safe' && <SafeTab formatCurrency={formatCurrency} data={data} />}
        {activeTab === 'settings' && <SettingsTab data={data} />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface-layer1/95 backdrop-blur-md border-t border-border-subtle flex items-center justify-around px-2 z-40 pb-safe">
        <NavButton icon={Home} label="Dashboard" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <NavButton icon={PieChart} label="Assets" active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} />
        <NavButton icon={Receipt} label="Spends" active={activeTab === 'spends'} onClick={() => setActiveTab('spends')} />
        <NavButton icon={Shield} label="Family Safe" active={activeTab === 'safe'} onClick={() => setActiveTab('safe')} />
        {data?.userInfo?.userRole === 'admin' && (
           <NavButton icon={SettingsIcon} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        )}
      </nav>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 ${active ? 'text-primary-accent scale-105' : 'text-text-muted hover:text-text-secondary'}`}>
      <Icon size={22} strokeWidth={active ? 2.5 : 2} className={active ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''} />
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </button>
  );
}
