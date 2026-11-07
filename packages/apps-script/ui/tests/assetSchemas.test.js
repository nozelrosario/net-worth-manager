import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assetSchemas } from '../src/config/assetSchemas.js';

describe('Phase 4: Modern Asset Classes Schema Verification', () => {
  it('includes Target Maturity Fund (TMF) schema options and fields in Cash/FD', () => {
    const cashSchema = assetSchemas['Cash/FD'];
    assert(cashSchema, 'Cash/FD schema must exist');
    const subTypeField = cashSchema.fields.find(f => f.name === 'Details JSON.Sub-Type');
    assert(subTypeField.options.includes('Target Maturity Fund (TMF)'));

    const ytmField = cashSchema.fields.find(f => f.name === 'Details JSON.Locked YTM');
    assert(ytmField);
    assert.equal(ytmField.condition({ 'Details JSON': { 'Sub-Type': 'Target Maturity Fund (TMF)' } }), true);
    assert.equal(ytmField.condition({ 'Details JSON': { 'Sub-Type': 'Fixed Deposit (FD)' } }), false);
  });

  it('includes REIT / InvIT Unit schema options and fields in Real Estate', () => {
    const reSchema = assetSchemas['Real Estate'];
    assert(reSchema, 'Real Estate schema must exist');
    const typeField = reSchema.fields.find(f => f.name === 'Details JSON.Property Type');
    assert(typeField.options.includes('REIT / InvIT Unit'));

    const yieldField = reSchema.fields.find(f => f.name === 'Details JSON.Distribution Yield');
    assert(yieldField);
    assert.equal(yieldField.condition({ 'Details JSON': { 'Property Type': 'REIT / InvIT Unit' } }), true);
    assert.equal(yieldField.condition({ 'Details JSON': { 'Property Type': 'Residential' } }), false);
  });

  it('includes Sovereign Gold Bonds Secondary Market in Gold schema', () => {
    const goldSchema = assetSchemas['Gold'];
    assert(goldSchema, 'Gold schema must exist');
    const ffField = goldSchema.fields.find(f => f.name === 'Details JSON.Form Factor');
    assert(ffField.options.includes('Sovereign Gold Bonds (Secondary Market)'));

    const discountField = goldSchema.fields.find(f => f.name === 'Details JSON.Traded Discount');
    assert(discountField);
    assert.equal(discountField.condition({ 'Details JSON': { 'Form Factor': 'Sovereign Gold Bonds (Secondary Market)' } }), true);
  });

  it('includes Factor / Smart Beta ETF in Equity schema', () => {
    const eqSchema = assetSchemas['Equity'];
    assert(eqSchema, 'Equity schema must exist');
    const typeField = eqSchema.fields.find(f => f.name === 'Details JSON.Instrument Type');
    assert(typeField.options.includes('Factor / Smart Beta ETF'));

    const strategyField = eqSchema.fields.find(f => f.name === 'Details JSON.Factor Strategy');
    assert(strategyField);
    assert.equal(strategyField.condition({ 'Details JSON': { 'Instrument Type': 'Factor / Smart Beta ETF' } }), true);
  });
});
