// Release snapshots assert CLI output, not GitHub's workflow-command wrappers.
// Log grouping remains covered by the core output tests and other e2e suites.
process.env.NX_SKIP_LOG_GROUPING = 'true';

// Nightlies enable verbose logging globally, but these snapshots describe the
// default CLI output. Individual cases still opt in with an explicit --verbose.
process.env.NX_E2E_VERBOSE_LOGGING = 'false';
process.env.NX_VERBOSE_LOGGING = 'false';
