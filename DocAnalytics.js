// Essay document analytics for the student page. Word-count history is stored
// one row per file in DOC_WORD_LOGS. Edit squares come from Drive revisions.
// Google Drive does not expose how many times a file was opened.

var DOC_WORD_LOG_SHEET = 'DOC_WORD_LOGS';
var DOC_STATS_CACHE_SECONDS = 600;
var DOC_HEATMAP_WEEKS = 26;
var DOC_WORD_SAMPLE_LIMIT = 120;
var DAY_MS = 86400000;

function getMyEssayAnalytics() {
  var user = requireUser_('VIEW_ESSAY_ANALYTICS');
  if (user.role !== 'student') denyAccess_(user, 'VIEW_ESSAY_ANALYTICS', 'Student access required.');
  var placement = findStudentPlacement_(user.email);
  return presentEssayAnalytics_(placement ? placement.doc : '');
}

function getStudentEssayAnalytics(studentEmail, cohortId, viewAs) {
  var user = requireStaff_('VIEW_STUDENT_ESSAY_ANALYTICS');
  var context = staffStudentContext_(user, studentEmail, cohortId, 'VIEW_STUDENT_ESSAY_ANALYTICS', viewAs);
  return presentEssayAnalytics_(context.roster.doc || '');
}

function presentEssayAnalytics_(docUrl) {
  var fileId = parseDriveFileId_(docUrl);
  if (!fileId) return { ok: false, reason: 'missing' };
  var cacheKey = 'EE_DOC_STATS_' + fileId;
  var cache = null;
  try {
    cache = CacheService.getScriptCache();
    var hit = cache.get(cacheKey);
    if (hit) {
      var parsed = JSON.parse(hit);
      if (parsed && parsed.ok && parsed.fileId === fileId) return parsed;
    }
  } catch (error) {
    cache = null;
  }
  try {
    var stats = collectEssayAnalytics_(fileId);
    if (cache) {
      try { cache.put(cacheKey, JSON.stringify(stats), DOC_STATS_CACHE_SECONDS); } catch (cacheError) { /* a fresh read is still returned */ }
    }
    return stats;
  } catch (error) {
    return { ok: false, reason: 'access', message: essayAnalyticsError_(error) };
  }
}

function collectEssayAnalytics_(fileId) {
  var file = DriveApp.getFileById(fileId);
  if (!file || file.isTrashed()) throw new Error('This document could not be opened.');
  var mime = file.getMimeType();
  var updated = file.getLastUpdated();
  var wordCount = null;
  if (mime === 'application/vnd.google-apps.document') {
    try { wordCount = countWords_(readGoogleDocText_(fileId)); }
    catch (readError) { wordCount = null; }
  }
  var revisionsLoaded = true;
  var stamps = [];
  try { stamps = listRevisionStamps_(fileId); }
  catch (revisionError) { revisionsLoaded = false; }
  var timeZone = scriptTimeZone_();
  var now = new Date();
  var todayKey = dayKeyInZone_(now, timeZone);
  var dayCounts = countRevisionDays_(stamps, timeZone);
  var samples = [];
  var wordsDay = null;
  var wordsWeek = null;
  if (wordCount !== null) {
    try {
      samples = readWordSamples_(fileId);
      wordsDay = wordsTypedSince_(samples, wordCount, now.getTime(), now.getTime() - DAY_MS, 12 * 3600000);
      wordsWeek = wordsTypedSince_(samples, wordCount, now.getTime(), now.getTime() - (7 * DAY_MS), 36 * 3600000);
      var nextSamples = rememberWordSample_(samples, wordCount, now, todayKey);
      if (wordSamplesChanged_(samples, nextSamples)) writeWordSamples_(fileId, nextSamples);
    } catch (sampleError) { /* stats still return without a stored baseline */ }
  }
  var heatmap = buildEditHeatmap_(dayCounts, todayKey, DOC_HEATMAP_WEEKS);
  var activeDays = Object.keys(dayCounts);
  return {
    ok: true,
    fileId: fileId,
    title: file.getName() || 'Extended Essay',
    wordCount: wordCount,
    wordsDay: wordsDay,
    wordsWeek: wordsWeek,
    wordsHint: wordCount === null
      ? 'Word count is available for a Google Doc.'
      : (wordsDay === null && wordsWeek === null ? 'Daily and weekly word changes appear after this document is checked again on a later day.' : ''),
    opens: null,
    lastEdit: updated ? updated.toISOString() : '',
    streak: revisionsLoaded ? editStreak_(activeDays, todayKey) : null,
    revisionsLoaded: revisionsLoaded,
    months: heatmap.months,
    days: heatmap.days
  };
}

