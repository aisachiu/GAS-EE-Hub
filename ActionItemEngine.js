var ACTION_ITEM_CACHE_PREFIX = 'EE_ACTION_ITEMS_';

function getStudentActionItems_(studentEmail, user) {
  var normalizedStudentId = normalizeEmail_(studentEmail);
  var cached = readActionItemCache_(normalizedStudentId);
  var records = cached;
  if (!records) {
    var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.studentActionItems.sheet);
    if (!sheet || sheet.getLastRow() < 2) return [];
    assertSheetSchema_(sheet, 'studentActionItems');
    records = readRecords_(sheet).filter(function(item) {
      return normalizeEmail_(item.StudentId) === normalizedStudentId;
    });
    cacheStudentActionItems_(normalizedStudentId, records);
  }

  var templateOwners = {};
  var templateTypes = {};
  var templateSheet = getSpreadsheet_().getSheetByName(APP_TABLES.milestoneTemplates.sheet);
  if (templateSheet && templateSheet.getLastRow() > 1) {
    readRecords_(templateSheet).forEach(function(template) {
      templateOwners[text_(template.milestoneId)] = text_(template.mOwner).toLowerCase();
      templateTypes[text_(template.milestoneId)] = text_(template.type).toLowerCase();
    });
  }

  return records.map(function(source) {
    var item = Object.assign({}, source);
    item.TaskId = text_(item.TaskId);
    item.CreatorType = text_(item.CreatorType);
    item.Status = text_(item.Status) || 'Pending';
    item.DueDate = item.DueDate ? serializable_(item.DueDate) : '';
    item.templateType = templateTypes[text_(item.TemplateId)] || '';
    item.mOwner = templateOwners[text_(item.TemplateId)] || '';
    item.canEdit = item.CreatorType === 'Student' && user && user.role === 'student' && normalizeEmail_(item.StudentId) === user.email;
    item.canUpdate = item.canEdit || (item.CreatorType === 'System' && !!user && canCompleteMilestone_(user, item.StudentId, item.mOwner, item.templateType));
    return item;
  }).sort(function(left, right) {
    var leftDate = left.DueDate ? Date.parse(left.DueDate) : Number.MAX_SAFE_INTEGER;
    var rightDate = right.DueDate ? Date.parse(right.DueDate) : Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate || text_(left.TaskId).localeCompare(text_(right.TaskId));
  });
}

function addStudentTodo(title) {
  var user = requireUser_('ADD_STUDENT_TODO');
  if (user.role !== 'student') denyAccess_(user, 'ADD_STUDENT_TODO', 'Student access required.');
  var taskTitle = text_(title);
  if (!taskTitle) throw new Error('To-Do title is required.');
  if (taskTitle.length > 240) throw new Error('To-Do title must be 240 characters or fewer.');

  return runAuditedMutation_(user, 'ADD_STUDENT_TODO', { studentId: user.email }, function() {
    var sheet = getRequiredActionItemsSheet_();
    var values = {
      TaskId: createActionItemId_(),
      StudentId: user.email,
      CreatorType: 'Student',
      TemplateId: '',
      PhaseId: '',
      Title: taskTitle,
      Description: '',
      DueDate: '',
      Status: 'Pending',
      LastUpdated: new Date()
    };
    appendActionItems_(sheet, [values]);
    invalidateActionItemCache_(user.email);
    return { TaskId: values.TaskId };
  });
}

