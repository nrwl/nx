import * as pc from 'picocolors';
import { spawn } from 'child_process';
import { dirname, join, relative } from 'path';
import { lt } from 'semver';
import { handleImport } from '../../utils/handle-import';
import { MigrationsJson } from '../../config/misc-interfaces';
import {
  FileChange,
  flushChanges,
  FsTree,
  printChanges,
} from '../../generators/tree';
import { readJsonFile } from '../../utils/fileutils';
import { logger } from '../../utils/logger';
import {
  ArrayPackageGroup,
  NxMigrationsConfiguration,
  PackageJson,
  readModulePackageJson,
  readNxMigrateConfig,
} from '../../utils/package-json';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../utils/package-manager';
import { output } from '../../utils/output';
import { existsSync } from 'fs';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { needsShellQuoting } from '../../utils/shell-quoting';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { normalizeVersion } from './version-utils';

// Migration execution engine shared by the CLI migrate loop, the Console
// API, and the single-migration child process.

interface PackageMigrationConfig extends NxMigrationsConfiguration {
  packageJson: PackageJson;
  packageGroup: ArrayPackageGroup;
}

export function readPackageMigrationConfig(
  packageName: string,
  dir: string
): PackageMigrationConfig {
  const { path: packageJsonPath, packageJson: json } = readModulePackageJson(
    packageName,
    getNxRequirePaths(dir)
  );

  const config = readNxMigrateConfig(json);

  if (!config) {
    return { packageJson: json, migrations: null, packageGroup: [] };
  }

  try {
    const migrationFile = require.resolve(config.migrations, {
      paths: [dirname(packageJsonPath)],
    });

    return {
      packageJson: json,
      migrations: migrationFile,
      packageGroup: config.packageGroup,
      supportsOptionalMigrations: config.supportsOptionalMigrations,
    };
  } catch {
    return {
      packageJson: json,
      migrations: null,
      packageGroup: config.packageGroup,
      supportsOptionalMigrations: config.supportsOptionalMigrations,
    };
  }
}

export function runInstall(
  nxWorkspaceRoot?: string,
  phase: MigrationInstallPhase = 'pre-migration',
  rerunCommand?: string
): Promise<void> {
  const cwd = nxWorkspaceRoot ?? process.cwd();
  const packageManager = detectPackageManager(cwd);
  const pmCommands = getPackageManagerCommand(packageManager, cwd);

  const installCommand = `${pmCommands.install} ${
    pmCommands.ignoreScriptsFlag ?? ''
  }`;
  output.log({
    title: `Running '${installCommand}' to make sure necessary packages are installed`,
  });

  return new Promise<void>((resolve, reject) => {
    // For npm, pipe stderr so we can detect peer dependency errors while still
    // mirroring it live to the user's terminal. Other package managers inherit
    // stderr directly since we don't need to inspect their output.
    const shouldCaptureStderr = packageManager === 'npm';
    const child = spawn(installCommand, {
      shell: true,
      stdio: ['inherit', 'inherit', shouldCaptureStderr ? 'pipe' : 'inherit'],
      windowsHide: true,
      cwd,
    });

    const stderrChunks: Buffer[] = [];
    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
      stderrChunks.push(chunk);
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      if (shouldCaptureStderr) {
        const stderr = Buffer.concat(stderrChunks).toString().trim();
        if (isNpmPeerDepsError(stderr)) {
          // Log the remediation guidance here so every caller of `runInstall`
          // (CLI migrate, `nx repair`, single-migration runner, etc.) surfaces
          // it consistently. Top-level callers catch `NpmPeerDepsInstallError`
          // and return a non-zero exit code without re-logging.
          logNpmPeerDepsError(phase, rerunCommand);
          reject(new NpmPeerDepsInstallError());
          return;
        }
      }

      reject(new Error(`Command failed: ${installCommand}`));
    });
  });
}

export type MigrationInstallPhase = 'pre-migration' | 'post-migration';

export class NpmPeerDepsInstallError extends Error {
  constructor() {
    super('npm install failed due to peer dependency conflicts.');
    this.name = 'NpmPeerDepsInstallError';
  }
}

/**
 * Detects npm peer-dependency resolution failures. Keyed on the `ERESOLVE`
 * error code, which npm consistently emits for this class of failure across
 * v7+ (`npm ERR! code ERESOLVE` / `npm error code ERESOLVE`). Falls back to a
 * small set of stable phrases in case the code line is missing from the
 * captured output.
 */
