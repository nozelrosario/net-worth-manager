import useModalBack from "../hooks/useModalBack";
import { getSafeStorage } from "../utils/storage";
import React, { useState, useEffect, useMemo } from 'react';
import DynamicForm, { calculatePerformance } from "../components/DynamicForm";
import { Badge } from "../components/Badge";
import { 
  AlertTriangle, 
  Trash2, 
  Lock, 
  Paperclip, 
  RefreshCw, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  X, 
  Plus, 
  Shield, 
  Landmark, 
  HeartPulse, 
  Cloud, 
  ChevronDown, 
  ChevronUp, 
  MoreVertical, 
  ChevronRight,
  Search,
  Users,
  Copy,
  Check,
  Bell,
  Eye
} from 'lucide-react';
import { isInsuranceAsset, calculatePolicyMetrics } from "../utils/insuranceMath";
import CasSyncModal from "../components/CasSyncModal";
import SmsInboxModal from "../components/SmsInboxModal";

const getSafeCategoryForAsset = (assetCategory) => {
  const cat = (assetCategory || '').toLowerCase();
  if (cat.includes('real estate') || cat.includes('plot') || cat.includes('land') || cat.includes('property') || cat.includes('flat') || cat.includes('house')) {
    return 'Property';
  }
  if (cat.includes('vehicle') || cat.includes('car') || cat.includes('bike')) {
    return 'Vehicle';
  }
  if (cat.includes('medical') || cat.includes('health') || cat.includes('insurance')) {
    return 'Medical';
  }
  if (cat.includes('tax')) {
    return 'Tax';
  }
  return 'Finance';
};

