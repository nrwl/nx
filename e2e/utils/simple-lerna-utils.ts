import { randomUUID } from 'crypto';
import { backupManager } from './backup-manager';
import { resetWorkspaceContext } from 'nx/src/utils/workspace-context';
import { runCLI, RunCmdOpts } from './command-utils';
import * as isCI from 'is-ci';
import {
  getSelectedPackageManager,
  isVerboseE2ERun,
  getStrippedEnvironmentVariables,
} from './get-env-info';
import { execSync } from 'node:child_process';
import { output } from '@nx/devkit';
import { logError, stripConsoleColors } from './log-utils';
import { e2eCwd } from './get-env-info';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { ensureDirSync, writeFileSync } from 'fs-extra';

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
 * Get the current Lerna project path
 */
export function tmpLernaProjPath(path?: string): string {
  const testRunId = process.env.TEST_RUN_ID;
  if (!testRunId) {
    throw new Error(
      'No active Lerna workspace. Call newLernaWorkspace() first.'
    );
  }

  const projName = `lerna-proj-${testRunId}`;
  const projPath = `${e2eCwd}/${projName}`;

  return path ? `${projPath}/${path}` : projPath;
}

/**
 * Get current test run ID from call stack or generate new one
 */
function getCurrentTestRunId(): string {
  if (process.env.TEST_RUN_ID) return process.env.TEST_RUN_ID;

  const testId = `${getTestSuiteId()}-${randomUUID().slice(0, 6)}`;
  process.env.TEST_RUN_ID = testId;
  return testId;
}

/**
 * Executes Lerna CLI commands in the current workspace
 */
export function runLernaCLI(command: string, opts?: RunCmdOpts): string {
  const workspacePath = tmpLernaProjPath();

  // Simple package manager detection without relying on tmpProjPath()
  let packageManager: PackageManager = getSelectedPackageManager();

  try {
    // Try to read package.json directly to detect workspace setup
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // Detect based on lock files and workspace setup
    if (existsSync(path.join(workspacePath, 'pnpm-workspace.yaml'))) {
      packageManager = 'pnpm';
    } else if (existsSync(path.join(workspacePath, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else if (existsSync(path.join(workspacePath, 'package-lock.json'))) {
      packageManager = 'npm';
    } else if (existsSync(path.join(workspacePath, 'bun.lockb'))) {
      packageManager = 'bun';
    }
  } catch {
    // Fallback to default package manager if detection fails
  }

  // Get package manager commands directly
  const pm = {
    npm: `npx lerna`,
    yarn: `yarn lerna`,
    pnpm: `pnpm exec lerna`,
    bun: `bunx lerna`,
  }[packageManager];

  const fullCommand = `${pm} ${command}`;

  try {
    const logs = execSync(fullCommand, {
      cwd: workspacePath,
      env: {
        CI: 'true',
        ...getStrippedEnvironmentVariables(),
        ...opts?.env,
      },
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
    });

    if (opts?.verbose ?? isVerboseE2ERun()) {
      output.log({
        title: `Original command: ${fullCommand}`,
        bodyLines: [logs as string],
        color: 'green',
      });
    }

    return stripConsoleColors(logs);
  } catch (e) {
    if (opts?.silenceError) {
      return stripConsoleColors(e.stdout + e.stderr);
    } else {
      logError(
        `Original command: ${fullCommand}`,
        `${e.stdout}\n\n${e.stderr}`
      );
      throw e;
    }
  }
}

/**
 * Simplified Lerna workspace creation using BackupManager
 */
export async function newLernaWorkspace({
  name,
  packageManager = getSelectedPackageManager(),
}: {
  name?: string;
  packageManager?: PackageManager;
} = {}): Promise<string> {
  // Generate unique test ID
  const testRunId = `${getTestSuiteId()}-${randomUUID().slice(0, 8)}`;

  // Store test ID for cleanup
  process.env.TEST_RUN_ID = testRunId;

  // Create Lerna workspace using BackupManager
  const projName = await backupManager.createLernaWorkspace(
    packageManager,
    testRunId,
    name
  );

  return projName;
}

/**
 * Simplified cleanup using BackupManager
 */
export function cleanupLernaWorkspace({
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
export function getLernaProjectName(): string {
  const testRunId = process.env.TEST_RUN_ID;
  if (!testRunId) {
    throw new Error('No active Lerna project');
  }
  return `lerna-proj-${testRunId}`;
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
 * Update JSON file in the lerna workspace
 */
export function updateJson<T extends object = any, U extends object = T>(
  filePath: string,
  updater: (value: T) => U
) {
  const fullPath = tmpLernaProjPath(filePath);
  ensureDirSync(path.dirname(fullPath));

  const content = readFileSync(fullPath, 'utf-8');
  const json = JSON.parse(content);
  const updated = updater(json);
  writeFileSync(fullPath, JSON.stringify(updated, null, 2));
}
