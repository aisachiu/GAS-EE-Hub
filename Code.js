function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('VSA EE Hub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('EE System')
    .addItem('Sheets Field Check', 'showSheetFieldCheck')
    .addItem('Create Missing Sheets', 'createMissingSheets')
    .addToUi();
}

function showSheetFieldCheck() {
  var report = getTableSchemaReport();
  var lines = [
    'Checked: ' + report.checkedAt,
    'Passes: ' + report.passCount + '    Issues: ' + report.issueCount,
    ''
  ];
  report.sheets.forEach(function(item) {
    lines.push((item.status === 'PASS' ? 'PASS' : 'ISSUE') + '  ' + item.sheet);
    item.issues.forEach(function(issue) { lines.push('  - ' + issue); });
  });
  SpreadsheetApp.getUi().alert('Sheets Field Check', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function createMissingSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var created = [];
  var migrated = [];
  var declined = [];
  var issues = [];
  var legacyTemplates = spreadsheet.getSheetByName('MILESTONES');
  var templateSheetExists = spreadsheet.getSheetByName(APP_TABLES.milestoneTemplates.sheet);
  var skipTemplateCreation = false;

  if (legacyTemplates && !templateSheetExists) {
    skipTemplateCreation = true;
    try {
      var legacyReport = inspectSheetSchema_(legacyTemplates, 'milestoneTemplates');
      if (legacyReport.issues.length) {
        issues.push('MILESTONES cannot be renamed: ' + legacyReport.issues.join(' '));
      } else {
        var renameChoice = ui.alert(
          'Rename legacy milestone sheet?',
          'Rename MILESTONES to MILESTONE_TEMPLATES? Existing data and columns will be preserved.',
          ui.ButtonSet.YES_NO
        );
        if (renameChoice === ui.Button.YES) {
          legacyTemplates.setName(APP_TABLES.milestoneTemplates.sheet);
          migrated.push('MILESTONES → MILESTONE_TEMPLATES');
          skipTemplateCreation = false;
        } else {
          declined.push(APP_TABLES.milestoneTemplates.sheet + ' (legacy MILESTONES was left unchanged)');
        }
      }
    } catch (error) {
      issues.push(String(error.message || error));
    }
  }

  Object.keys(APP_TABLES).forEach(function(entity) {
    var config = APP_TABLES[entity];
    if (config.sheetPattern) return;
    if (entity === 'milestoneTemplates' && skipTemplateCreation) return;
    createSheetAfterConfirmation_(spreadsheet, ui, config.sheet, getTableHeaders_(entity), created, declined);
  });

  var cohortRegistry = spreadsheet.getSheetByName(APP_TABLES.cohorts.sheet);
  if (cohortRegistry && cohortRegistry.getLastRow() > 1) {
    try {
      assertSheetSchema_(cohortRegistry, 'cohorts');
      readRecords_(cohortRegistry).forEach(function(record) {
        var cohortId = text_(record.Cohort);
        if (!cohortId) return;
        var sheetName = cohortSheetName_(cohortId);
        createSheetAfterConfirmation_(spreadsheet, ui, sheetName, getTableHeaders_('cohortMembers'), created, declined);
      });
    } catch (error) {
      issues.push(String(error.message || error));
    }
  }

  var summary = [
    'Created: ' + (created.length ? created.join(', ') : 'none'),
    'Migrated: ' + (migrated.length ? migrated.join(', ') : 'none'),
    'Skipped by user: ' + (declined.length ? declined.join(', ') : 'none')
  ];
  if (issues.length) summary.push('Issues: ' + issues.join(' | '));
  ui.alert('Create Missing Sheets', summary.join('\n'), ui.ButtonSet.OK);
}

function createSheetAfterConfirmation_(spreadsheet, ui, sheetName, headers, created, declined) {
  if (spreadsheet.getSheetByName(sheetName)) return;
  var choice = ui.alert(
    'Create missing sheet?',
    'Create "' + sheetName + '" with these headers?\n\n' + headers.join(', '),
    ui.ButtonSet.YES_NO
  );
  if (choice !== ui.Button.YES) {
    declined.push(sheetName);
    return;
  }
  var sheet = spreadsheet.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  created.push(sheetName);
}