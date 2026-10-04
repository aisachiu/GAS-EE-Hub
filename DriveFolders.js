// Cohort Drive folders. Requires the Drive advanced service (Drive v3) and the
// https://www.googleapis.com/auth/drive scope.

var DRIVE_FOLDER_BATCH_LIMIT = 8;
var DRIVE_NAME_PART_LIMIT = 80;

function getCohortDriveSettings(cohortId) {
  requireAdmin_('GET_COHORT_DRIVE_SETTINGS');
  return presentCohortDriveSettings_(cohortId);
}

function saveCohortDriveSettings(cohortId, settings) {
  var user = requireAdmin_('SAVE_COHORT_DRIVE_SETTINGS');
  var driveOptions = normalizeDriveFolderOptions_(settings);
  return runAuditedExternal_(user, 'SAVE_COHORT_DRIVE_SETTINGS', { cohort: text_(cohortId) }, function() {
    resolveCohortRootFolder_(cohortId, driveOptions, true);
    return presentCohortDriveSettings_(cohortId);
  });
}

function checkCohortDriveFolders(cohortId, selectedStudentIds, options) {
  var user = requireAdmin_('CHECK_COHORT_DRIVE_FOLDERS');
  var driveOptions = normalizeDriveFolderOptions_(options);
  var studentIds = normalizeSelectedStudentIds_(selectedStudentIds);
  return runAuditedExternal_(user, 'CHECK_COHORT_DRIVE_FOLDERS', {
    cohort: text_(cohortId),
    studentCount: studentIds.length
  }, function() {
    var root = resolveCohortRootFolder_(cohortId, driveOptions, false);
    var members = membersForIds_(cohortId, studentIds);
    var result = applyDriveFolders_(cohortId, members, root, driveOptions, true);
    result.dryRun = true;
    return result;
  });
}

function syncCohortDriveFolders(cohortId, selectedStudentIds, options) {
  var user = requireAdmin_('SYNC_COHORT_DRIVE_FOLDERS');
  var driveOptions = normalizeDriveFolderOptions_(options);
  var studentIds = normalizeSelectedStudentIds_(selectedStudentIds);
  return runAuditedExternal_(user, 'SYNC_COHORT_DRIVE_FOLDERS', {
    cohort: text_(cohortId),
    studentCount: studentIds.length,
    shareStudent: driveOptions.shareStudent,
    shareParent: driveOptions.shareParent
  }, function() {
    var root = resolveCohortRootFolder_(cohortId, driveOptions, true);
    var members = membersForIds_(cohortId, studentIds);
    var result = applyDriveFolders_(cohortId, members, root, driveOptions, false);
    result.dryRun = false;
    result.settings = presentCohortDriveSettings_(cohortId);
    return result;
  });
}

function normalizeDriveFolderOptions_(options) {
  var source = options || {};
  var prefix = source.prefix === undefined || source.prefix === null ? '' : String(source.prefix);
  var suffix = source.suffix === undefined || source.suffix === null ? '' : String(source.suffix);
  if (prefix.length > DRIVE_NAME_PART_LIMIT || suffix.length > DRIVE_NAME_PART_LIMIT) {
    throw new Error('Prefix and suffix must be 80 characters or fewer.');
  }
  return {
    rootFolderId: text_(source.rootFolderId),
    prefix: prefix,
    suffix: suffix,
    shareStudent: toBoolean_(source.shareStudent),
    shareParent: toBoolean_(source.shareParent)
  };
}

function normalizeSelectedStudentIds_(selectedStudentIds) {
  if (!Array.isArray(selectedStudentIds) || selectedStudentIds.length === 0) throw new Error('Select at least one student.');
  if (selectedStudentIds.length > DRIVE_FOLDER_BATCH_LIMIT) throw new Error('Work on 8 students at a time.');
  var seen = {};
  return selectedStudentIds.map(function(value) {
    var studentId = normalizeEmail_(value);
    validateEmail_(studentId, 'StudentId');
    if (seen[studentId]) throw new Error('A student was selected more than once.');
    seen[studentId] = true;
    return studentId;
  });
}

