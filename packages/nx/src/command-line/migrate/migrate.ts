import * as pc from 'picocolors';
import { exec, execSync, spawn, type StdioOptions } from 'child_process';
import { prompt } from 'enquirer';
import { handleImport } from '../../utils/handle-import';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import { joinPathFragments } from '../../utils/path';
import {
  clean,
  coerce,
  gt,
  gte,
  lt,
  lte,
  major,
  satisfies,
  valid,
} from 'semver';
import { URL } from 'node:url';
import { promisify } from 'util';
import {
  MigrationsJson,
  MigrationsJsonEntry,
  PackageJsonUpdateForPackage as PackageUpdate,
  PackageJsonUpdates,
} from '../../config/misc-interfaces';
import { NxJsonConfiguration } from '../../config/nx-json';
import {
  FileChange,
  flushChanges,
  FsTree,
  printChanges,
} from '../../generators/tree';
import {
  extractFileFromTarball,
  fileExists,
  JsonReadOptions,
  JsonWriteOptions,
  readJsonFile,
  writeJsonFile,
} from '../../utils/fileutils';
import { writeFormattedJsonFile } from '../../utils/write-formatted-json-file';
import { logger } from '../../utils/logger';
import { commitChanges } from '../../utils/git-utils';
import {
  ArrayPackageGroup,
  getDependencyVersionFromPackageJson,
  NxMigrationsConfiguration,
  PackageJson,
  readModulePackageJson,
  readNxMigrateConfig,
} from '../../utils/package-json';
import {
  copyPackageManagerConfigurationFiles,
  createTempNpmDirectory,
  detectPackageManager,
  getPackageManagerCommand,
  packageRegistryPack,
  packageRegistryView,
  resolvePackageVersionUsingRegistry,
} from '../../utils/package-manager';
import { handleErrors } from '../../utils/handle-errors';
import {
  connectToNxCloudWithPrompt,
  onlyDefaultRunnerIsUsed,
} from '../nx-cloud/connect/connect-to-nx-cloud';
import { output } from '../../utils/output';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { workspaceRoot } from '../../utils/workspace-root';
import { isCI } from '../../utils/is-ci';
import {
  getNxInstallationPath,
  getNxRequirePaths,
} from '../../utils/installation-directory';
import {
  getInstalledLegacyNrwlWorkspaceVersion,
  getInstalledNxPackageGroup,
  getInstalledNxVersion,
} from '../../utils/installed-nx-version';
import { readNxJson } from '../../config/configuration';
import { runNxSync } from '../../utils/child-process';
import { daemonClient } from '../../daemon/client/client';
import { isNxCloudUsed, isNxCloudDisabled } from '../../utils/nx-cloud-utils';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { formatFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  ensurePackageHasProvenance,
  getNxPackageGroup,
} from '../../utils/provenance';
import { type CatalogManager, getCatalogManager } from '../../utils/catalog';
import {
  maybePromptOrWarnMultiMajorMigration,
  MULTI_MAJOR_MODE_FLAG,
  type MultiMajorMode,
} from './multi-major';
import {
  AI_MIGRATIONS_DIR,
  extractPromptFilesFromTarball,
  promptContentKey,
  readPromptFilesFromInstall,
  validateMigrationEntries,
  writePromptMigrationFiles,
} from './prompt-files';
import { filterDowngradedUpdates } from './update-filters';
import {
  DIST_TAGS,
  type DistTag,
  isLegacyEra,
  isNxEquivalentTarget,
  normalizeVersion,
  normalizeVersionWithTagCheck,
} from './version-utils';

export { normalizeVersion };

export interface ResolvedMigrationConfiguration extends MigrationsJson {
  packageGroup?: ArrayPackageGroup;
  /** Prompt file contents keyed by the `prompt` value as it appears on the migration entry. */
  resolvedPromptFiles?: Record<string, string>;
}

const execAsync = promisify(exec);

type CommandFailure = {
  message?: string;
  stderr?: string | Buffer;
  stdout?: string | Buffer;
};

export function formatCommandFailure(
  command: string,
  error: CommandFailure
): string {
  const normalizeCommandOutput = (
    output: string | Buffer | null | undefined
  ): string | undefined => {
    if (!output) {
      return undefined;
    }

    const normalized =
      typeof output === 'string' ? output.trim() : output.toString().trim();
    return normalized || undefined;
  };

  const details =
    normalizeCommandOutput(error.stderr) ||
    normalizeCommandOutput(error.stdout) ||
    normalizeCommandOutput(error.message)
      ?.replace(`Command failed: ${command}`, '')
      .trim();

  return [`Command failed: ${command}`, ...(details ? [details] : [])].join(
    '\n'
  );
}

function runOrReturnExitCode(run: () => void): number {
  try {
    run();
    return 0;
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'status' in e &&
      typeof e.status === 'number'
    ) {
      return e.status;
    }
    throw e;
  }
}

function cleanSemver(version: string) {
  return clean(version) ?? coerce(version);
}

function normalizeSlashes(packageName: string): string {
  return packageName.replace(/\\/g, '/');
}

export type MigrateMode = 'first-party' | 'third-party' | 'all';

export interface MigratorOptions {
  packageJson?: PackageJson;
  nxInstallation?: NxJsonConfiguration['installation'];
  getInstalledPackageVersion: (
    pkg: string,
    overrides?: Record<string, string>
  ) => string;
  fetch: (
    pkg: string,
    version: string
  ) => Promise<ResolvedMigrationConfiguration>;
  from: { [pkg: string]: string };
  to: { [pkg: string]: string };
  interactive?: boolean;
  excludeAppliedMigrations?: boolean;
  /**
   * Restricts `packageJsonUpdates` filtering based on the value:
   * - 'first-party' keeps only packages in `firstPartyPackages`
   * - 'third-party' keeps only packages NOT in `firstPartyPackages`
   * - 'all' / undefined keeps all packages (no filtering)
   */
  mode?: MigrateMode;
  /** First-party package names used by `mode` for filtering. */
  firstPartyPackages?: ReadonlySet<string>;
}

export class Migrator {
  private readonly packageJson?: MigratorOptions['packageJson'];
  private readonly getInstalledPackageVersion: MigratorOptions['getInstalledPackageVersion'];
  private readonly fetch: MigratorOptions['fetch'];
  private readonly installedPkgVersionOverrides: MigratorOptions['from'];
  private readonly to: MigratorOptions['to'];
  private readonly interactive: MigratorOptions['interactive'];
  private readonly excludeAppliedMigrations: MigratorOptions['excludeAppliedMigrations'];
  private readonly mode: MigratorOptions['mode'];
  private readonly firstPartyPackages: MigratorOptions['firstPartyPackages'];
  private readonly packageUpdates: Record<string, PackageUpdate> = {};
  private readonly collectedVersions: Record<string, string> = {};
  private readonly promptAnswers: Record<string, boolean> = {};
  private readonly nxInstallation: NxJsonConfiguration['installation'] | null;
  private minVersionWithSkippedUpdates: string | undefined;

  constructor(opts: MigratorOptions) {
    if (
      (opts.mode === 'first-party' || opts.mode === 'third-party') &&
      !opts.firstPartyPackages
    ) {
      throw new Error(
        `Error: 'firstPartyPackages' is required when 'mode' is '${opts.mode}'.`
      );
    }
    this.packageJson = opts.packageJson;
    this.nxInstallation = opts.nxInstallation;
    this.getInstalledPackageVersion = opts.getInstalledPackageVersion;
    this.fetch = opts.fetch;
    this.installedPkgVersionOverrides = opts.from;
    this.to = opts.to;
    this.interactive = opts.interactive;
    this.excludeAppliedMigrations = opts.excludeAppliedMigrations;
    this.mode = opts.mode;
    this.firstPartyPackages = opts.firstPartyPackages;
  }

  private async fetchMigrationConfig(
    packageName: string,
    packageVersion: string
  ): Promise<ResolvedMigrationConfiguration> {
    const migrationConfig = await this.fetch(packageName, packageVersion);
    if (!migrationConfig.version) {
      throw new Error(
        `Fetched migration metadata for ${packageName} is invalid: the target version is missing.`
      );
    }
    return migrationConfig;
  }

  async migrate(targetPackage: string, targetVersion: string) {
    await this.buildPackageJsonUpdates(targetPackage, {
      version: targetVersion,
      addToPackageJson: false,
    });
    this.applyModeFilter();

    const { migrations, promptContents } = await this.createMigrateJson();
    return {
      packageUpdates: this.packageUpdates,
      migrations,
      ...(Object.keys(promptContents).length > 0 ? { promptContents } : {}),
      minVersionWithSkippedUpdates: this.minVersionWithSkippedUpdates,
    };
  }

  private async createMigrateJson() {
    const promptContents: Record<string, string> = {};
    const migrations = await Promise.all(
      Object.keys(this.packageUpdates).map(async (packageName) => {
        if (this.packageUpdates[packageName].ignoreMigrations) {
          return [];
        }

        const currentVersion = this.getPkgVersion(packageName);
        if (currentVersion === null) return [];

        const { version } = this.packageUpdates[packageName];
        const { generators: migrationEntries, resolvedPromptFiles } =
          await this.fetchMigrationConfig(packageName, version);

        if (!migrationEntries) return [];

        if (resolvedPromptFiles) {
          for (const [promptPath, content] of Object.entries(
            resolvedPromptFiles
          )) {
            promptContents[promptContentKey(packageName, promptPath)] = content;
          }
        }

        return Object.entries(migrationEntries)
          .filter(
            ([, migration]) =>
              migration.version &&
              this.gt(migration.version, currentVersion) &&
              this.lte(migration.version, version) &&
              this.areMigrationRequirementsMet(packageName, migration)
          )
          .map(([migrationName, migration]) => ({
            ...migration,
            package: packageName,
            name: migrationName,
          }));
      })
    );

    return { migrations: migrations.flat(), promptContents };
  }

