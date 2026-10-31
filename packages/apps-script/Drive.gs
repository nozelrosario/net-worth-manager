function getFolderByPath(pathArray) {
  var folder = DriveApp.getRootFolder();
  for (var i = 0; i < pathArray.length; i++) {
    var folders = folder.getFoldersByName(pathArray[i]);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = folder.createFolder(pathArray[i]);
    }
  }
  return folder;
}

function uploadFileToDrive(base64Data, fileName, mimeType, category, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };
    
    // Determine environment based on the connected Spreadsheet name
    var ss = getSpreadsheet();
    var ssName = ss.getName();
    var env = ssName.toUpperCase().indexOf('UAT') !== -1 ? 'UAT' : 'PROD';
    var safeCategory = category || 'Uncategorized';
    
    // Folder Structure: Drive Root -> Net Worth Manager -> [PROD|UAT] -> Family Safe -> [Category]
    var path = ['Net Worth Manager', env, 'Family Safe', safeCategory];
    var folder = getFolderByPath(path);
    
    var base64Str = base64Data;
    if (base64Data.indexOf(',') !== -1) {
      base64Str = base64Data.split(',')[1];
    }
    
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Str), mimeType, fileName);
    var file = folder.createFile(blob);
    
    return {
      status: 'success',
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: file.getName(),
      mimeType: file.getMimeType()
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}
// redeploy after auth

