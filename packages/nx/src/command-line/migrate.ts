import { execSync } from 'child_process';
import { copyFileSync, removeSync } from 'fs-extra';
import { dirname, join } from 'path';
import { gt, lte } from 'semver';
import { dirSync } from 'tmp';
import { NxJsonConfiguration } from '../config/nx-json';
import { flushChanges, FsTree } from '../config/tree';
import {
  extractFileFromTarball,
  JsonReadOptions,
  readJsonFile,
  writeJsonFile,
} from '../utils/fileutils';
import { logger } from '../utils/logger';
import {
  checkForNPMRC,
  detectPackageManager,
  getPackageManagerCommand,
  resolvePackageVersionUsingRegistry,
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
}

export interface MigrationsJson {
  version: string;
  collection?: string;
  generators?: { [name: string]: GeneratorMigration };
  packageJsonUpdates?: PackageJsonUpdates;
}

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

function slash(packageName: string): string {
  return packageName.replace(/\\/g, '/');
}

export interface MigratorOptions {
  packageJson: any;
  versions: (pkg: string) => string;
  fetch: (pkg: string, version: string) => Promise<MigrationsJson>;
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

        const target = versions[packageName];
        const migrationsJson = await this.fetch(packageName, target.version);
        const generators = migrationsJson.generators;

