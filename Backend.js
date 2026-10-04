var APP_TABLES = {
  cohorts: {
    sheet: 'COHORTS',
    fields: [
      { name: 'Cohort', type: 'text', required: true, key: true },
      { name: 'SheetName', type: 'text', editable: false },
      { name: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      { name: 'DriveRootFolderId', type: 'text', editable: false, table: false, form: false },
      { name: 'FolderPrefix', type: 'text', editable: false, table: false, form: false },
      { name: 'FolderSuffix', type: 'text', editable: false, table: false, form: false }
    ]
  },
  milestoneTemplates: {
    sheet: 'MILESTONE_TEMPLATES',
    fields: [
      { name: 'milestoneId', type: 'text', required: true, key: true },
      { name: 'type', type: 'select', required: true, options: ['form', 'upload', 'doc', 'approval', 'meeting'] },
      { name: 'milestoneTitle', type: 'text', required: true },
      { name: 'offsetDays', type: 'number' },
      { name: 'milestoneDescription', type: 'textarea', table: false },
      { name: 'phase', type: 'select', required: true, optionsFrom: 'phases', optionValue: 'phaseId', optionLabel: 'phaseTitle' },
      { name: 'mOwner', type: 'select', required: true, options: ['student', 'supervisor', 'lead', 'coordinator'], errorMessage: 'Owner must be student, supervisor, lead, or coordinator.' }
    ]
  },
  phases: {
    sheet: 'PHASES',
    fields: [
      { name: 'phaseId', type: 'text', required: true, key: true, validator: 'phaseId' },
      { name: 'phaseTitle', type: 'text', required: true },
      { name: 'phaseDescription', type: 'textarea', table: false },
      { name: 'sequence', type: 'number', required: true },
      { name: 'prerequisitePhaseId', type: 'select', optionsFrom: 'phases', optionValue: 'phaseId', optionLabel: 'phaseTitle', allowBlank: true },
      { name: 'active', type: 'checkbox', defaultValue: true }
    ]
  },
  studentUsers: {
    sheet: 'USERS-STUDENTS',
    fields: [
      { name: 'StudentId', type: 'email', required: true, key: true, validator: 'email' },
      { name: 'DisplayName', type: 'text', required: true },
      { name: 'Cohort', type: 'text' },
      { name: 'studentEmail', type: 'email', editable: false, serverDerived: true, table: false },
      { name: 'parentEmail', type: 'email' }
    ]
  },
  staffUsers: {
    sheet: 'USERS-STAFF',
    fields: [
      { name: 'EMAIL', type: 'email', required: true, key: true, validator: 'email' },
      { name: 'DisplayName', type: 'text', required: true },
      { name: 'Primary Department', type: 'text' },
      { name: 'StaffCode', type: 'text' },
      { name: 'isStaff', type: 'checkbox', defaultValue: true },
      { name: 'isSupervisor', type: 'checkbox' },
      { name: 'isLead', type: 'checkbox' },
      { name: 'isCoordinator', type: 'checkbox' },
      { name: 'isAdmin', type: 'checkbox' },
      { name: 'EEQuota', type: 'number' },
      { name: 'EESubjects', type: 'text' }
    ]
  },
  subjects: {
    sheet: 'SUBJECTS',
    fields: [
      { name: 'Subject ID', type: 'text', key: true, generated: true },
      { name: 'Name', type: 'text', required: true },
      { name: 'Department', type: 'text' },
      { name: 'Active', type: 'checkbox', defaultValue: true }
    ]
  },
  resources: {
    sheet: 'RESOURCES',
    fields: [
      { name: 'Resource ID', type: 'text', key: true, generated: true },
      { name: 'Title', type: 'text', required: true },
      { name: 'Category', type: 'text' },
      { name: 'Description', type: 'textarea', table: false },
      { name: 'URL', type: 'url' },
      { name: 'Audience', type: 'select', options: ['all', 'student', 'staff'] },
      { name: 'Published', type: 'checkbox' },
      { name: 'Sort Order', type: 'number' },
      { name: 'Slug', type: 'text', table: false },
      { name: 'Body', type: 'textarea', table: false },
      { name: 'Body Format', type: 'select', options: ['plain', 'markdown', 'html'], defaultValue: 'plain' }
    ]
  },
  faqs: {
    sheet: 'FAQS',
    fields: [
      { name: 'FaqId', type: 'text', key: true, generated: true },
      { name: 'Question', type: 'text', required: true },
      { name: 'Answer', type: 'textarea', required: true, table: false },
      { name: 'Audience', type: 'select', options: ['all', 'student', 'staff'] },
      { name: 'Published', type: 'checkbox', defaultValue: true },
      { name: 'SortOrder', type: 'number' }
    ]
  },
  ticketCategories: {
    sheet: 'TICKET_CATEGORIES',
    fields: [
      { name: 'CategoryId', type: 'text', key: true, generated: true },
      { name: 'Name', type: 'text', required: true },
      { name: 'Route', type: 'select', required: true, label: 'Who they message', options: ['supervisor', 'coordinator'], optionLabels: ["The student's supervisor", 'EE Coordinator'] },
      { name: 'SortOrder', type: 'number', label: 'Sort order' },
      { name: 'Active', type: 'checkbox', defaultValue: true }
    ]
  },
  cohortMembers: {
    sheetPattern: 'COHORT: [Cohort]',
    fields: [
      { name: 'StudentId', type: 'email', required: true, key: true, validator: 'email' },
      { name: 'Display Name', type: 'text', required: true },
      { name: 'HRM', type: 'text', table: false },
      { name: 'Surname', type: 'text' },
      { name: 'First Name', type: 'text' },
      { name: 'Preferred Name', type: 'text', table: false },
      { name: 'Chinese Name', type: 'text', table: false },
      { name: 'Student ID', type: 'text', required: true, validator: 'studentId' },
      { name: 'Family Email', type: 'email', table: false },
      { name: 'Student Email', type: 'email', required: true, validator: 'email' },
      { name: 'Date of Birth', type: 'date', table: false },
      { name: 'House', type: 'text', table: false },
      { name: 'Gender', type: 'text', table: false },
      { name: 'Year Group', type: 'number', required: true, validator: 'yearGroup' },
      { name: 'Anchor_Date', type: 'date', table: false },
      { name: 'supervisorId', type: 'email' },
      { name: 'subject', type: 'text' },
      { name: 'latestMilestone', type: 'text' },
      { name: 'EEFolder', type: 'text', table: false },
      { name: 'EEDoc', type: 'text', table: false },
      { name: 'RPPFDoc', type: 'text', table: false },
      { name: 'EEPoster', type: 'text', table: false }
    ]
  },
  studentActionItems: {
    sheet: 'STUDENT_ACTION_ITEMS',
    internal: true,
    fields: [
      { name: 'TaskId', type: 'text', required: true, key: true },
      { name: 'StudentId', type: 'email', required: true, validator: 'email' },
      { name: 'CreatorType', type: 'select', required: true, options: ['System', 'Supervisor', 'Student'] },
      { name: 'TemplateId', type: 'text' },
      { name: 'PhaseId', type: 'text' },
      { name: 'Title', type: 'text', required: true },
      { name: 'Description', type: 'textarea', table: false },
      { name: 'DueDate', type: 'date' },
      { name: 'Status', type: 'select', required: true, options: ['Pending', 'In Progress', 'Completed'] },
      { name: 'LastUpdated', type: 'datetime', required: true },
      { name: 'CreatedBy', type: 'email', validator: 'email' },
      { name: 'UpdatedBy', type: 'email', validator: 'email' }
    ]
  },
  auditLogs: {
    sheet: 'AUDIT_LOGS',
    internal: true,
    fields: [
      { name: 'Timestamp', type: 'datetime', required: true },
      { name: 'User', type: 'email', required: true, validator: 'email' },
      { name: 'Action', type: 'text', required: true },
      { name: 'Payload', type: 'text' }
    ]
  },
  formDefinitions: {
    sheet: 'FORM_DEFINITIONS',
    internal: true,
    fields: [
      { name: 'milestoneId', type: 'text', required: true, key: true },
      { name: 'status', type: 'select', required: true, options: ['Draft', 'Published'] },
      { name: 'version', type: 'number', required: true },
      { name: 'fieldsJson', type: 'textarea', table: false },
      { name: 'html', type: 'textarea', table: false },
      { name: 'js', type: 'textarea', table: false },
      { name: 'submitCompletes', type: 'checkbox', defaultValue: true },
      { name: 'LastUpdated', type: 'datetime', required: true },
      { name: 'UpdatedBy', type: 'email', required: true }
    ]
  },
  milestoneEvents: {
    sheet: 'MILESTONE_EVENTS',
    internal: true,
    fields: [
      { name: 'EventId', type: 'text', required: true, key: true },
      { name: 'TaskId', type: 'text', required: true },
      { name: 'StudentId', type: 'email', required: true },
      { name: 'MilestoneId', type: 'text', required: true },
      { name: 'EventType', type: 'select', required: true, options: ['returned', 'approved', 'session_logged', 'note'] },
      { name: 'Comment', type: 'textarea' },
      { name: 'Actor', type: 'email', required: true },
      { name: 'CreatedAt', type: 'datetime', required: true }
    ]
  },
  tickets: {
    sheet: 'TICKETS',
    internal: true,
    fields: [
      { name: 'TicketId', type: 'text', required: true, key: true },
      { name: 'StudentId', type: 'email', required: true, validator: 'email' },
      { name: 'Cohort', type: 'text' },
      { name: 'Category', type: 'text', required: true },
      { name: 'Title', type: 'text', required: true },
      { name: 'Status', type: 'select', required: true, options: ['Open', 'In Progress', 'Resolved', 'Closed'] },
      { name: 'Route', type: 'select', required: true, options: ['supervisor', 'coordinator'] },
      { name: 'Assignee', type: 'email' },
      { name: 'CreatedAt', type: 'datetime', required: true },
      { name: 'LastUpdated', type: 'datetime', required: true },
      { name: 'LastActor', type: 'email', required: true },
      { name: 'StudentUnread', type: 'checkbox' },
      { name: 'StaffUnread', type: 'checkbox' },
      { name: 'Shared', type: 'checkbox', defaultValue: true }
    ]
  },
  todoTemplates: {
    sheet: 'TODO_TEMPLATES',
    internal: true,
    fields: [
      { name: 'TemplateId', type: 'text', required: true, key: true },
      { name: 'Title', type: 'text', required: true },
      { name: 'Description', type: 'textarea', table: false },
      { name: 'PhaseId', type: 'text' },
      { name: 'Owner', type: 'email', required: true, validator: 'email' },
      { name: 'SortOrder', type: 'number' },
      { name: 'Active', type: 'checkbox', defaultValue: true }
    ]
  },
  ticketMessages: {
    sheet: 'TICKET_MESSAGES',
    internal: true,
    fields: [
      { name: 'MessageId', type: 'text', required: true, key: true },
      { name: 'TicketId', type: 'text', required: true },
      { name: 'AuthorEmail', type: 'email', required: true },
      { name: 'AuthorRole', type: 'select', required: true, options: ['student', 'staff'] },
      { name: 'Body', type: 'textarea', required: true },
      { name: 'CreatedAt', type: 'datetime', required: true }
    ]
  },
  quotations: {
    sheet: 'Quotations',
    fields: [
      { name: 'QuoteId', type: 'text', required: true, key: true },
      { name: 'Display', type: 'text', required: true },
      { name: 'Quote', type: 'text' },
      { name: 'Author', type: 'text' }
    ]
  }
};

function getTableConfig_(entity) {
  var config = APP_TABLES[entity];
  if (!config) throw new Error('Unknown Admin section.');
  return config;
}

function getTableFields_(entity) {
  return getTableConfig_(entity).fields;
}

function getTableHeaders_(entity) {
  return getTableFields_(entity).map(function(field) { return field.name; });
}

function getTableKey_(entity) {
  var keyFields = getTableFields_(entity).filter(function(field) { return field.key; });
  if (keyFields.length !== 1) throw new Error('Schema for ' + entity + ' must define exactly one key field.');
  return keyFields[0].name;
}

function getRequiredFields_(entity) {
  return getTableFields_(entity).filter(function(field) { return field.required; }).map(function(field) { return field.name; });
}

function getFieldConfig_(entity, fieldName) {
  return getTableFields_(entity).filter(function(field) { return field.name === fieldName; })[0] || null;
}

function getAdminSchema_(entity) {
  var config = getTableConfig_(entity);
  var fields = config.fields.map(function(field) {
    var result = {};
    Object.keys(field).forEach(function(key) {
      if (key !== 'validator' && key !== 'generated' && key !== 'serverDerived') result[key] = field[key];
    });
    if (field.options) {
      result.options = field.options.map(function(option, index) {
        var label = field.optionLabels && field.optionLabels[index] ? field.optionLabels[index] : option;
        return { value: option, label: label };
      });
    }
    if (field.optionsFrom === 'phases') {
      var phaseSheet = getSpreadsheet_().getSheetByName(APP_TABLES.phases.sheet);
      result.options = phaseSheet && phaseSheet.getLastRow() > 1
        ? readRecords_(phaseSheet).filter(function(phase) { return field.name === 'prerequisitePhaseId' || toBoolean_(phase.active); }).map(function(phase) {
            return { value: text_(phase[field.optionValue]), label: text_(phase.phaseId) + ' · ' + text_(phase[field.optionLabel]) };
          })
        : [];
    }
    return result;
  });
  return { entity: entity, sheet: config.sheet || config.sheetPattern, fields: fields };
}

function getTableSchemaReport() {
  ensureCohortDriveColumns_();
  ensureTicketsReady_();
  var spreadsheet = getSpreadsheet_();
  var sheets = [];
  Object.keys(APP_TABLES).forEach(function(entity) {
    var config = APP_TABLES[entity];
    if (config.sheetPattern) {
      var cohortSheets = spreadsheet.getSheets().filter(function(sheet) { return /^COHORT:\s*\d{4}$/i.test(sheet.getName()); });
      if (!cohortSheets.length) {
        sheets.push({ sheet: config.sheetPattern, status: 'ISSUE', issues: ['No cohort sheets were found.'] });
      } else {
        cohortSheets.forEach(function(sheet) { sheets.push(inspectSheetSchema_(sheet, entity)); });
      }
      return;
    }
    var sheet = spreadsheet.getSheetByName(config.sheet);
    if (!sheet) {
      sheets.push({ sheet: config.sheet, status: 'ISSUE', issues: ['Sheet is missing.'] });
      return;
    }
    sheets.push(inspectSheetSchema_(sheet, entity));
  });
  var issueCount = sheets.reduce(function(count, item) { return count + item.issues.length; }, 0);
  return { checkedAt: new Date().toISOString(), passCount: sheets.filter(function(item) { return item.status === 'PASS'; }).length, issueCount: issueCount, sheets: sheets };
}

function inspectSheetSchema_(sheet, entity) {
  var expected = getTableHeaders_(entity);
  var actual = getHeaders_(sheet);
  var issues = [];
  var duplicates = actual.filter(function(header, index) { return header && actual.indexOf(header) !== index; });
  var missing = expected.filter(function(header) { return actual.indexOf(header) < 0; });
  var unexpected = actual.filter(function(header) { return header && expected.indexOf(header) < 0; });
  if (duplicates.length) issues.push('Duplicate fields: ' + unique_(duplicates).join(', '));
  if (missing.length) issues.push('Missing fields: ' + missing.join(', '));
  if (unexpected.length) issues.push('Unexpected fields: ' + unique_(unexpected).join(', '));
  var shared = actual.filter(function(header) { return expected.indexOf(header) >= 0; });
  var expectedShared = expected.filter(function(header) { return actual.indexOf(header) >= 0; });
  if (!issues.length && shared.join('\u0000') !== expectedShared.join('\u0000')) {
    issues.push('Field order differs from the expected order (named-column reads remain safe).');
  }
  return { sheet: sheet.getName(), status: issues.length ? 'ISSUE' : 'PASS', expected: expected, actual: actual, issues: issues };
}

function assertSheetSchema_(sheet, entity) {
  var report = inspectSheetSchema_(sheet, entity);
  if (report.issues.length) throw new Error(report.sheet + ' schema mismatch: ' + report.issues.join(' '));
  return report;
}

function unique_(values) {
  return values.filter(function(value, index) { return values.indexOf(value) === index; });
}

function validateRecordFields_(entity, values, originalKey) {
  var fields = getTableFields_(entity);
  fields.forEach(function(field) {
    var value = values[field.name];
    if (field.required && !text_(value)) throw new Error(field.name + ' is required.');
    if (field.key && originalKey && text_(value) !== text_(originalKey)) throw new Error(field.name + ' cannot be changed.');
    if (value === '' || value === undefined || value === null) return;
    if (field.options && field.options.length && !field.options.some(function(option) { return String(option).toLowerCase() === String(value).toLowerCase(); })) {
      throw new Error(field.errorMessage || (field.name + ' must be one of: ' + field.options.join(', ') + '.'));
    }
    if (field.type === 'number' && !isFinite(Number(value))) throw new Error(field.name + ' must be a number.');
    if (field.type === 'date' && isNaN(Date.parse(value))) throw new Error(field.name + ' must be a valid date.');
    if (field.type === 'url' && !/^https:\/\/\S+$/i.test(text_(value))) throw new Error(field.name + ' must be an HTTPS URL.');
    if (field.type === 'checkbox' && typeof value !== 'boolean' && ['true', 'false', '1', '0', 'yes', 'no'].indexOf(String(value).toLowerCase()) < 0) {
      throw new Error(field.name + ' must be checked or unchecked.');
    }
    if (field.validator === 'email') validateEmail_(value, field.name);
    if (field.validator === 'studentId' && !/^\d{8}$/.test(text_(value))) throw new Error(field.name + ' must be an 8-digit number.');
    if (field.validator === 'yearGroup' && (!Number.isInteger(Number(value)) || Number(value) <= 0)) throw new Error(field.name + ' must be a positive whole number.');
    if (field.validator === 'phaseId' && !/^[a-z][a-z0-9_-]*$/i.test(text_(value))) {
      throw new Error(field.name + ' must start with a letter and contain only letters, numbers, hyphens, or underscores.');
    }
  });
}

var AUDIT_LOG_HEADERS = getTableHeaders_('auditLogs');
var ACTION_ITEM_STATUSES = ['Pending', 'In Progress', 'Completed'];

function getAppBootstrap() {
  var quotes = loadingQuotePayload_();
  try {
    var user = getCurrentUser_();
    AuditLog.record('LOGIN_SUCCESS', { role: user.role }, user.email);
    var messages = null;
    try { messages = getOpeningMessages_(); }
    catch (messageError) { console.error('Unable to load opening messages', messageError); }
    return { user: user, quote: quotes.quote, quotes: quotes.quotes, messages: messages };
  } catch (error) {
    var email = getActiveEmail_();
    try {
      AuditLog.record('ACCESS_DENIED', { reason: 'No authorized account' }, email);
    } catch (auditError) {
      console.error('Unable to audit denied login', auditError);
    }
    return { user: null, quote: quotes.quote, quotes: quotes.quotes };
  }
}

var QUOTE_DAY_KEY = 'EE_QUOTE_DAY';
var QUOTE_SET_KEY = 'EE_QUOTE_SET';

function builtinQuotes_() {
  return [
    'A clear question is the start of a strong essay.',
    'Write the next sentence. The essay grows one line at a time.',
    'Revision is where good thinking becomes clear writing.',
    'Small steady steps finish a long project.',
    'Read closely, then write in your own words.',
    'A draft is a place to think, not a final verdict.',
    'Keep your sources close and your claims careful.',
    'Progress is a page, a note, or a better question.',
    'Perseverance turns a rough idea into a finished essay.',
    'Ask for feedback, then make the work more precise.'
  ];
}

function quoteDayStamp_() {
  var now = new Date();
  var month = now.getMonth() + 1;
  var day = now.getDate();
  return now.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
}

function parseStoredQuotes_(raw) {
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(function(line) { return text_(line); }).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function readQuotePool_() {
  var fallback = builtinQuotes_();
  var sheet = null;
  try {
    sheet = getSpreadsheet_().getSheetByName('Quotations');
  } catch (error) {
    return fallback;
  }
  if (!sheet || sheet.getLastRow() < 1) return fallback;
  var data = sheet.getDataRange().getValues();
  if (!data.length) return fallback;
  var headers = data[0].map(function(header) { return text_(header).toLowerCase(); });
  var named = ['quote', 'quotation', 'text', 'line'];
  var column = headers.indexOf('display');
  var startRow = column >= 0 ? 1 : 0;
  if (column < 0) {
    for (var index = 0; index < headers.length; index++) {
      if (named.indexOf(headers[index]) >= 0) {
        column = index;
        startRow = 1;
        break;
      }
    }
  }
  var pool = [];
  for (var rowIndex = startRow; rowIndex < data.length; rowIndex++) {
    var line = text_(data[rowIndex][column]);
    if (line) pool.push(line);
  }
  return pool.length ? pool : fallback;
}

function sampleQuotes_(pool, count) {
  var copy = pool.slice();
  var sample = [];
  var limit = Math.min(count, copy.length);
  for (var index = 0; index < limit; index++) {
    var pick = Math.floor(Math.random() * copy.length);
    sample.push(copy.splice(pick, 1)[0]);
  }
  return sample;
}

function activeLoadingQuotes_() {
  var today = quoteDayStamp_();
  var props = null;
  var storedDay = '';
  var storedRaw = '';
  try {
    props = PropertiesService.getScriptProperties();
    storedDay = text_(props.getProperty(QUOTE_DAY_KEY));
    storedRaw = props.getProperty(QUOTE_SET_KEY) || '';
  } catch (error) {
    props = null;
  }
  var quotes = parseStoredQuotes_(storedRaw);
  if (storedDay === today && quotes.length) return quotes;
  quotes = sampleQuotes_(readQuotePool_(), 10);
  if (props) {
    try {
      props.setProperty(QUOTE_DAY_KEY, today);
      props.setProperty(QUOTE_SET_KEY, JSON.stringify(quotes));
    } catch (writeError) { /* a quote can still be shown for this request */ }
  }
  return quotes.length ? quotes : builtinQuotes_();
}

function loadingQuotePayload_() {
  var quotes = [];
  try { quotes = activeLoadingQuotes_(); } catch (error) { quotes = builtinQuotes_(); }
  if (!quotes.length) quotes = builtinQuotes_();
  return { quote: quotes[Math.floor(Math.random() * quotes.length)], quotes: quotes };
}

function getLoadingQuote() {
  return loadingQuotePayload_();
}

function getCohorts() {
  var user = requireStaff_('LIST_COHORTS');
  return listCohorts_().map(function(cohort) {
    return { id: cohort.id, name: cohort.name, sheetName: cohort.sheetName };
  });
}

function getPathwayPlan() {
  return {
    phases: getAdminRecords('phases'),
    milestones: getAdminRecords('milestoneTemplates')
  };
}

function getCohortStudents(cohortId) {
  requireStaff_('LIST_COHORT_STUDENTS');
  var sheet = getCohortSheet_(cohortId);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0].map(headerName_);
    var emailIndexes = findHeaderIndexes_(headers, 'StudentId');
    if (emailIndexes.length !== 1) throw new Error('The cohort sheet needs exactly one StudentId column.');
    var emailIndex = emailIndexes[0];
  var idIndexes = findHeaderIndexes_(headers, 'Student ID');
  var displayIndex = findHeaderIndex_(headers, ['Display Name', 'DisplayName']);
  var preferredIndex = findHeaderIndex_(headers, ['Preferred Name']);
  var firstIndex = findHeaderIndex_(headers, ['First Name']);
  var surnameIndex = findHeaderIndex_(headers, ['Surname']);

  return data.slice(1).filter(function(row) {
    return normalizeEmail_(row[emailIndex]) !== '';
  }).map(function(row) {
    var email = normalizeEmail_(row[emailIndex]);
    var idValues = idIndexes.map(function(index) { return text_(row[index]); }).filter(Boolean);
    var idConflict = idValues.some(function(value) { return value !== idValues[0]; });
    var displayName = text_(displayIndex >= 0 ? row[displayIndex] : '');
    if (!displayName) displayName = text_(preferredIndex >= 0 ? row[preferredIndex] : '');
    if (!displayName) {
      displayName = [
        firstIndex >= 0 ? text_(row[firstIndex]) : '',
        surnameIndex >= 0 ? text_(row[surnameIndex]) : ''
      ].filter(Boolean).join(' ');
    }
    return {
      email: email,
      displayName: displayName || email,
      studentId: idValues[0] || '',
      hasStudentIdConflict: idConflict
    };
  });
}

function getStudentView(studentEmail, cohortId) {
  var user = requireUser_('VIEW_STUDENT');
  var targetEmail = user.role === 'student' ? user.email : normalizeEmail_(studentEmail);

  if (user.role === 'staff') {
    if (!targetEmail || !cohortId) throw new Error('Choose a student from a cohort.');
    var roster = getCohortStudents(cohortId);
    if (!roster.some(function(student) { return student.email === targetEmail; })) {
      denyAccess_(user, 'VIEW_STUDENT', 'Student is not in the selected cohort.');
    }
  } else if (user.role !== 'student') {
    denyAccess_(user, 'VIEW_STUDENT', 'Student view is unavailable.');
  }

  var sheet = getSpreadsheet_().getSheetByName('USERS-STUDENTS');
  var record = findStudentUserByEmail_(sheet, targetEmail);
  var displayName = record ? text_(record.DisplayName) : '';

  if (!displayName && user.role === 'staff') {
    var student = getCohortStudents(cohortId).filter(function(item) { return item.email === targetEmail; })[0];
    displayName = student ? student.displayName : '';
  }
  if (!displayName) displayName = targetEmail;
  var studentCohort = user.role === 'student' && record ? text_(record.Cohort) : text_(cohortId);
  return {
    displayName: displayName,
    cohort: studentCohort,
    actionItems: getStudentActionItems_(targetEmail, user)
  };
}

function getContentHub() {
  var user = requireUser_('GET_CONTENT_HUB');
  migrateResourcesSheet_();
  return {
    resources: getPublishedContent_('RESOURCES', user.role)
  };
}

function migrateResourcesSheet_() {
  var spreadsheet = getSpreadsheet_();
  var sheetName = APP_TABLES.resources.sheet;
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet && !resourceMigrationPending_(spreadsheet, sheet)) {
    return { created: false, columnsAdded: [], pagesCopied: 0 };
  }
  return withSheetLock_(function() {
    var lockedSpreadsheet = getSpreadsheet_();
    var lockedSheet = lockedSpreadsheet.getSheetByName(sheetName);
    var created = false;
    if (!lockedSheet) {
      lockedSheet = lockedSpreadsheet.insertSheet(sheetName);
      var headers = getTableHeaders_('resources');
      lockedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      lockedSheet.setFrozenRows(1);
      created = true;
    }
    var columnsAdded = appendMissingResourceColumns_(lockedSheet);
    var pagesCopied = copyContentPagesIntoResources_(lockedSpreadsheet, lockedSheet);
    return { created: created, columnsAdded: columnsAdded, pagesCopied: pagesCopied };
  });
}