function membersForIds_(cohortId, studentIds) {
  var roster = getCohortMembersForAdmin(cohortId).records;
  var byId = {};
  roster.forEach(function(record) { byId[normalizeEmail_(record.StudentId)] = record; });
  return studentIds.map(function(studentId) {
    var member = byId[studentId];
    if (!member) throw new Error('Student is not in this cohort: ' + studentId);
    return member;
  });
}

function readCohortDriveRecord_(cohortId) {
  var id = text_(cohortId);
  if (!/^\d{4}$/.test(id)) throw new Error('Cohort must be a four-digit year.');
  ensureCohortDriveColumns_();
  getCohortSheet_(id);
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.cohorts.sheet);
  if (!sheet) throw new Error('COHORTS is missing.');
  assertSheetSchema_(sheet, 'cohorts');
  var record = findRecordByValue_(sheet, 'Cohort', id);
  if (!record) throw new Error('Save this cohort in the Cohorts section before creating Drive folders.');
  return record;
}

function presentCohortDriveSettings_(cohortId) {
  var record = readCohortDriveRecord_(cohortId);
  var rootId = text_(record.DriveRootFolderId);
  var rootName = '';
  var rootUrl = '';
  var rootProblem = '';
  if (rootId) {
    var root = openDriveFolder_(rootId);
    if (root) {
      rootId = root.getId();
      rootName = root.getName();
      rootUrl = driveFolderUrl_(root);
    } else {
      rootProblem = 'The saved cohort folder could not be opened.';
    }
  }
  return {
    cohortId: text_(cohortId),
    rootFolderId: rootId,
    rootName: rootName,
    rootUrl: rootUrl,
    rootProblem: rootProblem,
    prefix: preservedDriveText_(record.FolderPrefix),
    suffix: preservedDriveText_(record.FolderSuffix)
  };
}

function resolveCohortRootFolder_(cohortId, driveOptions, persist) {
  var record = readCohortDriveRecord_(cohortId);
  var rootId = driveOptions.rootFolderId || text_(record.DriveRootFolderId);
  if (!rootId) throw new Error('Choose a cohort root folder.');
  var root = requireDriveFolder_(rootId, 'The cohort root folder');
  if (persist) {
    writeCohortDriveFields_(cohortId, {
      DriveRootFolderId: root.getId(),
      FolderPrefix: driveOptions.prefix,
      FolderSuffix: driveOptions.suffix
    });
  }
  return root;
}

function writeCohortDriveFields_(cohortId, fields) {
  withSheetLock_(function() {
    ensureCohortDriveColumns_();
    var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.cohorts.sheet);
    if (!sheet) throw new Error('COHORTS is missing.');
    assertSheetSchema_(sheet, 'cohorts');
    var rowNumber = findRowNumber_(sheet, 'Cohort', cohortId);
    if (rowNumber < 0) throw new Error('Save this cohort in the Cohorts section before creating Drive folders.');
    var headers = getHeaders_(sheet);
    Object.keys(fields).forEach(function(header) {
      var index = headers.indexOf(header);
      if (index < 0) throw new Error(header + ' column is missing on COHORTS.');
      sheet.getRange(rowNumber, index + 1).setValue(preservedDriveText_(fields[header]));
    });
  });
}

function applyDriveFolders_(cohortId, members, root, driveOptions, dryRun) {
  var roster = getCohortMembersForAdmin(cohortId).records;
  var names = expectedFolderNames_(roster, driveOptions.prefix, driveOptions.suffix);
  var linkedIds = {};
  roster.forEach(function(record) {
    var folderId = parseDriveFolderId_(record.EEFolder);
    if (folderId) linkedIds[folderId] = normalizeEmail_(record.StudentId);
  });
  var sheet = getCohortSheet_(cohortId);
  return {
    students: members.map(function(member) {
      try {
        return syncOneStudentFolder_(sheet, member, names, root, linkedIds, driveOptions, dryRun);
      } catch (error) {
        return driveFolderResult_(member, names, {
          status: 'error',
          message: String(error.message || error)
        });
      }
    })
  };
}

