function canCompleteMilestone_(user, studentEmail, owner, templateType, knownPlacement) {
  var milestoneOwner = text_(owner).toLowerCase();
  if (!user) return false;
  // Coordinators and admins can check or uncheck every milestone.
  if (user.role === 'staff' && user.permissions && user.permissions.canAdmin) return true;
  if (milestoneOwner === 'student') return user.role === 'student' && user.email === normalizeEmail_(studentEmail);
  if (user.role !== 'staff') return false;
  var placement = knownPlacement || null;
  if (!placement && milestoneOwner === 'supervisor') placement = findStudentPlacement_(studentEmail);
  if (milestoneOwner === 'supervisor') {
    if (!placement) return false;
    if (normalizeEmail_(placement.supervisorId) === user.email) return true;
    return !text_(placement.supervisorId) && !!(user.permissions && user.permissions.canAdmin);
  }
  var permissionName = 'is' + milestoneOwner.charAt(0).toUpperCase() + milestoneOwner.slice(1);
  var ownerField = getFieldConfig_('milestoneTemplates', 'mOwner');
  return !!ownerField && ownerField.options.indexOf(milestoneOwner) >= 0 && !!user.permissions[permissionName];
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