export function isNpmPeerDepsError(stderr: string): boolean {
  if (/\bERESOLVE\b/.test(stderr)) {
    return true;
  }
  const lowerStderr = stderr.toLowerCase();
  return (
    lowerStderr.includes('unable to resolve dependency tree') ||
    lowerStderr.includes('could not resolve dependency') ||
    lowerStderr.includes('conflicting peer dependency')
  );
}

// The single-migration rerun command lands in copyable guidance (see
// `logNpmPeerDepsError` below), so quote ids a shell would split or expand.
// Single quotes are literal in POSIX shells and PowerShell alike, whereas
// double quotes leave $-expansion active in both. A literal single quote uses
// the POSIX '\'' sequence; that is the one character whose escape PowerShell
// disagrees on (it wants ''). cmd.exe is knowingly not covered: it does not
// group on single quotes, and no quoting suppresses its %VAR% expansion.
export function formatSingleMigrationRerunCommand(migrationId: string): string {
  const id = needsShellQuoting(migrationId)
    ? `'${migrationId.replace(/'/g, String.raw`'\''`)}'`
    : migrationId;
  return `nx migrate --run-migration=${id}`;
}

export function logNpmPeerDepsError(
  phase: MigrationInstallPhase,
  rerunCommand = 'nx migrate --run-migrations'
): void {
  const peerDepsResolutionSteps = [
    'Recommended approaches (in order of preference):',
    '',
    '1. Use "overrides" in package.json to force compatible versions across the dependency tree.',
    '   See https://docs.npmjs.com/cli/configuring-npm/package-json#overrides',
    '2. Persist legacy peer deps resolution in the project ".npmrc":',
    '   npm config set legacy-peer-deps=true --location=project',
    '   (bypasses peer dependency resolution; use with caution)',
    '3. As a last resort, force the installation by running "npm install --force".',
    '   (does not persist and may produce broken installs)',
  ];
  const manualInstallHint = [
    'If you installed the dependencies manually, pass "--skip-install" to avoid re-installing them:',
    `   ${rerunCommand} --skip-install`,
  ];

  if (phase === 'pre-migration') {
    output.error({
      title:
        'You need to resolve the peer dependency conflicts before the migration can continue',
      bodyLines: [
        ...peerDepsResolutionSteps,
        '',
        'Once the conflicts are resolved, re-run the migration command:',
        `   ${rerunCommand}`,
        '',
        ...manualInstallHint,
      ],
    });
  } else {
    output.error({
      title:
        'Some migrations have been applied, but installing the updated dependencies failed',
      bodyLines: [
        ...peerDepsResolutionSteps,
        '',
        'Once the conflicts are resolved, run "npm install" to install the updated dependencies.',
        'If the migration run was interrupted before completing, re-run it:',
        `   ${rerunCommand}`,
        '',
        ...manualInstallHint,
      ],
    });
  }
}

export function logSkippedPostMigrationInstall(root: string): void {
  const packageManager = detectPackageManager(root);
  const installCommand = getPackageManagerCommand(packageManager, root).install;
  output.warn({
    title: 'Migrations updated your dependencies, but the install was skipped',
    bodyLines: [`Run "${installCommand}" to install the updated dependencies.`],
  });
}

export class ChangedDepInstaller {
  private initialDeps: string;
  private _skippedInstall = false;

  constructor(
    private readonly root: string,
    private readonly shouldSkipInstall = false,
    private readonly rerunCommand?: string
  ) {
    this.initialDeps = getStringifiedPackageJsonDeps(root);
  }

  public get skippedInstall(): boolean {
    return this._skippedInstall;
  }

  public async installDepsIfChanged(): Promise<void> {
    const currentDeps = getStringifiedPackageJsonDeps(this.root);
    if (this.initialDeps !== currentDeps) {
      if (this.shouldSkipInstall) {
        this._skippedInstall = true;
      } else {
        await runInstall(this.root, 'post-migration', this.rerunCommand);
      }
    }
    this.initialDeps = currentDeps;
  }
}

