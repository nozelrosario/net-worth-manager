/**
 * ==============================================================================
 * Net Worth Manager - Smart Financial SMS Parser & Deduplication Engine
 * ==============================================================================
 * Parses XML backups produced by "SMS Backup & Restore" Android utility.
 * Extracts amounts, bank/card accounts, payees, transaction types, and categories.
 * Implements 4-tier deduplication, internal transfer detection, and paired vendor suppression.
 */

/**
 * Parses raw XML string into an array of SMS message objects.
 * Supports both browser DOMParser and fallback regex streaming for high performance.
 */
export function parseSmsXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') return [];

  const messages = [];

  // High-performance streaming regex parser (works universally and in Web Workers)
  const smsTagRegex = /<sms\s+([^>]+?)\/>/g;
  const attrRegex = /([a-zA-Z_0-9]+)="([^"]*)"/g;
  let match;

  while ((match = smsTagRegex.exec(xmlString)) !== null) {
    const attrString = match[1];
    const attrs = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    if (attrs.body && attrs.date) {
      messages.push({
        address: attrs.address || '',
        date: parseInt(attrs.date, 10),
        readableDate: attrs.readable_date || '',
        body: attrs.body,
        type: attrs.type || '1',
        subId: attrs.sub_id || '0'
      });
    }
  }

  return messages;
}

/**
 * Normalizes numeric currency strings (handles commas and decimals).
 */