function expectedFolderNames_(records, prefix, suffix) {
  var prepared = records.map(function(record) {
    var displayName = cohortMemberDisplayName_(record);
    return {
      studentId: normalizeEmail_(record.StudentId),
      baseName: sanitizeDriveFolderName_(String(prefix) + displayName + String(suffix)),
      token: text_(record['Student ID']) || normalizeEmail_(record.StudentId)
    };
  });
  var counts = {};
  prepared.forEach(function(item) {
    if (!item.baseName) return;
    counts[item.baseName] = (counts[item.baseName] || 0) + 1;
  });
  var names = {};
  var used = {};
  prepared.forEach(function(item) {
    if (!item.baseName) {
      names[item.studentId] = '';
      return;
    }
    var name = counts[item.baseName] > 1
      ? sanitizeDriveFolderName_(item.baseName + ' (' + item.token + ')')
      : item.baseName;
    if (used[name]) name = sanitizeDriveFolderName_(name + ' ' + item.studentId);
    used[name] = true;
    names[item.studentId] = name;
  });
  return names;
}

function syncOneStudentFolder_(sheet, member, names, root, linkedIds, driveOptions, dryRun) {
  var studentId = normalizeEmail_(member.StudentId);
  var folderName = names[studentId] || '';
  if (member.hasStudentIdConflict) {
    return driveFolderResult_(member, names, { status: 'error', message: 'Resolve the duplicate Student ID values first.' });
  }
  if (!folderName) {
    return driveFolderResult_(member, names, { status: 'error', message: 'The folder name is empty. Enter a prefix, suffix, or display name.' });
  }
  if (folderName.length > 200) {
    return driveFolderResult_(member, names, { status: 'error', message: 'The folder name is too long.' });
  }

  var existing = openDriveFolder_(member.EEFolder);
  var folder = existing;
  var created = false;
  var relinked = false;

  if (!folder) {
    var matches = childFoldersNamed_(root, folderName).filter(function(child) {
      var owner = linkedIds[child.getId()];
      return !owner || owner === studentId;
    });
    if (matches.length > 1) {
      return driveFolderResult_(member, names, {
        status: 'ambiguous',
        message: 'More than one folder in the cohort folder is named ' + folderName + '.'
      });
    }
    if (matches.length === 1) {
      folder = matches[0];
      relinked = true;
    } else if (dryRun) {
      return driveFolderResult_(member, names, {
        status: 'would_create',
        message: 'Would create ' + folderName + '.',
        shares: previewDriveShares_(member, driveOptions)
      });
    } else {
      folder = root.createFolder(folderName);
      created = true;
      linkedIds[folder.getId()] = studentId;
    }
  }

  if (folder.getId() === root.getId()) {
    return driveFolderResult_(member, names, { status: 'error', message: 'The student folder cannot be the cohort folder itself.' });
  }

  var renamed = false;
  var moved = false;
  if (folder.getName() !== folderName) {
    var clashes = childFoldersNamed_(root, folderName).filter(function(child) { return child.getId() !== folder.getId(); });
    if (clashes.length) {
      return driveFolderResult_(member, names, {
        status: 'error',
        url: driveFolderUrl_(folder),
        message: 'Another folder in the cohort folder is already named ' + folderName + '.'
      });
    }
    renamed = true;
  }
  if (!folderIsInside_(folder, root)) moved = true;
  if (!dryRun) {
    if (moved) folder.moveTo(root);
    if (renamed) folder.setName(folderName);
    writeMemberEeFolder_(sheet, studentId, driveFolderUrl_(folder));
    invalidatePlacementCache_(studentId);
    linkedIds[folder.getId()] = studentId;
  }

  var shares = dryRun ? previewDriveShares_(member, driveOptions) : applyDriveShares_(folder.getId(), member, driveOptions);
  var outcome = describeDriveFolderOutcome_(created, relinked, moved, renamed, dryRun);
  return driveFolderResult_(member, names, {
    status: outcome.status,
    url: driveFolderUrl_(folder),
    message: outcome.message,
    shares: shares
  });
}

