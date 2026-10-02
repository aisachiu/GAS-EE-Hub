var AuditLog = {
  getSheetName: function() { return APP_TABLES.auditLogs.sheet; },
  getHeaders: function() { return getTableHeaders_('auditLogs'); },

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
      var sheetName = this.getSheetName();
      var expectedHeaders = this.getHeaders();
      var sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        sheet.setFrozenRows(1);
      }

      assertSheetSchema_(sheet, 'auditLogs');
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) {
        return String(value === null || value === undefined ? '' : value).trim();
      });
      var indexes = expectedHeaders.map(function(header) { return headers.indexOf(header); });
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

var ACTIVITY_FEED_LIMIT = 200;
var ACTIVITY_TITLES = {
  LOGIN_SUCCESS: 'Signed in',
  ACCESS_DENIED: 'Could not open something',
  ADD_STUDENT_TODO: 'Added a to-do',
  UPDATE_STUDENT_TODO: 'Edited a to-do',
  SET_ACTION_ITEM_DUE_DATE: 'Changed a due date',
  REPOSITION_STUDENT_TODO: 'Moved a to-do',
  UPDATE_ACTION_ITEM_STATUS: 'Updated a task',
  FORM_SUBMIT: 'Submitted a form',
  FORM_DRAFT: 'Saved a form draft',
  TICKET_CREATE: 'Asked a question',
  TICKET_REPLY: 'Sent a reply',
  TICKET_READ: 'Opened a reply',
  TICKET_STATUS: 'Changed a question status',
  SAVE_COHORT_DRIVE_SETTINGS: 'Saved cohort Drive settings',
  CHECK_COHORT_DRIVE_FOLDERS: 'Checked student Drive folders',
  SYNC_COHORT_DRIVE_FOLDERS: 'Updated student Drive folders'
};

function activityFeedForActor_(actorEmail) {
  var email = normalizeEmail_(actorEmail);
  if (!email) return emptyActivityFeed_('');
  var entries = collapsedActivityForActor_(email);
  var shown = entries.slice(0, ACTIVITY_FEED_LIMIT);
  return {
    actor: email,
    total: entries.length,
    truncated: entries.length > shown.length,
    counts: activityCounts_(shown),
    entries: shown
  };
}

function emptyActivityFeed_(email) {
  return { actor: email, total: 0, truncated: false, counts: activityCounts_([]), entries: [] };
}

function collapsedActivityForActor_(email) {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.auditLogs.sheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  assertSheetSchema_(sheet, 'auditLogs');
  var lookups = activityLookups_(email);
  var collapsed = [];
  readRecords_(sheet).forEach(function(record) {
    if (normalizeEmail_(record.User) !== email) return;
    var parsed = presentActivity_(record, lookups);
    var previous = collapsed.length ? collapsed[collapsed.length - 1] : null;
    if (previous && previous.phase === 'REQUESTED' && (parsed.phase === 'SUCCEEDED' || parsed.phase === 'FAILED') && previous.action === parsed.action) {
      collapsed[collapsed.length - 1] = parsed;
      return;
    }
    collapsed.push(parsed);
  });
  collapsed.reverse();
  collapsed.forEach(function(entry, index) {
    entry.id = 'activity-' + index;
    delete entry.phase;
  });
  return collapsed;
}

function activityLookups_(email) {
  var templates = {};
  var tasks = {};
  try {
    readTemplates_().forEach(function(template) { templates[template.milestoneId] = template.title; });
  } catch (error) { /* titles are optional */ }
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.studentActionItems.sheet);
  if (sheet && sheet.getLastRow() > 1) {
    readRecords_(sheet).forEach(function(item) {
      if (normalizeEmail_(item.StudentId) !== email) return;
      var taskId = text_(item.TaskId);
      var title = text_(item.Title);
      if (taskId) tasks[taskId] = title;
      var templateId = text_(item.TemplateId);
      if (templateId && title && !templates[templateId]) templates[templateId] = title;
    });
  }
  return { templates: templates, tasks: tasks };
}

function presentActivity_(record, lookups) {
  var rawAction = text_(record.Action) || 'UNKNOWN';
  var phase = '';
  var action = rawAction;
  ['REQUESTED', 'SUCCEEDED', 'FAILED'].forEach(function(suffix) {
    var marker = '_' + suffix;
    if (rawAction.length > marker.length && rawAction.slice(-marker.length) === marker) {
      phase = suffix;
      action = rawAction.slice(0, -marker.length);
    }
  });
  var unpacked = unpackActivityPayload_(record.Payload);
  var outcome = activityOutcome_(phase, action);
  var taskTitle = lookups.tasks[text_(unpacked.payload.taskId)] || '';
  var milestoneTitle = lookups.templates[text_(unpacked.payload.milestoneId)] || lookups.templates[text_(unpacked.payload.templateId)] || '';
  return {
    at: record.Timestamp ? String(serializable_(record.Timestamp)) : '',
    action: action,
    phase: phase,
    outcome: outcome,
    kind: activityKind_(action),
    title: activityTitle_(action),
    summary: activitySummary_(action, unpacked, taskTitle, milestoneTitle, outcome),
    details: activityDetails_(unpacked, taskTitle, milestoneTitle, lookups)
  };
}

