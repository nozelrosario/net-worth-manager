/**
 * ==============================================================================
 * Net Worth Manager - CAS Investment Parser & Reconciliation Engine
 * ==============================================================================
 * Handles CAMS+KFintech Consolidated Account Statement (CAS) PDF in-memory unlock,
 * text extraction via PDF.js CDN, Google Gemini 1.5 Flash structured parsing,
 * composite key reconciliation (Folio + ISIN), and live quote valuation sync.
 */

/**
 * Dynamically loads PDF.js library from Cloudflare CDN on-demand
 * Keeps single-file bundle lightweight and avoids Apps Script web worker errors.
 */
let pdfjsLoadingPromise = null;

export function loadPdfJsLibrary() {
  if (window.pdfjsLib && window.pdfjsWorker) {
    return Promise.resolve(window.pdfjsLib);
  }

  if (pdfjsLoadingPromise) {
    return pdfjsLoadingPromise;
  }

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  };

  pdfjsLoadingPromise = (async () => {
    try {
      // 1. Preload worker script on main thread so that PDF.js activates its main-thread
      // fake worker without attempting 'new Worker()', preventing cross-origin iframe security errors.
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
      } catch (wErr) {
        console.warn('pdf.worker.min.js script preload skipped/failed:', wErr);
      }

      // 2. Load core pdf.min.js
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');

      if (!window.pdfjsLib) {
        throw new Error('PDF.js library loaded but pdfjsLib object not found.');
      }

      // 3. Configure worker source:
      // If pdfjsWorker was loaded on main thread, GlobalWorkerOptions.workerSrc can be left empty
      // to let PDF.js safely run WorkerMessageHandler on the main thread.
      // Otherwise, attempt same-origin Blob worker fallback.
      if (window.pdfjsWorker?.WorkerMessageHandler) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      } else {
        try {
          const workerBlob = new Blob(
            [`importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');`],
            { type: 'application/javascript' }
          );
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
        } catch {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        }
      }

      return window.pdfjsLib;
    } catch (err) {
      pdfjsLoadingPromise = null;
      throw err;
    }
  })();

  return pdfjsLoadingPromise;
}

/**
 * Decodes Base64 string into Uint8Array binary buffer
 */
export function base64ToUint8Array(base64Str) {
  let cleanStr = base64Str;
  if (cleanStr.indexOf(',') !== -1) {
    cleanStr = cleanStr.split(',')[1];
  }
  // Remove whitespace
  cleanStr = cleanStr.replace(/\s/g, '');
  const binaryString = atob(cleanStr);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Unlocks password-protected CAS PDF in-memory and extracts clean text layer
 */
export async function extractTextFromCasPdf(pdfInput, password = '') {
  try {
    const pdfjs = await loadPdfJsLibrary();

    let dataBuffer;
    if (typeof pdfInput === 'string') {
      dataBuffer = base64ToUint8Array(pdfInput);
    } else if (pdfInput instanceof Uint8Array) {
      dataBuffer = pdfInput.slice(0);
    } else if (pdfInput instanceof ArrayBuffer) {
      dataBuffer = new Uint8Array(pdfInput.slice(0));
    } else {
      throw new Error('Unsupported PDF data format provided.');
    }

    const cleanPassword = (password || '').trim();
    const loadingTask = pdfjs.getDocument({
      data: dataBuffer,
      password: cleanPassword
    });

    let pdfDoc;
    try {
      pdfDoc = await loadingTask.promise;
    } catch (docErr) {
      const errName = docErr?.name || '';
      const errMsg = (docErr?.message || '').toLowerCase();
      const errCode = docErr?.code;
      if (
        errName === 'PasswordException' ||
        errCode === 1 ||
        errCode === 2 ||
        errMsg.includes('password') ||
        errMsg.includes('decrypt')
      ) {
        return {
          status: 'password_required',
          error: 'INCORRECT_PASSWORD',
          message: 'Incorrect password or statement is password protected. Enter the password set during CAMS export or your PAN.'
        };
      }
      throw docErr;
    }

    const numPages = pdfDoc.numPages;
    let fullText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += `\n--- PAGE ${pageNum} ---\n` + pageText;
    }

    return {
      status: 'success',
      text: fullText,
      numPages: numPages
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.message || err.toString()
    };
  }
}

