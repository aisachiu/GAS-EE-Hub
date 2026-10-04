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

function stampActionItemActors_(record, actorEmail, creating) {
  var email = normalizeEmail_(actorEmail);
  if (creating) record.CreatedBy = email;
  record.UpdatedBy = email;
  return record;
}

function prepareStudentTodoInput_(title, phaseId) {
  var taskTitle = text_(title);
  if (!taskTitle) throw new Error('To-Do title is required.');
  if (taskTitle.length > 240) throw new Error('To-Do title must be 240 characters or fewer.');
  var phase = text_(phaseId);
  if (phase) {
    var knownPhase = findRecordByValue_(getSpreadsheet_().getSheetByName(APP_TABLES.phases.sheet), 'phaseId', phase);
    if (!knownPhase || !toBoolean_(knownPhase.active)) throw new Error('Choose an active phase for this to-do.');
  }
  return { title: taskTitle, phase: phase };
}

function addStudentTodo(title, phaseId) {
  var user = requireUser_('ADD_STUDENT_TODO');
  if (user.role !== 'student') denyAccess_(user, 'ADD_STUDENT_TODO', 'Student access required.');
  var input = prepareStudentTodoInput_(title, phaseId);

  return runAuditedMutation_(user, 'ADD_STUDENT_TODO', { studentId: user.email, phaseId: input.phase }, function() {
    var sheet = getRequiredActionItemsSheet_();
    var values = stampActionItemActors_({
      TaskId: createActionItemId_(),
      StudentId: user.email,
      CreatorType: 'Student',
      TemplateId: '',
      PhaseId: input.phase,
      Title: input.title,
      Description: '',
      DueDate: '',
      Status: 'Pending',
      LastUpdated: new Date()
    }, user.email, true);
    appendActionItems_(sheet, [values]);
    invalidateActionItemCache_(user.email);
    return { TaskId: values.TaskId };
  });
}

function addStaffStudentTodo(title, phaseId, studentEmail, cohortId, viewAs) {
  var user = requireStaff_('ADD_STAFF_STUDENT_TODO');
  var input = prepareStudentTodoInput_(title, phaseId);
  var context = staffStudentContext_(user, studentEmail, cohortId, 'ADD_STAFF_STUDENT_TODO', viewAs);
  if (!staffMayAddStudentTodo_(user, context)) {
    denyAccess_(user, 'ADD_STAFF_STUDENT_TODO', 'You cannot add a to-do for this student.');
  }
  var studentId = context.email;

  return runAuditedMutation_(user, 'ADD_STAFF_STUDENT_TODO', {
    studentId: studentId, phaseId: input.phase, cohort: text_(cohortId)
  }, function() {
    var sheet = getRequiredActionItemsSheet_();
    var values = stampActionItemActors_({
      TaskId: createActionItemId_(),
      StudentId: studentId,
      CreatorType: 'Student',
      TemplateId: '',
      PhaseId: input.phase,
      Title: input.title,
      Description: '',
      DueDate: '',
      Status: 'Pending',
      LastUpdated: new Date()
    }, user.email, true);
    appendActionItems_(sheet, [values]);
    invalidateActionItemCache_(studentId);
    return { TaskId: values.TaskId, StudentId: studentId };
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
    invalidateJourneyCatalog_();
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
    stampActionItemActors_(item.record, user.email, false);
    writeActionItem_(item);
    invalidateActionItemCache_(user.email);
    return { saved: true };
  });
}

function saveStudentTodo(taskId, title, description, dueDate) {
  var user = requireUser_('UPDATE_STUDENT_TODO');
  if (user.role !== 'student') denyAccess_(user, 'UPDATE_STUDENT_TODO', 'Student access required.');
  var nextTitle = text_(title);
  if (!nextTitle) throw new Error('To-Do title is required.');
  if (nextTitle.length > 240) throw new Error('To-Do title must be 240 characters or fewer.');
  var parsedDate = dueDate ? parseActionDate_(dueDate) : '';
  if (dueDate && !parsedDate) throw new Error('Due date must be a valid date.');

  return runAuditedMutation_(user, 'UPDATE_STUDENT_TODO', { taskId: text_(taskId), studentId: user.email }, function() {
    var item = findActionItem_(taskId);
    requireOwnedStudentTodo_(item, user);
    item.record.Title = nextTitle;
    item.record.Description = text_(description);
    item.record.DueDate = parsedDate;
    item.record.LastUpdated = new Date();
    stampActionItemActors_(item.record, user.email, false);
    writeActionItem_(item);
    invalidateActionItemCache_(user.email);
    return { saved: true, dueDate: parsedDate ? serializable_(parsedDate) : '' };
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
    stampActionItemActors_(item.record, user.email, false);
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
    stampActionItemActors_(task.record, user.email, false);
    writeActionItem_(task);
    invalidateActionItemCache_(user.email);
    return { dueDate: serializable_(task.record.DueDate) };
  });
}

