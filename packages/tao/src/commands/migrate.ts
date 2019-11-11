import { logging, normalize, virtualFs } from '@angular-devkit/core';
import * as core from '@angular-devkit/core/node';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { BaseWorkflow } from '@angular-devkit/schematics/src/workflow';
import { NodeModulesEngineHost } from '@angular-devkit/schematics/tools';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { gt, lte } from 'semver';
import * as stripJsonComments from 'strip-json-comments';
import { dirSync } from 'tmp';
import { getLogger } from '../shared/logger';
import { convertToCamelCase, handleErrors } from '../shared/params';
import { commandName } from '../shared/print-help';
import minimist = require('minimist');

export type MigrationsJson = {
  version: string;
  schematics?: { [name: string]: { version: string } };
  packageJsonUpdates?: {
    [name: string]: {
      version: string;
      packages: {
        [p: string]: {
          version: string;
          ifPackageInstalled?: string;
          alwaysAddToPackageJson?: boolean;
        };
      };
    };
  };
};

export class Migrator {
  private readonly versions: (p: string) => string;
  private readonly fetch: (p: string, v: string) => Promise<MigrationsJson>;
  private readonly from: { [p: string]: string };
  private readonly to: { [p: string]: string };

  constructor(opts: {
    versions: (p: string) => string;
    fetch: (p: string, v: string) => Promise<MigrationsJson>;
    from: { [p: string]: string };
    to: { [p: string]: string };
  }) {
    this.versions = opts.versions;
    this.fetch = opts.fetch;
    this.from = opts.from;
    this.to = opts.to;
  }

  async updatePackageJson(targetPackage: string, targetVersion: string) {
    const packageJson = await this._updatePackageJson(
      targetPackage,
      { version: targetVersion, alwaysAddToPackageJson: false },
      {}
    );
    const migrations = await this._createMigrateJson(packageJson);
    return { packageJson, migrations };
  }

  private async _createMigrateJson(versions: {
    [k: string]: { version: string; alwaysAddToPackageJson: boolean };
  }) {
    const migrations = await Promise.all(
      Object.keys(versions).map(async c => {
        const currentVersion = this.versions(c);
        if (currentVersion === null) return [];

        const target = versions[c];
        const migrationsJson = await this.fetch(c, target.version);
        if (!migrationsJson.schematics) return [];
        return Object.keys(migrationsJson.schematics)
          .filter(
            r =>
              gt(migrationsJson.schematics[r].version, currentVersion) &
              lte(migrationsJson.schematics[r].version, target.version)
          )
          .map(r => ({
            ...migrationsJson.schematics[r],
            package: c,
            name: r
          }));
      })
    );

    return migrations.reduce((m, c) => [...m, ...c], []);
  }