  private async buildPackageJsonUpdates(
    targetPackage: string,
    target: PackageUpdate
  ): Promise<void> {
    const packagesToCheck =
      await this.populatePackageJsonUpdatesAndGetPackagesToCheck(
        targetPackage,
        target
      );
    for (const packageToCheck of packagesToCheck) {
      const filteredUpdates: Record<string, PackageUpdate> = {};
      for (const [packageUpdateKey, packageUpdate] of Object.entries(
        packageToCheck.updates
      )) {
        if (
          this.areRequirementsMet(packageUpdate.requires) &&
          !this.areIncompatiblePackagesPresent(
            packageUpdate.incompatibleWith
          ) &&
          (!this.interactive ||
            (await this.runPackageJsonUpdatesConfirmationPrompt(
              packageUpdate,
              packageUpdateKey,
              packageToCheck.package
            )))
        ) {
          Object.entries(packageUpdate.packages).forEach(([name, update]) => {
            this.validatePackageUpdateVersion(
              packageToCheck.package,
              name,
              update
            );
            filteredUpdates[name] = update;
            this.packageUpdates[name] = update;
          });
        }
      }

      await Promise.all(
        Object.entries(filteredUpdates).map(([name, update]) =>
          this.buildPackageJsonUpdates(name, update)
        )
      );
    }
  }

  private async populatePackageJsonUpdatesAndGetPackagesToCheck(
    targetPackage: string,
    target: PackageUpdate
  ): Promise<
    {
      package: string;
      updates: PackageJsonUpdates;
    }[]
  > {
    let targetVersion = target.version;
    if (this.to[targetPackage]) {
      targetVersion = this.to[targetPackage];
    }

    if (!this.getPkgVersion(targetPackage)) {
      this.addPackageUpdate(targetPackage, {
        version: target.version,
        addToPackageJson: target.addToPackageJson || false,
        ...(target.ignoreMigrations && { ignoreMigrations: true }),
      });
      return [];
    }

    let migrationConfig: ResolvedMigrationConfiguration;
    try {
      migrationConfig = await this.fetchMigrationConfig(
        targetPackage,
        targetVersion
      );
    } catch (e) {
      if (e?.message?.includes('No matching version')) {
        throw new Error(
          `${e.message}\nRun migrate with --to="package1@version1,package2@version2"`
        );
      } else {
        throw e;
      }
    }

    targetVersion = migrationConfig.version;
    if (
      this.collectedVersions[targetPackage] &&
      gte(this.collectedVersions[targetPackage], targetVersion)
    ) {
      return [];
    }
    this.collectedVersions[targetPackage] = targetVersion;

    this.addPackageUpdate(targetPackage, {
      version: migrationConfig.version,
      addToPackageJson: target.addToPackageJson || false,
      ...(target.ignoreMigrations && { ignoreMigrations: true }),
    });

    const { packageJsonUpdates, packageGroupOrder } =
      this.getPackageJsonUpdatesFromMigrationConfig(
        targetPackage,
        targetVersion,
        migrationConfig,
        target.ignorePackageGroup
      );

    if (!Object.keys(packageJsonUpdates).length) {
      return [];
    }

    const shouldCheckUpdates = Object.values(packageJsonUpdates).some(
      (packageJsonUpdate) =>
        (this.interactive && packageJsonUpdate['x-prompt']) ||
        Object.keys(packageJsonUpdate.requires ?? {}).length ||
        Object.keys(packageJsonUpdate.incompatibleWith ?? {}).length
    );

    if (shouldCheckUpdates) {
      return [{ package: targetPackage, updates: packageJsonUpdates }];
    }

    const packageUpdatesToApply = Object.values(packageJsonUpdates).reduce(
      (m, c) => ({ ...m, ...c.packages }),
      {} as Record<string, PackageUpdate>
    );
    return (
      await Promise.all(
        Object.entries(packageUpdatesToApply).map(
          ([packageName, packageUpdate]) => {
            this.validatePackageUpdateVersion(
              targetPackage,
              packageName,
              packageUpdate
            );
            return this.populatePackageJsonUpdatesAndGetPackagesToCheck(
              packageName,
              packageUpdate
            );
          }
        )
      )
    )
      .filter((pkgs) => pkgs.length)
      .flat()
      .sort(
        (pkgUpdate1, pkgUpdate2) =>
          packageGroupOrder.indexOf(pkgUpdate1.package) -
          packageGroupOrder.indexOf(pkgUpdate2.package)
      );
  }

  private getPackageJsonUpdatesFromMigrationConfig(
    packageName: string,
    targetVersion: string,
    migrationConfig: ResolvedMigrationConfiguration,
    ignorePackageGroup?: boolean
  ): {
    packageJsonUpdates: PackageJsonUpdates;
    packageGroupOrder: string[];
  } {
    const packageGroupOrder: string[] =
      this.getPackageJsonUpdatesFromPackageGroup(
        packageName,
        targetVersion,
        migrationConfig,
        ignorePackageGroup
      );

    if (
      !migrationConfig.packageJsonUpdates ||
      !this.getPkgVersion(packageName)
    ) {
      return { packageJsonUpdates: {}, packageGroupOrder };
    }

    const packageJsonUpdates = this.filterPackageJsonUpdates(
      migrationConfig.packageJsonUpdates,
      packageName,
      targetVersion
    );

    return { packageJsonUpdates, packageGroupOrder };
  }

  /**
   * Mutates migrationConfig, adding package group updates into packageJsonUpdates section
   *
   * @param packageName Package which is being migrated
   * @param targetVersion Version which is being migrated to
   * @param migrationConfig Configuration which is mutated to contain package json updates
   * @returns Order of package groups
   */
  private getPackageJsonUpdatesFromPackageGroup(
    packageName: string,
    targetVersion: string,
    migrationConfig: ResolvedMigrationConfiguration,
    ignorePackageGroup?: boolean
  ) {
    if (ignorePackageGroup) {
      return [];
    }

    const packageGroup: ArrayPackageGroup =
      packageName === '@nrwl/workspace' && isLegacyEra(targetVersion)
        ? LEGACY_NRWL_PACKAGE_GROUP
        : (migrationConfig.packageGroup ?? []);

    let packageGroupOrder: string[] = [];
    if (packageGroup.length) {
      packageGroupOrder = packageGroup.map(
        (packageConfig) => packageConfig.package
      );

      migrationConfig.packageJsonUpdates ??= {};
      const packages: Record<string, PackageUpdate> = {};
      migrationConfig.packageJsonUpdates[targetVersion + '--PackageGroup'] = {
        version: targetVersion,
        packages,
      };
      for (const packageConfig of packageGroup) {
        packages[packageConfig.package] = {
          version:
            packageConfig.version === '*'
              ? targetVersion
              : packageConfig.version,
          alwaysAddToPackageJson: false,
        };
        if (
          packageConfig.version === '*' &&
          this.installedPkgVersionOverrides[packageName]
        ) {
          this.installedPkgVersionOverrides[packageConfig.package] ??=
            this.installedPkgVersionOverrides[packageName];
        }
      }
    }
    return packageGroupOrder;
  }

  private filterPackageJsonUpdates(
    packageJsonUpdates: PackageJsonUpdates,
    packageName: string,
    targetVersion: string
  ): PackageJsonUpdates {
    const filteredPackageJsonUpdates: PackageJsonUpdates = {};

    for (const [packageJsonUpdateKey, packageJsonUpdate] of Object.entries(
      packageJsonUpdates
    )) {
      if (
        !packageJsonUpdate.packages ||
        this.lt(packageJsonUpdate.version, this.getPkgVersion(packageName)) ||
        this.gt(packageJsonUpdate.version, targetVersion)
      ) {
        continue;
      }

      const dependencies: Record<string, string> = {
        ...this.packageJson?.dependencies,
        ...this.packageJson?.devDependencies,
        ...this.nxInstallation?.plugins,
        ...(this.nxInstallation && { nx: this.nxInstallation.version }),
      };

      const filtered: Record<string, PackageUpdate> = {};
      for (const [packageName, packageUpdate] of Object.entries(
        packageJsonUpdate.packages
      )) {
        if (this.shouldExcludePackage(packageName)) {
          continue;
        }
        if (
          this.shouldApplyPackageUpdate(
            packageUpdate,
            packageName,
            dependencies
          )
        ) {
          filtered[packageName] = {
            version: packageUpdate.version,
            addToPackageJson: packageUpdate.alwaysAddToPackageJson
              ? typeof packageUpdate.alwaysAddToPackageJson === 'string'
                ? packageUpdate.alwaysAddToPackageJson
                : 'dependencies'
              : packageUpdate.addToPackageJson || false,
            ...(packageUpdate.ignorePackageGroup && {
              ignorePackageGroup: true,
            }),
            ...(packageUpdate.ignoreMigrations && {
              ignoreMigrations: true,
            }),
          };
        }
      }
      if (Object.keys(filtered).length) {
        packageJsonUpdate.packages = filtered;
        filteredPackageJsonUpdates[packageJsonUpdateKey] = packageJsonUpdate;
      }
    }

    return filteredPackageJsonUpdates;
  }

  private shouldExcludePackage(packageName: string): boolean {
    if (!this.firstPartyPackages) {
      return false;
    }
    if (this.mode === 'first-party') {
      return !this.firstPartyPackages.has(packageName);
    }
    return false;
  }

  private applyModeFilter(): void {
    if (this.mode !== 'third-party') {
      return;
    }
    // Cascade walks through first-party packages so cross-plugin third-party
    // deps (e.g. typescript managed by @nx/js but used by @nx/angular) get
    // surfaced. Drop the first-party set from the final result here so only
    // third-party updates land in package.json.
    for (const name of Object.keys(this.packageUpdates)) {
      if (this.firstPartyPackages!.has(name)) {
        delete this.packageUpdates[name];
      }
    }
  }

  private shouldApplyPackageUpdate(
    packageUpdate: PackageUpdate,
    packageName: string,
    dependencies: Record<string, string>
  ) {
    return (
      (!packageUpdate.ifPackageInstalled ||
        this.getPkgVersion(packageUpdate.ifPackageInstalled)) &&
      (packageUpdate.alwaysAddToPackageJson ||
        packageUpdate.addToPackageJson ||
        !!dependencies?.[packageName]) &&
      (!this.collectedVersions[packageName] ||
        this.gt(packageUpdate.version, this.collectedVersions[packageName]))
    );
  }

  private validatePackageUpdateVersion(
    sourcePackageName: string,
    packageName: string,
    packageUpdate: PackageUpdate
  ) {
    if (!packageUpdate.version) {
      throw new Error(
        `Fetched migration metadata for ${sourcePackageName} is invalid: the target version for ${packageName} is missing.`
      );
    }
  }

