'use strict';
// ETL pipelines (customer x retail channel x inventory/sales): the Firebase-era registry (functions/etl-pipelines.js,
// read 25 October 2026) on the same etlPipelineSetups documents. Ids, channels, adapters, default rules and the
// built-in setups are unchanged, so runs started from either Nexus land in the same history.
const crypto = require('node:crypto');
const {AppError} = require('../errors.cjs');

const ACTIVE_PIPELINE = 'anchor-pnp-v1';
const CHANNELS = [['pnp', 'Pick n Pay'], ['clicks', 'Clicks'], ['shoprite', 'Shoprite'], ['checkers', 'Checkers'], ['game', 'Game'], ['dischem', 'Dis-Chem'], ['spar', 'SPAR'], ['makro', 'Makro'],
  ['woolworths', 'Woolworths'], ['boxer', 'Boxer'], ['jumbo', 'Jumbo'], ['shoprite-group', 'Shoprite Group']].map(([id, name]) => ({id, name}));
const SETUP_ROLES = ['raw', 'expected', 'products', 'stores', 'staffing', 'dc', 'status', 'template'];
const DEFAULT_RULES = {salesDays: 30, openPO: 'unknown', bannerColumn: 'D', reportDate: 'as-of', productFamily: 'PICK N PAY CORPORATE', confirmed: true};
const clean = v => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

function pipelineId(customer, channelId, kind = 'Inventory') {
  return kind === 'Inventory' && customer.toUpperCase() === 'ANCHOR' && CHANNELS.some(c => c.id === channelId)
    ? `anchor-${channelId}-v1`
    : `${kind.toLowerCase()}-${crypto.createHash('sha256').update(`${customer.toUpperCase()}|${channelId}`).digest('hex').slice(0, 24)}`;
}

function profile(value) {
  const kind = value.kind === 'Sales' ? 'Sales' : 'Inventory';
  const customer = clean(value.customer).toUpperCase();
  const feedback = {
    'ETHICA|clicks|Inventory': 'clicks-inventory-v1',
    'AQUELLE|boxer|Sales': 'boxer-sales-v1', 'AQUELLE|game|Sales': 'game-sales-v1', 'AQUELLE|makro|Sales': 'makro-sales-v1',
    'UNIVERSAL PAPER|shoprite-group|Sales': 'shoprite-universal-sales-v1',
    'SALDANHA|shoprite|Sales': 'shoprite-saldanha-sales-v1', 'SALDANHA|checkers|Sales': 'shoprite-saldanha-sales-v1'
  };
  const adapter = kind === 'Inventory' && value.channelId === 'pnp' ? 'pnp-inventory-v2' : kind === 'Sales' && value.channelId === 'clicks' ? 'clicks-sales-v1' : feedback[`${customer}|${value.channelId}|${kind}`] || null;
  const weekly = ['game-sales-v1', 'makro-sales-v1'].includes(adapter), clicksStock = adapter === 'clicks-inventory-v1';
  const rawInputs = clicksStock
    ? [{role: 'raw', label: 'Store stock', accept: '.xlsx'}, {role: 'dcStock', label: 'DC stock', accept: '.xlsx'}, {role: 'periodSales', label: 'Sales for stock period', accept: '.xlsx'}]
    : [{role: 'raw', label: weekly ? 'Weekly sales exports' : 'Raw data', accept: weekly ? '.xlsx,.txt,.csv' : '.xlsx', ...(weekly ? {multiple: true, maxFiles: 12} : {})}];
  return {...value, kind, runnable: Boolean(adapter), transformerVersion: adapter, resourceMode: 'shared', defaultRules: {...DEFAULT_RULES},
    rawInputs, reportingMonth: Boolean(adapter && kind === 'Sales' && adapter !== 'clicks-sales-v1'),
    referenceRoles: kind === 'Sales' ? ['products', 'stores', 'staffing', 'salesSample', ...(adapter?.startsWith('shoprite-') ? ['gln'] : [])] : clicksStock ? ['products', 'stores', 'staffing', 'dc', 'inventorySample'] : ['products', 'stores', 'staffing', 'dc', 'status', 'inventorySample'],
    status: adapter ? 'available' : 'mapping-required'};
}