function resourceMigrationPending_(spreadsheet, sheet) {
  var expected = getTableHeaders_('resources');
  var actual = getHeaders_(sheet);
  if (!actual.length) return true;
  var sameHeaders = actual.join('\u0000') === expected.join('\u0000');
  var matchesPrefix = actual.every(function(header, index) { return header === expected[index]; });
  var additions = matchesPrefix ? expected.slice(actual.length) : [];
  var bodyColumns = { 'Slug': true, 'Body': true, 'Body Format': true };
  var columnsPending = !sameHeaders && additions.length > 0 && additions.every(function(header) { return bodyColumns[header]; });
  if (columnsPending) return true;
  if (!sameHeaders || actual.indexOf('Resource ID') < 0 || actual.indexOf('Body') < 0) return false;
  var pages = spreadsheet.getSheetByName('CONTENT_PAGES');
  if (!pages || pages.getLastRow() < 2) return false;
  var pageIdIndex = getHeaders_(pages).indexOf('Page ID');
  var resourceIdIndex = actual.indexOf('Resource ID');
  if (pageIdIndex < 0 || resourceIdIndex < 0) return false;
  var existing = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, resourceIdIndex + 1, sheet.getLastRow() - 1, 1).getValues().forEach(function(row) {
      var id = text_(row[0]);
      if (id) existing[id] = true;
    });
  }
  return pages.getRange(2, pageIdIndex + 1, pages.getLastRow() - 1, 1).getValues().some(function(row) {
    var id = text_(row[0]);
    return id && !existing[id];
  });
}