  private addPackageUpdate(name: string, packageUpdate: PackageUpdate): void {
    if (
      !this.packageUpdates[name] ||
      this.gt(packageUpdate.version, this.packageUpdates[name].version)
    ) {
      this.packageUpdates[name] = packageUpdate;
    }
  }

  private areRequirementsMet(
    requirements: PackageJsonUpdates[string]['requires']
  ): boolean {
    if (!requirements || !Object.keys(requirements).length) {
      return true;
    }

    return Object.entries(requirements).every(([pkgName, versionRange]) => {
      if (this.packageUpdates[pkgName]) {
        return satisfies(
          cleanSemver(this.packageUpdates[pkgName].version),
          versionRange,
          { includePrerelease: true }
        );
      }

      return (
        this.getPkgVersion(pkgName) &&
        satisfies(this.getPkgVersion(pkgName), versionRange, {
          includePrerelease: true,
        })
      );
    });
  }

  private areIncompatiblePackagesPresent(
    incompatibleWith: PackageJsonUpdates[string]['incompatibleWith']
  ): boolean {
    if (!incompatibleWith || !Object.keys(incompatibleWith).length) {
      return false;
    }

    return Object.entries(incompatibleWith).some(([pkgName, versionRange]) => {
      if (this.packageUpdates[pkgName]) {
        return satisfies(
          cleanSemver(this.packageUpdates[pkgName].version),
          versionRange,
          { includePrerelease: true }
        );
      }

      return (
        this.getPkgVersion(pkgName) &&
        satisfies(this.getPkgVersion(pkgName), versionRange, {
          includePrerelease: true,
        })
      );
    });
  }

  private areMigrationRequirementsMet(
    packageName: string,
    migration: MigrationsJsonEntry
  ): boolean {
    if (!this.excludeAppliedMigrations) {
      return this.areRequirementsMet(migration.requires);
    }

    return (
      (this.wasMigrationSkipped(migration.requires) ||
        this.isMigrationForHigherVersionThanWhatIsInstalled(
          packageName,
          migration
        )) &&
      this.areRequirementsMet(migration.requires)
    );
  }

  private isMigrationForHigherVersionThanWhatIsInstalled(
    packageName: string,
    migration: MigrationsJsonEntry
  ): boolean {
    const installedVersion = this.getInstalledPackageVersion(packageName);

    return (
      migration.version &&
      (!installedVersion || this.gt(migration.version, installedVersion)) &&
      this.lte(migration.version, this.packageUpdates[packageName].version)
    );
  }

  private wasMigrationSkipped(
    requirements: PackageJsonUpdates[string]['requires']
  ): boolean {
    // no requiremets, so it ran before
    if (!requirements || !Object.keys(requirements).length) {
      return false;
    }

    // at least a requirement was not met, it was skipped
    return Object.entries(requirements).some(
      ([pkgName, versionRange]) =>
        !this.getInstalledPackageVersion(pkgName) ||
        !satisfies(this.getInstalledPackageVersion(pkgName), versionRange, {
          includePrerelease: true,
        })
    );
  }

  private async runPackageJsonUpdatesConfirmationPrompt(
    packageUpdate: PackageJsonUpdates[string],
    packageUpdateKey: string,
    packageName: string
  ): Promise<boolean> {
    if (!packageUpdate['x-prompt']) {
      return Promise.resolve(true);
    }
    const promptKey = this.getPackageUpdatePromptKey(packageUpdate);
    if (this.promptAnswers[promptKey] !== undefined) {
      // a same prompt was already answered, skip
      return Promise.resolve(false);
    }

    const promptConfig = {
      name: 'shouldApply',
      type: 'confirm',
      message: packageUpdate['x-prompt'],
      initial: true,
    };

    if (packageName.startsWith('@nx/')) {
      // @ts-expect-error -- enquirer types aren't correct, footer does exist
      promptConfig.footer = () =>
        pc.dim(
          `  View migration details at https://nx.dev/nx-api/${packageName.replace(
            '@nx/',
            ''
          )}#${packageUpdateKey.replace(/[-\.]/g, '')}packageupdates`
        );
    }

    return await prompt([promptConfig]).then(
      ({ shouldApply }: { shouldApply: boolean }) => {
        this.promptAnswers[promptKey] = shouldApply;

        if (
          !shouldApply &&
          (!this.minVersionWithSkippedUpdates ||
            lt(packageUpdate.version, this.minVersionWithSkippedUpdates))
        ) {
          this.minVersionWithSkippedUpdates = packageUpdate.version;
        }

        return shouldApply;
      }
    );
  }

  private getPackageUpdatePromptKey(
    packageUpdate: PackageJsonUpdates[string]
  ): string {
    return Object.entries(packageUpdate.packages)
      .map(([name, update]) => `${name}:${JSON.stringify(update)}`)
      .join('|');
  }

  private getPkgVersion(pkg: string): string {
    return this.getInstalledPackageVersion(
      pkg,
      this.installedPkgVersionOverrides
    );
  }

  private gt(v1: string, v2: string) {
    return gt(normalizeVersion(v1), normalizeVersion(v2));
  }

  private lt(v1: string, v2: string) {
    return lt(normalizeVersion(v1), normalizeVersion(v2));
  }

  private lte(v1: string, v2: string) {
    return lte(normalizeVersion(v1), normalizeVersion(v2));
  }
}

const LEGACY_NRWL_PACKAGE_GROUP: ArrayPackageGroup = [
  { package: '@nrwl/workspace', version: '*' },
  { package: '@nrwl/angular', version: '*' },
  { package: '@nrwl/cypress', version: '*' },
  { package: '@nrwl/devkit', version: '*' },
  { package: '@nrwl/eslint-plugin-nx', version: '*' },
  { package: '@nrwl/express', version: '*' },
  { package: '@nrwl/jest', version: '*' },
  { package: '@nrwl/linter', version: '*' },
  { package: '@nrwl/nest', version: '*' },
  { package: '@nrwl/next', version: '*' },
  { package: '@nrwl/node', version: '*' },
  { package: '@nrwl/nx-plugin', version: '*' },
  { package: '@nrwl/react', version: '*' },
  { package: '@nrwl/storybook', version: '*' },
  { package: '@nrwl/web', version: '*' },
  { package: '@nrwl/js', version: '*' },
  { package: 'nx-cloud', version: 'latest' },
  { package: '@nrwl/react-native', version: '*' },
  { package: '@nrwl/detox', version: '*' },
  { package: '@nrwl/expo', version: '*' },
  { package: '@nrwl/tao', version: '*' },
];

function resolveFirstPartyPackages(
  targetPackage: string,
  packageGroup: ArrayPackageGroup | undefined
): ReadonlySet<string> {
  const set = new Set<string>([targetPackage]);
  for (const { package: name } of packageGroup ?? []) {
    set.add(name);
  }
  return set;
}

/**
 * The canonical Nx package for a given target version: `@nrwl/workspace` for
 * legacy (`< 14.0.0-beta.0`), `nx` otherwise. Non-semver inputs (e.g. the
 * literal `'latest'` sentinel before tag resolution) resolve to modern era.
 * Used by `--mode=third-party` to silently swap `@nx/workspace` → `nx` when
 * walking the cascade.
 */
export function resolveCanonicalNxPackage(
  targetVersion: string
): 'nx' | '@nrwl/workspace' {
  return isLegacyEra(targetVersion) ? '@nrwl/workspace' : 'nx';
}

export async function resolveMode(
  mode: MigrateMode | undefined,
  targetPackage: string,
  targetVersion: string,
  context: { hasFrom: boolean; hasExcludeAppliedMigrations: boolean } = {
    hasFrom: false,
    hasExcludeAppliedMigrations: false,
  }
): Promise<MigrateMode> {
  if (mode) {
    return mode;
  }
  if (!isNxEquivalentTarget(targetPackage, targetVersion)) {
    return 'all';
  }
  if (!process.stdin.isTTY || isCI()) {
    return 'all';
  }
  const choices: { name: string; message: string }[] = [
    {
      name: 'first-party',
      message: 'First-party only (Nx and its official packages)',
    },
  ];
  if (!context.hasFrom && !context.hasExcludeAppliedMigrations) {
    choices.push({
      name: 'third-party',
      message: 'Third-party only (deps managed by Nx)',
    });
  }
  choices.push({
    name: 'all',
    message: 'All (first-party and third-party)',
  });
  const { mode: selected } = await prompt<{
    mode: MigrateMode;
  }>({
    type: 'select',
    name: 'mode',
    message: 'Which packages would you like to migrate?',
    choices,
  });
  return selected;
}

async function versionOverrides(overrides: string, param: string) {
  const res: Record<string, string> = {};
  const promises = overrides.split(',').map((p) => {
    const split = p.lastIndexOf('@');
    if (split === -1 || split === 0) {
      throw new Error(
        `Incorrect '${param}' section. Use --${param}="package@version"`
      );
    }
    const selectedPackage = p.substring(0, split).trim();
    const selectedVersion = p.substring(split + 1).trim();
    if (!selectedPackage || !selectedVersion) {
      throw new Error(
        `Incorrect '${param}' section. Use --${param}="package@version"`
      );
    }
    return normalizeVersionWithTagCheck(selectedPackage, selectedVersion).then(
      (version) => {
        res[normalizeSlashes(selectedPackage)] = version;
      }
    );
  });
  await Promise.all(promises);
  return res;
}

