import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMacroRegime,
  extractMacroQuotes,
  getTacticalInflowMultiplier,
  MACRO_REGIMES,
  DEFAULT_MACRO_DATA
} from '../src/utils/macroMath.js';

describe('Phase 1: Global Macro Cues & Regime Math Verification', () => {
  it('computes Risk-On regime score when macro cues are positive', () => {
    const regime = calculateMacroRegime(DEFAULT_MACRO_DATA);
    assert(regime.score >= 70, `Expected score >= 70, got ${regime.score}`);
    assert.equal(regime.regime, MACRO_REGIMES.RISK_ON);
    assert.equal(regime.indicators.tnx.rawVal, 4.32);
    assert.equal(regime.isNiftyBullish, true);
    assert(regime.tacticalGuidance.includes('Nifty structural uptrend intact'));
  });

  it('computes Risk-Off / Panic regime when multiple stress triggers fire', () => {
    const stressedData = {
      tnx: { price: 4.85 }, // Severe FII outflow drag
      usdinr: { price: 85.20 }, // Currency stress
      brent: { price: 96.50 }, // High stagflation
      vix: { price: 24.50 }, // Panic fear
      goldInr: { price: 260000 },
      silverInr: { price: 2800 }, // High Gold/Silver ratio ~92.8
      nifty: { price: 21500, ema200: 23500 } // Bear market (below 200 EMA)
    };
    const regime = calculateMacroRegime(stressedData);
    assert(regime.score < 45, `Expected score < 45, got ${regime.score}`);
    assert(regime.regime === MACRO_REGIMES.RISK_OFF || regime.regime === MACRO_REGIMES.PANIC);
    assert.equal(regime.isNiftyBullish, false);
  });

  it('correctly modulates tactical inflow multipliers by regime', () => {
    // Risk-On boosts equities, curbs idle cash
    assert.equal(getTacticalInflowMultiplier(MACRO_REGIMES.RISK_ON, 'Equity'), 1.25);
    assert.equal(getTacticalInflowMultiplier(MACRO_REGIMES.RISK_ON, 'Cash/FD'), 0.60);

    // Risk-Off boosts defensive Gold & Arbitrage/Cash
    assert.equal(getTacticalInflowMultiplier(MACRO_REGIMES.RISK_OFF, 'Equity'), 0.60);
    assert.equal(getTacticalInflowMultiplier(MACRO_REGIMES.RISK_OFF, 'Gold'), 1.40);
    assert.equal(getTacticalInflowMultiplier(MACRO_REGIMES.RISK_OFF, 'Cash/FD'), 1.30);

    // Neutral is 1.0 baseline
    assert.equal(getTacticalInflowMultiplier(MACRO_REGIMES.NEUTRAL, 'Equity'), 1.0);
  });

  it('extracts macro quotes gracefully from raw Sheet data with fallback failover', () => {
    const rawSheetQuotes = [
      ['INDEXCBOE:TNX', 'Macro', 'US 10Y Yield', 4.41, 0.1, new Date().toISOString(), 'GoogleFinance'],
      ['CURRENCY:USDINR', 'Macro', 'USD/INR', 83.55, 0.05, new Date().toISOString(), 'GoogleFinance']
    ];
    const parsed = extractMacroQuotes(rawSheetQuotes);
    assert.equal(parsed.tnx.price, 4.41);
    assert.equal(parsed.usdinr.price, 83.55);
    // Unprovided indicators should fall back to defaults gracefully
    assert.equal(parsed.vix.price, DEFAULT_MACRO_DATA.vix.price);
    assert.equal(parsed.isFallback, false);
  });
});