function appendMissingResourceColumns_(sheet) {
  var expected = getTableHeaders_('resources');
  var actual = getHeaders_(sheet);
  if (!actual.length) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
    return expected.slice();
  }
  if (actual.join('\u0000') === expected.join('\u0000')) return [];
  var matchesPrefix = actual.every(function(header, index) { return header === expected[index]; });
  if (!matchesPrefix) return [];
  var additions = expected.slice(actual.length);
  var bodyColumns = { 'Slug': true, 'Body': true, 'Body Format': true };
  if (!additions.length || additions.some(function(header) { return !bodyColumns[header]; })) return [];
  sheet.getRange(1, actual.length + 1, 1, additions.length).setValues([additions]);
  return additions;
}

function copyContentPagesIntoResources_(spreadsheet, resourceSheet) {
  var pages = spreadsheet.getSheetByName('CONTENT_PAGES');
  if (!pages || pages.getLastRow() < 2) return 0;
  var headers = getHeaders_(resourceSheet);
  if (headers.indexOf('Body') < 0 || headers.indexOf('Resource ID') < 0) return 0;
  var copied = 0;
  readRecords_(pages).forEach(function(page) {
    var id = text_(page['Page ID']);
    if (!id || findRowNumber_(resourceSheet, 'Resource ID', id) > -1) return;
    var body = page.Body === null || page.Body === undefined ? '' : String(page.Body);
    var record = {
      'Resource ID': id,
      'Title': text_(page.Title),
      'Category': 'Guide',
      'Description': '',
      'URL': '',
      'Audience': text_(page.Audience) || 'all',
      'Published': toBoolean_(page.Published),
      'Sort Order': page['Sort Order'] === '' || page['Sort Order'] === undefined || page['Sort Order'] === null ? '' : Number(page['Sort Order']),
      'Slug': text_(page.Slug),
      'Body': body,
      'Body Format': /<[a-z!/][^>]*>/i.test(body) ? 'html' : 'plain'
    };
    var row = headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? safeCell_(record[header]) : '';
    });
    resourceSheet.getRange(resourceSheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
    copied++;
  });
  return copied;
}