async function parseTargetPackageAndVersion(args: string): Promise<{
  targetPackage: string;
  targetVersion: string;
}> {
  if (!args) {
    throw new Error(
      `Provide the correct package name and version. E.g., my-package@9.0.0.`
    );
  }

  if (args.indexOf('@') > -1) {
    const i = args.lastIndexOf('@');
    if (i === 0) {
      return { targetPackage: args.trim(), targetVersion: 'latest' };
    }
    const targetPackage = args.substring(0, i);
    const maybeVersion = args.substring(i + 1);
    if (!targetPackage || !maybeVersion) {
      throw new Error(
        `Provide the correct package name and version. E.g., my-package@9.0.0.`
      );
    }
    const targetVersion = await normalizeVersionWithTagCheck(
      targetPackage,
      maybeVersion
    );
    return { targetPackage, targetVersion };
  }

  if (
    DIST_TAGS.includes(args as DistTag) ||
    valid(args) ||
    args.match(/^\d+(?:\.\d+)?(?:\.\d+)?$/)
  ) {
    // Passing `nx` here may seem wrong, but nx and @nrwl/workspace are synced in version.
    // We could duplicate the ternary below, but its not necessary since they are equivalent
    // on the registry
    const targetVersion = await normalizeVersionWithTagCheck('nx', args);
    const isDistTag = DIST_TAGS.includes(args as DistTag);
    const targetPackage = isDistTag
      ? 'nx'
      : resolveCanonicalNxPackage(targetVersion);
    return { targetPackage, targetVersion };
  }

  return { targetPackage: args, targetVersion: 'latest' };
}

type GenerateMigrations = {
  type: 'generateMigrations';
  targetPackage: string;
  targetVersion: string;
  from: { [k: string]: string };
  to: { [k: string]: string };
  interactive?: boolean;
  excludeAppliedMigrations?: boolean;
  mode: MigrateMode;
  /**
   * Set when multi-major redirected `targetVersion` to an incremental step
   * (gradual mode or the interactive prompt picking a smaller jump). Holds
   * the concrete resolved target so Next Steps can suggest re-running toward
   * it.
   */
  originalTargetVersion?: string;
  /**
   * The `--multi-major-mode` value to propagate to a continuation command,
   * or undefined to omit it. See `MultiMajorResult.gradual` for when it's set.
   */
  multiMajorMode?: MultiMajorMode;
};

type RunMigrations = {
  type: 'runMigrations';
  runMigrations: string;
  ifExists: boolean;
};

export async function parseMigrationsOptions(options: {
  [k: string]: any;
}): Promise<GenerateMigrations | RunMigrations> {
  if (options.runMigrations === '') {
    options.runMigrations = 'migrations.json';
  }

  if (options.mode && options.runMigrations) {
    throw new Error(
      `Error: '--mode' cannot be combined with '--run-migrations'.`
    );
  }
  if (options.multiMajorMode && options.runMigrations) {
    throw new Error(
      `Error: '--multi-major-mode' cannot be combined with '--run-migrations'.`
    );
  }

  if (options.runMigrations) {
    return {
      type: 'runMigrations',
      runMigrations: options.runMigrations as string,
      ifExists: options.ifExists as boolean,
    };
  }

  assertThirdPartyModeFlagCompatibility(options);

  const [from, to] = await Promise.all([
    options.from
      ? versionOverrides(options.from as string, 'from')
      : Promise.resolve({} as Record<string, string>),
    options.to
      ? await versionOverrides(options.to as string, 'to')
      : Promise.resolve({} as Record<string, string>),
  ]);

  const positional = options['packageAndVersion'] as string | undefined;
  const resolved = await resolveTargetAndMode({ positional, from, options });
  const { mode, installedNxVersion } = resolved;
  let { targetPackage, targetVersion } = resolved;

  // Spec §10: prompt or warn when crossing more than one major boundary.
  // Each major's metadata may have pruned migrations from much-older versions,
  // so jumping multiple majors at once can silently skip migrations.
  const multiMajorResult = await maybePromptOrWarnMultiMajorMigration({
    mode,
    options,
    targetPackage,
    targetVersion,
  });
  targetVersion = multiMajorResult.chosen;

  if (mode === 'third-party') {
    assertThirdPartyTargetBounds({
      targetPackage,
      targetVersion,
      to,
      installedNxVersion,
    });
  }

  return {
    type: 'generateMigrations',
    targetPackage,
    targetVersion,
    from,
    to,
    interactive: options.interactive,
    excludeAppliedMigrations: options.excludeAppliedMigrations,
    mode,
    originalTargetVersion: multiMajorResult.originalTarget,
    multiMajorMode: multiMajorResult.gradual ? 'gradual' : undefined,
  };
}

function assertThirdPartyModeFlagCompatibility(options: {
  mode?: string;
  from?: string;
  excludeAppliedMigrations?: boolean;
}): void {
  if (options.mode !== 'third-party') return;
  if (options.from) {
    throw new Error(
      `Error: '--mode=third-party' cannot be combined with '--from'.`
    );
  }
  if (options.excludeAppliedMigrations === true) {
    throw new Error(
      `Error: '--mode=third-party' cannot be combined with '--exclude-applied-migrations'.`
    );
  }
}

// Parses the positional, resolves `--mode`, defaults the target package and
// version when omitted (mode-aware: third-party anchors to the installed
// canonical, others to `nx@latest`), and enforces the era gate when `--mode`
// is explicit.
async function resolveTargetAndMode(args: {
  positional: string | undefined;
  from: Record<string, string>;
  options: {
    mode?: MigrateMode;
    excludeAppliedMigrations?: boolean;
  };
}): Promise<{
  targetPackage: string;
  targetVersion: string;
  mode: MigrateMode;
  installedNxVersion: string | null | undefined;
}> {
  const { positional, from, options } = args;
  let targetPackage: string | undefined;
  let targetVersion: string | undefined;
  if (positional) {
    const parsed = await parseTargetPackageAndVersion(positional);
    targetPackage = normalizeSlashes(parsed.targetPackage);
    targetVersion = parsed.targetVersion;
  }

  // Resolve mode before defaulting target so the default can depend on the
  // resolved mode (third-party defaults to nx@<installed>; otherwise nx@latest).
  // For bare invocation, `targetPackage='nx'` and `targetVersion='latest'` are
  // safe sentinels: `isNxEquivalentTarget` treats the literal `'latest'` as
  // modern era (semver `lt('latest', '14.0.0-beta.0')` is false).
  const mode = await resolveMode(
    options.mode,
    targetPackage ?? 'nx',
    targetVersion ?? 'latest',
    {
      hasFrom: Object.keys(from).length > 0,
      hasExcludeAppliedMigrations: options.excludeAppliedMigrations === true,
    }
  );

  let installedNxVersion: string | null | undefined;
  // For third-party, anchor `targetPackage`/`targetVersion` to the installed
  // canonical when the positional was either omitted or a bare package name
  // (no semver). This keeps the era gate accepting legacy workspaces, the
  // upper-bound gate meaningful, and downstream semver comparisons safe from
  // the literal `'latest'` that `parseTargetPackageAndVersion` emits for bare
  // package names.
  if (mode === 'third-party' && (!positional || !valid(targetVersion!))) {
    const installed = resolveInstalledCanonical();
    if (!installed) {
      throw new Error(
        `Error: '--mode=third-party' requires 'nx' (or '@nrwl/workspace' on Nx <14) to be installed in your workspace. Install dependencies first, then re-run.`
      );
    }
    installedNxVersion = installed.version;
    targetPackage = installed.canonical;
    targetVersion = installed.version;
  } else if (!positional) {
    // Bare invocation: default to `nx@latest` as a literal sentinel rather
    // than resolving via the registry here. Multi-major resolves the dist-tag
    // when needed (and bails gracefully on registry failure), and the cascade
    // resolves it for the walk (honouring `NX_MIGRATE_SKIP_REGISTRY_FETCH`).
    // This matches the resilience of `nx migrate nx`.
    targetPackage = 'nx';
    targetVersion = 'latest';
  }

  if (options.mode && !isNxEquivalentTarget(targetPackage!, targetVersion!)) {
    const isLegacy = isLegacyEra(targetVersion!);
    const validTargets = isLegacy
      ? `'@nrwl/workspace'`
      : `'nx' or '@nx/workspace'`;
    const eraNote = isLegacy ? ' for Nx <14.0.0' : '';
    throw new Error(
      `Error: '--mode' requires the target to be ${validTargets}${eraNote}. Got '${targetPackage}@${targetVersion}'.`
    );
  }

  return {
    targetPackage: targetPackage!,
    targetVersion: targetVersion!,
    mode,
    installedNxVersion,
  };
}

// `--mode=third-party` upper-bound gate. The third-party walk follows nx's
// `packageGroup` (e.g. `@nx/js`, `@nx/angular`); a target or `--to` above the
// installed version would expand the walk past it and surface third-party
// bumps that only exist in the newer plugin's history. The first-party set
// is sourced from the installed nx package's declared `packageGroup`
// (authoritative for the user's current Nx universe). Legacy era falls back
// to the hardcoded `LEGACY_NRWL_PACKAGE_GROUP`.
function assertThirdPartyTargetBounds(args: {
  targetPackage: string;
  targetVersion: string;
  to: Record<string, string>;
  installedNxVersion: string | null | undefined;
}): void {
  const { targetPackage, targetVersion, to, installedNxVersion } = args;
  const canonical = resolveCanonicalNxPackage(targetVersion);
  const isLegacy = canonical === '@nrwl/workspace';
  // Reuse the resolved installed version from `resolveTargetAndMode` when
  // present (it's already era-aware via `resolveInstalledCanonical`).
  // Otherwise fall back to the era-specific reader.
  const installed =
    installedNxVersion ??
    (isLegacy
      ? getInstalledLegacyNrwlWorkspaceVersion()
      : getInstalledNxVersion());
  if (!installed) {
    throw new Error(
      `Error: '--mode=third-party' requires '${canonical}' to be installed in your workspace. Install dependencies first, then re-run.`
    );
  }
  if (gt(targetVersion, installed)) {
    throw new Error(
      `Error: '--mode=third-party' cannot migrate to a version higher than what is currently installed (got '${targetPackage}@${targetVersion}', installed '${canonical}@${installed}'). Either drop '--mode=third-party' or lower the target.`
    );
  }
  const firstPartySet = isLegacy
    ? new Set<string>([
        '@nrwl/workspace',
        ...LEGACY_NRWL_PACKAGE_GROUP.map((p) => p.package),
      ])
    : getInstalledNxPackageGroup();
  for (const [pkg, version] of Object.entries(to)) {
    if (firstPartySet.has(pkg) && gt(version, installed)) {
      throw new Error(
        `Error: '--mode=third-party' cannot migrate to a version higher than what is currently installed (got '--to ${pkg}@${version}', installed '${canonical}@${installed}'). Either drop '--mode=third-party' or lower the '--to' value.`
      );
    }
  }
}

