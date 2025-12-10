import type { PlaywrightTestConfig } from '@playwright/test';

export type ReporterOutput = [reporter: string, output?: string];

export function getReporterOutputs(
  playwrightConfig: PlaywrightTestConfig
): Array<ReporterOutput> {
  const reporters: Array<ReporterOutput> = [];

  const reporterConfig = playwrightConfig.reporter;
  if (!reporterConfig) {
    // `list` is the default reporter except in CI where `dot` is the default.
    // https://playwright.dev/docs/test-reporters#list-reporter
    return [[process.env.CI ? 'dot' : 'list']];
  }

  const defaultHtmlOutputDir = 'playwright-report';
  const defaultBlobOutputDir = 'blob-report';
  if (reporterConfig === 'html') {
    reporters.push([reporterConfig, defaultHtmlOutputDir]);
  } else if (reporterConfig === 'blob') {
    reporters.push([reporterConfig, defaultBlobOutputDir]);
  } else if (typeof reporterConfig === 'string') {
    reporters.push([reporterConfig]);
  } else if (Array.isArray(reporterConfig)) {
    for (const [reporter, opts] of reporterConfig) {
      // There are a few different ways to specify an output file or directory
      // depending on the reporter. This is a best effort to find the output.
      if (opts?.outputFile) {
        reporters.push([reporter, opts.outputFile]);
      } else if (opts?.outputDir) {
        reporters.push([reporter, opts.outputDir]);
      } else if (opts?.outputFolder) {
        reporters.push([reporter, opts.outputFolder]);
      } else if (reporter === 'html') {
        reporters.push([reporter, defaultHtmlOutputDir]);
      } else if (reporter === 'blob') {
        reporters.push([reporter, defaultBlobOutputDir]);
      } else {
        reporters.push([reporter]);
      }
    }
  }

  return reporters;
}