function describeDriveFolderOutcome_(created, relinked, moved, renamed, dryRun) {
  if (dryRun) {
    if (relinked && (moved || renamed)) return { status: 'would_update', message: 'Would relink the folder and bring its name and location up to date.' };
    if (relinked) return { status: 'would_relink', message: 'Would relink the existing folder.' };
    if (moved && renamed) return { status: 'would_update', message: 'Would move the folder into the cohort folder and rename it.' };
    if (moved) return { status: 'would_move', message: 'Would move the folder into the cohort folder.' };
    if (renamed) return { status: 'would_rename', message: 'Would rename the folder.' };
    return { status: 'unchanged', message: 'Folder is already in place.' };
  }
  if (created) return { status: 'created', message: 'Created the folder.' };
  if (relinked && (moved || renamed)) return { status: 'relinked', message: 'Relinked the existing folder and updated it.' };
  if (relinked) return { status: 'relinked', message: 'Relinked the existing folder.' };
  if (moved && renamed) return { status: 'updated', message: 'Moved the folder into the cohort folder and renamed it.' };
  if (moved) return { status: 'moved', message: 'Moved the folder into the cohort folder.' };
  if (renamed) return { status: 'renamed', message: 'Renamed the folder.' };
  return { status: 'unchanged', message: 'Folder is already in place.' };
}

function driveFolderResult_(member, names, extra) {
  var studentId = normalizeEmail_(member.StudentId);
  return {
    studentId: studentId,
    displayName: cohortMemberDisplayName_(member),
    folderName: names[studentId] || '',
    status: extra.status || 'error',
    url: extra.url || '',
    message: extra.message || '',
    shares: extra.shares || []
  };
}

function previewDriveShares_(member, driveOptions) {
  var shares = [];
  if (driveOptions.shareStudent) shares.push(previewDriveShare_(member.StudentId, 'writer', 'student'));
  if (driveOptions.shareParent) shares.push(previewDriveShare_(member['Family Email'], 'reader', 'parent'));
  return shares;
}

function previewDriveShare_(email, role, who) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return { who: who, email: '', role: role, status: 'skipped', reason: 'No email address.' };
  return { who: who, email: normalized, role: role, status: 'would_share', reason: '' };
}

function applyDriveShares_(folderId, member, driveOptions) {
  var shares = [];
  if (driveOptions.shareStudent) shares.push(shareDriveFolderSilently_(folderId, member.StudentId, 'writer', 'student'));
  if (driveOptions.shareParent) shares.push(shareDriveFolderSilently_(folderId, member['Family Email'], 'reader', 'parent'));
  return shares;
}

function shareDriveFolderSilently_(fileId, email, role, who) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return { who: who, email: '', role: role, status: 'skipped', reason: 'No email address.' };
  if (typeof Drive === 'undefined' || !Drive.Permissions || !Drive.Permissions.create) {
    return { who: who, email: normalized, role: role, status: 'failed', reason: 'Drive sharing is not enabled for this script.' };
  }
  try {
    var current = findDrivePermission_(fileId, normalized);
    if (current && permissionCoversRole_(current.role, role)) {
      return { who: who, email: normalized, role: role, status: 'already' };
    }
    if (current && Drive.Permissions.update) {
      Drive.Permissions.update({ role: role }, fileId, current.id, { supportsAllDrives: true, sendNotificationEmail: false });
      return { who: who, email: normalized, role: role, status: 'updated' };
    }
    Drive.Permissions.create({
      type: 'user',
      role: role,
      emailAddress: normalized
    }, fileId, {
      sendNotificationEmail: false,
      supportsAllDrives: true
    });
    return { who: who, email: normalized, role: role, status: 'shared' };
  } catch (error) {
    var message = String(error && error.message ? error.message : error);
    if (/already has access|already exists|duplicate/i.test(message)) {
      return { who: who, email: normalized, role: role, status: 'already' };
    }
    return { who: who, email: normalized, role: role, status: 'failed', reason: silentShareFailureReason_(message) };
  }
}