function setActionItemStatus(taskId, status, studentEmail, cohortId, viewAs) {
  var user = requireUser_('SET_ACTION_ITEM_STATUS');
  var targetStudentId = user.role === 'student' ? user.email : normalizeEmail_(studentEmail);
  var item = findActionItem_(taskId);
  if (normalizeEmail_(item.record.StudentId) !== targetStudentId) {
    denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'Task belongs to another student.');
  }
  var staffContext = null;
  if (user.role === 'staff') {
    staffContext = staffStudentContext_(user, targetStudentId, cohortId, 'SET_ACTION_ITEM_STATUS', viewAs);
    if (text_(item.record.CreatorType) === 'Student') {
      denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'Staff can only read student to-dos.');
    }
  } else if (user.role !== 'student' || targetStudentId !== user.email) {
    denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'Student access required.');
  }

  var statusField = getFieldConfig_('studentActionItems', 'Status');
  if (!statusField.options.some(function(option) { return option === status; })) throw new Error('Choose a valid task status.');
  if (staffContext) {
    if (!staffMayUpdateSystemItem_(user, staffContext, item.record)) {
      denyAccess_(user, 'SET_ACTION_ITEM_STATUS', 'You cannot update this milestone.');
    }
  } else {
    requireActionItemStatusPermission_(user, item.record);
  }

  return runAuditedMutation_(user, 'UPDATE_ACTION_ITEM_STATUS', {
    taskId: text_(taskId), studentId: targetStudentId, status: status
  }, function() {
    var current = findActionItem_(taskId);
    if (normalizeEmail_(current.record.StudentId) !== targetStudentId) {
      throw new Error('Task belongs to another student.');
    }
    if (text_(current.record.CreatorType) !== text_(item.record.CreatorType)) {
      throw new Error('This task changed. Refresh and try again.');
    }
    current.record.Status = status;
    current.record.LastUpdated = new Date();
    stampActionItemActors_(current.record, user.email, false);
    writeActionItem_(current);
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
          LastUpdated: now,
          CreatedBy: user.email,
          UpdatedBy: user.email
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
  var prepared = prepareAnchorDate_(studentId, anchorDateValue);
  return runAuditedMutation_(user, 'SET_STUDENT_ANCHOR_DATE', {
    cohort: text_(cohortId), studentId: prepared.studentId
  }, function() {
    applyStudentAnchorDate_(cohortId, prepared.studentId, prepared.anchorDate);
    return { saved: true };
  });
}

function saveStudentAnchorAndSync(cohortId, studentId, anchorDateValue) {
  var user = requireAdmin_('SET_STUDENT_ANCHOR_DATE');
  var prepared = prepareAnchorDate_(studentId, anchorDateValue);
  return runAuditedMutation_(user, 'SET_STUDENT_ANCHOR_DATE', {
    cohort: text_(cohortId), studentId: prepared.studentId, sync: true
  }, function() {
    applyStudentAnchorDate_(cohortId, prepared.studentId, prepared.anchorDate);
    var synced = applyStudentActionDateSync_(user, cohortId, prepared.studentId);
    return { saved: true, updated: synced.updated };
  });
}

function prepareAnchorDate_(studentId, anchorDateValue) {
  var normalizedStudentId = normalizeEmail_(studentId);
  validateEmail_(normalizedStudentId, 'StudentId');
  var anchorDate = anchorDateValue ? parseActionDate_(anchorDateValue) : '';
  if (anchorDateValue && !anchorDate) throw new Error('Anchor_Date must be a valid date.');
  return { studentId: normalizedStudentId, anchorDate: anchorDate };
}

function applyStudentAnchorDate_(cohortId, studentId, anchorDate) {
  var sheet = getCohortSheet_(cohortId);
  assertSheetSchema_(sheet, 'cohortMembers');
  var headers = getHeaders_(sheet);
  requireColumn_(headers, 'StudentId', sheet.getName());
  var anchorColumn = requireColumn_(headers, 'Anchor_Date', sheet.getName());
  var rowNumber = findRowNumber_(sheet, 'StudentId', studentId);
  if (rowNumber < 0) throw new Error('Student is not in the selected cohort.');
  sheet.getRange(rowNumber, anchorColumn + 1).setValue(anchorDate || '');
  invalidatePlacementCache_(studentId);
}

function syncStudentActionItemDates(studentId, cohortId) {
  var user = requireAdmin_('SYNC_STUDENT_ACTION_DATES');
  var targetStudentId = normalizeEmail_(studentId);
  validateEmail_(targetStudentId, 'StudentId');
  return runAuditedMutation_(user, 'SYNC_STUDENT_ACTION_DATES', { cohort: text_(cohortId), studentId: targetStudentId }, function() {
    return applyStudentActionDateSync_(user, cohortId, targetStudentId);
  });
}

function applyStudentActionDateSync_(user, cohortId, targetStudentId) {
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
    if (typeof actionMap.UpdatedBy === 'number') row[actionMap.UpdatedBy] = user.email;
    updated++;
  }
  if (updated) actionSheet.getRange(1, 1, actionData.length, actionHeaders.length).setValues(actionData);
  invalidateActionItemCache_(targetStudentId);
  return { updated: updated };
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
  var idColumn = item.headers.indexOf('TaskId');
  if (idColumn < 0) throw new Error('TaskId column is missing.');
  var onSheet = text_(item.sheet.getRange(item.rowNumber, idColumn + 1).getValues()[0][0]);
  if (onSheet !== text_(item.record.TaskId)) {
    var located = findActionItem_(item.record.TaskId);
    item.sheet = located.sheet;
    item.headers = located.headers;
    item.rowNumber = located.rowNumber;
  }
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
  var date = null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  } else {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text_(value));
    if (match) date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    else {
      var parsed = new Date(value);
      if (!isNaN(parsed.getTime())) date = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    }
  }
  if (!date || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) return null;
  return date;
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
  withSheetLock_(function() {
    var headers = getHeaders_(sheet);
    assertSheetSchema_(sheet, 'studentActionItems');
    var rows = records.map(function(record) { return actionItemRow_(headers, record); });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  });
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