function reorderMilestoneTemplate(templateId, targetPhaseId, beforeTemplateId) {
  var user = requireAdmin_('REORDER_MILESTONE_TEMPLATE');
  var phase = findRecordByValue_(getSpreadsheet_().getSheetByName(APP_TABLES.phases.sheet), 'phaseId', targetPhaseId);
  if (!phase || !toBoolean_(phase.active)) throw new Error('Choose an active phase.');
  return runAuditedMutation_(user, 'REORDER_MILESTONE_TEMPLATE', {
    templateId: text_(templateId), phaseId: text_(targetPhaseId), beforeTemplateId: text_(beforeTemplateId)
  }, function() {
    var sheet = getRequiredActionSheet_('milestoneTemplates');
    var headers = getHeaders_(sheet);
    var templateColumn = requireColumn_(headers, 'milestoneId', sheet.getName());
    var phaseColumn = requireColumn_(headers, 'phase', sheet.getName());
    var rows = sheet.getDataRange().getValues();
    var movingIndex = -1;
    for (var index = 1; index < rows.length; index++) {
      if (text_(rows[index][templateColumn]) === text_(templateId)) { movingIndex = index; break; }
    }
    if (movingIndex < 0) throw new Error('Milestone template not found.');
    var movingRow = rows.splice(movingIndex, 1)[0];
    movingRow[phaseColumn] = text_(targetPhaseId);
    var insertIndex = rows.length;
    if (beforeTemplateId) {
      for (var targetIndex = 1; targetIndex < rows.length; targetIndex++) {
        if (text_(rows[targetIndex][templateColumn]) === text_(beforeTemplateId)) {
          insertIndex = targetIndex;
          break;
        }
      }
    } else {
      for (var phaseIndex = 1; phaseIndex < rows.length; phaseIndex++) {
        if (text_(rows[phaseIndex][phaseColumn]) === text_(targetPhaseId)) insertIndex = phaseIndex + 1;
      }
    }
    rows.splice(insertIndex, 0, movingRow);
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    return {
      moved: true,
      templateId: text_(templateId),
      phaseId: text_(targetPhaseId),
      order: rows.slice(1).map(function(row, rowIndex) {
        return {
          templateId: text_(row[templateColumn]),
          phaseId: text_(row[phaseColumn]),
          position: rowIndex
        };
      })
    };
  });
}

function updateStudentTodo(taskId, title, description) {
  var user = requireUser_('UPDATE_STUDENT_TODO');
  if (user.role !== 'student') denyAccess_(user, 'UPDATE_STUDENT_TODO', 'Student access required.');
  var nextTitle = text_(title);
  if (!nextTitle) throw new Error('To-Do title is required.');
  if (nextTitle.length > 240) throw new Error('To-Do title must be 240 characters or fewer.');

  return runAuditedMutation_(user, 'UPDATE_STUDENT_TODO', { taskId: text_(taskId), studentId: user.email }, function() {
    var item = findActionItem_(taskId);
    requireOwnedStudentTodo_(item, user);
    item.record.Title = nextTitle;
    item.record.Description = text_(description);
    item.record.LastUpdated = new Date();
    writeActionItem_(item);
    invalidateActionItemCache_(user.email);
    return { saved: true };
  });
}

function setActionItemDueDate(taskId, dueDate) {
  var user = requireUser_('SET_ACTION_ITEM_DUE_DATE');
  if (user.role !== 'student') denyAccess_(user, 'SET_ACTION_ITEM_DUE_DATE', 'Student access required.');
  var parsedDate = dueDate ? parseActionDate_(dueDate) : '';
  if (dueDate && !parsedDate) throw new Error('Due date must be a valid date.');

  return runAuditedMutation_(user, 'SET_ACTION_ITEM_DUE_DATE', { taskId: text_(taskId), studentId: user.email }, function() {
    var item = findActionItem_(taskId);
    requireOwnedStudentTodo_(item, user);
    item.record.DueDate = parsedDate;
    item.record.LastUpdated = new Date();
    writeActionItem_(item);
    invalidateActionItemCache_(user.email);
    return { updated: true };
  });
}