function deleteSafeDocument(documentId, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };
    
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Safe');
    if (!sheet) return { status: 'error', message: 'Safe sheet not found' };
    
    var data = sheet.getDataRange().getValues();
    var idColIndex = data[0].indexOf('Document ID');
    var filesColIndex = data[0].indexOf('Files JSON');
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(documentId)) {
        var filesJson = data[i][filesColIndex];
        if (filesJson) {
          try {
            var files = JSON.parse(filesJson);
            for (var j = 0; j < files.length; j++) {
              if (files[j].id && !files[j].isLink) {
                var driveFile = DriveApp.getFileById(files[j].id);
                driveFile.setTrashed(true);
              }
            }
          } catch(e) {
            // Ignore parse errors or trash errors
          }
        }
        
        // Delete record using existing function
        return deleteRecord('Safe', 'Document ID', documentId, idToken);
      }
    }
    
    return { status: 'error', message: 'Document not found' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function trashDriveFile(fileId, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };
    if (!fileId) return { status: 'error', message: 'Missing file ID' };
    
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return { status: 'success', message: 'File moved to Trash' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Scans Google Drive for SMS Backup & Restore XML files.
 * Identifies the configured folder (defaults to 'SMSBackupRestore'),
 * locates the most recent .xml backup file, and returns file metadata + content.
 */
function scanDriveForSmsBackup(folderName, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };

    var targetFolder = folderName || 'SMSBackupRestore';
    var folders = DriveApp.getFoldersByName(targetFolder);
    var folder = null;

    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      // Check Net Worth Manager subfolders
      var nwmFolders = DriveApp.getFoldersByName('Net Worth Manager');
      if (nwmFolders.hasNext()) {
        var nwm = nwmFolders.next();
        var subFolders = nwm.getFoldersByName('SMS Backups');
        if (subFolders.hasNext()) {
          folder = subFolders.next();
        }
      }
    }

    if (!folder) {
      return {
        status: 'not_found',
        message: 'Google Drive folder "' + targetFolder + '" was not found. Please ensure the backup app has exported to this folder.'
      };
    }

    var files = folder.getFiles();
    var latestFile = null;
    var latestDate = 0;
    var totalXmlFiles = 0;

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      if (name.toLowerCase().indexOf('.xml') !== -1) {
        totalXmlFiles++;
        var updated = file.getLastUpdated().getTime();
        if (updated > latestDate) {
          latestDate = updated;
          latestFile = file;
        }
      }
    }

    if (!latestFile) {
      return {
        status: 'no_backups',
        message: 'No .xml backup files found in Drive folder "' + folder.getName() + '".'
      };
    }

    var content = latestFile.getBlob().getDataAsString();

    return {
      status: 'success',
      folderName: folder.getName(),
      fileName: latestFile.getName(),
      fileSize: latestFile.getSize(),
      lastModified: latestFile.getLastUpdated().toISOString(),
      totalXmlFiles: totalXmlFiles,
      xmlContent: content
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Batch imports verified SMS transactions into the Transactions sheet
 * and updates the SmsLastProcessedDate in the Settings sheet.
 */
function batchImportSmsTransactions(transactions, lastProcessedEpoch, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };

    if (!transactions || !transactions.length) {
      return { status: 'error', message: 'No transactions provided for import.' };
    }

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Transactions');
    if (!sheet) {
      setupDatabaseSheets();
      sheet = ss.getSheetByName('Transactions');
      if (!sheet) return { status: 'error', message: 'Transactions sheet not found' };
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var rowsToAdd = [];

    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      var row = [];
      var txnId = t['Txn ID'] || ('TXN_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase());

      for (var h = 0; h < headers.length; h++) {
        var header = headers[h];
        var hClean = String(header || '').trim();
        var hLower = hClean.toLowerCase();

        if (hLower === 'txnid' || hLower === 'txn id' || hLower === 'id') {
          row.push(txnId);
        } else if (hLower === 'date' || hLower === 'transaction date' || hLower === 'txndate') {
          var dVal = t.Date || t.dateStr || t.date || '';
          if (!dVal && t.rawDate) {
            var dNum = Number(t.rawDate);
            if (!isNaN(dNum)) {
              if (dNum < 10000000000) dNum *= 1000;
              var dObj = new Date(dNum);
              if (!isNaN(dObj.getTime())) {
                dVal = dObj.getFullYear() + '-' + ('0' + (dObj.getMonth() + 1)).slice(-2) + '-' + ('0' + dObj.getDate()).slice(-2);
              }
            }
          }
          if (!dVal) {
            dVal = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
          }
          row.push(dVal);
        } else if (hLower === 'type') {
          row.push(t.Type || t.type || 'Expense');
        } else if (hLower === 'amount') {
          row.push(Number(t.Amount || t.amount || 0));
        } else if (hLower === 'category') {
          row.push(t.Category || t.category || 'General');
        } else if (hLower === 'account/card' || hLower === 'account' || hLower === 'card') {
          row.push(t['Account/Card'] || t.account || '');
        } else if (hLower === 'merchant/description' || hLower === 'merchant' || hLower === 'description') {
          row.push(t['Merchant/Description'] || t.payee || t.merchant || '');
        } else if (hLower === 'tags' || hLower === 'tag') {
          row.push(t.Tags || t.tags || 'SMS Ingestion');
        } else if (hLower === 'is transfer' || hLower === 'istransfer' || hLower === 'transfer') {
          row.push(t['Is Transfer'] !== undefined ? t['Is Transfer'] : (t.isTransfer || false));
        } else if (hLower === 'split json' || hLower === 'split') {
          row.push(t['Split JSON'] || t.splitJson || '');
        } else if (hLower === 'beneficiary') {
          row.push(t.Beneficiary || t.beneficiary || '');
        } else if (hLower === 'notes' || hLower === 'note') {
          row.push(t.Notes || t.notes || '');
        } else {
          row.push(t[header] !== undefined ? t[header] : (t[hClean] !== undefined ? t[hClean] : ''));
        }
      }
      rowsToAdd.push(row);
    }

    if (rowsToAdd.length > 0) {
      for (var r = 0; r < rowsToAdd.length; r++) {
        sheet.appendRow(rowsToAdd[r]);
      }
      SpreadsheetApp.flush();
    }

    // Update Settings sheet with lastProcessedEpoch (only if non-zero watermark provided)
    if (lastProcessedEpoch && Number(lastProcessedEpoch) > 0) {
      upsertSetting('SmsLastProcessedDate', String(lastProcessedEpoch), idToken);
    }

    logAudit(ss, auth.userInfo.activeEmail, 'BATCH_IMPORT_SMS', 'Transactions', 'Imported ' + rowsToAdd.length + ' transactions via SMS ingestion');

    return {
      status: 'success',
      importedCount: rowsToAdd.length,
      message: 'Successfully imported ' + rowsToAdd.length + ' transactions.'
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Appends SMS fingerprint hashes to the SmsIgnoredHashes registry in Settings sheet.
 */
function ignoreSmsTransactions(hashes, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };

    if (!hashes || !hashes.length) {
      return { status: 'error', message: 'No transaction hashes provided to ignore.' };
    }

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) {
      setupDatabaseSheets();
      sheet = ss.getSheetByName('Settings');
      if (!sheet) return { status: 'error', message: 'Settings sheet not found' };
    }

    var data = sheet.getDataRange().getValues();
    var keyCol = data[0].indexOf('Setting Key');
    var valCol = data[0].indexOf('Setting Value');
    if (keyCol === -1 || valCol === -1) return { status: 'error', message: 'Invalid Settings sheet format' };

    var existingHashes = [];
    var rowIdx = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][keyCol]) === 'SmsIgnoredHashes') {
        rowIdx = i + 1;
        try {
          var parsed = JSON.parse(data[i][valCol]);
          if (Array.isArray(parsed)) existingHashes = parsed;
        } catch (e) {}
        break;
      }
    }

    var hashSet = {};
    for (var j = 0; j < existingHashes.length; j++) {
      hashSet[existingHashes[j]] = true;
    }

    var addedCount = 0;
    for (var k = 0; k < hashes.length; k++) {
      var h = String(hashes[k]).trim();
      if (h && !hashSet[h]) {
        existingHashes.push(h);
        hashSet[h] = true;
        addedCount++;
      }
    }

    var jsonStr = JSON.stringify(existingHashes);
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, valCol + 1).setValue(jsonStr);
    } else {
      var newRow = [];
      newRow[keyCol] = 'SmsIgnoredHashes';
      newRow[valCol] = jsonStr;
      sheet.appendRow(newRow);
    }

    logAudit(ss, auth.userInfo.activeEmail, 'IGNORE_SMS_TXN', 'Settings', 'Ignored ' + addedCount + ' SMS transactions');

    return {
      status: 'success',
      addedCount: addedCount,
      totalIgnored: existingHashes.length,
      ignoredHashes: existingHashes
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Removes an SMS fingerprint hash from the SmsIgnoredHashes registry in Settings sheet.
 */
function unignoreSmsTransaction(hash, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };

    if (!hash) return { status: 'error', message: 'No transaction hash provided to restore.' };

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) return { status: 'error', message: 'Settings sheet not found' };

    var data = sheet.getDataRange().getValues();
    var keyCol = data[0].indexOf('Setting Key');
    var valCol = data[0].indexOf('Setting Value');
    if (keyCol === -1 || valCol === -1) return { status: 'error', message: 'Invalid Settings sheet format' };

    var existingHashes = [];
    var rowIdx = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][keyCol]) === 'SmsIgnoredHashes') {
        rowIdx = i + 1;
        try {
          var parsed = JSON.parse(data[i][valCol]);
          if (Array.isArray(parsed)) existingHashes = parsed;
        } catch (e) {}
        break;
      }
    }

    if (rowIdx === -1) {
      return { status: 'success', totalIgnored: 0, ignoredHashes: [] };
    }

    var target = String(hash).trim();
    var updated = existingHashes.filter(function(h) { return h !== target; });
    var jsonStr = JSON.stringify(updated);
    sheet.getRange(rowIdx, valCol + 1).setValue(jsonStr);

    logAudit(ss, auth.userInfo.activeEmail, 'UNIGNORE_SMS_TXN', 'Settings', 'Restored SMS transaction ' + target);

    return {
      status: 'success',
      restoredHash: target,
      totalIgnored: updated.length,
      ignoredHashes: updated
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}