function essayAnalyticsError_(error) {
  var message = String(error && error.message ? error.message : error);
  if (/access|permission|forbidden|403|not found|404/i.test(message)) return 'You do not have access to this document.';
  return 'The EE Hub could not open this document.';
}

function readGoogleDocText_(fileId) {
  if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.export) {
    var exported = Drive.Files.export(fileId, 'text/plain');
    if (exported && exported.getDataAsString) return exported.getDataAsString();
    if (typeof exported === 'string') return exported;
  }
  return DocumentApp.openById(fileId).getBody().getText();
}

function listRevisionStamps_(fileId) {
  if (typeof Drive === 'undefined' || !Drive.Revisions || !Drive.Revisions.list) return [];
  var stamps = [];
  var token = '';
  var mode = 'v3';
  for (var page = 0; page < 10 && stamps.length < 2000; page++) {
    var args = mode === 'v3'
      ? { pageSize: 200, fields: 'nextPageToken,revisions(modifiedTime)', supportsAllDrives: true }
      : { maxResults: 200 };
    if (token) args.pageToken = token;
    var response;
    try {
      response = Drive.Revisions.list(fileId, args);
    } catch (error) {
      if (mode === 'v3' && !stamps.length) {
        mode = 'v2';
        token = '';
        continue;
      }
      break;
    }
    var rows = (response && (response.revisions || response.items)) || [];
    rows.forEach(function(row) {
      var stamp = row.modifiedTime || row.modifiedDate;
      if (stamp) stamps.push(String(stamp));
    });
    token = response && response.nextPageToken ? String(response.nextPageToken) : '';
    if (!token) break;
  }
  return stamps;
}