function repositionStudentTodo(taskId, targetTaskId, position) {
  var user = requireUser_('REPOSITION_STUDENT_TODO');
  if (user.role !== 'student') denyAccess_(user, 'REPOSITION_STUDENT_TODO', 'Student access required.');
  if (['before', 'after'].indexOf(position) < 0) throw new Error('Position must be before or after.');

  return runAuditedMutation_(user, 'REPOSITION_STUDENT_TODO', {
    taskId: text_(taskId), targetTaskId: text_(targetTaskId), studentId: user.email, position: position
  }, function() {
    var task = findActionItem_(taskId);
    var target = findActionItem_(targetTaskId);
    requireOwnedStudentTodo_(task, user);
    if (normalizeEmail_(target.record.StudentId) !== user.email) throw new Error('The target task belongs to another student.');
    if (!target.record.DueDate) throw new Error('Choose a dated task as the drop target.');
    var targetDate = parseActionDate_(target.record.DueDate);
    var dayOffset = position === 'before' ? -1 : 1;
    task.record.DueDate = addDays_(targetDate, dayOffset);
    task.record.LastUpdated = new Date();
    writeActionItem_(task);
    invalidateActionItemCache_(user.email);
    return { dueDate: serializable_(task.record.DueDate) };
  });
}

function setActionItemStatus(taskId, status, studentEmail, cohortId) {
  var user = requireUser_('SET_ACTION_ITEM_STATUS');
  var targetStudentId = user.role === 'student' ? user.email : normalizeEmail_(studentEmail);
  var item = findActionItem_(taskId);
  if (normalizeEmail_(item.record.StudentId) !== targetStudentId) {
    denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'Task belongs to another student.');
  }
  if (user.role === 'staff') {
    if (!cohortId || !getCohortStudents(cohortId).some(function(student) { return student.email === targetStudentId; })) {
      denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'Student is not in the selected cohort.');
    }
  } else if (user.role !== 'student' || targetStudentId !== user.email) {
    denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'Student access required.');
  }

  var statusField = getFieldConfig_('studentActionItems', 'Status');
  if (!statusField.options.some(function(option) { return option === status; })) throw new Error('Choose a valid task status.');
  requireActionItemStatusPermission_(user, item.record);

  return runAuditedMutation_(user, 'UPDATE_ACTION_ITEM_STATUS', {
    taskId: text_(taskId), studentId: targetStudentId, status: status
  }, function() {
    item.record.Status = status;
    item.record.LastUpdated = new Date();
    writeActionItem_(item);
    invalidateActionItemCache_(targetStudentId);
    return { status: status };
  });
}

