/**
 * Serves the WebApp page and logs the access.
 * @param {Object} e HTTP request event object.
 * @returns {HtmlOutput} The rendered HTML output for the application.
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  
  // Create a log entry for page load (will be caught and processed async by the UI)
  return template.evaluate()
    .setTitle('VSA EE HUB')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Identifies the active user, dynamically maps their headers, checks their status 
 * in staff and student sheets, and logs the login event.
 * @returns {Object|null} User record object.
 */
function getUserDetails() {
  const activeEmail = Session.getActiveUser().getEmail().trim().toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let userObj = null;

  // 1. Check USERS-STAFF sheet
  const staffSheet = ss.getSheetByName('USERS-STAFF');
  if (staffSheet) {
    const staffData = staffSheet.getDataRange().getValues();
    if (staffData.length > 1) {
      const headers = staffData[0].map(h => String(h).trim());
      const emailCol = headers.indexOf('EMAIL');
      const isStaffCol = headers.indexOf('isStaff');
      
      if (emailCol > -1 && isStaffCol > -1) {
        for (let i = 1; i < staffData.length; i++) {
          const row = staffData[i];
          const email = String(row[emailCol]).trim().toLowerCase();
          
          if (email === activeEmail) {
            if (String(row[isStaffCol]) === '1' || row[isStaffCol] === 1 || String(row[isStaffCol]).toLowerCase() === 'true') {
              userObj = { primaryRole: 'staff', permissions: {} };
              headers.forEach((header, colIndex) => {
                userObj[header] = row[colIndex];
                // Map boolean roles explicitly for easy frontend access
                if (header.startsWith('is')) {
                  userObj.permissions[header] = (String(row[colIndex]) === '1' || row[colIndex] === 1 || String(row[colIndex]).toLowerCase() === 'true');
                }
              });
              break;
            }
          }
        }
      }
    }
  }

  // 2. Check USERS-STUDENTS sheet if not found in Staff
  if (!userObj) {
    const studentSheet = ss.getSheetByName('USERS-STUDENTS');
    if (studentSheet) {
      const studentData = studentSheet.getDataRange().getValues();
      if (studentData.length > 1) {
        const headers = studentData[0].map(h => String(h).trim());
        const emailCol = headers.indexOf('EMAIL');

        if (emailCol > -1) {
          for (let i = 1; i < studentData.length; i++) {
            const row = studentData[i];
            const studentEmail = String(row[emailCol]).trim().toLowerCase();

            if (studentEmail === activeEmail) {
              userObj = { primaryRole: 'student' };
              headers.forEach((header, colIndex) => {
                userObj[header] = row[colIndex];
              });
              break;
            }
          }
        }
      }
    }
  }

  // 3. Log the login event via the high-efficiency Audit System
  if (userObj) {
    const displayName = userObj['Display Name'] || userObj['Student Name'] || activeEmail;
    logEvent('LOGIN', `Successful login by \({userObj.primaryRole}:\){displayName}`);
  } else {
    logEvent('UNAUTHORIZED_ACCESS', `Failed login attempt for email: ${activeEmail}`);
  }

  return userObj;
}

/**
 * Public wrapper for the backend AuditLog service, accessible to frontend google.script.run
 */
function logEvent(action, payload) {
  AuditLog.record(action, payload);
}