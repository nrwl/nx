import {
  getPackageManagerCommand,
  output,
  type ExecutorContext,
} from '@nx/devkit';
import type { TestStatus } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Schema } from './schema';

export async function mergeReportsExecutor(
  options: Schema,
  context: ExecutorContext
) {
  const { blobReportsDir, config, expectedSuites } = options;
  const projectRoot = join(
    context.root,
    context.projectsConfigurations.projects[context.projectName].root
  );

  // We need to use the absolute path to the blob reports directory and the config file
  // because some package managers (e.g. pnpm) can mess with the process cwd
  const blobReportsDirPath = join(projectRoot, blobReportsDir);
  const configPath = join(projectRoot, config);

  const pmc = getPackageManagerCommand();
  try {
    execSync(
      `${pmc.exec} playwright merge-reports "${blobReportsDirPath}" --config="${configPath}"`,
      {
        cwd: projectRoot,
        stdio: 'inherit',
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

  const blobReportFiles = collectBlobReports(join(projectRoot, blobReportsDir));
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