/**
 * Scans Google Drive for CAS Consolidated Account Statement PDF files.
 * Identifies the configured folder (defaults to 'Net Worth Manager/CAS Imports' or 'CAS Imports'),
 * locates the most recent .pdf backup file, and returns file metadata + Base64 content.
 */
function scanDriveForCas(folderPathOrName, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };

    var target = folderPathOrName || 'Net Worth Manager/CAS Imports';
    var folder = null;

    if (target.indexOf('/') !== -1) {
      var parts = target.split('/').map(function(s) { return s.trim(); }).filter(Boolean);
      folder = getFolderByPath(parts);
    } else {
      var folders = DriveApp.getFoldersByName(target);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        // Fallback: check Net Worth Manager subfolders
        var nwmFolders = DriveApp.getFoldersByName('Net Worth Manager');
        if (nwmFolders.hasNext()) {
          var nwm = nwmFolders.next();
          var subFolders = nwm.getFoldersByName(target);
          if (subFolders.hasNext()) {
            folder = subFolders.next();
          } else {
            // Also check 'CAS Imports'
            var casSub = nwm.getFoldersByName('CAS Imports');
            if (casSub.hasNext()) {
              folder = casSub.next();
            }
          }
        }
      }
    }

    if (!folder) {
      return {
        status: 'not_found',
        message: 'Google Drive folder "' + target + '" was not found. Please create this folder or drop your CAS statement PDF into it.'
      };
    }

    var files = folder.getFiles();
    var latestFile = null;
    var latestDate = 0;
    var totalPdfFiles = 0;

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      if (name.toLowerCase().indexOf('.pdf') !== -1) {
        totalPdfFiles++;
        var updated = file.getLastUpdated().getTime();
        if (updated > latestDate) {
          latestDate = updated;
          latestFile = file;
        }
      }
    }

    if (!latestFile) {
      return {
        status: 'no_backups',
        message: 'No .pdf CAS statement files found in Drive folder "' + folder.getName() + '".'
      };
    }

    // Preserve binary stream integrity with Base64 encoding
    var bytes = latestFile.getBlob().getBytes();
    var base64Data = Utilities.base64Encode(bytes);

    return {
      status: 'success',
      folderName: folder.getName(),
      fileName: latestFile.getName(),
      fileSize: latestFile.getSize(),
      lastModified: latestFile.getLastUpdated().toISOString(),
      lastModifiedEpoch: latestDate,
      totalPdfFiles: totalPdfFiles,
      base64Data: base64Data
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Batch synchronizes reconciled CAS mutual fund assets into the Assets sheet in a single flush.
 * Updates units, cost base, live valuations, and registers quotes in MarketQuotes.
 */
function batchSyncCasAssets(assetsToUpdate, assetsToInsert, statementDate, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Assets');
    if (!sheet) {
      setupDatabaseSheets();
      sheet = ss.getSheetByName('Assets');
      if (!sheet) return { status: 'error', message: 'Assets sheet not found' };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = headers.indexOf('Asset ID');
    var costCol = headers.indexOf('Cost');
    var valCol = headers.indexOf('Current Value');
    var detailsCol = headers.indexOf('Details JSON');
    var nameCol = headers.indexOf('Name');
    var catCol = headers.indexOf('Category');
    var identCol = headers.indexOf('Identifiers');
    var instCol = headers.indexOf('Institution/Location');

    // Build map of existing Asset ID to 1-based row index in sheet
    var rowMap = {};
    for (var r = 1; r < data.length; r++) {
      var aid = String(data[r][idCol] || '').trim();
      if (aid) {
        rowMap[aid] = r + 1;
      }
    }

    var updatedCount = 0;
    var insertedCount = 0;

    // 1. Process updates in existing asset rows
    if (assetsToUpdate && assetsToUpdate.length > 0) {
      for (var u = 0; u < assetsToUpdate.length; u++) {
        var item = assetsToUpdate[u];
        var targetAssetId = String(item['Asset ID'] || '').trim();
        var rowIdx = rowMap[targetAssetId];
        if (rowIdx) {
          var existingRow = data[rowIdx - 1];
          var existingDetailsRaw = detailsCol !== -1 ? existingRow[detailsCol] : '{}';
          var existingDetails = {};
          try {
            existingDetails = typeof existingDetailsRaw === 'string' ? JSON.parse(existingDetailsRaw || '{}') : (existingDetailsRaw || {});
          } catch(e) {}

          var newDetails = typeof item['Details JSON'] === 'string' ? JSON.parse(item['Details JSON'] || '{}') : (item['Details JSON'] || {});
          for (var k in newDetails) {
            existingDetails[k] = newDetails[k];
          }
          if (statementDate) {
            existingDetails['Statement Date'] = statementDate;
          }
          existingDetails['Last Synced Date'] = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');

          // Update Current Value
          if (valCol !== -1 && item['Current Value'] !== undefined) {
            sheet.getRange(rowIdx, valCol + 1).setValue(Number(item['Current Value']) || 0);
          }
          // Update Cost Base
          if (costCol !== -1 && item['Cost'] !== undefined) {
            sheet.getRange(rowIdx, costCol + 1).setValue(Number(item['Cost']) || 0);
          }
          // Update Details JSON
          if (detailsCol !== -1) {
            sheet.getRange(rowIdx, detailsCol + 1).setValue(JSON.stringify(existingDetails));
          }
          // Update Identifiers (Folio) if provided and empty
          if (identCol !== -1 && item['Identifiers'] && !existingRow[identCol]) {
            sheet.getRange(rowIdx, identCol + 1).setValue(item['Identifiers']);
          }
          // Update Institution if empty
          if (instCol !== -1 && item['Institution/Location'] && !existingRow[instCol]) {
            sheet.getRange(rowIdx, instCol + 1).setValue(item['Institution/Location']);
          }

          updatedCount++;
        }
      }
    }

    // 2. Process new asset insertions
    if (assetsToInsert && assetsToInsert.length > 0) {
      for (var i = 0; i < assetsToInsert.length; i++) {
        var ins = assetsToInsert[i];
        var newRow = [];
        var newAssetId = ins['Asset ID'] || ('AST_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase());

        var insDetails = typeof ins['Details JSON'] === 'string' ? JSON.parse(ins['Details JSON'] || '{}') : (ins['Details JSON'] || {});
        if (statementDate) {
          insDetails['Statement Date'] = statementDate;
        }
        insDetails['Last Synced Date'] = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');
        if (insDetails['Live Tracking'] === undefined) {
          insDetails['Live Tracking'] = true;
        }

        for (var h = 0; h < headers.length; h++) {
          var header = headers[h];
          var hClean = String(header || '').trim();

          if (hClean === 'Asset ID') {
            newRow.push(newAssetId);
          } else if (hClean === 'Type') {
            newRow.push(ins.Type || 'Investment');
          } else if (hClean === 'Name') {
            newRow.push(ins.Name || 'Mutual Fund Scheme');
          } else if (hClean === 'Category') {
            newRow.push(ins.Category || 'Mutual Funds');
          } else if (hClean === 'Owner') {
            newRow.push(ins.Owner || auth.userInfo.activeEmail || 'Single');
          } else if (hClean === 'Status') {
            newRow.push(ins.Status || 'Active');
          } else if (hClean === 'Acquisition Date') {
            newRow.push(ins['Acquisition Date'] || statementDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd'));
          } else if (hClean === 'Cost') {
            newRow.push(Number(ins.Cost) || 0);
          } else if (hClean === 'Current Value') {
            newRow.push(Number(ins['Current Value']) || 0);
          } else if (hClean === 'Institution/Location') {
            newRow.push(ins['Institution/Location'] || '');
          } else if (hClean === 'Identifiers') {
            newRow.push(ins.Identifiers || '');
          } else if (hClean === 'Nominee') {
            newRow.push(ins.Nominee || '');
          } else if (hClean === 'Nominee %') {
            newRow.push(ins['Nominee %'] || '');
          } else if (hClean === 'Details JSON') {
            newRow.push(JSON.stringify(insDetails));
          } else {
            newRow.push(ins[hClean] !== undefined ? ins[hClean] : '');
          }
        }
        sheet.appendRow(newRow);
        insertedCount++;

        // Auto-register in MarketQuotes
        try {
          var schemeCode = insDetails['Scheme Code'];
          var isin = insDetails['ISIN'];
          var symbolToTrack = schemeCode || isin;
          if (symbolToTrack) {
            registerMarketQuote(ss, symbolToTrack, 'Mutual Funds', ins.Name);
          }
        } catch(eQuote) {}
      }
    }

    SpreadsheetApp.flush();

    // 3. Update watermark in Settings
    if (statementDate) {
      upsertSetting('CasLastProcessedDate', String(statementDate), idToken);
    }

    logAudit(ss, auth.userInfo.activeEmail, 'BATCH_SYNC_CAS', 'Assets', 'Synchronized ' + (updatedCount + insertedCount) + ' mutual fund holdings (' + updatedCount + ' updated, ' + insertedCount + ' inserted)');

    return {
      status: 'success',
      updatedCount: updatedCount,
      insertedCount: insertedCount,
      message: 'Successfully synchronized ' + (updatedCount + insertedCount) + ' holdings (' + updatedCount + ' updated, ' + insertedCount + ' new added).'
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Backend fallback for executing Gemini generative requests via Apps Script UrlFetchApp.
 * Avoids browser CORS and client environment limitations.
 * Supports both Google Interactions API (/v1beta/interactions with gemini-3.8-flash)
 * and generateContent without deprecated parameters.
 */
function executeGeminiPromptBackend(promptInput, apiKey, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };

    var keyToUse = (apiKey || '').trim();
    if (!keyToUse) {
      keyToUse = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
    }
    if (!keyToUse) {
      return { status: 'error', message: 'Gemini API Key missing.' };
    }

    var cleanPrompt = '';
    if (typeof promptInput === 'string') {
      try {
        var parsed = JSON.parse(promptInput);
        if (parsed && parsed.contents && parsed.contents[0] && parsed.contents[0].parts) {
          cleanPrompt = parsed.contents[0].parts.map(function(p) { return p.text || ''; }).join('\n\n');
        } else {
          cleanPrompt = promptInput;
        }
      } catch (e) {
        cleanPrompt = promptInput;
      }
    } else if (promptInput && promptInput.contents) {
      cleanPrompt = promptInput.contents[0].parts.map(function(p) { return p.text || ''; }).join('\n\n');
    } else {
      cleanPrompt = String(promptInput || '');
    }

    Logger.log('executeGeminiPromptBackend: cleanPrompt length = ' + cleanPrompt.length);

    var requests = [
      {
        label: 'Gemini 3.5 Flash Lite (generateContent v1beta)',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + encodeURIComponent(keyToUse),
        payload: {
          contents: [{ parts: [{ text: cleanPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }
      },
      {
        label: 'Gemini 3.8 Flash (generateContent v1beta)',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + encodeURIComponent(keyToUse),
        payload: {
          contents: [{ parts: [{ text: cleanPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingLevel: 'low'
            }
          }
        }
      },
      {
        label: 'Gemini 3.8 Flash (generateContent v1)',
        url: 'https://generativelanguage.googleapis.com/v1/models/gemini-3.8-flash:generateContent?key=' + encodeURIComponent(keyToUse),
        payload: {
          contents: [{ parts: [{ text: cleanPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }
      },
      {
        label: 'Gemini 3.8 Flash (Interactions API)',
        url: 'https://generativelanguage.googleapis.com/v1beta/interactions?key=' + encodeURIComponent(keyToUse),
        payload: {
          model: 'gemini-3.8-flash',
          input: cleanPrompt,
          generation_config: {
            thinking_level: 'low'
          }
        }
      }
    ];

    var lastErr = null;
    for (var i = 0; i < requests.length; i++) {
      try {
        Logger.log('executeGeminiPromptBackend: Attempting ' + requests[i].label + '...');
        var response = UrlFetchApp.fetch(requests[i].url, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-goog-api-key': keyToUse },
          payload: JSON.stringify(requests[i].payload),
          muteHttpExceptions: true
        });

        var code = response.getResponseCode();
        var respText = response.getContentText();

        if (code === 200) {
          var respJson = JSON.parse(respText);
          var candidateText = null;

          // Check standard generateContent candidates structure
          if (respJson && respJson.candidates && respJson.candidates[0] && respJson.candidates[0].content && respJson.candidates[0].content.parts) {
            candidateText = respJson.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('');
          }
          // Check interactions API steps array
          if (!candidateText && respJson && respJson.steps && respJson.steps.length) {
            for (var si = 0; si < respJson.steps.length; si++) {
              var step = respJson.steps[si];
              if (step.type === 'model_output' && step.content && step.content.length) {
                for (var ci = 0; ci < step.content.length; ci++) {
                  if (step.content[ci].type === 'text' && step.content[ci].text) {
                    candidateText = step.content[ci].text;
                    break;
                  }
                }
              }
              if (candidateText) break;
            }
          }
          if (!candidateText && respJson && respJson.output_text) {
            candidateText = respJson.output_text;
          }

          if (candidateText) {
            Logger.log('executeGeminiPromptBackend: ' + requests[i].label + ' succeeded with ' + candidateText.length + ' chars');
            return {
              status: 'success',
              endpointUsed: requests[i].label,
              rawText: candidateText
            };
          } else {
            Logger.log('executeGeminiPromptBackend: ' + requests[i].label + ' returned HTTP 200 but candidateText was empty: ' + respText.substring(0, 300));
            lastErr = requests[i].label + ' returned HTTP 200 but candidateText was empty';
          }
        } else {
          Logger.log('executeGeminiPromptBackend: ' + requests[i].label + ' returned HTTP ' + code + ': ' + respText.substring(0, 300));
          lastErr = requests[i].label + ' returned ' + code + ': ' + respText;
          if (code === 429) {
            Utilities.sleep(500);
          }
          continue;
        }
      } catch (callErr) {
        Logger.log('executeGeminiPromptBackend: Exception on ' + requests[i].label + ': ' + callErr.message);
        lastErr = callErr.message;
        if (callErr.message && (callErr.message.indexOf('script.external_request') !== -1 || callErr.message.indexOf('UrlFetchApp') !== -1)) {
          return {
            status: 'error',
            message: 'You do not have permission to call UrlFetchApp.fetch. Required permissions: https://www.googleapis.com/auth/script.external_request. Please open the Apps Script project editor, run "authorizeScriptPermissions", and click "Review permissions" -> "Allow".'
          };
        }
      }
    }

    return { status: 'error', message: 'All Gemini model endpoints failed. ' + lastErr };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}