export function parseCurrencyAmount(str) {
  if (!str) return 0;
  const clean = str.replace(/,/g, '').trim();
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

/**
 * Resolves bank or financial institution from sender address header and body text.
 */
export function detectBank(address = '', body = '') {
  const addr = address.toUpperCase();
  const bUpper = body.toUpperCase();

  if (addr.includes('SBI') || bUpper.includes('@SBI') || bUpper.includes('SBI UPI') || bUpper.includes('STATE BANK')) {
    return 'SBI';
  }
  if (addr.includes('HDFC') || bUpper.includes('HDFC BANK') || bUpper.includes('HDFCBK')) {
    return 'HDFC Bank';
  }
  if (addr.includes('SCB') || addr.includes('SCBANK') || bUpper.includes('STANCHART') || bUpper.includes('STANDARD CHARTERED')) {
    return 'Standard Chartered';
  }
  if (addr.includes('AXIS') || bUpper.includes('AXIS BANK')) {
    return 'Axis Bank';
  }
  if (addr.includes('CITI') || bUpper.includes('CITIBANK') || bUpper.includes('CITI')) {
    return 'Citi / Axis Bank';
  }
  if (addr.includes('SODEXO') || addr.includes('PLUXEE') || bUpper.includes('SODEXO') || bUpper.includes('PLUXEE')) {
    return 'Sodexo / Pluxee';
  }
  if (addr.includes('BCCB') || bUpper.includes('BASSEIN CATHOLIC') || bUpper.includes('BCCB')) {
    return 'BCCB';
  }
  if (addr.includes('KOTAK') || bUpper.includes('KOTAK MAHINDRA')) {
    return 'Kotak Mahindra';
  }
  if (addr.includes('ICICI') || bUpper.includes('ICICI BANK')) {
    return 'ICICI Bank';
  }
  if (addr.includes('PAYTM') || bUpper.includes('PAYTM')) {
    return 'Paytm Bank';
  }
  if (addr.includes('IRSMS') || bUpper.includes('RWALLET') || bUpper.includes('INDIAN RAILWAY')) {
    return 'IRCTC RWallet';
  }
  return 'Bank / Card';
}

/**
 * Extracts masked account or credit/debit card ending digits.
 */
export function detectAccountDigits(body = '') {
  // Pattern 1: A/c X4089, A/c ending 7735, Card ending 3601, Card No XX4469, xx2506
  const match = body.match(/(?:A\/[cC]|Acct|Account|Card|Ending|xx|XX)[\s\w]*?([Xx*]*\d{3,5})\b/i);
  if (match) {
    const raw = match[1].replace(/^[Xx*]+/, '');
    // Ignore 4-digit years like 2021-2030 unless clearly an account
    if (raw && !['2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030'].includes(raw)) {
      return raw;
    }
  }
  // Pattern 2: frm A/c X7735 or frm A/cX7735
  const directAcMatch = body.match(/frm\s+A\/[cC][\s:]*[Xx*]*(\d{3,5})\b/i);
  if (directAcMatch) {
    return directAcMatch[1];
  }
  // Pattern 3: Card 3601
  const cardMatch = body.match(/Card\s+(\d{3,5})\b/i);
  if (cardMatch) {
    return cardMatch[1];
  }
  return '';
}

/**
 * Detects whether an SMS is non-transactional noise (OTPs, promos, service alerts).
 */
export function isNoiseSms(body = '') {
  const bLower = body.toLowerCase();

  // Strict OTP / Password / PIN alerts
  if (
    bLower.includes('is your otp') ||
    bLower.includes('verification code') ||
    bLower.includes('secret code') ||
    bLower.includes('one time password') ||
    bLower.includes('temporary password') ||
    bLower.includes('telephone pin') ||
    bLower.includes('do not share')
  ) {
    return true;
  }

  // Declines / Insufficient funds
  if (bLower.includes('declined due to insufficient funds') || bLower.includes('transaction declined')) {
    return true;
  }

  // Pure balance notifications & broker statements without spend
  if (
    bLower.includes('reported your fund bal') ||
    bLower.includes('total os bal') ||
    bLower.includes('available limit:') ||
    bLower.includes('avlb lmt') ||
    bLower.includes('statement of account for recent txn')
  ) {
    if (!bLower.includes('debited') && !bLower.includes('spent') && !bLower.includes('credited')) {
      return true;
    }
  }

  // Upcoming due bills & reminders
  if (
    bLower.includes('ebill will be sent') ||
    bLower.includes('bill summary :') ||
    bLower.includes('payment due date:') ||
    bLower.includes('is due for debit') ||
    bLower.includes('due on') ||
    bLower.includes('is active with the following details') // e-mandate creation notice
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts payee or merchant name from transaction SMS.
 */
export function extractPayee(body = '', bank = 'Bank') {
  let payee = '';

  // 1. UPI Transfer to: "trf to GRAMINA NOZEL RO Refno..." or "trf to MONISH ALEX CORR..."
  const trfMatch = body.match(/trf\s+to\s+([A-Za-z0-9\s._&-]+?)(?:\s+Refno|\s+Ref|\s+If\s+not|\s+on|\.|$)/i);
  if (trfMatch) {
    payee = trfMatch[1].trim();
  }

  // 2. Card Spend at: "At _LENSKART SOLUTION." or "at BAGESHREE." or "at PUNNYAI PRO"
  if (!payee) {
    const atMatch = body.match(/(?:At|at)\s+([A-Za-z0-9\s._&-]+?)(?:\s+On|\s+on|\s+Not|\.|$|Avl)/i);
    if (atMatch) {
      payee = atMatch[1].trim();
    }
  }

  // 3. Netbanking to: "frm A/c X7735 to Life Insur. Ref..."
  if (!payee) {
    const toMatch = body.match(/to\s+([A-Za-z0-9\s._&-]+?)(?:\s+Ref|\s+on|\.|$|If\s+not)/i);
    if (toMatch) {
      payee = toMatch[1].trim();
    }
  }

  // 4. Default fallback
  if (!payee || payee.length < 2) {
    payee = bank;
  }

  // Clean leading underscores and normalize spacing
  return payee.replace(/^_+/, '').replace(/\s+/g, ' ').trim();
}

/**
 * Detects reference numbers (UTR, UPI RefNo, RRN, Auth code).
 */
export function extractReferenceNumber(body = '') {
  const match = body.match(/(?:Refno|Ref No|Ref|Txn ID|RRN)\s*:?\s*([A-Za-z0-9]+)/i);
  return match ? match[1] : '';
}

/**
 * Guesses suitable category based on merchant text.
 */
export function guessCategory(payee = '', body = '', bank = '') {
  const p = payee.toUpperCase();
  const b = body.toUpperCase();

  // Internal Transfer
  if (p.includes('NOZEL') || p.includes('GRAMINA') || b.includes('SELF TRF') || b.includes('OWN A/C')) {
    return 'Internal Transfer';
  }

  // Investments & Insurance
  if (b.includes('LIFE INSUR') || b.includes('LIC') || b.includes('MUTUAL FUND') || b.includes('SIP') || b.includes('TAX SAVER') || b.includes('KOTAK LIFE')) {
    return 'Investment';
  }

  // Utilities & Bills
  if (p.includes('ELEC') || p.includes('HDFCBPELEC') || p.includes('JIO') || p.includes('AIRTEL') || p.includes('BESCOM') || p.includes('BILL') || b.includes('ELECTRICITY') || b.includes('BROADBAND')) {
    return 'Utilities';
  }

  // Groceries & Provisions
  if (p.includes('RELIANCE JI') || p.includes('RELIANCE J') || p.includes('PUNNYAI') || p.includes('GROCER') || p.includes('BLINKIT') || p.includes('ZEPTO') || p.includes('INSTAMART') || p.includes('DMART')) {
    return 'Groceries';
  }

  // Dining & Restaurants
  if (p.includes('BAGESHREE') || p.includes('HOTEL') || p.includes('RESTAURANT') || p.includes('CAFE') || p.includes('SWIGGY') || p.includes('ZOMATO') || bank.includes('Sodexo')) {
    return 'Dining & Food';
  }

  // Shopping & Retail
  if (p.includes('LENSKART') || p.includes('AMAZON') || p.includes('FLIPKART') || p.includes('MYNTRA') || p.includes('AJIO') || p.includes('ZARA')) {
    return 'Shopping';
  }

  // Travel & Transport
  if (p.includes('RAILWAY') || p.includes('RWALLET') || p.includes('UBER') || p.includes('OLA') || p.includes('RAPIDO') || p.includes('PETROL') || p.includes('FUEL')) {
    return 'Travel & Fuel';
  }

  // Healthcare & Medicine
  if (p.includes('HOSPITAL') || p.includes('PHARMACY') || p.includes('APOLLO') || p.includes('1MG') || p.includes('CLINIC') || p.includes('DENTAL')) {
    return 'Healthcare';
  }

  return 'General Expense';
}

/**
 * Parses and extracts a single candidate financial transaction from an SMS message.
 */
export function extractFinancialCandidate(sms, options = {}) {
  const { body, address, date } = sms;
  if (!body || !date) return null;

  // 1. Noise check
  if (isNoiseSms(body)) return null;

  // 2. Amount extraction
  let amount = 0;
  let amtMatch = body.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amtMatch) {
    amtMatch = body.match(/debited\s+(?:by|with)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  }
  if (!amtMatch) {
    amtMatch = body.match(/txn\s+of\s+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  }
  if (!amtMatch) return null;

  amount = parseCurrencyAmount(amtMatch[1]);
  if (amount <= 0) return null;

  const bLower = body.toLowerCase();

  // 3. Direction
  const isCredit =
    bLower.includes('credited with') ||
    bLower.includes('deposited in') ||
    bLower.includes('as a reversal') ||
    bLower.includes('refund');

  const isDebit =
    bLower.includes('debited') ||
    bLower.includes('spent') ||
    bLower.includes('txn of') ||
    bLower.includes('purchase') ||
    bLower.includes('withdrawn') ||
    bLower.includes('card was used') ||
    bLower.includes('used for txn');

  if (!isCredit && !isDebit) return null;

  // 4. Entity Extraction
  const bank = detectBank(address, body);
  const accountDigits = detectAccountDigits(body);
  const payee = extractPayee(body, bank);
  const refNo = extractReferenceNumber(body);

  // 5. Account Label Matching
  let accountLabel = bank;
  if (accountDigits) {
    accountLabel = `${bank} (••${accountDigits})`;
  }

  // 6. Classification
  let type = 'Spend';
  let isTransfer = false;
  const pUpper = payee.toUpperCase();
  const userNameUpper = (options.userName || 'NOZEL ROSARIO').toUpperCase();
  const userTokens = userNameUpper.split(' ').filter(t => t.length > 2);

  const matchesUser =
    userTokens.some(t => pUpper.includes(t)) ||
    pUpper.includes('GRAMINA') ||
    bLower.includes('self trf') ||
    bLower.includes('transfer to self') ||
    bLower.includes('own a/c');

  if (matchesUser && isDebit) {
    type = 'Transfer';
    isTransfer = true;
  } else if (
    bLower.includes('life insur') ||
    bLower.includes('lic') ||
    bLower.includes('mutual fund') ||
    bLower.includes('sip') ||
    bLower.includes('tax saver') ||
    bLower.includes('kotak life') ||
    bLower.includes('nps') ||
    bLower.includes('ppf')
  ) {
    type = 'Investment';
  } else if (isCredit) {
    type = 'Income / Refund';
  } else {
    type = 'Spend';
  }

  // Category
  let category = guessCategory(payee, body, bank);
  if (type === 'Transfer') category = 'Internal Transfer';
  if (type === 'Investment') category = 'Investment / Insurance';
  if (type === 'Income / Refund') category = 'Reversal / Refund';

  // Format date
  const dateObj = new Date(date);
  const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : '';

  // Generate unique compound ID
  const cleanId = `${address}_${date}_${Math.round(amount)}`;

  return {
    id: cleanId,
    rawDate: date,
    dateStr,
    readableDate: sms.readableDate || dateStr,
    bank,
    account: accountLabel,
    accountDigits,
    amount,
    payee,
    refNo,
    type,
    isTransfer,
    category,
    body,
    address,
    isPairedVendor: false,
    isExistingDuplicate: false,
    selected: true // Default checked for easy review
  };
}

/**
 * 4-Tier Deduplication & Reconciliation:
 * Tier 1: Watermark epoch check (date > lastProcessedEpoch)
 * Tier 2: Reference number & duplicate check within candidates
 * Tier 3: Merchant-Bank Paired SMS Suppression (e.g. Jio/Swiggy confirmation within 3 minutes of bank debit)
 * Tier 4: Cross-reconciliation against existing transactions from Google Sheets
 */
export function deduplicateAndClassify(candidates = [], existingTransactions = [], lastProcessedEpoch = 0) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      filteredCandidates: [],
      stats: { total: 0, pending: 0, transfers: 0, investments: 0, duplicatesFiltered: 0 }
    };
  }

  const seenRefs = new Set();
  const seenCompoundKeys = new Set();
  let duplicatesFiltered = 0;

  // Step 1: Pre-index existing transactions by Date + Amount
  const existingMap = new Map();
  if (Array.isArray(existingTransactions)) {
    existingTransactions.forEach(t => {
      const d = String(t.Date || '').trim();
      const a = Math.round(parseFloat(t.Amount || 0) * 100);
      if (d && !isNaN(a)) {
        const k = `${d}_${a}`;
        existingMap.set(k, true);
      }
    });
  }

  // Step 2: Sort candidates chronologically
  const sorted = [...candidates].sort((a, b) => a.rawDate - b.rawDate);

  // Step 3: Detect and suppress paired merchant receipts
  // (e.g. Bank debits ₹706.82 at t=0, Jio confirmation arrives at t=7s with identical ₹706.82)
  for (let i = 0; i < sorted.length; i++) {
    const itemA = sorted[i];
    if (itemA.isPairedVendor) continue;

    for (let j = i + 1; j < sorted.length; j++) {
      const itemB = sorted[j];
      const timeDiffSec = Math.abs(itemB.rawDate - itemA.rawDate) / 1000;
      if (timeDiffSec > 180) break; // 3-minute window

      if (Math.abs(itemA.amount - itemB.amount) < 0.01) {
        // One is bank, other is vendor receipt (Jio, Airtel, etc.)
        const isABank = itemA.bank !== 'Bank / Card' && !itemA.address.includes('JIO') && !itemA.address.includes('AIR');
        const isBBank = itemB.bank !== 'Bank / Card' && !itemB.address.includes('JIO') && !itemB.address.includes('AIR');

        if (isABank && !isBBank) {
          itemB.isPairedVendor = true;
          duplicatesFiltered++;
        } else if (!isABank && isBBank) {
          itemA.isPairedVendor = true;
          duplicatesFiltered++;
        }
      }
    }
  }

  const validCandidates = [];

  for (const c of sorted) {
    // Suppress paired vendor receipts
    if (c.isPairedVendor) continue;

    // Tier 1: Watermark epoch filter
    if (lastProcessedEpoch && c.rawDate <= lastProcessedEpoch) {
      duplicatesFiltered++;
      continue;
    }

    // Tier 2: RefNo deduplication
    if (c.refNo) {
      if (seenRefs.has(c.refNo)) {
        duplicatesFiltered++;
        continue;
      }
      seenRefs.add(c.refNo);
    }

    // Compound deduplication (Date within 1 minute + Bank + Amount)
    const minuteBucket = Math.floor(c.rawDate / 60000);
    const compoundKey = `${c.bank}_${minuteBucket}_${Math.round(c.amount * 100)}`;
    if (seenCompoundKeys.has(compoundKey)) {
      duplicatesFiltered++;
      continue;
    }
    seenCompoundKeys.add(compoundKey);

    // Tier 4: Cross-check existing Transactions in Google Sheet
    const sheetKey = `${c.dateStr}_${Math.round(c.amount * 100)}`;
    if (existingMap.has(sheetKey)) {
      c.isExistingDuplicate = true;
      // Mark as unselected by default or skip
      c.selected = false;
      duplicatesFiltered++;
      continue;
    }

    validCandidates.push(c);
  }

  // Reverse so newest appears on top in review inbox
  validCandidates.reverse();

  // Compute stats
  let pendingCount = 0;
  let totalPendingAmount = 0;
  let transfersCount = 0;
  let totalTransferAmount = 0;
  let investmentsCount = 0;
  let totalInvestmentAmount = 0;

  validCandidates.forEach(c => {
    if (c.type === 'Transfer') {
      transfersCount++;
      totalTransferAmount += c.amount;
    } else if (c.type === 'Investment') {
      investmentsCount++;
      totalInvestmentAmount += c.amount;
    } else {
      pendingCount++;
      totalPendingAmount += c.amount;
    }
  });

  return {
    candidates: validCandidates,
    stats: {
      totalCandidates: validCandidates.length,
      pendingCount,
      totalPendingAmount,
      transfersCount,
      totalTransferAmount,
      investmentsCount,
      totalInvestmentAmount,
      duplicatesFiltered
    }
  };
}
