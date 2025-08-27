import {
  getPackageManagerCommand,
  output,
  type ExecutorContext,
} from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import type { PlaywrightTestConfig, TestStatus } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { getReporterOutputs, type ReporterOutput } from '../../utils/reporters';
import type { Schema } from './schema';

export async function mergeReportsExecutor(
  options: Schema,
  context: ExecutorContext
) {
  const { config, expectedSuites } = options;

  const projectRoot = join(
    context.root,
    context.projectsConfigurations.projects[context.projectName].root
  );
  const configPath = join(projectRoot, config);
  const playwrightConfig = await loadConfigFile<PlaywrightTestConfig>(
    configPath
  );
  const reporterOutputs = getReporterOutputs(playwrightConfig);
  const blobReporterOutput = reporterOutputs.find(
    ([reporter]) => reporter === 'blob'
  );

  if (!blobReporterOutput) {
    output.warn({
      title: 'The blob reporter is not configured',
      bodyLines: [
        'The "blob" reporter is not configured in the Playwright configuration. Skipping merging the reports.',
        '',
        'To merge reports across tasks, enable the "blob" reporter in your Playwright configuration.',
        'If using the preset from "@nx/playwright/preset", you can do this by setting `generateBlobReports: true` in the preset options.',
        '',
        'For more information see:',
        '- Blob reporter: https://playwright.dev/docs/test-reporters#blob-reporter',
        '- Merging reports: https://playwright.dev/docs/test-cli#merge-reports',
      ],
    });

    return { success: true };
  }

  if (reporterOutputs.length === 1) {
    output.error({
      title: 'No additional reporters are configured',
      bodyLines: [
        'Only the "blob" reporter is configured in your Playwright configuration.',
        'To produce a merged report, add at least one additional reporter alongside the "blob" reporter.',
      ],
    });

    return { success: false };
  }

  const reporters = reporterOutputs
    .filter(([reporter]) => reporter !== 'blob')
    .map(([reporter]) => reporter);
  const blobReportDir = blobReporterOutput[1];
  const pmc = getPackageManagerCommand();

  try {
    execSync(
      `${
        pmc.exec
      } playwright merge-reports "${blobReportDir}" --reporter=${reporters.join(
        ','
      )}`,
      {
        cwd: projectRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          // when specifying reporters directly, we need to set the relevant env
          // vars for all reporter with their output dirs/files
          ...getEnvVarsForReporters(reporterOutputs),
        },
        windowsHide: false,
      }
    );
  } catch (error) {
    output.error({
      title: 'Merging the blob reports failed',
      bodyLines: [error.message ?? error, 'See above for more details.'],
    });

    return { success: false };
  }

  const blobReportFiles = collectBlobReports(join(projectRoot, blobReportDir));
  const status = parseBlobReportsStatus(blobReportFiles, context.isVerbose);

  const ranExpectedSuites = blobReportFiles.length === expectedSuites;
  if (!ranExpectedSuites) {
    output.error({
      title: 'Some test results were not reported',
      bodyLines: [
        `Expected results for ${expectedSuites} test suites, but only ${blobReportFiles.length} were reported.`,
      ],
    });
  }

  return {
    success: status === 'passed' && ranExpectedSuites,
  };
}

export default mergeReportsExecutor;

function collectBlobReports(blobReportsDir: string): string[] {
  const blobReportFiles: string[] = [];

  for (const report of readdirSync(blobReportsDir)) {
    if (report.endsWith('.jsonl')) {
      blobReportFiles.push(join(blobReportsDir, report));
    }
  }

  return blobReportFiles;
}

function parseBlobReportsStatus(
  filePaths: string[],
  isVerbose: boolean
): TestStatus {
  let passed = true;

  for (const filePath of filePaths) {
    const content = readFileSync(filePath, 'utf8');
    const events = parseBlobReportEvents(content, isVerbose);

    for (const {
      params: { result },
    } of events) {
      if (
        result.status === 'failed' ||
        result.status === 'interrupted' ||
        result.status === 'timedOut'
      ) {
        passed = false;
      }
    }
  }

  return passed ? 'passed' : 'failed';
}

interface BlobReportMetadataEvent {
  method: 'onBlobReportMetadata';
  params: {
    version: number;
  };
}
interface BlobReportEndEvent {
  method: 'onEnd';
  params: {
    result: {
      status: TestStatus;
    };
  };
}

// Regexes to filter essential events to avoid unnecessary JSON parsing
const BLOB_REPORT_METADATA_EVENTS_REGEX = /"method":\s*"onBlobReportMetadata"/;
const TEST_END_EVENTS_REGEX = /"method":\s*"onEnd"/;
// Current blob report version
// https://github.com/microsoft/playwright/blob/0027bd97cb080220051cadc8f67ed66c3caf5404/packages/playwright/src/reporters/blob.ts#L34
const currentBlobReportVersion = 2;

function parseBlobReportEvents(
  content: string,
  isVerbose: boolean
): BlobReportEndEvent[] {
  const events: BlobReportEndEvent[] = [];

  const lines = content.split('\n');
  for (const line of lines) {
    if (line.length === 0) {
      continue;
    }

    if (BLOB_REPORT_METADATA_EVENTS_REGEX.test(line)) {
      try {
        const event = JSON.parse(line.trim()) as BlobReportMetadataEvent;
        if (event.params.version > currentBlobReportVersion) {
          output.error({
            title: `Blob report was created with a newer version of Playwright`,
            bodyLines: [
              `Found version ${event.params.version}, current version is ${currentBlobReportVersion}.`,
              `Please report this error at: https://github.com/nrwl/nx/issues/new/choose`,
            ],
          });
          throw new Error(
            `Blob report was created with a newer version of Playwright. See above for more details.`
          );
        }
      } catch (error) {
        if (isVerbose) {
          console.warn(`Failed to parse line: ${line}`, error);
        }
      }
    }

    if (!TEST_END_EVENTS_REGEX.test(line)) {
      // skip lines that don't contain test end events
      continue;
    }

    try {
      const event = JSON.parse(line.trim()) as BlobReportEndEvent;
      events.push(event);
    } catch (error) {
      if (isVerbose) {
        console.warn(`Failed to parse line: ${line}`, error);
      }
    }
  }

  return events;
}

function getEnvVarsForReporters(
  reporterOutputs: ReporterOutput[]
): Record<string, string> {
  const env: Record<string, string> = {};
  for (let [reporter, output] of reporterOutputs) {
    if (!output) {
      continue;
    }

    const isFile = extname(output) !== '';
    let envVarName: string;
    envVarName = `PLAYWRIGHT_${reporter.toUpperCase()}_OUTPUT_${
      isFile ? 'FILE' : 'DIR'
    }`;

    env[envVarName] = output;
    // Also set PLAYWRIGHT_HTML_REPORT for Playwright prior to 1.45.0.
    // HTML prior to this version did not follow the pattern of "PLAYWRIGHT_<REPORTER>_OUTPUT_<FILE|DIR>".
    if (reporter === 'html') {
      env['PLAYWRIGHT_HTML_REPORT'] = env[envVarName];
    }
  }

  return env;
}
