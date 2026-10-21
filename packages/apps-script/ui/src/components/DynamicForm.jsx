import React, { useState, useEffect, useRef } from 'react';
import { assetSchemas } from '../config/assetSchemas';
import { Upload, Paperclip, FileText, Trash2, ExternalLink, Link as LinkIcon, Lock, Search, TrendingUp, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

// Stock ticker aliases for Indian equities and ETFs
export const STOCK_ALIASES = {
  'RIL': 'NSE:RELIANCE',
  'RELIANCE': 'NSE:RELIANCE',
  'TCS': 'NSE:TCS',
  'INFY': 'NSE:INFY',
  'INFOSYS': 'NSE:INFY',
  'HDFC': 'NSE:HDFCBANK',
  'HDFCBANK': 'NSE:HDFCBANK',
  'ICICI': 'NSE:ICICIBANK',
  'ICICIBANK': 'NSE:ICICIBANK',
  'SBI': 'NSE:SBIN',
  'SBIN': 'NSE:SBIN',
  'STATE BANK': 'NSE:SBIN',
  'BHARTI': 'NSE:BHARTIARTL',
  'AIRTEL': 'NSE:BHARTIARTL',
  'BHARTIARTL': 'NSE:BHARTIARTL',
  'ITC': 'NSE:ITC',
  'LT': 'NSE:LT',
  'L&T': 'NSE:LT',
  'LARSEN': 'NSE:LT',
  'KOTAK': 'NSE:KOTAKBANK',
  'KOTAKBANK': 'NSE:KOTAKBANK',
  'AXIS': 'NSE:AXISBANK',
  'AXISBANK': 'NSE:AXISBANK',
  'MARUTI': 'NSE:MARUTI',
  'TATAMOTORS': 'NSE:TATAMOTORS',
  'TATA MOTORS': 'NSE:TATAMOTORS',
  'TATASTEEL': 'NSE:TATASTEEL',
  'TATA STEEL': 'NSE:TATASTEEL',
  'TITAN': 'NSE:TITAN',
  'WIPRO': 'NSE:WIPRO',
  'ASIANPAINT': 'NSE:ASIANPAINT',
  'ASIAN PAINTS': 'NSE:ASIANPAINT',
  'BAJAJFINANCE': 'NSE:BAJFINANCE',
  'BAJFINANCE': 'NSE:BAJFINANCE',
  'BAJAJ FINANCE': 'NSE:BAJFINANCE',
  'BAJAJFINSV': 'NSE:BAJFINSV',
  'HCLTECH': 'NSE:HCLTECH',
  'HCL': 'NSE:HCLTECH',
  'SUNPHARMA': 'NSE:SUNPHARMA',
  'SUN PHARMA': 'NSE:SUNPHARMA',
  'NTPC': 'NSE:NTPC',
  'ONGC': 'NSE:ONGC',
  'POWERGRID': 'NSE:POWERGRID',
  'ADANIENT': 'NSE:ADANIENT',
  'ADANI': 'NSE:ADANIENT',
  'ADANIPORTS': 'NSE:ADANIPORTS',
  'COALINDIA': 'NSE:COALINDIA',
  'ZOMATO': 'NSE:ZOMATO',
  'SWIGGY': 'NSE:SWIGGY',
  'PAYTM': 'NSE:PAYTM',
  'JIOFIN': 'NSE:JIOFIN',
  'JIO': 'NSE:JIOFIN',
  'GOLDBEES': 'NSE:GOLDBEES',
  'SILVERBEES': 'NSE:SILVERBEES',
  'NIFTYBEES': 'NSE:NIFTYBEES'
};

export function normalizeStockSymbol(sym) {
  if (!sym) return '';
  const s = String(sym).trim().toUpperCase();
  if (STOCK_ALIASES[s]) return STOCK_ALIASES[s];
  
  if (s.indexOf(':') !== -1) {
    const parts = s.split(':');
    const tkr = parts[1];
    if (STOCK_ALIASES[tkr]) return STOCK_ALIASES[tkr];
    return s;
  }
  
  if (/^\d{6}$/.test(s)) {
    return 'BOM:' + s;
  }
  
  return 'NSE:' + s;
}

// Utility to get nested object value (e.g., 'Details JSON.Interest Rate')
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Utility to set nested object value returning a new object
const setNestedValue = (obj, path, value) => {
  const parts = path.split('.');
  const newObj = { ...obj };
  let current = newObj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current[parts[i]] = { ...current[parts[i]] };
    current = current[parts[i]];
  }
  
  if (value === '' || value === undefined) {
      delete current[parts[parts.length - 1]];
  } else {
      current[parts[parts.length - 1]] = value;
  }
  
  return newObj;
};

