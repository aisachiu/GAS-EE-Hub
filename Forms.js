var FORM_SYSTEM_COLUMNS = ['StudentId', 'FormVersion', 'Status', 'SubmittedAt', 'LastUpdated'];
var FORM_FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'checkbox'];

function formSheetName_(milestoneId) {
  var id = text_(milestoneId);
  if (!/^[a-z][a-z0-9_-]*$/i.test(id)) throw new Error('Milestone id must start with a letter and use only letters, numbers, hyphens, or underscores.');
  return 'FORM: ' + id;
}

function lintFormSource_(html, js) {
  var htmlText = String(html || '');
  var jsText = String(js || '');
  if (htmlText.length > 40000) throw new Error('HTML must be 40,000 characters or fewer.');
  if (jsText.length > 20000) throw new Error('JavaScript must be 20,000 characters or fewer.');
  if (/<\s*script/i.test(htmlText) || /javascript\s*:/i.test(htmlText)) throw new Error('Put scripts in the JavaScript panel, not in the HTML.');
  var banned = [/google\s*\.\s*script/i, /\beval\s*\(/, /\bFunction\s*\(/, /\bimport\s*\(/, /\bglobalThis\b/, /\bdocument\s*\./, /\bwindow\s*\./, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bparent\s*\./, /\btop\s*\./];
  banned.forEach(function(pattern) {
    if (pattern.test(jsText)) throw new Error('Custom code cannot access the page, the network, or google.script. Use EEForm only.');
  });
}

function normalizeFormFields_(fields) {
  if (!Array.isArray(fields) || !fields.length) throw new Error('Add at least one field.');
  var seen = {};
  return fields.map(function(field) {
    var name = text_(field.name);
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(name)) throw new Error('Field names must start with a letter and use only letters, numbers, or underscores.');
    if (FORM_SYSTEM_COLUMNS.indexOf(name) >= 0) throw new Error(name + ' is reserved.');
    if (seen[name]) throw new Error('Duplicate field ' + name + '.');
    seen[name] = true;
    var type = text_(field.type);
    if (FORM_FIELD_TYPES.indexOf(type) < 0) throw new Error('Unsupported field type for ' + name + '.');
    var optionsFrom = text_(field.optionsFrom);
    if (optionsFrom && optionsFrom !== 'subjects') throw new Error('optionsFrom must be subjects.');
    var options = Array.isArray(field.options) ? field.options.map(text_).filter(Boolean).slice(0, 40) : [];
    if (type === 'select' && !optionsFrom && !options.length) throw new Error(name + ' needs options.');
    var maxLength = Number(field.maxLength);
    if (!maxLength || maxLength < 1) maxLength = type === 'textarea' ? 2000 : 240;
    return {
      name: name,
      label: text_(field.label) || name,
      type: type,
      required: field.required === true || text_(field.required).toLowerCase() === 'true',
      options: options,
      optionsFrom: optionsFrom,
      maxLength: Math.min(5000, maxLength)
    };
  });
}

function starterSubjectForm_() {
  return {
    milestoneId: 'm1',
    status: 'Draft',
    version: 0,
    fields: [
      { name: 'choice1', label: '1st choice', type: 'select', required: true, options: [], optionsFrom: 'subjects', maxLength: 120 },
      { name: 'choice2', label: '2nd choice', type: 'select', required: false, options: [], optionsFrom: 'subjects', maxLength: 120 },
      { name: 'choice3', label: '3rd choice', type: 'select', required: false, options: [], optionsFrom: 'subjects', maxLength: 120 },
      { name: 'interdisciplinary', label: 'Interdisciplinary EE', type: 'checkbox', required: false, options: [], optionsFrom: '', maxLength: 8 },
      { name: 'theme', label: 'Global theme', type: 'select', required: false, options: ['Sustainability & environment', 'Conflict & peace', 'Health & wellbeing', 'Equality & inclusion'], optionsFrom: '', maxLength: 120 },
      { name: 'motivation', label: 'Why these subjects?', type: 'textarea', required: true, options: [], optionsFrom: '', maxLength: 500 }
    ],
    html: '<div class="form-grid"><label class="field">1st choice<select name="choice1"></select></label><label class="field">2nd choice<select name="choice2"></select></label><label class="field">3rd choice<select name="choice3"></select></label></div><label class="field check"><input type="checkbox" name="interdisciplinary"> I am interested in an interdisciplinary Extended Essay</label><label class="field" id="theme-field">Global theme<select name="theme"></select></label><label class="field wide">Why are you drawn to these subjects?<textarea name="motivation" maxlength="500"></textarea></label>',
    js: [
      'var root = EEForm.root;',
      'var names = ["choice1", "choice2", "choice3"];',
      'var selects = names.map(function(name) { return root.querySelector("[name=\\"" + name + "\\"]"); });',
      'function syncChoices() {',
      '  var chosen = selects.map(function(select) { return select ? select.value : ""; });',
      '  selects.forEach(function(select, index) {',
      '    if (!select) return;',
      '    Array.prototype.forEach.call(select.options, function(option) {',
      '      option.disabled = !!(option.value && chosen.some(function(value, other) { return other !== index && value === option.value; }));',
      '    });',
      '  });',
      '}',
      'selects.forEach(function(select) { if (select) select.addEventListener("change", syncChoices); });',
      'syncChoices();',
      'var box = root.querySelector("[name=\\"interdisciplinary\\"]");',
      'var theme = root.querySelector("#theme-field");',
      'function toggleTheme() { if (theme) theme.hidden = !(box && box.checked); }',
      'if (box) box.addEventListener("change", toggleTheme);',
      'toggleTheme();'
    ].join('\n'),
    submitCompletes: true
  };
}

function readFormDefinitionRecord_(milestoneId) {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.formDefinitions.sheet);
  if (!sheet) return null;
  assertSheetSchema_(sheet, 'formDefinitions');
  return findRecordByValue_(sheet, 'milestoneId', text_(milestoneId));
}

function definitionFromRecord_(record) {
  var fields = [];
  try { fields = JSON.parse(text_(record.fieldsJson) || '[]'); } catch (error) { throw new Error('Stored form fields are not valid JSON.'); }
  return {
    milestoneId: text_(record.milestoneId),
    status: text_(record.status) || 'Draft',
    version: Number(record.version) || 0,
    fields: normalizeFormFields_(fields),
    html: String(record.html || ''),
    js: String(record.js || ''),
    submitCompletes: toBoolean_(record.submitCompletes),
    lastUpdated: record.LastUpdated ? serializable_(record.LastUpdated) : ''
  };
}

function requireFormTemplate_(milestoneId) {
  var template = findRecordByValue_(getRequiredActionSheet_('milestoneTemplates'), 'milestoneId', text_(milestoneId));
  if (!template || text_(template.type).toLowerCase() !== 'form') throw new Error('Choose a form milestone.');
  return template;
}

function writeFormDefinition_(user, definition, status, version) {
  var sheet = getOrCreateManagedSheet_(APP_TABLES.formDefinitions);
  assertSheetSchema_(sheet, 'formDefinitions');
  var headers = getHeaders_(sheet);
  var rowNumber = findRowNumber_(sheet, 'milestoneId', definition.milestoneId);
  var existing = rowNumber > 0 ? definitionFromRecord_(readFormDefinitionRecord_(definition.milestoneId)) : null;
  var nextVersion = version === undefined || version === null ? (existing ? existing.version : 0) : version;
  var nextStatus = status || (existing ? existing.status : 'Draft');
  if (!status && nextStatus === 'Published' && existing && fieldNames_(existing.fields).join('\u0000') !== fieldNames_(definition.fields).join('\u0000')) {
    nextStatus = 'Draft';
  }
  var values = {
    milestoneId: definition.milestoneId,
    status: nextStatus,
    version: version,
    fieldsJson: JSON.stringify(definition.fields),
    html: definition.html,
    js: definition.js,
    submitCompletes: definition.submitCompletes,
    LastUpdated: new Date(),
    UpdatedBy: user.email
  };
  values.version = nextVersion;
  values.status = nextStatus;
  var row = headers.map(function(header) { return values[header] === undefined ? '' : values[header]; });
  if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return nextStatus;
}

function fieldNames_(fields) {
  return fields.map(function(field) { return field.name; });
}

function listFormMilestones() {
  requireAdmin_('LIST_FORMS');
  var templates = readRecords_(getRequiredActionSheet_('milestoneTemplates')).filter(function(template) {
    return text_(template.type).toLowerCase() === 'form';
  });
  return templates.map(function(template) {
    var record = readFormDefinitionRecord_(template.milestoneId);
    return {
      milestoneId: text_(template.milestoneId),
      title: text_(template.milestoneTitle),
      phase: text_(template.phase),
      status: record ? text_(record.status) : 'Not started',
      version: record ? Number(record.version) || 0 : 0
    };
  });
}

function getFormDesigner(milestoneId) {
  var user = requireAdmin_('VIEW_FORM_DESIGN');
  var template = requireFormTemplate_(milestoneId);
  var record = readFormDefinitionRecord_(milestoneId);
  var definition = record ? definitionFromRecord_(record) : starterFor_(text_(template.milestoneId));
  var sheet = getSpreadsheet_().getSheetByName(formSheetName_(milestoneId));
  return {
    milestoneId: text_(template.milestoneId),
    title: text_(template.milestoneTitle),
    definition: definition,
    sheetName: formSheetName_(milestoneId),
    responseCount: sheet && sheet.getLastRow() > 1 ? sheet.getLastRow() - 1 : 0,
    designer: user.email
  };
}

function starterFor_(milestoneId) {
  if (milestoneId === 'm1') return starterSubjectForm_();
  return {
    milestoneId: milestoneId,
    status: 'Draft',
    version: 0,
    fields: [{ name: 'response', label: 'Response', type: 'textarea', required: true, options: [], optionsFrom: '', maxLength: 2000 }],
    html: '<label class="field wide">Response<textarea name="response"></textarea></label>',
    js: '',
    submitCompletes: true
  };
}

function payloadToDefinition_(milestoneId, payload) {
  var source = payload || {};
  var definition = {
    milestoneId: text_(milestoneId),
    fields: normalizeFormFields_(source.fields),
    html: String(source.html || ''),
    js: String(source.js || ''),
    submitCompletes: source.submitCompletes !== false && text_(source.submitCompletes).toLowerCase() !== 'false'
  };
  lintFormSource_(definition.html, definition.js);
  return definition;
}

function saveFormDraft(milestoneId, payload) {
  var user = requireAdmin_('SAVE_FORM_DRAFT');
  requireFormTemplate_(milestoneId);
  var definition = payloadToDefinition_(milestoneId, payload);
  return runAuditedMutation_(user, 'SAVE_FORM_DRAFT', { milestoneId: definition.milestoneId, fields: fieldNames_(definition.fields) }, function() {
    var status = writeFormDefinition_(user, definition, '');
    return { status: status, milestoneId: definition.milestoneId };
  });
}

function publishForm(milestoneId, payload) {
  var user = requireAdmin_('PUBLISH_FORM');
  requireFormTemplate_(milestoneId);
  var definition = payload ? payloadToDefinition_(milestoneId, payload) : null;
  return runAuditedMutation_(user, 'FORM_PUBLISH', { milestoneId: text_(milestoneId) }, function() {
    var existing = readFormDefinitionRecord_(milestoneId);
    if (!definition) {
      if (!existing) throw new Error('Save the form before publishing.');
      definition = definitionFromRecord_(existing);
    }
    var sheetName = formSheetName_(definition.milestoneId);
    migrateFormSheet_(sheetName, fieldNames_(definition.fields));
    var version = (existing ? Number(existing.version) || 0 : 0) + 1;
    writeFormDefinition_(user, definition, 'Published', version);
    return { status: 'Published', version: version, sheetName: sheetName };
  });
}

function migrateFormSheet_(sheetName, customNames) {
  var expected = FORM_SYSTEM_COLUMNS.concat(customNames);
  var spreadsheet = getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
    return;
  }
  var actual = getHeaders_(sheet);
  if (sheet.getLastRow() < 2) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }
  if (actual.join('\u0000') === expected.join('\u0000')) return;
  var systemOk = FORM_SYSTEM_COLUMNS.every(function(header, index) { return actual[index] === header; });
  if (!systemOk) throw new Error(sheetName + ' system columns cannot be changed.');
  var currentCustom = actual.slice(FORM_SYSTEM_COLUMNS.length);
  var appended = customNames.slice(0, currentCustom.length).every(function(name, index) { return name === currentCustom[index]; });
  if (!appended || customNames.length < currentCustom.length) {
    throw new Error('Published fields can only be appended. Rename or delete is blocked while responses exist.');
  }
  if (customNames.length > currentCustom.length) {
    var additions = customNames.slice(currentCustom.length);
    sheet.getRange(1, actual.length + 1, 1, additions.length).setValues([additions]);
  }
}