function assignMilestonesToStudents(cohortId, selectedStudentIds, baselineAnchorDate) {
  var user = requireAdmin_('ASSIGN_MILESTONES');
  if (!Array.isArray(selectedStudentIds) || !selectedStudentIds.length) throw new Error('Select one or more students.');
  var anchorDate = parseActionDate_(baselineAnchorDate);
  if (!anchorDate) throw new Error('Choose a valid baseline anchor date.');

  return runAuditedMutation_(user, 'ASSIGN_MILESTONES', {
    cohort: text_(cohortId), studentCount: selectedStudentIds.length, anchorDate: serializeDateOnly_(anchorDate)
  }, function() {
    var roster = getCohortSheet_(cohortId);
    assertSheetSchema_(roster, 'cohortMembers');
    var rosterHeaders = getHeaders_(roster);
    var studentColumn = requireColumn_(rosterHeaders, 'StudentId', roster.getName());
    var anchorColumn = requireColumn_(rosterHeaders, 'Anchor_Date', roster.getName());
    var rosterData = roster.getDataRange().getValues();
    var selected = {};
    selectedStudentIds.forEach(function(value) {
      var studentId = normalizeEmail_(value);
      validateEmail_(studentId, 'StudentId');
      if (selected[studentId]) throw new Error('A student was selected more than once.');
      selected[studentId] = true;
    });

    var selectedRows = {};
    for (var rowIndex = 1; rowIndex < rosterData.length; rowIndex++) {
      var studentId = normalizeEmail_(rosterData[rowIndex][studentColumn]);
      if (selected[studentId]) {
        rosterData[rowIndex][anchorColumn] = anchorDate;
        selectedRows[studentId] = true;
      }
    }
    var missingStudents = Object.keys(selected).filter(function(studentId) { return !selectedRows[studentId]; });
    if (missingStudents.length) throw new Error('Students not found in cohort: ' + missingStudents.join(', '));

    var templateSheet = getRequiredActionSheet_('milestoneTemplates');
    var templateRecords = readRecords_(templateSheet);
    if (!templateRecords.length) throw new Error('MILESTONE_TEMPLATES has no milestone templates.');
    var actionSheet = getRequiredActionSheet_('studentActionItems');
    var actionHeaders = getHeaders_(actionSheet);
    var actionRows = actionSheet.getLastRow() > 1 ? actionSheet.getDataRange().getValues() : [actionHeaders];
    var actionHeaderMap = indexHeaders_(actionHeaders);
    var existing = {};
    actionRows.slice(1).forEach(function(row) {
      if (text_(row[actionHeaderMap.CreatorType]) !== 'System') return;
      existing[actionKey_(row[actionHeaderMap.StudentId], row[actionHeaderMap.TemplateId])] = true;
    });

    var newRows = [];
    var now = new Date();
    Object.keys(selected).forEach(function(studentId) {
      templateRecords.forEach(function(template) {
        var pairKey = actionKey_(studentId, template.milestoneId);
        if (existing[pairKey]) return;
        var dueDate = addDays_(anchorDate, -Number(template.offsetDays || 0));
        newRows.push(actionItemRow_(actionHeaders, {
          TaskId: createActionItemId_(),
          StudentId: studentId,
          CreatorType: 'System',
          TemplateId: text_(template.milestoneId),
          PhaseId: text_(template.phase),
          Title: text_(template.milestoneTitle),
          Description: text_(template.milestoneDescription),
          DueDate: dueDate,
          Status: 'Pending',
          LastUpdated: now
        }));
        existing[pairKey] = true;
      });
    });

    roster.getRange(1, 1, rosterData.length, rosterHeaders.length).setValues(rosterData);
    if (newRows.length) actionSheet.getRange(actionSheet.getLastRow() + 1, 1, newRows.length, actionHeaders.length).setValues(newRows);
    Object.keys(selected).forEach(invalidateActionItemCache_);
    return { assignedStudents: Object.keys(selected).length, createdTasks: newRows.length };
  });
}

function setStudentAnchorDate(cohortId, studentId, anchorDateValue) {
  var user = requireAdmin_('SET_STUDENT_ANCHOR_DATE');
  var normalizedStudentId = normalizeEmail_(studentId);
  validateEmail_(normalizedStudentId, 'StudentId');
  var anchorDate = anchorDateValue ? parseActionDate_(anchorDateValue) : '';
  if (anchorDateValue && !anchorDate) throw new Error('Anchor_Date must be a valid date.');
  return runAuditedMutation_(user, 'SET_STUDENT_ANCHOR_DATE', {
    cohort: text_(cohortId), studentId: normalizedStudentId
  }, function() {
    var sheet = getCohortSheet_(cohortId);
    assertSheetSchema_(sheet, 'cohortMembers');
    var headers = getHeaders_(sheet);
    var studentColumn = requireColumn_(headers, 'StudentId', sheet.getName());
    var anchorColumn = requireColumn_(headers, 'Anchor_Date', sheet.getName());
    var rowNumber = findRowNumber_(sheet, 'StudentId', normalizedStudentId);
    if (rowNumber < 0) throw new Error('Student is not in the selected cohort.');
    sheet.getRange(rowNumber, anchorColumn + 1).setValue(anchorDate || '');
    return { saved: true };
  });
}