/**
 * Pick the canonical Nx package + version for `--mode=third-party` when the
 * user didn't supply an explicit version. Returns `'nx'` for modern era,
 * falls back to `'@nrwl/workspace'` (legacy era) when only that is installed
 * or when the installed `nx` itself is `<14`.
 */
function resolveInstalledCanonical(): {
  canonical: 'nx' | '@nrwl/workspace';
  version: string;
} | null {
  const installedNx = getInstalledNxVersion();
  if (installedNx) {
    return {
      canonical: resolveCanonicalNxPackage(installedNx),
      version: installedNx,
    };
  }
  const installedLegacy = getInstalledLegacyNrwlWorkspaceVersion();
  if (installedLegacy) {
    return { canonical: '@nrwl/workspace', version: installedLegacy };
  }
  return null;
}

function createInstalledPackageVersionsResolver(
  root: string
): MigratorOptions['getInstalledPackageVersion'] {
  const cache: Record<string, string> = {};
  const nxRequires = getNxRequirePaths(root).map((path) =>
    createRequire(join(path, 'package.json'))
  );

  function getInstalledPackageVersion(
    packageName: string,
    overrides?: Record<string, string>
  ): string | null {
    if (overrides?.[packageName]) {
      return overrides[packageName];
    }

    if (packageName === 'nx') {
      const nxVersion =
        cache[packageName] ??
        (() => {
          for (const req of nxRequires) {
            try {
              const packageJsonPath = req.resolve('nx/package.json');
              if (packageJsonPath.startsWith(workspaceRoot)) {
                return readJsonFile<PackageJson>(packageJsonPath).version;
              }
            } catch {}
          }

          return getInstalledPackageVersion('@nrwl/workspace', overrides);
        })();

      if (nxVersion) {
        cache[packageName] = nxVersion;
      }

      return nxVersion;
    }

    try {
      if (!cache[packageName]) {
        const { packageJson, path } = readModulePackageJson(
          packageName,
          getNxRequirePaths(root)
        );
        // old workspaces would have the temp installation of nx in the cache,
        // so the resolved package is not the one we need
        if (!path.startsWith(workspaceRoot)) {
          throw new Error('Resolved a package outside the workspace root.');
        }
        cache[packageName] = packageJson.version;
      }

      return cache[packageName];
    } catch {
      return null;
    }
  }

  return getInstalledPackageVersion;
}

// testing-fetch-start
function createFetcher() {
  const migrationsCache: Record<
    string,
    Promise<ResolvedMigrationConfiguration>
  > = {};
  const resolvedVersionCache: Record<string, Promise<string>> = {};

  function fetchMigrations(
    packageName,
    packageVersion,
    setCache: (packageName: string, packageVersion: string) => void
  ): Promise<ResolvedMigrationConfiguration> {
    if (process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH === 'true') {
      // Skip registry fetch and use installation method directly
      logger.info(`Fetching ${packageName}@${packageVersion}`);
      return getPackageMigrationsUsingInstall(packageName, packageVersion);
    }

    const cacheKey = packageName + '-' + packageVersion;
    return Promise.resolve(resolvedVersionCache[cacheKey])
      .then((cachedResolvedVersion) => {
        if (cachedResolvedVersion) {
          return cachedResolvedVersion;
        }

        resolvedVersionCache[cacheKey] = resolvePackageVersionUsingRegistry(
          packageName,
          packageVersion
        );
        return resolvedVersionCache[cacheKey];
      })
      .then((resolvedVersion) => {
        if (
          resolvedVersion !== packageVersion &&
          migrationsCache[`${packageName}-${resolvedVersion}`]
        ) {
          return migrationsCache[`${packageName}-${resolvedVersion}`];
        }
        setCache(packageName, resolvedVersion);
        return getPackageMigrationsUsingRegistry(packageName, resolvedVersion);
      })
      .catch((e) => {
        logger.verbose(
          `Failed to get migrations from registry for ${packageName}@${packageVersion}: ${e.message}. Falling back to install.`
        );
        logger.info(`Fetching ${packageName}@${packageVersion}`);

        return getPackageMigrationsUsingInstall(packageName, packageVersion);
      });
  }

  return function nxMigrateFetcher(
    packageName: string,
    packageVersion: string
  ): Promise<ResolvedMigrationConfiguration> {
    if (migrationsCache[`${packageName}-${packageVersion}`]) {
      return migrationsCache[`${packageName}-${packageVersion}`];
    }

    let resolvedVersion: string = packageVersion;
    let migrations: Promise<ResolvedMigrationConfiguration>;

    function setCache(packageName: string, packageVersion: string) {
      migrationsCache[packageName + '-' + packageVersion] = migrations;
    }

    migrations = fetchMigrations(packageName, packageVersion, setCache).then(
      (result) => {
        if (result.schematics) {
          result.generators = { ...result.schematics, ...result.generators };
          delete result.schematics;
        }
        resolvedVersion = result.version;
        return result;
      }
    );

    setCache(packageName, packageVersion);

    return migrations;
  };
}

// testing-fetch-end

async function getPackageMigrationsUsingRegistry(
  packageName: string,
  packageVersion: string
): Promise<ResolvedMigrationConfiguration> {
  if (getNxPackageGroup().includes(packageName)) {
    await ensurePackageHasProvenance(packageName, packageVersion);
  }
  // check if there are migrations in the packages by looking at the
  // registry directly
  const migrationsConfig = await getPackageMigrationsConfigFromRegistry(
    packageName,
    packageVersion
  );

  if (!migrationsConfig) {
    return {
      name: packageName,
      version: packageVersion,
    };
  }

  if (!migrationsConfig.migrations) {
    return {
      name: packageName,
      version: packageVersion,
      packageGroup: migrationsConfig.packageGroup,
    };
  }

  logger.info(`Fetching ${packageName}@${packageVersion}`);

  // try to obtain the migrations from the registry directly
  return await downloadPackageMigrationsFromRegistry(
    packageName,
    packageVersion,
    migrationsConfig
  );
}

async function getPackageMigrationsConfigFromRegistry(
  packageName: string,
  packageVersion: string
) {
  const result = await packageRegistryView(
    packageName,
    packageVersion,
    'nx-migrations ng-update dist --json'
  );

  if (!result) {
    return null;
  }

  const json = JSON.parse(result);

  if (!json['nx-migrations'] && !json['ng-update']) {
    const registry = new URL('dist' in json ? json.dist.tarball : json.tarball)
      .hostname;

    // Registries other than npmjs and the local registry may not support full metadata via npm view
    // so throw error so that fetcher falls back to getting config via install
    if (
      !['registry.npmjs.org', 'localhost', 'artifactory'].some((v) =>
        registry.includes(v)
      )
    ) {
      throw new Error(
        `Getting migration config from registry is not supported from ${registry}`
      );
    }
  }

  return readNxMigrateConfig(json);
}

async function downloadPackageMigrationsFromRegistry(
  packageName: string,
  packageVersion: string,
  {
    migrations: migrationsFilePath,
    packageGroup,
  }: NxMigrationsConfiguration & { packageGroup?: ArrayPackageGroup }
): Promise<ResolvedMigrationConfiguration> {
  const { dir, cleanup } = createTempNpmDirectory();

  let result: ResolvedMigrationConfiguration;

  try {
    const { tarballPath } = await packageRegistryPack(
      dir,
      packageName,
      packageVersion
    );

    const fullTarballPath = join(dir, tarballPath);

    let migrations: MigrationsJson;
    try {
      migrations = await extractFileFromTarball(
        fullTarballPath,
        joinPathFragments('package', migrationsFilePath),
        join(dir, migrationsFilePath)
      ).then((path) => readJsonFile<MigrationsJson>(path));
    } catch {
      throw new Error(
        `Failed to find migrations file "${migrationsFilePath}" in package "${packageName}@${packageVersion}".`
      );
    }

    validateMigrationEntries(packageName, packageVersion, migrations);

    const resolvedPromptFiles = await extractPromptFilesFromTarball(
      packageName,
      packageVersion,
      migrations,
      migrationsFilePath,
      fullTarballPath,
      dir
    );

    result = {
      ...migrations,
      packageGroup,
      version: packageVersion,
      ...(resolvedPromptFiles ? { resolvedPromptFiles } : {}),
    };
  } finally {
    await cleanup();
  }

  return result;
}

function createConcurrencyLimiter(concurrency: number) {
  const queue: (() => void)[] = [];
  let active = 0;

  function next() {
    while (queue.length > 0 && active < concurrency) {
      active++;
      queue.shift()();
    }
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

const installConcurrencyLimit = process.env.NX_MIGRATE_INSTALL_CONCURRENCY
  ? createConcurrencyLimiter(
      Math.max(
        1,
        Math.floor(Number(process.env.NX_MIGRATE_INSTALL_CONCURRENCY)) || 1
      )
    )
  : null;

async function getPackageMigrationsUsingInstall(
  packageName: string,
  packageVersion: string
): Promise<ResolvedMigrationConfiguration> {
  const run = () =>
    getPackageMigrationsUsingInstallImpl(packageName, packageVersion);
  return installConcurrencyLimit ? installConcurrencyLimit(run) : run();
}

async function getPackageMigrationsUsingInstallImpl(
  packageName: string,
  packageVersion: string
): Promise<ResolvedMigrationConfiguration> {
  const { dir, cleanup } = createTempNpmDirectory();

  let result: ResolvedMigrationConfiguration;

  if (getNxPackageGroup().includes(packageName)) {
    await ensurePackageHasProvenance(packageName, packageVersion);
  }

  try {
    const pmc = getPackageManagerCommand(detectPackageManager(dir), dir);

    await execAsync(`${pmc.add} ${packageName}@${packageVersion}`, {
      cwd: dir,
      env: {
        ...process.env,
        npm_config_legacy_peer_deps: 'true',
      },
    });

    const {
      migrations: migrationsFilePath,
      packageGroup,
      packageJson,
    } = readPackageMigrationConfig(packageName, dir);

    let migrations: MigrationsJson = undefined;
    let resolvedPromptFiles: Record<string, string> | undefined;
    if (migrationsFilePath) {
      migrations = readJsonFile<MigrationsJson>(migrationsFilePath);
      validateMigrationEntries(packageName, packageVersion, migrations);
      resolvedPromptFiles = await readPromptFilesFromInstall(
        packageName,
        packageVersion,
        migrations,
        migrationsFilePath
      );
    }

    result = {
      ...migrations,
      packageGroup,
      version: packageJson.version,
      ...(resolvedPromptFiles ? { resolvedPromptFiles } : {}),
    };
  } catch (e) {
    const pmc = getPackageManagerCommand(detectPackageManager(dir), dir);

    throw new Error(
      [
        `Failed to fetch migrations for ${packageName}@${packageVersion}`,
        formatCommandFailure(
          `${pmc.add} ${packageName}@${packageVersion}`,
          e as CommandFailure
        ),
      ].join('\n')
    );
  } finally {
    await cleanup();
  }

  return result;
}

interface PackageMigrationConfig extends NxMigrationsConfiguration {
  packageJson: PackageJson;
  packageGroup: ArrayPackageGroup;
}

function readPackageMigrationConfig(
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
    };
  } catch {
    return {
      packageJson: json,
      migrations: null,
      packageGroup: config.packageGroup,
    };
  }
}

