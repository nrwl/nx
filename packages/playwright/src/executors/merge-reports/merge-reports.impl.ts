import {
  getPackageManagerCommand,
  output,
  type ExecutorContext,
} from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import type { PlaywrightTestConfig } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
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

  const result = spawnSync(
    pmc.exec,
    [
      'playwright',
      'merge-reports',
      blobReportDir,
      `--reporter=${reporters.join(',')}`,
    ],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        // when specifying reporters directly, we need to set the relevant env
        // vars for all reporter with their output dirs/files
        ...getEnvVarsForReporters(reporterOutputs),
      },
      shell: true,
      windowsHide: false,
    }
  );

  if (result.error) {
    output.error({
      title: 'Merging the blob reports failed',
      bodyLines: [result.error.message, 'See above for more details.'],
    });

    return { success: false };
  }

  if (result.status !== 0) {
    output.error({
      title: 'Merging the blob reports failed',
      bodyLines: [
        `Process exited with code ${result.status}`,
        'See above for more details.',
      ],
    });

    return { success: false };
  }

  if (expectedSuites !== undefined) {
    const blobReportFiles = collectBlobReports(
      join(projectRoot, blobReportDir)
    );
    if (blobReportFiles.length !== expectedSuites) {
      output.warn({
        title: 'Some test results were not reported',
        bodyLines: [
          `Expected results for ${expectedSuites} test suites, but only ${blobReportFiles.length} were reported.`,
        ],
      });
    }
  }

  return { success: true };
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