function countRevisionDays_(stamps, timeZone) {
  var counts = {};
  (stamps || []).forEach(function(stamp) {
    var date = new Date(stamp);
    if (isNaN(date.getTime())) return;
    var key = dayKeyInZone_(date, timeZone);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function scriptTimeZone_() {
  try { return Session.getScriptTimeZone() || 'UTC'; }
  catch (error) { return 'UTC'; }
}

function dayKeyInZone_(date, timeZone) {
  try { return Utilities.formatDate(date, timeZone || 'UTC', 'yyyy-MM-dd'); }
  catch (error) {
    return date.getUTCFullYear() + '-' + pad2_(date.getUTCMonth() + 1) + '-' + pad2_(date.getUTCDate());
  }
}

function docWordLogSheet_() {
  var spreadsheet = getSpreadsheet_();
  var existing = spreadsheet.getSheetByName(DOC_WORD_LOG_SHEET);
  if (existing) return existing;
  return withSheetLock_(function() {
    var locked = getSpreadsheet_();
    var sheet = locked.getSheetByName(DOC_WORD_LOG_SHEET);
    if (sheet) return sheet;
    sheet = locked.insertSheet(DOC_WORD_LOG_SHEET);
    sheet.getRange(1, 1, 1, 3).setValues([['FileId', 'SamplesJson', 'UpdatedAt']]);
    sheet.setFrozenRows(1);
    return sheet;
  });
}

function readWordSamples_(fileId) {
  var sheet = docWordLogSheet_();
  if (!sheet || sheet.getLastRow() < 2) return [];
  var record = findRecordByValue_(sheet, 'FileId', fileId);
  if (!record || !record.SamplesJson) return [];
  try {
    var parsed = JSON.parse(String(record.SamplesJson));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeWordSamples_(fileId, samples) {
  withSheetLock_(function() {
    var sheet = docWordLogSheet_();
    var headers = getHeaders_(sheet);
    if (headers.indexOf('FileId') < 0 || headers.indexOf('SamplesJson') < 0) {
      throw new Error('DOC_WORD_LOGS is missing FileId or SamplesJson.');
    }
    var rowNumber = findRowNumber_(sheet, 'FileId', fileId);
    var values = { FileId: fileId, SamplesJson: JSON.stringify(samples || []), UpdatedAt: new Date() };
    var row = headers.map(function(header) { return values[header] === undefined ? '' : values[header]; });
    if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    else sheet.getRange(Math.max(sheet.getLastRow(), 1) + 1, 1, 1, row.length).setValues([row]);
  });
}

function parseDriveFileId_(value) {
  var raw = text_(value);
  if (!raw) return '';
  var match = /\/(?:document|file|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/.exec(raw)
    || /\/folders\/([a-zA-Z0-9_-]+)/.exec(raw)
    || /[?&]id=([a-zA-Z0-9_-]+)/.exec(raw);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw)) return raw;
  return '';
}

function countWords_(text) {
  var cleaned = String(text || '').replace(/^\uFEFF/, '').replace(/\u00a0/g, ' ').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function pad2_(value) {
  var text = String(value);
  return text.length < 2 ? '0' + text : text;
}

function addDays_(dayKey, days) {
  var parts = String(dayKey || '').split('-');
  var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.getUTCFullYear() + '-' + pad2_(date.getUTCMonth() + 1) + '-' + pad2_(date.getUTCDate());
}

function mondayOnOrBefore_(dayKey) {
  var parts = String(dayKey || '').split('-');
  var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  var weekday = date.getUTCDay();
  var back = weekday === 0 ? 6 : weekday - 1;
  return addDays_(dayKey, -back);
}

function sampleTime_(sample) {
  var at = Number(sample && sample.t);
  if (isFinite(at)) return at;
  var day = sample && sample.d;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return NaN;
  return Date.parse(day + 'T12:00:00Z');
}

function rememberWordSample_(samples, wordCount, now, dayKey) {
  var when = now instanceof Date ? now : new Date(now);
  var day = /^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || ''))
    ? String(dayKey)
    : when.getUTCFullYear() + '-' + pad2_(when.getUTCMonth() + 1) + '-' + pad2_(when.getUTCDate());
  var next = [];
  var seen = false;
  (samples || []).forEach(function(sample) {
    if (!sample || !sample.d) return;
    if (sample.d === day) {
      seen = true;
      next.push(sample);
      return;
    }
    next.push({ d: sample.d, w: Number(sample.w), t: sample.t });
  });
  if (!seen) next.push({ d: day, w: Math.round(Number(wordCount) || 0), t: when.getTime() });
  next.sort(function(left, right) { return left.d < right.d ? -1 : left.d > right.d ? 1 : 0; });
  if (next.length > DOC_WORD_SAMPLE_LIMIT) next = next.slice(next.length - DOC_WORD_SAMPLE_LIMIT);
  return next;
}

function wordSamplesChanged_(before, after) {
  return JSON.stringify(before || []) !== JSON.stringify(after || []);
}

function wordsTypedSince_(samples, wordCount, nowMs, targetMs, toleranceMs) {
  var best = null;
  var bestDistance = Infinity;
  (samples || []).forEach(function(sample) {
    var at = sampleTime_(sample);
    var words = Number(sample && sample.w);
    if (!isFinite(at) || !isFinite(words) || at > nowMs) return;
    var distance = Math.abs(at - targetMs);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = words;
    }
  });
  if (best === null || bestDistance > toleranceMs) return null;
  return Math.round(Number(wordCount) - best);
}

function editStreak_(dayKeys, todayKey) {
  var present = {};
  (dayKeys || []).forEach(function(key) { if (key) present[key] = true; });
  var cursor = todayKey;
  if (!present[cursor]) {
    cursor = addDays_(todayKey, -1);
    if (!present[cursor]) return 0;
  }
  var streak = 0;
  while (present[cursor] && streak < 400) {
    streak += 1;
    cursor = addDays_(cursor, -1);
  }
  return streak;
}

function editHeatLevel_(count) {
  var value = Number(count) || 0;
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value <= 3) return 2;
  if (value <= 6) return 3;
  return 4;
}

function monthLabel_(dayKey) {
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var month = Number(String(dayKey || '').split('-')[1]);
  return names[month - 1] || '';
}

function buildEditHeatmap_(dayCounts, todayKey, weeks) {
  var totalWeeks = Math.max(1, Number(weeks) || DOC_HEATMAP_WEEKS);
  var start = addDays_(mondayOnOrBefore_(todayKey), -7 * (totalWeeks - 1));
  var days = [];
  var months = [];
  var lastMonth = '';
  var counts = dayCounts || {};
  for (var week = 0; week < totalWeeks; week++) {
    var monday = addDays_(start, week * 7);
    var monthOnFirst = '';
    for (var offset = 0; offset < 7; offset++) {
      var key = addDays_(monday, offset);
      if (key.slice(8) === '01') monthOnFirst = monthLabel_(key);
    }
    var label = week === 0 ? (monthOnFirst || monthLabel_(monday)) : monthOnFirst;
    if (label && label !== lastMonth) {
      months.push({ column: week, label: label });
      lastMonth = label;
    }
    for (var day = 0; day < 7; day++) {
      var date = addDays_(monday, day);
      var future = date > todayKey;
      var count = future ? 0 : (counts[date] || 0);
      days.push({ date: date, count: count, level: future ? 0 : editHeatLevel_(count), future: future });
    }
  }
  return { days: days, months: months };
}