export async function runNxOrAngularMigration(
  root: string,
  migration: {
    package: string;
    name: string;
    description?: string;
    version: string;
  },
  isVerbose: boolean,
  captureGeneratorOutput = false,
  resolvedCollection?: { collection: MigrationsJson; collectionPath: string }
): Promise<{
  changes: FileChange[];
  nextSteps: string[];
  agentContext: string[];
  logs: string;
  madeChanges: boolean;
}> {
  const { collection, collectionPath } =
    resolvedCollection ?? readMigrationCollection(migration.package, root);
  let changes: FileChange[] = [];
  let nextSteps: string[] = [];
  let agentContext: string[] = [];
  let logs = '';
  // Angular's `ngResult.changes` is synthesized from the schematic's
  // DryRunEvent stream so Nx and Angular paths can share commit/validation
  // gating via `changes.length > 0`.
  let madeChanges = false;
  logger.info(pc.dim('→ Running generator…'));
  if (!isAngularMigration(collection, migration.name)) {
    ({ nextSteps, changes, agentContext, logs } = await runNxMigration(
      root,
      collectionPath,
      collection,
      migration.name,
      migration.version,
      captureGeneratorOutput
    ));
    madeChanges = changes.length > 0;

    logger.info(`Ran ${migration.name} from ${migration.package}`);
    if (migration.description) {
      logger.info(`  ${migration.description}`);
    }
    logger.info('');
    if (!madeChanges) {
      logger.info(`No changes were made\n`);
      return { changes, nextSteps, agentContext, logs, madeChanges };
    }

    logger.info('Changes:');
    printChanges(changes, '  ');
    logger.info('');
  } else {
    const ngCliAdapter = await getNgCompatLayer();
    const migrationProjectGraph = await createProjectGraphAsync();
    const ngResult = await ngCliAdapter.runMigration(
      root,
      migration.package,
      migration.name,
      readProjectsConfigurationFromProjectGraph(migrationProjectGraph).projects,
      isVerbose,
      migrationProjectGraph
    );
    changes = ngResult.changes;
    madeChanges = ngResult.madeChanges;
    logs = ngResult.loggingQueue.join('\n');

    logger.info(`Ran ${migration.name} from ${migration.package}`);
    if (migration.description) {
      logger.info(`  ${migration.description}`);
    }
    logger.info('');
    if (!madeChanges) {
      logger.info(`No changes were made\n`);
      return { changes, nextSteps, agentContext, logs, madeChanges };
    }

    logger.info('Changes:');
    ngResult.loggingQueue.forEach((log) => logger.info('  ' + log));
    logger.info('');
  }

  return { changes, nextSteps, agentContext, logs, madeChanges };
}

export function getStringifiedPackageJsonDeps(root: string): string {
  try {
    const { dependencies, devDependencies } = readJsonFile<PackageJson>(
      join(root, 'package.json')
    );

    return JSON.stringify([dependencies, devDependencies]);
  } catch {
    // We don't really care if the .nx/installation property changes,
    // whenever nxw is invoked it will handle the dep updates.
    return '';
  }
}

export async function runNxMigration(
  root: string,
  collectionPath: string,
  collection: MigrationsJson,
  name: string,
  migrationVersion: string | undefined,
  captureGeneratorOutput: boolean
) {
  const { path: implPath, fnSymbol } = getImplementationPath(
    collection,
    collectionPath,
    name,
    migrationVersion
  );
  const fn = require(implPath)[fnSymbol];
  const host = new FsTree(
    root,
    process.env.NX_VERBOSE_LOGGING === 'true',
    `migration ${collection.name}:${name}`
  );
  let result: unknown;
  let logs = '';
  if (captureGeneratorOutput) {
    const { withGeneratorOutputCapture } =
      require('./agentic/capture-generator-output') as typeof import('./agentic/capture-generator-output');
    ({ result, logs } = await withGeneratorOutputCapture(() => fn(host, {})));
  } else {
    result = await fn(host, {});
  }
  const { nextSteps, agentContext } = parseMigrationReturn(result);
  host.lock();
  const changes = host.listChanges();
  flushChanges(root, changes);
  return { changes, nextSteps, agentContext, logs };
}

export function parseMigrationReturn(value: unknown): {
  nextSteps: string[];
  agentContext: string[];
} {
  if (Array.isArray(value)) {
    return { nextSteps: filterStrings(value), agentContext: [] };
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return {
      nextSteps: filterStrings(obj.nextSteps),
      agentContext: filterStrings(obj.agentContext),
    };
  }
  // Catches `void`, mistakenly-returned generator callbacks, malformed values.
  return { nextSteps: [], agentContext: [] };
}

// Bucket-level tolerance: a single non-string entry shouldn't discard the
// whole `nextSteps` / `agentContext` array. Migration authors occasionally
// push `null` / `undefined` / a number into the array; we drop the bad entries
// and keep the rest so end-of-run guidance isn't silently lost.
export function filterStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export function readMigrationCollection(packageName: string, root: string) {
  const collectionPath = readPackageMigrationConfig(
    packageName,
    root
  ).migrations;
  const collection = readJsonFile<MigrationsJson>(collectionPath);
  collection.name ??= packageName;
  return {
    collection,
    collectionPath,
  };
}