function findDrivePermission_(fileId, email) {
  if (!Drive.Permissions.list) return null;
  try {
    var listed = Drive.Permissions.list(fileId, { supportsAllDrives: true, fields: 'permissions(id,emailAddress,role,type)' });
    var permissions = listed && listed.permissions ? listed.permissions : [];
    for (var index = 0; index < permissions.length; index++) {
      if (normalizeEmail_(permissions[index].emailAddress) === email) return permissions[index];
    }
  } catch (error) {
    return null;
  }
  return null;
}

function permissionCoversRole_(actual, expected) {
  if (actual === expected || actual === 'owner') return true;
  if (expected === 'reader' && (actual === 'writer' || actual === 'commenter' || actual === 'fileOrganizer' || actual === 'organizer')) return true;
  return false;
}

function silentShareFailureReason_(message) {
  if (/notification|outside|domain/i.test(message)) {
    return 'Drive will not share this folder silently. The address may be outside the school domain.';
  }
  return 'Could not share this folder.';
}

function cohortMemberDisplayName_(record) {
  var displayName = text_(record['Display Name']);
  if (!displayName) displayName = text_(record.DisplayName);
  if (!displayName) displayName = text_(record['Preferred Name']);
  if (!displayName) displayName = [text_(record['First Name']), text_(record.Surname)].filter(Boolean).join(' ');
  if (!displayName) displayName = normalizeEmail_(record.StudentId);
  return displayName;
}

function sanitizeDriveFolderName_(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[\/\\]/g, '').replace(/[\u0000-\u001f]/g, '').trim();
}

function parseDriveFolderId_(value) {
  var raw = text_(value);
  if (!raw) return '';
  var folderMatch = /\/folders\/([a-zA-Z0-9_-]+)/.exec(raw);
  if (folderMatch) return folderMatch[1];
  var idMatch = /[?&]id=([a-zA-Z0-9_-]+)/.exec(raw);
  if (idMatch) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw)) return raw;
  return '';
}

function driveFolderUrl_(folder) {
  return 'https://drive.google.com/drive/folders/' + folder.getId();
}

function openDriveFolder_(folderId) {
  var id = parseDriveFolderId_(folderId);
  if (!id) return null;
  try {
    var folder = DriveApp.getFolderById(id);
    if (!folder || folder.isTrashed()) return null;
    return folder;
  } catch (error) {
    return null;
  }
}

function requireDriveFolder_(folderId, label) {
  var folder = openDriveFolder_(folderId);
  if (!folder) throw new Error(label + ' could not be opened. Choose a folder that is not in the trash.');
  return folder;
}

function childFoldersNamed_(root, name) {
  var matches = [];
  var children = root.getFoldersByName(name);
  while (children.hasNext()) {
    var child = children.next();
    if (!child.isTrashed()) matches.push(child);
  }
  return matches;
}

function folderIsInside_(folder, root) {
  if (!folder || folder.getId() === root.getId()) return false;
  var parents = folder.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === root.getId()) return true;
  }
  return false;
}

function writeMemberEeFolder_(sheet, studentId, url) {
  withSheetLock_(function() {
    var headers = getHeaders_(sheet);
    var rowNumber = findRowNumber_(sheet, 'StudentId', studentId);
    if (rowNumber < 0) throw new Error('Student is not in this cohort: ' + studentId);
    var folderIndex = headers.indexOf('EEFolder');
    if (folderIndex < 0) throw new Error('EEFolder column is missing.');
    sheet.getRange(rowNumber, folderIndex + 1).setValue(url);
    invalidatePlacementCache_(studentId);
  });
}