function unpackActivityPayload_(value) {
  var payload = parseActivityPayload_(value);
  var reason = text_(payload.reason);
  if (payload.detail && typeof payload.detail === 'object' && !Array.isArray(payload.detail)) {
    payload = payload.detail;
  }
  return { payload: payload, reason: reason };
}

function parseActivityPayload_(value) {
  if (value && typeof value === 'object') return value;
  var raw = text_(value);
  if (!raw) return {};
  if (raw.charAt(0) !== '{' && raw.charAt(0) !== '[') return { note: raw.slice(0, 500) };
  try {
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { note: raw.slice(0, 500) };
    return parsed;
  } catch (error) {
    return { note: raw.slice(0, 500) };
  }
}

function activityOutcome_(phase, action) {
  if (phase === 'FAILED' || action === 'ACCESS_DENIED') return 'failed';
  if (phase === 'REQUESTED') return 'started';
  if (action === 'LOGIN_SUCCESS' || action === 'TICKET_READ') return 'info';
  return 'done';
}

function activityKind_(action) {
  if (action === 'LOGIN_SUCCESS' || action === 'ACCESS_DENIED') return 'sign-in';
  if (action.indexOf('FORM_') === 0) return 'form';
  if (action.indexOf('TICKET_') === 0) return 'question';
  if (action.indexOf('TODO') >= 0 || action === 'SET_ACTION_ITEM_DUE_DATE' || action === 'UPDATE_ACTION_ITEM_STATUS' || action === 'REPOSITION_STUDENT_TODO') return 'task';
  return 'other';
}

function activityTitle_(action) {
  if (ACTIVITY_TITLES[action]) return ACTIVITY_TITLES[action];
  var words = String(action || '').toLowerCase().split('_').filter(Boolean);
  if (!words.length) return 'Activity';
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
}

function activitySummary_(action, unpacked, taskTitle, milestoneTitle, outcome) {
  if (outcome === 'failed' && unpacked.reason) return unpacked.reason;
  var payload = unpacked.payload;
  if (action === 'LOGIN_SUCCESS') return 'Opened the EE Hub';
  if (action === 'ACCESS_DENIED') return unpacked.reason || 'The EE Hub blocked this action';
  if (action === 'ADD_STUDENT_TODO') return 'Personal to-do';
  if (action === 'UPDATE_STUDENT_TODO' || action === 'SET_ACTION_ITEM_DUE_DATE' || action === 'REPOSITION_STUDENT_TODO') return taskTitle || 'Personal to-do';
  if (action === 'UPDATE_ACTION_ITEM_STATUS') {
    var status = text_(payload.status);
    if (taskTitle && status) return taskTitle + ' · ' + status;
    return taskTitle || status || 'Task status';
  }
  if (action === 'FORM_SUBMIT' || action === 'FORM_DRAFT') return milestoneTitle || text_(payload.milestoneId) || 'Form';
  if (action.indexOf('TICKET_') === 0) return text_(payload.category) || 'Help question';
  return milestoneTitle || taskTitle || '';
}

function activityDetails_(unpacked, taskTitle, milestoneTitle, lookups) {
  var payload = unpacked.payload;
  var rows = [];
  function add(label, value) {
    var clean = Array.isArray(value) ? value.map(function(item) { return text_(item); }).filter(Boolean).join(', ') : text_(value);
    if (!clean) return;
    rows.push({ label: label, value: clean });
  }
  add('Milestone', milestoneTitle);
  add('Task', taskTitle || payload.taskId);
  var beside = lookups.tasks[text_(payload.targetTaskId)] || '';
  add('Placed beside', beside);
  if (text_(payload.position)) add('Placement', text_(payload.position) === 'before' ? 'Before that task' : 'After that task');
  add('Status', payload.status);
  add('Category', payload.category);
  add('Sent to', activityRouteLabel_(payload.route));
  add('Phase', payload.phaseId || payload.phase);
  add('Cohort', payload.cohort);
  add('Fields', payload.fields);
  if (payload.version !== undefined && payload.version !== '') add('Form version', payload.version);
  add('What happened', unpacked.reason);
  add('Note', payload.note);
  return rows;
}

function activityRouteLabel_(route) {
  var value = text_(route).toLowerCase();
  if (value === 'coordinator') return 'EE Coordinator';
  if (value === 'supervisor') return 'Supervisor';
  return text_(route);
}

function activityCounts_(entries) {
  var counts = { all: entries.length, 'sign-in': 0, form: 0, question: 0, task: 0, other: 0 };
  entries.forEach(function(entry) {
    if (!counts.hasOwnProperty(entry.kind)) counts[entry.kind] = 0;
    counts[entry.kind] += 1;
  });
  return counts;
}