function assertSafeResourceHtml_(html) {
  var text = String(html || '');
  if (/<\s*script/i.test(text) || /javascript\s*:/i.test(text) || /\son[a-z]+\s*=/i.test(text)) {
    throw new Error('Resource HTML cannot include scripts or event handlers.');
  }
}

function getAdminRecords(entity) {
  requireAdmin_('LIST_' + String(entity || '').toUpperCase());
  if (entity === 'cohortMembers') throw new Error('Choose a cohort to manage its students.');
  var config = getTableConfig_(entity);
  if (config.internal) throw new Error('Internal sheets cannot be managed through Admin.');
  var schema = getAdminSchema_(entity);
  var headers = getTableHeaders_(entity);
  if (entity === 'cohorts') return {
    schema: schema,
    headers: headers,
    records: listCohorts_(true).map(function(item) {
      return { 'Cohort': item.id, 'SheetName': item.sheetName, 'Status': item.status || 'Active' };
    })
  };
  if (entity === 'resources') migrateResourcesSheet_();
  if (entity === 'ticketCategories') seedDefaultTicketCategories_();
  var sheet = getSpreadsheet_().getSheetByName(config.sheet);
  if (sheet) assertSheetSchema_(sheet, entity);
  return {
    schema: schema,
    headers: headers,
    records: sheet ? readRecords_(sheet) : []
  };
}

function getAdminSchema(entity) {
  requireAdmin_('GET_SCHEMA_' + String(entity || '').toUpperCase());
  if (getTableConfig_(entity).internal) throw new Error('Internal sheets do not have Admin forms.');
  return getAdminSchema_(entity);
}

function getCohortMembersForAdmin(cohortId) {
  requireAdmin_('LIST_COHORT_MEMBERS');
  var sheet = getCohortSheet_(cohortId);
  assertSheetSchema_(sheet, 'cohortMembers');
  var data = sheet.getDataRange().getValues();
  var headers = data.length ? data[0].map(headerName_) : getHeaders_(sheet);
  var idIndexes = findHeaderIndexes_(headers, 'Student ID');
  var records = data.slice(1).filter(function(row) {
    var emailIndex = cohortLoginKeyIndex_(headers);
    return emailIndex >= 0 && normalizeEmail_(row[emailIndex]) !== '';
  }).map(function(row) {
    var record = {};
    headers.forEach(function(header, index) {
      if (header && !Object.prototype.hasOwnProperty.call(record, header)) record[header] = serializable_(row[index]);
    });
    var ids = idIndexes.map(function(index) { return text_(row[index]); }).filter(Boolean);
    record['Student ID'] = ids[0] || '';
    record.hasStudentIdConflict = ids.some(function(value) { return value !== ids[0]; });
    return record;
  });
  return { schema: getAdminSchema_('cohortMembers'), headers: headers, records: records };
}

