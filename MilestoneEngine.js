function getStudentPathway_(studentEmail, cohortId, user) {
  var spreadsheet = getSpreadsheet_();
  var milestoneSheet = spreadsheet.getSheetByName(APP_TABLES.milestones.sheet);
  var phaseSheet = spreadsheet.getSheetByName(APP_TABLES.phases.sheet);
  var progressSheet = spreadsheet.getSheetByName(MILESTONE_PROGRESS.sheet);
  var milestones = milestoneSheet ? readRecords_(milestoneSheet) : [];
  var phases = phaseSheet ? readRecords_(phaseSheet).filter(function(phase) {
    return phase.active === '' || phase.active === null || phase.active === undefined || toBoolean_(phase.active);
  }) : [];
  var progress = {};

  if (progressSheet && progressSheet.getLastRow() > 1) {
    readRecords_(progressSheet).forEach(function(record) {
      if (normalizeEmail_(record.StudentId) === normalizeEmail_(studentEmail) && toBoolean_(record.completed)) {
        progress[text_(record.milestoneId)] = true;
      }
    });
  }

  var phasesById = {};
  phases.forEach(function(phase) { phasesById[text_(phase.phaseId)] = phase; });
  var milestonesByPhase = {};
  milestones.forEach(function(milestone) {
    var phaseId = text_(milestone.phase);
    if (!milestonesByPhase[phaseId]) milestonesByPhase[phaseId] = [];
    milestonesByPhase[phaseId].push(milestone);
  });

  var unlockedCache = {};
  var visiting = {};
  function isUnlocked(phaseId) {
    if (Object.prototype.hasOwnProperty.call(unlockedCache, phaseId)) return unlockedCache[phaseId];
    var phase = phasesById[phaseId];
    if (!phase || visiting[phaseId]) return false;
    visiting[phaseId] = true;
    var prerequisiteId = text_(phase.prerequisitePhaseId);
    var unlocked = true;
    if (prerequisiteId) {
      var prerequisiteMilestones = milestonesByPhase[prerequisiteId] || [];
      unlocked = isUnlocked(prerequisiteId) && prerequisiteMilestones.length > 0 && prerequisiteMilestones.every(function(milestone) {
        return !!progress[text_(milestone.milestoneId)];
      });
    }
    delete visiting[phaseId];
    unlockedCache[phaseId] = unlocked;
    return unlocked;
  }

  phases.sort(function(left, right) {
    return Number(left.sequence || 0) - Number(right.sequence || 0) || text_(left.phaseId).localeCompare(text_(right.phaseId));
  });
  var pathway = phases.map(function(phase) {
    var phaseId = text_(phase.phaseId);
    var unlocked = isUnlocked(phaseId);
    var phaseMilestones = (milestonesByPhase[phaseId] || []).slice().sort(function(left, right) {
      return Number(right.offsetDays || 0) - Number(left.offsetDays || 0) || text_(left.milestoneId).localeCompare(text_(right.milestoneId));
    }).map(function(milestone) {
      var completed = !!progress[text_(milestone.milestoneId)];
      return {
        milestoneId: text_(milestone.milestoneId),
        type: text_(milestone.type).toLowerCase(),
        title: text_(milestone.milestoneTitle),
        description: text_(milestone.milestoneDescription),
        offsetDays: text_(milestone.offsetDays),
        owner: text_(milestone.mOwner).toLowerCase(),
        completed: completed,
        canComplete: unlocked && canCompleteMilestone_(user, studentEmail, text_(milestone.mOwner).toLowerCase())
      };
    });
    return {
      phaseId: phaseId,
      title: text_(phase.phaseTitle) || phaseId,
      description: text_(phase.phaseDescription),
      sequence: Number(phase.sequence || 0),
      prerequisitePhaseId: text_(phase.prerequisitePhaseId),
      unlocked: unlocked,
      milestones: phaseMilestones
    };
  });

  Object.keys(milestonesByPhase).forEach(function(phaseId) {
    if (phasesById[phaseId]) return;
    pathway.push({
      phaseId: phaseId,
      title: phaseId || 'Unassigned phase',
      description: '',
      sequence: Number.MAX_SAFE_INTEGER,
      prerequisitePhaseId: '',
      unlocked: false,
      milestones: milestonesByPhase[phaseId].map(function(milestone) {
        return {
          milestoneId: text_(milestone.milestoneId),
          type: text_(milestone.type).toLowerCase(),
          title: text_(milestone.milestoneTitle),
          description: text_(milestone.milestoneDescription),
          offsetDays: text_(milestone.offsetDays),
          owner: text_(milestone.mOwner).toLowerCase(),
          completed: !!progress[text_(milestone.milestoneId)],
          canComplete: false
        };
      })
    });
  });

  return pathway.sort(function(left, right) { return left.sequence - right.sequence; });
}

