import React, { useState, useEffect } from "react";
import useModalBack from "./hooks/useModalBack";
import { X } from "lucide-react";
import { Shield, Home, PieChart, Receipt, Vault, Eye, EyeOff, Bell, User, LogOut, RefreshCw, Settings as SettingsIcon, Moon, Bug } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import HomeTab from './screens/HomeTab';
import AssetsTab from './screens/AssetsTab';
import SpendsTab from './screens/SpendsTab';
import SafeTab from './screens/SafeTab';
import SettingsTab from './screens/SettingsTab';
import LoginScreen from './screens/LoginScreen';
import { getSafeStorage, setSafeStorage, removeSafeStorage } from './utils/storage';

const TABS = ['home', 'assets', 'spends', 'safe', 'settings'];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  useModalBack(showUserModal, () => setShowUserModal(false));
  
  const [showNotifications, setShowNotifications] = useState(false);
  useModalBack(showNotifications, () => setShowNotifications(false));

  const getUpcomingReminders = (assets) => {
    if (!assets) return [];
    const reminders = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thresholdDate = new Date(now.getTime());
    thresholdDate.setDate(now.getDate() + 30); // Next 30 days
    
    assets.forEach(asset => {
      let details = {};
      try {
        details = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
      } catch(e) {}
      
      const maturityDateStr = details['Maturity Date'];
      if (maturityDateStr) {
        const maturityDate = new Date(maturityDateStr);
        if (maturityDate >= now && maturityDate <= thresholdDate) {
           const daysLeft = Math.ceil((maturityDate - now) / (1000 * 60 * 60 * 24));
           reminders.push({
             _id: 'rem_' + asset['Asset ID'],
             title: 'Upcoming Maturity',
             address: asset.Category,
             body: `${asset.Name} is maturing in ${daysLeft} days (on ${maturityDate.toLocaleDateString()}). Current Value: ${formatCurrency(asset['Current Value'])}`,
             date: maturityDate.getTime(),
             assetId: asset['Asset ID']
           });
        } else if (maturityDate < now) {
           reminders.push({
             _id: 'rem_' + asset['Asset ID'],
             title: 'Matured Asset',
             address: asset.Category,
             body: `${asset.Name} has matured on ${maturityDate.toLocaleDateString()}. Please update its status or reinvest.`,
             date: maturityDate.getTime(),
             assetId: asset['Asset ID'],
             isOverdue: true
           });
        }
      }
    });
    return reminders.sort((a, b) => a.date - b.date);
  };

  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionToken, setSessionToken] = useState(() => getSafeStorage('nwm_session_token'));
  const [darkMode, setDarkMode] = useState(() => getSafeStorage('nwm_dark_mode', 'true') === 'true');
  const [debugMode, setDebugMode] = useState(() => getSafeStorage('nwm_debug_mode', 'false') === 'true');
  const [debugLog, setDebugLog] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setSafeStorage('nwm_dark_mode', darkMode.toString());
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    setSafeStorage('nwm_debug_mode', debugMode.toString());
  }, [debugMode]);

  const showMessage = (msg, isError = false) => {
    if (debugMode) {
      const timestamp = new Date().toLocaleTimeString();
      setDebugLog(prev => `[${timestamp}] ${isError ? 'ERROR' : 'INFO'}: ${msg}\n` + prev);
    } else { 
      setToast({ msg, isError });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const refreshData = (tokenToUse = sessionToken) => {
    setIsSyncing(true);
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setData(res);
          setIsSyncing(false);
          setLoading(false);
        })
        .withFailureHandler((err) => {
          setDebugLog('App Sync Error: ' + err.message);
          setIsSyncing(false);
          setLoading(false);
        })
        .getDashboardData(tokenToUse);
    } else {
      setTimeout(() => {
        setIsSyncing(false);
        setLoading(false);
      }, 1000);
    }
  };

  useEffect(() => {
    if (window.google?.script?.run) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setData(res);
          setLoading(false);
        })
        .withFailureHandler((err) => {
          setDebugLog('Initial Load Error: ' + err.message);
          setLoading(false);
        })
        .getDashboardData(sessionToken);
    } else {
      setTimeout(() => {
         setData({
           userInfo: { activeEmail: 'demo@family.com', userRole: 'admin', isOwner: true, isAuthorized: true },
           assets: [], transactions: [], familyProfiles: [], events: [], settings: []
         });
         setLoading(false);
      }, 1000);
    }
  }, []);

  const handleLoginSuccess = (newToken) => {
    setSessionToken(newToken);
    setLoading(true);
    refreshData(newToken);
  };

  const handleSignOut = () => {
    removeSafeStorage('nwm_session_token');
    setSessionToken('');
    window.location.reload();
  };

  const handleSwipe = (dir, event) => {
    // Prevent swipe if any modal is present
    if (document.body.classList.contains('has-modal')) {
      return;
    }
    
    let target = event?.target;
    if (target && target.nodeType === 3) target = target.parentNode;
    if (target && target.closest && target.closest('.no-swipe')) {
      return;
    }
    
    const currentIndex = TABS.indexOf(activeTab);
    if (dir === 'Left' && currentIndex < TABS.length - 1) {
      setActiveTab(TABS[currentIndex + 1]);
    } else if (dir === 'Right' && currentIndex > 0) {
      setActiveTab(TABS[currentIndex - 1]);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData) => handleSwipe('Left', eventData.event),
    onSwipedRight: (eventData) => handleSwipe('Right', eventData.event),
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

  // If we have data but user is not authorized, show login screen
  if (data && data.userInfo && data.userInfo.isAuthorized === false) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const formatCurrency = (val) => {
    if (isPrivacyMode) return '₹ ••••••';
    if (!val) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN');
  };


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
            <div onClick={() => setShowNotifications(true)} className="relative p-1.5 rounded-full hover:bg-surface-layer1 transition-colors cursor-pointer">
              <Bell size={20} />
              {getUpcomingReminders(data?.assets).length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-bullion-amber rounded-full animate-pulse"></span>}
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
        <div className="fixed inset-0 z-50 no-swipe flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowUserModal(false)}>
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
              <div className="w-full flex items-center justify-between p-3 rounded-xl text-sm text-text-primary hover:bg-surface-layer2 transition-colors cursor-pointer" onClick={() => setDarkMode(!darkMode)}>
                <div className="flex items-center gap-3"><Moon size={18} className="text-text-secondary" /> Dark Mode</div>
                <div className={`w-8 h-4 rounded-full flex items-center p-0.5 ${darkMode ? 'bg-primary-accent justify-end' : 'bg-surface-layer3 justify-start'}`}><div className="w-3 h-3 bg-white rounded-full"></div></div>
              </div>
              <div className="w-full flex items-center justify-between p-3 rounded-xl text-sm text-text-primary hover:bg-surface-layer2 transition-colors cursor-pointer" onClick={() => setDebugMode(!debugMode)}>
                <div className="flex items-center gap-3"><Bug size={18} className="text-text-secondary" /> Debug Mode</div>
                <div className={`w-8 h-4 rounded-full flex items-center p-0.5 ${debugMode ? 'bg-primary-accent justify-end' : 'bg-surface-layer3 justify-start'}`}><div className="w-3 h-3 bg-white rounded-full"></div></div>
              </div>
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm text-liability-rose hover:bg-liability-rose/10 transition-colors mt-1">
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
        {activeTab === 'home' && <HomeTab formatCurrency={formatCurrency} data={data} onRefresh={refreshData} showMessage={showMessage} />}
        {activeTab === 'assets' && <AssetsTab formatCurrency={formatCurrency} data={data} onRefresh={refreshData} showMessage={showMessage} />}
        {activeTab === 'spends' && <SpendsTab formatCurrency={formatCurrency} data={data} onRefresh={refreshData} showMessage={showMessage} />}
        {activeTab === 'safe' && <SafeTab formatCurrency={formatCurrency} data={data} onRefresh={refreshData} showMessage={showMessage} />}
        {activeTab === 'settings' && <SettingsTab data={data} onRefresh={refreshData} showMessage={showMessage} />}
      </main>
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowNotifications(false)}>
          <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bell size={18} className="text-primary-accent" /> Reminders</h3>
              <button onClick={() => setShowNotifications(false)} className="text-text-muted hover:text-white p-1"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
              {getUpcomingReminders(data?.assets).length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No upcoming reminders.</p>
              ) : (
                getUpcomingReminders(data?.assets).map(rem => (
                  <div key={rem._id} className={`bg-surface-layer2 p-3 rounded-xl border ${rem.isOverdue ? 'border-liability-rose/50' : 'border-bullion-amber/50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-semibold text-sm truncate pr-2 ${rem.isOverdue ? 'text-liability-rose' : 'text-bullion-amber'}`}>{rem.title}</span>
                      <span className="text-xs text-text-muted whitespace-nowrap">{new Date(rem.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-text-primary mb-2 leading-relaxed">{rem.body}</p>
                    <div className="flex justify-between items-center mt-2">
                       <span className="bg-surface-layer1 text-text-secondary text-[10px] px-2 py-1 rounded border border-border-subtle">{rem.address}</span>
                       <button onClick={() => { setShowNotifications(false); setActiveTab('assets'); }} className="text-xs text-primary-accent hover:text-primary-accent/80 font-medium">View Asset &rarr;</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}


      {/* Debug Bar */}
      {debugMode && (
        <div className="fixed bottom-16 left-0 right-0 bg-surface-layer2 text-text-primary p-2 text-xs font-mono z-50 max-h-48 overflow-y-auto border-t border-border-prominent shadow-xl whitespace-pre-wrap break-words flex flex-col">
          <div className="flex justify-between items-center border-b border-border-subtle pb-1 mb-1">
            <strong className="text-primary-accent">Debug Bar</strong>
            <div className="flex gap-4">
              <button onClick={() => { navigator.clipboard.writeText(debugLog).then(() => setToast({ msg: 'Copied to clipboard', isError: false })); setTimeout(() => setToast(null), 2000); }} className="text-text-muted hover:text-text-primary">Copy</button>
              <button onClick={() => setDebugLog('')} className="text-text-muted hover:text-text-primary">Clear</button>
            </div>
          </div>
          {debugLog || <span className="text-text-muted italic">No logs yet...</span>}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm font-medium whitespace-nowrap transition-all animate-bounce ${toast.isError ? 'bg-liability-rose text-white' : 'bg-wealth-emerald text-white'}`}>
          {toast.msg}
        </div>
      )}

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