function saveAdminRecord(entity, record, originalKey) {
  var user = requireAdmin_('SAVE_' + String(entity || '').toUpperCase());
  var config = getTableConfig_(entity);
  if (config.internal) throw new Error('Internal sheets cannot be managed through Admin.');
  if (entity === 'cohorts') return saveCohort_(user, record || {}, originalKey);
  if (entity === 'cohortMembers') throw new Error('Use the cohort student editor.');
  if (entity === 'resources') migrateResourcesSheet_();
  var existingSheet = getSpreadsheet_().getSheetByName(config.sheet);
  if (existingSheet) assertSheetSchema_(existingSheet, entity);

  var values = record || {};
  validateRecordFields_(entity, values, originalKey);
  if (entity === 'studentUsers') {
    values.studentEmail = normalizeEmail_(values.StudentId);
  }
  if (entity === 'milestoneTemplates') {
    values.type = text_(values.type).toLowerCase();
    values.mOwner = text_(values.mOwner).toLowerCase();
    var milestonePhase = findRecordByValue_(getSpreadsheet_().getSheetByName('PHASES'), 'phaseId', values.phase);
    if (!milestonePhase || !toBoolean_(milestonePhase.active)) throw new Error('Choose an active phase before saving this milestone.');
  }
  if (entity === 'phases') {
    values.phaseId = text_(values.phaseId).toLowerCase();
    values.sequence = Number(values.sequence);
    values.active = values.active === undefined || values.active === '' ? true : toBoolean_(values.active);
    validatePhasePrerequisites_(values, originalKey);
  }
  if (entity === 'staffUsers') {
    validateEmail_(values.EMAIL, 'Staff email');
    if (!toBoolean_(values.isStaff) && !toBoolean_(values.isSupervisor) && !toBoolean_(values.isLead) && !toBoolean_(values.isCoordinator) && !toBoolean_(values.isAdmin)) {
      throw new Error('Select at least one staff role.');
    }
  }
  if (entity === 'resources') {
    if (text_(values.Body).length > 40000) throw new Error('Body must be 40,000 characters or fewer.');
    values['Body Format'] = text_(values['Body Format']).toLowerCase() || 'plain';
    if (values['Body Format'] === 'html') assertSafeResourceHtml_(values.Body);
    if (toBoolean_(values.Published) && !text_(values.URL) && !text_(values.Body)) {
      throw new Error('A published resource needs a URL or a body.');
    }
  }
  if (entity === 'ticketCategories') validateTicketCategory_(values, originalKey);

  var key = getTableKey_(entity);
  var keyField = getFieldConfig_(entity, key);
  if (!text_(values[key]) && !originalKey && keyField.generated) values[key] = Utilities.getUuid();
  if (!text_(values[key])) throw new Error(key + ' is required.');
  if (originalKey && text_(values[key]) !== text_(originalKey)) throw new Error(key + ' cannot be changed.');
  if (entity === 'staffUsers') values.isStaff = true;

  return runAuditedMutation_(user, originalKey ? 'UPDATE_' + entity.toUpperCase() : 'CREATE_' + entity.toUpperCase(), {
    entity: entity,
    key: originalKey || text_(values[key])
  }, function() {
    var sheet = getOrCreateManagedSheet_(config);
    var headers = getHeaders_(sheet);
    assertSheetSchema_(sheet, entity);
    var keyIndex = headers.indexOf(key);
    if (keyIndex < 0) throw new Error('Missing key column ' + key + ' in ' + config.sheet + '.');

    var rowNumber = originalKey ? findRowNumber_(sheet, key, originalKey) : -1;
    if (originalKey && rowNumber < 0) throw new Error('Record no longer exists. Refresh and try again.');
    if (!originalKey && findRowNumber_(sheet, key, values[key]) > -1) throw new Error('A record with this ' + key + ' already exists.');
    if (entity === 'staffUsers' && originalKey) {
      var currentStaff = findRecordByValue_(sheet, 'EMAIL', originalKey);
      if (currentStaff && staffHasAdminAccess_(currentStaff) && !staffHasAdminAccess_(values)) {
        assertAnotherAdminExists_(sheet, originalKey);
      }
    }

    var row = rowNumber > 0 ? sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0] : headers.map(function() { return ''; });
    headers.forEach(function(header, index) {
      if (Object.prototype.hasOwnProperty.call(values, header)) row[index] = safeCell_(values[header]);
    });
    if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
    if (entity === 'cohorts') ensureCohortSheet_(values.Cohort);
    if (entity === 'phases' || entity === 'milestoneTemplates') invalidateJourneyCatalog_();
    return { key: text_(values[key]) };
  });
}

function deleteAdminRecord(entity, keyValue) {
  var user = requireAdmin_('DELETE_' + String(entity || '').toUpperCase());
  var config = getTableConfig_(entity);
  if (config.internal) throw new Error('Internal sheets cannot be managed through Admin.');
  if (entity === 'cohortMembers') throw new Error('Use the cohort student editor.');
  if (!text_(keyValue)) throw new Error('A record key is required.');

  return runAuditedMutation_(user, 'DELETE_' + entity.toUpperCase(), {
    entity: entity,
    key: text_(keyValue),
    mode: entity === 'cohorts' ? 'archive' : 'delete'
  }, function() {
    var sheet = getSpreadsheet_().getSheetByName(config.sheet);
    if (entity === 'cohorts') {
      if (!sheet) sheet = getOrCreateManagedSheet_(config);
      assertSheetSchema_(sheet, entity);
      var rowNumber = findRowNumber_(sheet, getTableKey_(entity), keyValue);
      if (rowNumber < 0) {
        var inactiveRecord = { Cohort: text_(keyValue), SheetName: cohortSheetName_(keyValue), Status: 'Inactive' };
        var headers = getHeaders_(sheet);
        var row = headers.map(function(header) { return inactiveRecord[header] || ''; });
        sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
      } else {
        var headers = getHeaders_(sheet);
        var statusIndex = headers.indexOf('Status');
        if (statusIndex < 0) throw new Error('COHORTS needs a Status column before archiving.');
        sheet.getRange(rowNumber, statusIndex + 1).setValue('Inactive');
      }
      return { archived: true };
    }
    if (!sheet) throw new Error('No records exist in ' + config.sheet + '.');
    assertSheetSchema_(sheet, entity);
    var targetRow = findRowNumber_(sheet, getTableKey_(entity), keyValue);
    if (targetRow < 0) throw new Error('Record not found.');
    if (entity === 'phases') {
      var milestoneSheet = getSpreadsheet_().getSheetByName(APP_TABLES.milestoneTemplates.sheet);
      if (milestoneSheet && readRecords_(milestoneSheet).some(function(milestone) { return text_(milestone.phase) === text_(keyValue); })) {
        throw new Error('Move or delete this phase’s milestones before deleting the phase.');
      }
      var phaseRecords = readRecords_(sheet);
      if (phaseRecords.some(function(phase) { return text_(phase.phaseId) !== text_(keyValue) && text_(phase.prerequisitePhaseId) === text_(keyValue); })) {
        throw new Error('Update dependent phases before deleting this phase.');
      }
    }
    if (entity === 'milestoneTemplates') {
      var actionSheet = getSpreadsheet_().getSheetByName(APP_TABLES.studentActionItems.sheet);
      if (actionSheet && actionSheet.getLastRow() > 1 && readRecords_(actionSheet).some(function(item) {
        return text_(item.CreatorType) === 'System' && text_(item.TemplateId) === text_(keyValue);
      })) throw new Error('This template has assigned action items and cannot be deleted.');
    }
    if (entity === 'staffUsers') {
      var deletedStaff = findRecordByValue_(sheet, 'EMAIL', keyValue);
      if (deletedStaff && staffHasAdminAccess_(deletedStaff)) assertAnotherAdminExists_(sheet, keyValue);
    }
    retireSheetRow_(sheet, targetRow);
    if (entity === 'phases' || entity === 'milestoneTemplates') invalidateJourneyCatalog_();
    return { deleted: true };
  });
}

