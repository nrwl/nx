import * as chalk from 'chalk';
import { exec, execSync } from 'child_process';
import { dirname, join } from 'path';
import { gt, lt, lte, major, valid } from 'semver';
import { promisify } from 'util';
import {
  MigrationsJson,
  PackageJsonUpdateForPackage,
} from '../config/misc-interfaces';
import { NxJsonConfiguration } from '../config/nx-json';
import { flushChanges, FsTree } from '../generators/tree';
import {
  extractFileFromTarball,
  JsonReadOptions,
  readJsonFile,
  writeJsonFile,
} from '../utils/fileutils';
import { logger } from '../utils/logger';
import {
  NxMigrationsConfiguration,
  PackageGroup,
  PackageJson,
  readNxMigrateConfig,
  readModulePackageJson,
} from '../utils/package-json';
import {
  createTempNpmDirectory,
  getPackageManagerCommand,
  packageRegistryPack,
  packageRegistryView,
  resolvePackageVersionUsingRegistry,
} from '../utils/package-manager';
import { handleErrors } from '../utils/params';
import { connectToNxCloudCommand } from './connect-to-nx-cloud';

export interface ResolvedMigrationConfiguration extends MigrationsJson {
  packageGroup?: NxMigrationsConfiguration['packageGroup'];
}

const execAsync = promisify(exec);