async function createMigrationsFile(
  root: string,
  migrations: {
    package: string;
    name: string;
  }[]
) {
  await writeFormattedJsonFile(join(root, 'migrations.json'), { migrations });
}

export { filterDowngradedUpdates };

async function updatePackageJson(
  root: string,
  updatedPackages: Record<string, PackageUpdate>
): Promise<boolean> {
  const packageJsonPath = join(root, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const parseOptions: JsonReadOptions = {};
  const json = readJsonFile(packageJsonPath, parseOptions);

  const manager = getCatalogManager(root);
  const catalogUpdates = [];
  let modified = false;

  Object.keys(updatedPackages).forEach((p) => {
    const existingVersion = json.dependencies?.[p] ?? json.devDependencies?.[p];

    if (existingVersion && manager?.isCatalogReference(existingVersion)) {
      const { catalogName } = manager.parseCatalogReference(existingVersion);
      catalogUpdates.push({
        packageName: p,
        version: updatedPackages[p].version,
        catalogName,
      });

      // don't overwrite the catalog reference with the new version
      return;
    }

    // Update non-catalog packages in package.json
    if (json.devDependencies?.[p]) {
      if (json.devDependencies[p] !== updatedPackages[p].version) {
        json.devDependencies[p] = updatedPackages[p].version;
        modified = true;
      }
      return;
    }

    if (json.dependencies?.[p]) {
      if (json.dependencies[p] !== updatedPackages[p].version) {
        json.dependencies[p] = updatedPackages[p].version;
        modified = true;
      }
      return;
    }

    const dependencyType = updatedPackages[p].addToPackageJson;
    if (typeof dependencyType === 'string') {
      json[dependencyType] ??= {};
      if (json[dependencyType][p] !== updatedPackages[p].version) {
        json[dependencyType][p] = updatedPackages[p].version;
        modified = true;
      }
    }
  });

  if (modified) {
    await writeFormattedJsonFile(packageJsonPath, json, {
      appendNewLine: parseOptions.endsWithNewline,
    });
  }

  // Update catalog definitions
  if (catalogUpdates.length) {
    // manager is guaranteed to be defined when there are catalog updates
    manager!.updateCatalogVersions(root, catalogUpdates);
    await formatCatalogDefinitionFiles(manager!, root);
  }

  return modified || catalogUpdates.length > 0;
}

async function formatCatalogDefinitionFiles(
  manager: CatalogManager,
  root: string
) {
  const catalogDefinitionFilePaths = manager.getCatalogDefinitionFilePaths();
  const catalogDefinitionFiles = catalogDefinitionFilePaths.map((filePath) => {
    const absolutePath = join(root, filePath);
    return {
      path: filePath,
      absolutePath,
      content: readFileSync(absolutePath, 'utf-8'),
    };
  });

  const results = await formatFilesWithPrettierIfAvailable(
    catalogDefinitionFiles.map(({ path, content }) => ({ path, content })),
    root,
    { silent: true }
  );

  for (const { path, absolutePath, content } of catalogDefinitionFiles) {
    writeFileSync(
      absolutePath,
      results.has(path) ? results.get(path)! : content,
      { encoding: 'utf-8' }
    );
  }
}

async function updateInstallationDetails(
  root: string,
  updatedPackages: Record<string, PackageUpdate>
): Promise<boolean> {
  const nxJsonPath = join(root, 'nx.json');
  const parseOptions: JsonReadOptions = {};
  const nxJson = readJsonFile<NxJsonConfiguration>(nxJsonPath, parseOptions);

  if (!nxJson.installation) {
    return false;
  }

  let modified = false;

  const nxVersion = updatedPackages.nx?.version;
  if (nxVersion && nxJson.installation.version !== nxVersion) {
    nxJson.installation.version = nxVersion;
    modified = true;
  }

  if (nxJson.installation.plugins) {
    for (const dep in nxJson.installation.plugins) {
      const update = updatedPackages[dep];
      if (update) {
        const newVersion = valid(update.version)
          ? update.version
          : await resolvePackageVersionUsingRegistry(dep, update.version);
        if (nxJson.installation.plugins[dep] !== newVersion) {
          nxJson.installation.plugins[dep] = newVersion;
          modified = true;
        }
      }
    }
  }

  if (modified) {
    await writeFormattedJsonFile(nxJsonPath, nxJson, {
      appendNewLine: parseOptions.endsWithNewline,
    });
  }

  return modified;
}

async function isMigratingToNewMajor(from: string, to: string) {
  from = normalizeVersion(from);
  to = ['latest', 'next', 'canary'].includes(to) ? to : normalizeVersion(to);
  if (!valid(from)) {
    from = await resolvePackageVersionUsingRegistry('nx', from);
  }
  if (!valid(to)) {
    to = await resolvePackageVersionUsingRegistry('nx', to);
  }
  return major(from) < major(to);
}

function readNxVersion(packageJson: PackageJson, root: string) {
  return (
    getDependencyVersionFromPackageJson('nx', root, packageJson) ??
    getDependencyVersionFromPackageJson('@nx/workspace', root, packageJson) ??
    getDependencyVersionFromPackageJson('@nrwl/workspace', root, packageJson)
  );
}

async function generateMigrationsJsonAndUpdatePackageJson(
  root: string,
  opts: GenerateMigrations
) {
  const pmc = getPackageManagerCommand();
  try {
    const rootPkgJsonPath = join(root, 'package.json');
    let originalPackageJson = existsSync(rootPkgJsonPath)
      ? readJsonFile<PackageJson>(rootPkgJsonPath)
      : null;
    const originalNxJson = readNxJson();
    const from =
      originalNxJson.installation?.version ??
      readNxVersion(originalPackageJson, root);

    const mode = opts.mode;

    let walkedTargetPackage = opts.targetPackage;
    let fromOverrides = opts.from;
    let excludeApplied = opts.excludeAppliedMigrations;
    if (mode === 'third-party') {
      // For third-party, walk the canonical Nx target so cross-plugin third-party
      // dependencies (e.g. typescript managed by @nx/js but used by @nx/angular)
      // stay consistent. Force a from-zero walk + exclude-applied so we surface
      // any third-party updates that may have been skipped previously.
      const canonical = resolveCanonicalNxPackage(opts.targetVersion);
      walkedTargetPackage = canonical;
      fromOverrides = { [canonical]: '0.0.0' };
      excludeApplied = true;
    }

    logger.info(`Fetching meta data about packages.`);
    logger.info(`It may take a few minutes.`);

    const fetch = createFetcher();
    let firstPartyPackages: ReadonlySet<string> | undefined;
    if (mode === 'first-party' || mode === 'third-party') {
      // `@nx/workspace` is version-synced with `nx` and declares an
      // intentionally narrow `packageGroup` ({ nx, nx-cloud }) via its
      // `ng-update` field, whereas `nx` declares the full @nx/* plugin
      // fan-out. Their transitive first-party closures are equivalent, so
      // when `@nx/workspace` is the target we source the set from `nx`
      // directly to capture the full plugin set.
      const sourcePackage =
        walkedTargetPackage === '@nx/workspace' ? 'nx' : walkedTargetPackage;
      const rootMetadata = await fetch(sourcePackage, opts.targetVersion);
      // Legacy `@nrwl/workspace<14` doesn't ship a complete `packageGroup`
      // in its metadata; the Migrator's cascade injects
      // `LEGACY_NRWL_PACKAGE_GROUP` for that case, and the post-build
      // third-party filter must mirror that set or first-party `@nrwl/*`
      // plugins slip past it.
      const packageGroup =
        sourcePackage === '@nrwl/workspace' && isLegacyEra(opts.targetVersion)
          ? LEGACY_NRWL_PACKAGE_GROUP
          : rootMetadata.packageGroup;
      firstPartyPackages = resolveFirstPartyPackages(
        sourcePackage,
        packageGroup
      );
    }

    const installedPackageVersions =
      createInstalledPackageVersionsResolver(root);

    const migrator = new Migrator({
      packageJson: originalPackageJson,
      nxInstallation: originalNxJson.installation,
      getInstalledPackageVersion: installedPackageVersions,
      fetch,
      from: fromOverrides,
      to: opts.to,
      interactive: opts.interactive && !isCI(),
      excludeAppliedMigrations: excludeApplied,
      mode,
      firstPartyPackages,
    });

    const {
      migrations,
      packageUpdates,
      promptContents,
      minVersionWithSkippedUpdates,
    } = await migrator.migrate(walkedTargetPackage, opts.targetVersion);

    // The cascade collects packageJsonUpdates entries against the cascade
    // root's installed version, but inner per-package pins are only gated
    // against the in-flight cascade tally — not against each inner package's
    // installed version. A from-zero walk (e.g. `--mode=third-party`) can
    // surface a stale historical pin that would write a lower version than
    // the user already has. Drop those before writing; nx migrate is
    // forward-only, never a downgrade.
    const writableUpdates = filterDowngradedUpdates(
      packageUpdates,
      originalPackageJson,
      installedPackageVersions
    );

    const wrotePackageJson = await updatePackageJson(root, writableUpdates);
    const wroteNxJsonInstallation = await updateInstallationDetails(
      root,
      writableUpdates
    );

    const promptMigrationFiles = writePromptMigrationFiles(
      root,
      migrations,
      promptContents ?? {},
      packageUpdates[walkedTargetPackage].version
    );

    if (migrations.length > 0) {
      await createMigrationsFile(root, [
        ...addSplitConfigurationMigrationIfAvailable(from, writableUpdates),
        ...migrations,
      ] as any);
    }

    const modeLine =
      mode === 'first-party'
        ? `- Processed Nx first-party packages only (skipped third-party dependency bumps).`
        : mode === 'third-party'
          ? `- Processed third-party dependencies only (skipped Nx first-party package updates).`
          : null;

    const noChanges =
      !wrotePackageJson && !wroteNxJsonInstallation && migrations.length === 0;

    if (noChanges) {
      output.success({
        title: `No updates were applied.`,
        bodyLines: [
          ...(modeLine ? [modeLine] : []),
          mode === 'third-party'
            ? `- No third-party dependency bumps were found for the installed Nx version. Either your dependencies are already up to date, or this workspace doesn't manage them in a place 'nx migrate' writes to (e.g. non-JS workspaces only track Nx and its plugins).`
            : `- No package updates or migrations were found.`,
        ],
      });
      // Nothing was applied; skip the "Next steps" guidance below — it would
      // tell the user to inspect package.json changes that don't exist.
      return;
    }

    output.success({
      title: `The migrate command has run successfully.`,
      bodyLines: [
        ...(modeLine ? [modeLine] : []),
        ...(wrotePackageJson ? [`- package.json has been updated.`] : []),
        ...(wroteNxJsonInstallation
          ? [`- nx.json (installation) has been updated.`]
          : []),
        migrations.length > 0
          ? `- migrations.json has been generated.`
          : `- There are no migrations to run, so migrations.json has not been created.`,
        ...(promptMigrationFiles.length > 0
          ? [
              `- ${promptMigrationFiles.length} AI migration prompt(s) have been written to ${AI_MIGRATIONS_DIR}/.`,
            ]
          : []),
      ],
    });

    try {
      if (
        opts.interactive !== false &&
        ['nx', '@nrwl/workspace'].includes(opts.targetPackage) &&
        (await isMigratingToNewMajor(from, opts.targetVersion)) &&
        !isCI() &&
        !isNxCloudDisabled(originalNxJson) &&
        !isNxCloudUsed(originalNxJson)
      ) {
        output.success({
          title: 'Connect to Nx Cloud',
          bodyLines: [
            'Nx Cloud is a first-party CI companion for Nx projects. It improves critical aspects of CI:',
            '- Speed: 30% - 70% faster CI',
            '- Cost: 40% - 75% reduction in CI costs',
            '- Reliability: by automatically identifying flaky tasks and re-running them',
          ],
        });
        await connectToNxCloudWithPrompt('migrate');
        originalPackageJson = readJsonFile<PackageJson>(
          join(root, 'package.json')
        );
      }
    } catch {
      // The above code is to remind folks when updating to a new major and not currently using Nx cloud.
      // If for some reason it fails, it shouldn't affect the overall migration process
    }

    const bodyLines = process.env['NX_CONSOLE']
      ? [
          '- Inspect the package.json changes in the built-in diff editor [Click to open]',
          '- Confirm the changes to install the new dependencies and continue the migration',
        ]
      : [
          `- Make sure package.json changes make sense and then run '${pmc.install}',`,
          ...(promptMigrationFiles.length > 0
            ? [
                `- Review and tweak the AI migration prompts in ${AI_MIGRATIONS_DIR}/ as needed.`,
              ]
            : []),
          ...(migrations.length > 0
            ? [`- Run '${pmc.exec} nx migrate --run-migrations'`]
            : []),
          ...(opts.originalTargetVersion
            ? [
                `- After applying these migrations, run '${pmc.exec} nx migrate ${opts.targetPackage}@${opts.originalTargetVersion} --mode=${opts.mode}${
                  opts.multiMajorMode === 'gradual'
                    ? ` ${MULTI_MAJOR_MODE_FLAG}=gradual`
                    : ''
                }' to continue toward your original target.`,
              ]
            : []),
          ...(opts.interactive && minVersionWithSkippedUpdates
            ? [
                `- You opted out of some migrations for now. Write the following command down somewhere to apply these migrations later:`,
                `  nx migrate ${opts.targetVersion} --from ${opts.targetPackage}@${minVersionWithSkippedUpdates} --exclude-applied-migrations`,
                `- To learn more go to https://nx.dev/recipes/tips-n-tricks/advanced-update`,
              ]
            : [
                `- To learn more go to https://nx.dev/features/automate-updating-dependencies`,
              ]),
          ...(showConnectToCloudMessage()
            ? [
                `- You may run '${pmc.run(
                  'nx',
                  'connect-to-nx-cloud'
                )}' to get faster builds, GitHub integration, and more. Check out https://nx.app`,
              ]
            : []),
        ];

    output.log({
      title: 'Next steps:',
      bodyLines,
    });
  } catch (e) {
    output.error({
      title: `The migrate command failed.`,
    });
    throw e;
  }
}

function addSplitConfigurationMigrationIfAvailable(
  from: string,
  packageJson: any
) {
  if (!packageJson['@nrwl/workspace']) return [];

  if (
    gte(packageJson['@nrwl/workspace'].version, '15.7.0-beta.0') &&
    lt(normalizeVersion(from), '15.7.0-beta.0')
  ) {
    return [
      {
        version: '15.7.0-beta.0',
        description:
          'Split global configuration files into individual project.json files. This migration has been added automatically to the beginning of your migration set to retroactively make them work with the new version of Nx.',
        implementation:
          './src/migrations/update-15-7-0/split-configuration-into-project-json-files',
        package: '@nrwl/workspace',
        name: '15-7-0-split-configuration-into-project-json-files',
      },
    ];
  } else {
    return [];
  }
}

function showConnectToCloudMessage() {
  try {
    const nxJson = readNxJson();
    const defaultRunnerIsUsed = onlyDefaultRunnerIsUsed(nxJson);
    return !!defaultRunnerIsUsed;
  } catch {
    return false;
  }
}

function runInstall(
  nxWorkspaceRoot?: string,
  phase: MigrationInstallPhase = 'pre-migration'
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
          logNpmPeerDepsError(phase);
          reject(new NpmPeerDepsInstallError());
          return;
        }
      }

      reject(new Error(`Command failed: ${installCommand}`));
    });
  });
}