function saveCohortMember(cohortId, record, originalStudentId) {
  var user = requireAdmin_('SAVE_COHORT_MEMBER');
  var cohortSheet = getCohortSheet_(cohortId);
  assertSheetSchema_(cohortSheet, 'cohortMembers');
  var values = record || {};
  validateRecordFields_('cohortMembers', values, originalStudentId);
  values.StudentId = normalizeEmail_(values.StudentId);
  values['Student Email'] = normalizeEmail_(values['Student Email']);
  values['Year Group'] = Number(values['Year Group']);

  return runAuditedMutation_(user, originalStudentId ? 'UPDATE_COHORT_MEMBER' : 'CREATE_COHORT_MEMBER', {
    cohort: text_(cohortId),
    studentId: normalizeEmail_(originalStudentId || values.StudentId)
  }, function() {
    var sheet = getCohortSheet_(cohortId);
    var headers = getHeaders_(sheet);
    assertSheetSchema_(sheet, 'cohortMembers');
    var studentIdIndexes = findHeaderIndexes_(headers, 'StudentId');
    if (studentIdIndexes.length !== 1) throw new Error('The cohort sheet must have exactly one StudentId column.');
    var idIndexes = findHeaderIndexes_(headers, 'Student ID');
    if (idIndexes.length !== 1) throw new Error('The cohort sheet must have exactly one Student ID column.');

    var currentStudentId = normalizeEmail_(originalStudentId || values.StudentId);
    var rowNumber = findRowNumber_(sheet, 'StudentId', currentStudentId);
    if (originalStudentId && rowNumber < 0) throw new Error('Cohort student not found. Refresh and try again.');
    if (!originalStudentId && rowNumber > 0) throw new Error('This student is already in the cohort.');

    var row = rowNumber > 0 ? sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0] : headers.map(function() { return ''; });
    headers.forEach(function(header, index) {
      if (Object.prototype.hasOwnProperty.call(values, header) && header !== 'Student ID' && header !== 'StudentId') {
        row[index] = safeCell_(values[header]);
      }
    });
    row[idIndexes[0]] = safeCell_(values['Student ID']);
    row[studentIdIndexes[0]] = normalizeEmail_(values.StudentId);

    if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
    invalidatePlacementCache_(normalizeEmail_(values.StudentId));
    if (originalStudentId) invalidatePlacementCache_(normalizeEmail_(originalStudentId));
    return { studentId: normalizeEmail_(values.StudentId) };
  });
}

function importCohortMembers(cohortId, records) {
  var user = requireAdmin_('IMPORT_COHORT_MEMBERS');
  if (!Array.isArray(records) || records.length === 0) throw new Error('No roster rows were provided.');
  if (records.length > 1000) throw new Error('Import is limited to 1,000 students at a time.');

  return runAuditedMutation_(user, 'IMPORT_COHORT_MEMBERS', {
    cohort: text_(cohortId),
    rowCount: records.length
  }, function() {
    var sheet = getCohortSheet_(cohortId);
    var headers = getHeaders_(sheet);
    assertSheetSchema_(sheet, 'cohortMembers');
    var studentIdIndexes = findHeaderIndexes_(headers, 'StudentId');
    var institutionalIdIndexes = findHeaderIndexes_(headers, 'Student ID');
    var studentEmailIndexes = findHeaderIndexes_(headers, 'Student Email');
    if (studentIdIndexes.length !== 1 || institutionalIdIndexes.length !== 1 || studentEmailIndexes.length !== 1) {
      throw new Error('The cohort sheet needs exactly one StudentId, Student ID, and Student Email column.');
    }

    var existing = {};
    if (sheet.getLastRow() > 1) {
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
      rows.forEach(function(row) {
        var studentId = normalizeEmail_(row[studentIdIndexes[0]]);
        if (studentId) existing[studentId] = true;
      });
    }

    var seen = {};
    var newRows = records.map(function(record, index) {
      var values = record || {};
      var studentId = normalizeEmail_(values.StudentId);
      validateRecordFields_('cohortMembers', values);
      values.StudentId = studentId;
      values['Student Email'] = normalizeEmail_(values['Student Email']);
      values['Year Group'] = Number(values['Year Group']);
      if (seen[studentId]) throw new Error('StudentId appears more than once in the import: ' + studentId);
      if (existing[studentId]) throw new Error('StudentId is already in this cohort: ' + studentId);
      seen[studentId] = true;

      var row = headers.map(function() { return ''; });
      headers.forEach(function(header, column) {
        if (Object.prototype.hasOwnProperty.call(values, header)) row[column] = safeCell_(values[header]);
      });
      return row;
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
    return { imported: newRows.length };
  });
}

function createStudentUsersFromCohort(cohortId, selectedStudentIds) {
  var user = requireAdmin_('CREATE_STUDENT_USERS_FROM_COHORT');
  if (!Array.isArray(selectedStudentIds) || selectedStudentIds.length === 0) throw new Error('Select at least one student.');
  if (selectedStudentIds.length > 1000) throw new Error('Select no more than 1,000 students at a time.');

  return runAuditedMutation_(user, 'CREATE_STUDENT_USERS_FROM_COHORT', {
    cohort: text_(cohortId),
    selectedCount: selectedStudentIds.length
  }, function() {
    var cohortData = getCohortMembersForAdmin(cohortId);
    var selected = {};
    selectedStudentIds.forEach(function(value) {
      var studentId = normalizeEmail_(value);
      validateEmail_(studentId, 'StudentId');
      if (selected[studentId]) throw new Error('A student was selected more than once.');
      selected[studentId] = true;
    });

    var membersById = {};
    cohortData.records.forEach(function(record) { membersById[normalizeEmail_(record.StudentId)] = record; });
    var config = APP_TABLES.studentUsers;
    var userSheet = getOrCreateManagedSheet_(config);
    var userHeaders = getHeaders_(userSheet);
    assertSheetSchema_(userSheet, 'studentUsers');
    assertUniqueHeaders_(userHeaders, config.sheet);
    if (userHeaders.indexOf('StudentId') < 0) throw new Error('USERS-STUDENTS needs a StudentId column.');

    var rowsToAdd = [];
    var alreadyExists = 0;
    Object.keys(selected).forEach(function(studentId) {
      var member = membersById[studentId];
      if (!member) throw new Error('Student is not in this cohort: ' + studentId);
      if (member.hasStudentIdConflict) throw new Error('Resolve the duplicate Student ID values before creating a user for ' + studentId + '.');
      var displayName = text_(member['Display Name'] || member.DisplayName || member['Preferred Name'] || studentId);
      if (findStudentUserByEmail_(userSheet, studentId)) {
        alreadyExists++;
        return;
      }

      var values = {
        StudentId: studentId,
        DisplayName: displayName,
        Cohort: text_(cohortId),
        studentEmail: studentId,
        parentEmail: text_(member['Family Email'])
      };
      var row = userHeaders.map(function(header) {
        return Object.prototype.hasOwnProperty.call(values, header) ? safeCell_(values[header]) : '';
      });
      rowsToAdd.push(row);
    });

    if (rowsToAdd.length) {
      userSheet.getRange(userSheet.getLastRow() + 1, 1, rowsToAdd.length, userHeaders.length).setValues(rowsToAdd);
    }
    return { created: rowsToAdd.length, alreadyExists: alreadyExists };
  });
}

function deleteCohortMember(cohortId, studentId) {
  var user = requireAdmin_('DELETE_COHORT_MEMBER');
  validateEmail_(studentId, 'StudentId');
  return runAuditedMutation_(user, 'DELETE_COHORT_MEMBER', {
    cohort: text_(cohortId),
    studentId: normalizeEmail_(studentId)
  }, function() {
    var sheet = getCohortSheet_(cohortId);
    assertSheetSchema_(sheet, 'cohortMembers');
    var rowNumber = findRowNumber_(sheet, 'StudentId', normalizeEmail_(studentId));
    if (rowNumber < 0) throw new Error('Cohort student not found.');
    retireSheetRow_(sheet, rowNumber);
    invalidatePlacementCache_(normalizeEmail_(studentId));
    return { deleted: true };
  });
}

function getCurrentUser_() {
  var email = getActiveEmail_();
  if (!email) throw new Error('Google did not provide the signed-in email.');
  var spreadsheet = getSpreadsheet_();
  var staff = findRecordByValue_(spreadsheet.getSheetByName('USERS-STAFF'), 'EMAIL', email);
  if (staff && toBoolean_(staff.isStaff)) {
    return {
      email: email,
      displayName: text_(staff.DisplayName) || email,
      role: 'staff',
      permissions: {
        isStaff: toBoolean_(staff.isStaff),
        isSupervisor: toBoolean_(staff.isSupervisor),
        isLead: toBoolean_(staff.isLead),
        isCoordinator: toBoolean_(staff.isCoordinator),
        isAdmin: toBoolean_(staff.isAdmin),
        canAdmin: toBoolean_(staff.isAdmin) || toBoolean_(staff.isCoordinator)
      }
    };
  }
  var student = findStudentUserByEmail_(spreadsheet.getSheetByName('USERS-STUDENTS'), email);
  if (student) return { email: email, displayName: text_(student.DisplayName) || email, role: 'student' };
  throw new Error('No active account is registered for this email.');
}

function requireStaff_(operation) {
  var user = requireUser_(operation);
  if (user.role !== 'staff') denyAccess_(user, operation, 'Staff access required.');
  return user;
}

function requireAdmin_(operation) {
  var user = requireStaff_(operation);
  if (!user.permissions.canAdmin) denyAccess_(user, operation, 'Administrator or coordinator access required.');
  return user;
}

function requireUser_(operation) {
  try {
    return getCurrentUser_();
  } catch (error) {
    var email = getActiveEmail_();
    try { AuditLog.record('ACCESS_DENIED', { operation: operation, reason: 'Unauthenticated' }, email); }
    catch (auditError) { console.error('Unable to audit denied access', auditError); }
    throw new Error('Access denied.');
  }
}

function denyAccess_(user, operation, reason) {
  AuditLog.record('ACCESS_DENIED', { operation: operation, reason: reason }, user ? user.email : getActiveEmail_());
  throw new Error('Access denied.');
}

function getActiveEmail_() {
  try { return normalizeEmail_(Session.getActiveUser().getEmail()); }
  catch (error) { return ''; }
}

function getSpreadsheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('This Apps Script project must be bound to the EE master spreadsheet.');
  return spreadsheet;
}

function ensureTicketSharedColumn_() {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.tickets.sheet);
  if (!sheet || sheet.getLastRow() < 1) return [];
  if (getHeaders_(sheet).indexOf('Shared') >= 0) return [];
  return withSheetLock_(function() {
    var lockedSheet = getSpreadsheet_().getSheetByName(APP_TABLES.tickets.sheet);
    if (!lockedSheet || lockedSheet.getLastRow() < 1) return [];
    var actual = getHeaders_(lockedSheet);
    if (actual.indexOf('Shared') >= 0) return [];
    lockedSheet.getRange(1, actual.length + 1).setValue('Shared');
    return ['Shared'];
  });
}