function assertFormResponseSchema_(sheet, fields) {
  var expected = FORM_SYSTEM_COLUMNS.concat(fieldNames_(fields));
  var actual = getHeaders_(sheet);
  if (actual.join('\u0000') !== expected.join('\u0000')) {
    throw new Error(sheet.getName() + ' does not match the published form. Ask a coordinator to publish again.');
  }
}

function subjectOptionNames_() {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.subjects.sheet);
  if (!sheet) return [];
  return readRecords_(sheet).filter(function(subject) {
    return subject.Active === '' || subject.Active === undefined || toBoolean_(subject.Active);
  }).map(function(subject) { return text_(subject.Name); }).filter(Boolean);
}

function resolveFieldOptions_(fields) {
  var subjects = null;
  return fields.map(function(field) {
    var copy = {
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      maxLength: field.maxLength,
      options: field.options.slice()
    };
    if (field.optionsFrom === 'subjects') {
      if (!subjects) subjects = subjectOptionNames_();
      copy.options = subjects;
    }
    return copy;
  });
}

function publishedFormIds_() {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.formDefinitions.sheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  assertSheetSchema_(sheet, 'formDefinitions');
  return readRecords_(sheet).filter(function(record) {
    return text_(record.status) === 'Published';
  }).map(function(record) { return text_(record.milestoneId); });
}