type MigrationInstallPhase = 'pre-migration' | 'post-migration';

class NpmPeerDepsInstallError extends Error {
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

function logNpmPeerDepsError(phase: MigrationInstallPhase): void {
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
    '   nx migrate --run-migrations --skip-install',
  ];

  if (phase === 'pre-migration') {
    output.error({
      title:
        'You need to resolve the peer dependency conflicts before the migration can continue',
      bodyLines: [
        ...peerDepsResolutionSteps,
        '',
        'Once the conflicts are resolved, re-run the migrations:',
        '   nx migrate --run-migrations',
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
        'If the migration was interrupted before completing, re-run the remaining migrations:',
        '   nx migrate --run-migrations',
        '',
        ...manualInstallHint,
      ],
    });
  }
}

export async function executeMigrations(
  root: string,
  migrations: {
    package: string;
    name: string;
    description?: string;
    version: string;
  }[],
  isVerbose: boolean,
  shouldCreateCommits: boolean,
  commitPrefix: string,
  shouldSkipInstall = false
) {
  const changedDepInstaller = new ChangedDepInstaller(root, shouldSkipInstall);

  const migrationsWithNoChanges: typeof migrations = [];
  const sortedMigrations = migrations.sort((a, b) => {
    // special case for the split configuration migration to run first
    if (a.name === '15-7-0-split-configuration-into-project-json-files') {
      return -1;
    }
    if (b.name === '15-7-0-split-configuration-into-project-json-files') {
      return 1;
    }

    return lt(normalizeVersion(a.version), normalizeVersion(b.version))
      ? -1
      : 1;
  });

  logger.info(`Running the following migrations:`);
  sortedMigrations.forEach((m) =>
    logger.info(`- ${m.package}: ${m.name} (${m.description})`)
  );
  logger.info(`---------------------------------------------------------\n`);
  const allNextSteps: string[] = [];
  for (const m of sortedMigrations) {
    logger.info(`Running migration ${m.package}: ${m.name}`);
    try {
      const { changes, nextSteps } = await runNxOrAngularMigration(
        root,
        m,
        isVerbose,
        shouldCreateCommits,
        commitPrefix,
        () => changedDepInstaller.installDepsIfChanged()
      );
      allNextSteps.push(...nextSteps);
      if (changes.length === 0) {
        migrationsWithNoChanges.push(m);
      }
      logger.info(`---------------------------------------------------------`);
    } catch (e) {
      if (!(e instanceof NpmPeerDepsInstallError)) {
        output.error({
          title: `Failed to run ${m.name} from ${m.package}. This workspace is NOT up to date!`,
        });
      }
      throw e;
    }
  }

  if (!shouldCreateCommits) {
    await changedDepInstaller.installDepsIfChanged();
  }

  if (changedDepInstaller.skippedInstall) {
    logSkippedPostMigrationInstall(root);
  }

  return { migrationsWithNoChanges, nextSteps: allNextSteps };
}

class ChangedDepInstaller {
  private initialDeps: string;
  private _skippedInstall = false;

  constructor(
    private readonly root: string,
    private readonly shouldSkipInstall = false
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
        await runInstall(this.root, 'post-migration');
      }
    }
    this.initialDeps = currentDeps;
  }
}

