import { randomUUID } from 'crypto';
import { backupManager } from './backup-manager';
import { resetWorkspaceContext } from 'nx/src/utils/workspace-context';
import { runCLI, RunCmdOpts } from './command-utils';
import * as isCI from 'is-ci';
import { NxPackage, nxPackages, PackageManager } from './ types';

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
  readonly packages?: NxPackage[];
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
      packages: packages || [...nxPackages],
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

/**
 * Create an Nx plugin workspace using create-nx-plugin
 * This creates a plugin workspace and integrates with the simple project utils system
 */
export async function createNxPlugin(
  name: string,
  {
    packageManager = 'npm' as PackageManager,
    extraArgs,
    useDetectedPm = false,
  }: {
    packageManager?: PackageManager;
    extraArgs?: string;
    useDetectedPm?: boolean;
  } = {}
): Promise<string> {
  // Import the original runCreatePlugin function and use it directly
  const { runCreatePlugin, getProjectName } = require('./create-project-utils');

  runCreatePlugin(name, {
    packageManager,
    extraArgs,
    useDetectedPm,
  });

  // Get the actual project name that was set by runCreatePlugin
  const actualProjectName = getProjectName();

  // Generate test ID for cleanup integration using actual project name
  const testRunId = `${getTestSuiteId()}-${randomUUID().slice(0, 8)}`;
  process.env.TEST_RUN_ID = testRunId;

  // Register with backup manager for cleanup using the actual project name
  const { e2eCwd } = require('./get-env-info');
  const pluginProjectPath = `${e2eCwd}/${actualProjectName}`;
  backupManager.registerProject(testRunId, {
    projName: actualProjectName,
    projPath: pluginProjectPath,
    backupPath: undefined,
    isTemporary: true,
  });

  return actualProjectName;
}

/**
 * Create an Nx workspace using create-nx-workspace
 * This creates a workspace and integrates with the simple project utils system
 */
export function createNxWorkspace(name: string, options: any = {}): string {
  // Import the original runCreateWorkspace function and use it directly
  const {
    runCreateWorkspace,
    getProjectName,
  } = require('./create-project-utils');

  const result = runCreateWorkspace(name, options);

  // Get the actual project name that was set by runCreateWorkspace
  const actualProjectName = getProjectName();

  // Generate test ID for cleanup integration using actual project name
  const testRunId = `${getTestSuiteId()}-${randomUUID().slice(0, 8)}`;
  process.env.TEST_RUN_ID = testRunId;

  // Register with backup manager for cleanup using the actual project name
  const { e2eCwd } = require('./get-env-info');
  const workspaceProjectPath = `${e2eCwd}/${actualProjectName}`;
  backupManager.registerProject(testRunId, {
    projName: actualProjectName,
    projPath: workspaceProjectPath,
    backupPath: undefined,
    isTemporary: true,
  });

  return result;
}