function getStudentForm(milestoneId) {
  var user = requireUser_('VIEW_FORM');
  if (user.role !== 'student') denyAccess_(user, 'VIEW_FORM', 'Student access required.');
  var record = readFormDefinitionRecord_(milestoneId);
  if (!record || text_(record.status) !== 'Published') throw new Error('This form is not published yet.');
  var definition = definitionFromRecord_(record);
  var template = requireFormTemplate_(milestoneId);
  var placement = findStudentPlacement_(user.email) || { displayName: user.displayName, subject: '' };
  var sheet = getSpreadsheet_().getSheetByName(formSheetName_(milestoneId));
  var response = null;
  if (sheet && sheet.getLastRow() > 1) {
    assertFormResponseSchema_(sheet, definition.fields);
    var rowNumber = findRowNumber_(sheet, 'StudentId', user.email);
    if (rowNumber > 0) response = readFormRow_(sheet, rowNumber, definition.fields);
  }
  return {
    milestoneId: definition.milestoneId,
    title: text_(template.milestoneTitle),
    version: definition.version,
    html: definition.html,
    js: definition.js,
    fields: resolveFieldOptions_(definition.fields),
    response: response,
    student: { displayName: placement.displayName || user.displayName, subject: placement.subject || '' }
  };
}

function readFormRow_(sheet, rowNumber, fields) {
  var headers = getHeaders_(sheet);
  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var record = {};
  headers.forEach(function(header, index) { record[header] = values[index]; });
  var answers = {};
  fields.forEach(function(field) { answers[field.name] = record[field.name] === undefined || record[field.name] === null ? '' : String(record[field.name]); });
  return {
    values: answers,
    status: text_(record.Status),
    version: Number(record.FormVersion) || 0,
    lastUpdated: record.LastUpdated ? serializable_(record.LastUpdated) : ''
  };
}