function ensureTicketsReady_() {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.tickets.sheet);
  if (!sheet) {
    getOrCreateManagedSheet_(APP_TABLES.tickets);
    return [];
  }
  return ensureTicketSharedColumn_();
}

function ensureCohortDriveColumns_() {
  var expected = ['DriveRootFolderId', 'FolderPrefix', 'FolderSuffix'];
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.cohorts.sheet);
  if (!sheet || sheet.getLastRow() < 1) return [];
  var current = getHeaders_(sheet);
  if (!expected.some(function(header) { return current.indexOf(header) < 0; })) return [];
  return withSheetLock_(function() {
    var lockedSheet = getSpreadsheet_().getSheetByName(APP_TABLES.cohorts.sheet);
    if (!lockedSheet || lockedSheet.getLastRow() < 1) return [];
    var actual = getHeaders_(lockedSheet);
    var missing = expected.filter(function(header) { return actual.indexOf(header) < 0; });
    if (!missing.length) return [];
    lockedSheet.getRange(1, actual.length + 1, 1, missing.length).setValues([missing]);
    return missing;
  });
}

function listCohorts_(includeInactive) {
  var spreadsheet = getSpreadsheet_();
  var registry = spreadsheet.getSheetByName('COHORTS');
  var entries = {};
  if (registry) {
    ensureCohortDriveColumns_();
    assertSheetSchema_(registry, 'cohorts');
  }
  if (registry && registry.getLastRow() > 1) {
    readRecords_(registry).forEach(function(record) {
      var id = text_(record.Cohort);
      if (!id) return;
      entries[id] = {
        id: id,
        name: id,
        sheetName: text_(record.SheetName) || cohortSheetName_(id),
        status: text_(record.Status) || 'Active'
      };
    });
  }
  spreadsheet.getSheets().forEach(function(sheet) {
    var match = /^COHORT\s*:\s*(\d{4})$/i.exec(sheet.getName());
    if (!match) return;
    var id = match[1];
    if (!entries[id]) entries[id] = { id: id, name: id, sheetName: sheet.getName(), status: 'Active' };
  });
  return Object.keys(entries).map(function(id) { return entries[id]; })
    .filter(function(entry) { return (includeInactive || entry.status.toLowerCase() !== 'inactive') && getSpreadsheet_().getSheetByName(entry.sheetName); })
    .sort(function(left, right) { return left.id.localeCompare(right.id); });
}

function getCohortSheet_(cohortId) {
  var id = text_(cohortId);
  var cohort = listCohorts_().filter(function(entry) { return entry.id === id || entry.sheetName === id; })[0];
  if (!cohort) throw new Error('Cohort not found or inactive.');
  var sheet = getSpreadsheet_().getSheetByName(cohort.sheetName);
  if (!sheet) throw new Error('The cohort roster sheet is missing.');
  return sheet;
}

function saveCohort_(user, values, originalKey) {
  var cohortId = text_(values.Cohort);
  ensureCohortDriveColumns_();
  var existingRegistry = getSpreadsheet_().getSheetByName(APP_TABLES.cohorts.sheet);
  if (existingRegistry) assertSheetSchema_(existingRegistry, 'cohorts');
  validateRecordFields_('cohorts', values, originalKey);
  if (!/^\d{4}$/.test(cohortId)) throw new Error('Cohort must be a four-digit year.');
  var sheetName = cohortSheetName_(cohortId);
  return runAuditedMutation_(user, originalKey ? 'UPDATE_COHORT' : 'CREATE_COHORT', { cohort: cohortId }, function() {
    var config = APP_TABLES.cohorts;
    var sheet = getOrCreateManagedSheet_(config);
    assertSheetSchema_(sheet, 'cohorts');
    var headers = getHeaders_(sheet);
    var rowNumber = findRowNumber_(sheet, getTableKey_('cohorts'), cohortId);
    if (!originalKey && rowNumber > 0) throw new Error('This cohort already exists.');
    ensureCohortSheet_(cohortId);
    var existing = rowNumber > 0 ? findRecordByValue_(sheet, 'Cohort', cohortId) : null;
    var rowValues = {
      Cohort: cohortId,
      SheetName: sheetName,
      Status: text_(values.Status) || 'Active',
      DriveRootFolderId: existing ? text_(existing.DriveRootFolderId) : '',
      FolderPrefix: existing ? preservedDriveText_(existing.FolderPrefix) : '',
      FolderSuffix: existing ? preservedDriveText_(existing.FolderSuffix) : ''
    };
    var row = headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(rowValues, header) ? rowValues[header] : '';
    });
    if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    return { key: cohortId };
  });
}

function ensureCohortSheet_(cohortId) {
  var sheetName = cohortSheetName_(cohortId);
  if (getSpreadsheet_().getSheetByName(sheetName)) return;
  withSheetLock_(function() {
    var spreadsheet = getSpreadsheet_();
    if (spreadsheet.getSheetByName(sheetName)) return;
    var headers = getTableHeaders_('cohortMembers');
    spreadsheet.insertSheet(sheetName).getRange(1, 1, 1, headers.length).setValues([headers]);
  });
}

function cohortSheetName_(cohortId) {
  var value = text_(cohortId);
  var match = /^COHORT\s*:\s*(\d{4})$/i.exec(value);
  if (match) return 'COHORT: ' + match[1];
  if (!/^\d{4}$/.test(value)) throw new Error('Cohort must be a four-digit year.');
  return 'COHORT: ' + value;
}

function getTableConfig_(entity) {
  var config = APP_TABLES[entity];
  if (!config) throw new Error('Unknown Admin section.');
  return config;
}