export default function AssetsTab({ 
  formatCurrency, 
  data, 
  onRefresh, 
  showMessage, 
  onOpenRebalancer, 
  onOpenRetirementPlanner, 
  onOpenInsuranceHub,
  onOpenNotifications,
  targetAssetFocus,
  onClearTargetAssetFocus,
  targetCategoryFilter,
  onClearTargetCategoryFilter
}) {
  const [filter, setFilter] = useState('All Assets');
  const [selectedOwner, setSelectedOwner] = useState('All Family');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('value_desc');
  const [selectedSegment, setSelectedSegment] = useState('category'); // 'category' | 'owner' | 'liquidity'
  const [copiedId, setCopiedId] = useState(null);
  const [focusedAssetId, setFocusedAssetId] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [newAsset, setNewAsset] = useState({ Name: '', Category: 'Equity', 'Current Value': '', Owner: '' });
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingRates, setIsSyncingRates] = useState(false);
  const [showCasModal, setShowCasModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showActionItemsModal, setShowActionItemsModal] = useState(false);

  useEffect(() => {
    if (!showToolsModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowToolsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showToolsModal]);

  useEffect(() => {
    if (!showActionItemsModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowActionItemsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showActionItemsModal]);

  useModalBack(showAddModal, () => {
    if (deleteConfirmAsset) {
      setDeleteConfirmAsset(null);
    } else {
      setShowAddModal(false);
    }
  });

  useModalBack(showActionItemsModal, () => {
    setShowActionItemsModal(false);
  });

  const assets = data?.assets || [];
  
  const defaultCategories = 'Equity, Mutual Funds, Gold, Cash/FD, Real Estate, Retirement & Pension, Life Insurance / LIC, Liabilities';
  const customCategoriesStr = data?.settings?.find(s => s['Setting Key'] === 'AssetCategories')?.['Setting Value'] || defaultCategories;
  let categoriesList = customCategoriesStr.split(',').map(s => s.trim()).filter(Boolean);
  if (!categoriesList.includes('Retirement & Pension') && !categoriesList.includes('Provident Funds')) {
    const liabIdx = categoriesList.indexOf('Liabilities');
    if (liabIdx !== -1) {
      categoriesList.splice(liabIdx, 0, 'Retirement & Pension');
    } else {
      categoriesList.push('Retirement & Pension');
    }
  }
  if (!categoriesList.includes('Life Insurance / LIC') && !categoriesList.includes('Insurance')) {
    const liabIdx = categoriesList.indexOf('Liabilities');
    if (liabIdx !== -1) {
      categoriesList.splice(liabIdx, 0, 'Life Insurance / LIC');
    } else {
      categoriesList.push('Life Insurance / LIC');
    }
  }
  const profiles = data?.familyProfiles || [];
  
  const filters = ['All Assets', ...categoriesList];

  // Available unique owners across profiles and actual asset holdings
  const availableOwners = useMemo(() => {
    const set = new Set();
    profiles.forEach(p => {
      if (p.Name) set.add(p.Name.trim());
    });
    assets.forEach(a => {
      const o = String(a.Owner || '').trim();
      if (o) set.add(o);
    });
    const list = Array.from(set).sort();
    return ['All Family', ...list];
  }, [profiles, assets]);

  // Aggregate valuations per owner (and for the whole family)
  const ownerValuations = useMemo(() => {
    const map = { 'All Family': 0 };
    assets.forEach(a => {
      const val = Number(a['Current Value'] || 0);
      const isLiab = a.Category === 'Liabilities';
      const effectiveVal = isLiab ? -val : val;
      map['All Family'] += effectiveVal;

      const owner = String(a.Owner || 'Self').trim();
      map[owner] = (map[owner] || 0) + effectiveVal;
    });
    return map;
  }, [assets]);

  // 1. Assets filtered by Owner
  const ownerFilteredAssets = useMemo(() => {
    if (!selectedOwner || selectedOwner === 'All Family') return assets;
    const target = selectedOwner.trim().toLowerCase();
    return assets.filter(a => {
      const o = String(a.Owner || 'Self').trim().toLowerCase();
      if (target === 'self') {
        return o === 'self' || o === '';
      }
      return o === target;
    });
  }, [assets, selectedOwner]);

  // Dynamic holding counts for category pills (scoped to selected owner)
  const assetCounts = useMemo(() => {
    const counts = { 'All Assets': ownerFilteredAssets.length };
    filters.forEach(f => {
      if (f === 'All Assets') return;
      counts[f] = ownerFilteredAssets.filter(a => {
        if (f === 'Retirement & Pension') {
          return a.Category === 'Retirement & Pension' || a.Category === 'Provident Funds' || (a.Category || '').toLowerCase().includes('retire') || (a.Category || '').toLowerCase().includes('provident');
        }
        if (f === 'Life Insurance / LIC' || f === 'Insurance') {
          return a.Category === 'Life Insurance / LIC' || a.Category === 'Insurance' || (a.Category || '').toLowerCase().includes('insurance') || (a.Category || '').toLowerCase().includes('lic');
        }
        return a.Category === f;
      }).length;
    });
    return counts;
  }, [ownerFilteredAssets, filters]);

  // 2. Assets filtered by Category
  const categoryFilteredAssets = useMemo(() => {
    if (filter === 'All Assets') return ownerFilteredAssets;
    return ownerFilteredAssets.filter(a => {
      if (filter === 'Retirement & Pension') {
        return a.Category === 'Retirement & Pension' || a.Category === 'Provident Funds' || (a.Category || '').toLowerCase().includes('retire') || (a.Category || '').toLowerCase().includes('provident');
      }
      if (filter === 'Life Insurance / LIC' || filter === 'Insurance') {
        return a.Category === 'Life Insurance / LIC' || a.Category === 'Insurance' || (a.Category || '').toLowerCase().includes('insurance') || (a.Category || '').toLowerCase().includes('lic');
      }
      return a.Category === filter;
    });
  }, [ownerFilteredAssets, filter]);

  // 3. Assets filtered by Search Query
  const searchFilteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return categoryFilteredAssets;
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return categoryFilteredAssets.filter(asset => {
      let details = {};
      try {
        details = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
      } catch (e) {}

      const searchableStrings = [
        asset.Name,
        asset.Category,
        asset.Owner,
        asset['Asset ID'],
        details['Folio Number'],
        details['Folio'],
        details['Account Number'],
        details['Certificate Number'],
        details['Broker'],
        details['Demat'],
        details['DP ID'],
        details['Scheme Code'],
        details['Ticker'],
        details['Symbol'],
        details['Bank'],
        details['Bank Name'],
        details['Institution'],
        details['Notes'],
        details['Description'],
        details['Policy Number'],
        details['Survey Number'],
        details['Form Factor']
      ].map(v => String(v || '').toLowerCase());

      const combined = searchableStrings.join(' ');
      return tokens.every(token => combined.includes(token));
    });
  }, [categoryFilteredAssets, searchQuery]);

  // 4. Sorted Assets
  const sortedAssets = useMemo(() => {
    const list = [...searchFilteredAssets];
    const getPnlPct = (asset) => {
      let cost = Number(asset.Cost || 0);
      let det = {};
      try {
        det = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
      } catch (e) {}
      if (asset.Category === 'Equity' && det['Quantity'] && det['Average Buy Price']) {
        cost = Number(det['Quantity']) * Number(det['Average Buy Price']);
      } else if (asset.Category === 'Mutual Funds' && det['Units'] && det['Average NAV']) {
        cost = Number(det['Units']) * Number(det['Average NAV']);
      }
      const val = Number(asset['Current Value'] || 0);
      if (cost > 0 && val > 0) return ((val - cost) / cost) * 100;
      return -Infinity;
    };

    switch (sortBy) {
      case 'value_desc':
        return list.sort((a, b) => Number(b['Current Value'] || 0) - Number(a['Current Value'] || 0));
      case 'value_asc':
        return list.sort((a, b) => Number(a['Current Value'] || 0) - Number(b['Current Value'] || 0));
      case 'gain_desc':
        return list.sort((a, b) => getPnlPct(b) - getPnlPct(a));
      case 'loss_desc':
        return list.sort((a, b) => getPnlPct(a) - getPnlPct(b));
      case 'name_asc':
        return list.sort((a, b) => String(a.Name || '').localeCompare(String(b.Name || '')));
      case 'recent':
        return list.sort((a, b) => String(b['Acquisition Date'] || '').localeCompare(String(a['Acquisition Date'] || '')));
      default:
        return list;
    }
  }, [searchFilteredAssets, sortBy]);

  // Scoped Valuation, Cost, and Returns for the Valuation Ribbon
  const { totalValuation, totalCost, totalPnl, pnlPct, isGain } = useMemo(() => {
    const targetSet = filter === 'All Assets' ? ownerFilteredAssets : categoryFilteredAssets;
    let valSum = 0;
    let costSum = 0;

    targetSet.forEach(a => {
      const val = Number(a['Current Value'] || 0);
      const isLiab = a.Category === 'Liabilities';
      if (isLiab) {
        valSum -= val;
      } else {
        valSum += val;
        let det = {};
        try {
          det = typeof a['Details JSON'] === 'string' ? JSON.parse(a['Details JSON']) : (a['Details JSON'] || {});
        } catch (e) {}

        let cost = Number(a.Cost || 0);
        if (a.Category === 'Equity' && det['Quantity'] && det['Average Buy Price']) {
          cost = Number(det['Quantity']) * Number(det['Average Buy Price']);
        } else if (a.Category === 'Mutual Funds' && det['Units'] && det['Average NAV']) {
          cost = Number(det['Units']) * Number(det['Average NAV']);
        }
        if (cost > 0) costSum += cost;
      }
    });

    const pnl = costSum > 0 ? valSum - costSum : 0;
    const pct = costSum > 0 ? (pnl / costSum) * 100 : 0;

    return {
      totalValuation: valSum,
      totalCost: costSum,
      totalPnl: pnl,
      pnlPct: pct,
      isGain: pnl >= 0
    };
  }, [ownerFilteredAssets, categoryFilteredAssets, filter]);

  // Breakdown data for the mini allocation bar and segment tabs
  const breakdownData = useMemo(() => {
    const categoryMap = {};
    const ownerMap = {};
    const liquidityMap = {
      'Liquid & Cash': 0,
      'Market & Growth': 0,
      'Retirement & Fixed': 0,
      'Real Estate & Physical': 0
    };

    let totalVal = 0;

    ownerFilteredAssets.forEach(a => {
      const val = Number(a['Current Value'] || 0);
      const cat = a.Category || 'Other';
      if (cat === 'Liabilities') return;

      totalVal += val;

      categoryMap[cat] = (categoryMap[cat] || 0) + val;

      const own = a.Owner || 'Self';
      ownerMap[own] = (ownerMap[own] || 0) + val;

      const lCat = (cat || '').toLowerCase();
      if (lCat.includes('cash') || lCat.includes('deposit') || lCat.includes('savings') || lCat.includes('fd')) {
        liquidityMap['Liquid & Cash'] += val;
      } else if (lCat.includes('equity') || lCat.includes('mutual') || lCat.includes('stock')) {
        liquidityMap['Market & Growth'] += val;
      } else if (lCat.includes('retire') || lCat.includes('provident') || lCat.includes('insur') || lCat.includes('lic') || lCat.includes('epf') || lCat.includes('ppf') || lCat.includes('nps')) {
        liquidityMap['Retirement & Fixed'] += val;
      } else {
        liquidityMap['Real Estate & Physical'] += val;
      }
    });

    const formatList = (map, colorPalette) => {
      return Object.entries(map)
        .filter(([_, amount]) => amount > 0)
        .map(([name, amount], idx) => ({
          name,
          amount,
          percent: totalVal > 0 ? (amount / totalVal) * 100 : 0,
          color: colorPalette[idx % colorPalette.length]
        }))
        .sort((a, b) => b.amount - a.amount);
    };

    const categoryColors = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];
    const ownerColors = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#8B5CF6'];
    const liquidityColors = ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B'];

    return {
      category: formatList(categoryMap, categoryColors),
      owner: formatList(ownerMap, ownerColors),
      liquidity: formatList(liquidityMap, liquidityColors),
      totalVal
    };
  }, [ownerFilteredAssets]);

  // Actionable alerts (FD maturities within 30 days & overdue, active insurance grace periods & upcoming dues, zero valuation)
  const actionAlerts = useMemo(() => {
    const alerts = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    ownerFilteredAssets.forEach(a => {
      let det = {};
      try {
        det = typeof a['Details JSON'] === 'string' ? JSON.parse(a['Details JSON']) : (a['Details JSON'] || {});
      } catch (e) {}

      const matDate = det['Maturity Date'];
      if (matDate) {
        const d = new Date(matDate);
        if (!isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 30) {
            alerts.push({
              type: 'fd_maturity',
              severity: diffDays <= 7 ? 'danger' : 'warning',
              badge: diffDays === 0 ? 'Matures Today' : `Matures in ${diffDays}d`,
              title: `${a.Name} matures in ${diffDays}d`,
              desc: `Fixed deposit matures on ${d.toLocaleDateString()}. Action needed to reinvest or withdraw.`,
              asset: a
            });
          } else if (diffDays < 0) {
            alerts.push({
              type: 'fd_matured',
              severity: 'danger',
              badge: 'Matured',
              title: `${a.Name} has matured`,
              desc: `Matured on ${d.toLocaleDateString()} (${Math.abs(diffDays)}d ago). Please update status or reinvest.`,
              asset: a
            });
          }
        }
      }

      if (isInsuranceAsset(a)) {
        const polMetrics = calculatePolicyMetrics(a);
        if (polMetrics.isOverdue) {
          alerts.push({
            type: 'insurance_grace',
            severity: 'danger',
            badge: 'Grace Period Active',
            title: `${a.Name}: Grace Period Active`,
            desc: `Premium payment is overdue. Policy is currently at risk during active grace period!`,
            asset: a
          });
        } else if (polMetrics.isDueSoon) {
          alerts.push({
            type: 'insurance_due',
            severity: 'warning',
            badge: `Due in ${polMetrics.daysUntilDue}d`,
            title: `${a.Name}: Premium Due Soon`,
            desc: `Renewal premium of ${polMetrics.premiumAmount ? formatCurrency(polMetrics.premiumAmount) : 'due amount'} is due on ${polMetrics.nextDueDate || 'upcoming date'}.`,
            asset: a
          });
        }
      }

      // Check for zero or missing valuation when cost > 0
      const curVal = Number(a['Current Value'] || 0);
      const cost = Number(a.Cost || 0);
      if (curVal === 0 && cost > 0 && a.Category !== 'Liabilities') {
        alerts.push({
          type: 'zero_val',
          severity: 'warning',
          badge: 'Unpriced Asset',
          title: `${a.Name}: ₹0 Valuation`,
          desc: `Invested cost is ${formatCurrency(cost)}, but current value is ₹0. Please sync market prices or update valuation.`,
          asset: a
        });
      }
    });

    return alerts;
  }, [ownerFilteredAssets, formatCurrency]);

  const handleCopy = (text, id, e) => {
    e.stopPropagation();
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(String(text));
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    showMessage(`Copied: ${text}`);
  };

  const handleSyncRates = () => {
    setIsSyncingRates(true);
    if (window.google?.script?.run) {
      const token = getSafeStorage('nwm_session_token');
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSyncingRates(false);
          if (onRefresh) onRefresh();
          showMessage(res?.message || 'Live market valuations synchronized!');
        })
        .withFailureHandler((err) => {
          setIsSyncingRates(false);
          showMessage('Sync Error: ' + err.message, true);
        })
        .syncLiveValuationsToSheet(token);
    } else {
      setTimeout(() => {
        setIsSyncingRates(false);
        if (onRefresh) onRefresh();
        showMessage('Live market valuations synchronized (preview)');
      }, 1000);
    }
  };

  const openAddModal = (initialCategory) => {
    setEditingAssetId(null);
    let catToUse = typeof initialCategory === 'string' ? initialCategory : '';
    if (!catToUse) {
      if (filter && filter !== 'All Assets') {
        catToUse = filter;
      } else {
        catToUse = categoriesList[0] || 'Equity';
      }
    }
    const isInsur = (catToUse || '').toLowerCase().includes('insur') || (catToUse || '').toLowerCase().includes('lic');
    setNewAsset({ 
      Name: '', 
      Category: catToUse, 
      'Current Value': '', 
      Owner: '', 
      'Details JSON': isInsur ? {
        'Policy Type': 'Endowment Plan (Savings + Life Cover)',
        'Premium Frequency': 'Yearly',
        'Grace Period Days': 30
      } : { 'Live Tracking': true } 
    });
    setAttachedFiles([]);
    setUploadProgress('');
    setDeleteConfirmAsset(null);
    setShowAddModal(true);
  };

  useEffect(() => {
    const prefill = sessionStorage.getItem('nwm_prefill_asset_category');
    if (prefill) {
      sessionStorage.removeItem('nwm_prefill_asset_category');
      openAddModal(prefill);
    }
  }, []);

  // React to external category navigation (e.g. from HomeTab allocation chips or Rebalancer)
  useEffect(() => {
    if (!targetCategoryFilter?.category) return;
    setFilter(targetCategoryFilter.category);
    if (onClearTargetCategoryFilter) onClearTargetCategoryFilter();
  }, [targetCategoryFilter]);

  // React to external asset cross-link focus & scroll (e.g. from Reminders, Retirement Hub, Rebalancer, Insurance Hub)
  useEffect(() => {
    if (!targetAssetFocus?.assetId) return;
    const { assetId, action } = targetAssetFocus;

    const target = assets.find(a => 
      String(a['Asset ID']) === String(assetId) ||
      String(a.ID) === String(assetId) ||
      String(a.Name).toLowerCase() === String(assetId).toLowerCase()
    );

    if (!target) {
      if (onClearTargetAssetFocus) onClearTargetAssetFocus();
      return;
    }

    const actualAssetId = target['Asset ID'] || target.ID || target.Name;

    // Ensure asset is visible in list by adjusting filters if needed
    if (filter !== 'All Assets' && filter !== target.Category) {
      setFilter('All Assets');
    }
    if (selectedOwner !== 'All Family' && target.Owner && selectedOwner !== target.Owner) {
      setSelectedOwner('All Family');
    }
    if (searchQuery) {
      setSearchQuery('');
    }

    setFocusedAssetId(actualAssetId);

    // Scroll to the card element with a retry mechanism
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      attempts++;
      const el = document.getElementById(`asset-card-${actualAssetId}`);
      if (el) {
        clearInterval(interval);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (action === 'edit') {
          setTimeout(() => {
            openEditModal(target);
          }, 350);
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        if (action === 'edit') {
          openEditModal(target);
        }
      }
    }, 60);

    const timer = setTimeout(() => {
      setFocusedAssetId(null);
      if (onClearTargetAssetFocus) onClearTargetAssetFocus();
    }, 3800);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [targetAssetFocus, assets]);

  const handleSelectActionAlert = (alert, action = 'view') => {
    setShowActionItemsModal(false);
    const target = alert.asset;
    if (!target) return;
    const actualAssetId = target['Asset ID'] || target.ID || target.Name;

    if (filter !== 'All Assets' && filter !== target.Category) {
      setFilter('All Assets');
    }
    if (selectedOwner !== 'All Family' && target.Owner && selectedOwner !== target.Owner) {
      setSelectedOwner('All Family');
    }
    if (searchQuery) {
      setSearchQuery('');
    }

    setFocusedAssetId(actualAssetId);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const el = document.getElementById(`asset-card-${actualAssetId}`);
      if (el) {
        clearInterval(interval);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (action === 'edit') {
          setTimeout(() => openEditModal(target), 300);
        }
      } else if (attempts >= 20) {
        clearInterval(interval);
        if (action === 'edit') openEditModal(target);
      }
    }, 60);

    setTimeout(() => {
      setFocusedAssetId(null);
    }, 3800);
  };

  const openEditModal = (asset) => {
    setEditingAssetId(asset['Asset ID']);
    let details = {};
    try {
      details = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
    } catch (e) {
      details = {};
    }
    
    const safeDocId = details['Safe Document ID'];
    const safeDoc = safeDocId && data?.safe ? data.safe.find(s => String(s['Document ID']) === String(safeDocId)) : null;
    let files = [];
    if (safeDoc && safeDoc['Files JSON']) {
      try {
        files = typeof safeDoc['Files JSON'] === 'string' ? JSON.parse(safeDoc['Files JSON']) : safeDoc['Files JSON'];
      } catch (e) {}
    } else if (details['Files JSON']) {
      try {
        files = typeof details['Files JSON'] === 'string' ? JSON.parse(details['Files JSON']) : details['Files JSON'];
      } catch (e) {
        files = [];
      }
    }
    setAttachedFiles(Array.isArray(files) ? files : []);
    setUploadProgress('');
    setDeleteConfirmAsset(null);
    let acqDate = asset['Acquisition Date'];
    if (typeof acqDate === 'string' && acqDate.includes('T')) {
      acqDate = acqDate.split('T')[0];
    }
    setNewAsset({ ...asset, 'Acquisition Date': acqDate, 'Details JSON': details });
    setShowAddModal(true);
  };

  const handleDelete = () => {
    const currentAsset = assets.find(a => String(a['Asset ID']) === String(editingAssetId)) || newAsset;
    let details = {};
    try {
      details = typeof currentAsset['Details JSON'] === 'string' ? JSON.parse(currentAsset['Details JSON']) : (currentAsset['Details JSON'] || {});
    } catch (e) {}

    let formDetails = {};
    try {
      formDetails = typeof newAsset['Details JSON'] === 'string' ? JSON.parse(newAsset['Details JSON']) : (newAsset['Details JSON'] || {});
    } catch (e) {}

    const safeDocId = details['Safe Document ID'] || formDetails['Safe Document ID'];
    const files = details['Files JSON'] || formDetails['Files JSON'];
    const hasFiles = (Array.isArray(files) && files.length > 0) || (attachedFiles && attachedFiles.length > 0);
    const fileCount = (Array.isArray(files) ? files.length : 0) || (attachedFiles ? attachedFiles.length : 0);
    const assetName = newAsset.Name || currentAsset.Name || 'Asset';

    setDeleteConfirmAsset({
      assetId: editingAssetId,
      assetName: assetName,
      safeDocId: safeDocId,
      hasDocuments: !!(safeDocId || hasFiles),
      fileCount: fileCount
    });
  };

  const confirmDeleteAsset = async (assetId, safeDocId, deleteDocuments) => {
    setIsSubmitting(true);
    setUploadProgress(deleteDocuments ? 'Deleting asset & documents...' : 'Deleting asset...');

    if (window.google?.script?.run) {
      const token = getSafeStorage('nwm_session_token');
      try {
        if (deleteDocuments && safeDocId) {
          await new Promise((resolve) => {
            window.google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler((err) => {
                console.warn('Error deleting safe document, proceeding with asset deletion:', err);
                resolve();
              })
              .deleteSafeDocument(safeDocId, token);
          });
        }

        await new Promise((resolve, reject) => {
          window.google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            .deleteRecord('Assets', 'Asset ID', assetId, token);
        });

        setIsSubmitting(false);
        setUploadProgress('');
        setDeleteConfirmAsset(null);
        setShowAddModal(false);
        if (onRefresh) onRefresh();
        showMessage(deleteDocuments ? 'Asset and supporting documents deleted.' : 'Asset deleted.');
      } catch (err) {
        setIsSubmitting(false);
        setUploadProgress('');
        showMessage('Delete Error: ' + err.message, true);
      }
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        setUploadProgress('');
        setDeleteConfirmAsset(null);
        setShowAddModal(false);
        showMessage(deleteDocuments ? 'Asset & documents deleted (preview)' : 'Asset deleted (preview)');
      }, 1000);
    }
  };

  const handleSaveAsset = async (e, submittedAsset) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadProgress('Preparing...');

    try {
      const targetAsset = submittedAsset || newAsset;
      const token = getSafeStorage('nwm_session_token');
      let details = {};
      try {
        details = typeof targetAsset['Details JSON'] === 'string' ? JSON.parse(targetAsset['Details JSON']) : (targetAsset['Details JSON'] || {});
      } catch (e) {
        details = {};
      }

      if (window.google?.script?.run) {
        // 1. Upload newly attached files to Drive
        const filesToUpload = attachedFiles.filter(f => f.isNewUpload);
        const existingFiles = attachedFiles.filter(f => !f.isNewUpload);
        const safeCategory = getSafeCategoryForAsset(targetAsset.Category);

        let newlyUploaded = [];
        if (filesToUpload.length > 0) {
          for (let i = 0; i < filesToUpload.length; i++) {
            const f = filesToUpload[i];
            setUploadProgress(`Uploading ${i + 1} of ${filesToUpload.length}...`);
            const uploadRes = await new Promise((resolve, reject) => {
              window.google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .uploadFileToDrive(f.base64, f.name, f.mimeType, safeCategory, token);
            });

            if (uploadRes && uploadRes.status === 'success') {
              newlyUploaded.push({
                name: uploadRes.fileName,
                url: uploadRes.fileUrl,
                id: uploadRes.fileId,
                mimeType: uploadRes.mimeType
              });
            } else {
              throw new Error(uploadRes?.message || `Failed to upload ${f.name}`);
            }
          }
        }

        const finalFiles = [...existingFiles, ...newlyUploaded];
        let safeDocId = details['Safe Document ID'];

        // 2. Sync with Family Safe
        if (finalFiles.length > 0) {
          setUploadProgress('Saving to Family Safe...');
          const safePayload = {
            Name: `${targetAsset.Name} - Supporting Documents`,
            Category: safeCategory,
            Owner: targetAsset.Owner || 'Self',
            Description: `Supporting documents for asset: ${targetAsset.Name} (${targetAsset.Category})`,
            'Files JSON': JSON.stringify(finalFiles),
            'Date Added': new Date().toISOString().split('T')[0]
          };

          if (safeDocId) {
            await new Promise((resolve, reject) => {
              window.google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .updateRecord('Safe', 'Document ID', safeDocId, safePayload, token);
            });
          } else {
            const safeRes = await new Promise((resolve, reject) => {
              window.google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .addRecord('Safe', { 'Document ID': '', ...safePayload }, token);
            });
            if (safeRes && safeRes.id) {
              safeDocId = safeRes.id;
            }
          }
        }

        // 3. Update Asset record with updated Details JSON
        setUploadProgress('Saving asset...');
        const finalDetails = {
          ...details,
          'Files JSON': finalFiles,
          'Safe Document ID': safeDocId || ''
        };

        // Auto-derive Cost from Quantity and Average Buy Price / NAV
        const eqQty = Number(finalDetails['Quantity'] || finalDetails['Units'] || 0);
        const eqAvgBuyPrice = Number(finalDetails['Average Buy Price'] || 0);
        const mfUnits = Number(finalDetails['Units'] || finalDetails['Quantity'] || 0);
        const mfAvgNav = Number(finalDetails['Average NAV'] || 0);

        let derivedCost = 0;
        if (targetAsset.Category === 'Equity' && eqQty > 0 && eqAvgBuyPrice > 0) {
          derivedCost = Math.round(eqQty * eqAvgBuyPrice * 100) / 100;
        } else if (targetAsset.Category === 'Mutual Funds' && mfUnits > 0 && mfAvgNav > 0) {
          derivedCost = Math.round(mfUnits * mfAvgNav * 100) / 100;
        } else {
          derivedCost = Number(targetAsset.Cost || 0);
        }

        const assetPayload = {
          ...targetAsset,
          Cost: derivedCost > 0 ? derivedCost : (targetAsset.Cost || ''),
          'Details JSON': finalDetails
        };

        if (editingAssetId) {
          await new Promise((resolve, reject) => {
            window.google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .updateRecord('Assets', 'Asset ID', editingAssetId, assetPayload, token);
          });
        } else {
          await new Promise((resolve, reject) => {
            window.google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .addRecord('Assets', {
                ...assetPayload,
                'Asset ID': '',
                'Acquisition Date': assetPayload['Acquisition Date'] || ''
              }, token);
          });
        }

        setIsSubmitting(false);
        setUploadProgress('');
        setShowAddModal(false);
        if (onRefresh) onRefresh();
        showMessage(editingAssetId ? 'Asset updated successfully' : 'Asset added successfully');
      } else {
        setTimeout(() => {
          setIsSubmitting(false);
          setUploadProgress('');
          setShowAddModal(false);
          showMessage(editingAssetId ? 'Asset updated (preview)' : 'Asset added (preview)');
        }, 1000);
      }
    } catch (err) {
      setIsSubmitting(false);
      setUploadProgress('');
      showMessage('Save Error: ' + err.message, true);
    }
  };

  return (
    <div className="space-y-3 pb-16">
      {/* Row 1: Title + AMFI Live Status + ⋮ Actions Menu + + Add Asset CTA */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-typ-title font-bold tracking-tight text-text-primary truncate">Assets & Liabilities</h2>
          <button 
            type="button"
            onClick={() => setShowToolsModal(true)} 
            title="Portfolio Actions & Hubs"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary bg-surface-layer1 hover:bg-surface-layer2 border border-border-subtle shadow-xs transition-all active:scale-95 shrink-0"
          >
            <MoreVertical size={16} />
          </button>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-typ-footnote text-text-muted shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald animate-pulse"></span>
            AMFI Live
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            type="button"
            onClick={() => openAddModal()} 
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-accent hover:bg-primary-accent/90 text-white rounded-lg text-typ-label font-semibold shadow-md shadow-primary-accent/20 transition-all active:scale-95"
          >
            <Plus size={14} />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Row 2: Family Owner Switcher Carousel */}
      {availableOwners.length > 1 && (
        <div 
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 no-swipe"
          onTouchStart={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onMouseMove={e => e.stopPropagation()}
        >
          {availableOwners.map(owner => {
            const isSelected = selectedOwner === owner;
            const ownerVal = ownerValuations[owner] !== undefined ? ownerValuations[owner] : 0;
            return (
              <button
                key={owner}
                type="button"
                onClick={() => setSelectedOwner(owner)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-typ-label font-medium transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-primary-accent text-white shadow-xs font-semibold'
                    : 'bg-surface-layer1 hover:bg-surface-layer2 text-text-secondary hover:text-text-primary border border-border-subtle shadow-xs'
                }`}
              >
                <span>{owner === 'All Family' ? '👥 All Family' : `👤 ${owner}`}</span>
                <span className={`text-typ-micro sm:text-typ-caption px-1.5 py-0.2 rounded-full tabular-nums font-semibold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-surface-layer2 text-text-muted'
                }`}>
                  {formatCurrency(ownerVal)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Row 3: Streamlined Single Valuation Ribbon (No bulky 3 sub-cards) */}
      <div className="bg-surface-layer1 border border-border-subtle rounded-xl p-3 sm:p-3.5 relative overflow-hidden shadow-sm">
        <div className="absolute -right-10 -bottom-10 w-28 h-28 bg-wealth-emerald/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Top: Scoped Valuation & Return Pill */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-typ-caption sm:text-typ-footnote text-text-muted uppercase tracking-wider font-medium truncate block">
              {filter !== 'All Assets' 
                ? `${filter} Valuation (${selectedOwner === 'All Family' ? 'Family' : selectedOwner})` 
                : (selectedOwner === 'All Family' ? 'Consolidated Family Valuation' : `${selectedOwner}'s Portfolio Valuation`)}
            </span>
            <div className="text-typ-heading sm:text-typ-display font-bold text-text-primary tabular-nums mt-0.5 leading-tight truncate">
              {formatCurrency(totalValuation)}
            </div>
          </div>

          {totalCost > 0 && (
            <div className="flex flex-col items-end shrink-0 pl-1">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-typ-footnote sm:text-typ-label font-semibold border ${
                isGain 
                  ? 'bg-wealth-emerald/10 text-wealth-emerald border-wealth-emerald/20' 
                  : 'bg-liability-rose/10 text-liability-rose border-liability-rose/20'
              }`}>
                {isGain ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                <span>{isGain ? '+' : ''}{formatCurrency(totalPnl)} ({isGain ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
              </span>
              <span className="text-typ-micro sm:text-typ-caption text-text-muted mt-0.5 tabular-nums">
                Cost: {formatCurrency(totalCost)}
              </span>
            </div>
          )}
        </div>

        {/* Slim 6px Multi-Color Allocation Mini-Bar */}
        {breakdownData[selectedSegment]?.length > 0 && (
          <div className="mt-2.5">
            <div className="h-1.5 w-full bg-surface-layer2 rounded-full overflow-hidden flex gap-0.5">
              {breakdownData[selectedSegment].map((item, idx) => (
                <div
                  key={idx}
                  className="h-full transition-all cursor-pointer hover:opacity-80"
                  style={{ width: `${Math.max(2, item.percent)}%`, backgroundColor: item.color }}
                  onClick={() => {
                    if (selectedSegment === 'category') {
                      setFilter(filter === item.name ? 'All Assets' : item.name);
                    } else if (selectedSegment === 'owner') {
                      setSelectedOwner(selectedOwner === item.name ? 'All Family' : item.name);
                    }
                  }}
                  title={`${item.name}: ${item.percent.toFixed(1)}% (${formatCurrency(item.amount)})`}
                />
              ))}
            </div>

            {/* Segment Switcher & Allocation Legend */}
            <div className="mt-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex bg-surface-layer2 p-0.5 rounded-lg border border-border-subtle shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedSegment('category')}
                    className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-typ-micro font-medium transition-all ${
                      selectedSegment === 'category'
                        ? 'bg-primary-accent text-white shadow-xs font-semibold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    By Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSegment('owner')}
                    className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-typ-micro font-medium transition-all ${
                      selectedSegment === 'owner'
                        ? 'bg-primary-accent text-white shadow-xs font-semibold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    By Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSegment('liquidity')}
                    className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-typ-micro font-medium transition-all ${
                      selectedSegment === 'liquidity'
                        ? 'bg-primary-accent text-white shadow-xs font-semibold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    By Liquidity
                  </button>
                </div>

                <span className="text-typ-micro text-text-muted hidden sm:inline-block">
                  Click tag to filter
                </span>
              </div>

              {/* Responsive Legend Tags: flex-wrap ensures all items are visible without horizontal cutoff */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-typ-micro">
                {breakdownData[selectedSegment].map((item, idx) => {
                  const isSelected = 
                    (selectedSegment === 'category' && filter === item.name) ||
                    (selectedSegment === 'owner' && selectedOwner === item.name);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (selectedSegment === 'category') {
                          setFilter(filter === item.name ? 'All Assets' : item.name);
                        } else if (selectedSegment === 'owner') {
                          setSelectedOwner(selectedOwner === item.name ? 'All Family' : item.name);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-typ-micro transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-primary-accent/15 border-primary-accent/40 text-primary-accent font-semibold shadow-xs' 
                          : 'bg-surface-layer2/80 border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-prominent'
                      }`}
                      title={`Filter by ${item.name}`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-medium whitespace-nowrap">{item.name}</span>
                      <span className="tabular-nums font-semibold text-text-primary ml-0.5">
                        {item.percent < 1 ? '<1%' : `${item.percent.toFixed(0)}%`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Compact Action Alert Ribbon */}
        {actionAlerts.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-border-subtle/70">
            <button
              type="button"
              onClick={() => setShowActionItemsModal(true)}
              className="w-full text-left bg-bullion-amber/10 hover:bg-bullion-amber/15 border border-bullion-amber/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-bullion-amber cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <AlertTriangle size={14} className="shrink-0 text-bullion-amber" />
                <span className="text-typ-micro sm:text-typ-caption font-semibold uppercase tracking-wider shrink-0">
                  {actionAlerts.length} Action{actionAlerts.length > 1 ? 's' : ''} Needed:
                </span>
                <span className="text-typ-caption text-text-primary truncate">
                  {actionAlerts[0]?.title}
                  {actionAlerts.length > 1 && ` • +${actionAlerts.length - 1} more`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-bullion-amber font-medium text-typ-caption">
                <span className="text-typ-micro uppercase tracking-wider hidden xs:inline">Review All</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Row 4: Search & Secondary Filters & Category Pills */}
      <div className="space-y-2">
        {/* Search Bar + Sort Selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center pointer-events-none">
              <Search size={16} />
            </div>
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface-layer1 border border-border-subtle focus:border-primary-accent focus:ring-0 rounded-lg pl-9 pr-8 py-1.5 sm:py-2 text-typ-body-sm text-text-primary placeholder:text-text-muted outline-none transition-colors" 
              placeholder="Search name, folio, ticker, bank, owner..." 
              type="text"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Selector Dropdown */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-surface-layer1 border border-border-subtle hover:border-border-prominent rounded-lg px-2.5 py-1.5 sm:py-2 text-typ-footnote text-text-secondary hover:text-text-primary focus:outline-none focus:border-primary-accent transition-colors cursor-pointer"
            >
              <option value="value_desc">Valuation ↓</option>
              <option value="value_asc">Valuation ↑</option>
              <option value="gain_desc">Top Gainers %</option>
              <option value="loss_desc">Top Losers %</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="recent">Recently Added</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills (Scoped to active owner) */}
        <div 
          className="flex overflow-x-auto gap-1.5 pb-0.5 scrollbar-hide no-swipe"
          onTouchStart={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onMouseMove={e => e.stopPropagation()}
        >
          {filters.map(f => {
            const count = assetCounts[f] !== undefined ? assetCounts[f] : 0;
            const isSelected = f === filter;
            return (
              <button 
                key={f} 
                type="button"
                onClick={() => setFilter(f)} 
                className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 text-typ-label rounded-full transition-all active:scale-95 ${
                  isSelected 
                    ? 'bg-primary-accent text-white shadow-xs font-semibold' 
                    : 'bg-surface-layer1 hover:bg-surface-layer2 text-text-secondary hover:text-text-primary border border-border-subtle shadow-xs font-medium'
                }`}
              >
                <span>{f}</span>
                <span className={`text-typ-micro sm:text-typ-caption px-1.5 py-0.2 rounded-full tabular-nums ${
                  isSelected 
                    ? 'bg-white/20 text-white font-bold' 
                    : 'bg-surface-layer2 text-text-muted font-medium'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Filter Chips */}
        {(selectedOwner !== 'All Family' || filter !== 'All Assets' || searchQuery) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-typ-label">
            <span className="text-text-muted text-typ-footnote">Filtered:</span>
            {selectedOwner !== 'All Family' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-accent/15 border border-primary-accent/40 text-primary-accent text-typ-footnote font-medium">
                <span>Owner: {selectedOwner}</span>
                <button type="button" onClick={() => setSelectedOwner('All Family')} className="hover:text-text-primary transition-colors" title="Remove owner filter">
                  <X size={10} />
                </button>
              </span>
            )}
            {filter !== 'All Assets' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-accent/15 border border-primary-accent/40 text-primary-accent text-typ-footnote font-medium">
                <span>Cat: {filter}</span>
                <button type="button" onClick={() => setFilter('All Assets')} className="hover:text-text-primary transition-colors" title="Remove category filter">
                  <X size={10} />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-layer2 border border-border-subtle text-text-secondary text-typ-footnote">
                <span>"{searchQuery}"</span>
                <button type="button" onClick={() => setSearchQuery('')} className="hover:text-text-primary transition-colors" title="Clear query">
                  <X size={10} />
                </button>
              </span>
            )}
            <button 
              type="button"
              onClick={() => {
                setSelectedOwner('All Family');
                setFilter('All Assets');
                setSearchQuery('');
              }}
              className="text-typ-footnote text-text-muted hover:text-text-primary underline ml-1 transition-colors"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Asset List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-typ-footnote text-text-muted px-0.5">
          <span>
            {sortedAssets.length === 1 ? '1 holding' : `${sortedAssets.length} holdings`}
            {selectedOwner !== 'All Family' && ` • ${selectedOwner}`}
          </span>
          {sortBy !== 'value_desc' && (
            <span className="text-primary-accent font-medium text-typ-micro uppercase tracking-wider">
              Sorted by {sortBy.replace('_desc', '').replace('_asc', '')}
            </span>
          )}
        </div>

        {sortedAssets.length === 0 && (
          <div className="text-center py-10 bg-surface-layer1/40 border border-border-subtle/50 rounded-xl p-6">
            <p className="text-text-secondary text-typ-body-sm">
              No assets found matching the current filters.
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedOwner('All Family');
                  setFilter('All Assets');
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-typ-footnote font-semibold rounded-lg bg-surface-layer2 hover:bg-surface-layer1 text-text-primary border border-border-subtle transition-all active:scale-95"
              >
                <span>Reset Filters</span>
              </button>
              <button
                type="button"
                onClick={() => openAddModal(filter !== 'All Assets' ? filter : undefined)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-typ-footnote font-semibold rounded-lg bg-primary-accent/15 hover:bg-primary-accent/25 text-primary-accent border border-primary-accent/25 transition-all active:scale-95"
              >
                <Plus size={13} />
                <span>Add {filter !== 'All Assets' ? filter : 'Asset'}</span>
              </button>
            </div>
          </div>
        )}
        {sortedAssets.map((asset, i) => {
          let docCount = 0;
          let det = {};
          try {
            det = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
            const files = det['Files JSON'];
            if (Array.isArray(files)) docCount = files.length;
            else if (typeof files === 'string') docCount = JSON.parse(files).length;
          } catch (e) {}

          const cat = asset.Category;
          let holdingSummary = '';
          if (cat === 'Equity' && (det['Quantity'] || det['Units'])) {
            const q = det['Quantity'] || det['Units'];
            holdingSummary = `${q} shares` + (det['Average Buy Price'] ? ` @ avg ₹${det['Average Buy Price']}` : '');
          } else if (cat === 'Gold') {
            const ff = String(det['Form Factor'] || '');
            if (ff.includes('ETF') || ff.includes('SGB')) {
              holdingSummary = `${det['Units'] || det['Quantity'] || 0} units`;
            } else {
              holdingSummary = `${det['Weight (Grams)'] || 0}g` + (det['Purity'] ? ` (${det['Purity'].split(' ')[0]})` : '');
            }
          } else if (cat === 'Mutual Funds' && (det['Units'] || det['Quantity'])) {
            const u = det['Units'] || det['Quantity'];
            holdingSummary = `${u} units` + (det['Average NAV'] ? ` @ avg ₹${det['Average NAV']}` : '');
          } else if ((cat || '').toLowerCase().includes('retire') || (cat || '').toLowerCase().includes('provident')) {
            const rt = det['Retirement Type'] || det['Fund Type'] || 'Retirement';
            if (det['Interest Rate']) {
              holdingSummary = `${det['Interest Rate']}% p.a. • ${rt}`;
            } else if (det['Allocation Equity E']) {
              holdingSummary = `E:${det['Allocation Equity E']}% C:${det['Allocation Corp Debt C'] || 0}% • ${rt}`;
            } else {
              holdingSummary = rt;
            }
          } else if (isInsuranceAsset(asset)) {
            const polMetrics = calculatePolicyMetrics(asset);
            const coverStr = polMetrics.sumAssured > 0 
              ? `Cover: ₹${(polMetrics.sumAssured / 100000).toFixed(0)}L` 
              : (polMetrics.healthCover > 0 ? `Cover: ₹${(polMetrics.healthCover / 100000).toFixed(0)}L` : '');
            const dueStr = polMetrics.nextDueDate ? `Due: ${polMetrics.nextDueDate}` : '';
            holdingSummary = [polMetrics.policyType, coverStr, dueStr].filter(Boolean).join(' • ');
          } else if (cat === 'Cash/FD' || (cat || '').toLowerCase().includes('cash') || (cat || '').toLowerCase().includes('savings') || (cat || '').toLowerCase().includes('deposit')) {
            const subType = det['Sub-Type'] || (det['Interest Rate'] || det['Maturity Date'] ? 'Fixed Deposit' : 'Savings A/c');
            const parts = [subType];
            if (det['Interest Rate']) parts.push(`${det['Interest Rate']}% p.a.`);
            if (det['Maturity Date']) parts.push(`Matures: ${det['Maturity Date']}`);
            if (det['Auto-Sweep Linked']) parts.push('Auto-Sweep Active');
            if (det['Last Balance Sync Date']) parts.push(`Synced: ${det['Last Balance Sync Date']}`);
            holdingSummary = parts.filter(Boolean).join(' • ');
          }

          const isLive = asset['Is Live'] || (asset['Live Price'] && Number(asset['Live Price']) > 0);
          let effectiveCost = Number(asset.Cost || 0);
          if (cat === 'Equity' && det['Quantity'] && det['Average Buy Price']) {
            effectiveCost = Math.round(Number(det['Quantity']) * Number(det['Average Buy Price']) * 100) / 100;
          } else if (cat === 'Mutual Funds' && det['Units'] && det['Average NAV']) {
            effectiveCost = Math.round(Number(det['Units']) * Number(det['Average NAV']) * 100) / 100;
          }
          const currentVal = Number(asset['Current Value'] || 0);
          const pnl = asset['P&L'] !== undefined ? asset['P&L'] : (effectiveCost > 0 && currentVal > 0 ? Math.round((currentVal - effectiveCost) * 100) / 100 : undefined);
          const pnlPct = asset['P&L %'] !== undefined ? asset['P&L %'] : (pnl !== undefined && effectiveCost > 0 ? Math.round(((pnl / effectiveCost) * 100) * 100) / 100 : undefined);
          const polMetrics = isInsuranceAsset(asset) ? calculatePolicyMetrics(asset) : null;

          const perf = (asset['CAGR'] !== undefined && asset['CAGR'] !== null)
            ? { holdingStr: asset['Holding Period'], cagr: asset['CAGR'], taxTag: asset['Tax Tag'], taxLabel: asset['Tax Label'] }
            : calculatePerformance(effectiveCost, currentVal, asset['Acquisition Date'], asset.Category);

          const displayIdentifier = det['Folio Number'] || det['Folio'] || det['Account Number'] || det['Certificate Number'] || det['Policy Number'];

          const isFocused = String(focusedAssetId) === String(asset['Asset ID'] || asset.ID || asset.Name);

          return (
            <div 
              id={`asset-card-${asset['Asset ID'] || asset.ID || asset.Name || i}`}
              key={asset['Asset ID'] || i} 
              onClick={() => openEditModal(asset)}
              className={`bg-surface-layer1 border rounded-xl p-3 sm:p-4 shadow-sm cursor-pointer transition-all duration-500 relative ${
                isFocused 
                  ? 'border-primary-accent ring-2 ring-primary-accent/80 ring-offset-2 ring-offset-background-root shadow-[0_0_24px_rgba(99,102,241,0.35)] bg-primary-accent/[0.08] scale-[1.015]' 
                  : 'border-border-subtle hover:border-primary-accent/50'
              }`}
            >
              <div className="flex justify-between items-start gap-2.5 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-typ-body-sm font-semibold text-text-primary break-words line-clamp-2 leading-snug">{asset.Name}</p>
                    {isFocused && (
                      <span className="inline-flex items-center gap-1 text-typ-micro font-bold text-primary-accent bg-primary-accent/15 px-2 py-0.5 rounded-full border border-primary-accent/30 animate-pulse shrink-0">
                        <Sparkles size={11} /> Focused
                      </span>
                    )}
                    {isLive && (
                      <Badge variant="emerald" dot pulse size="xs">
                        Live
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-typ-label text-text-muted">{asset.Category}</span>
                    {displayIdentifier && (
                      <button
                        type="button"
                        onClick={(e) => handleCopy(displayIdentifier, `id-${asset['Asset ID'] || i}`, e)}
                        className="inline-flex items-center gap-1 text-typ-micro text-text-muted hover:text-text-primary bg-surface-layer2 px-1.5 py-0.2 rounded border border-border-subtle hover:border-border-prominent transition-colors shrink-0"
                        title={`Copy ${displayIdentifier}`}
                      >
                        {copiedId === `id-${asset['Asset ID'] || i}` ? <Check size={10} className="text-wealth-emerald" /> : <Copy size={10} />}
                        <span className="truncate max-w-[120px] font-mono">{displayIdentifier}</span>
                      </button>
                    )}
                    {det['ISIN'] && (
                      <span className="inline-flex items-center text-typ-micro text-text-muted bg-surface-layer2/80 px-1.5 py-0.2 rounded border border-border-subtle font-mono shrink-0" title={`ISIN: ${det['ISIN']}`}>
                        {det['ISIN']}
                      </span>
                    )}
                    {holdingSummary && (
                      <>
                        <span className="text-text-muted text-typ-caption">•</span>
                        <span className="text-typ-label text-text-secondary truncate max-w-[200px]">{holdingSummary}</span>
                      </>
                    )}
                    {perf?.holdingStr && perf.holdingStr !== 'Unknown' && (
                      <>
                        <span className="text-text-muted text-typ-caption">•</span>
                        <span className="text-typ-footnote text-text-muted">Held: {perf.holdingStr}</span>
                      </>
                    )}
                    {perf?.taxTag && perf.taxTag !== 'Unknown' && (
                      <span 
                        className={`text-typ-micro font-bold px-1.5 py-0.2 rounded border ${perf.taxTag === 'LTCG' ? 'bg-wealth-emerald/15 text-wealth-emerald border-wealth-emerald/30' : 'bg-bullion-amber/15 text-bullion-amber border-bullion-amber/30'}`}
                        title={perf.taxLabel}
                      >
                        {perf.taxTag}
                      </span>
                    )}
                    {docCount > 0 && (
                      <span className="flex items-center gap-1 text-typ-caption text-primary-accent bg-primary-accent/10 px-1.5 py-0.5 rounded border border-primary-accent/20 font-medium">
                        <Paperclip size={10} />
                        {docCount} {docCount === 1 ? 'doc' : 'docs'}
                      </span>
                    )}
                    {polMetrics?.isOverdue && (
                      <Badge variant="rose" size="xs">Grace Period Active</Badge>
                    )}
                    {polMetrics?.isDueSoon && (
                      <Badge variant="amber" size="xs">Due in {polMetrics.daysUntilDue}d</Badge>
                    )}
                    {cat === 'Cash/FD' && det['Last Balance Sync Date'] && (
                      <Badge variant="cyan" size="xs">SMS Synced</Badge>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetOwner = asset.Owner || 'Self';
                    setSelectedOwner(selectedOwner === targetOwner ? 'All Family' : targetOwner);
                  }}
                  className={`text-typ-caption px-2 py-0.5 rounded border transition-colors shrink-0 font-medium ${
                    selectedOwner === (asset.Owner || 'Self')
                      ? 'bg-primary-accent text-white border-primary-accent shadow-xs'
                      : 'bg-surface-layer2 hover:bg-surface-layer1 text-text-secondary hover:text-text-primary border-border-subtle'
                  }`}
                  title={`Filter by ${asset.Owner || 'Self'}`}
                >
                  {asset.Owner || 'Self'}
                </button>
              </div>

              <div className="flex justify-between items-end border-t border-border-subtle/40 pt-2 mt-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-typ-label text-text-secondary">Current Value</p>
                    {isLive && asset['Live Price'] && (
                      <span className="text-typ-caption text-text-muted">
                        (@ {formatCurrency(asset['Live Price'])}{cat === 'Gold' && !String(det['Form Factor'] || '').includes('ETF') && !String(det['Form Factor'] || '').includes('SGB') ? '/g' : ''})
                      </span>
                    )}
                  </div>
                  <p className={`text-typ-subtitle font-bold tabular-nums mt-0.5 ${asset.Category === 'Liabilities' ? 'text-liability-rose' : 'text-wealth-emerald'}`}>{formatCurrency(asset['Current Value'])}</p>
                </div>
                
                <div className="text-right">
                  {pnl !== undefined && effectiveCost > 0 ? (
                    <div>
                      <p className="text-typ-caption text-text-muted">Total Return</p>
                      <p className={`text-typ-label font-semibold tabular-nums ${pnl >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct}%)
                      </p>
                      {perf?.cagr !== undefined && perf?.cagr !== null && (
                        <p className="text-typ-caption font-medium text-primary-accent tabular-nums">
                          {perf.cagr >= 0 ? '+' : ''}{perf.cagr}% p.a.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-primary-accent/70 text-typ-label hover:text-primary-accent">Edit</div>
                  )}
                </div>
              </div>

              {polMetrics?.ppt > 0 && polMetrics?.isInvestment && (
                <div className="mt-2 pt-2 border-t border-border-subtle/30">
                  <div className="flex justify-between text-typ-caption text-text-muted mb-1">
                    <span>Premium Term ({polMetrics.paidYears} / {polMetrics.ppt} Yrs)</span>
                    <span className="font-semibold text-text-secondary">{polMetrics.pptProgressPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 w-full bg-surface-layer2 rounded-full overflow-hidden">
                    <div className="bg-primary-accent h-full rounded-full" style={{ width: `${polMetrics.pptProgressPct}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Add/Edit Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 no-swipe flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4" onClick={() => setShowAddModal(false)}>
           <div className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-lg md:max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
             {/* Pinned Modal Header */}
             <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-layer1 flex-shrink-0">
               <div>
                 <h3 className="text-typ-body sm:text-typ-subtitle font-bold text-text-primary leading-tight">
                   {editingAssetId ? 'Edit Asset' : 'Add New Asset'}
                 </h3>
                 <p className="text-typ-footnote text-text-muted mt-0.5">
                   {newAsset.Category || categoriesList[0] || 'Asset'} Details & Live Valuation
                 </p>
               </div>
               <button 
                 type="button" 
                 onClick={() => setShowAddModal(false)}
                 className="text-text-muted hover:text-text-primary p-1.5 hover:bg-surface-layer2 rounded-lg transition-colors"
                 title="Close"
               >
                 <X size={18} />
               </button>
             </div>
             
             {!editingAssetId && (
               <div className="px-5 pt-3 pb-2 border-b border-border-subtle/50 bg-surface-layer2/30 flex-shrink-0">
                 <label className="block text-typ-label text-text-secondary mb-1">Asset Category</label>
                 <select 
                   value={newAsset.Category || categoriesList[0] || ''} 
                   onChange={e => {
                     const newCat = e.target.value;
                     const isIns = (newCat || '').toLowerCase().includes('insur') || (newCat || '').toLowerCase().includes('lic');
                     setNewAsset(prev => ({
                       ...prev, 
                       Category: newCat,
                       'Details JSON': isIns ? {
                         ...(prev['Details JSON'] || {}),
                         'Policy Type': prev['Details JSON']?.['Policy Type'] || 'Endowment Plan (Savings + Life Cover)',
                         'Premium Frequency': prev['Details JSON']?.['Premium Frequency'] || 'Yearly',
                         'Grace Period Days': prev['Details JSON']?.['Grace Period Days'] || 30
                       } : prev['Details JSON']
                     }));
                   }} 
                   className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-1.5 text-text-primary text-typ-label focus:outline-none focus:border-primary-accent"
                 >
                   {categoriesList.map(cat => (
                     <option key={cat} value={cat}>{cat}</option>
                   ))}
                 </select>
               </div>
             )}

             <DynamicForm 
               category={newAsset.Category || categoriesList[0] || ''}
               formData={newAsset}
               setFormData={setNewAsset}
               profiles={profiles}
               onSubmit={handleSaveAsset}
               onCancel={() => setShowAddModal(false)}
               isSubmitting={isSubmitting}
               isEditing={!!editingAssetId}
               onDelete={handleDelete}
               attachedFiles={attachedFiles}
               setAttachedFiles={setAttachedFiles}
               uploadProgress={uploadProgress}
               marketQuotes={data?.marketQuotesMap || {}}
               formatCurrency={formatCurrency}
             />
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Assets */}
      {deleteConfirmAsset && (
        <div 
          className="fixed inset-0 z-[60] no-swipe flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" 
          onClick={() => !isSubmitting && setDeleteConfirmAsset(null)}
        >
          <div 
            className="bg-surface-layer1 border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-liability-rose/15 text-liability-rose">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-typ-body font-bold text-text-primary">Delete Asset</h3>
                <p className="text-typ-label text-text-muted">
                  {deleteConfirmAsset.hasDocuments ? 'Confirm document retention' : 'Permanent action'}
                </p>
              </div>
            </div>

            {deleteConfirmAsset.hasDocuments ? (
              <div className="bg-surface-layer2/60 border border-border-subtle rounded-xl p-3 text-typ-label leading-relaxed text-text-secondary space-y-2">
                <p>
                  <strong className="text-text-primary">"{deleteConfirmAsset.assetName}"</strong> has{' '}
                  <strong className="text-primary-accent">{deleteConfirmAsset.fileCount} supporting document(s)</strong> linked in <strong className="text-text-primary">Family Safe</strong>.
                </p>
                <p>
                  Do you also want to permanently delete the supporting documents from Family Safe and Google Drive?
                </p>
              </div>
            ) : (
              <p className="text-typ-body-sm text-text-secondary">
                Are you sure you want to delete <strong className="text-text-primary">"{deleteConfirmAsset.assetName}"</strong>? This will permanently remove the asset record.
              </p>
            )}

            <div className="space-y-2 pt-2">
              {deleteConfirmAsset.hasDocuments ? (
                <>
                  <button 
                    type="button" 
                    disabled={isSubmitting}
                    onClick={() => confirmDeleteAsset(deleteConfirmAsset.assetId, deleteConfirmAsset.safeDocId, true)}
                    className="w-full py-2.5 px-4 bg-liability-rose hover:bg-liability-rose/90 text-white rounded-lg text-typ-label font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>{isSubmitting ? (uploadProgress || 'Deleting...') : 'Delete Asset & Supporting Documents'}</span>
                  </button>

                  <button 
                    type="button" 
                    disabled={isSubmitting}
                    onClick={() => confirmDeleteAsset(deleteConfirmAsset.assetId, deleteConfirmAsset.safeDocId, false)}
                    className="w-full py-2.5 px-4 bg-surface-layer2 hover:bg-surface-layer1 border border-white/[0.08] hover:border-white/[0.14] text-text-primary rounded-lg text-typ-label font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Lock size={14} className="text-wealth-emerald" />
                    <span>{isSubmitting ? (uploadProgress || 'Deleting...') : 'Delete Asset Only (Keep in Family Safe)'}</span>
                  </button>
                </>
              ) : (
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => confirmDeleteAsset(deleteConfirmAsset.assetId, null, false)}
                  className="w-full py-2.5 px-4 bg-liability-rose hover:bg-liability-rose/90 text-white rounded-lg text-typ-label font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  <span>{isSubmitting ? (uploadProgress || 'Deleting...') : 'Delete Asset'}</span>
                </button>
              )}

              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => setDeleteConfirmAsset(null)}
                className="w-full py-2 px-4 text-text-muted hover:text-text-primary text-typ-label font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Tools & Actions Modal */}
      {showToolsModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm no-swipe animate-fadeIn"
          onClick={() => setShowToolsModal(false)}
        >
          <div 
            className="bg-surface-layer1 border border-border-subtle rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl p-4 sm:p-5 space-y-4"
            style={{ backgroundColor: 'var(--surface-layer1)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Grab handle on mobile */}
            <div className="w-12 h-1 rounded-full bg-border-prominent mx-auto mb-1 sm:hidden"></div>
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <h3 className="text-typ-headline font-bold text-text-primary">Portfolio Tools & Actions</h3>
                <div className="flex items-center gap-1.5 text-typ-footnote text-text-muted mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald animate-pulse"></span>
                  <span>Google Finance & AMFI Live Synced</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowToolsModal(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-surface-layer2 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Section 1: Rates & Statement Sync */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-1">Sync & Market Data</span>
              
              {/* Sync Live Rates */}
              <button
                type="button"
                onClick={() => {
                  setShowToolsModal(false);
                  showMessage('Syncing live market rates...');
                  handleSyncRates();
                }}
                disabled={isSyncingRates}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-layer2/70 hover:bg-surface-layer2 border border-border-subtle/80 hover:border-wealth-emerald/40 text-left transition-all active:scale-[0.99] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-wealth-emerald/15 border border-wealth-emerald/25 flex items-center justify-center text-wealth-emerald shrink-0 group-hover:scale-105 transition-transform">
                    <RefreshCw size={18} className={isSyncingRates ? 'animate-spin' : ''} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-typ-label font-bold text-text-primary group-hover:text-wealth-emerald transition-colors">Sync Market Rates</div>
                    <div className="text-[11px] text-text-muted truncate">Update latest AMFI NAVs & stock CMPs</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* Sync CAS Mutual Funds */}
              <button
                type="button"
                onClick={() => {
                  setShowToolsModal(false);
                  setTimeout(() => setShowCasModal(true), 50);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-layer2/70 hover:bg-surface-layer2 border border-border-subtle/80 hover:border-primary-accent/40 text-left transition-all active:scale-[0.99] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary-accent/15 border border-primary-accent/25 flex items-center justify-center text-primary-accent shrink-0 group-hover:scale-105 transition-transform">
                    <Cloud size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-typ-label font-bold text-text-primary group-hover:text-primary-accent transition-colors">Sync CAS Statement</div>
                    <div className="text-[11px] text-text-muted truncate">Import mutual funds from CAMS & KFintech PDF</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* Sync Bank Balances from SMS */}
              <button
                type="button"
                onClick={() => {
                  setShowToolsModal(false);
                  setTimeout(() => setShowSmsModal(true), 50);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-layer2/70 hover:bg-surface-layer2 border border-border-subtle/80 hover:border-wealth-emerald/40 text-left transition-all active:scale-[0.99] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-wealth-emerald/15 border border-wealth-emerald/25 flex items-center justify-center text-wealth-emerald shrink-0 group-hover:scale-105 transition-transform">
                    <Landmark size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-typ-label font-bold text-text-primary group-hover:text-wealth-emerald transition-colors">Sync Bank Balances (SMS)</div>
                    <div className="text-[11px] text-text-muted truncate">Extract latest savings account balances from SMS</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>

            {/* Section 2: AI & Advisory Hubs */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-1">Financial Intelligence & Hubs</span>
              
              {/* AI Rebalance */}
              {onOpenRebalancer && (
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsModal(false);
                    setTimeout(() => onOpenRebalancer(), 50);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-layer2/70 hover:bg-surface-layer2 border border-border-subtle/80 hover:border-purple-500/40 text-left transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
                      <Sparkles size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-typ-label font-bold text-text-primary group-hover:text-purple-400 transition-colors">AI Portfolio Rebalancer</div>
                      <div className="text-[11px] text-text-muted truncate">Asset drift analysis & target allocations</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              )}

              {/* Retirement Hub */}
              {onOpenRetirementPlanner && (
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsModal(false);
                    setTimeout(() => onOpenRetirementPlanner(), 50);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-layer2/70 hover:bg-surface-layer2 border border-border-subtle/80 hover:border-sky-500/40 text-left transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                      <Shield size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-typ-label font-bold text-text-primary group-hover:text-sky-400 transition-colors">Retirement & Pension Hub</div>
                      <div className="text-[11px] text-text-muted truncate">EPF, PPF, NPS & retirement runway projections</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              )}

              {/* Insurance Hub */}
              {onOpenInsuranceHub && (
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsModal(false);
                    setTimeout(() => onOpenInsuranceHub(), 50);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-layer2/70 hover:bg-surface-layer2 border border-border-subtle/80 hover:border-emerald-500/40 text-left transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                      <HeartPulse size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-typ-label font-bold text-text-primary group-hover:text-emerald-400 transition-colors">Insurance & Protection Hub</div>
                      <div className="text-[11px] text-text-muted truncate">LIC, term, health & coverage analytics</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Items List Modal */}
      {showActionItemsModal && (
        <div 
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowActionItemsModal(false)}
        >
          <div 
            className="bg-surface-layer1 border border-border-subtle rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface-layer1)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Grab handle on mobile */}
            <div className="w-12 h-1 rounded-full bg-border-prominent mx-auto mt-2 mb-1 sm:hidden"></div>

            {/* Modal Header */}
            <div className="p-4 border-b border-border-subtle flex items-center justify-between shrink-0 bg-surface-layer2/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-bullion-amber/15 text-bullion-amber flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-typ-subtitle font-bold text-text-primary">Actionable Portfolio Alerts</h3>
                  <p className="text-typ-micro text-text-muted">
                    {actionAlerts.length} holding{actionAlerts.length > 1 ? 's' : ''} requiring review or action
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowActionItemsModal(false)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-layer2 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Items List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 no-scrollbar">
              {actionAlerts.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-typ-body-sm">
                  No actionable alerts found for this owner selection.
                </div>
              ) : (
                actionAlerts.map((alert, idx) => {
                  const isDanger = alert.severity === 'danger';
                  return (
                    <div 
                      key={idx}
                      onClick={() => handleSelectActionAlert(alert, 'view')}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isDanger 
                          ? 'bg-liability-rose/5 border-liability-rose/30 hover:border-liability-rose/60 hover:bg-liability-rose/10' 
                          : 'bg-bullion-amber/5 border-bullion-amber/30 hover:border-bullion-amber/60 hover:bg-bullion-amber/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-typ-micro font-bold uppercase tracking-wider shrink-0 ${
                            isDanger 
                              ? 'bg-liability-rose/20 text-liability-rose' 
                              : 'bg-bullion-amber/20 text-bullion-amber'
                          }`}>
                            {alert.badge || 'Action'}
                          </span>
                          <span className="text-typ-label font-bold text-text-primary truncate">
                            {alert.asset?.Name}
                          </span>
                        </div>
                        {alert.asset?.['Current Value'] ? (
                          <span className="text-typ-caption font-semibold text-text-primary tabular-nums shrink-0">
                            {formatCurrency(alert.asset['Current Value'])}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-typ-caption text-text-secondary leading-snug mb-2.5">
                        {alert.desc}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle/50">
                        <div className="flex items-center gap-2 text-typ-micro text-text-muted truncate">
                          <span>{alert.asset?.Category}</span>
                          {alert.asset?.Owner && (
                            <>
                              <span>•</span>
                              <span>Owner: {alert.asset.Owner}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                          {isInsuranceAsset(alert.asset) && onOpenInsuranceHub && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowActionItemsModal(false);
                                onOpenInsuranceHub();
                              }}
                              className="px-2.5 py-1 rounded-lg text-typ-micro font-medium text-primary-accent hover:bg-primary-accent/10 transition-colors"
                            >
                              Insurance Hub
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelectActionAlert(alert, 'view')}
                            className="px-2.5 py-1 rounded-lg bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle text-typ-micro font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 shadow-xs"
                            title="Scroll to asset in list"
                          >
                            <Eye size={12} className="text-primary-accent" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectActionAlert(alert, 'edit')}
                            className="px-2.5 py-1 rounded-lg bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle text-typ-micro font-medium text-text-primary transition-colors flex items-center gap-1 shadow-xs"
                          >
                            <span>Edit</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer with Reminders Bridge */}
            {onOpenNotifications && (
              <div className="p-3 bg-surface-layer2/40 border-t border-border-subtle flex items-center justify-between shrink-0">
                <span className="text-typ-micro text-text-muted">
                  Looking for all scheduled reminders?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionItemsModal(false);
                    onOpenNotifications();
                  }}
                  className="text-typ-caption text-primary-accent hover:underline font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Bell size={13} />
                  <span>Open Reminders Drawer</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CAS Portfolio Sync Modal */}
      <CasSyncModal
        isOpen={showCasModal}
        onClose={() => setShowCasModal(false)}
        data={data}
        formatCurrency={formatCurrency}
        showMessage={showMessage}
        onRefresh={onRefresh}
      />

      {/* SMS Bank Balance Sync Modal */}
      <SmsInboxModal
        isOpen={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        data={data}
        formatCurrency={formatCurrency}
        showMessage={showMessage}
        onRefresh={onRefresh}
      />
    </div>
  );
}
