import {
  getPackageManagerCommand,
  output,
  type ExecutorContext,
} from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import type { PlaywrightTestConfig, TestStatus } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Schema } from './schema';

export async function mergeReportsExecutor(
  options: Schema,
  context: ExecutorContext
) {
  const { config, expectedSuites, skipBlobReporter = true } = options;

  const projectRoot = join(
    context.root,
    context.projectsConfigurations.projects[context.projectName].root
  );
  const configPath = join(projectRoot, config);
  const playwrightConfig = await loadConfigFile<PlaywrightTestConfig>(
    configPath
  );
  const reporters = getReporters(playwrightConfig);

  if (!reporters.includes('blob')) {
    output.warn({
      title: 'The blob reporter is not configured',
      bodyLines: [
        'The "blob" reporter is not configured in the Playwright configuration file. Skipping the merge reports step.',
        'To merge reports from different tasks, configure the "blob" reporter in the Playwright configuration file.',
        'If you are using the Nx preset from "@nx/playwright/preset", you can set `generateBlobReports` to `true` in the preset options to generate blob reports.',
        'See https://playwright.dev/docs/test-reporters#blob-reporter and https://playwright.dev/docs/test-cli#merge-reports for more details.',
      ],
    });

    return { success: true };
  }

  const pmc = getPackageManagerCommand();
  const blobReportDir = getBlobReportDir(playwrightConfig, projectRoot);
  let command = `${pmc.exec} playwright merge-reports "${blobReportDir}"`;

  if (skipBlobReporter) {
    command += ` --reporter=${reporters.filter((r) => r !== 'blob').join(',')}`;
    if (reporters.length === 1) {
      output.warn({
        title: 'Cannot skip the "blob" reporter',
        bodyLines: [
          'Cannot skip the "blob" reporter when it is the only reporter configured.',
          'Please add another reporter to produce the merged report, or set `skipBlobReporter` to `false` to produce the merged report with the "blob" reporter.',
        ],
      });
    }
  } else {
    command += ` --config="${configPath}"`;
  }

  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: 'inherit',
      windowsHide: false,
    });
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

function getReporters(playwrightConfig: PlaywrightTestConfig): string[] {
  if (!playwrightConfig.reporter) {
    // `list` is the default reporter except in CI where `dot` is the default
    // https://playwright.dev/docs/test-reporters#list-reporter
    return process.env.CI !== 'true' ? ['list'] : ['dot'];
  }

  if (typeof playwrightConfig.reporter === 'string') {
    return [playwrightConfig.reporter];
  }

  if (Array.isArray(playwrightConfig.reporter)) {
    return playwrightConfig.reporter.map((reporter) => reporter[0]);
  }

  return [];
}

// https://playwright.dev/docs/test-reporters#blob-reporter
const defaultBlobReportDir = 'blob-report';
function getBlobReportDir(
  playwrightConfig: PlaywrightTestConfig,
  projectRoot: string
): string {
  // must be defined and there must be a blob reporter, otherwise the executor
  // would have bailed out by now
  const reporter = playwrightConfig.reporter!;
  if (reporter === 'blob') {
    return join(projectRoot, defaultBlobReportDir);
  }

  if (Array.isArray(reporter)) {
    const blobReporter = reporter.find((r) => r[0] === 'blob')!;

    const options = blobReporter[1];
    if (options?.outputFile) {
      return join(projectRoot, dirname(options.outputFile));
    }

    return (
      options?.outputDir ??
      join(projectRoot, options.outputDir) ??
      join(projectRoot, defaultBlobReportDir)
    );
  }
}
