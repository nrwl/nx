import * as chalk from 'chalk';
import { exec, execSync } from 'child_process';
import { prompt } from 'enquirer';
import { dirname, join } from 'path';
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
import { URL } from 'url';
import { promisify } from 'util';
import {
  MigrationsJson,
  MigrationsJsonEntry,
  PackageJsonUpdateForPackage as PackageUpdate,
  PackageJsonUpdates,
} from '../../config/misc-interfaces';
import { NxJsonConfiguration } from '../../config/nx-json';
import { flushChanges, FsTree, printChanges } from '../../generators/tree';
import {
  extractFileFromTarball,
  fileExists,
  JsonReadOptions,
  readJsonFile,
  writeJsonFile,
} from '../../utils/fileutils';
import { logger } from '../../utils/logger';
import {
  ArrayPackageGroup,
  NxMigrationsConfiguration,
  PackageJson,
  readModulePackageJson,
  readNxMigrateConfig,
} from '../../utils/package-json';
import {
  createTempNpmDirectory,
  detectPackageManager,
  getPackageManagerCommand,
  packageRegistryPack,
  packageRegistryView,
  resolvePackageVersionUsingRegistry,
} from '../../utils/package-manager';
import { handleErrors } from '../../utils/params';
import { connectToNxCloudCommand } from '../connect/connect-to-nx-cloud';
import { output } from '../../utils/output';
import { messages, recordStat } from '../../utils/ab-testing';
import { nxVersion } from '../../utils/versions';
import { existsSync, readFileSync } from 'fs';
import { workspaceRoot } from '../../utils/workspace-root';
import { isCI } from '../../utils/is-ci';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { readNxJson } from '../../config/configuration';
import { runNxSync } from '../../utils/child-process';
import { daemonClient } from '../../daemon/client/client';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';

export interface ResolvedMigrationConfiguration extends MigrationsJson {
  packageGroup?: ArrayPackageGroup;
}

const execAsync = promisify(exec);

export function normalizeVersion(version: string) {
  const [semver, ...prereleaseTagParts] = version.split('-');
  // Handle versions like 1.0.0-beta-next.2
  const prereleaseTag = prereleaseTagParts.join('-');

  const [major, minor, patch] = semver.split('.');

  const newSemver = `${major || 0}.${minor || 0}.${patch || 0}`;

  const newVersion = prereleaseTag
    ? `${newSemver}-${prereleaseTag}`
    : newSemver;

  const withoutPatch = `${major || 0}.${minor || 0}.0`;
  const withoutPatchAndMinor = `${major || 0}.0.0`;

  const variationsToCheck = [
    newVersion,
    newSemver,
    withoutPatch,
    withoutPatchAndMinor,
  ];

  for (const variation of variationsToCheck) {
    try {
      if (gt(variation, '0.0.0')) {
        return variation;
      }
    } catch {}
  }

  return '0.0.0';
}

function cleanSemver(version: string) {
  return clean(version) ?? coerce(version);
}

function normalizeSlashes(packageName: string): string {
  return packageName.replace(/\\/g, '/');
}

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
}

export class Migrator {
  private readonly packageJson?: MigratorOptions['packageJson'];
  private readonly getInstalledPackageVersion: MigratorOptions['getInstalledPackageVersion'];
  private readonly fetch: MigratorOptions['fetch'];
  private readonly installedPkgVersionOverrides: MigratorOptions['from'];
  private readonly to: MigratorOptions['to'];
  private readonly interactive: MigratorOptions['interactive'];
  private readonly excludeAppliedMigrations: MigratorOptions['excludeAppliedMigrations'];
  private readonly packageUpdates: Record<string, PackageUpdate> = {};
  private readonly collectedVersions: Record<string, string> = {};
  private readonly promptAnswers: Record<string, boolean> = {};
  private readonly nxInstallation: NxJsonConfiguration['installation'] | null;
  private minVersionWithSkippedUpdates: string | undefined;

  constructor(opts: MigratorOptions) {
    this.packageJson = opts.packageJson;
    this.nxInstallation = opts.nxInstallation;
    this.getInstalledPackageVersion = opts.getInstalledPackageVersion;
    this.fetch = opts.fetch;
    this.installedPkgVersionOverrides = opts.from;
    this.to = opts.to;
    this.interactive = opts.interactive;
    this.excludeAppliedMigrations = opts.excludeAppliedMigrations;
  }