export function normalizeVersion(version: string) {
  const [semver, prereleaseTag] = version.split('-');
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

function normalizeSlashes(packageName: string): string {
  return packageName.replace(/\\/g, '/');
}

export interface MigratorOptions {
  packageJson: PackageJson;
  versions: (pkg: string) => string;
  fetch: (
    pkg: string,
    version: string
  ) => Promise<ResolvedMigrationConfiguration>;
  to: { [pkg: string]: string };
}

export class Migrator {
  private readonly packageJson: MigratorOptions['packageJson'];
  private readonly versions: MigratorOptions['versions'];
  private readonly fetch: MigratorOptions['fetch'];
  private readonly to: MigratorOptions['to'];

  constructor(opts: MigratorOptions) {
    this.packageJson = opts.packageJson;
    this.versions = opts.versions;
    this.fetch = opts.fetch;
    this.to = opts.to;
  }

  async updatePackageJson(targetPackage: string, targetVersion: string) {
    const packageJson = await this._updatePackageJson(targetPackage, {
      version: targetVersion,
      addToPackageJson: false,
    });

    const migrations = await this._createMigrateJson(packageJson);
    return { packageJson, migrations };
  }

  private async _createMigrateJson(
    versions: Record<string, PackageJsonUpdateForPackage>
  ) {
    const migrations = await Promise.all(
      Object.keys(versions).map(async (packageName) => {
        const currentVersion = this.versions(packageName);
        if (currentVersion === null) return [];

        const { version } = versions[packageName];
        const { generators } = await this.fetch(packageName, version);

        if (!generators) return [];

        return Object.entries(generators)
          .filter(
            ([, migration]) =>
              migration.version &&
              this.gt(migration.version, currentVersion) &&
              this.lte(migration.version, version)
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

  private collectedVersions: Record<string, string> = {};

  private async _updatePackageJson(
    targetPackage: string,
    target: PackageJsonUpdateForPackage
  ): Promise<Record<string, PackageJsonUpdateForPackage>> {
    let targetVersion = target.version;
    if (this.to[targetPackage]) {
      targetVersion = this.to[targetPackage];
    }

    if (!this.versions(targetPackage)) {
      return {
        [targetPackage]: {
          version: target.version,
          addToPackageJson: target.addToPackageJson || false,
        } as PackageJsonUpdateForPackage,
      };
    }

    let migrationsJson: ResolvedMigrationConfiguration;
    try {
      migrationsJson = await this.fetch(targetPackage, targetVersion);
      targetVersion = migrationsJson.version;
      this.collectedVersions[targetPackage] = targetVersion;
    } catch (e) {
      if (e?.message?.includes('No matching version')) {
        throw new Error(
          `${e.message}\nRun migrate with --to="package1@version1,package2@version2"`
        );
      } else {
        throw e;
      }
    }

    const packages = this.collapsePackages(
      targetPackage,
      targetVersion,
      migrationsJson
    );

    const childPackageMigrations = await Promise.all(
      Object.keys(packages)
        .filter(
          (packageName) =>
            !this.collectedVersions[packageName] ||
            this.gt(
              packages[packageName].version,
              this.collectedVersions[packageName]
            )
        )
        .map((packageName) =>
          this._updatePackageJson(packageName, packages[packageName])
        )
    );

    return childPackageMigrations.reduce(
      (migrations, childMigrations) => {
        for (const migrationName of Object.keys(childMigrations)) {
          if (
            !migrations[migrationName] ||
            this.gt(
              childMigrations[migrationName].version,
              migrations[migrationName].version
            )
          ) {
            migrations[migrationName] = childMigrations[migrationName];
          }
        }
        return migrations;
      },
      {
        [targetPackage]: {
          version: migrationsJson.version,
          addToPackageJson: target.addToPackageJson || false,
        },
      } as Record<string, PackageJsonUpdateForPackage>
    );
  }

  private collapsePackages(
    packageName: string,
    targetVersion: string,
    migration: ResolvedMigrationConfiguration
  ): Record<string, PackageJsonUpdateForPackage> {
    // this should be used to know what version to include
    // we should use from everywhere we use versions

    // Support Migrating to older versions of Nx
    // Use the packageGroup of the latest version of Nx instead of the one from the target version which could be older.
    if (
      packageName === '@nrwl/workspace' &&
      lt(targetVersion, '14.0.0-beta.0')
    ) {
      migration.packageGroup = {
        '@nrwl/workspace': targetVersion,
        '@nrwl/angular': targetVersion,
        '@nrwl/cypress': targetVersion,
        '@nrwl/devkit': targetVersion,
        '@nrwl/eslint-plugin-nx': targetVersion,
        '@nrwl/express': targetVersion,
        '@nrwl/jest': targetVersion,
        '@nrwl/linter': targetVersion,
        '@nrwl/nest': targetVersion,
        '@nrwl/next': targetVersion,
        '@nrwl/node': targetVersion,
        '@nrwl/nx-plugin': targetVersion,
        '@nrwl/react': targetVersion,
        '@nrwl/storybook': targetVersion,
        '@nrwl/web': targetVersion,
        '@nrwl/js': targetVersion,
        '@nrwl/cli': targetVersion,
        '@nrwl/nx-cloud': 'latest',
        '@nrwl/react-native': targetVersion,
        '@nrwl/detox': targetVersion,
      };
    }

    if (migration.packageGroup) {
      migration.packageJsonUpdates ??= {};

      const packageGroup = normalizePackageGroup(migration.packageGroup);

      migration.packageJsonUpdates[targetVersion + '--PackageGroup'] = {
        version: targetVersion,
        packages: packageGroup.reduce((acc, packageConfig) => {
          const { package: pkg, version } =
            typeof packageConfig === 'string'
              ? { package: packageConfig, version: targetVersion }
              : packageConfig;

          return {
            ...acc,
            [pkg]: {
              version,
              alwaysAddToPackageJson: false,
            } as PackageJsonUpdateForPackage,
          };
        }, {}),
      };
    }

    if (!migration.packageJsonUpdates || !this.versions(packageName)) return {};

    return Object.values(migration.packageJsonUpdates)
      .filter(({ version, packages }) => {
        return (
          packages &&
          this.gt(version, this.versions(packageName)) &&
          this.lte(version, targetVersion)
        );
      })
      .map(({ packages }) => {
        const { dependencies, devDependencies } = this.packageJson;

        return Object.entries(packages)
          .filter(([packageName, packageUpdate]) => {
            return (
              (!packageUpdate.ifPackageInstalled ||
                this.versions(packageUpdate.ifPackageInstalled)) &&
              (packageUpdate.alwaysAddToPackageJson ||
                packageUpdate.addToPackageJson ||
                !!dependencies?.[packageName] ||
                !!devDependencies?.[packageName])
            );
          })
          .reduce(
            (acc, [packageName, packageUpdate]) => ({
              ...acc,
              [packageName]: {
                version: packageUpdate.version,
                addToPackageJson: packageUpdate.alwaysAddToPackageJson
                  ? 'dependencies'
                  : packageUpdate.addToPackageJson || false,
              },
            }),
            {} as Record<string, PackageJsonUpdateForPackage>
          );
      })
      .reduce((m, c) => ({ ...m, ...c }), {});
  }

  private gt(v1: string, v2: string) {
    return gt(normalizeVersion(v1), normalizeVersion(v2));
  }

  private lte(v1: string, v2: string) {
    return lte(normalizeVersion(v1), normalizeVersion(v2));
  }
}

function normalizePackageGroup(
  packageGroup: PackageGroup
): (string | { package: string; version: string })[] {
  if (!Array.isArray(packageGroup)) {
    return Object.entries(packageGroup).map(([pkg, version]) => ({
      package: pkg,
      version,
    }));
  }
  return packageGroup;
}

function normalizeVersionWithTagCheck(version: string) {
  if (version === 'latest' || version === 'next') return version;
  return normalizeVersion(version);
}

function versionOverrides(overrides: string, param: string) {
  const res = {};
  overrides.split(',').forEach((p) => {
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
    res[normalizeSlashes(selectedPackage)] =
      normalizeVersionWithTagCheck(selectedVersion);
  });
  return res;
}

function parseTargetPackageAndVersion(args: string) {
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
      const targetVersion = normalizeVersionWithTagCheck(maybeVersion);
      return { targetPackage, targetVersion };
    }
  } else {
    if (
      args.match(/^\d+(?:\.\d+)?(?:\.\d+)?$/) ||
      args === 'latest' ||
      args === 'next'
    ) {
      const targetVersion = normalizeVersionWithTagCheck(args);
      const targetPackage =
        args.match(/^\d+(?:\.\d+)?(?:\.\d+)?$/) &&
        lt(targetVersion, '14.0.0-beta.0')
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
};

type RunMigrations = { type: 'runMigrations'; runMigrations: string };

export function parseMigrationsOptions(options: {
  [k: string]: any;
}): GenerateMigrations | RunMigrations {
  if (options.runMigrations === '') {
    options.runMigrations = 'migrations.json';
  }

  if (!options.runMigrations) {
    const from = options.from
      ? versionOverrides(options.from as string, 'from')
      : {};
    const to = options.to ? versionOverrides(options.to as string, 'to') : {};
    const { targetPackage, targetVersion } = parseTargetPackageAndVersion(
      options['packageAndVersion']
    );
    return {
      type: 'generateMigrations',
      targetPackage: normalizeSlashes(targetPackage),
      targetVersion,
      from,
      to,
    };
  } else {
    return {
      type: 'runMigrations',
      runMigrations: options.runMigrations as string,
    };
  }
}

function versions(root: string, from: Record<string, string>) {
  const cache: Record<string, string> = {};

  function getFromVersion(packageName: string) {
    try {
      if (from[packageName]) {
        return from[packageName];
      }

      if (!cache[packageName]) {
        const { packageJson } = readModulePackageJson(packageName, [root]);
        cache[packageName] = packageJson.version;
      }

      return cache[packageName];
    } catch {
      // Support migrating old workspaces without nx package
      if (packageName === 'nx') {
        return getFromVersion('@nrwl/workspace');
      }
      return null;
    }
  }

  return getFromVersion;
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
          result.generators = result.schematics;
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
      version: packageVersion,
    };
  }

  if (!migrationsConfig.migrations) {
    return {
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
): Promise<NxMigrationsConfiguration> {
  const result = await packageRegistryView(
    packageName,
    packageVersion,
    'nx-migrations ng-update --json'
  );

  if (!result) {
    return null;
  }

  return readNxMigrateConfig(JSON.parse(result));
}

async function downloadPackageMigrationsFromRegistry(
  packageName: string,
  packageVersion: string,
  { migrations: migrationsFilePath, packageGroup }: NxMigrationsConfiguration
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
    const pmc = getPackageManagerCommand();

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
}

function readPackageMigrationConfig(
  packageName: string,
  dir: string
): PackageMigrationConfig {
  const { path: packageJsonPath, packageJson: json } = readModulePackageJson(
    packageName,
    [dir]
  );

  const migrationConfigOrFile = json['nx-migrations'] || json['ng-update'];

  if (!migrationConfigOrFile) {
    return { packageJson: json, migrations: null, packageGroup: [] };
  }

  const migrationsConfig =
    typeof migrationConfigOrFile === 'string'
      ? {
          migrations: migrationConfigOrFile,
          packageGroup: [],
        }
      : migrationConfigOrFile;

  try {
    const migrationFile = require.resolve(migrationsConfig.migrations, {
      paths: [dirname(packageJsonPath)],
    });

    return {
      packageJson: json,
      migrations: migrationFile,
      packageGroup: migrationsConfig.packageGroup,
    };
  } catch {
    return {
      packageJson: json,
      migrations: null,
      packageGroup: migrationsConfig.packageGroup,
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
  updatedPackages: Record<string, PackageJsonUpdateForPackage>
) {
  const packageJsonPath = join(root, 'package.json');
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
    packageJson?.devDependencies?.['@nrwl/workspace'] ??
    packageJson?.dependencies?.['@nrwl/workspace']
  );
}

async function generateMigrationsJsonAndUpdatePackageJson(
  root: string,
  opts: {
    targetPackage: string;
    targetVersion: string;
    from: { [p: string]: string };
    to: { [p: string]: string };
  }
) {
  const pmc = getPackageManagerCommand();
  try {
    let originalPackageJson = readJsonFile<PackageJson>(
      join(root, 'package.json')
    );

    try {
      if (
        ['nx', '@nrwl/workspace'].includes(opts.targetPackage) &&
        (await isMigratingToNewMajor(
          readNxVersion(originalPackageJson),
          opts.targetVersion
        ))
      ) {
        await connectToNxCloudCommand(
          'We noticed you are migrating to a new major version, but are not taking advantage of Nx Cloud. Nx Cloud can make your CI up to 10 times faster. Learn more about it here: nx.app. Would you like to add it?'
        );
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
      versions: versions(root, opts.from),
      fetch: createFetcher(),
      to: opts.to,
    });

    const { migrations, packageJson } = await migrator.updatePackageJson(
      opts.targetPackage,
      opts.targetVersion
    );

    updatePackageJson(root, packageJson);

    if (migrations.length > 0) {
      createMigrationsFile(root, migrations);
    }

    logger.info(`NX The migrate command has run successfully.`);
    logger.info(`- package.json has been updated`);
    if (migrations.length > 0) {
      logger.info(`- migrations.json has been generated`);
    } else {
      logger.info(
        `- there are no migrations to run, so migrations.json has not been created.`
      );
    }
    logger.info(`NX Next steps:`);
    logger.info(
      `- Make sure package.json changes make sense and then run '${pmc.install}'`
    );
    if (migrations.length > 0) {
      logger.info(`- Run '${pmc.exec} nx migrate --run-migrations'`);
    }
    logger.info(`- To learn more go to https://nx.dev/using-nx/updating-nx`);

    if (showConnectToCloudMessage()) {
      const cmd = pmc.run('nx', 'connect-to-nx-cloud');
      logger.info(
        `- You may run '${cmd}' to get faster builds, GitHub integration, and more. Check out https://nx.app`
      );
    }
  } catch (e) {
    logger.error(`NX The migrate command failed.`);
    throw e;
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
  logger.info(
    `NX Running '${pmCommands.install}' to make sure necessary packages are installed`
  );
  execSync(pmCommands.install, { stdio: [0, 1, 2] });
}

const NO_CHANGES = 'NO_CHANGES';

async function runMigrations(
  root: string,
  opts: { runMigrations: string },
  isVerbose: boolean,
  shouldCreateCommits = false,
  commitPrefix: string
) {
  if (!process.env.NX_MIGRATE_SKIP_INSTALL) {
    runInstall();
  }

  logger.info(
    `NX Running migrations from '${opts.runMigrations}'` +
      (shouldCreateCommits ? ', with each applied in a dedicated commit' : '')
  );

  const depsBeforeMigrations = getStringifiedPackageJsonDeps(root);

  const migrations: {
    package: string;
    name: string;
    version: string;
    cli?: 'nx' | 'angular';
  }[] = readJsonFile(join(root, opts.runMigrations)).migrations;

  for (const m of migrations) {
    logger.info(`Running migration ${m.name}`);
    if (m.cli === 'nx') {
      await runNxMigration(root, m.package, m.name);
    } else {
      await (
        await import('../adapter/ngcli-adapter')
      ).runMigration(root, m.package, m.name, isVerbose);
    }

    logger.info(`Successfully finished ${m.name}`);

    if (shouldCreateCommits) {
      const commitMessage = `${commitPrefix}${m.name}`;
      const { sha: committedSha, reasonForNoCommit } =
        commitChangesIfAny(commitMessage);

      if (committedSha) {
        logger.info(chalk.dim(`- Commit created for changes: ${committedSha}`));
      } else {
        switch (true) {
          // Isolate the NO_CHANGES case so that we can render it differently to errors
          case reasonForNoCommit === NO_CHANGES:
            logger.info(chalk.dim(`- There were no changes to commit`));
            break;
          case typeof reasonForNoCommit === 'string': // Any other string is a specific error we captured
            logger.info(chalk.red(`- ${reasonForNoCommit}`));
            break;
          default:
            logger.info(
              chalk.red(
                `- A commit could not be created/retrieved for an unknown reason`
              )
            );
        }
      }
    }
    logger.info(`---------------------------------------------------------`);
  }

  const depsAfterMigrations = getStringifiedPackageJsonDeps(root);
  if (depsBeforeMigrations !== depsAfterMigrations) {
    runInstall();
  }

  logger.info(
    `NX Successfully finished running migrations from '${opts.runMigrations}'`
  );
}

function getStringifiedPackageJsonDeps(root: string): string {
  const { dependencies, devDependencies } = readJsonFile<PackageJson>(
    join(root, 'package.json')
  );

  return JSON.stringify([dependencies, devDependencies]);
}

function commitChangesIfAny(commitMessage: string): {
  sha: string | null;
  reasonForNoCommit: string | null;
} {
  try {
    if (
      execSync('git ls-files -m -d -o --exclude-standard').toString() === ''
    ) {
      return {
        sha: null,
        reasonForNoCommit: NO_CHANGES,
      };
    }
  } catch (err) {
    return {
      sha: null,
      reasonForNoCommit: `Error determining git changes:\n${err.stderr}`,
    };
  }

  try {
    execSync('git add -A', { encoding: 'utf8', stdio: 'pipe' });
    execSync('git commit --no-verify -F -', {
      encoding: 'utf8',
      stdio: 'pipe',
      input: commitMessage,
    });
  } catch (err) {
    return {
      sha: null,
      reasonForNoCommit: `Error committing changes:\n${err.stderr}`,
    };
  }

  return {
    sha: getLatestCommitSha(),
    reasonForNoCommit: null,
  };
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

async function runNxMigration(root: string, packageName: string, name: string) {
  const collectionPath = readPackageMigrationConfig(
    packageName,
    root
  ).migrations;

  const collection = readJsonFile<MigrationsJson>(collectionPath);
  const g = collection.generators || collection.schematics;
  if (!g[name]) {
    const source = collection.generators ? 'generators' : 'schematics';
    throw new Error(
      `Unable to determine implementation path for "${collectionPath}:${name}" using collection.${source}`
    );
  }
  const implRelativePath = g[name].implementation || g[name].factory;

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

  const fn = require(implPath).default;
  const host = new FsTree(root, false);
  await fn(host, {});
  const changes = host.listChanges();
  flushChanges(root, changes);
}

export async function migrate(root: string, args: { [k: string]: any }) {
  return handleErrors(args['verbose'], async () => {
    const opts = parseMigrationsOptions(args);
    if (opts.type === 'generateMigrations') {
      await generateMigrationsJsonAndUpdatePackageJson(root, opts);
    } else {
      await runMigrations(
        root,
        opts,
        args['verbose'],
        args['createCommits'],
        args['commitPrefix']
      );
    }
  });
}
