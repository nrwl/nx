import { exec, execSync } from 'child_process';
import { dirname, join } from 'path';
import { gt, lte, parse as parseSemver } from 'semver';
import { promisify } from 'util';
import { NxJsonConfiguration } from '../config/nx-json';
import { flushChanges, FsTree } from '../config/tree';
import {
  extractFileFromTarball,
  JsonReadOptions,
  readJsonFile,
  writeJsonFile,
} from '../utils/fileutils';
import { logger } from '../utils/logger';
import { NxMigrationsConfiguration, PackageJson } from '../utils/package-json';
import {
  getPackageManagerCommand,
  resolvePackageVersionUsingRegistry,
  withTempNpmDirectory,
} from '../utils/package-manager';
import { handleErrors } from '../utils/params';

export type Dependencies = 'dependencies' | 'devDependencies';

export interface PackageJsonUpdateForPackage {
  version: string;
  ifPackageInstalled?: string;
  alwaysAddToPackageJson?: boolean | Dependencies;
  addToPackageJson?: boolean | Dependencies;
}

export type PackageJsonUpdates = {
  [name: string]: {
    version: string;
    packages: {
      [packageName: string]: PackageJsonUpdateForPackage;
    };
  };
};

export interface GeneratorMigration {
  version: string;
  description?: string;
  cli?: string;
  implementation?: string;
  factory?: string;
}

export interface MigrationsJson {
  version: string;
  collection?: string;
  generators?: { [name: string]: GeneratorMigration };
  schematics?: { [name: string]: GeneratorMigration };
  packageJsonUpdates?: PackageJsonUpdates;
}

export interface ResolvedMigrationConfiguration extends MigrationsJson {
  packageGroup?: NxMigrationsConfiguration['packageGroup'];
}

const execAsync = promisify(exec);

