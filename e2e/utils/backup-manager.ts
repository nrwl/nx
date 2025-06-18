import { copySync, moveSync, removeSync } from 'fs-extra';
import { execSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as isCI from 'is-ci';
import { directoryExists } from './file-utils';
import {
  e2eCwd,
  isVerbose,
  getLatestLernaVersion,
  getPublishedVersion,
} from './get-env-info';
import { getPackageManagerCommand } from './command-utils';
import { logInfo, logError } from './log-utils';
import { performance } from 'node:perf_hooks';
import { dump } from '@zkochan/js-yaml';
import { NxPackage } from './ types';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
type WorkspaceType = 'nx' | 'lerna';

interface BackupConfig {
  packageManager: PackageManager;
  packages?: Array<NxPackage>;
  preset?: string;
  type?: WorkspaceType;
  extraArgs?: string;
  useDetectedPm?: boolean;
}

interface BackupContext {
  projName: string;
  projPath: string;
  backupPath?: string;
  isTemporary: boolean;
}

export class BackupManager {
  private static instance: BackupManager;
  private contexts = new Map<string, BackupContext>();
  private baseDir: string;
  private processId = process.pid.toString();

  private constructor() {
    this.baseDir = process.env.E2E_TMP_DIR || '/tmp/nx-e2e';
  }

  static getInstance(): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager();
    }
    return BackupManager.instance;
  }

  /**
   * Creates a new project by copying from backup or creating a fresh workspace
   */
  async createProject(
    config: BackupConfig,
    testId: string,
    name?: string
  ): Promise<string> {
    const projName = name || `proj-${testId}`;
    const projPath = `${e2eCwd}/${projName}`;

    const { backupPath, isTemporary } = await this.getOrCreateBackup(config);

    await this.ensureDirectoryExists(path.dirname(projPath));
    copySync(backupPath, projPath);

    // Necessary for clean up
    this.contexts.set(testId, {
      projName,
      projPath,
      backupPath,
      isTemporary,
    });

    return projName;
  }

  async createLernaWorkspace(
    packageManager: PackageManager,
    testId: string,
    name?: string
  ): Promise<string> {
    const projName = name || `lerna-proj-${testId}`;
    const projPath = `${e2eCwd}/${projName}`;

    const { backupPath, isTemporary } = await this.getOrCreateBackup({
      packageManager,
      type: 'lerna',
    });

    await this.ensureDirectoryExists(path.dirname(projPath));
    copySync(backupPath, projPath);

    this.contexts.set(testId, {
      projName,
      projPath,
      backupPath,
      isTemporary,
    });

    return projName;
  }

  /**
   * Get the project path for a given test ID
   */
  getProjectPath(testId: string): string {
    const context = this.contexts.get(testId);
    if (!context) {
      throw new Error(`No project context found for test ID: ${testId}`);
    }
    return context.projPath;
  }

  /**
   * Register a project context manually (for plugin workspaces)
   */
  registerProject(testId: string, context: BackupContext): void {
    this.contexts.set(testId, context);
  }

  cleanupProject(testId: string): void {
    const context = this.contexts.get(testId);
    if (!context) return;

    try {
      if (directoryExists(context.projPath)) {
        removeSync(context.projPath);
      }

      // Cleanup backup based on strategy
      if (context.backupPath && directoryExists(context.backupPath)) {
        if (this.shouldCleanupBackup(context)) {
          removeSync(context.backupPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to cleanup project ${testId}:`, error.message);
    } finally {
      this.contexts.delete(testId);
    }
  }

  /**
   * Cleans up all backups for this process (called on exit)
   */
  cleanupAllProcessBackups(): void {
    if (!isCI) return; // Only needed in CI

    try {
      const backupsDir = path.join(this.baseDir, 'backups');
      if (!directoryExists(backupsDir)) return;

      const entries = readdirSync(backupsDir);
      let cleaned = 0;

      for (const entry of entries) {
        if (entry.includes(`-${this.processId}-`)) {
          try {
            const fullPath = path.join(backupsDir, entry);
            removeSync(fullPath);
            cleaned++;
          } catch {}
        }
      }

      if (cleaned > 0) {
        console.warn(`🧹 Process cleanup: removed ${cleaned} backups`);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private async getOrCreateBackup(
    config: BackupConfig
  ): Promise<{ backupPath: string; isTemporary: boolean }> {
    const backupKey = this.createBackupKey(config);
    const backupPath = path.join(this.baseDir, 'backups', backupKey);

    // Check if backup already exists
    if (await this.directoryExistsAsync(backupPath)) {
      return { backupPath, isTemporary: false };
    }

    // Create backup
    const tempBackupPath = `${backupPath}.tmp.${randomUUID().slice(0, 8)}`;
    await this.createWorkspaceBackup(tempBackupPath, config);

    try {
      // Atomic move to final location
      await fs.rename(tempBackupPath, backupPath);
      return { backupPath, isTemporary: this.isTemporaryBackup(backupKey) };
    } catch {
      // Race condition: someone else created it, use theirs
      try {
        await fs.rm(tempBackupPath, { recursive: true, force: true });
      } catch {}
      return { backupPath, isTemporary: false };
    }
  }

  private createBackupKey(config: BackupConfig): string {
    const {
      packageManager,
      packages = [],
      preset = 'apps',
      type = 'nx',
    } = config;

    // Create configuration hash
    const configString = `${packageManager}-${preset}-${packages
      .sort()
      .join(',')}-${type}`;
    const configHash = this.hashString(configString).slice(0, 8);

    // In CI: add process isolation to avoid conflicts
    if (isCI) {
      const timestamp = Date.now();
      return `${packageManager}-${preset}-${configHash}-${this.processId}-${timestamp}-${type}`;
    }

    // Local: use shared backups for speed
    return `${packageManager}-${preset}-${configHash}-${type}`;
  }

  private async createWorkspaceBackup(
    backupPath: string,
    config: BackupConfig
  ): Promise<void> {
    const { packageManager, packages, preset = 'apps', type = 'nx' } = config;
    const tempWorkspace = `${e2eCwd}/backup-creation-${randomUUID().slice(
      0,
      8
    )}`;

    try {
      if (type === 'lerna') {
        // Create Lerna
        await this.createLernaWorkspaceStructure(tempWorkspace, packageManager);
      } else if (preset === 'plugin') {
        // Create Nx plugin
        const start = performance.mark('create-plugin:start');
        this.runCreatePlugin(tempWorkspace, {
          packageManager,
          extraArgs: config.extraArgs,
          useDetectedPm: config.useDetectedPm,
        });
        const end = performance.mark('create-plugin:end');

        if (isVerbose()) {
          const measure = performance.measure(
            'create-plugin',
            start.name,
            end.name
          );
          logInfo(
            'BackupManager',
            `Plugin creation took ${measure.duration / 1000}s`
          );
        }
      } else {
        // Create Nx workspace
        const start = performance.mark('create-workspace:start');
        this.runCreateWorkspace(tempWorkspace, { preset, packageManager });
        const end = performance.mark('create-workspace:end');

        if (isVerbose()) {
          const measure = performance.measure(
            'create-workspace',
            start.name,
            end.name
          );
          logInfo(
            'BackupManager',
            `Workspace creation took ${measure.duration / 1000}s`
          );
        }

        // Install packages for Nx workspace
        if (packages && packages.length > 0) {
          const installStart = performance.mark('install:start');
          this.installPackages(tempWorkspace, packages, packageManager);
          const installEnd = performance.mark('install:end');

          if (isVerbose()) {
            const measure = performance.measure(
              'install',
              installStart.name,
              installEnd.name
            );
            logInfo(
              'BackupManager',
              `Package installation took ${measure.duration / 1000}s`
            );
          }
        }

        // Reset daemon for Nx workspace
        execSync(`${getPackageManagerCommand().runNx} reset`, {
          cwd: tempWorkspace,
          stdio: isVerbose() ? 'inherit' : 'pipe',
        });
      }

      // Move to backup location
      await this.ensureDirectoryExists(path.dirname(backupPath));
      moveSync(tempWorkspace, backupPath);
    } catch (error) {
      // Cleanup on failure
      try {
        if (directoryExists(tempWorkspace)) {
          removeSync(tempWorkspace);
        }
      } catch {}
      throw error;
    }
  }

  private async createLernaWorkspaceStructure(
    workspaceDir: string,
    packageManager: PackageManager
  ): Promise<void> {
    const workspaceName = path.basename(workspaceDir);
    const pm = getPackageManagerCommand({ packageManager, path: workspaceDir });

    try {
      // Create directory structure
      await this.ensureDirectoryExists(workspaceDir);

      // Create basic package.json (equivalent to createNonNxProjectDirectory)
      // Note: for pnpm, we don't add workspaces here as it will be in pnpm-workspace.yaml
      this.createFileAbsolute(
        path.join(workspaceDir, 'package.json'),
        JSON.stringify(
          {
            name: workspaceName,
            workspaces: packageManager !== 'pnpm' ? ['packages/*'] : undefined,
          },
          null,
          2
        )
      );

      // Create pnpm-specific files (same as original)
      if (packageManager === 'pnpm') {
        this.updateFileAbsolute(
          path.join(workspaceDir, 'pnpm-workspace.yaml'),
          dump({
            packages: ['packages/*'],
          })
        );
        this.updateFileAbsolute(
          path.join(workspaceDir, '.npmrc'),
          'prefer-frozen-lockfile=false\nstrict-peer-dependencies=false\nauto-install-peers=true'
        );
      }

      // Update package.json with overrides (exactly as in original)
      this.updateJsonAbsolute(
        path.join(workspaceDir, 'package.json'),
        (json) => {
          json.private = true;

          const nxVersion = getPublishedVersion();
          const overrides = {
            ...json.overrides,
            nx: nxVersion,
            '@nx/devkit': nxVersion,
          };

          if (packageManager === 'pnpm') {
            json.pnpm = {
              ...json.pnpm,
              overrides: {
                ...json.pnpm?.overrides,
                ...overrides,
              },
            };
          } else if (packageManager === 'yarn') {
            json.resolutions = {
              ...json.resolutions,
              ...overrides,
            };
          } else if (packageManager === 'bun') {
            json.overrides = {
              ...json.resolutions,
              ...overrides,
            };
          } else {
            json.overrides = overrides;
          }
          return json;
        }
      );

      // Install lerna (exactly as in original)
      const lernaVersion = getLatestLernaVersion();
      const baseInstallCmd =
        packageManager === 'npm'
          ? 'npm install --legacy-peer-deps --ignore-scripts -D'
          : pm.addDev;

      const lernaInstallCommand = `${baseInstallCmd} lerna@${lernaVersion}${
        packageManager === 'pnpm'
          ? ' --workspace-root'
          : packageManager === 'yarn'
          ? ' -W'
          : ''
      }`;

      execSync(lernaInstallCommand, {
        cwd: workspaceDir,
        stdio: isVerbose() ? 'inherit' : 'pipe',
        env: {
          CI: 'true',
          ...process.env,
        },
        encoding: 'utf-8',
      });

      // Initialize lerna (exactly as in original)
      execSync(`${pm.runLerna} init`, {
        cwd: workspaceDir,
        stdio: isVerbose() ? 'inherit' : 'pipe',
        env: {
          CI: 'true',
          ...process.env,
        },
        encoding: 'utf-8',
      });

      // Configure lerna for pnpm (exactly as in original)
      if (packageManager === 'pnpm') {
        this.updateJsonAbsolute(
          path.join(workspaceDir, 'lerna.json'),
          (json) => {
            json.npmClient = 'pnpm';
            return json;
          }
        );
      }

      const installCommand =
        packageManager === 'npm' ? 'npm install --ignore-scripts' : pm.install;

      execSync(installCommand, {
        cwd: workspaceDir,
        stdio: isVerbose() ? 'inherit' : 'pipe',
        env: {
          CI: 'true',
          ...process.env,
        },
        encoding: 'utf-8',
      });

      // Format files (exactly as in original)
      execSync(`${pm.runUninstalledPackage} prettier . --write`, {
        cwd: workspaceDir,
        stdio: 'ignore',
      });

      // Verify lerna.json was created
      try {
        const lernaJsonPath = path.join(workspaceDir, 'lerna.json');
        await fs.access(lernaJsonPath);
        logInfo('BackupManager', 'Lerna initialization completed successfully');
      } catch {
        logError(
          'Lerna initialization failed',
          'lerna.json file was not created'
        );
        throw new Error('lerna.json file was not created after lerna init');
      }
    } catch (error) {
      logError('Failed to create Lerna workspace structure', error.message);
      throw error;
    }
  }

  private runCreateWorkspace(
    workspaceDir: string,
    options: { preset: string; packageManager: PackageManager }
  ): void {
    const pm = getPackageManagerCommand({
      packageManager: options.packageManager,
    });
    const workspaceName = path.basename(workspaceDir);

    const command = `${pm.createWorkspace} ${workspaceName} --preset=${options.preset} --nxCloud=skip --no-interactive --package-manager=${options.packageManager}`;

    execSync(command, {
      cwd: path.dirname(workspaceDir),
      stdio: isVerbose() ? 'inherit' : 'pipe',
      env: { CI: 'true', ...process.env },
      encoding: 'utf-8',
    });
  }

  private runCreatePlugin(
    workspaceDir: string,
    options: {
      packageManager: PackageManager;
      extraArgs?: string;
      useDetectedPm?: boolean;
    }
  ): void {
    const pm = getPackageManagerCommand({
      packageManager: options.packageManager,
    });
    const pluginName = path.basename(workspaceDir);

    let command = `${
      pm.runUninstalledPackage
    } create-nx-plugin@${getPublishedVersion()} ${pluginName} --nxCloud=skip --no-interactive`;

    if (options.packageManager && !options.useDetectedPm) {
      command += ` --package-manager=${options.packageManager}`;
    }

    if (options.extraArgs) {
      command += ` ${options.extraArgs}`;
    }

    execSync(command, {
      cwd: path.dirname(workspaceDir),
      stdio: isVerbose() ? 'inherit' : 'pipe',
      env: process.env,
      encoding: 'utf-8',
    });
  }

  private installPackages(
    workspaceDir: string,
    packages: string[],
    packageManager: PackageManager
  ): void {
    const pm = getPackageManagerCommand({ packageManager });
    const packagesStr = packages.join(' ');

    execSync(`${pm.addDev} ${packagesStr}`, {
      cwd: workspaceDir,
      stdio: isVerbose() ? 'inherit' : 'pipe',
      env: { CI: 'true', ...process.env },
      encoding: 'utf-8',
    });
  }

  private shouldCleanupBackup(context: BackupContext): boolean {
    // Always cleanup temporary backups
    if (context.isTemporary) return true;

    // In local development, cleanup shared backups for clean slate
    if (!isCI) return true;

    // In CI, leave shared backups for other processes
    return false;
  }

  private isTemporaryBackup(backupKey: string): boolean {
    // Backups with process ID are temporary (CI only)
    return backupKey.includes(`-${this.processId}-`);
  }

  private async directoryExistsAsync(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // Helper functions that work with absolute paths
  private createFileAbsolute(filePath: string, content: string = ''): void {
    writeFileSync(filePath, content);
  }

  private updateFileAbsolute(filePath: string, content: string): void {
    writeFileSync(filePath, content);
  }

  private updateJsonAbsolute<T extends object = any, U extends object = T>(
    filePath: string,
    updater: (value: T) => U
  ): void {
    const json = JSON.parse(readFileSync(filePath, 'utf-8'));
    const updated = updater(json);
    writeFileSync(filePath, JSON.stringify(updated, null, 2));
  }
}

// Singleton instance
export const backupManager = BackupManager.getInstance();

// Cleanup on process exit
process.on('exit', () => {
  backupManager.cleanupAllProcessBackups();
});

process.on('SIGINT', () => {
  backupManager.cleanupAllProcessBackups();
  process.exit(0);
});

process.on('SIGTERM', () => {
  backupManager.cleanupAllProcessBackups();
  process.exit(0);
});