/**
 * Pre-prunes raw text before sending to Gemini
 * If user uploads a 50-page detailed statement, strips out repetitive transaction logs
 */
export function pruneCasTextForGemini(rawText) {
  if (!rawText) return '';
  if (rawText.length < 25000) {
    return rawText;
  }

  // If text is very long, remove verbose transaction logs while keeping scheme headers and closing balances
  const lines = rawText.split('\n');
  const pruned = [];
  let inTransactionBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check if entering a detailed transaction log table
    if (lower.includes('transaction details') || lower.includes('transactions for the period')) {
      inTransactionBlock = true;
    }

    // Check if reaching the closing balance / valuation summary of a scheme
    if (lower.includes('closing unit balance') || lower.includes('total valuation') || lower.includes('portfolio summary') || lower.includes('valuation as on')) {
      inTransactionBlock = false;
    }

    // Keep header information, scheme headers, and closing balance summaries
    if (!inTransactionBlock || lower.includes('folio no') || lower.includes('isin') || lower.includes('scheme') || lower.includes('page')) {
      pruned.push(line);
    }
  }

  const result = pruned.join('\n');
  return result.length > 5000 ? result : rawText;
}

/**
 * Calls Google Gemini 1.5 Flash API with structured JSON output
 */
export async function parseCasWithGemini(extractedText, geminiApiKey) {
  if (!geminiApiKey) {
    throw new Error('Google Gemini API Key is missing. Please enter your Gemini API key in Settings or the CAS Hub.');
  }

  const prunedText = pruneCasTextForGemini(extractedText);

  const systemInstruction = `You are an expert Indian financial portfolio auditor and registrar data extraction engine.
Extract the statement investor name, statement closing date, and all active Mutual Fund holdings from the provided Consolidated Account Statement (CAS).
Rules:
1. Extract the primary statement holder / investor legal name into 'statement_holder_name' (e.g. "NOZEL ROSARIO").
2. Extract the statement valuation / snapshot date into 'statement_date' (format YYYY-MM-DD). If not found, use current date.
3. Ignore historical transaction logs (SIP purchases, switches, redemptions, dividends, stamp duties) and extract ONLY the final closing balance of holdings as of the statement date.
4. For each mutual fund scheme, extract:
   - name: full clean scheme name (e.g. "Parag Parikh Flexi Cap Fund - Direct Plan - Growth")
   - institution: AMC name (e.g. "PPFAS Mutual Fund", "Nippon India Mutual Fund")
   - folio_number: clean folio number (e.g. "12345678/90")
   - isin: ISIN code (e.g. "INF879O01019") or null
   - units: closing units held (number, e.g. 1452.18)
   - nav: latest NAV reported (number, e.g. 85.34)
   - cost: total purchase / invested cost (number) or 0
   - current_value: current market valuation reported (number)
5. Output strictly a JSON object conforming to this schema:
{
  "statement_holder_name": "string",
  "statement_date": "YYYY-MM-DD",
  "holdings": [
    {
      "name": "string",
      "institution": "string",
      "folio_number": "string",
      "isin": "string or null",
      "units": 0.0,
      "nav": 0.0,
      "cost": 0.0,
      "current_value": 0.0
    }
  ]
}`;

  const promptBody = {
    contents: [
      {
        parts: [
          { text: systemInstruction },
          { text: "Here is the raw text extracted from the CAS PDF statement:\n\n" + prunedText }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1
    }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(promptBody)
  });

  if (!res.ok) {
    const errText = await res.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch(e) {}
    const msg = parsedErr?.error?.message || errText;
    throw new Error(`Gemini API Error (${res.status}): ${msg}`);
  }

  const jsonRes = await res.json();
  const rawOutputText = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawOutputText) {
    throw new Error('Gemini API returned an empty response. Please verify the statement content.');
  }

  let parsedData;
  try {
    parsedData = JSON.parse(rawOutputText);
  } catch (parseErr) {
    throw new Error('Failed to parse Gemini structured JSON: ' + parseErr.message);
  }

  return parsedData;
}