export function normalizeVersion(version: string) {
  const {
    major,
    minor,
    patch,
    prerelease: [prereleaseTag],
  } = parseSemver(version);

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
  packageJson: any;
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
    const packageJson = await this._updatePackageJson(
      targetPackage,
      { version: targetVersion, addToPackageJson: false },
      {}
    );

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

  private async _updatePackageJson(
    targetPackage: string,
    target: PackageJsonUpdateForPackage,
    collectedVersions: Record<string, PackageJsonUpdateForPackage>
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
        .filter((packageName) => {
          return (
            !collectedVersions[packageName] ||
            this.gt(
              packages[packageName].version,
              collectedVersions[packageName].version
            )
          );
        })
        .map((packageName) =>
          this._updatePackageJson(packageName, packages[packageName], {
            ...collectedVersions,
            [targetPackage]: target,
          })
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

    if (migration.packageGroup) {
      migration.packageJsonUpdates ??= {};
      migration.packageJsonUpdates[`${targetVersion}-defaultPackages`] = {
        version: targetVersion,
        packages: migration.packageGroup.reduce((acc, packageConfig) => {
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
      `Provide the correct package name and version. E.g., @nrwl/workspace@9.0.0.`
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
          `Provide the correct package name and version. E.g., @nrwl/workspace@9.0.0.`
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
      return {
        targetPackage: '@nrwl/workspace',
        targetVersion: normalizeVersionWithTagCheck(args),
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

  return (packageName: string) => {
    try {
      if (from[packageName]) {
        return from[packageName];
      }

      if (!cache[packageName]) {
        const packageJsonPath = require.resolve(`${packageName}/package.json`, {
          paths: [root],
        });
        cache[packageName] = readJsonFile(packageJsonPath).version;
      }

      return cache[packageName];
    } catch {
      return null;
    }
  };
}

// testing-fetch-start
function createFetcher() {
  const cache: Record<string, ResolvedMigrationConfiguration> = {};

  return async function nxMigrateFetcher(
    packageName: string,
    packageVersion: string
  ): Promise<ResolvedMigrationConfiguration> {
    if (cache[`${packageName}-${packageVersion}`]) {
      return cache[`${packageName}-${packageVersion}`];
    }

    let resolvedVersion: string = packageVersion;
    let resolvedMigrationConfiguration: ResolvedMigrationConfiguration;

    try {
      resolvedVersion = await resolvePackageVersionUsingRegistry(
        packageName,
        packageVersion
      );

      if (cache[`${packageName}-${resolvedVersion}`]) {
        return cache[`${packageName}-${resolvedVersion}`];
      }

      logger.info(`Fetching ${packageName}@${packageVersion}`);

      resolvedMigrationConfiguration = await getPackageMigrationsUsingRegistry(
        packageName,
        resolvedVersion
      );
    } catch {
      logger.info(`Fetching ${packageName}@${packageVersion}`);

      resolvedMigrationConfiguration = await getPackageMigrationsUsingInstall(
        packageName,
        packageVersion
      );

      resolvedVersion = resolvedMigrationConfiguration.version;
    }

    resolvedMigrationConfiguration = {
      ...resolvedMigrationConfiguration,
      generators:
        resolvedMigrationConfiguration.generators ??
        resolvedMigrationConfiguration.schematics,
    };

    cache[`${packageName}-${packageVersion}`] = cache[
      `${packageName}-${resolvedVersion}`
    ] = resolvedMigrationConfiguration;

    return resolvedMigrationConfiguration;
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

  if (!migrationsConfig.migrations) {
    return {
      version: packageVersion,
      packageGroup: migrationsConfig.packageGroup,
    };
  }

  // try to obtain the migrations from the registry directly
  return await downloadPackageMigrationsFromRegistry(
    packageName,
    packageVersion,
    migrationsConfig
  );
}

function resolveNxMigrationConfig(json: Partial<PackageJson>) {
  const parseNxMigrationsConfig = (
    fromJson: string | NxMigrationsConfiguration
  ): NxMigrationsConfiguration => {
    if (typeof fromJson === 'string') {
      return { migrations: fromJson, packageGroup: [] };
    }

    return {
      ...(fromJson.migrations ? { migrations: fromJson.migrations } : {}),
      ...(fromJson.packageGroup ? { packageGroup: fromJson.packageGroup } : {}),
    };
  };

  const config: NxMigrationsConfiguration = {
    ...parseNxMigrationsConfig(json['ng-update']),
    ...parseNxMigrationsConfig(json['nx-migrations']),
    // In case there's a `migrations` field in `package.json`
    ...parseNxMigrationsConfig(json as any),
  };

  return config;
}

async function getPackageMigrationsConfigFromRegistry(
  packageName: string,
  packageVersion: string
): Promise<NxMigrationsConfiguration> {
  const pmc = getPackageManagerCommand();

  const { stdout } = await execAsync(
    `${pmc.view} ${packageName}@${packageVersion} nx-migrations ng-update --json`
  );

  const result = stdout.toString().trim();

  if (!result) {
    return null;
  }

  return resolveNxMigrationConfig(JSON.parse(result));
}

async function downloadPackageMigrationsFromRegistry(
  packageName: string,
  packageVersion: string,
  { migrations: migrationsFilePath, packageGroup }: NxMigrationsConfiguration
): Promise<ResolvedMigrationConfiguration> {
  return await withTempNpmDirectory(async (dir) => {
    try {
      const pmc = getPackageManagerCommand();

      const { stdout } = await execAsync(
        `${pmc.pack} ${packageName}@${packageVersion}`,
        { cwd: dir }
      );

      const tarballPath = stdout.trim();

      const migrations = await extractFileFromTarball(
        join(dir, tarballPath),
        join('package', migrationsFilePath),
        join(dir, migrationsFilePath)
      ).then((path) => readJsonFile<MigrationsJson>(path));

      return { ...migrations, packageGroup, version: packageVersion };
    } catch {
      throw new Error(
        `Failed to find migrations file "${migrationsFilePath}" in package "${packageName}@${packageVersion}".`
      );
    }
  });
}

async function getPackageMigrationsUsingInstall(
  packageName: string,
  packageVersion: string
): Promise<ResolvedMigrationConfiguration> {
  return await withTempNpmDirectory(async (dir) => {
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

    return { ...migrations, packageGroup, version: packageJson.version };
  });
}

interface PackageMigrationConfig extends NxMigrationsConfiguration {
  packageJson: PackageJson;
}

function readPackageMigrationConfig(
  packageName: string,
  dir: string
): PackageMigrationConfig {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [dir],
  });

  const json = readJsonFile<PackageJson>(packageJsonPath);
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
    logger.info(`Fetching meta data about packages.`);
    logger.info(`It may take a few minutes.`);

    const originalPackageJson = readJsonFile(join(root, 'package.json'));

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
      logger.info(`- Run '${pmc.run('nx', 'migrate --run-migrations')}'`);
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
    const defaultRunnerIsUsed = Object.values(nxJson.tasksRunnerOptions).find(
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

async function runMigrations(
  root: string,
  opts: { runMigrations: string },
  isVerbose: boolean
) {
  if (!process.env.NX_MIGRATE_SKIP_INSTALL) {
    runInstall();
  }

  logger.info(`NX Running migrations from '${opts.runMigrations}'`);

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
    logger.info(`---------------------------------------------------------`);
  }

  logger.info(
    `NX Successfully finished running migrations from '${opts.runMigrations}'`
  );
}

async function runNxMigration(root: string, packageName: string, name: string) {
  const collectionPath = readPackageMigrationConfig(
    packageName,
    root
  ).migrations;

  const collection = readJsonFile<MigrationsJson>(collectionPath);
  const g = collection.generators || collection.schematics;
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
      await runMigrations(root, opts, args['verbose']);
    }
  });
}
