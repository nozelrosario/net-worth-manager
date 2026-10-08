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
