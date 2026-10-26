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
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAdd.length, headers.length).setValues(rowsToAdd);
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