function getOrCreateManagedSheet_(config) {
  var spreadsheet = getSpreadsheet_();
  var existing = spreadsheet.getSheetByName(config.sheet);
  if (existing) return existing;
  return withSheetLock_(function() {
    var lockedSpreadsheet = getSpreadsheet_();
    var sheet = lockedSpreadsheet.getSheetByName(config.sheet);
    if (sheet) return sheet;
    sheet = lockedSpreadsheet.insertSheet(config.sheet);
    var headers = config.fields.map(function(field) { return field.name; });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  });
}

function readRecords_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(headerName_);
  assertUniqueHeaders_(headers, sheet.getName());
  return data.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== '' && value !== null; });
  }).map(function(row) {
    var record = {};
    headers.forEach(function(header, index) { record[header] = serializable_(row[index]); });
    return record;
  });
}

function findRecordByValue_(sheet, header, value) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(headerName_);
  var indexes = findHeaderIndexes_(headers, header);
  if (indexes.length !== 1) return null;
  var expected = isEmailIdentifierHeader_(header) ? normalizeEmail_(value) : text_(value);
  for (var rowIndex = 1; rowIndex < data.length; rowIndex++) {
    var actual = isEmailIdentifierHeader_(header) ? normalizeEmail_(data[rowIndex][indexes[0]]) : text_(data[rowIndex][indexes[0]]);
    if (actual === expected) {
      var record = {};
      headers.forEach(function(name, index) { record[name] = data[rowIndex][index]; });
      return record;
    }
  }
  return null;
}

function findRowNumber_(sheet, header, value) {
  if (!sheet || sheet.getLastRow() < 2) return -1;
  var headers = getHeaders_(sheet);
  var indexes = findHeaderIndexes_(headers, header);
  if (indexes.length !== 1) throw new Error('Expected exactly one ' + header + ' column in ' + sheet.getName() + '.');
  var expected = isEmailIdentifierHeader_(header) ? normalizeEmail_(value) : text_(value);
  var values = sheet.getRange(2, indexes[0] + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var index = 0; index < values.length; index++) {
    var actual = isEmailIdentifierHeader_(header) ? normalizeEmail_(values[index][0]) : text_(values[index][0]);
    if (actual === expected) return index + 2;
  }
  return -1;
}

function getPublishedContent_(sheetName, role) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return readRecords_(sheet).filter(function(record) {
    if (!toBoolean_(record.Published)) return false;
    var audience = text_(record.Audience).toLowerCase();
    return !audience || audience === 'all' || audience === 'both' || audience === role || (role === 'staff' && audience === 'staff');
  }).sort(function(left, right) {
    return Number(left['Sort Order'] || 0) - Number(right['Sort Order'] || 0);
  });
}

function getHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(headerName_);
}

function findHeaderIndex_(headers, candidates) {
  for (var index = 0; index < candidates.length; index++) {
    var found = headers.indexOf(candidates[index]);
    if (found >= 0) return found;
  }
  return -1;
}

function findSingleHeaderIndex_(headers, candidates) {
  var matches = [];
  headers.forEach(function(header, index) {
    if (candidates.indexOf(header) >= 0) matches.push(index);
  });
  return matches.length === 1 ? matches[0] : -1;
}

function cohortLoginKeyIndex_(headers) {
  var studentIdIndexes = findHeaderIndexes_(headers, 'StudentId');
  if (studentIdIndexes.length > 0) return studentIdIndexes.length === 1 ? studentIdIndexes[0] : -1;
  return findSingleHeaderIndex_(headers, ['Student Email', 'studentEmail']);
}

function findStudentUserByEmail_(sheet, email) {
  return findRecordByValue_(sheet, 'StudentId', email) || findRecordByValue_(sheet, 'studentEmail', email);
}

function isEmailIdentifierHeader_(header) {
  return String(header).toLowerCase().indexOf('email') >= 0 || header === 'StudentId';
}

function findHeaderIndexes_(headers, header) {
  var indexes = [];
  headers.forEach(function(value, index) { if (value === header) indexes.push(index); });
  return indexes;
}

function assertUniqueHeaders_(headers, sheetName) {
  var seen = {};
  headers.forEach(function(header) {
    if (!header) return;
    if (seen[header]) throw new Error('Duplicate column "' + header + '" in ' + sheetName + '.');
    seen[header] = true;
  });
}

function headerName_(value) { return String(value === null || value === undefined ? '' : value).trim(); }
function text_(value) { return String(value === null || value === undefined ? '' : value).trim(); }
function normalizeEmail_(value) { return text_(value).toLowerCase(); }
function serializable_(value) { return value instanceof Date ? value.toISOString() : value; }
function toBoolean_(value) {
  if (value === true || value === 1) return true;
  return ['1', 'true', 'yes', 'y'].indexOf(text_(value).toLowerCase()) >= 0;
}
function safeCell_(value) {
  if (typeof value === 'boolean' || typeof value === 'number' || value instanceof Date) return value;
  var stringValue = text_(value);
  return /^[=+@-]/.test(stringValue) ? "'" + stringValue : stringValue;
}
function preservedDriveText_(value) {
  var stringValue = String(value === null || value === undefined ? '' : value);
  if (stringValue.charAt(0) === "'" && stringValue.length > 1 && /^[=+@-]/.test(stringValue.charAt(1))) stringValue = stringValue.slice(1);
  return /^[=+@-]/.test(stringValue) ? "'" + stringValue : stringValue;
}
function validateEmail_(value, label) {
  var email = normalizeEmail_(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(label + ' must be a valid email address.');
}

function staffHasAdminAccess_(staff) {
  return toBoolean_(staff.isAdmin) || toBoolean_(staff.isCoordinator);
}

function assertAnotherAdminExists_(sheet, excludedEmail) {
  var hasAnother = readRecords_(sheet).some(function(staff) {
    return normalizeEmail_(staff.EMAIL) !== normalizeEmail_(excludedEmail) && toBoolean_(staff.isStaff) && staffHasAdminAccess_(staff);
  });
  if (!hasAnother) throw new Error('Keep at least one active admin or coordinator account.');
}

var SHEET_LOCK_DEPTH = 0;

function withSheetLock_(work) {
  if (SHEET_LOCK_DEPTH > 0) return work();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  SHEET_LOCK_DEPTH += 1;
  try {
    return work();
  } finally {
    SHEET_LOCK_DEPTH -= 1;
    lock.releaseLock();
  }
}

function retireSheetRow_(sheet, rowNumber) {
  var row = Number(rowNumber);
  if (!sheet || row < 2) throw new Error('Only a data row can be retired.');
  var width = Math.max(sheet.getLastColumn(), 1);
  sheet.getRange(row, 1, 1, width).clearContent();
}

function runAuditedMutation_(user, action, detail, callback) {
  return withSheetLock_(function() {
    return finishAuditedMutation_(user, action, detail, callback);
  });
}

function runAuditedExternal_(user, action, detail, callback) {
  withSheetLock_(function() {
    AuditLog.record(action + '_REQUESTED', detail, user.email, { lockHeld: true });
  });
  try {
    var result = callback();
    try {
      withSheetLock_(function() {
        AuditLog.record(action + '_SUCCEEDED', detail, user.email, { lockHeld: true });
      });
    } catch (auditError) {
      console.error('Mutation succeeded but its completion audit row failed', auditError);
      result = result || {};
      result.auditWarning = true;
    }
    return result;
  } catch (error) {
    try {
      withSheetLock_(function() {
        AuditLog.record(action + '_FAILED', { detail: detail, reason: String(error.message || error) }, user.email, { lockHeld: true });
      });
    } catch (auditError) {
      console.error('Unable to record failed mutation outcome', auditError);
    }
    throw error;
  }
}

function finishAuditedMutation_(user, action, detail, callback) {
  AuditLog.record(action + '_REQUESTED', detail, user.email, { lockHeld: true });
  var result;
  try {
    result = callback();
  } catch (error) {
    try {
      AuditLog.record(action + '_FAILED', { detail: detail, reason: String(error.message || error) }, user.email, { lockHeld: true });
    } catch (auditError) {
      console.error('Unable to record failed mutation outcome', auditError);
    }
    throw error;
  }
  try {
    AuditLog.record(action + '_SUCCEEDED', detail, user.email, { lockHeld: true });
  } catch (auditError) {
    console.error('Mutation succeeded but its completion audit row failed', auditError);
    result = result || {};
    result.auditWarning = true;
  }
  return result;
}