function saveStudentForm(milestoneId, payload) {
  var user = requireUser_('SAVE_FORM');
  if (user.role !== 'student') denyAccess_(user, 'SAVE_FORM', 'Student access required.');
  var source = payload || {};
  var submit = source.submit === true || text_(source.submit).toLowerCase() === 'true';
  var record = readFormDefinitionRecord_(milestoneId);
  if (!record || text_(record.status) !== 'Published') throw new Error('This form is not published yet.');
  var definition = definitionFromRecord_(record);
  var answers = validateFormAnswers_(definition.fields, source.values || {}, submit);
  var clientToken = text_(source.lastUpdated);

  return runAuditedMutation_(user, submit ? 'FORM_SUBMIT' : 'FORM_DRAFT', {
    milestoneId: definition.milestoneId,
    studentId: user.email,
    version: definition.version,
    fields: fieldNames_(definition.fields),
    hash: formHash_(answers)
  }, function() {
    var fresh = readFormDefinitionRecord_(milestoneId);
    if (!fresh || Number(fresh.version) !== definition.version || text_(fresh.status) !== 'Published') {
      throw new Error('This form was republished. Reload it and try again.');
    }
    var sheet = getSpreadsheet_().getSheetByName(formSheetName_(milestoneId));
    if (!sheet) throw new Error('The form response sheet is missing.');
    assertFormResponseSchema_(sheet, definition.fields);
    var headers = getHeaders_(sheet);
    var rowNumber = findRowNumber_(sheet, 'StudentId', user.email);
    if (rowNumber > 0) {
      var current = readFormRow_(sheet, rowNumber, definition.fields);
      if (text_(current.lastUpdated) !== clientToken) {
        throw new Error('This form changed in another tab. Reload it and try again.');
      }
    } else if (clientToken) {
      throw new Error('This form changed in another tab. Reload it and try again.');
    }
    var now = new Date();
    var stored = {
      StudentId: user.email,
      FormVersion: definition.version,
      Status: submit ? 'Submitted' : 'Draft',
      SubmittedAt: submit ? now : '',
      LastUpdated: now
    };
    definition.fields.forEach(function(field) { stored[field.name] = safeCell_(answers[field.name]); });
    if (rowNumber > 0 && !submit) {
      var existingValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
      var submittedIndex = headers.indexOf('SubmittedAt');
      if (text_(existingValues[headers.indexOf('Status')]) === 'Submitted') stored.SubmittedAt = existingValues[submittedIndex];
    }
    var row = headers.map(function(header) { return stored[header] === undefined ? '' : stored[header]; });
    if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    if (submit && definition.submitCompletes) {
      var actionItem = findSystemActionItem_(user.email, definition.milestoneId);
      if (actionItem) {
        actionItem.record.Status = 'Completed';
        actionItem.record.LastUpdated = now;
        stampActionItemActors_(actionItem.record, user.email, false);
        writeActionItem_(actionItem);
        invalidateActionItemCache_(user.email);
      }
    }
    return { status: stored.Status, lastUpdated: serializable_(now) };
  });
}