        if (!generators) return [];
        return Object.entries(generators)
          .filter(
            ([_, migration]) =>
              migration.version &&
              this.gt(migration.version, currentVersion) &&
              this.lte(migration.version, target.version)
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

    let migrationsJson: MigrationsJson;
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
        .filter(([packageName]) => {
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
    m: MigrationsJson | null
  ): Record<string, PackageJsonUpdateForPackage> {
    // this should be used to know what version to include
    // we should use from everywhere we use versions

    if (packageName === '@nrwl/workspace') {
      if (!m.packageJsonUpdates) m.packageJsonUpdates = {};
      m.packageJsonUpdates[`${targetVersion}-defaultPackages`] = {
        version: targetVersion,
        packages: [
          'nx',
          '@nrwl/angular',
          '@nrwl/cypress',
          '@nrwl/devkit',
          '@nrwl/eslint-plugin-nx',
          '@nrwl/express',
          '@nrwl/jest',
          '@nrwl/js',
          '@nrwl/cli',
          '@nrwl/linter',
          '@nrwl/nest',
          '@nrwl/next',
          '@nrwl/node',
          '@nrwl/nx-cloud',
          '@nrwl/nx-plugin',
          '@nrwl/react',
          '@nrwl/storybook',
          '@nrwl/web',
          '@nrwl/react-native',
          '@nrwl/detox',
        ].reduce(
          (m, c) => ({
            ...m,
            [c]: {
              version: c === '@nrwl/nx-cloud' ? 'latest' : targetVersion,
              alwaysAddToPackageJson: false,
            },
          }),
          {}
        ),
      };
    }
    if (!m.packageJsonUpdates || !this.versions(packageName)) return {};

    return Object.keys(m.packageJsonUpdates)
      .filter((r) => {
        return (
          this.gt(
            m.packageJsonUpdates[r].version,
            this.versions(packageName)
          ) && this.lte(m.packageJsonUpdates[r].version, targetVersion)
        );
      })
      .map((r) => m.packageJsonUpdates[r].packages)
      .map((packages) => {
        if (!packages) return {};

        return Object.entries(packages)
          .filter(([packageName, packageUpdate]) => {
            const { dependencies, devDependencies } = this.packageJson;

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
    res[slash(selectedPackage)] = normalizeVersionWithTagCheck(selectedVersion);
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
      targetPackage: slash(targetPackage),
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

function versions(root: string, from: { [p: string]: string }) {
  return (packageName: string) => {
    try {
      if (from[packageName]) {
        return from[packageName];
      }
      const packageJsonPath = require.resolve(`${packageName}/package.json`, {
        paths: [root],
      });
      return readJsonFile(packageJsonPath).version;
    } catch {
      return null;
    }
  };
}

// testing-fetch-start
function createFetcher() {
  const cache = {};

  return async function nxMigrateFetcher(
    packageName: string,
    packageVersion: string
  ): Promise<MigrationsJson> {
    if (cache[`${packageName}-${packageVersion}`]) {
      return cache[`${packageName}-${packageVersion}`];
    }

    let resolvedVersion: string;
    let migrations: any;

    try {
      resolvedVersion = resolvePackageVersionUsingRegistry(
        packageName,
        packageVersion
      );

      if (cache[`${packageName}-${resolvedVersion}`]) {
        return cache[`${packageName}-${resolvedVersion}`];
      }

      logger.info(`Fetching ${packageName}@${packageVersion}`);
      migrations = await getPackageMigrations(packageName, resolvedVersion);
    } catch {
      logger.info(`Fetching ${packageName}@${packageVersion}`);
      const result = await installPackageAndGetVersionAngMigrations(
        packageName,
        packageVersion
      );
      resolvedVersion = result.resolvedVersion;
      migrations = result.migrations;
    }

    if (migrations) {
      cache[`${packageName}-${packageVersion}`] = cache[
        `${packageName}-${resolvedVersion}`
      ] = {
        version: resolvedVersion,
        generators: migrations.generators ?? migrations.schematics,
        packageJsonUpdates: migrations.packageJsonUpdates,
      };
    } else {
      cache[`${packageName}-${packageVersion}`] = cache[
        `${packageName}-${resolvedVersion}`
      ] = {
        version: resolvedVersion,
      };
    }

    return cache[`${packageName}-${packageVersion}`];
  };
}
// testing-fetch-end

async function getPackageMigrations(
  packageName: string,
  packageVersion: string
) {
  try {
    // check if there are migrations in the packages by looking at the
    // registry directly
    const migrationsPath = getPackageMigrationsPathFromRegistry(
      packageName,
      packageVersion
    );
    if (!migrationsPath) {
      return null;
    }

    // try to obtain the migrations from the registry directly
    return await getPackageMigrationsUsingRegistry(
      packageName,
      packageVersion,
      migrationsPath
    );
  } catch {
    // fall back to installing the package
    const { migrations } = await installPackageAndGetVersionAngMigrations(
      packageName,
      packageVersion
    );
    return migrations;
  }
}

function getPackageMigrationsPathFromRegistry(
  packageName: string,
  packageVersion: string
): string | null {
  let pm = detectPackageManager();
  if (pm === 'yarn') {
    pm = 'npm';
  }
  const result = execSync(
    `${pm} view ${packageName}@${packageVersion} nx-migrations ng-update --json`,
    {
      stdio: [],
    }
  )
    .toString()
    .trim();

  if (!result) {
    return null;
  }

  const json = JSON.parse(result);
  let migrationsFilePath = json['nx-migrations'] ?? json['ng-update'] ?? json;
  if (typeof json === 'object') {
    migrationsFilePath = migrationsFilePath.migrations;
  }

  return migrationsFilePath;
}

async function getPackageMigrationsUsingRegistry(
  packageName: string,
  packageVersion: string,
  migrationsFilePath: string
) {
  const dir = dirSync().name;
  createNPMRC(dir);

  let pm = detectPackageManager();
  if (pm === 'yarn') {
    pm = 'npm';
  }

  const tarballPath = execSync(`${pm} pack ${packageName}@${packageVersion}`, {
    cwd: dir,
    stdio: [],
  })
    .toString()
    .trim();

  let migrations = null;
  migrationsFilePath = join('package', migrationsFilePath);
  const migrationDestinationPath = join(dir, migrationsFilePath);
  try {
    await extractFileFromTarball(
      join(dir, tarballPath),
      migrationsFilePath,
      migrationDestinationPath
    );

    migrations = readJsonFile(migrationDestinationPath);
  } catch {
    throw new Error(
      `Failed to find migrations file "${migrationsFilePath}" in package "${packageName}@${packageVersion}".`
    );
  }

  try {
    removeSync(dir);
  } catch {
    // It's okay if this fails, the OS will clean it up eventually
  }

  return migrations;
}

async function installPackageAndGetVersionAngMigrations(
  packageName: string,
  packageVersion: string
) {
  const dir = dirSync().name;
  createNPMRC(dir);

  const pmc = getPackageManagerCommand();
  execSync(`${pmc.add} ${packageName}@${packageVersion}`, {
    stdio: [],
    cwd: dir,
  });

  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [dir],
  });
  const { version: resolvedVersion } = readJsonFile(packageJsonPath);

  const migrationsFilePath = packageToMigrationsFilePath(packageName, dir);
  let migrations = null;
  if (migrationsFilePath) {
    migrations = readJsonFile(migrationsFilePath);
  }

  try {
    removeSync(dir);
  } catch {
    // It's okay if this fails, the OS will clean it up eventually
  }

  return { migrations, resolvedVersion };
}

function createNPMRC(dir: string): void {
  // A package.json is needed for pnpm pack and for .npmrc to resolve
  writeJsonFile(`${dir}/package.json`, {});
  const npmrc = checkForNPMRC();
  if (npmrc) {
    // Copy npmrc if it exists, so that npm still follows it.
    copyFileSync(npmrc, `${dir}/.npmrc`);
  }
}

function packageToMigrationsFilePath(packageName: string, dir: string) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [dir],
  });
  const json = readJsonFile(packageJsonPath);
  let migrationsFile = json['nx-migrations'] || json['ng-update'];

  // migrationsFile is an object
  if (migrationsFile && migrationsFile.migrations) {
    migrationsFile = migrationsFile.migrations;
  }
  try {
    if (migrationsFile && typeof migrationsFile === 'string') {
      return require.resolve(migrationsFile, {
        paths: [dirname(packageJsonPath)],
      });
    } else {
      return null;
    }
  } catch {
    return null;
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
      logger.info(
        `- You may run '${pmc.run(
          'nx',
          'connect-to-nx-cloud'
        )}' to get faster builds, GitHub integration, and more. Check out https://nx.app`
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

  for (let m of migrations) {
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
  const collectionPath = packageToMigrationsFilePath(packageName, root);
  const collection = readJsonFile(collectionPath);
  const g = collection.generators || collection.schematics;
  const implRelativePath = g[name].implementation || g[name].factory;

  let implPath;

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
