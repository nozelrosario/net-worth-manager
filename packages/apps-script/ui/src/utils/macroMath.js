// Global Macro Intelligence & Tactical Regime Engine for Net Worth Manager
// Provides quantitative scoring, regime classification, and tactical multipliers
// based on 6 core macro indicators: US 10Y Yield, USD/INR, Brent Crude, India VIX,
// Gold/Silver Ratio, and Nifty 200 EMA Trend.

export const MACRO_REGIMES = {
  RISK_ON: 'Risk-On Expansion',
  NEUTRAL: 'Neutral / Transition',
  RISK_OFF: 'Risk-Off Defensive',
  PANIC: 'Liquidity Squeeze / Panic'
};

export const DEFAULT_MACRO_DATA = {
  tnx: { symbol: 'INDEXCBOE:TNX', price: 4.32, changePct: 0.15, lastUpdated: new Date().toISOString() },
  usdinr: { symbol: 'CURRENCY:USDINR', price: 83.42, changePct: -0.05, lastUpdated: new Date().toISOString() },
  brent: { symbol: 'COMMODITY:BRENT_CRUDE', price: 78.50, changePct: -0.80, lastUpdated: new Date().toISOString() },
  vix: { symbol: 'INDEXNSE:INDIAVIX', price: 13.80, changePct: -1.20, lastUpdated: new Date().toISOString() },
  goldInr: { symbol: 'CURRENCY:XAUINR', price: 245000, changePct: 0.30, lastUpdated: new Date().toISOString() },
  silverInr: { symbol: 'CURRENCY:XAGINR', price: 2975, changePct: 0.10, lastUpdated: new Date().toISOString() },
  nifty: { symbol: 'INDEXNSE:NIFTY_50', price: 24200, ema200: 23150, changePct: 0.45, lastUpdated: new Date().toISOString() }
};

/**
 * Parses and extracts normalized macro indicators from raw MarketQuotes sheet rows or key-value map
 */
export function extractMacroQuotes(rawQuotes) {
  if (!rawQuotes) return { ...DEFAULT_MACRO_DATA, isFallback: true };

  const quotesMap = {};
  if (Array.isArray(rawQuotes)) {
    rawQuotes.forEach(row => {
      if (Array.isArray(row)) {
        const sym = String(row[0] || '').trim().toUpperCase();
        quotesMap[sym] = {
          symbol: row[0],
          type: row[1],
          name: row[2],
          price: Number(row[3]) || 0,
          changePct: Number(row[4]) || 0,
          lastUpdated: row[5],
          details: row[7]
        };
      } else if (typeof row === 'object' && row !== null) {
        const sym = String(row.Symbol || row.symbol || '').trim().toUpperCase();
        if (sym) {
          quotesMap[sym] = {
            symbol: row.Symbol || row.symbol,
            type: row.Type || row.type,
            name: row['Display Name'] || row.name,
            price: Number(row['Live Price'] || row.price) || 0,
            changePct: Number(row['Day Change %'] || row.changePct) || 0,
            lastUpdated: row['Last Updated'] || row.lastUpdated,
            details: row.Details || row.details
          };
        }
      }
    });
  } else if (typeof rawQuotes === 'object') {
    Object.keys(rawQuotes).forEach(k => {
      const item = rawQuotes[k];
      quotesMap[k.toUpperCase()] = typeof item === 'object' ? item : { price: Number(item) || 0 };
    });
  }

  const lookupPrice = (sym, fallback) => {
    const found = quotesMap[sym.toUpperCase()];
    if (found && typeof found.price === 'number' && found.price > 0) {
      return { ...found, price: found.price };
    }
    return fallback;
  };

  const tnx = lookupPrice('INDEXCBOE:TNX', DEFAULT_MACRO_DATA.tnx);
  const usdinr = lookupPrice('CURRENCY:USDINR', DEFAULT_MACRO_DATA.usdinr);
  const brent = lookupPrice('COMMODITY:BRENT_CRUDE', lookupPrice('BRENT', DEFAULT_MACRO_DATA.brent));
  const vix = lookupPrice('INDEXNSE:INDIAVIX', DEFAULT_MACRO_DATA.vix);
  const gold = lookupPrice('CURRENCY:XAUINR', DEFAULT_MACRO_DATA.goldInr);
  const silver = lookupPrice('CURRENCY:XAGINR', DEFAULT_MACRO_DATA.silverInr);
  const nifty = lookupPrice('INDEXNSE:NIFTY_50', DEFAULT_MACRO_DATA.nifty);

  return {
    tnx,
    usdinr,
    brent,
    vix,
    goldInr: gold,
    silverInr: silver,
    nifty,
    isFallback: Object.keys(quotesMap).length === 0
  };
}

