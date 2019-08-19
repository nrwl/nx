import { gt, lte } from 'semver';
import { handleErrors, convertToCamelCase } from '../shared/params';
import { logger } from '../shared/logger';
import minimist = require('minimist');
import { commandName } from '../shared/print-help';
import { virtualFs, normalize, logging } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { HostTree } from '@angular-devkit/schematics';
import { dirSync } from 'tmp';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { NodeModulesEngineHost } from '@angular-devkit/schematics/tools';
import { BaseWorkflow } from '@angular-devkit/schematics/src/workflow';
import * as stripJsonComments from 'strip-json-comments';

import * as path from 'path';
import * as core from '@angular-devkit/core/node';
import { execSync } from 'child_process';

export type MigrationsJson = {
  version: string;
  schematics?: { [name: string]: { version: string } };
  packageJsonUpdates?: {
    [name: string]: {
      version: string;
      packages: {
        [p: string]: { version: string; ifPackageInstalled?: string };
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
      targetVersion,
      {}
    );
    const migrations = await this._createMigrateJson(packageJson);
    return { packageJson, migrations };
  }

  private async _createMigrateJson(versions: { [k: string]: string }) {
    const migrations = await Promise.all(
      Object.keys(versions).map(async c => {
        const currentVersion = this.versions(c);
        const targetVersion = versions[c];
        if (currentVersion) {
          const migrationsJson = await this.fetch(c, targetVersion);
          if (!migrationsJson.schematics) return [];
          return Object.keys(migrationsJson.schematics)
            .filter(
              r =>
                gt(migrationsJson.schematics[r].version, currentVersion) &
                lte(migrationsJson.schematics[r].version, targetVersion)
            )
            .map(r => ({
              ...migrationsJson.schematics[r],
              package: c,
              name: r
            }));
        } else {
          return Promise.resolve(null);
        }
      })
    );

    return migrations.reduce((m, c) => [...m, ...c], []);
  }

  private async _updatePackageJson(
    targetPackage: string,
    targetVersion: string,
    versions: { [k: string]: string }
  ) {
    if (this.to[targetPackage]) {
      targetVersion = this.to[targetPackage];
    }
    let currentVersion;
    if (this.from[targetPackage]) {
      currentVersion = this.from[targetPackage];
    } else {
      currentVersion = this.versions(targetPackage);
      if (!currentVersion) {
        throw new Error(`Cannot find package "${targetPackage}" installed.`);
      }
    }
    let migrationsJson;
    try {
      migrationsJson = await this.fetch(targetPackage, targetVersion);
    } catch (e) {
      if (e.message.indexOf('No matching version') > -1) {
        throw new Error(
          `${
            e.message
          }\nRun migrate with --to="package1@version1,package2@version2"`
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
        .filter(r => !versions[r] || gt(packages[r], versions[r]))
        .map(u =>
          this._updatePackageJson(u, packages[u], {
            [targetPackage]: targetVersion
          })
        )
    );
    return childCalls.reduce(
      (m, c) => {
        Object.keys(c).forEach(r => {
          if (!m[r] || gt(c[r], m[r])) {
            m[r] = c[r];
          }
        });
        return m;
      },
      { [targetPackage]: migrationsJson.version }
    );
  }

  private collapsePackages(
    packageName: string,
    targetVersion: string,
    m: MigrationsJson | null
  ) {
    if (!m.packageJsonUpdates) return {};
    return Object.keys(m.packageJsonUpdates)
      .filter(
        r =>
          gt(m.packageJsonUpdates[r].version, this.versions(packageName)) &
          lte(m.packageJsonUpdates[r].version, targetVersion)
      )
      .map(r => m.packageJsonUpdates[r].packages)
      .map(packages => {
        if (!packages) return {};

        return Object.keys(packages)
          .filter(
            p =>
              !packages[p].ifPackageInstalled ||
              this.versions(packages[p].ifPackageInstalled)
          )
          .reduce((m, c) => ({ ...m, [c]: packages[c].version }), {});
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
    const content = readFileSync(
      path.join(root, `./node_modules/${packageName}/package.json`)
    );
    if (content) {
      return JSON.parse(stripJsonComments(content.toString()))['version'];
    } else {
      return null;
    }
  };
}

// testing-fetch-start
async function fetch(
  packageName: string,
  packageVersion: string
): Promise<MigrationsJson> {
  const dir = dirSync().name;
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
  const migrationsFile = json['nx-migrations'] || json['ng-update'];
  if (migrationsFile) {
    const json = JSON.parse(
      stripJsonComments(
        readFileSync(
          path.join(dir, 'node_modules', packageName, migrationsFile)
        ).toString()
      )
    );
    return {
      version: packageVersion,
      schematics: json.schematics,
      packageJsonUpdates: json.packageJsonUpdates
    };
  } else {
    return { version: packageVersion };
  }
}
// testing-fetch-end

function createMigrationsFile(root: string, migrations: any[]) {
  writeFileSync(
    path.join(root, 'migrations.json'),
    JSON.stringify({ migrations }, null, 2)
  );
}

function updatePackageJson(root: string, packageJson: { [p: string]: string }) {
  const packageJsonPath = path.join(root, 'package.json');
  const json = JSON.parse(
    stripJsonComments(readFileSync(packageJsonPath).toString())
  );
  Object.keys(packageJson).forEach(p => {
    if (json.devDependencies && json.devDependencies[p]) {
      json.devDependencies[p] = packageJson[p];
    } else {
      if (!json.dependencies) json.dependencies = {};
      json.dependencies[p] = packageJson[p];
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
  const migrator = new Migrator({
    versions: versions(root),
    fetch,
    from: opts.from,
    to: opts.to
  });
  const { migrations, packageJson } = await migrator.updatePackageJson(
    opts.targetPackage,
    opts.targetVersion
  );
  createMigrationsFile(root, migrations);
  updatePackageJson(root, packageJson);

  logger.info(`The migrate command has run successfully.`);
  logger.info(`- package.json has been updated`);
  logger.info(`- migrations.json has been generated`);

  logger.info(`Next steps:`);
  logger.info(
    `- Make sure package.json changes make sense and then run 'npm install' or 'yarn'`
  );
  logger.info(`- Run 'nx migrate --run-migrations=migrations.json'`);
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
      if (!pkgJsonSchematics || typeof pkgJsonSchematics != 'string') {
        pkgJsonSchematics = require(packageJsonPath)['ng-update'];
        if (!pkgJsonSchematics) {
          throw new Error(`Could find migrations in package: "${name}"`);
        }
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
    logger.info(`Running migration ${m.package}:${m.name}`);
    p = p.then(() => {
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

export async function migrate(root: string, args: string[]) {
  return handleErrors(logger, async () => {
    const opts = parseMigrationsOptions(args);
    if (opts.type === 'generateMigrations') {
      await generateMigrationsJsonAndUpdatePackageJson(logger, root, opts);
    } else {
      await runMigrations(logger, root, opts);
    }
  });
}
