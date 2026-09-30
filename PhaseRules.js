function canCompleteMilestone_(user, studentEmail, owner) {
  if (owner === 'student') return user.role === 'student' && user.email === normalizeEmail_(studentEmail);
  if (user.role !== 'staff') return false;
  var permissionName = 'is' + owner.charAt(0).toUpperCase() + owner.slice(1);
  var ownerField = getFieldConfig_('milestoneTemplates', 'mOwner');
  return !!ownerField && ownerField.options.indexOf(owner) >= 0 && !!user.permissions[permissionName];
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
