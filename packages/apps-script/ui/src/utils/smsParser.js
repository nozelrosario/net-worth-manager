/**
 * ==============================================================================
 * Net Worth Manager - Smart Financial SMS Parser & Deduplication Engine
 * ==============================================================================
 * Parses XML backups produced by "SMS Backup & Restore" Android utility.
 * Extracts amounts, bank/card accounts, payees, transaction types, and categories.
 * Implements 4-tier deduplication, internal transfer detection, and paired vendor suppression.
 */

/**
 * Normalizes and parses raw date metadata (handles timestamps, strings, readable format, or in-body date).
 */
export function parseDateRobust(dVal, readableVal = '', bodyText = '') {
  let d = null;
  let epoch = 0;

  // 1. If numeric or numeric string (timestamp in ms or s)
  if (dVal !== undefined && dVal !== null && /^\d+$/.test(String(dVal).trim())) {
    let num = Number(String(dVal).trim());
    if (num < 10000000000) num *= 1000; // convert s to ms
    epoch = num;
    d = new Date(num);
  } else if (dVal instanceof Date && !isNaN(dVal.getTime())) {
    d = dVal;
    epoch = d.getTime();
  } else if (dVal) {
    const parsed = new Date(dVal);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
      epoch = d.getTime();
    }
  }

  // 2. Try readableVal if d is still invalid
  if ((!d || isNaN(d.getTime())) && readableVal) {
    const parsedReadable = new Date(readableVal);
    if (!isNaN(parsedReadable.getTime())) {
      d = parsedReadable;
      epoch = d.getTime();
    }
  }

  // 3. Fallback: Try regex extraction from SMS body if still invalid (e.g. "on 23Jul21", "on 26/07/21", "at 2-08-2021")
  if ((!d || isNaN(d.getTime())) && bodyText) {
    const bodyMatch = bodyText.match(/(?:on|at)\s+(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/i) ||
                      bodyText.match(/(?:on|at)\s+(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2,4})/i);
    if (bodyMatch) {
      if (bodyMatch[2].length >= 3) {
        const day = bodyMatch[1];
        const month = bodyMatch[2];
        let year = bodyMatch[3];
        if (year.length === 2) year = '20' + year;
        const candidateDate = new Date(`${day} ${month} ${year}`);
        if (!isNaN(candidateDate.getTime())) {
          d = candidateDate;
          epoch = d.getTime();
        }
      } else {
        const day = bodyMatch[1].padStart(2, '0');
        const month = bodyMatch[2].padStart(2, '0');
        let year = bodyMatch[3];
        if (year.length === 2) year = '20' + year;
        const candidateDate = new Date(`${year}-${month}-${day}`);
        if (!isNaN(candidateDate.getTime())) {
          d = candidateDate;
          epoch = d.getTime();
        }
      }
    }
  }

  // 4. Default to current date if completely unparseable
  if (!d || isNaN(d.getTime())) {
    d = new Date();
    epoch = d.getTime();
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return {
    epoch,
    dateStr,
    readableDate: readableVal || d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  };
}

/**
 * Extracts a clean, concise transaction preview text snippet from the SMS body.
 * Strips out customer care numbers, website links, balance disclaimers, etc.
 */
export function extractPreviewSnippet(body = '') {
  if (!body) return '';
  let clean = body
    .replace(/^Dear Customer,?\s*/i, '')
    .replace(/^Thank you for using\s*/i, '')
    .replace(/If not (?:done|you)[\s\S]*/i, '')
    .replace(/Not you\?[\s\S]*/i, '')
    .replace(/Click\s+https?:\/\/\S+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/Avl(?:\.| bal| Limit)[\s\S]*/i, '')
    .replace(/Call\s+\d+[\s\S]*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length > 95) {
    clean = clean.slice(0, 92).trim() + '...';
  }
  return clean;
}

/**
 * Parses raw XML string into an array of SMS message objects.
 * Supports both browser DOMParser and fallback regex streaming for high performance.
 */