function syncStudentActionItemDates(studentId, cohortId) {
  var user = requireAdmin_('SYNC_STUDENT_ACTION_DATES');
  var targetStudentId = normalizeEmail_(studentId);
  validateEmail_(targetStudentId, 'StudentId');
  return runAuditedMutation_(user, 'SYNC_STUDENT_ACTION_DATES', { cohort: text_(cohortId), studentId: targetStudentId }, function() {
    var roster = getCohortSheet_(cohortId);
    assertSheetSchema_(roster, 'cohortMembers');
    var rosterData = roster.getDataRange().getValues();
    var rosterHeaders = rosterData[0].map(headerName_);
    var studentColumn = requireColumn_(rosterHeaders, 'StudentId', roster.getName());
    var anchorColumn = requireColumn_(rosterHeaders, 'Anchor_Date', roster.getName());
    var studentRow = -1;
    for (var index = 1; index < rosterData.length; index++) {
      if (normalizeEmail_(rosterData[index][studentColumn]) === targetStudentId) { studentRow = index; break; }
    }
    if (studentRow < 0) throw new Error('Student is not in the selected cohort.');
    var anchorDate = parseActionDate_(rosterData[studentRow][anchorColumn]);
    if (!anchorDate) throw new Error('Set the student Anchor_Date before syncing.');

    var actionSheet = getRequiredActionSheet_('studentActionItems');
    assertSheetSchema_(actionSheet, 'studentActionItems');
    var templateSheet = getRequiredActionSheet_('milestoneTemplates');
    assertSheetSchema_(templateSheet, 'milestoneTemplates');
    var templatesById = {};
    readRecords_(templateSheet).forEach(function(template) { templatesById[text_(template.milestoneId)] = template; });
    var actionHeaders = getHeaders_(actionSheet);
    var actionMap = indexHeaders_(actionHeaders);
    var actionData = actionSheet.getDataRange().getValues();
    var now = new Date();
    var updated = 0;
    for (var taskRow = 1; taskRow < actionData.length; taskRow++) {
      var row = actionData[taskRow];
      if (normalizeEmail_(row[actionMap.StudentId]) !== targetStudentId || text_(row[actionMap.CreatorType]) !== 'System') continue;
      var template = templatesById[text_(row[actionMap.TemplateId])];
      if (!template) continue;
      row[actionMap.DueDate] = addDays_(anchorDate, -Number(template.offsetDays || 0));
      row[actionMap.LastUpdated] = now;
      updated++;
    }
    if (updated) actionSheet.getRange(1, 1, actionData.length, actionHeaders.length).setValues(actionData);
    invalidateActionItemCache_(targetStudentId);
    return { updated: updated };
  });
}

function getRequiredActionSheet_(entity) {
  var config = getTableConfig_(entity);
  var sheet = getSpreadsheet_().getSheetByName(config.sheet);
  if (!sheet) throw new Error(config.sheet + ' is missing. Use EE System > Create Missing Sheets first.');
  assertSheetSchema_(sheet, entity);
  return sheet;
}

function findActionItem_(taskId) {
  var sheet = getRequiredActionSheet_('studentActionItems');
  var rowNumber = findRowNumber_(sheet, 'TaskId', text_(taskId));
  if (rowNumber < 0) throw new Error('Action item not found.');
  var headers = getHeaders_(sheet);
  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var record = {};
  headers.forEach(function(header, index) { record[header] = values[index]; });
  return { sheet: sheet, headers: headers, rowNumber: rowNumber, record: record };
}

function writeActionItem_(item) {
  var row = item.headers.map(function(header) { return item.record[header] === undefined ? '' : item.record[header]; });
  item.sheet.getRange(item.rowNumber, 1, 1, item.headers.length).setValues([row]);
}

function actionItemRow_(headers, values) {
  return headers.map(function(header) { return values[header] === undefined ? '' : values[header]; });
}

function requireOwnedStudentTodo_(item, user) {
  if (item.record.CreatorType !== 'Student' || normalizeEmail_(item.record.StudentId) !== user.email) {
    denyAccess_(user, 'UPDATE_STUDENT_TODO', 'This is not your editable To-Do.');
  }
}

