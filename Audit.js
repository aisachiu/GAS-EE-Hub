/**
 * AUDIT LOG SERVICE
 * High-efficiency, zero-latency logging using CacheService and batch processing.
 */

const AuditLog = {
  CACHE_KEY: 'VSA_EE_AUDIT_QUEUE',
  SHEET_NAME: 'AUDIT_LOGS',
  
  /**
   * Records an event to the CacheService queue.
   * @param {string} action - The action taking place (e.g., 'LOGIN', 'UPDATE_MILESTONE').
   * @param {string|Object} payload - Details about the action.
   */
  record: function(action, payload) {
    const cache = CacheService.getScriptCache();
    const userEmail = Session.getActiveUser().getEmail();
    const timestamp = new Date().toISOString();
    
    // Ensure payload is a string
    const details = typeof payload === 'object' ? JSON.stringify(payload) : payload;
    
    const logEntry = {
      t: timestamp,
      u: userEmail,
      a: action,
      p: details
    };

    // Lock to prevent concurrency issues when reading/writing to cache
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(3000);
      
      let queue = [];
      const existingQueue = cache.get(this.CACHE_KEY);
      if (existingQueue) {
        queue = JSON.parse(existingQueue);
      }
      
      queue.push(logEntry);
      
      // Store back in cache (max 6 hours, 100KB limit per key, queue shouldn't exceed this before flush)
      cache.put(this.CACHE_KEY, JSON.stringify(queue), 21600); 
      
      // Also log to Stackdriver for immediate developer console visibility
      console.info(`AUDIT: [\({action}]\){userEmail} - ${details}`);
      
    } catch (e) {
      console.error('Failed to write to Audit Cache:', e);
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Flushes the current cache queue to the AUDIT_LOGS sheet.
   * NOTE: This function should be tied to a Time-Driven Trigger (e.g., every 5 minutes).
   */
  flushToSheet: function() {
    const cache = CacheService.getScriptCache();
    const lock = LockService.getScriptLock();
    
    try {
      lock.waitLock(10000); // Wait up to 10 seconds for a lock
      
      const existingQueue = cache.get(this.CACHE_KEY);
      if (!existingQueue) return; // Nothing to flush
      
      const queue = JSON.parse(existingQueue);
      if (queue.length === 0) return;
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(this.SHEET_NAME);
      
      // Create sheet if it doesn't exist
      if (!sheet) {
        sheet = ss.insertSheet(this.SHEET_NAME);
        sheet.appendRow(['Timestamp', 'User', 'Action', 'Payload / Details']);
        sheet.getRange("A1:D1").setFontWeight("bold");
        sheet.setFrozenRows(1);
      }
      
      // Prepare 2D array for fast batch insertion
      const rowsToInsert = queue.map(log => [
        new Date(log.t), 
        log.u, 
        log.a, 
        log.p
      ]);
      
      // Batch write to sheet
      const lastRow = Math.max(sheet.getLastRow(), 1);
      sheet.getRange(lastRow + 1, 1, rowsToInsert.length, 4).setValues(rowsToInsert);
      
      // Clear the cache now that it's safely in the sheet
      cache.remove(this.CACHE_KEY);
      console.log(`Successfully flushed ${rowsToInsert.length} audit logs to sheet.`);
      
    } catch (e) {
      console.error('Failed to flush Audit Logs to sheet:', e);
    } finally {
      lock.releaseLock();
    }
  }
};

/**
 * SETUP FUNCTION: Run this ONCE manually in the editor to create the time-driven trigger.
 */
function setupAuditTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'flushAuditLogsTrigger') {
      return; // Trigger already exists
    }
  }
  
  // Set to run every 5 minutes
  ScriptApp.newTrigger('flushAuditLogsTrigger')
    .timeBased()
    .everyMinutes(5)
    .create();
}

/**
 * Wrapper for the trigger to call the object method.
 */
function flushAuditLogsTrigger() {
  AuditLog.flushToSheet();
}