function defaults() {
  const anchor = CHANNELS.slice(0, 10).map(channel => profile({id: pipelineId('Anchor', channel.id), customer: 'Anchor', channelId: channel.id, channel: channel.name, reportName: channel.id === 'pnp' ? 'Site Days Cover' : 'Inventory export', resources: {}, notes: '', revision: 0}));
  // Setup records, not approval to run an unvalidated source adapter.
  const setups = [
    ['aQuelle', 'boxer', 'Sales', 'Boxer raw sales', 'Boxer XLSX sales export; confirm reporting period, SKU and store keys.'],
    ['aQuelle', 'game', 'Sales', 'MassDiscounters weekly sales', 'Weekly TXT exports; confirm delimiter, date coverage and subtotal policy.'],
    ['aQuelle', 'makro', 'Sales', 'Makro weekly sales', 'Weekly TXT exports; confirm delimiter, date coverage and subtotal policy.'],
    ['Dynamic Brands', 'pnp', 'Inventory', 'Site Days Cover', 'PnP inventory and transformed inventory example are available locally. Validate this client\'s product mappings and estimate rules.'],
    ['Dynamic Brands', 'shoprite-group', 'Inventory', 'Vendor Stock / DC stock', 'Site View stock and DC exports; reconcile against the multi-channel transformed example.'],
    ['Dynamic Brands', 'shoprite-group', 'Sales', 'Vendor Article Sales', 'Validate sales period, product/store keys and expected monthly output.'],
    ['Ethica', 'clicks', 'Inventory', 'Store SOH / DC SOH', 'Store and DC stock are separate sources. Validate the inventory example and DC allocation.'],
    ['Ethica', 'clicks', 'Sales', 'Clicks monthly sales', 'Raw and transformed sales examples; confirm month, measures and exact joins.'],
    ['Magalies', 'shoprite-group', 'Inventory', 'Vendor Stock / DC stock', 'Site View stock and two DC exports; reconcile stock without double-counting DC balances.'],
    ['Magalies', 'shoprite-group', 'Sales', 'Vendor Article Sales', 'Raw and transformed examples cover different periods. Obtain a matching-period output before approval.'],
    ['Penflex', 'pnp', 'Inventory', 'Site Days Cover', 'Raw and transformed inventory examples; validate client-specific mappings and channel coverage.'],
    ['Saldanha', 'shoprite', 'Sales', 'Six-month sales', 'Confirm monthly column selection and totals; do not append six months as one month.'],
    ['Saldanha', 'checkers', 'Sales', 'Six-month sales', 'Confirm monthly column selection and totals; validate separately from Shoprite.'],
    ['Universal Paper', 'shoprite-group', 'Sales', 'Store Monthly', 'February to July 2026 sample; validate month, SKU/store joins and expected output.']
  ].map(([customer, channelId, kind, reportName, notes]) => profile({id: pipelineId(customer, channelId, kind), customer, channelId, channel: CHANNELS.find(c => c.id === channelId).name, kind, reportName, notes, resources: {}, revision: 0}));
  return [...anchor, ...setups];
}

function pipelineRegistry({fs, resourceInput}) {
  async function get(id) {
    if (!/^[a-z0-9-]{1,100}$/.test(id || '')) return null;
    const doc = await fs.get(`etlPipelineSetups/${id}`);
    const value = doc ? doc.data : defaults().find(p => p.id === id);
    if (!value || typeof value.customer !== 'string' || !CHANNELS.some(c => c.id === value.channelId) || pipelineId(value.customer, value.channelId, value.kind || 'Inventory') !== id) return null;
    return profile({...value, id});
  }
  async function list() {
    const docs = await fs.query('etlPipelineSetups', {limit: 500});
    const entries = new Map(defaults().map(p => [p.id, p]));
    for (const doc of docs) entries.set(doc.id, profile({...doc.data, id: doc.id}));
    return [...entries.values()].sort((a, b) => a.customer.localeCompare(b.customer) || a.channel.localeCompare(b.channel));
  }
  async function save(input, actor) {
    const customer = clean(input.customer), channelId = clean(input.channelId), reportName = clean(input.reportName), notes = clean(input.notes);
    const kind = input.kind || 'Inventory';
    if (!['Inventory', 'Sales'].includes(kind)) throw new AppError('invalid-argument', 'Choose inventory or sales.');
    const channel = CHANNELS.find(c => c.id === channelId);
    if (customer.length < 2 || customer.length > 100 || !channel || reportName.length < 2 || reportName.length > 120 || notes.length > 2000) throw new AppError('invalid-argument', 'Choose a customer, retail channel and source report name. Notes may contain up to 2,000 characters.');
    const id = pipelineId(customer, channelId, kind);
    if (input.id && input.id !== id) throw new AppError('invalid-argument', 'A pipeline\'s customer and channel cannot be changed. Add a separate pipeline.');
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new AppError('invalid-argument', 'Reload the pipeline before saving.');
    if (id === ACTIVE_PIPELINE) throw new AppError('failed-precondition', 'Manage the validated Anchor / Pick n Pay reference files in Shared files.');
    if (input.resources && (typeof input.resources !== 'object' || Array.isArray(input.resources) || Object.keys(input.resources).some(r => !SETUP_ROLES.includes(r)))) throw new AppError('invalid-argument', 'Unknown setup file role.');
    const files = {};
    for (const role of SETUP_ROLES) if (input.resources?.[role]) files[role] = await resourceInput(role, input.resources[role], {setup: true});
    if (files.raw && files.expected && files.raw.resourceId === files.expected.resourceId) throw new AppError('invalid-argument', 'The raw sample and expected output must be different workbooks.');
    const value = {id, customer, channelId, channel: channel.name, kind, reportName, notes, resources: Object.fromEntries(Object.entries(files).map(([role, file]) => [role, file.resourceId])), revision: input.revision + 1, updatedAt: new Date().toISOString(), updatedBy: actor};
    await fs.transaction(async tx => {
      const current = await tx.get(`etlPipelineSetups/${id}`);
      if ((current ? current.data.revision : 0) !== input.revision) throw new AppError('already-exists', 'Another administrator changed this setup. Reload before saving.');
      for (const [role, file] of Object.entries(files)) {
        const doc = await tx.get(`portalResources/${file.resourceId}`);
        if (!doc || doc.data.active === false || doc.data.storagePath !== file.sourcePath || doc.data.sourceName !== file.name) throw new AppError('already-exists', `${role}: the Resource changed. Reload before saving.`);
      }
      tx.set(`etlPipelineSetups/${id}`, value);
      tx.create(`etlPipelineSetupAudit/${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`, {pipelineId: id, revision: value.revision, by: actor, at: value.updatedAt});
    });
    return profile(value);
  }
  return {list, save, get};
}

module.exports = {ACTIVE_PIPELINE, CHANNELS, SETUP_ROLES, DEFAULT_RULES, defaults, pipelineId, profile, pipelineRegistry};