function requireActionItemStatusPermission_(user, item) {
  if (item.CreatorType === 'Student') {
    if (user.role !== 'student' || normalizeEmail_(item.StudentId) !== user.email) denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'Only the creating student can change this To-Do.');
    return;
  }
  if (item.CreatorType !== 'System') throw new Error('Unsupported action-item creator type.');
  var template = findRecordByValue_(getRequiredActionSheet_('milestoneTemplates'), 'milestoneId', item.TemplateId);
  if (!template || !canCompleteMilestone_(user, item.StudentId, text_(template.mOwner).toLowerCase(), text_(template.type).toLowerCase())) {
    denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'Only the milestone owner can change this status.');
  }
}

function findSystemActionItem_(studentEmail, templateId) {
  var sheet = getRequiredActionItemsSheet_();
  var headers = getHeaders_(sheet);
  var studentColumn = requireColumn_(headers, 'StudentId', sheet.getName());
  var templateColumn = requireColumn_(headers, 'TemplateId', sheet.getName());
  var creatorColumn = requireColumn_(headers, 'CreatorType', sheet.getName());
  var data = sheet.getDataRange().getValues();
  for (var index = 1; index < data.length; index++) {
    if (normalizeEmail_(data[index][studentColumn]) !== normalizeEmail_(studentEmail)) continue;
    if (text_(data[index][templateColumn]) !== text_(templateId)) continue;
    if (text_(data[index][creatorColumn]) !== 'System') continue;
    var record = {};
    headers.forEach(function(header, column) { record[header] = data[index][column]; });
    return { sheet: sheet, headers: headers, rowNumber: index + 1, record: record };
  }
  return null;
}

function createActionItemId_() {
  return 'ACT_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}

function parseActionDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text_(value));
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function serializeDateOnly_(value) {
  return value.getUTCFullYear() + '-' + String(value.getUTCMonth() + 1).padStart(2, '0') + '-' + String(value.getUTCDate()).padStart(2, '0');
}

function addDays_(date, days) {
  var result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() + Number(days || 0));
  return result;
}

function indexHeaders_(headers) {
  var indexes = {};
  headers.forEach(function(header, index) { indexes[header] = index; });
  return indexes;
}

function requireColumn_(headers, name, sheetName) {
  var indexes = findHeaderIndexes_(headers, name);
  if (indexes.length !== 1) throw new Error(sheetName + ' needs exactly one ' + name + ' column.');
  return indexes[0];
}

function getRequiredActionItemsSheet_() {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.studentActionItems.sheet);
  if (!sheet) throw new Error('STUDENT_ACTION_ITEMS is missing. Use EE System > Create Missing Sheets first.');
  assertSheetSchema_(sheet, 'studentActionItems');
  return sheet;
}

function appendActionItems_(sheet, records) {
  if (!records.length) return;
  var headers = getHeaders_(sheet);
  assertSheetSchema_(sheet, 'studentActionItems');
  var rows = records.map(function(record) { return actionItemRow_(headers, record); });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function actionKey_(studentId, templateId) {
  return normalizeEmail_(studentId) + '\u0000' + text_(templateId);
}

function readActionItemCache_(studentId) {
  try {
    var cache = CacheService.getScriptCache();
    var value = cache.get(actionItemCacheKey_(studentId));
    return value ? JSON.parse(value) : null;
  } catch (error) { return null; }
}

function cacheStudentActionItems_(studentId, items) {
  try { CacheService.getScriptCache().put(actionItemCacheKey_(studentId), JSON.stringify(items), 300); }
  catch (error) { console.warn('Action-item cache skipped', error); }
}

function invalidateActionItemCache_(studentId) {
  try { CacheService.getScriptCache().remove(actionItemCacheKey_(studentId)); }
  catch (error) { console.warn('Action-item cache invalidation skipped', error); }
}

function actionItemCacheKey_(studentId) {
  return ACTION_ITEM_CACHE_PREFIX + normalizeEmail_(studentId).replace(/[^a-z0-9]/g, '_');
}
