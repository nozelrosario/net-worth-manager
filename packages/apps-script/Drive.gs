function getFamilySafeFolder() {
  var folderName = "Family Safe";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

function uploadFileToDrive(base64Data, fileName, mimeType, idToken) {
  try {
    var auth = assertWriteAccess(idToken);
    if (!auth.allowed) return { status: 'error', message: auth.message };
    
    var folder = getFamilySafeFolder();
    
    var base64Str = base64Data;
    if (base64Data.indexOf(',') !== -1) {
      base64Str = base64Data.split(',')[1];
    }
    
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Str), mimeType, fileName);
    var file = folder.createFile(blob);
    
    // Allow anyone with the link to view the file
    // file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
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
