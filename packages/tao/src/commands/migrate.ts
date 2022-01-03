import { execSync } from 'child_process';
import { removeSync, copyFileSync, existsSync } from 'fs-extra';
import * as yargsParser from 'yargs-parser';
import { dirname, join } from 'path';
import { gt, lte } from 'semver';
import { dirSync } from 'tmp';
import { logger } from '../shared/logger';
import { convertToCamelCase, handleErrors } from '../shared/params';
import { getPackageManagerCommand } from '../shared/package-manager';
import { flushChanges, FsTree } from '../shared/tree';
import {
  JsonReadOptions,
  readJsonFile,
  writeJsonFile,
} from '../utils/fileutils';
import { NxJsonConfiguration } from '../shared/nx';

type Dependencies = 'dependencies' | 'devDependencies';

export type MigrationsJson = {
  version: string;
  collection?: string;
  generators?: {
    [name: string]: { version: string; description?: string; cli?: string };
  };
  packageJsonUpdates?: {
    [name: string]: {
      version: string;
      packages: {
        [p: string]: {
          version: string;
          ifPackageInstalled?: string;
          alwaysAddToPackageJson?: boolean;
          addToPackageJson?: Dependencies;
        };
      };
    };
  };
};

export function normalizeVersion(version: string) {
  const [v, t] = version.split('-');
  const [major, minor, patch] = v.split('.');
  const newV = `${major || 0}.${minor || 0}.${patch || 0}`;
  const newVersion = t ? `${newV}-${t}` : newV;

  try {
    gt(newVersion, '0.0.0');
    return newVersion;
  } catch (e) {
    try {
      gt(newV, '0.0.0');
      return newV;
    } catch (e) {
      const withoutPatch = `${major || 0}.${minor || 0}.0`;
      try {
        if (gt(withoutPatch, '0.0.0')) {
          return withoutPatch;
        }
      } catch (e) {
        const withoutPatchAndMinor = `${major || 0}.0.0`;
        try {
          if (gt(withoutPatchAndMinor, '0.0.0')) {
            return withoutPatchAndMinor;
          }
        } catch (e) {
          return '0.0.0';
        }
      }
    }
  }
}

function slash(packageName) {
  return packageName.replace(/\\/g, '/');
}

export class Migrator {
  private readonly packageJson: any;
  private readonly versions: (p: string) => string;
  private readonly fetch: (p: string, v: string) => Promise<MigrationsJson>;
  private readonly from: { [p: string]: string };
  private readonly to: { [p: string]: string };

