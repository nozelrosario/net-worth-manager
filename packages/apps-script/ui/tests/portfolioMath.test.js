import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePortfolioAlignment,
  simulateInflowRebalancing,
  calculateCashDrag,
  auditConcentrationRisk,
  RISK_PROFILES
} from '../src/utils/portfolioMath.js';

describe('Phase 0: Portfolio Math Financial Engineering Verification', () => {
  const sampleAssets = [
    { Name: 'Nifty 50 Index Fund', Category: 'Equity', 'Current Value': 500000, 'Details JSON': { 'Sub-Type': 'Large Cap' } },
    { Name: 'Parag Parikh Flexi Cap', Category: 'Mutual Funds', 'Current Value': 300000 },
    { Name: 'SGB 2029 Tranche IV', Category: 'Gold', 'Current Value': 100000 },
    { Name: 'HDFC Savings Account', Category: 'Cash/FD', 'Current Value': 100000, 'Details JSON': { 'Sub-Type': 'Savings Account' } }
  ];

  it('calculates portfolio alignment and drift score accurately', () => {
    const alignment = calculatePortfolioAlignment(sampleAssets, RISK_PROFILES.Moderate.target);
    assert.equal(alignment.totalGrossAssets, 1000000);
    assert.equal(alignment.totalAbsDrift, 40);
    assert.equal(alignment.alignmentScore, 80);
    assert.equal(alignment.maxOverweight.name, 'Equity');
    assert.equal(alignment.maxUnderweight.name, 'Real Estate');
  });

  it('simulates smart fresh capital inflow with zero sales', () => {
    // Inject ₹1,00,000 fresh inflow
    const simulation = simulateInflowRebalancing(sampleAssets, RISK_PROFILES.Moderate.target, 100000);
    assert.equal(simulation.inflowAmount, 100000);
    assert.equal(simulation.projectedAlignmentScore, 87);
    assert.equal(simulation.scoreImprovement, 7);

    // Overweight categories (Equity, MF) should receive ₹0 inflow
    const equityInflow = simulation.projectedBreakdown.find(b => b.category === 'Equity')?.allocatedRupees || 0;
    const mfInflow = simulation.projectedBreakdown.find(b => b.category === 'Mutual Funds')?.allocatedRupees || 0;
    assert.equal(equityInflow, 0, 'Equity is overweight and must receive 0 fresh capital');
    assert.equal(mfInflow, 0, 'MF is overweight and must receive 0 fresh capital');

    // Total allocated should equal inflow amount
    const totalAllocated = simulation.projectedBreakdown.reduce((sum, b) => sum + (b.allocatedRupees || 0), 0);
    assert.equal(totalAllocated, 100000);
  });

  it('calculates cash drag and emergency runway correctly', () => {
    const txns = [
      { Type: 'Expense', Amount: 50000, Date: '2026-10-01' },
      { Type: 'Expense', Amount: 50000, Date: '2026-09-01' },
      { Type: 'Expense', Amount: 50000, Date: '2026-08-01' }
    ];
    const drag = calculateCashDrag(sampleAssets, txns);
    assert.equal(drag.totalLiquidCash, 100000);
    assert.equal(drag.avgMonthlyExpense, 50000);
    assert.equal(drag.runwayMonths, 2);
  });

  it('flags concentration risk above regulatory thresholds', () => {
    const concentratedAssets = [
      { Name: 'Reliance Industries', Category: 'Equity', 'Current Value': 400000 },
      { Name: 'TCS', Category: 'Equity', 'Current Value': 100000 },
      { Name: 'FD', Category: 'Cash/FD', 'Current Value': 500000 }
    ];
    const risk = auditConcentrationRisk(concentratedAssets);
    assert(risk.alerts.length > 0);
    assert(risk.alerts.some(a => a.name === 'Reliance Industries'));
  });
});