function canCompleteMilestone_(user, studentEmail, owner) {
  if (owner === 'student') return user.role === 'student' && user.email === normalizeEmail_(studentEmail);
  if (user.role !== 'staff') return false;
  var permissionName = 'is' + owner.charAt(0).toUpperCase() + owner.slice(1);
  return MILESTONE_OWNERS.indexOf(owner) >= 0 && !!user.permissions[permissionName];
}

function hasCompletedDescendant_(pathway, phaseId) {
  var phasesById = {};
  pathway.forEach(function(phase) { phasesById[phase.phaseId] = phase; });
  return pathway.some(function(phase) {
    if (!phase.milestones.some(function(milestone) { return milestone.completed; })) return false;
    var parentId = phase.prerequisitePhaseId;
    var visited = {};
    while (parentId && !visited[parentId]) {
      if (parentId === phaseId) return true;
      visited[parentId] = true;
      parentId = phasesById[parentId] ? phasesById[parentId].prerequisitePhaseId : '';
    }
    return false;
  });
}

function getOrCreateProgressSheet_() {
  var sheet = getSpreadsheet_().getSheetByName(MILESTONE_PROGRESS.sheet);
  if (sheet) return sheet;
  sheet = getSpreadsheet_().insertSheet(MILESTONE_PROGRESS.sheet);
  sheet.getRange(1, 1, 1, MILESTONE_PROGRESS.headers.length).setValues([MILESTONE_PROGRESS.headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function findProgressRow_(sheet, studentEmail, milestoneId) {
  if (!sheet || sheet.getLastRow() < 2) return -1;
  var headers = getHeaders_(sheet);
  var studentIndex = findSingleHeaderIndex_(headers, ['StudentId']);
  var milestoneIndex = findSingleHeaderIndex_(headers, ['milestoneId']);
  if (studentIndex < 0 || milestoneIndex < 0) throw new Error('MILESTONE_PROGRESS has an invalid schema.');
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (var index = 0; index < values.length; index++) {
    if (normalizeEmail_(values[index][studentIndex]) === normalizeEmail_(studentEmail) && text_(values[index][milestoneIndex]) === text_(milestoneId)) return index + 2;
  }
  return -1;
}

function deleteMilestoneProgress_(milestoneId) {
  var sheet = getSpreadsheet_().getSheetByName(MILESTONE_PROGRESS.sheet);
  if (!sheet || sheet.getLastRow() < 2) return;
  var headers = getHeaders_(sheet);
  var index = findSingleHeaderIndex_(headers, ['milestoneId']);
  if (index < 0) throw new Error('MILESTONE_PROGRESS has an invalid schema.');
  var values = sheet.getRange(2, index + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var row = values.length - 1; row >= 0; row--) {
    if (text_(values[row][0]) === text_(milestoneId)) sheet.deleteRow(row + 2);
  }
}

function validatePhasePrerequisites_(values, originalKey) {
  var phaseId = text_(values.phaseId);
  var prerequisiteId = text_(values.prerequisitePhaseId);
  if (prerequisiteId && prerequisiteId === phaseId) throw new Error('A phase cannot depend on itself.');
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.phases.sheet);
  var records = sheet ? readRecords_(sheet) : [];
  var prerequisites = {};
  records.forEach(function(phase) { prerequisites[text_(phase.phaseId)] = text_(phase.prerequisitePhaseId); });
  if (originalKey && originalKey !== phaseId) delete prerequisites[originalKey];
  prerequisites[phaseId] = prerequisiteId;
  if (prerequisiteId && !Object.prototype.hasOwnProperty.call(prerequisites, prerequisiteId)) {
    throw new Error('The prerequisite phase does not exist.');
  }
  Object.keys(prerequisites).forEach(function(startId) {
    var visited = {};
    var currentId = startId;
    while (currentId) {
      if (visited[currentId]) throw new Error('Phase prerequisites cannot contain a cycle.');
      visited[currentId] = true;
      currentId = prerequisites[currentId];
    }
  });
}
