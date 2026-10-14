/** OPTIONAL STAGING-ONLY editor diagnostics. Never install in production or dispatch over HTTP. */
function stagingContext_() {
  const properties = PropertiesService.getScriptProperties();
  const expectedId = properties.getProperty('STAGING_SHEET_ID');
  if (properties.getProperty('STAGING_ONLY') !== 'true' || !expectedId) {
    throw new Error('Staging-only diagnostics require explicit test-project configuration.');
  }
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || spreadsheet.getId() !== expectedId) {
    throw new Error('Wrong or unavailable staging spreadsheet context.');
  }
  return { properties: properties, spreadsheet: spreadsheet };
}

function checkStagingFiles() {
  const context = stagingContext_();
  const sheet = context.spreadsheet.getActiveSheet();
  const expected = ['ID', 'Name', 'Phone', 'Age', 'Weight', 'Membership Type', 'Start Date', 'End Date', 'Notified'];
  const headers = sheet.getRange(1, 1, 1, 9).getDisplayValues()[0];
  const result = {
    codeLoaded: typeof doGet === 'function' && typeof doPost === 'function',
    authLoaded: typeof loginOwner_ === 'function' && typeof validateOwnerSession_ === 'function',
    bcryptLoaded: typeof bcrypt !== 'undefined' && typeof bcrypt.compareSync === 'function',
    ownerConfigured: ownerConfiguration_() !== null,
    membersTabSelectedInEditor: sheet.getName() === 'Members',
    nineHeadersMatch: JSON.stringify(headers) === JSON.stringify(expected)
  };
  // Booleans only. Editor success is NOT evidence that web-app Sheet access works.
  console.log(JSON.stringify(result));
  return result;
}

function benchmarkStagingAuthentication() {
  const context = stagingContext_();
  const password = context.properties.getProperty('STAGING_BENCHMARK_PASSWORD');
  if (!password) throw new Error('Set a temporary staging benchmark password privately first.');
  try {
    const config = ownerConfiguration_();
    if (!config) throw new Error('Staging owner is not configured.');
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const started = Date.now();
      const response = loginOwner_({ ownerId: config.ownerId, password: password });
      const duration = Date.now() - started;
      if (!response.success) throw new Error('Benchmark login failed; inspect configuration or throttle privately.');
      const session = validateOwnerSession_(response.sessionToken);
      if (!session) throw new Error('Benchmark session validation failed.');
      session.properties.deleteProperty(session.key);
      samples.push(duration);
    }
    const sorted = samples.slice().sort(function (a, b) { return a - b; });
    const report = {
      benchmark: 'owner-login-editor', cost: bcrypt.getRounds(config.verifier),
      samples: samples.length, firstMs: samples[0], minMs: sorted[0], medianMs: sorted[2], maxMs: sorted[4]
    };
    // Only timings: no password, verifier, ID, token, Sheet ID, or member data.
    console.log(JSON.stringify(report));
    return report;
  } finally {
    context.properties.deleteProperty('STAGING_BENCHMARK_PASSWORD');
  }
}
