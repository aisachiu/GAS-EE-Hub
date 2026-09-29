function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('VSA EE Hub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}