/**
 * Computes composite Global Macro Regime Score (0 to 100), classifications,
 * and tactical action guidance.
 */
export function calculateMacroRegime(macroData = DEFAULT_MACRO_DATA) {
  const tnxVal = Number(macroData.tnx?.price ?? DEFAULT_MACRO_DATA.tnx.price);
  const usdinrVal = Number(macroData.usdinr?.price ?? DEFAULT_MACRO_DATA.usdinr.price);
  const brentVal = Number(macroData.brent?.price ?? DEFAULT_MACRO_DATA.brent.price);
  const vixVal = Number(macroData.vix?.price ?? DEFAULT_MACRO_DATA.vix.price);
  const goldVal = Number(macroData.goldInr?.price ?? DEFAULT_MACRO_DATA.goldInr.price);
  const silverVal = Number(macroData.silverInr?.price ?? DEFAULT_MACRO_DATA.silverInr.price);
  const niftyVal = Number(macroData.nifty?.price ?? DEFAULT_MACRO_DATA.nifty.price);
  const niftyEma = Number(macroData.nifty?.ema200 ?? DEFAULT_MACRO_DATA.nifty.ema200);

  // 1. Nifty 200 EMA Trend Component (25 pts max)
  let equityScore = 20;
  const isNiftyBullish = niftyVal >= niftyEma;
  if (isNiftyBullish) {
    const trendGapPct = ((niftyVal - niftyEma) / niftyEma) * 100;
    equityScore = Math.min(25, 20 + Math.round(trendGapPct * 0.5));
  } else {
    equityScore = 5;
  }

  // 2. Volatility Component (India VIX) (20 pts max)
  let vixScore = 15;
  let vixStatus = 'normal';
  let vixLabel = 'Controlled Volatility';
  if (vixVal < 11.5) {
    vixScore = 12; // Complacency warning
    vixStatus = 'caution';
    vixLabel = 'Complacency Zone (<11.5)';
  } else if (vixVal <= 16.0) {
    vixScore = 20; // Ideal sweet spot
    vixStatus = 'safe';
    vixLabel = 'Low Volatility Expansion';
  } else if (vixVal <= 22.0) {
    vixScore = 14;
    vixStatus = 'caution';
    vixLabel = 'Elevated Uncertainty';
  } else {
    // VIX > 22: Panic regime. For tactical wealth, this is an OPPORTUNISTIC dip-buying trigger
    vixScore = 18;
    vixStatus = 'alert';
    vixLabel = 'Extreme Fear (Dip Opportunity)';
  }

  // 3. Global Liquidity Component (US 10Y TNX) (15 pts max)
  let tnxScore = 12;
  let tnxStatus = 'safe';
  let tnxLabel = 'Stable FII Inflows';
  if (tnxVal < 3.8) {
    tnxScore = 15;
    tnxStatus = 'safe';
    tnxLabel = 'Liquidity Expansion (<3.8%)';
  } else if (tnxVal <= 4.2) {
    tnxScore = 13;
    tnxStatus = 'safe';
    tnxLabel = 'Neutral Liquidity';
  } else if (tnxVal <= 4.5) {
    tnxScore = 8;
    tnxStatus = 'caution';
    tnxLabel = 'FII Outflow Sensitivity';
  } else {
    tnxScore = 3;
    tnxStatus = 'alert';
    tnxLabel = 'Elevated Global Yield Drag (>4.5%)';
  }

  // 4. Currency Pressure Component (USD/INR) (15 pts max)
  let inrScore = 12;
  let inrStatus = 'safe';
  let inrLabel = 'Imported Inflation Safe';
  if (usdinrVal <= 83.50) {
    inrScore = 15;
    inrStatus = 'safe';
    inrLabel = 'Stable Rupee (<₹83.50)';
  } else if (usdinrVal <= 84.50) {
    inrScore = 10;
    inrStatus = 'caution';
    inrLabel = 'Mild Imported Inflation';
  } else {
    inrScore = 4;
    inrStatus = 'alert';
    inrLabel = 'Rupee Depreciation Stress (>₹84.50)';
  }

  // 5. Commodity Inflation Component (Brent Crude) (15 pts max)
  let crudeScore = 12;
  let crudeStatus = 'safe';
  let crudeLabel = 'Margin Expansion Safe';
  if (brentVal < 75.0) {
    crudeScore = 15;
    crudeStatus = 'safe';
    crudeLabel = 'Oil Deficit Safe Zone (<$75)';
  } else if (brentVal <= 85.0) {
    crudeScore = 12;
    crudeStatus = 'safe';
    crudeLabel = 'Fiscal Deficit Manageable';
  } else if (brentVal <= 90.0) {
    crudeScore = 7;
    crudeStatus = 'caution';
    crudeLabel = 'Elevated Oil Sensitivity';
  } else {
    crudeScore = 2;
    crudeStatus = 'alert';
    crudeLabel = 'High Stagflation Risk (>$90)';
  }

  // 6. Safe Haven Barometer (Gold / Silver Ratio) (10 pts max)
  const goldSilverRatio = silverVal > 0 ? Number(((goldVal / silverVal)).toFixed(1)) : 82.4;
  let gsScore = 7;
  let gsStatus = 'safe';
  let gsLabel = 'Neutral Metal Sentiment';
  if (goldSilverRatio < 72.0) {
    gsScore = 10;
    gsStatus = 'safe';
    gsLabel = 'Industrial Economic Recovery (<72)';
  } else if (goldSilverRatio <= 85.0) {
    gsScore = 7;
    gsStatus = 'safe';
    gsLabel = 'Balanced Monetary Sentiment';
  } else {
    gsScore = 4;
    gsStatus = 'caution';
    gsLabel = 'Recessionary Safe-Haven Bias (>85)';
  }

  // Composite Score (0 - 100)
  const compositeScore = Math.max(0, Math.min(100,
    equityScore + vixScore + tnxScore + inrScore + crudeScore + gsScore
  ));

  // Determine Regime
  let regime = MACRO_REGIMES.NEUTRAL;
  let colorClass = 'text-primary-accent';
  let badgeVariant = 'indigo';
  let summary = 'Balanced Macro Environment • Standard Rebalance';
  let tacticalGuidance = 'Deploy planned SIPs and routine inflow rebalancing evenly across underweight categories.';

  if (compositeScore >= 70) {
    regime = MACRO_REGIMES.RISK_ON;
    colorClass = 'text-profit-emerald';
    badgeVariant = 'emerald';
    summary = 'Global Liquidity Positive • High SIP & Equity Multipliers';
    tacticalGuidance = 'Nifty structural uptrend intact with favorable global liquidity. Maintain 100% active equity allocations; keep defensive Gold reserve at target.';
  } else if (compositeScore >= 45) {
    regime = MACRO_REGIMES.NEUTRAL;
    colorClass = 'text-sky-400';
    badgeVariant = 'sky';
    summary = 'Mixed Macro Signals • Disciplined Strategic Allocation';
    tacticalGuidance = 'Macro indicators are balanced. Strictly follow strategic target weights and deploy fresh inflows into proportional shortfalls.';
  } else if (compositeScore >= 25) {
    regime = MACRO_REGIMES.RISK_OFF;
    colorClass = 'text-warning-amber';
    badgeVariant = 'amber';
    summary = 'Elevated Risk Signals • Overweight Arbitrage & Gold';
    tacticalGuidance = 'Rising macro headwinds detected. Tilt fresh monthly inflows towards Sovereign Gold Bonds and Arbitrage/Liquid funds to avoid catching falling knives.';
  } else {
    regime = MACRO_REGIMES.PANIC;
    colorClass = 'text-liability-rose';
    badgeVariant = 'rose';
    summary = 'Severe Macro Shock / Liquidity Crunch • Capital Preservation';
    tacticalGuidance = 'Severe macro stress. Expand emergency cash runway to 9 months and stage equity deployments exclusively via disciplined 4-week DCA tranches.';
  }

  return {
    score: compositeScore,
    regime,
    summary,
    tacticalGuidance,
    colorClass,
    badgeVariant,
    isNiftyBullish,
    indicators: {
      tnx: {
        symbol: 'INDEXCBOE:TNX',
        name: 'US 10Y Yield',
        value: `${tnxVal.toFixed(2)}%`,
        rawVal: tnxVal,
        label: tnxLabel,
        status: tnxStatus,
        threshold: '>4.50%'
      },
      usdinr: {
        symbol: 'CURRENCY:USDINR',
        name: 'USD / INR',
        value: `₹${usdinrVal.toFixed(2)}`,
        rawVal: usdinrVal,
        label: inrLabel,
        status: inrStatus,
        threshold: '>₹84.50'
      },
      brent: {
        symbol: 'COMMODITY:BRENT_CRUDE',
        name: 'Brent Crude Oil',
        value: `$${brentVal.toFixed(2)}/bbl`,
        rawVal: brentVal,
        label: crudeLabel,
        status: crudeStatus,
        threshold: '>$90/bbl'
      },
      vix: {
        symbol: 'INDEXNSE:INDIAVIX',
        name: 'India VIX',
        value: vixVal.toFixed(1),
        rawVal: vixVal,
        label: vixLabel,
        status: vixStatus,
        threshold: '>22.0'
      },
      goldSilverRatio: {
        symbol: 'XAU/XAG',
        name: 'Gold / Silver Ratio',
        value: goldSilverRatio.toFixed(1),
        rawVal: goldSilverRatio,
        label: gsLabel,
        status: gsStatus,
        threshold: '>85.0'
      },
      niftyTrend: {
        symbol: 'INDEXNSE:NIFTY_50',
        name: 'Nifty 50 Trend',
        value: isNiftyBullish ? 'Above 200 EMA' : 'Below 200 EMA',
        rawVal: niftyVal,
        emaVal: niftyEma,
        label: isNiftyBullish ? `Bull Trend (+${(((niftyVal - niftyEma) / niftyEma) * 100).toFixed(1)}%)` : 'Correction / Bear Trend',
        status: isNiftyBullish ? 'safe' : 'alert',
        threshold: '200-Day EMA'
      }
    }
  };
}

/**
 * Computes tactical allocation multipliers for fresh capital inflows
 * based on the active macro regime.
 */
export function getTacticalInflowMultiplier(regime, category) {
  const normCat = String(category || '').toLowerCase();
  
  if (regime === MACRO_REGIMES.RISK_ON) {
    if (normCat.includes('equity') || normCat.includes('mutual')) return 1.25;
    if (normCat.includes('gold')) return 1.0;
    if (normCat.includes('cash') || normCat.includes('fd')) return 0.60;
    if (normCat.includes('real')) return 1.0;
  } else if (regime === MACRO_REGIMES.RISK_OFF) {
    if (normCat.includes('equity') || normCat.includes('mutual')) return 0.60;
    if (normCat.includes('gold')) return 1.40;
    if (normCat.includes('cash') || normCat.includes('fd')) return 1.30;
    if (normCat.includes('real')) return 0.80;
  } else if (regime === MACRO_REGIMES.PANIC) {
    if (normCat.includes('equity') || normCat.includes('mutual')) return 0.40;
    if (normCat.includes('gold')) return 1.30;
    if (normCat.includes('cash') || normCat.includes('fd')) return 1.60;
    if (normCat.includes('real')) return 0.50;
  }

  // Neutral
  return 1.0;
}