export default function DynamicForm({ 
  category, 
  formData, 
  setFormData, 
  profiles, 
  onSubmit, 
  onCancel, 
  isSubmitting, 
  isEditing, 
  onDelete,
  attachedFiles = [],
  setAttachedFiles,
  uploadProgress = '',
  marketQuotes = {},
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`
}) {
  const [linkInput, setLinkInput] = useState('');

  // Stock live quote state
  const [liveStockQuote, setLiveStockQuote] = useState(null);
  const [isFetchingStock, setIsFetchingStock] = useState(false);
  const [stockFetchError, setStockFetchError] = useState(null);
  const stockSearchTimeoutRef = useRef(null);
  
  // Mutual Fund live search state
  const [mfSearchQuery, setMfSearchQuery] = useState('');
  const [mfSearchResults, setMfSearchResults] = useState([]);
  const [isSearchingMf, setIsSearchingMf] = useState(false);
  const [showMfDropdown, setShowMfDropdown] = useState(false);
  const [liveNavData, setLiveNavData] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Determine schema key
  let schemaKey = 'default';
  const catLower = (category || '').toLowerCase();
  
  if (catLower.includes('fd') || catLower.includes('fixed') || catLower.includes('cash')) schemaKey = 'Cash/FD';
  else if (catLower.includes('equity') || catLower.includes('stock')) schemaKey = 'Equity';
  else if (catLower.includes('mutual')) schemaKey = 'Mutual Funds';
  else if (catLower.includes('real estate') || catLower.includes('property')) schemaKey = 'Real Estate';
  else if (catLower.includes('gold') || catLower.includes('bullion')) schemaKey = 'Gold';
  else if (catLower.includes('provident') || catLower.includes('epf') || catLower.includes('ppf') || catLower.includes('nps')) schemaKey = 'Provident Funds';
  else if (catLower.includes('bond') || catLower.includes('debenture')) schemaKey = 'Bonds';
  else if (catLower.includes('liabilit') || catLower.includes('loan')) schemaKey = 'Liabilities';
  
  const schema = assetSchemas[schemaKey] || assetSchemas['default'];

  // Gold rates from marketQuotes or realistic default
  const gold24kRate = marketQuotes['GOLD_24K_INR']?.price || 7850;
  const gold22kRate = marketQuotes['GOLD_22K_INR']?.price || Math.round(gold24kRate * (22 / 24));
  const gold18kRate = marketQuotes['GOLD_18K_INR']?.price || Math.round(gold24kRate * (18 / 24));

  // On-demand Live Stock Quote Fetching
  useEffect(() => {
    if (schemaKey !== 'Equity' && schemaKey !== 'Gold') {
      setLiveStockQuote(null);
      return;
    }

    const rawTicker = formData['Details JSON']?.['Ticker Symbol'];
    if (!rawTicker || String(rawTicker).trim().length < 2) {
      setLiveStockQuote(null);
      setStockFetchError(null);
      return;
    }

    const cleanTicker = normalizeStockSymbol(rawTicker);
    if (!cleanTicker) return;

    // Check if quote is already seeded in marketQuotes
    const existingQuote = marketQuotes[cleanTicker.toUpperCase()];
    if (existingQuote && existingQuote.price > 0) {
      setLiveStockQuote(existingQuote);
      setStockFetchError(null);
      const qty = Number(formData['Details JSON']?.['Quantity'] || formData['Details JSON']?.['Units'] || 0);
      if (qty > 0 && formData['Details JSON']?.['Live Tracking'] !== false && (!formData['Current Value'] || formData['Current Value'] === 0)) {
        setFormData(prev => ({
          ...prev,
          'Current Value': Math.round(qty * existingQuote.price * 100) / 100
        }));
      }
      return;
    }

    // Fetch on-demand via Google Apps Script (which queries Yahoo Finance)
    if (stockSearchTimeoutRef.current) clearTimeout(stockSearchTimeoutRef.current);
    stockSearchTimeoutRef.current = setTimeout(() => {
      if (window.google?.script?.run?.fetchLiveStockQuote) {
        setIsFetchingStock(true);
        setStockFetchError(null);
        window.google.script.run
          .withSuccessHandler((res) => {
            setIsFetchingStock(false);
            if (res && res.price > 0) {
              setLiveStockQuote(res);
              setStockFetchError(null);
              setFormData(prev => {
                const qty = Number(prev['Details JSON']?.['Quantity'] || prev['Details JSON']?.['Units'] || 0);
                if (qty > 0 && prev['Details JSON']?.['Live Tracking'] !== false) {
                  return {
                    ...prev,
                    'Current Value': Math.round(qty * res.price * 100) / 100
                  };
                }
                return prev;
              });
            } else {
              setStockFetchError(`Could not find live quote for "${cleanTicker}"`);
            }
          })
          .withFailureHandler((err) => {
            setIsFetchingStock(false);
            setStockFetchError(`Error fetching quote: ${err?.message || err}`);
          })
          .fetchLiveStockQuote(cleanTicker);
      }
    }, 450);

    return () => {
      if (stockSearchTimeoutRef.current) clearTimeout(stockSearchTimeoutRef.current);
    };
  }, [formData['Details JSON']?.['Ticker Symbol'], schemaKey, marketQuotes]);

  const handleChange = (name, value) => {
    let updated = setNestedValue(formData, name, value);

    // Auto-defaults for Gold Form Factor
    if (name === 'Details JSON.Form Factor') {
      if (value === 'Physical Jewelry') {
        updated = setNestedValue(updated, 'Details JSON.Purity', '22K (91.6% - Standard Jewelry)');
      } else if (value === 'Gold Coins/Bars' || value === 'Digital Gold') {
        updated = setNestedValue(updated, 'Details JSON.Purity', '24K (99.9% - Bullion / Coins / Bars / Digital)');
      }
    }

    // Auto-calculate for Equity
    if (schemaKey === 'Equity') {
      const isLiveTracking = updated['Details JSON']?.['Live Tracking'] !== false;
      const qty = Number(updated['Details JSON']?.['Quantity'] || updated['Details JSON']?.['Units'] || 0);
      const avgPrice = Number(updated['Details JSON']?.['Average Buy Price'] || 0);
      const cost = Number(updated.Cost || 0);
      
      // Auto-compute between Cost, Quantity, and Average Buy Price
      if (name === 'Details JSON.Quantity' || name === 'Details JSON.Units') {
        if (name === 'Details JSON.Units') {
          updated = setNestedValue(updated, 'Details JSON.Quantity', value);
        }
        if (qty > 0 && avgPrice > 0 && (!cost || cost === 0 || cost === Math.round(qty * avgPrice * 100) / 100)) {
          updated.Cost = Math.round(qty * avgPrice * 100) / 100;
        } else if (qty > 0 && cost > 0 && (!avgPrice || avgPrice === 0)) {
          updated = setNestedValue(updated, 'Details JSON.Average Buy Price', Math.round((cost / qty) * 100) / 100);
        }
      } else if (name === 'Details JSON.Average Buy Price') {
        if (qty > 0 && avgPrice > 0 && (!cost || cost === 0)) {
          updated.Cost = Math.round(qty * avgPrice * 100) / 100;
        }
      } else if (name === 'Cost') {
        if (cost > 0 && qty > 0 && (!avgPrice || avgPrice === 0)) {
          updated = setNestedValue(updated, 'Details JSON.Average Buy Price', Math.round((cost / qty) * 100) / 100);
        }
      }

      // Auto-compute Current Value from live ticker if available
      if (isLiveTracking && qty > 0) {
        const rawTicker = updated['Details JSON']?.['Ticker Symbol'] || '';
        const cleanTicker = normalizeStockSymbol(rawTicker);
        const quote = (cleanTicker && marketQuotes[cleanTicker]) || (liveStockQuote?.symbol === cleanTicker ? liveStockQuote : null);
        if (quote && quote.price > 0) {
          updated['Current Value'] = Math.round(qty * quote.price * 100) / 100;
        }
      }
    }

    // Auto-calculate for Gold
    if (schemaKey === 'Gold') {
      const isLiveTracking = updated['Details JSON']?.['Live Tracking'] !== false;
      const ff = String(updated['Details JSON']?.['Form Factor'] || '');
      
      if (isLiveTracking) {
        if (ff.includes('ETF') || ff.includes('SGB')) {
          const rawTicker = updated['Details JSON']?.['Ticker Symbol'] || '';
          const cleanTicker = normalizeStockSymbol(rawTicker);
          const quote = (cleanTicker && marketQuotes[cleanTicker]) || (liveStockQuote?.symbol === cleanTicker ? liveStockQuote : null);
          const units = Number(updated['Details JSON']?.['Units'] || updated['Details JSON']?.['Quantity'] || 0);
          if (quote && quote.price > 0 && units > 0) {
            updated['Current Value'] = Math.round(units * quote.price * 100) / 100;
          }
        } else {
          const purity = String(updated['Details JSON']?.['Purity'] || (ff.includes('Jewelry') ? '22K' : '24K'));
          const rate = purity.includes('22K') ? gold22kRate : (purity.includes('18K') ? gold18kRate : gold24kRate);
          const weight = Number(updated['Details JSON']?.['Weight (Grams)'] || 0);
          if (weight > 0 && rate > 0) {
            updated['Current Value'] = Math.round(weight * rate * 100) / 100;
          }
        }
      }
    }

    // Auto-calculate for Mutual Funds
    if (schemaKey === 'Mutual Funds') {
      const isLiveTracking = updated['Details JSON']?.['Live Tracking'] !== false;
      const units = Number(updated['Details JSON']?.['Units'] || updated['Details JSON']?.['Quantity'] || 0);
      const avgNav = Number(updated['Details JSON']?.['Average NAV'] || 0);
      const cost = Number(updated.Cost || 0);
      
      if (name === 'Details JSON.Units' || name === 'Details JSON.Quantity') {
        if (units > 0 && avgNav > 0 && (!cost || cost === 0 || cost === Math.round(units * avgNav * 100) / 100)) {
          updated.Cost = Math.round(units * avgNav * 100) / 100;
        } else if (units > 0 && cost > 0 && (!avgNav || avgNav === 0)) {
          updated = setNestedValue(updated, 'Details JSON.Average NAV', Math.round((cost / units) * 10000) / 10000);
        }
      } else if (name === 'Details JSON.Average NAV') {
        if (units > 0 && avgNav > 0 && (!cost || cost === 0)) {
          updated.Cost = Math.round(units * avgNav * 100) / 100;
        }
      } else if (name === 'Cost') {
        if (cost > 0 && units > 0 && (!avgNav || avgNav === 0)) {
          updated = setNestedValue(updated, 'Details JSON.Average NAV', Math.round((cost / units) * 10000) / 10000);
        }
      }

      if (isLiveTracking && units > 0) {
        const sc = updated['Details JSON']?.['Scheme Code'];
        const quote = sc ? marketQuotes[String(sc).trim().toUpperCase()] : null;
        const navToUse = liveNavData?.nav || quote?.price;
        if (navToUse && navToUse > 0) {
          updated['Current Value'] = Math.round(units * navToUse * 100) / 100;
        }
      }
    }

    setFormData(updated);
  };

  // AMFI Mutual Fund Live Search
  useEffect(() => {
    if (schemaKey !== 'Mutual Funds') return;
    if (!mfSearchQuery || mfSearchQuery.length < 3) {
      setMfSearchResults([]);
      setIsSearchingMf(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingMf(true);
      try {
        const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(mfSearchQuery)}`);
        if (res.ok) {
          const list = await res.json();
          setMfSearchResults((list || []).slice(0, 10));
          setShowMfDropdown(true);
        }
      } catch (e) {
        console.warn('MF Search error:', e);
      } finally {
        setIsSearchingMf(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [mfSearchQuery, schemaKey]);

  // Fetch NAV when Scheme Code is entered or selected
  const handleSelectMfScheme = async (scheme) => {
    let updated = setNestedValue(formData, 'Name', scheme.schemeName);
    updated = setNestedValue(updated, 'Details JSON.Scheme Code', String(scheme.schemeCode));
    setShowMfDropdown(false);
    setMfSearchQuery('');
    
    // Fetch live NAV
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${scheme.schemeCode}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const nav = parseFloat(json.data[0].nav);
          setLiveNavData({
            nav: nav,
            date: json.data[0].date,
            schemeName: json.meta?.scheme_name || scheme.schemeName,
            fundHouse: json.meta?.fund_house || ''
          });
          if (json.meta?.fund_house) {
            updated = setNestedValue(updated, 'Institution/Location', json.meta.fund_house);
          }
          const units = Number(updated['Details JSON']?.['Units'] || 0);
          if (units > 0 && nav > 0) {
            updated['Current Value'] = Math.round(units * nav * 100) / 100;
          }
        }
      }
    } catch (e) {
      console.warn('NAV fetch error:', e);
    }
    setFormData(updated);
  };

  const handleFileSelect = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (setAttachedFiles) {
          setAttachedFiles(prev => [...prev, {
            id: 'new_' + Math.random().toString(36).substring(2, 9),
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64: ev.target.result,
            isNewUpload: true
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeFile = (id) => {
    if (setAttachedFiles) {
      setAttachedFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) return;
    if (setAttachedFiles) {
      setAttachedFiles(prev => [...prev, {
        id: 'link_' + Math.random().toString(36).substring(2, 9),
        name: linkInput.trim().substring(0, 30) + '...',
        url: linkInput.trim(),
        isLink: true
      }]);
    }
    setLinkInput('');
  };

  // Helper info for Equity
  const rawEquityTicker = formData['Details JSON']?.['Ticker Symbol'] || '';
  const cleanEquityTicker = normalizeStockSymbol(rawEquityTicker);
  const currentEquityQuote = (cleanEquityTicker && marketQuotes[cleanEquityTicker]) || (liveStockQuote?.symbol === cleanEquityTicker ? liveStockQuote : null);
  const equityQty = Number(formData['Details JSON']?.['Quantity'] || formData['Details JSON']?.['Units'] || 0);
  const equityCost = Number(formData.Cost || 0);
  const calculatedEquityVal = equityQty > 0 && currentEquityQuote?.price ? Math.round(equityQty * currentEquityQuote.price * 100) / 100 : null;
  const equityPnl = (calculatedEquityVal && equityCost > 0) ? Math.round((calculatedEquityVal - equityCost) * 100) / 100 : null;
  const equityPnlPct = (equityPnl !== null && equityCost > 0) ? Math.round(((equityPnl / equityCost) * 100) * 100) / 100 : null;

  // Helper info for Gold
  const goldFormFactor = formData['Details JSON']?.['Form Factor'] || '';
  const goldPurity = formData['Details JSON']?.['Purity'] || (goldFormFactor.includes('Jewelry') ? '22K' : '24K');
  const activeGoldRate = goldPurity.includes('22K') ? gold22kRate : (goldPurity.includes('18K') ? gold18kRate : gold24kRate);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    let updated = { ...formData };
    if (schemaKey === 'Equity') {
      const rawTicker = updated['Details JSON']?.['Ticker Symbol'];
      if (rawTicker) {
        const norm = normalizeStockSymbol(rawTicker);
        updated = setNestedValue(updated, 'Details JSON.Ticker Symbol', norm);
        const qty = Number(updated['Details JSON']?.['Quantity'] || updated['Details JSON']?.['Units'] || 0);
        const quote = (norm && marketQuotes[norm]) || (liveStockQuote?.symbol === norm ? liveStockQuote : null);
        if (qty > 0 && quote?.price > 0 && updated['Details JSON']?.['Live Tracking'] !== false) {
          updated['Current Value'] = Math.round(qty * quote.price * 100) / 100;
        }
      }
      setFormData(updated);
    }
    onSubmit(e);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      {/* Live Market Integration Banners */}
      {schemaKey === 'Gold' && (
        <div className="bg-gradient-to-r from-bullion-amber/15 via-surface-layer2 to-surface-layer2 border border-bullion-amber/30 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-bullion-amber flex items-center gap-1.5">
              <Sparkles size={14} /> Live Gold Spot Rates (Google Finance)
            </span>
            <span className="text-[10px] text-text-muted">CURRENCY:XAUINR</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            <div className={`p-1.5 rounded-lg border ${goldPurity.includes('24K') ? 'bg-bullion-amber/20 border-bullion-amber text-white font-bold' : 'bg-surface-layer1 border-border-subtle text-text-secondary'}`}>
              <p className="text-[10px]">24K (99.9%)</p>
              <p className="text-xs font-semibold tabular-nums text-bullion-amber">{formatCurrency(gold24kRate)}/g</p>
            </div>
            <div className={`p-1.5 rounded-lg border ${goldPurity.includes('22K') ? 'bg-bullion-amber/20 border-bullion-amber text-white font-bold' : 'bg-surface-layer1 border-border-subtle text-text-secondary'}`}>
              <p className="text-[10px]">22K (91.6%)</p>
              <p className="text-xs font-semibold tabular-nums text-bullion-amber">{formatCurrency(gold22kRate)}/g</p>
            </div>
            <div className={`p-1.5 rounded-lg border ${goldPurity.includes('18K') ? 'bg-bullion-amber/20 border-bullion-amber text-white font-bold' : 'bg-surface-layer1 border-border-subtle text-text-secondary'}`}>
              <p className="text-[10px]">18K (75%)</p>
              <p className="text-xs font-semibold tabular-nums text-bullion-amber">{formatCurrency(gold18kRate)}/g</p>
            </div>
          </div>
        </div>
      )}

      {schemaKey === 'Equity' && (
        <>
          {isFetchingStock && (
            <div className="bg-surface-layer2 border border-primary-accent/30 rounded-xl p-3 text-xs flex items-center gap-2 text-primary-accent animate-pulse">
              <RefreshCw size={13} className="animate-spin text-primary-accent flex-shrink-0" />
              <span>Fetching live market price for {cleanEquityTicker || 'ticker'}...</span>
            </div>
          )}

          {currentEquityQuote && currentEquityQuote.price > 0 && (
            <div className="bg-gradient-to-r from-primary-accent/15 via-surface-layer2 to-surface-layer2 border border-primary-accent/30 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-wealth-emerald animate-pulse"></span>
                  <div>
                    <p className="font-semibold text-white flex items-center gap-1.5">
                      {currentEquityQuote.shortName || cleanEquityTicker}
                      {cleanEquityTicker !== String(rawEquityTicker).toUpperCase() && (
                        <span className="text-[10px] text-primary-accent bg-primary-accent/20 px-1.5 py-0.2 rounded font-mono">
                          {cleanEquityTicker}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-text-muted">Live Market Quote</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-wealth-emerald tabular-nums">
                    {formatCurrency(currentEquityQuote.price)}
                  </p>
                  {currentEquityQuote.changePct !== undefined && currentEquityQuote.changePct !== 0 && (
                    <p className={`text-[10px] font-medium tabular-nums ${currentEquityQuote.changePct > 0 ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
                      {currentEquityQuote.changePct > 0 ? '+' : ''}{currentEquityQuote.changePct}% today
                    </p>
                  )}
                </div>
              </div>

              {calculatedEquityVal !== null && (
                <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary">
                    Market Value ({equityQty} shares × {formatCurrency(currentEquityQuote.price)}):
                  </span>
                  <span className="font-bold text-wealth-emerald tabular-nums">
                    {formatCurrency(calculatedEquityVal)}
                  </span>
                </div>
              )}

              {equityPnl !== null && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary">Unrealized P&L:</span>
                  <span className={`font-semibold tabular-nums ${equityPnl >= 0 ? 'text-wealth-emerald' : 'text-liability-rose'}`}>
                    {equityPnl >= 0 ? '+' : ''}{formatCurrency(equityPnl)} ({equityPnlPct >= 0 ? '+' : ''}{equityPnlPct}%)
                  </span>
                </div>
              )}
            </div>
          )}

          {stockFetchError && !currentEquityQuote && (
            <div className="bg-liability-rose/10 border border-liability-rose/30 rounded-xl p-2.5 text-xs flex items-center gap-2 text-liability-rose">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{stockFetchError}</span>
            </div>
          )}
        </>
      )}

      {/* Mutual Fund Instant AMFI Search Helper */}
      {schemaKey === 'Mutual Funds' && (
        <div className="relative">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Search AMFI Mutual Funds (Instant Name & NAV)
          </label>
          <div className="relative">
            <input 
              type="text"
              value={mfSearchQuery}
              onChange={(e) => setMfSearchQuery(e.target.value)}
              placeholder="Type scheme name (e.g. Parag Parikh, Axis, SBI Bluechip)..."
              className="w-full bg-surface-layer2 border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-white text-xs focus:outline-none focus:border-primary-accent"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
            {isSearchingMf && (
              <RefreshCw size={12} className="absolute right-2.5 top-2.5 text-primary-accent animate-spin" />
            )}
          </div>

          {/* Search Dropdown */}
          {showMfDropdown && mfSearchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto bg-surface-layer1 border border-border-prominent rounded-xl shadow-2xl p-1 space-y-1">
              {mfSearchResults.map((scheme) => (
                <div 
                  key={scheme.schemeCode}
                  onClick={() => handleSelectMfScheme(scheme)}
                  className="p-2 hover:bg-surface-layer2 rounded-lg cursor-pointer transition-colors"
                >
                  <p className="text-xs font-medium text-white">{scheme.schemeName}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">Code: {scheme.schemeCode}</p>
                </div>
              ))}
            </div>
          )}

          {liveNavData && (
            <div className="mt-2 bg-wealth-emerald/10 border border-wealth-emerald/30 rounded-lg p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-wealth-emerald animate-pulse"></span>
                <span className="text-text-secondary">Official AMFI NAV ({liveNavData.date}):</span>
              </div>
              <span className="font-bold text-wealth-emerald tabular-nums">{formatCurrency(liveNavData.nav)}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto px-1 pb-2 scrollbar-hide">
        {schema.fields.map(field => {
          if (field.condition && !field.condition(formData)) return null;
          
          const value = getNestedValue(formData, field.name) ?? '';
          
          if (field.type === 'checkbox') {
            return (
              <div key={field.name} className="flex items-center gap-2 mt-2 md:col-span-2 bg-surface-layer2/40 p-2.5 rounded-lg border border-border-subtle">
                <input 
                  type="checkbox" 
                  checked={!!value} 
                  onChange={e => handleChange(field.name, e.target.checked)} 
                  className="rounded bg-surface-layer2 border-border-subtle text-primary-accent focus:ring-0" 
                  id={field.name}
                />
                <label htmlFor={field.name} className="text-xs font-medium text-text-primary cursor-pointer">{field.label}</label>
              </div>
            );
          }

          if (field.type === 'select') {
             return (
               <div key={field.name} className="md:col-span-2">
                 <label className="block text-xs text-text-secondary mb-1">{field.label}</label>
                 <select 
                   value={value} 
                   onChange={e => handleChange(field.name, e.target.value)} 
                   required={field.required}
                   className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent"
                 >
                   <option value="">Select...</option>
                   {field.options.map(opt => (
                     <option key={opt} value={opt}>{opt}</option>
                   ))}
                 </select>
               </div>
             );
          }

          if (field.name === 'Owner' && profiles && profiles.length > 0) {
            return (
              <div key={field.name} className="md:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">{field.label}</label>
                <select 
                  value={value} 
                  onChange={e => handleChange(field.name, e.target.value)} 
                  required={field.required}
                  className="w-full bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent"
                >
                  <option value="">Self</option>
                  <option value="Joint">Joint</option>
                  {profiles.map(p => (
                    <option key={p.Name} value={p.Name}>{p.Name}</option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={field.name} className={field.name === 'Name' || field.name === 'Current Value' ? "md:col-span-2" : ""}>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-text-secondary">{field.label} {field.required && <span className="text-liability-rose">*</span>}</label>
                {field.name === 'Current Value' && (
                  <span className="text-[10px] text-primary-accent font-medium flex items-center gap-1">
                    <Sparkles size={11} /> Auto-updates with live rates
                  </span>
                )}
              </div>
              <input 
                required={field.required} 
                value={value} 
                onChange={e => handleChange(field.name, e.target.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} 
                type={field.type} 
                step={field.step}
                className={`w-full bg-surface-layer2 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-accent ${field.name === 'Current Value' ? 'border-primary-accent/40 font-bold tabular-nums text-wealth-emerald' : 'border-border-subtle'}`} 
                placeholder={field.placeholder} 
              />
              {field.name === 'Details JSON.Ticker Symbol' && cleanEquityTicker && (
                <div className="mt-1 flex items-center justify-between text-[11px] px-1">
                  {cleanEquityTicker !== String(value || '').toUpperCase() ? (
                    <span className="text-primary-accent font-medium flex items-center gap-1">
                      <span>Mapped:</span>
                      <span className="font-mono bg-primary-accent/15 px-1 rounded">{cleanEquityTicker}</span>
                    </span>
                  ) : (
                    <span className="text-text-muted font-mono">{cleanEquityTicker}</span>
                  )}
                  {currentEquityQuote?.price > 0 && (
                    <span className="text-wealth-emerald font-semibold tabular-nums">
                      CMP: {formatCurrency(currentEquityQuote.price)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Supporting Documents Section */}
        <div className="md:col-span-2 border-t border-border-subtle pt-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Paperclip size={14} className="text-primary-accent" />
                Supporting Documents
              </label>
              <p className="text-[11px] text-text-muted mt-0.5">
                Attach FD certificates, gold purchase receipts, demat statements. Synced to Family Safe.
              </p>
            </div>
            {attachedFiles.length > 0 && (
              <span className="text-[10px] text-primary-accent bg-primary-accent/15 px-2 py-0.5 rounded-full font-semibold border border-primary-accent/20">
                {attachedFiles.length} {attachedFiles.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>

          {/* Attached Files List */}
          {attachedFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              {attachedFiles.map(f => (
                <div 
                  key={f.id} 
                  className="flex justify-between items-center bg-surface-layer2 p-2.5 rounded-xl border border-border-subtle hover:border-border-prominent transition-colors"
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden flex-1 mr-2">
                    {f.isLink ? (
                      <LinkIcon size={15} className="text-blue-400 flex-shrink-0" />
                    ) : (
                      <FileText size={15} className="text-wealth-emerald flex-shrink-0" />
                    )}
                    <div className="truncate flex-1">
                      <p className="text-xs text-text-primary truncate font-medium">{f.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {f.isNewUpload ? (
                          <span className="text-[10px] text-primary-accent bg-primary-accent/10 px-1.5 py-0.2 rounded font-medium">Ready to upload</span>
                        ) : (
                          <span className="text-[10px] text-wealth-emerald bg-wealth-emerald/10 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                            <Lock size={9} /> In Family Safe
                          </span>
                        )}
                        {f.url && (
                          <a 
                            href={f.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={e => e.stopPropagation()} 
                            className="text-[10px] text-text-muted hover:text-primary-accent flex items-center gap-1 underline underline-offset-2"
                          >
                            View <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeFile(f.id)} 
                    className="text-text-muted hover:text-liability-rose p-1.5 hover:bg-liability-rose/10 rounded-lg transition-colors flex-shrink-0"
                    title="Remove file"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File Attachment Controls */}
          <div className="space-y-2">
            <div className="relative">
              <input 
                type="file" 
                multiple 
                onChange={handleFileSelect} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                id="asset-supporting-docs-file"
              />
              <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 border border-dashed border-border-prominent rounded-lg text-xs font-medium text-text-secondary hover:text-white hover:border-primary-accent transition-colors bg-surface-layer2/40 cursor-pointer">
                <Upload size={14} className="text-primary-accent" />
                <span>Attach Files from Device (PDF, Image, Docs)</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <input 
                value={linkInput} 
                onChange={e => setLinkInput(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                type="text" 
                placeholder="Or paste Google Drive URL..." 
                className="flex-1 bg-surface-layer2 border border-border-subtle rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-primary-accent" 
              />
              <button 
                type="button" 
                onClick={handleAddLink} 
                className="px-3 py-1.5 bg-surface-layer2 hover:bg-surface-layer1 border border-border-subtle rounded-lg text-xs font-medium transition-colors text-text-secondary hover:text-white"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="pt-4 flex flex-col gap-3 border-t border-border-subtle mt-2">
         <div className="flex gap-3">
           <button 
             type="button" 
             onClick={onCancel} 
             disabled={isSubmitting} 
             className="flex-1 px-4 py-2 bg-surface-layer2 text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-layer2/80 transition-colors disabled:opacity-50"
           >
             Cancel
           </button>
           <button 
             type="submit" 
             disabled={isSubmitting} 
             className="flex-1 px-4 py-2 bg-primary-accent text-white rounded-lg text-sm font-medium hover:bg-primary-accent/90 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
           >
             {isSubmitting ? (uploadProgress || 'Saving...') : 'Save Asset'}
           </button>
         </div>
         {isEditing && (
           <button 
             type="button" 
             onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }} 
             disabled={isSubmitting} 
             className="w-full px-4 py-2 bg-liability-rose/10 text-liability-rose border border-liability-rose/20 rounded-lg text-sm font-medium hover:bg-liability-rose/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
           >
             <Trash2 size={14} />
             <span>Delete Asset</span>
           </button>
         )}
       </div>
    </form>
  );
}