  private async _updatePackageJson(
    targetPackage: string,
    target: { version: string; alwaysAddToPackageJson: boolean },
    collectedVersions: {
      [k: string]: { version: string; alwaysAddToPackageJson: boolean };
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
          alwaysAddToPackageJson: !!target.alwaysAddToPackageJson
        }
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
        .filter(r => {
          return (
            !collectedVersions[r] ||
            gt(packages[r].version, collectedVersions[r].version)
          );
        })
        .map(u =>
          this._updatePackageJson(u, packages[u], {
            ...collectedVersions,
            [targetPackage]: target
          })
        )
    );
    return childCalls.reduce(
      (m, c) => {
        Object.keys(c).forEach(r => {
          if (!m[r] || gt(c[r].version, m[r].version)) {
            m[r] = c[r];
          }
        });
        return m;
      },
      {
        [targetPackage]: {
          version: migrationsJson.version,
          alwaysAddToPackageJson: target.alwaysAddToPackageJson || false
        }
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
      m.packageJsonUpdates[targetVersion + '-defaultPackages'] = {
        version: targetVersion,
        packages: [
          '@nrwl/angular',
          '@nrwl/cypress',
          '@nrwl/eslint-plugin-nx',
          '@nrwl/express',
          '@nrwl/jest',
          '@nrwl/linter',
          '@nrwl/nest',
          '@nrwl/next',
          '@nrwl/node',
          '@nrwl/react',
          '@nrwl/storybook',
          '@nrwl/tao',
          '@nrwl/web'
        ].reduce(
          (m, c) => ({
            ...m,
            [c]: { verson: targetVersion, alwaysAddToPackageJson: false }
          }),
          {}
        )
      };
    }
    if (!m.packageJsonUpdates) return {};

    return Object.keys(m.packageJsonUpdates)
      .filter(r => {
        return (
          gt(m.packageJsonUpdates[r].version, this.versions(packageName)) &&
          lte(m.packageJsonUpdates[r].version, targetVersion)
        );
      })
      .map(r => m.packageJsonUpdates[r].packages)
      .map(packages => {
        if (!packages) return {};

        return Object.keys(packages)
          .filter(
            p =>
              !packages[p].ifPackageInstalled ||
              this.versions(packages[p].ifPackageInstalled)
          )
          .reduce(
            (m, c) => ({
              ...m,
              [c]: {
                version: packages[c].version,
                alwaysAddToPackageJson: packages[c].alwaysAddToPackageJson
              }
            }),
            {}
          );
      })
      .reduce((m, c) => ({ ...m, ...c }), {});
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

function parseMigrationsOptions(
  args: string[]
): GenerateMigrations | RunMigrations {
  const options = convertToCamelCase(
    minimist(args, {
      string: ['runMigrations', 'from', 'to'],
      alias: {
        runMigrations: 'run-migrations'
      }
    })
  );
  if (!options.runMigrations) {
    if (!args[0]) {
      throw new Error(
        `Specify the package name (e.g., ${commandName} migrate mypackage@1.2.3)`
      );
    }

    let from = {};
    if (options.from) {
      options.from.split(',').forEach(p => {
        const split = p.lastIndexOf('@');
        from[p.substring(0, split)] = p.substring(split + 1);
      });
    }

    let to = {};
    if (options.to) {
      options.to.split(',').forEach(p => {
        const split = p.lastIndexOf('@');
        to[p.substring(0, split)] = p.substring(split + 1);
      });
    }

    let targetPackage;
    let targetVersion;
    if (args[0].lastIndexOf('@') > 0) {
      const i = args[0].lastIndexOf('@');
      targetPackage = args[0].substring(0, i);
      targetVersion = args[0].substring(i + 1);
    } else {
      targetPackage = args[0];
      targetVersion = 'latest';
    }
    return {
      type: 'generateMigrations',
      targetPackage,
      targetVersion,
      from,
      to
    };
  } else {
    return { type: 'runMigrations', runMigrations: options.runMigrations };
  }
}

function versions(root: string) {
  return (packageName: string) => {
    try {
      const content = readFileSync(
        path.join(root, `./node_modules/${packageName}/package.json`)
      );
      return JSON.parse(stripJsonComments(content.toString()))['version'];
    } catch (e) {
      return null;
    }
  };
}

// testing-fetch-start
function createFetcher(logger: logging.Logger) {
  let cache = {};
  return async function f(
    packageName: string,
    packageVersion: string
  ): Promise<MigrationsJson> {
    if (!cache[`${packageName}-${packageVersion}`]) {
      const dir = dirSync().name;
      logger.info(`Fetching ${packageName}@${packageVersion}`);
      execSync(`npm install ${packageName}@${packageVersion} --prefix=${dir}`, {
        stdio: []
      });
      const json = JSON.parse(
        stripJsonComments(
          readFileSync(
            path.join(dir, 'node_modules', packageName, 'package.json')
          ).toString()
        )
      );
      let migrationsFile = json['nx-migrations'] || json['ng-update'];

      // migrationsFile is an object
      if (migrationsFile && migrationsFile.migrations) {
        migrationsFile = migrationsFile.migrations;
      }

      // packageVersion can be a tag, resolvedVersion works with semver
      const resolvedVersion = json.version;

      if (migrationsFile) {
        const json = JSON.parse(
          stripJsonComments(
            readFileSync(
              path.join(dir, 'node_modules', packageName, migrationsFile)
            ).toString()
          )
        );
        cache[`${packageName}-${packageVersion}`] = {
          version: resolvedVersion,
          schematics: json.schematics,
          packageJsonUpdates: json.packageJsonUpdates
        };
      } else {
        cache[`${packageName}-${packageVersion}`] = {
          version: resolvedVersion
        };
      }
    }
    return cache[`${packageName}-${packageVersion}`];
  };
}
// testing-fetch-end

function createMigrationsFile(root: string, migrations: any[]) {
  writeFileSync(
    path.join(root, 'migrations.json'),
    JSON.stringify({ migrations }, null, 2)
  );
}

function updatePackageJson(
  root: string,
  updatedPackages: {
    [p: string]: { version: string; alwaysAddToPackageJson: boolean };
  }
) {
  const packageJsonPath = path.join(root, 'package.json');
  const json = JSON.parse(
    stripJsonComments(readFileSync(packageJsonPath).toString())
  );
  Object.keys(updatedPackages).forEach(p => {
    if (json.devDependencies && json.devDependencies[p]) {
      json.devDependencies[p] = updatedPackages[p].version;
    } else if (json.dependencies && json.dependencies[p]) {
      json.dependencies[p] = updatedPackages[p].version;
    } else if (updatedPackages[p].alwaysAddToPackageJson) {
      if (!json.dependencies) json.dependencies = {};
      json.dependencies[p] = updatedPackages[p].version;
    }
  });
  writeFileSync(packageJsonPath, JSON.stringify(json, null, 2));
}

async function generateMigrationsJsonAndUpdatePackageJson(
  logger: logging.Logger,
  root: string,
  opts: {
    targetPackage: string;
    targetVersion: string;
    from: { [p: string]: string };
    to: { [p: string]: string };
  }
) {
  logger.info(`Fetching meta data about packages.`);
  logger.info(`It may take a few minutes.`);
  const migrator = new Migrator({
    versions: versions(root),
    fetch: createFetcher(logger),
    from: opts.from,
    to: opts.to
  });
  const { migrations, packageJson } = await migrator.updatePackageJson(
    opts.targetPackage,
    opts.targetVersion
  );
  updatePackageJson(root, packageJson);

  if (migrations.length > 0) {
    createMigrationsFile(root, migrations);

    logger.info(`The migrate command has run successfully.`);
    logger.info(`- package.json has been updated`);
    logger.info(`- migrations.json has been generated`);

    logger.info(`Next steps:`);
    logger.info(
      `- Make sure package.json changes make sense and then run 'npm install' or 'yarn'`
    );
    logger.info(`- Run 'nx migrate --run-migrations=migrations.json'`);
  } else {
    logger.info(`The migrate command has run successfully.`);
    logger.info(`- package.json has been updated`);
    logger.info(
      `- there are no migrations to run, so migrations.json has not been created.`
    );
  }
}

class MigrationEngineHost extends NodeModulesEngineHost {
  constructor() {
    super();
  }
  protected _resolveCollectionPath(name: string): string {
    let collectionPath: string | undefined = undefined;

    if (name.replace(/\\/g, '/').split('/').length > (name[0] == '@' ? 2 : 1)) {
      try {
        collectionPath = this._resolvePath(name, process.cwd());
      } catch {}
    }

    if (!collectionPath) {
      let packageJsonPath = this._resolvePackageJson(name, process.cwd());
      if (!core.fs.isFile(packageJsonPath)) {
        packageJsonPath = path.join(packageJsonPath, 'package.json');
      }
      let pkgJsonSchematics = require(packageJsonPath)['nx-migrations'];
      if (!pkgJsonSchematics) {
        pkgJsonSchematics = require(packageJsonPath)['ng-update'];
        if (!pkgJsonSchematics) {
          throw new Error(`Could find migrations in package: "${name}"`);
        }
      }
      if (typeof pkgJsonSchematics != 'string') {
        pkgJsonSchematics = pkgJsonSchematics.migrations;
      }
      collectionPath = this._resolvePath(
        pkgJsonSchematics,
        path.dirname(packageJsonPath)
      );
    }

    try {
      if (collectionPath) {
        JSON.parse(stripJsonComments(readFileSync(collectionPath).toString()));
        return collectionPath;
      }
    } catch (e) {
      throw new Error(`Invalid migration file in package: "${name}"`);
    }
    throw new Error(`Collection cannot be resolved: "${name}"`);
  }
}

class MigrationsWorkflow extends BaseWorkflow {
  constructor(host: virtualFs.Host) {
    super({
      host,
      engineHost: new MigrationEngineHost(),
      force: true,
      dryRun: false
    });
  }
}

async function runMigrations(
  logger: logging.Logger,
  root: string,
  opts: { runMigrations: string }
) {
  const migrationsFile = JSON.parse(
    stripJsonComments(
      readFileSync(path.join(root, opts.runMigrations)).toString()
    )
  );

  const host = new virtualFs.ScopedHost(new NodeJsSyncHost(), normalize(root));
  const workflow = new MigrationsWorkflow(host);
  let p = Promise.resolve(null);
  migrationsFile.migrations.forEach(m => {
    p = p.then(() => {
      logger.info(`Running migration ${m.package}:${m.name}`);
      return workflow
        .execute({
          collection: m.package,
          schematic: m.name,
          options: {},
          debug: false,
          logger
        })
        .toPromise()
        .then(() => {
          logger.info(`Successfully finished ${m.package}:${m.name}`);
          logger.info(
            `---------------------------------------------------------`
          );
        });
    });
  });

  await p;
}

export async function migrate(
  root: string,
  args: string[],
  isVerbose: boolean = false
) {
  const logger = getLogger(isVerbose);

  return handleErrors(logger, isVerbose, async () => {
    const opts = parseMigrationsOptions(args);
    if (opts.type === 'generateMigrations') {
      await generateMigrationsJsonAndUpdatePackageJson(logger, root, opts);
    } else {
      await runMigrations(logger, root, opts);
    }
  });
}
