function findStudentPlacement_(studentEmail) {
  var email = normalizeEmail_(studentEmail);
  if (!email) return null;
  var cacheKey = 'EE_PLACE_' + email.replace(/[^a-z0-9]/g, '_');
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (error) { /* cache is optional */ }

  var cohorts = listCohorts_(true);
  for (var index = 0; index < cohorts.length; index++) {
    var cohort = cohorts[index];
    var sheet = getSpreadsheet_().getSheetByName(cohort.sheetName);
    var record = sheet ? findRecordByValue_(sheet, 'StudentId', email) : null;
    if (!record) continue;
    var placement = {
      cohortId: cohort.id,
      email: email,
      displayName: text_(record['Display Name']) || email,
      studentNumber: text_(record['Student ID']),
      hrm: text_(record.HRM),
      subject: text_(record.subject),
      supervisorId: normalizeEmail_(record.supervisorId),
      anchor: record.Anchor_Date ? String(serializable_(record.Anchor_Date)).slice(0, 10) : '',
      folder: text_(record.EEFolder),
      doc: text_(record.EEDoc),
      rppf: text_(record.RPPFDoc),
      poster: text_(record.EEPoster)
    };
    try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(placement), 60); } catch (cacheError) { /* ignore */ }
    return placement;
  }
  return null;
}

function invalidatePlacementCache_(studentEmail) {
  try { CacheService.getScriptCache().remove('EE_PLACE_' + normalizeEmail_(studentEmail).replace(/[^a-z0-9]/g, '_')); }
  catch (error) { /* ignore */ }
}

function readPhases_() {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.phases.sheet);
  if (!sheet) return [];
  return readRecords_(sheet).filter(function(phase) { return toBoolean_(phase.active); }).map(function(phase) {
    return { phaseId: text_(phase.phaseId), phaseTitle: text_(phase.phaseTitle), sequence: Number(phase.sequence) || 0 };
  }).sort(function(left, right) { return left.sequence - right.sequence; });
}

function readTemplates_() {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.milestoneTemplates.sheet);
  if (!sheet) return [];
  return readRecords_(sheet).map(function(template) {
    return {
      milestoneId: text_(template.milestoneId),
      type: text_(template.type).toLowerCase(),
      title: text_(template.milestoneTitle),
      phase: text_(template.phase),
      mOwner: text_(template.mOwner).toLowerCase(),
      offsetDays: Number(template.offsetDays) || 0,
      description: text_(template.milestoneDescription)
    };
  });
}

function orderTemplates_(templates, phases) {
  var sequence = {};
  phases.forEach(function(phase) { sequence[phase.phaseId] = phase.sequence; });
  return templates.slice().sort(function(left, right) {
    var phaseOrder = (sequence[left.phase] || 0) - (sequence[right.phase] || 0);
    if (phaseOrder) return phaseOrder;
    return right.offsetDays - left.offsetDays;
  });
}

