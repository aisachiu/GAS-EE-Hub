function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('VSA EE Hub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('EE Sytem')
    .addItem('Sheets Field Check', 'showSheetFieldCheck')
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