import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assetSchemas } from '../src/config/assetSchemas.js';
import { reconcileCasWithLedger, resolveAmfiSchemeFromAmfiText } from '../src/utils/casParser.js';

describe('Issue #93: CAS Mutual Fund AMFI Scheme Code & ISIN Retention', () => {
  it('includes ISIN Code and AMFI Scheme Code fields in Mutual Funds schema', () => {
    const mfSchema = assetSchemas['Mutual Funds'];
    assert(mfSchema, 'Mutual Funds schema must exist');
    
    const schemeCodeField = mfSchema.fields.find(f => f.name === 'Details JSON.Scheme Code');
    assert(schemeCodeField, 'Scheme Code field must exist in Mutual Funds schema');
    assert.equal(schemeCodeField.label, 'AMFI Scheme Code / Ticker');

    const isinField = mfSchema.fields.find(f => f.name === 'Details JSON.ISIN');
    assert(isinField, 'ISIN Code field must exist in Mutual Funds schema');
    assert.equal(isinField.label, 'ISIN Code');
  });

  it('resolves AMFI scheme code and latest NAV from NAVAll.txt text format', () => {
    const sampleAmfiText = `
Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date
122639;INF879O01027;-;Parag Parikh Flexi Cap Fund;Direct Plan;Growth;94.2594;13-Nov-2026
122640;INF879O01019;-;Parag Parikh Flexi Cap Fund;Regular Plan;Growth;85.7822;13-Nov-2026
135763;INF846K01WS2;INF846K01WQ6;Axis Children's Fund;Direct Plan;IDCW Option;28.6857;13-Nov-2026
`;

    // 1. Column 1 (Growth ISIN)
    const res1 = resolveAmfiSchemeFromAmfiText(sampleAmfiText, 'INF879O01027');
    assert(res1, 'Should find scheme by Column 1 ISIN');
    assert.equal(res1.schemeCode, '122639');
    assert.equal(res1.nav, 94.2594);
    assert.equal(res1.date, '13-Nov-2026');
    assert.match(res1.schemeName, /Parag Parikh Flexi Cap Fund/);

    // 2. Column 2 (Dividend Reinvestment ISIN)
    const res2 = resolveAmfiSchemeFromAmfiText(sampleAmfiText, 'INF846K01WQ6');
    assert(res2, 'Should find scheme by Column 2 ISIN');
    assert.equal(res2.schemeCode, '135763');
    assert.equal(res2.nav, 28.6857);

    // 3. Unknown ISIN returns null
    const res3 = resolveAmfiSchemeFromAmfiText(sampleAmfiText, 'INF000000000');
    assert.equal(res3, null);

    // 4. Invalid input handling
    assert.equal(resolveAmfiSchemeFromAmfiText('', 'INF879O01027'), null);
    assert.equal(resolveAmfiSchemeFromAmfiText(sampleAmfiText, 'INVALID'), null);
  });

  it('retains ISIN and populates schemeCode in reconciled CAS candidates', () => {
    const casData = {
      statement_holder_name: 'Nozel Rosario',
      statement_date: '2026-10-31',
      holdings: [
        {
          name: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
          institution: 'PPFAS Mutual Fund',
          folio_number: '12345678/90',
          isin: 'INF879O01027',
          scheme_code: '122639',
          live_nav: 94.25,
          units: 1000,
          nav: 90.0,
          cost: 80000,
          current_value: 90000
        },
        {
          name: 'HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth',
          institution: 'HDFC Mutual Fund',
          folio_number: '98765432/10',
          isin: 'INF179K01BE2',
          units: 500,
          nav: 120.0,
          cost: 50000,
          current_value: 60000
        }
      ]
    };

    const existingAssets = [];
    const marketQuotes = [
      { Symbol: '122639', 'Live Price': 94.25, Type: 'Mutual Funds' }
    ];

    const result = reconcileCasWithLedger(casData, existingAssets, marketQuotes);
    assert.equal(result.candidates.length, 2);

    const c1 = result.candidates[0];
    assert.equal(c1.isin, 'INF879O01027', 'Candidate must retain ISIN');
    assert.equal(c1.schemeCode, '122639', 'Candidate must have resolved schemeCode');
    assert.equal(c1.effectiveNav, 94.25, 'Candidate should use liveNav when available');
    assert.equal(c1.newCurrentValue, 94250, 'Current value calculated from units * liveNav');

    const c2 = result.candidates[1];
    assert.equal(c2.isin, 'INF179K01BE2', 'Second candidate retains ISIN');
    assert.equal(c2.effectiveNav, 120.0, 'Second candidate falls back to statementNav');
  });

  it('preserves existing Scheme Code when matching existing ledger asset', () => {
    const casData = {
      statement_holder_name: 'Nozel Rosario',
      statement_date: '2026-10-31',
      holdings: [
        {
          name: 'Parag Parikh Flexi Cap Fund',
          institution: 'PPFAS AMC',
          folio_number: '12345678/90',
          isin: 'INF879O01027',
          units: 1050,
          nav: 94.0,
          cost: 85000,
          current_value: 98700
        }
      ]
    };

    const existingAssets = [
      {
        'Asset ID': 'AST_MF_001',
        Name: 'Parag Parikh Flexi Cap Fund',
        Category: 'Mutual Funds',
        Identifiers: '12345678/90',
        Cost: 80000,
        'Current Value': 90000,
        'Details JSON': JSON.stringify({
          'Scheme Code': '122639',
          'ISIN': 'INF879O01027',
          Units: 1000,
          'Average NAV': 80.0
        })
      }
    ];

    const marketQuotes = [];
    const result = reconcileCasWithLedger(casData, existingAssets, marketQuotes);
    assert.equal(result.candidates.length, 1);

    const match = result.candidates[0];
    assert.equal(match.isExisting, true);
    assert.equal(match.assetId, 'AST_MF_001');
    assert.equal(match.schemeCode, '122639', 'Must preserve existing Scheme Code');
    assert.equal(match.isin, 'INF879O01027', 'Must preserve ISIN');
    assert.equal(match.newUnits, 1050);
  });
});