  async migrate(targetPackage: string, targetVersion: string) {
    await this.buildPackageJsonUpdates(targetPackage, {
      version: targetVersion,
      addToPackageJson: false,
    });

    const migrations = await this.createMigrateJson();
    return {
      packageUpdates: this.packageUpdates,
      migrations,
      minVersionWithSkippedUpdates: this.minVersionWithSkippedUpdates,
    };
  }

  private async createMigrateJson() {
    const migrations = await Promise.all(
      Object.keys(this.packageUpdates).map(async (packageName) => {
        const currentVersion = this.getPkgVersion(packageName);
        if (currentVersion === null) return [];

        const { version } = this.packageUpdates[packageName];
        const { generators } = await this.fetch(packageName, version);

        if (!generators) return [];

        return Object.entries(generators)
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

    return migrations.flat();
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
      for (const packageUpdate of packageToCheck.updates) {
        if (
          this.areRequirementsMet(packageUpdate.requires) &&
          (!this.interactive ||
            (await this.runPackageJsonUpdatesConfirmationPrompt(packageUpdate)))
        ) {
          Object.entries(packageUpdate.packages).forEach(([name, update]) => {
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
      updates: PackageJsonUpdates[string][];
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
      });
      return [];
    }

    let migrationConfig: ResolvedMigrationConfiguration;
    try {
      migrationConfig = await this.fetch(targetPackage, targetVersion);
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
    });

    const { packageJsonUpdates, packageGroupOrder } =
      this.getPackageJsonUpdatesFromMigrationConfig(
        targetPackage,
        targetVersion,
        migrationConfig
      );

    if (!packageJsonUpdates.length) {
      return [];
    }

    const shouldCheckUpdates = packageJsonUpdates.some(
      (packageJsonUpdate) =>
        (this.interactive && packageJsonUpdate['x-prompt']) ||
        Object.keys(packageJsonUpdate.requires ?? {}).length
    );

    if (shouldCheckUpdates) {
      return [{ package: targetPackage, updates: packageJsonUpdates }];
    }

    const packageUpdatesToApply = packageJsonUpdates.reduce(
      (m, c) => ({ ...m, ...c.packages }),
      {} as Record<string, PackageUpdate>
    );
    return (
      await Promise.all(
        Object.entries(packageUpdatesToApply).map(
          ([packageName, packageUpdate]) =>
            this.populatePackageJsonUpdatesAndGetPackagesToCheck(
              packageName,
              packageUpdate
            )
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
    migrationConfig: ResolvedMigrationConfiguration
  ): {
    packageJsonUpdates: PackageJsonUpdates[string][];
    packageGroupOrder: string[];
  } {
    const packageGroupOrder: string[] =
      this.getPackageJsonUpdatesFromPackageGroup(
        packageName,
        targetVersion,
        migrationConfig
      );

    if (
      !migrationConfig.packageJsonUpdates ||
      !this.getPkgVersion(packageName)
    ) {
      return { packageJsonUpdates: [], packageGroupOrder };
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
    migrationConfig: ResolvedMigrationConfiguration
  ) {
    const packageGroup: ArrayPackageGroup =
      packageName === '@nrwl/workspace' && lt(targetVersion, '14.0.0-beta.0')
        ? LEGACY_NRWL_PACKAGE_GROUP
        : migrationConfig.packageGroup ?? [];

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
  ): PackageJsonUpdates[string][] {
    const filteredPackageJsonUpdates: PackageJsonUpdates[string][] = [];

    for (const packageJsonUpdate of Object.values(packageJsonUpdates)) {
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
              ? 'dependencies'
              : packageUpdate.addToPackageJson || false,
          };
        }
      }
      if (Object.keys(filtered).length) {
        packageJsonUpdate.packages = filtered;
        filteredPackageJsonUpdates.push(packageJsonUpdate);
      }
    }

    return filteredPackageJsonUpdates;
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
    packageUpdate: PackageJsonUpdates[string]
  ): Promise<boolean> {
    if (!packageUpdate['x-prompt']) {
      return Promise.resolve(true);
    }
    const promptKey = this.getPackageUpdatePromptKey(packageUpdate);
    if (this.promptAnswers[promptKey] !== undefined) {
      // a same prompt was already answered, skip
      return Promise.resolve(false);
    }

    return await prompt([
      {
        name: 'shouldApply',
        type: 'confirm',
        message: packageUpdate['x-prompt'],
        initial: true,
      },
    ]).then(({ shouldApply }: { shouldApply: boolean }) => {
      this.promptAnswers[promptKey] = shouldApply;

      if (
        !shouldApply &&
        (!this.minVersionWithSkippedUpdates ||
          lt(packageUpdate.version, this.minVersionWithSkippedUpdates))
      ) {
        this.minVersionWithSkippedUpdates = packageUpdate.version;
      }

      return shouldApply;
    });
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

async function normalizeVersionWithTagCheck(
  pkg: string,
  version: string
): Promise<string> {
  // This doesn't seem like a valid version, lets check if its a tag on the registry.
  if (version && !coerce(version)) {
    try {
      return packageRegistryView(pkg, version, 'version');
    } catch {
      // fall through to old logic
    }
  }
  return normalizeVersion(version);
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

async function parseTargetPackageAndVersion(
  args: string
): Promise<{ targetPackage: string; targetVersion: string }> {
  if (!args) {
    throw new Error(
      `Provide the correct package name and version. E.g., my-package@9.0.0.`
    );
  }

  if (args.indexOf('@') > -1) {
    const i = args.lastIndexOf('@');
    if (i === 0) {
      const targetPackage = args.trim();
      const targetVersion = 'latest';
      return { targetPackage, targetVersion };
    } else {
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
  } else {
    if (
      args === 'latest' ||
      args === 'next' ||
      valid(args) ||
      args.match(/^\d+(?:\.\d+)?(?:\.\d+)?$/)
    ) {
      // Passing `nx` here may seem wrong, but nx and @nrwl/workspace are synced in version.
      // We could duplicate the ternary below, but its not necessary since they are equivalent
      // on the registry
      const targetVersion = await normalizeVersionWithTagCheck('nx', args);
      const targetPackage =
        !['latest', 'next'].includes(args) && lt(targetVersion, '14.0.0-beta.0')
          ? '@nrwl/workspace'
          : 'nx';

      return {
        targetPackage,
        targetVersion,
      };
    } else {
      return {
        targetPackage: args,
        targetVersion: 'latest',
      };
    }
  }
}

type GenerateMigrations = {
  type: 'generateMigrations';
  targetPackage: string;
  targetVersion: string;
  from: { [k: string]: string };
  to: { [k: string]: string };
  interactive?: boolean;
  excludeAppliedMigrations?: boolean;
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

  if (!options.runMigrations) {
    const [from, to] = await Promise.all([
      options.from
        ? versionOverrides(options.from as string, 'from')
        : Promise.resolve({} as Record<string, string>),
      options.to
        ? await versionOverrides(options.to as string, 'to')
        : Promise.resolve({} as Record<string, string>),
    ]);
    const { targetPackage, targetVersion } = await parseTargetPackageAndVersion(
      options['packageAndVersion']
    );
    return {
      type: 'generateMigrations',
      targetPackage: normalizeSlashes(targetPackage),
      targetVersion,
      from,
      to,
      interactive: options.interactive,
      excludeAppliedMigrations: options.excludeAppliedMigrations,
    };
  } else {
    return {
      type: 'runMigrations',
      runMigrations: options.runMigrations as string,
      ifExists: options.ifExists as boolean,
    };
  }
}

function createInstalledPackageVersionsResolver(
  root: string
): MigratorOptions['getInstalledPackageVersion'] {
  const cache: Record<string, string> = {};

  function getInstalledPackageVersion(
    packageName: string,
    overrides?: Record<string, string>
  ): string | null {
    try {
      if (overrides?.[packageName]) {
        return overrides[packageName];
      }

      if (!cache[packageName]) {
        const { packageJson, path } = readModulePackageJson(
          packageName,
          getNxRequirePaths()
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
      // Support migrating old workspaces without nx package
      if (packageName === 'nx') {
        cache[packageName] = getInstalledPackageVersion(
          '@nrwl/workspace',
          overrides
        );
        return cache[packageName];
      }
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
      .catch(() => {
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

    const migrations = await extractFileFromTarball(
      join(dir, tarballPath),
      join('package', migrationsFilePath),
      join(dir, migrationsFilePath)
    ).then((path) => readJsonFile<MigrationsJson>(path));

    result = { ...migrations, packageGroup, version: packageVersion };
  } catch {
    throw new Error(
      `Failed to find migrations file "${migrationsFilePath}" in package "${packageName}@${packageVersion}".`
    );
  } finally {
    await cleanup();
  }

  return result;
}

async function getPackageMigrationsUsingInstall(
  packageName: string,
  packageVersion: string
): Promise<ResolvedMigrationConfiguration> {
  const { dir, cleanup } = createTempNpmDirectory();

  let result: ResolvedMigrationConfiguration;

  try {
    const pmc = getPackageManagerCommand(detectPackageManager(dir), dir);

    await execAsync(`${pmc.add} ${packageName}@${packageVersion}`, {
      cwd: dir,
    });

    const {
      migrations: migrationsFilePath,
      packageGroup,
      packageJson,
    } = readPackageMigrationConfig(packageName, dir);

    let migrations: MigrationsJson = undefined;
    if (migrationsFilePath) {
      migrations = readJsonFile<MigrationsJson>(migrationsFilePath);
    }

    result = { ...migrations, packageGroup, version: packageJson.version };
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

function createMigrationsFile(
  root: string,
  migrations: {
    package: string;
    name: string;
  }[]
) {
  writeJsonFile(join(root, 'migrations.json'), { migrations });
}

function updatePackageJson(
  root: string,
  updatedPackages: Record<string, PackageUpdate>
) {
  const packageJsonPath = join(root, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return;
  }

  const parseOptions: JsonReadOptions = {};
  const json = readJsonFile(packageJsonPath, parseOptions);

  Object.keys(updatedPackages).forEach((p) => {
    if (json.devDependencies?.[p]) {
      json.devDependencies[p] = updatedPackages[p].version;
      return;
    }

    if (json.dependencies?.[p]) {
      json.dependencies[p] = updatedPackages[p].version;
      return;
    }

    const dependencyType = updatedPackages[p].addToPackageJson;
    if (typeof dependencyType === 'string') {
      json[dependencyType] ??= {};
      json[dependencyType][p] = updatedPackages[p].version;
    }
  });

  writeJsonFile(packageJsonPath, json, {
    appendNewLine: parseOptions.endsWithNewline,
  });
}

async function updateInstallationDetails(
  root: string,
  updatedPackages: Record<string, PackageUpdate>
) {
  const nxJsonPath = join(root, 'nx.json');
  const parseOptions: JsonReadOptions = {};
  const nxJson = readJsonFile<NxJsonConfiguration>(nxJsonPath, parseOptions);

  if (!nxJson.installation) {
    return;
  }

  const nxVersion = updatedPackages.nx?.version;
  if (nxVersion) {
    nxJson.installation.version = nxVersion;
  }

  if (nxJson.installation.plugins) {
    for (const dep in nxJson.installation.plugins) {
      const update = updatedPackages[dep];
      if (update) {
        nxJson.installation.plugins[dep] = valid(update.version)
          ? update.version
          : await resolvePackageVersionUsingRegistry(dep, update.version);
      }
    }
  }

  writeJsonFile(nxJsonPath, nxJson, {
    appendNewLine: parseOptions.endsWithNewline,
  });
}

async function isMigratingToNewMajor(from: string, to: string) {
  from = normalizeVersion(from);
  to = ['latest', 'next'].includes(to) ? to : normalizeVersion(to);
  if (!valid(from)) {
    from = await resolvePackageVersionUsingRegistry('nx', from);
  }
  if (!valid(to)) {
    to = await resolvePackageVersionUsingRegistry('nx', to);
  }
  return major(from) < major(to);
}

function readNxVersion(packageJson: PackageJson) {
  return (
    packageJson?.devDependencies?.['nx'] ??
    packageJson?.dependencies?.['nx'] ??
    packageJson?.devDependencies?.['@nx/workspace'] ??
    packageJson?.dependencies?.['@nx/workspace'] ??
    packageJson?.devDependencies?.['@nrwl/workspace'] ??
    packageJson?.dependencies?.['@nrwl/workspace']
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
    const originalNxInstallation = readNxJson().installation;
    const from =
      originalNxInstallation?.version ?? readNxVersion(originalPackageJson);

    try {
      if (
        ['nx', '@nrwl/workspace'].includes(opts.targetPackage) &&
        (await isMigratingToNewMajor(from, opts.targetVersion)) &&
        !isCI() &&
        !isNxCloudUsed()
      ) {
        const useCloud = await connectToNxCloudCommand(
          messages.getPromptMessage('nxCloudMigration')
        );
        await recordStat({
          command: 'migrate',
          nxVersion,
          useCloud,
          meta: messages.codeOfSelectedPromptMessage('nxCloudMigration'),
        });
        originalPackageJson = readJsonFile<PackageJson>(
          join(root, 'package.json')
        );
      }
    } catch {
      // The above code is to remind folks when updating to a new major and not currently using Nx cloud.
      // If for some reason it fails, it shouldn't affect the overall migration process
    }

    logger.info(`Fetching meta data about packages.`);
    logger.info(`It may take a few minutes.`);

    const migrator = new Migrator({
      packageJson: originalPackageJson,
      nxInstallation: originalNxInstallation,
      getInstalledPackageVersion: createInstalledPackageVersionsResolver(root),
      fetch: createFetcher(),
      from: opts.from,
      to: opts.to,
      interactive: opts.interactive && !isCI(),
      excludeAppliedMigrations: opts.excludeAppliedMigrations,
    });

    const { migrations, packageUpdates, minVersionWithSkippedUpdates } =
      await migrator.migrate(opts.targetPackage, opts.targetVersion);

    updatePackageJson(root, packageUpdates);
    await updateInstallationDetails(root, packageUpdates);

    if (migrations.length > 0) {
      createMigrationsFile(root, [
        ...addSplitConfigurationMigrationIfAvailable(from, packageUpdates),
        ...migrations,
      ] as any);
    }

    output.success({
      title: `The migrate command has run successfully.`,
      bodyLines: [
        `- package.json has been updated.`,
        migrations.length > 0
          ? `- migrations.json has been generated.`
          : `- There are no migrations to run, so migrations.json has not been created.`,
      ],
    });

    output.log({
      title: 'Next steps:',
      bodyLines: [
        `- Make sure package.json changes make sense and then run '${pmc.install}',`,
        ...(migrations.length > 0
          ? [`- Run '${pmc.exec} nx migrate --run-migrations'`]
          : []),
        ...(opts.interactive && minVersionWithSkippedUpdates
          ? [
              `- You opted out of some migrations for now. Write the following command down somewhere to apply these migrations later:`,
              `  nx migrate ${opts.targetVersion} --from ${opts.targetPackage}@${minVersionWithSkippedUpdates} --exclude-applied-migrations`,
              `- To learn more go to https://nx.dev/recipes/other/advanced-update`,
            ]
          : [
              `- To learn more go to https://nx.dev/core-features/automate-updating-dependencies`,
            ]),
        ...(showConnectToCloudMessage()
          ? [
              `- You may run '${pmc.run(
                'nx',
                'connect-to-nx-cloud'
              )}' to get faster builds, GitHub integration, and more. Check out https://nx.app`,
            ]
          : []),
      ],
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
        cli: 'nx',
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
    const nxJson = readJsonFile<NxJsonConfiguration>('nx.json');
    const defaultRunnerIsUsed =
      !nxJson.tasksRunnerOptions ||
      Object.values(nxJson.tasksRunnerOptions).find(
        (r: any) =>
          r.runner == '@nrwl/workspace/tasks-runners/default' ||
          r.runner == 'nx/tasks-runners/default'
      );
    return !!defaultRunnerIsUsed;
  } catch {
    return false;
  }
}

function runInstall() {
  const pmCommands = getPackageManagerCommand();

  // TODO: remove this
  if (detectPackageManager() === 'npm') {
    process.env.npm_config_legacy_peer_deps ??= 'true';
  }
  output.log({
    title: `Running '${pmCommands.install}' to make sure necessary packages are installed`,
  });
  execSync(pmCommands.install, { stdio: [0, 1, 2] });
}

export async function executeMigrations(
  root: string,
  migrations: {
    package: string;
    name: string;
    description?: string;
    version: string;
    cli?: 'nx' | 'angular';
  }[],
  isVerbose: boolean,
  shouldCreateCommits: boolean,
  commitPrefix: string
) {
  const depsBeforeMigrations = getStringifiedPackageJsonDeps(root);

  const migrationsWithNoChanges: typeof migrations = [];

  for (const m of migrations) {
    try {
      const { collection, collectionPath } = readMigrationCollection(
        m.package,
        root
      );
      if (!isAngularMigration(collection, collectionPath, m.name)) {
        const changes = await runNxMigration(
          root,
          collectionPath,
          collection,
          m.name
        );

        if (changes.length < 1) {
          migrationsWithNoChanges.push(m);
          // If no changes are made, continue on without printing anything
          continue;
        }

        logger.info(`Ran ${m.name} from ${m.package}`);
        logger.info(`  ${m.description}\n`);
        printChanges(changes, '  ');
      } else {
        const ngCliAdapter = await getNgCompatLayer();
        const { madeChanges, loggingQueue } = await ngCliAdapter.runMigration(
          root,
          m.package,
          m.name,
          isVerbose
        );

        if (!madeChanges) {
          migrationsWithNoChanges.push(m);
          // If no changes are made, continue on without printing anything
          continue;
        }

        logger.info(`Ran ${m.name} from ${m.package}`);
        logger.info(`  ${m.description}\n`);
        loggingQueue.forEach((log) => logger.info('  ' + log));
      }

      if (shouldCreateCommits) {
        const commitMessage = `${commitPrefix}${m.name}`;
        try {
          const committedSha = commitChanges(commitMessage);

          if (committedSha) {
            logger.info(
              chalk.dim(`- Commit created for changes: ${committedSha}`)
            );
          } else {
            logger.info(
              chalk.red(
                `- A commit could not be created/retrieved for an unknown reason`
              )
            );
          }
        } catch (e) {
          logger.info(chalk.red(`- ${e.message}`));
        }
      }
      logger.info(`---------------------------------------------------------`);
    } catch (e) {
      output.error({
        title: `Failed to run ${m.name} from ${m.package}. This workspace is NOT up to date!`,
      });
      throw e;
    }
  }

  const depsAfterMigrations = getStringifiedPackageJsonDeps(root);
  if (depsBeforeMigrations !== depsAfterMigrations) {
    runInstall();
  }
  return migrationsWithNoChanges;
}

async function runMigrations(
  root: string,
  opts: { runMigrations: string; ifExists: boolean },
  args: string[],
  isVerbose: boolean,
  shouldCreateCommits = false,
  commitPrefix: string
) {
  if (!process.env.NX_MIGRATE_SKIP_INSTALL) {
    runInstall();
  }

  if (!__dirname.startsWith(workspaceRoot)) {
    // we are running from a temp installation with nx latest, switch to running
    // from local installation
    runNxSync(`migrate ${args.join(' ')}`, {
      stdio: ['inherit', 'inherit', 'inherit'],
      env: {
        ...process.env,
        NX_MIGRATE_SKIP_INSTALL: 'true',
        NX_MIGRATE_USE_LOCAL: 'true',
      },
    });
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
    cli?: 'nx' | 'angular';
  }[] = readJsonFile(join(root, opts.runMigrations)).migrations;

  const migrationsWithNoChanges = await executeMigrations(
    root,
    migrations,
    isVerbose,
    shouldCreateCommits,
    commitPrefix
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

function commitChanges(commitMessage: string): string | null {
  try {
    execSync('git add -A', { encoding: 'utf8', stdio: 'pipe' });
    execSync('git commit --no-verify -F -', {
      encoding: 'utf8',
      stdio: 'pipe',
      input: commitMessage,
    });
  } catch (err) {
    throw new Error(`Error committing changes:\n${err.stderr}`);
  }

  return getLatestCommitSha();
}

function getLatestCommitSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  } catch {
    return null;
  }
}

async function runNxMigration(
  root: string,
  collectionPath: string,
  collection: MigrationsJson,
  name: string
) {
  const { path: implPath, fnSymbol } = getImplementationPath(
    collection,
    collectionPath,
    name
  );
  const fn = require(implPath)[fnSymbol];
  const host = new FsTree(
    root,
    process.env.NX_VERBOSE_LOGGING === 'true',
    `migration ${collection.name}:${name}`
  );
  await fn(host, {});
  host.lock();
  const changes = host.listChanges();
  flushChanges(root, changes);
  return changes;
}

export async function migrate(
  root: string,
  args: { [k: string]: any },
  rawArgs: string[]
) {
  if (args['verbose']) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  await daemonClient.stop();

  return handleErrors(process.env.NX_VERBOSE_LOGGING === 'true', async () => {
    const opts = await parseMigrationsOptions(args);
    if (opts.type === 'generateMigrations') {
      await generateMigrationsJsonAndUpdatePackageJson(root, opts);
    } else {
      await runMigrations(
        root,
        opts,
        rawArgs,
        args['verbose'],
        args['createCommits'],
        args['commitPrefix']
      );
    }
  });
}

function readMigrationCollection(packageName: string, root: string) {
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

function getImplementationPath(
  collection: MigrationsJson,
  collectionPath: string,
  name: string
): { path: string; fnSymbol: string } {
  const g = collection.generators?.[name] || collection.schematics?.[name];
  if (!g) {
    throw new Error(
      `Unable to determine implementation path for "${collectionPath}:${name}"`
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
    // workaround for a bug in node 12
    implPath = require.resolve(
      `${dirname(collectionPath)}/${implRelativePath}`
    );
  }

  return { path: implPath, fnSymbol };
}

// TODO (v17): This should just become something like:
// ```
// return !collection.generators[name] && collection.schematics[name]
// ```
function isAngularMigration(
  collection: MigrationsJson,
  collectionPath: string,
  name: string
) {
  const entry = collection.generators?.[name] || collection.schematics?.[name];

  // In the future we will determine this based on the location of the entry in the collection.
  // If the entry is under `schematics`, it will be assumed to be an angular cli migration.
  // If the entry is under `generators`, it will be assumed to be an nx migration.
  // For now, we will continue to obey the cli property, if it exists.
  // If it doesn't exist, we will check if the implementation references @angular/devkit.
  const shouldBeNx = !!collection.generators?.[name];
  const shouldBeNg = !!collection.schematics?.[name];
  let useAngularDevkitToRunMigration = false;

  const { path: implementationPath } = getImplementationPath(
    collection,
    collectionPath,
    name
  );
  const implStringContents = readFileSync(implementationPath, 'utf-8');
  // TODO (v17): Remove this check and the cli property access - it is only here for backwards compatibility.
  if (
    ['@angular/material', '@angular/cdk'].includes(collection.name) ||
    [
      "import('@angular-devkit",
      'import("@angular-devkit',
      "require('@angular-devkit",
      'require("@angular-devkit',
      "from '@angular-devkit",
      'from "@angular-devkit',
    ].some((s) => implStringContents.includes(s))
  ) {
    useAngularDevkitToRunMigration = true;
  }

  if (useAngularDevkitToRunMigration && shouldBeNx) {
    output.warn({
      title: `The migration '${collection.name}:${name}' appears to be an Angular CLI migration, but is located in the 'generators' section of migrations.json.`,
      bodyLines: [
        'In Nx 17, migrations inside `generators` will be treated as Angular Devkit migrations.',
        "Please open an issue on the plugin's repository if you believe this is an error.",
      ],
    });
  }

  if (!useAngularDevkitToRunMigration && entry.cli === 'nx' && shouldBeNg) {
    output.warn({
      title: `The migration '${collection.name}:${name}' appears to be an Nx migration, but is located in the 'schematics' section of migrations.json.`,
      bodyLines: [
        'In Nx 17, migrations inside `generators` will be treated as nx devkit migrations.',
        "Please open an issue on the plugin's repository if you believe this is an error.",
      ],
    });
  }

  // Currently, if the cli property exists we listen to it. If its nx, its not an ng cli migration.
  // If the property is not set, we will fall back to our intuition.
  return entry.cli ? entry.cli !== 'nx' : useAngularDevkitToRunMigration;
}

const getNgCompatLayer = (() => {
  let _ngCliAdapter: typeof import('../../adapter/ngcli-adapter');
  return async function getNgCompatLayer() {
    if (!_ngCliAdapter) {
      _ngCliAdapter = await import('../../adapter/ngcli-adapter');
      require('../../adapter/compat');
    }
    return _ngCliAdapter;
  };
})();