export function parseSmsXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') return [];

  const messages = [];

  // High-performance streaming regex parser (works universally and in Web Workers)
  const smsTagRegex = /<sms\s+([^>]+?)(?:\/>|>.*?<\/sms>)/g;
  const attrRegex = /([a-zA-Z_0-9]+)="([^"]*)"/g;
  let match;

  while ((match = smsTagRegex.exec(xmlString)) !== null) {
    const attrString = match[1];
    const attrs = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    const rawDate = attrs.date || attrs.date_sent;
    if (attrs.body && (rawDate || attrs.readable_date)) {
      messages.push({
        address: attrs.address || '',
        date: rawDate ? (isNaN(Number(rawDate)) ? rawDate : Number(rawDate)) : Date.now(),
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
  if (
    b.includes('LIFE INSUR') || 
    b.includes('LIC') || 
    b.includes('MUTUAL FUND') || 
    b.includes('SIP') || 
    b.includes('TAX SAVER') || 
    b.includes('KOTAK LIFE') ||
    b.includes('HDFC LIFE') ||
    b.includes('ICICI PRU') ||
    b.includes('MAX LIFE') ||
    b.includes('STAR HEALTH') ||
    b.includes('HDFC ERGO') ||
    b.includes('CARE HEALTH') ||
    b.includes('INSURANCE')
  ) {
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
    return 'Dining';
  }

  // Shopping & Retail
  if (p.includes('LENSKART') || p.includes('AMAZON') || p.includes('FLIPKART') || p.includes('MYNTRA') || p.includes('AJIO') || p.includes('ZARA')) {
    return 'Shopping';
  }

  // Travel & Transport
  if (p.includes('RAILWAY') || p.includes('RWALLET') || p.includes('UBER') || p.includes('OLA') || p.includes('RAPIDO') || p.includes('PETROL') || p.includes('FUEL')) {
    return 'Travel';
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
    bLower.includes('hdfc life') ||
    bLower.includes('icici pru') ||
    bLower.includes('max life') ||
    bLower.includes('star health') ||
    bLower.includes('hdfc ergo') ||
    bLower.includes('care health') ||
    bLower.includes('insurance') ||
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

  // Format robust date & preview snippet
  const dateInfo = parseDateRobust(date, sms.readableDate, body);
  const previewSnippet = extractPreviewSnippet(body);

  // Generate deterministic fingerprint
  const fingerprint = computeSmsFingerprint({
    bank,
    refNo,
    accountDigits,
    rawDate: dateInfo.epoch,
    amount,
    body
  });

  return {
    id: fingerprint,
    fingerprint,
    rawDate: dateInfo.epoch,
    dateStr: dateInfo.dateStr,
    Date: dateInfo.dateStr, // Convenient sheet header alias
    readableDate: dateInfo.readableDate,
    previewSnippet,
    bank,
    account: accountLabel,
    accountDigits,
    amount,
    payee,
    refNo,
    type,
    isTransfer,
    category,
    beneficiary: 'Whole Family',
    body,
    address,
    isPairedVendor: false,
    status: 'new', // 'new' | 'imported' | 'ignored'
    isImported: false,
    isIgnored: false,
    selected: false // Default unchecked to prevent accidental batch imports
  };
}

/**
 * Fast 32-bit FNV-1a hash function for strings.
 */
export function simpleFnvHash(str = '') {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Computes a deterministic SMS fingerprint.
 * If bank reference number exists: SMS_<BANK>_<REFNO>_<AMOUNT>
 * Fallback: SMS_<ACCOUNT>_<EPOCH>_<AMOUNT>_<HASH>
 */
export function computeSmsFingerprint({ bank = '', refNo = '', accountDigits = '', rawDate = 0, amount = 0, body = '' }) {
  const bankCode = (bank || 'BANK').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const amtStr = Number(amount || 0).toFixed(2);

  if (refNo && String(refNo).trim().length >= 4) {
    const cleanRef = String(refNo).trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return `SMS_${bankCode}_${cleanRef}_${amtStr}`;
  }

  const cleanBodySnippet = body.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 36);
  const bodyHash = simpleFnvHash(cleanBodySnippet);
  const acct = accountDigits ? accountDigits.replace(/[^0-9]/g, '') : bankCode;
  return `SMS_${acct}_${rawDate}_${amtStr}_${bodyHash}`;
}

/**
 * 4-Tier Deduplication & Reconciliation:
 * Tier 1: Watermark epoch check (date > lastProcessedEpoch)
 * Tier 2: Reference number & duplicate check within candidates
 * Tier 3: Merchant-Bank Paired SMS Suppression (e.g. Jio/Swiggy confirmation within 3 minutes of bank debit)
 * Tier 4: Cross-reconciliation against existing transactions from Google Sheets and ignored hashes registry
 */
export function deduplicateAndClassify(
  candidates = [],
  existingTransactions = [],
  ignoredHashes = [],
  lastProcessedEpoch = 0
) {
  let effectiveIgnored = ignoredHashes;
  let effectiveEpoch = lastProcessedEpoch;
  if (typeof ignoredHashes === 'number') {
    effectiveEpoch = ignoredHashes;
    effectiveIgnored = [];
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      candidates: [],
      stats: {
        totalCandidates: 0,
        pendingCount: 0,
        newCount: 0,
        importedCount: 0,
        ignoredCount: 0,
        totalPendingAmount: 0,
        totalNewAmount: 0,
        transfersCount: 0,
        investmentsCount: 0,
        spendsCount: 0,
        duplicatesFiltered: 0
      }
    };
  }

  const seenRefs = new Set();
  const seenCompoundKeys = new Set();
  let duplicatesFiltered = 0;

  // Step 1: Pre-index existing transactions from ledger
  const importedFingerprints = new Set();
  const existingMap = new Map();

  if (Array.isArray(existingTransactions)) {
    existingTransactions.forEach(t => {
      // Check Txn ID (e.g. TXN_SMS_SMS_SBI_629981173158_10000.00 or TXN_SMS_...)
      const txnId = String(t['Txn ID'] || t.id || '').trim();
      if (txnId.startsWith('TXN_SMS_')) {
        const rawFp = txnId.replace(/^TXN_SMS_/, '');
        importedFingerprints.add(rawFp);
        if (!rawFp.startsWith('SMS_')) {
          importedFingerprints.add(`SMS_${rawFp}`);
        }
      }

      // Check Tags (e.g. SMS_REF:SMS_SBI_629981173158_10000.00)
      const tags = String(t.Tags || t.tags || '');
      const refMatch = tags.match(/SMS_REF:([A-Za-z0-9_.-]+)/);
      if (refMatch) {
        importedFingerprints.add(refMatch[1]);
      }

      // Fallback Date + Amount + Account
      let d = String(t.Date || t.date || '').trim();
      if (d.includes('T')) d = d.split('T')[0];
      const a = Math.round(parseFloat(t.Amount || t.amount || 0) * 100);
      if (d && !isNaN(a)) {
        const acct = String(t['Account/Card'] || t.account || '');
        const acctDigits = detectAccountDigits(acct);
        if (acctDigits) {
          existingMap.set(`${d}_${a}_${acctDigits}`, txnId || true);
        }
        existingMap.set(`${d}_${a}`, txnId || true);
      }
    });
  }

  // Step 2: Pre-index ignored hashes registry
  const ignoredSet = new Set();
  if (Array.isArray(effectiveIgnored)) {
    effectiveIgnored.forEach(h => {
      if (h) ignoredSet.add(String(h).trim());
    });
  } else if (typeof effectiveIgnored === 'string') {
    try {
      const parsed = JSON.parse(effectiveIgnored);
      if (Array.isArray(parsed)) {
        parsed.forEach(h => { if (h) ignoredSet.add(String(h).trim()); });
      }
    } catch (e) {}
  }

  // Step 3: Sort candidates chronologically
  const sorted = [...candidates].sort((a, b) => a.rawDate - b.rawDate);

  // Step 4: Detect and suppress paired merchant receipts
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

    // Suppress candidate duplicate RefNo within incoming batch
    if (c.refNo) {
      if (seenRefs.has(c.refNo)) {
        duplicatesFiltered++;
        continue;
      }
      seenRefs.add(c.refNo);
    }

    // Suppress candidate compound duplicate within 1-minute bucket (same bank, minute, amount)
    const minuteBucket = Math.floor(c.rawDate / 60000);
    const compoundKey = `${c.bank}_${minuteBucket}_${Math.round(c.amount * 100)}`;
    if (seenCompoundKeys.has(compoundKey)) {
      duplicatesFiltered++;
      continue;
    }
    seenCompoundKeys.add(compoundKey);

    // Cross-check 1: Deterministic Fingerprint against ledger
    let isImported = importedFingerprints.has(c.fingerprint);

    // Cross-check 2: Fallback date + amount + account match in ledger
    if (!isImported) {
      const specificKey = `${c.dateStr}_${Math.round(c.amount * 100)}_${c.accountDigits}`;
      const generalKey = `${c.dateStr}_${Math.round(c.amount * 100)}`;
      if (c.accountDigits && existingMap.has(specificKey)) {
        isImported = true;
      } else if (existingMap.has(generalKey)) {
        isImported = true;
      }
    }

    // Cross-check 3: Ignored registry
    const isIgnored = !isImported && ignoredSet.has(c.fingerprint);

    if (isImported) {
      c.status = 'imported';
      c.isImported = true;
      c.selected = false;
    } else if (isIgnored) {
      c.status = 'ignored';
      c.isIgnored = true;
      c.selected = false;
    } else {
      // Tier 1: Watermark epoch filter (only for automated background sync where effectiveEpoch > 0)
      if (effectiveEpoch && c.rawDate <= effectiveEpoch) {
        c.status = 'imported';
        c.isImported = true;
        c.selected = false;
      } else {
        c.status = 'new';
        c.isNew = true;
        c.selected = false; // Default unchecked
      }
    }

    validCandidates.push(c);
  }

  // Reverse so newest appears on top in review inbox
  validCandidates.reverse();

  // Compute stats
  let newCount = 0;
  let importedCount = 0;
  let ignoredCount = 0;
  let totalNewAmount = 0;
  let transfersCount = 0;
  let investmentsCount = 0;
  let spendsCount = 0;

  validCandidates.forEach(c => {
    if (c.status === 'imported') {
      importedCount++;
    } else if (c.status === 'ignored') {
      ignoredCount++;
    } else {
      newCount++;
      totalNewAmount += c.amount;
      if (c.type === 'Transfer') {
        transfersCount++;
      } else if (c.type === 'Investment') {
        investmentsCount++;
      } else {
        spendsCount++;
      }
    }
  });

  return {
    candidates: validCandidates,
    stats: {
      totalCandidates: validCandidates.length,
      pendingCount: newCount,
      newCount,
      importedCount,
      ignoredCount,
      totalPendingAmount: totalNewAmount,
      totalNewAmount,
      transfersCount,
      investmentsCount,
      spendsCount,
      duplicatesFiltered
    }
  };
}
