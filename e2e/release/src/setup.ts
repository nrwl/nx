// Release snapshots assert CLI output, not GitHub's workflow-command wrappers.
// Log grouping remains covered by the core output tests and other e2e suites.
process.env.NX_SKIP_LOG_GROUPING = 'true';