function todoTemplateSheet_() {
  var sheet = getOrCreateManagedSheet_(APP_TABLES.todoTemplates);
  assertSheetSchema_(sheet, 'todoTemplates');
  return sheet;
}

function todoTemplateFromRecord_(record) {
  var active = record.Active;
  return {
    templateId: text_(record.TemplateId),
    title: text_(record.Title),
    description: text_(record.Description),
    phaseId: text_(record.PhaseId),
    owner: normalizeEmail_(record.Owner),
    sortOrder: Number(record.SortOrder) || 0,
    active: active === '' || active === null || typeof active === 'undefined' ? true : toBoolean_(active)
  };
}

function readTodoTemplates_() {
  var sheet = todoTemplateSheet_();
  if (sheet.getLastRow() < 2) return [];
  return readRecords_(sheet).map(todoTemplateFromRecord_).filter(function(template) {
    return template.templateId && template.owner;
  });
}

function listTodoTemplatesFor_(ownerEmail) {
  var owner = normalizeEmail_(ownerEmail);
  return readTodoTemplates_().filter(function(template) {
    return template.owner === owner && template.active;
  }).sort(function(left, right) {
    return left.sortOrder - right.sortOrder || left.title.localeCompare(right.title);
  });
}

function requireTodoTemplateOwner_(user) {
  if (!user.permissions.isSupervisor && !user.permissions.canAdmin) {
    denyAccess_(user, 'SAVE_TODO_TEMPLATE', 'Supervisors and coordinators save template tasks.');
  }
}