// Resolves a `documentation` path (relative to the package's migrations dir) to
// a workspace-relative path, or the absolute path when it resolves outside the
// workspace (unusual hoisted/symlinked layouts). The agent runs with cwd =
// workspace root, so the workspace-relative form is preferred. Returns
// undefined when the file can't be resolved.
export function resolveDocumentationFileToWorkspacePath(
  root: string,
  migrationsDir: string,
  documentation: string
): string | undefined {
  let documentationFile: string;
  try {
    documentationFile = require.resolve(documentation, {
      paths: [migrationsDir],
    });
  } catch {
    return undefined;
  }
  const relativePath = relative(root, documentationFile);
  return relativePath.startsWith('..') ? documentationFile : relativePath;
}

export function getImplementationPath(
  collection: MigrationsJson,
  collectionPath: string,
  name: string,
  migrationVersion?: string
): { path: string; fnSymbol: string } {
  const g = collection.generators?.[name] || collection.schematics?.[name];
  if (!g) {
    throw new MigrationImplementationMissingError(
      `Unable to determine implementation path for "${collectionPath}:${name}"`,
      collectionPath,
      migrationVersion
    );
  }
  const implRelativePathAndMaybeSymbol = g.implementation || g.factory;
  const [implRelativePath, fnSymbol = 'default'] =
    implRelativePathAndMaybeSymbol.split('#');

  let implPath: string;

  try {
    implPath = require.resolve(implRelativePath, {
      paths: [dirname(collectionPath)],
    });
  } catch (e) {
    try {
      // workaround for a bug in node 12
      implPath = require.resolve(
        `${dirname(collectionPath)}/${implRelativePath}`
      );
    } catch {
      throw new MigrationImplementationMissingError(
        `Could not resolve implementation for migration "${name}" from "${collectionPath}"`,
        collectionPath,
        migrationVersion ?? g.version
      );
    }
  }

  return { path: implPath, fnSymbol };
}

export class MigrationImplementationMissingError extends Error {
  constructor(
    baseMessage: string,
    collectionPath: string,
    migrationVersion: string | undefined
  ) {
    super(
      buildMigrationMissingMessage(
        baseMessage,
        collectionPath,
        migrationVersion
      )
    );
    this.name = 'MigrationImplementationMissingError';
  }
}

function buildMigrationMissingMessage(
  baseMessage: string,
  collectionPath: string,
  migrationVersion: string | undefined
): string {
  if (!migrationVersion) {
    return baseMessage;
  }

  try {
    const packageJsonPath = join(dirname(collectionPath), 'package.json');
    if (!existsSync(packageJsonPath)) {
      return baseMessage;
    }
    const packageJson = readJsonFile<PackageJson>(packageJsonPath);
    const installedVersion = packageJson.version;

    if (
      installedVersion &&
      lt(normalizeVersion(installedVersion), normalizeVersion(migrationVersion))
    ) {
      const packageManager = detectPackageManager();
      const pmc = getPackageManagerCommand(packageManager);
      const overrideFieldName = getOverrideFieldName(packageManager);

      return (
        `${baseMessage}\n\n` +
        `The installed version of "${packageJson.name}" is ${installedVersion}, ` +
        `but this migration requires version ${migrationVersion}. ` +
        `This likely means the package version is being held back by an ${overrideFieldName} ` +
        `in your package.json. ` +
        `Remove the ${overrideFieldName} and run "${pmc.install}" to install the correct version.`
      );
    }
  } catch {
    // Fall through to return the base message if we can't read package info
  }

  return baseMessage;
}

function getOverrideFieldName(
  packageManager: ReturnType<typeof detectPackageManager>
): string {
  switch (packageManager) {
    case 'pnpm':
      return '"pnpm.overrides"';
    case 'yarn':
      return '"resolutions"';
    case 'npm':
    case 'bun':
      return '"overrides"';
  }
}

export function isAngularMigration(collection: MigrationsJson, name: string) {
  return !collection.generators?.[name] && collection.schematics?.[name];
}

export const getNgCompatLayer = (() => {
  let _ngCliAdapter: typeof import('../../adapter/ngcli-adapter');
  return async function getNgCompatLayer() {
    if (!_ngCliAdapter) {
      _ngCliAdapter = await handleImport(
        '../../adapter/ngcli-adapter.js',
        __dirname
      );
      require('../../adapter/compat');
    }
    return _ngCliAdapter;
  };
})();
