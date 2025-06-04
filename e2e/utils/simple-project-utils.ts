import { randomUUID } from 'crypto';
import { backupManager } from './backup-manager';
import { resetWorkspaceContext } from 'nx/src/utils/workspace-context';
import { runCLI, RunCmdOpts } from './command-utils';
import * as isCI from 'is-ci';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

// Global counter for test suite isolation
let suiteId: string | undefined;

/**
 * Get or create a unique test suite ID
 */
export function getTestSuiteId(): string {
  if (!suiteId) {
    suiteId = `suite-${randomUUID().slice(0, 6)}`;
  }
  return suiteId;
}

/**
 * Simplified project creation using BackupManager
 */
export async function newProject({
  name,
  packageManager = 'npm' as PackageManager,
  packages,
  preset = 'apps',
}: {
  name?: string;
  packageManager?: PackageManager;
  readonly packages?: Array<string>;
  preset?: string;
} = {}): Promise<string> {
  // Generate unique test ID
  const testRunId = `${getTestSuiteId()}-${randomUUID().slice(0, 8)}`;

  // Store test ID for cleanup
  process.env.TEST_RUN_ID = testRunId;

  // Create project using BackupManager
  const projName = await backupManager.createProject(
    {
      packageManager,
      packages,
      preset,
    },
    testRunId,
    name
  );

  return projName;
}

/**
 * Simplified cleanup using BackupManager
 */
export function cleanupProject({
  skipReset,
  ...opts
}: RunCmdOpts & { skipReset?: boolean } = {}) {
  const testRunId = process.env.TEST_RUN_ID;

  // Clean up the project and backup using BackupManager
  if (testRunId) {
    backupManager.cleanupProject(testRunId);
  }

  // CI-specific cleanup
  if (isCI) {
    try {
      if (!skipReset) {
        runCLI('reset', opts);
      }
    } catch {} // ignore crashed daemon

    try {
      backupManager.cleanupOldBackups();
    } catch {}
  }

  if (testRunId) {
    delete process.env.TEST_RUN_ID;
  }

  resetWorkspaceContext();
}

/**
 * Get project name for current test
 */
export function getProjectName(): string {
  const testRunId = process.env.TEST_RUN_ID;
  if (!testRunId) {
    throw new Error('No active test project');
  }
  return `proj-${testRunId}`;
}

/**
 * Generate unique string with prefix
 */
export function uniq(prefix: string): string {
  const randomSevenDigitNumber = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, '0');
  return `${prefix}${randomSevenDigitNumber}`;
}