function validateFormAnswers_(fields, values, submit) {
  var answers = {};
  fields.forEach(function(field) {
    var raw = values[field.name];
    var value = field.type === 'checkbox' ? (raw === true || ['true', 'yes', '1'].indexOf(text_(raw).toLowerCase()) >= 0 ? 'Yes' : 'No') : text_(raw);
    if (submit && field.required && (field.type === 'checkbox' ? value !== 'Yes' : !value)) throw new Error(field.label + ' is required.');
    if (value && field.type !== 'checkbox' && value.length > field.maxLength) throw new Error(field.label + ' is too long.');
    if (field.type === 'number' && value && !isFinite(Number(value))) throw new Error(field.label + ' must be a number.');
    if (field.type === 'date' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(field.label + ' must be a date.');
    if (field.type === 'select' && value) {
      var options = field.optionsFrom === 'subjects' ? subjectOptionNames_() : field.options;
      if (options.indexOf(value) < 0) throw new Error(field.label + ' is not an available choice.');
    }
    answers[field.name] = value;
  });
  return answers;
}

function formHash_(answers) {
  var text = JSON.stringify(answers);
  var hash = 0;
  for (var index = 0; index < text.length; index++) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  return String(hash);
}

function getFormResponse(milestoneId, studentEmail) {
  var user = requireStaff_('VIEW_FORM_RESPONSE');
  var email = normalizeEmail_(studentEmail);
  var record = readFormDefinitionRecord_(milestoneId);
  if (!record || text_(record.status) !== 'Published') throw new Error('This form is not published yet.');
  var definition = definitionFromRecord_(record);
  var placement = findStudentPlacement_(email);
  if (!placement) throw new Error('Student was not found on a cohort roster.');
  var allowed = user.permissions.canAdmin || placement.supervisorId === user.email || !placement.supervisorId;
  if (!allowed) denyAccess_(user, 'VIEW_FORM_RESPONSE', 'Form answers are visible to the assigned supervisor.');
  var sheet = getSpreadsheet_().getSheetByName(formSheetName_(milestoneId));
  if (!sheet || sheet.getLastRow() < 2) return { milestoneId: definition.milestoneId, fields: resolveFieldOptions_(definition.fields), response: null };
  assertFormResponseSchema_(sheet, definition.fields);
  var rowNumber = findRowNumber_(sheet, 'StudentId', email);
  return {
    milestoneId: definition.milestoneId,
    title: text_(requireFormTemplate_(milestoneId).milestoneTitle),
    fields: resolveFieldOptions_(definition.fields),
    response: rowNumber > 0 ? readFormRow_(sheet, rowNumber, definition.fields) : null
  };
}

function seedPublishedSubjectForm_() {
  if (readFormDefinitionRecord_('m1')) return;
  var templateSheet = getSpreadsheet_().getSheetByName(APP_TABLES.milestoneTemplates.sheet);
  if (!templateSheet) return;
  var template = findRecordByValue_(templateSheet, 'milestoneId', 'm1');
  if (!template || text_(template.type).toLowerCase() !== 'form') return;
  var starter = starterSubjectForm_();
  var user = { email: 'dev@vsa.local' };
  writeFormDefinition_(user, starter, 'Draft');
  migrateFormSheet_(formSheetName_('m1'), fieldNames_(starter.fields));
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.formDefinitions.sheet);
  var headers = getHeaders_(sheet);
  var rowNumber = findRowNumber_(sheet, 'milestoneId', 'm1');
  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  values[headers.indexOf('status')] = 'Published';
  values[headers.indexOf('version')] = 1;
  sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
}