/**
 * Normalizes strings for robust fuzzy matching
 */
function normalizeStr(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Cleans folio number representation
 */
function cleanFolio(folio) {
  return String(folio || '')
    .replace(/folio\s*no\.?:?/gi, '')
    .replace(/[^a-zA-Z0-9\/\-_]/g, '')
    .trim();
}

/**
 * Reconciles parsed CAS holdings with existing ledger assets & live quotes
 * Uses composite key: Folio Number + ISIN / Normalized Scheme Name
 */
export function reconcileCasWithLedger(
  casData,
  existingAssets = [],
  marketQuotes = [],
  familyProfiles = [],
  defaultOwnerEmail = ''
) {
  const holdings = Array.isArray(casData?.holdings) ? casData.holdings : [];
  const statementHolderName = casData?.statement_holder_name || '';
  const statementDate = casData?.statement_date || new Date().toISOString().split('T')[0];

  // Map family profiles for owner resolution
  let detectedOwner = '';
  if (statementHolderName) {
    const cleanHolder = statementHolderName.toLowerCase();
    for (const p of familyProfiles) {
      const pName = String(p.Name || p['Profile Name'] || '').toLowerCase();
      if (pName && (cleanHolder.includes(pName) || pName.includes(cleanHolder.split(' ')[0]))) {
        detectedOwner = p.Name || p['Profile Name'];
        break;
      }
    }
  }
  if (!detectedOwner && defaultOwnerEmail) {
    detectedOwner = defaultOwnerEmail;
  }

  // Build live quotes lookup map
  const quotesMap = {};
  for (const q of marketQuotes) {
    const sym = String(q.Symbol || '').toUpperCase().trim();
    const price = Number(q['Live Price']) || 0;
    if (sym && price > 0) {
      quotesMap[sym] = price;
    }
  }

  // Filter only Mutual Fund assets from database
  const mfAssets = existingAssets.filter((a) => {
    const cat = String(a.Category || '').toLowerCase();
    return cat.includes('mutual') || cat === 'mf';
  });

  // Index existing assets by composite keys
  const existingByKey = new Map();
  const matchedExistingIds = new Set();

  for (const asset of mfAssets) {
    let details = {};
    try {
      details = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
    } catch(e) {}

    const assetId = asset['Asset ID'];
    const folio = cleanFolio(asset.Identifiers || details['Folio Number'] || '');
    const isin = String(details.ISIN || '').toUpperCase().trim();
    const normName = normalizeStr(asset.Name);

    // Primary key: Folio + ISIN
    if (folio && isin) {
      existingByKey.set(`${folio}::${isin}`, asset);
    }
    // Secondary key: Folio + Normalized Name
    if (folio && normName) {
      existingByKey.set(`${folio}::${normName}`, asset);
    }
    // Tertiary key: ISIN only (for demat MFs)
    if (isin) {
      existingByKey.set(`ISIN::${isin}`, asset);
    }
    // Fallback key: Folio only
    if (folio) {
      existingByKey.set(`FOLIO::${folio}`, asset);
    }
  }

  const candidates = [];
  let updatedCount = 0;
  let newCount = 0;
  let sipsCreditedCount = 0;
  let totalStatementValue = 0;
  let totalInvestedCost = 0;
  let totalValuationDelta = 0;

  for (let idx = 0; idx < holdings.length; idx++) {
    const h = holdings[idx];
    const hFolio = cleanFolio(h.folio_number);
    const hIsin = String(h.isin || '').toUpperCase().trim();
    const hNormName = normalizeStr(h.name);
    const hUnits = Number(h.units) || 0;
    const hNav = Number(h.nav) || 0;
    const hCost = Number(h.cost) || 0;
    const hStatementVal = Number(h.current_value) || (hUnits * hNav);

    totalStatementValue += hStatementVal;
    totalInvestedCost += hCost;

    // Match search
    let matchedAsset = null;
    if (hFolio && hIsin && existingByKey.has(`${hFolio}::${hIsin}`)) {
      matchedAsset = existingByKey.get(`${hFolio}::${hIsin}`);
    } else if (hFolio && hNormName && existingByKey.has(`${hFolio}::${hNormName}`)) {
      matchedAsset = existingByKey.get(`${hFolio}::${hNormName}`);
    } else if (hIsin && existingByKey.has(`ISIN::${hIsin}`)) {
      matchedAsset = existingByKey.get(`ISIN::${hIsin}`);
    } else if (hFolio && existingByKey.has(`FOLIO::${hFolio}`)) {
      matchedAsset = existingByKey.get(`FOLIO::${hFolio}`);
    }

    if (matchedAsset) {
      matchedExistingIds.add(matchedAsset['Asset ID']);

      let existingDetails = {};
      try {
        existingDetails = typeof matchedAsset['Details JSON'] === 'string'
          ? JSON.parse(matchedAsset['Details JSON'])
          : (matchedAsset['Details JSON'] || {});
      } catch(e) {}

      const oldUnits = Number(existingDetails.Units) || 0;
      const oldCost = Number(matchedAsset.Cost) || 0;
      const oldCurrentVal = Number(matchedAsset['Current Value']) || 0;
      const schemeCode = existingDetails['Scheme Code'] || h.scheme_code;

      // Check if live tracking quote exists
      const livePrice = quotesMap[schemeCode] || quotesMap[hIsin] || null;
      const effectiveNav = livePrice && livePrice > 0 ? livePrice : hNav;
      const effectiveCurrentVal = Math.round((hUnits * effectiveNav) * 100) / 100;

      const unitsDelta = Math.round((hUnits - oldUnits) * 1000) / 1000;
      const costDelta = Math.round((hCost - oldCost) * 100) / 100;
      const valDelta = Math.round((effectiveCurrentVal - oldCurrentVal) * 100) / 100;

      let status = 'updated';
      let statusLabel = 'Holdings Updated';

      if (hUnits === 0 && oldUnits > 0) {
        status = 'redeemed';
        statusLabel = 'Redeemed / Zero Units';
      } else if (unitsDelta > 0.005) {
        status = 'updated';
        statusLabel = 'SIP Credited';
        sipsCreditedCount++;
      } else if (Math.abs(unitsDelta) <= 0.005 && Math.abs(valDelta) > 1) {
        status = 'updated';
        statusLabel = 'Valuation Refreshed';
      } else if (Math.abs(unitsDelta) <= 0.005 && Math.abs(valDelta) <= 1) {
        status = 'unchanged';
        statusLabel = 'Unchanged';
      }

      if (status === 'updated') {
        updatedCount++;
        totalValuationDelta += valDelta;
      }

      candidates.push({
        id: `CAS_MATCH_${matchedAsset['Asset ID']}`,
        isExisting: true,
        assetId: matchedAsset['Asset ID'],
        name: matchedAsset.Name || h.name,
        institution: matchedAsset['Institution/Location'] || h.institution || 'Mutual Fund AMC',
        folioNumber: hFolio || matchedAsset.Identifiers || '',
        isin: hIsin || existingDetails.ISIN || '',
        category: matchedAsset.Category || 'Mutual Funds',
        owner: matchedAsset.Owner || detectedOwner || 'Single',
        nominee: matchedAsset.Nominee || '',
        status: status,
        statusLabel: statusLabel,
        isActionable: status !== 'unchanged',
        // Units
        oldUnits: oldUnits,
        newUnits: hUnits,
        unitsDelta: unitsDelta,
        // NAV
        oldNav: Number(existingDetails['Average NAV']) || (oldUnits > 0 ? oldCost / oldUnits : 0),
        statementNav: hNav,
        liveNav: livePrice,
        effectiveNav: effectiveNav,
        // Cost
        oldCost: oldCost,
        newCost: hCost > 0 ? hCost : oldCost,
        costDelta: costDelta,
        // Valuation
        oldCurrentValue: oldCurrentVal,
        newCurrentValue: effectiveCurrentVal,
        valuationDelta: valDelta,
        // Details
        existingDetails: existingDetails
      });
    } else {
      // New Unrecorded Holding
      newCount++;
      const effectiveCurrentVal = Math.round((hUnits * hNav) * 100) / 100;
      totalValuationDelta += effectiveCurrentVal;

      candidates.push({
        id: `CAS_NEW_${idx}_${hFolio}`,
        isExisting: false,
        assetId: null,
        name: h.name,
        institution: h.institution || 'Mutual Fund AMC',
        folioNumber: hFolio,
        isin: hIsin,
        category: 'Mutual Funds',
        owner: detectedOwner || 'Nozel Rosario',
        nominee: '',
        status: 'new',
        statusLabel: 'New Holding Detected',
        isActionable: true,
        // Units
        oldUnits: 0,
        newUnits: hUnits,
        unitsDelta: hUnits,
        // NAV
        oldNav: 0,
        statementNav: hNav,
        liveNav: null,
        effectiveNav: hNav,
        // Cost
        oldCost: 0,
        newCost: hCost,
        costDelta: hCost,
        // Valuation
        oldCurrentValue: 0,
        newCurrentValue: effectiveCurrentVal,
        valuationDelta: effectiveCurrentVal,
        existingDetails: {}
      });
    }
  }

  // Check for database mutual funds that were completely absent from the statement
  for (const asset of mfAssets) {
    if (!matchedExistingIds.has(asset['Asset ID'])) {
      let details = {};
      try {
        details = typeof asset['Details JSON'] === 'string' ? JSON.parse(asset['Details JSON']) : (asset['Details JSON'] || {});
      } catch(e) {}

      const currentVal = Number(asset['Current Value']) || 0;
      const units = Number(details.Units) || 0;

      if (units > 0) {
        candidates.push({
          id: `CAS_ABSENT_${asset['Asset ID']}`,
          isExisting: true,
          assetId: asset['Asset ID'],
          name: asset.Name,
          institution: asset['Institution/Location'] || 'Mutual Fund',
          folioNumber: asset.Identifiers || details['Folio Number'] || '',
          isin: details.ISIN || '',
          category: asset.Category || 'Mutual Funds',
          owner: asset.Owner || 'Single',
          status: 'absent',
          statusLabel: 'Not in Statement',
          isActionable: false,
          oldUnits: units,
          newUnits: units,
          unitsDelta: 0,
          oldNav: Number(details['Average NAV']) || 0,
          statementNav: 0,
          effectiveNav: Number(details['Average NAV']) || 0,
          oldCost: Number(asset.Cost) || 0,
          newCost: Number(asset.Cost) || 0,
          costDelta: 0,
          oldCurrentValue: currentVal,
          newCurrentValue: currentVal,
          valuationDelta: 0,
          existingDetails: details
        });
      }
    }
  }

  return {
    candidates: candidates,
    statementMeta: {
      holderName: statementHolderName,
      detectedOwner: detectedOwner,
      statementDate: statementDate
    },
    stats: {
      totalHoldings: holdings.length,
      updatedCount: updatedCount,
      newCount: newCount,
      sipsCreditedCount: sipsCreditedCount,
      totalStatementValue: Math.round(totalStatementValue * 100) / 100,
      totalInvestedCost: Math.round(totalInvestedCost * 100) / 100,
      totalValuationDelta: Math.round(totalValuationDelta * 100) / 100,
      actionableCount: candidates.filter(c => c.isActionable).length
    }
  };
}
