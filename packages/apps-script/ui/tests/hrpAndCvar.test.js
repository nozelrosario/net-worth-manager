import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHRPWeights,
  calculateCVaR,
  simulateTacticalInflowRebalancing,
  RISK_PROFILES
} from '../src/utils/portfolioMath.js';

describe('Phase 3: Hierarchical Risk Parity (HRP) & CVaR Math Verification', () => {
  it('computes HRP optimal weights using tree clustering and recursive bisection', () => {
    const hrp = calculateHRPWeights();
    assert(hrp.weights, 'HRP should return weights object');
    
    // Sum of weights should equal 100%
    const totalWeight = Object.values(hrp.weights).reduce((sum, w) => sum + w, 0);
    assert(Math.abs(totalWeight - 100) < 0.1, `Total weight should be 100%, got ${totalWeight}`);

    // Risk Parity properties: Cash/FD (low variance) and Gold (uncorrelated hedge)
    // should receive meaningful defensive weights
    assert(hrp.weights['Cash/FD'] >= 15, 'Cash/FD should have >= 15% allocation');
    assert(hrp.weights['Gold'] >= 10, 'Gold should have >= 10% allocation');
    assert(hrp.weights['Equity'] >= 15, 'Equity should have >= 15% allocation');
    assert(Array.isArray(hrp.quasiOrder), 'Should return quasi-diagonalized cluster order');
  });

  it('computes CVaR 95% tail risk downside stress test accurately', () => {
    const sampleAssets = [
      { Category: 'Equity', 'Current Value': 600000 },
      { Category: 'Mutual Funds', 'Current Value': 400000 }
    ];
    const cvar = calculateCVaR(sampleAssets);
    assert(typeof cvar.expectedDrawdownPct === 'number');
    assert(cvar.expectedDrawdownPct < 0, 'Drawdown should be a negative percentage');
    assert(cvar.expectedDrawdownRupees < 0, 'Drawdown rupees should be negative');
    assert(cvar.benchmarks.nifty50 < 0);
    assert(cvar.benchmarks.allWeather < 0);
    assert(typeof cvar.diversificationRatio === 'number');
    assert(cvar.diversificationRatio >= 1.0, 'Diversification ratio should be >= 1.0');
  });

  it('runs tactical inflow simulation and modulates fresh capital with macro multipliers', () => {
    const sampleAssets = [
      { Category: 'Equity', 'Current Value': 500000 },
      { Category: 'Mutual Funds', 'Current Value': 300000 },
      { Category: 'Gold', 'Current Value': 100000 },
      { Category: 'Cash/FD', 'Current Value': 100000 }
    ];

    // Strategic mode (baseline)
    const strategic = simulateTacticalInflowRebalancing(sampleAssets, RISK_PROFILES.Moderate.target, 100000, 'strategic');
    assert.equal(strategic.mode, 'strategic');
    assert.equal(strategic.inflowAmount, 100000);

    // Tactical mode (with macro overlay)
    const tactical = simulateTacticalInflowRebalancing(sampleAssets, RISK_PROFILES.Moderate.target, 100000, 'tactical');
    assert.equal(tactical.mode, 'tactical');
    assert(tactical.tacticalSignals.length > 0);
    assert(tactical.projectedBreakdown.length > 0);
    const totalAllocated = tactical.projectedBreakdown.reduce((s, b) => s + (b.allocatedRupees || 0), 0);
    assert(Math.abs(totalAllocated - 100000) <= 2, `Total allocated ${totalAllocated} should equal inflow 100000`);
  });
});