function assertActivePhase_(phaseId) {
  var phase = text_(phaseId);
  if (!phase) return '';
  var knownPhase = findRecordByValue_(getSpreadsheet_().getSheetByName(APP_TABLES.phases.sheet), 'phaseId', phase);
  if (!knownPhase || !toBoolean_(knownPhase.active)) throw new Error('Choose an active phase for this template.');
  return phase;
}

function saveTodoTemplate(payload) {
  var user = requireStaff_('SAVE_TODO_TEMPLATE');
  requireTodoTemplateOwner_(user);
  var input = payload || {};
  var title = text_(input.title);
  if (!title) throw new Error('Template title is required.');
  if (title.length > 240) throw new Error('Template title must be 240 characters or fewer.');
  var description = text_(input.description);
  if (description.length > 2000) throw new Error('Template note must be 2,000 characters or fewer.');
  var phase = assertActivePhase_(input.phaseId);
  var templateId = text_(input.templateId);
  return runAuditedMutation_(user, 'SAVE_TODO_TEMPLATE', { templateId: templateId, title: title, phaseId: phase }, function() {
    var sheet = todoTemplateSheet_();
    var existing = templateId ? readTodoTemplates_().filter(function(template) { return template.templateId === templateId; })[0] : null;
    if (templateId && (!existing || existing.owner !== user.email)) throw new Error('Choose one of your template tasks.');
    var owned = listTodoTemplatesFor_(user.email);
    var record = {
      TemplateId: existing ? existing.templateId : Utilities.getUuid(),
      Title: title,
      Description: description,
      PhaseId: phase,
      Owner: user.email,
      SortOrder: existing ? existing.sortOrder : owned.length + 1,
      Active: true
    };
    writeManagedRow_('todoTemplates', record, 'TemplateId');
    return todoTemplateFromRecord_(record);
  });
}

function deleteTodoTemplate(templateId) {
  var user = requireStaff_('DELETE_TODO_TEMPLATE');
  requireTodoTemplateOwner_(user);
  var id = text_(templateId);
  var existing = readTodoTemplates_().filter(function(template) { return template.templateId === id; })[0];
  if (!existing || existing.owner !== user.email) throw new Error('Choose one of your template tasks.');
  return runAuditedMutation_(user, 'DELETE_TODO_TEMPLATE', { templateId: id, title: existing.title }, function() {
    var record = {
      TemplateId: existing.templateId,
      Title: existing.title,
      Description: existing.description,
      PhaseId: existing.phaseId,
      Owner: existing.owner,
      SortOrder: existing.sortOrder,
      Active: false
    };
    writeManagedRow_('todoTemplates', record, 'TemplateId');
    return { templateId: id, active: false };
  });
}

function applyTodoTemplate(templateId, studentEmail, cohortId, phaseId, viewAs) {
  var user = requireStaff_('APPLY_TODO_TEMPLATE');
  var context = staffStudentContext_(user, studentEmail, cohortId, 'APPLY_TODO_TEMPLATE', viewAs);
  if (!staffMayAddStudentTodo_(user, context)) {
    denyAccess_(user, 'APPLY_TODO_TEMPLATE', 'You cannot add a to-do for this student.');
  }
  var id = text_(templateId);
  var template = readTodoTemplates_().filter(function(item) { return item.templateId === id; })[0];
  if (!template || template.owner !== user.email || !template.active) throw new Error('Choose one of your template tasks.');
  var phase = template.phaseId || text_(phaseId);
  var input = prepareStudentTodoInput_(template.title, phase);
  var studentId = context.email;
  return runAuditedMutation_(user, 'APPLY_TODO_TEMPLATE', {
    templateId: id, studentId: studentId, phaseId: input.phase, title: input.title, cohort: text_(cohortId)
  }, function() {
    var sheet = getRequiredActionItemsSheet_();
    var values = stampActionItemActors_({
      TaskId: createActionItemId_(),
      StudentId: studentId,
      CreatorType: 'Student',
      TemplateId: '',
      PhaseId: input.phase,
      Title: input.title,
      Description: template.description,
      DueDate: '',
      Status: 'Pending',
      LastUpdated: new Date()
    }, user.email, true);
    appendActionItems_(sheet, [values]);
    invalidateActionItemCache_(studentId);
    return {
      TaskId: values.TaskId,
      StudentId: studentId,
      PhaseId: input.phase,
      Title: input.title,
      Description: template.description,
      CreatedBy: user.email
    };
  });
}