function todayUtcDate_() {
  var now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function dueTime_(value) {
  if (!value) return NaN;
  var parsed = parseActionDate_(value);
  return parsed ? parsed.getTime() : NaN;
}

function readEventsForStudents_(emails) {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.milestoneEvents.sheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  assertSheetSchema_(sheet, 'milestoneEvents');
  var wanted = {};
  emails.forEach(function(email) { wanted[normalizeEmail_(email)] = true; });
  return readRecords_(sheet).filter(function(event) {
    return wanted[normalizeEmail_(event.StudentId)];
  }).map(function(event) {
    return {
      eventId: text_(event.EventId),
      taskId: text_(event.TaskId),
      studentId: normalizeEmail_(event.StudentId),
      milestoneId: text_(event.MilestoneId),
      type: text_(event.EventType),
      comment: text_(event.Comment),
      actor: normalizeEmail_(event.Actor),
      at: event.CreatedAt ? serializable_(event.CreatedAt) : ''
    };
  });
}

function latestReturnedByTask_(events) {
  var latest = {};
  events.forEach(function(event) {
    if (event.type !== 'returned') return;
    var current = latest[event.taskId];
    if (!current || String(event.at) > String(current.at)) latest[event.taskId] = event;
  });
  return latest;
}

function appendMilestoneEvent_(event) {
  var sheet = getOrCreateManagedSheet_(APP_TABLES.milestoneEvents);
  assertSheetSchema_(sheet, 'milestoneEvents');
  var headers = getHeaders_(sheet);
  var row = headers.map(function(header) { return event[header] === undefined ? '' : event[header]; });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function getStudentHome() {
  var user = requireUser_('VIEW_STUDENT_HOME');
  if (user.role !== 'student') denyAccess_(user, 'VIEW_STUDENT_HOME', 'Student access required.');
  var placement = findStudentPlacement_(user.email) || { cohortId: '', displayName: user.displayName, email: user.email };
  var phases = readPhases_();
  var templates = orderTemplates_(readTemplates_(), phases);
  var items = getStudentActionItems_(user.email, user);
  var events = readEventsForStudents_([user.email]);
  var returned = latestReturnedByTask_(events);
  items.forEach(function(item) {
    item.returnedComment = returned[item.TaskId] ? returned[item.TaskId].comment : '';
  });
  var published = {};
  try { publishedFormIds_().forEach(function(id) { published[id] = true; }); } catch (error) { /* definitions may not exist yet */ }
  var ticketNotice = studentTicketNotice_(user.email);
  return {
    displayName: placement.displayName || user.displayName,
    email: user.email,
    cohort: placement.cohortId || '',
    subject: placement.subject || '',
    supervisorId: placement.supervisorId || '',
    hrm: placement.hrm || '',
    anchor: placement.anchor || '',
    links: {
      folder: placement.folder || '',
      doc: placement.doc || '',
      rppf: placement.rppf || '',
      poster: placement.poster || ''
    },
    phases: phases,
    templates: templates,
    actionItems: items,
    publishedForms: published,
    unreadTicketCount: ticketNotice.count,
    unreadTicketTitle: ticketNotice.title
  };
}

function staffMaySeeCohort_(user, cohortId) {
  if (user.role !== 'staff') denyAccess_(user, 'VIEW_COHORT', 'Staff access required.');
  getCohortSheet_(cohortId);
}

function normalizeStaffView_(user, viewAs) {
  var requested = text_(viewAs).toLowerCase();
  if (requested === 'supervisor' && user.permissions.isSupervisor) return 'supervisor';
  if (requested === 'staff') return 'staff';
  if (user.permissions.canAdmin) return 'coordinator';
  if (user.permissions.isSupervisor) return 'supervisor';
  return 'staff';
}

function getStaffHome(cohortId, viewAs) {
  var user = requireStaff_('VIEW_STAFF_HOME');
  var cohorts = listCohorts_().map(function(cohort) {
    return { id: cohort.id, name: cohort.name, sheetName: cohort.sheetName };
  });
  var selected = text_(cohortId);
  if (!selected && cohorts.length) selected = cohorts[0].id;
  if (!selected) return { cohorts: cohorts, cohortId: '', viewAs: 'staff', students: [], phases: [], templates: [] };
  staffMaySeeCohort_(user, selected);
  var view = normalizeStaffView_(user, viewAs);
  var phases = readPhases_();
  var templates = orderTemplates_(readTemplates_(), phases);
  var roster = readCohortRoster_(selected);
  if (view === 'supervisor') {
    roster = roster.filter(function(student) { return student.supervisorId === user.email; });
  }
  var emails = {};
  roster.forEach(function(student) { emails[student.email] = true; });
  var items = readActionItemsForEmails_(emails);
  var events = readEventsForStudents_(Object.keys(emails));
  var returned = latestReturnedByTask_(events);
  var today = todayUtcDate_().getTime();
  var students = roster.map(function(student) {
    return summarizeStudent_(student, items[student.email] || [], templates, returned, today, user, view);
  }).sort(function(left, right) { return right.urgency - left.urgency || left.displayName.localeCompare(right.displayName); });
  return {
    cohorts: cohorts,
    cohortId: selected,
    viewAs: view,
    canAct: view !== 'staff',
    phases: phases,
    templates: templates,
    students: students
  };
}

function readCohortRoster_(cohortId) {
  var sheet = getCohortSheet_(cohortId);
  assertSheetSchema_(sheet, 'cohortMembers');
  return readRecords_(sheet).filter(function(record) {
    return normalizeEmail_(record.StudentId);
  }).map(function(record) {
    return {
      email: normalizeEmail_(record.StudentId),
      displayName: text_(record['Display Name']) || normalizeEmail_(record.StudentId),
      studentNumber: text_(record['Student ID']),
      hrm: text_(record.HRM),
      subject: text_(record.subject),
      supervisorId: normalizeEmail_(record.supervisorId),
      anchor: record.Anchor_Date ? String(serializable_(record.Anchor_Date)).slice(0, 10) : '',
      folder: text_(record.EEFolder),
      doc: text_(record.EEDoc),
      rppf: text_(record.RPPFDoc),
      poster: text_(record.EEPoster)
    };
  });
}

function readActionItemsForEmails_(emails) {
  var grouped = {};
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.studentActionItems.sheet);
  if (!sheet || sheet.getLastRow() < 2) return grouped;
  assertSheetSchema_(sheet, 'studentActionItems');
  readRecords_(sheet).forEach(function(item) {
    var email = normalizeEmail_(item.StudentId);
    if (!emails[email] || text_(item.CreatorType) !== 'System') return;
    if (!grouped[email]) grouped[email] = [];
    grouped[email].push({
      taskId: text_(item.TaskId),
      templateId: text_(item.TemplateId),
      phaseId: text_(item.PhaseId),
      title: text_(item.Title),
      status: text_(item.Status) || 'Pending',
      due: item.DueDate ? String(serializable_(item.DueDate)).slice(0, 10) : ''
    });
  });
  return grouped;
}

function summarizeStudent_(student, items, templates, returned, today, user, view) {
  var byTemplate = {};
  items.forEach(function(item) { byTemplate[item.templateId] = item; });
  var done = 0;
  var behind = 0;
  var returnedCount = 0;
  var latest = '';
  var waiting = [];
  var segments = [];
  var currentPhase = templates.length ? templates[0].phase : '';
  var priorComplete = true;
  templates.forEach(function(template) {
    var item = byTemplate[template.milestoneId];
    var status = item ? item.status : 'Pending';
    var due = item && item.due ? dueTime_(item.due) : NaN;
    var overdue = status !== 'Completed' && !isNaN(due) && due < today;
    if (status === 'Completed') {
      done += 1;
      latest = template.title;
    } else if (priorComplete) currentPhase = template.phase;
    if (overdue) behind += 1;
    var segment = status === 'Completed' ? 'd' : (status === 'In Progress' ? 'p' : (overdue ? 'l' : 'o'));
    segments.push(segment);
    var canAct = view !== 'staff' && item && status !== 'Completed' && priorComplete && canCompleteMilestone_(user, student.email, template.mOwner, template.type) && (template.type === 'approval' || template.type === 'meeting' || template.mOwner === 'supervisor' || template.mOwner === 'coordinator');
    if (canAct) waiting.push({ taskId: item.taskId, title: template.title, templateId: template.milestoneId, type: template.type });
    if (item && returned[item.taskId] && status !== 'Completed') returnedCount += 1;
    if (status !== 'Completed') priorComplete = false;
  });
  return {
    email: student.email,
    displayName: student.displayName,
    studentNumber: student.studentNumber,
    hrm: student.hrm,
    subject: student.subject,
    supervisorId: student.supervisorId,
    done: done,
    total: templates.length,
    behind: behind,
    phaseId: currentPhase,
    latestTitle: latest,
    segments: segments.join(''),
    returned: returnedCount,
    waiting: waiting.slice(0, 3),
    urgency: waiting.length * 100 + behind + returnedCount
  };
}

function getStaffStudent(studentEmail, cohortId) {
  var user = requireStaff_('VIEW_STAFF_STUDENT');
  var email = normalizeEmail_(studentEmail);
  staffMaySeeCohort_(user, cohortId);
  var roster = readCohortRoster_(cohortId).filter(function(student) { return student.email === email; })[0];
  if (!roster) throw new Error('Student is not in the selected cohort.');
  var view = normalizeStaffView_(user, user.permissions.canAdmin ? 'coordinator' : (user.permissions.isSupervisor ? 'supervisor' : 'staff'));
  if (view === 'supervisor' && roster.supervisorId && roster.supervisorId !== user.email && !user.permissions.canAdmin) {
    denyAccess_(user, 'VIEW_STAFF_STUDENT', 'This student is assigned to another supervisor.');
  }
  var phases = readPhases_();
  var templates = orderTemplates_(readTemplates_(), phases);
  var items = getStudentActionItems_(email, user);
  var events = readEventsForStudents_([email]);
  var returned = latestReturnedByTask_(events);
  var priorComplete = true;
  var showDocs = view !== 'staff' && (user.permissions.canAdmin || roster.supervisorId === user.email || !roster.supervisorId);
  var milestones = templates.map(function(template) {
    var item = items.filter(function(candidate) { return candidate.TemplateId === template.milestoneId && candidate.CreatorType === 'System'; })[0];
    var status = item ? item.Status : 'Pending';
    var canAct = !!item && status !== 'Completed' && priorComplete && canCompleteMilestone_(user, email, template.mOwner, template.type) && (template.type === 'approval' || template.type === 'meeting' || template.mOwner !== 'student');
    if (status !== 'Completed') priorComplete = false;
    return {
      taskId: item ? item.TaskId : '',
      milestoneId: template.milestoneId,
      title: template.title,
      type: template.type,
      phase: template.phase,
      owner: template.mOwner,
      status: status,
      due: item && item.DueDate ? String(item.DueDate).slice(0, 10) : '',
      description: template.description,
      canAct: canAct,
      returnedComment: item && returned[item.TaskId] ? returned[item.TaskId].comment : ''
    };
  });
  return {
    student: roster,
    showDocs: showDocs,
    links: showDocs ? { folder: roster.folder, doc: roster.doc, rppf: roster.rppf, poster: roster.poster } : {},
    phases: phases,
    milestones: milestones,
    events: events.filter(function(event) { return event.type === 'session_logged' || event.type === 'returned' || event.type === 'note'; })
  };
}

function recordMilestoneDecision(taskId, action, comment, studentEmail, cohortId) {
  var user = requireStaff_('MILESTONE_DECISION');
  var email = normalizeEmail_(studentEmail);
  var decision = text_(action);
  if (['approve', 'return', 'session'].indexOf(decision) < 0) throw new Error('Unknown milestone action.');
  var note = text_(comment);
  if ((decision === 'return' || decision === 'session') && !note) throw new Error('A comment is required.');
  if (note.length > 2000) throw new Error('Comments must be 2,000 characters or fewer.');
  staffMaySeeCohort_(user, cohortId);
  var roster = readCohortRoster_(cohortId);
  if (!roster.some(function(student) { return student.email === email; })) {
    denyAccess_(user, 'MILESTONE_DECISION', 'Student is not in the selected cohort.');
  }

  return runAuditedMutation_(user, 'MILESTONE_' + decision.toUpperCase(), {
    taskId: text_(taskId), studentId: email, cohort: text_(cohortId)
  }, function() {
    var item = findActionItem_(taskId);
    if (normalizeEmail_(item.record.StudentId) !== email) throw new Error('Task belongs to another student.');
    var template = findRecordByValue_(getRequiredActionSheet_('milestoneTemplates'), 'milestoneId', item.record.TemplateId);
    if (!template) throw new Error('Milestone template not found.');
    var owner = text_(template.mOwner).toLowerCase();
    var type = text_(template.type).toLowerCase();
    if (!canCompleteMilestone_(user, email, owner, type)) {
      throw new Error('You cannot update this milestone.');
    }
    if (decision === 'return' && type !== 'approval' && owner === 'student') throw new Error('Only a review milestone can be returned.');
    item.record.Status = decision === 'return' ? 'In Progress' : 'Completed';
    item.record.LastUpdated = new Date();
    writeActionItem_(item);
    invalidateActionItemCache_(email);
    appendMilestoneEvent_({
      EventId: 'EVT_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      TaskId: text_(item.record.TaskId),
      StudentId: email,
      MilestoneId: text_(template.milestoneId),
      EventType: decision === 'approve' ? 'approved' : (decision === 'return' ? 'returned' : 'session_logged'),
      Comment: note,
      Actor: user.email,
      CreatedAt: new Date()
    });
    return { status: item.record.Status };
  });
}
