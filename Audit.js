var AuditLog = {
  SHEET_NAME: 'AUDIT_LOGS',
  HEADERS: ['Timestamp', 'User', 'Action', 'Payload'],

  record: function(action, payload, actorEmail, options) {
    var lock = null;
    var lockHeld = options && options.lockHeld;
    try {
      if (!lockHeld) {
        lock = LockService.getScriptLock();
        lock.waitLock(10000);
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      if (!spreadsheet) throw new Error('The active spreadsheet is unavailable for audit logging.');
      var sheet = spreadsheet.getSheetByName(this.SHEET_NAME);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(this.SHEET_NAME);
        sheet.getRange(1, 1, 1, this.HEADERS.length).setValues([this.HEADERS]);
        sheet.setFrozenRows(1);
      }

      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) {
        return String(value === null || value === undefined ? '' : value).trim();
      });
      var indexes = this.HEADERS.map(function(header) { return headers.indexOf(header); });
      if (indexes.some(function(index) { return index < 0; })) {
        throw new Error('AUDIT_LOGS must contain Timestamp, User, Action, and Payload columns.');
      }

      var details = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
      var row = headers.map(function() { return ''; });
      row[indexes[0]] = new Date();
      row[indexes[1]] = actorEmail || '';
      row[indexes[2]] = String(action || 'UNKNOWN');
      row[indexes[3]] = details;
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    } finally {
      if (lock) lock.releaseLock();
    }
  }
};
