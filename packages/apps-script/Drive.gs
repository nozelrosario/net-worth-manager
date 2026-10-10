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