  constructor(opts: {
    packageJson: any;
    versions: (p: string) => string;
    fetch: (p: string, v: string) => Promise<MigrationsJson>;
    from: { [p: string]: string };
    to: { [p: string]: string };
  }) {
    this.packageJson = opts.packageJson;
    this.versions = opts.versions;
    this.fetch = opts.fetch;
    this.from = opts.from;
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

  private async _createMigrateJson(versions: {
    [k: string]: { version: string; addToPackageJson: Dependencies | false };
  }) {
    const migrations = await Promise.all(
      Object.keys(versions).map(async (c) => {
        const currentVersion = this.versions(c);
        if (currentVersion === null) return [];

        const target = versions[c];
        const migrationsJson = await this.fetch(c, target.version);
        const generators = migrationsJson.generators;
        if (!generators) return [];
        return Object.keys(generators)
          .filter(
            (r) =>
              generators[r].version &&
              this.gt(generators[r].version, currentVersion) &&
              this.lte(generators[r].version, target.version)
          )
          .map((r) => ({
            ...migrationsJson.generators[r],
            package: c,
            name: r,
          }));
      })
    );

    return migrations.reduce((m, c) => [...m, ...c], []);
  }

  private async _updatePackageJson(
    targetPackage: string,
    target: { version: string; addToPackageJson: Dependencies | false },
    collectedVersions: {
      [k: string]: { version: string; addToPackageJson: Dependencies | false };
    }
  ) {
    let targetVersion = target.version;
    if (this.to[targetPackage]) {
      targetVersion = this.to[targetPackage];
    }

    if (!this.versions(targetPackage)) {
      return {
        [targetPackage]: {
          version: target.version,
          addToPackageJson: target.addToPackageJson || false,
        },
      };
    }

    let migrationsJson;
    try {
      migrationsJson = await this.fetch(targetPackage, targetVersion);
      targetVersion = migrationsJson.version;
    } catch (e) {
      if (e.message.indexOf('No matching version') > -1) {
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

    const childCalls = await Promise.all(
      Object.keys(packages)
        .filter((r) => {
          return (
            !collectedVersions[r] ||
            this.gt(packages[r].version, collectedVersions[r].version)
          );
        })
        .map((u) =>
          this._updatePackageJson(u, packages[u], {
            ...collectedVersions,
            [targetPackage]: target,
          })
        )
    );
    return childCalls.reduce(
      (m, c) => {
        Object.keys(c).forEach((r) => {
          if (!m[r] || this.gt(c[r].version, m[r].version)) {
            m[r] = c[r];
          }
        });
        return m;
      },
      {
        [targetPackage]: {
          version: migrationsJson.version,
          addToPackageJson: target.addToPackageJson || false,
        },
      }
    );
  }

  private collapsePackages(
    packageName: string,
    targetVersion: string,
    m: MigrationsJson | null
  ) {
    // this should be used to know what version to include
    // we should use from everywhere we use versions

    if (packageName === '@nrwl/workspace') {
      if (!m.packageJsonUpdates) m.packageJsonUpdates = {};
      m.packageJsonUpdates[`${targetVersion}-defaultPackages`] = {
        version: targetVersion,
        packages: [
          '@nrwl/angular',
          '@nrwl/cli',
          '@nrwl/cypress',
          '@nrwl/devkit',
          '@nrwl/eslint-plugin-nx',
          '@nrwl/express',
          '@nrwl/gatsby',
          '@nrwl/jest',
          '@nrwl/js',
          '@nrwl/linter',
          '@nrwl/nest',
          '@nrwl/next',
          '@nrwl/node',
          '@nrwl/nx-cloud',
          '@nrwl/nx-plugin',
          '@nrwl/react',
          '@nrwl/storybook',
          '@nrwl/tao',
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

        return Object.keys(packages)
          .filter((pkg) => {
            const { dependencies, devDependencies } = this.packageJson;

            return (
              (!packages[pkg].ifPackageInstalled ||
                this.versions(packages[pkg].ifPackageInstalled)) &&
              (packages[pkg].alwaysAddToPackageJson ||
                packages[pkg].addToPackageJson ||
                !!dependencies?.[pkg] ||
                !!devDependencies?.[pkg])
            );
          })
          .reduce(
            (m, c) => ({
              ...m,
              [c]: {
                version: packages[c].version,
                addToPackageJson: packages[c].alwaysAddToPackageJson
                  ? 'dependencies'
                  : packages[c].addToPackageJson || false,
              },
            }),
            {}
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
    if (args.match(/[0-9]/) || args === 'latest' || args === 'next') {
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

export function parseMigrationsOptions(
  args: string[]
): GenerateMigrations | RunMigrations {
  const options = convertToCamelCase(
    yargsParser(args, {
      string: ['runMigrations', 'from', 'to'],
      alias: {
        runMigrations: 'run-migrations',
      },
    })
  );

  if (options.runMigrations === '') {
    options.runMigrations = 'migrations.json';
  }

  if (!options.runMigrations) {
    const from = options.from
      ? versionOverrides(options.from as string, 'from')
      : {};
    const to = options.to ? versionOverrides(options.to as string, 'to') : {};
    const { targetPackage, targetVersion } = parseTargetPackageAndVersion(
      args[0]
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
  return async function f(
    packageName: string,
    packageVersion: string
  ): Promise<MigrationsJson> {
    if (!cache[`${packageName}-${packageVersion}`]) {
      const dir = dirSync().name;
      const npmrc = checkForNPMRC();
      if (npmrc) {
        // Creating a package.json is needed for .npmrc to resolve
        writeJsonFile(`${dir}/package.json`, {});
        // Copy npmrc if it exists, so that npm still follows it.
        copyFileSync(npmrc, `${dir}/.npmrc`);
      }

      logger.info(`Fetching ${packageName}@${packageVersion}`);
      const pmc = getPackageManagerCommand();
      execSync(`${pmc.add} ${packageName}@${packageVersion}`, {
        stdio: [],
        cwd: dir,
      });

      const migrationsFilePath = packageToMigrationsFilePath(packageName, dir);
      const packageJsonPath = require.resolve(`${packageName}/package.json`, {
        paths: [dir],
      });
      const json = readJsonFile(packageJsonPath);
      // packageVersion can be a tag, resolvedVersion works with semver
      const resolvedVersion = json.version;

      if (migrationsFilePath) {
        const json = readJsonFile(migrationsFilePath);
        cache[`${packageName}-${packageVersion}`] = {
          version: resolvedVersion,
          generators: json.generators || json.schematics,
          packageJsonUpdates: json.packageJsonUpdates,
        };
      } else {
        cache[`${packageName}-${packageVersion}`] = {
          version: resolvedVersion,
        };
      }

      try {
        removeSync(dir);
      } catch {
        // It's okay if this fails, the OS will clean it up eventually
      }
    }
    return cache[`${packageName}-${packageVersion}`];
  };
}

// testing-fetch-end

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
  updatedPackages: {
    [p: string]: { version: string; addToPackageJson: Dependencies | false };
  }
) {
  const packageJsonPath = join(root, 'package.json');
  const parseOptions: JsonReadOptions = {};
  const json = readJsonFile(packageJsonPath, parseOptions);
  Object.keys(updatedPackages).forEach((p) => {
    if (json.devDependencies && json.devDependencies[p]) {
      json.devDependencies[p] = updatedPackages[p].version;
    } else if (json.dependencies && json.dependencies[p]) {
      json.dependencies[p] = updatedPackages[p].version;
    } else if (updatedPackages[p].addToPackageJson) {
      if (updatedPackages[p].addToPackageJson === 'dependencies') {
        if (!json.dependencies) json.dependencies = {};
        json.dependencies[p] = updatedPackages[p].version;
      } else if (updatedPackages[p].addToPackageJson === 'devDependencies') {
        if (!json.devDependencies) json.devDependencies = {};
        json.devDependencies[p] = updatedPackages[p].version;
      }
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
      from: opts.from,
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
      logger.info(`- Run 'nx migrate --run-migrations'`);
    }
    logger.info(
      `- To learn more go to https://nx.dev/core-concepts/updating-nx`
    );

    if (showConnectToCloudMessage()) {
      logger.info(
        `- You may run "nx connect-to-nx-cloud" to get faster builds, GitHub integration, and more. Check out https://nx.app`
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
      (r: any) => r.runner == '@nrwl/workspace/tasks-runners/default'
    );
    return !!defaultRunnerIsUsed;
  } catch {
    return false;
  }
}

function installAngularDevkitIfNecessaryToExecuteLegacyMigrations(
  migrations: { cli?: 'nx' | 'angular' }[]
) {
  const hasAngularDevkitMigrations = migrations.find(
    (m) => m.cli === undefined || m.cli === 'angular'
  );
  if (!hasAngularDevkitMigrations) return false;

  const pmCommands = getPackageManagerCommand();
  const devkitInstalled =
    execSync(`${pmCommands.list} @angular-devkit/schematics`)
      .toString()
      .indexOf(`@angular-devkit/schematics`) > -1;

  if (devkitInstalled) return false;

  logger.info(
    `NX Temporary installing necessary packages to run old migrations.`
  );
  logger.info(`The packages will be deleted once migrations run successfully.`);

  execSync(`${pmCommands.add} @angular-devkit/core`);
  execSync(`${pmCommands.add} @angular-devkit/schematics`);
  return true;
}

function removeAngularDevkitMigrations() {
  const pmCommands = getPackageManagerCommand();
  execSync(`${pmCommands.rm} @angular-devkit/schematics`);
  execSync(`${pmCommands.rm} @angular-devkit/core`);
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

  // TODO: reenable after removing devkit
  // const installed = installAngularDevkitIfNecessaryToExecuteLegacyMigrations(
  //   migrations
  // );
  try {
    for (let m of migrations) {
      logger.info(`Running migration ${m.name}`);
      if (m.cli === 'nx') {
        await runNxMigration(root, m.package, m.name);
      } else {
        await (
          await import('./ngcli-adapter')
        ).runMigration(root, m.package, m.name, isVerbose);
      }
      logger.info(`Successfully finished ${m.name}`);
      logger.info(`---------------------------------------------------------`);
    }

    logger.info(
      `NX Successfully finished running migrations from '${opts.runMigrations}'`
    );
  } finally {
    // if (installed) {
    //   removeAngularDevkitMigrations();
    // }
  }
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

export async function migrate(root: string, args: string[], isVerbose = false) {
  return handleErrors(isVerbose, async () => {
    const opts = parseMigrationsOptions(args);
    if (opts.type === 'generateMigrations') {
      await generateMigrationsJsonAndUpdatePackageJson(root, opts);
    } else {
      await runMigrations(root, opts, isVerbose);
    }
  });
}

/**
 * Checks for a project level npmrc file by crawling up the file tree until
 * hitting a package.json file, as this is how npm finds them as well.
 */
function checkForNPMRC(): string | null {
  let directory = process.cwd();
  while (!existsSync(join(directory, 'package.json'))) {
    directory = dirname(directory);
  }
  const path = join(directory, '.npmrc');
  return existsSync(path) ? path : null;
}