function logSkippedPostMigrationInstall(root: string): void {
  const packageManager = detectPackageManager(root);
  const installCommand = getPackageManagerCommand(packageManager, root).install;
  output.warn({
    title: 'Migrations updated your dependencies, but the install was skipped',
    bodyLines: [`Run "${installCommand}" to install the updated dependencies.`],
  });
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
  shouldCreateCommits: boolean,
  commitPrefix: string,
  installDepsIfChanged?: () => Promise<void>,
  handleInstallDeps = false
): Promise<{ changes: FileChange[]; nextSteps: string[] }> {
  if (!installDepsIfChanged) {
    const changedDepInstaller = new ChangedDepInstaller(root);
    installDepsIfChanged = () => changedDepInstaller.installDepsIfChanged();
  }
  const { collection, collectionPath } = readMigrationCollection(
    migration.package,
    root
  );
  let changes: FileChange[] = [];
  let nextSteps: string[] = [];
  if (!isAngularMigration(collection, migration.name)) {
    ({ nextSteps, changes } = await runNxMigration(
      root,
      collectionPath,
      collection,
      migration.name,
      migration.version
    ));

    logger.info(`Ran ${migration.name} from ${migration.package}`);
    logger.info(`  ${migration.description}\n`);
    if (changes.length < 1) {
      logger.info(`No changes were made\n`);
      return { changes, nextSteps };
    }

    logger.info('Changes:');
    printChanges(changes, '  ');
    logger.info('');
  } else {
    const ngCliAdapter = await getNgCompatLayer();
    const migrationProjectGraph = await createProjectGraphAsync();
    const { madeChanges, loggingQueue } = await ngCliAdapter.runMigration(
      root,
      migration.package,
      migration.name,
      readProjectsConfigurationFromProjectGraph(migrationProjectGraph).projects,
      isVerbose,
      migrationProjectGraph
    );

    logger.info(`Ran ${migration.name} from ${migration.package}`);
    logger.info(`  ${migration.description}\n`);
    if (!madeChanges) {
      logger.info(`No changes were made\n`);
      return { changes, nextSteps };
    }

    logger.info('Changes:');
    loggingQueue.forEach((log) => logger.info('  ' + log));
    logger.info('');
  }

  if (shouldCreateCommits) {
    await installDepsIfChanged();

    const commitMessage = `${commitPrefix}${migration.name}`;
    try {
      const committedSha = commitChanges(commitMessage, root);

      if (committedSha) {
        logger.info(pc.dim(`- Commit created for changes: ${committedSha}`));
      } else {
        logger.info(
          pc.red(
            `- A commit could not be created/retrieved for an unknown reason`
          )
        );
      }
    } catch (e) {
      logger.info(pc.red(`- ${e.message}`));
    }
    // if we are running this function alone, we need to install deps internally
  } else if (handleInstallDeps) {
    await installDepsIfChanged();
  }

  return { changes, nextSteps };
}

async function runMigrations(
  root: string,
  opts: { runMigrations: string; ifExists: boolean },
  args: string[],
  isVerbose: boolean,
  shouldCreateCommits = false,
  commitPrefix: string,
  shouldSkipInstall = false
) {
  if (!shouldSkipInstall && !process.env.NX_MIGRATE_SKIP_INSTALL) {
    await runInstall();
  }

  if (!__dirname.startsWith(workspaceRoot)) {
    // we are running from a temp installation with nx latest, switch to running
    // from local installation
    const exitCode = runOrReturnExitCode(() =>
      runNxSync(`migrate ${args.join(' ')}`, {
        stdio: ['inherit', 'inherit', 'inherit'],
        env: {
          ...process.env,
          NX_MIGRATE_SKIP_INSTALL: 'true',
          NX_MIGRATE_USE_LOCAL: 'true',
        },
      })
    );
    if (exitCode !== 0) {
      return exitCode;
    }
    return;
  }

  const migrationsExists: boolean = fileExists(opts.runMigrations);

  if (opts.ifExists && !migrationsExists) {
    output.log({
      title: `Migrations file '${opts.runMigrations}' doesn't exist`,
    });
    return;
  } else if (!opts.ifExists && !migrationsExists) {
    throw new Error(
      `File '${opts.runMigrations}' doesn't exist, can't run migrations. Use flag --if-exists to run migrations only if the file exists`
    );
  }

  output.log({
    title:
      `Running migrations from '${opts.runMigrations}'` +
      (shouldCreateCommits ? ', with each applied in a dedicated commit' : ''),
  });

  const migrations: {
    package: string;
    name: string;
    version: string;
  }[] = readJsonFile(join(root, opts.runMigrations)).migrations;

  const { migrationsWithNoChanges, nextSteps } = await executeMigrations(
    root,
    migrations,
    isVerbose,
    shouldCreateCommits,
    commitPrefix,
    shouldSkipInstall
  );

  if (migrationsWithNoChanges.length < migrations.length) {
    output.success({
      title: `Successfully finished running migrations from '${opts.runMigrations}'. This workspace is up to date!`,
    });
  } else {
    output.success({
      title: `No changes were made from running '${opts.runMigrations}'. This workspace is up to date!`,
    });
  }
  if (nextSteps.length > 0) {
    output.log({
      title: `Some migrations have additional information, see below.`,
      bodyLines: nextSteps.map((line) => `- ${line}`),
    });
  }
}

function getStringifiedPackageJsonDeps(root: string): string {
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

async function runNxMigration(
  root: string,
  collectionPath: string,
  collection: MigrationsJson,
  name: string,
  migrationVersion?: string
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
  let nextSteps = await fn(host, {});
  // This accounts for migrations that mistakenly return a generator callback
  // from a migration. We've never executed these, so its not a breaking change that
  // we don't call them now... but currently shipping a migration with one wouldn't break
  // the migrate flow, so we are being cautious.
  if (!isStringArray(nextSteps)) {
    nextSteps = [];
  }
  host.lock();
  const changes = host.listChanges();
  flushChanges(root, changes);
  return { changes, nextSteps };
}

export async function migrate(
  root: string,
  args: { [k: string]: any },
  rawArgs: string[]
) {
  await daemonClient.stop();

  return handleErrors(process.env.NX_VERBOSE_LOGGING === 'true', async () => {
    const opts = await parseMigrationsOptions(args);
    if (opts.type === 'generateMigrations') {
      await generateMigrationsJsonAndUpdatePackageJson(root, opts);
    } else {
      try {
        return await runMigrations(
          root,
          opts,
          rawArgs,
          args['verbose'],
          args['createCommits'],
          args['commitPrefix'],
          args['skipInstall']
        );
      } catch (e) {
        // The remediation guidance is already logged by `runInstall`; swallow
        // the error here so `handleErrors` doesn't print a noisy stack after
        // the friendly output.
        if (e instanceof NpmPeerDepsInstallError) {
          return 1;
        }
        throw e;
      }
    }
  });
}

export async function runMigration() {
  return handleErrors(process.env.NX_VERBOSE_LOGGING === 'true', async () => {
    const runLocalMigrate = () =>
      runOrReturnExitCode(() =>
        runNxSync(`_migrate ${process.argv.slice(3).join(' ')}`, {
          stdio: ['inherit', 'inherit', 'inherit'],
        })
      );

    if (
      process.env.NX_USE_LOCAL !== 'true' &&
      process.env.NX_MIGRATE_USE_LOCAL === undefined
    ) {
      const p = await nxCliPath();
      if (p === null) {
        return runLocalMigrate();
      }

      // ensure local registry from process is not interfering with the install
      // when we start the process from temp folder the local registry would override the custom registry
      if (
        process.env.npm_config_registry &&
        process.env.npm_config_registry.match(
          /^https:\/\/registry\.(npmjs\.org|yarnpkg\.com)/
        )
      ) {
        delete process.env.npm_config_registry;
      }
      return runOrReturnExitCode(() =>
        execSync(`${p} _migrate ${process.argv.slice(3).join(' ')}`, {
          stdio: ['inherit', 'inherit', 'inherit'],
          windowsHide: true,
        })
      );
    }

    return runLocalMigrate();
  });
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

class MigrationImplementationMissingError extends Error {
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

export async function nxCliPath(nxWorkspaceRoot?: string) {
  const version = process.env.NX_MIGRATE_CLI_VERSION || 'latest';
  const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';

  await ensurePackageHasProvenance('nx', version);

  try {
    const packageManager = detectPackageManager();
    const pmc = getPackageManagerCommand(packageManager);

    const { dirSync } = require('tmp');
    const tmpDir = dirSync().name;
    writeJsonFile(join(tmpDir, 'package.json'), {
      dependencies: {
        nx: version,
      },
      license: 'MIT',
    });
    const root = nxWorkspaceRoot ?? workspaceRoot;
    const isNonJs = !existsSync(join(root, 'package.json'));
    copyPackageManagerConfigurationFiles(
      isNonJs ? getNxInstallationPath(root) : root,
      tmpDir
    );

    // Let's print the output of the install process to the console when verbose
    // is enabled, so it's easier to debug issues with the installation process
    const stdio: StdioOptions = isVerbose
      ? ['ignore', 'inherit', 'inherit']
      : 'ignore';

    if (pmc.preInstall) {
      // ensure package.json and repo in tmp folder is set to a proper package manager state
      execSync(pmc.preInstall, {
        cwd: tmpDir,
        stdio,
        windowsHide: true,
      });
      // if it's berry ensure we set the node_linker to node-modules
      if (packageManager === 'yarn' && pmc.ciInstall.includes('immutable')) {
        execSync('yarn config set nodeLinker node-modules', {
          cwd: tmpDir,
          stdio,
          windowsHide: true,
        });
      }
    }

    execSync(`${pmc.install} ${pmc.ignoreScriptsFlag ?? ''}`, {
      cwd: tmpDir,
      stdio,
      windowsHide: true,
    });

    // Set NODE_PATH so that these modules can be used for module resolution
    addToNodePath(join(tmpDir, 'node_modules'));
    addToNodePath(join(nxWorkspaceRoot ?? workspaceRoot, 'node_modules'));

    return join(tmpDir, `node_modules`, '.bin', 'nx');
  } catch (e) {
    console.error(
      `Failed to install the ${version} version of the migration script. Using the current version.`
    );
    if (isVerbose) {
      console.error(e);
    }
    return null;
  }
}

function addToNodePath(dir: string) {
  // NODE_PATH is a delimited list of paths.
  // The delimiter is different for windows.
  const delimiter = require('os').platform() === 'win32' ? ';' : ':';

  const paths = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(delimiter)
    : [];

  // Add the tmp path
  paths.push(dir);

  // Update the env variable.
  process.env.NODE_PATH = paths.join(delimiter);
}

function isAngularMigration(collection: MigrationsJson, name: string) {
  return !collection.generators?.[name] && collection.schematics?.[name];
}

const getNgCompatLayer = (() => {
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

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((v) => typeof v === 'string');
}
