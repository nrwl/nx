/*
 * This script checks if new versions of node modules are available.
 * It uses naming conventions to transform constants to matching node module name.
 *
 * Usage:
 *   yarn check-versions [file|package]
 *
 * Positional arg:
 *   - [file]: relative or absolute file path to the versions file.
 *
 * Example:
 *   yarn check-versions react
 */

import { join, relative } from 'path';
import { gt } from 'semver';
import { readJsonSync, writeJsonSync } from 'fs-extra';
import * as chalk from 'chalk';
import { dasherize } from '../packages/workspace/src/utils/strings';
import * as glob from 'glob';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const root = join(__dirname, '..');
const excluded = ['nxVersion'];
const scoped = [
  'babel',
  'emotion',
  'reduxjs',
  'swc',
  'testing-library',
  'types',
];

try {
  const files = process.argv[2]
    ? [normalize(process.argv[2])]
    : glob.sync('packages/**/*/versions.ts').map((x) => relative(root, x));
  checkFiles(files);
} catch (e) {
  console.log(chalk.red(e.message));
  process.exitCode = 1;
}

function normalize(x: string) {
  if (x.endsWith('.ts')) {
    return x;
  } else {
    return join('packages', x, 'src/utils/versions.ts');
  }
}

// -----------------------------------------------------------------------------

function checkFiles(files: string[]) {
  console.log(chalk.blue(`Checking versions in the following files...\n`));
  console.log(`  - ${files.join('\n  - ')}\n`);
  const maxFileNameLength = Math.max(...files.map((f) => f.length));

  let hasError = false;

  files.forEach((f) => {
    const projectRoot = f.split('/src/')[0];
    const migrationsPath = join(projectRoot, 'migrations.json');
    const migrationsJson = readJsonSync(migrationsPath);
    let versionsContent = readFileSync(f).toString();
    const versions = getVersions(f);
    const npmPackages = getPackages(versions);
    const results = npmPackages.map(([p, v, o]) => getVersionData(p, v, o));
    const logContext = `${f.padEnd(maxFileNameLength)}`;
    const packageUpdates = {};

    results.forEach((r) => {
      if (r.outdated) {
        console.log(
          `${logContext} ❗ ${chalk.bold(
            r.package
          )} has new version ${chalk.bold(r.latest)} (current: ${r.prev})`
        );
        versionsContent = versionsContent.replace(
          `${r.variable} = '${r.prev}'`,
          `${r.variable} = '${r.latest}'`
        );
        packageUpdates[r.package] = {
          version: r.latest,
          alwaysAddToPackageJson: false,
        };
      }
      if (r.invalid) {
        hasError = true;
        console.log(
          `${logContext} ⚠️ ${chalk.bold(r.package)} has an invalid version (${
            r.prev
          }) specified. Latest is ${r.latest}.`
        );
      }
    });

    if (Object.keys(packageUpdates).length > 0) {
      migrationsJson.packageJsonUpdates['x.y.z'] = {
        version: 'x.y.z',
        packages: packageUpdates,
      };
      writeFileSync(f, versionsContent);
      writeJsonSync(migrationsPath, migrationsJson, { spaces: 2 });
    }
  });

  if (hasError) {
    throw new Error('Invalid versions of packages found (please see above).');
  }
}

function getVersions(path: string) {
  const versionsPath =
    path.startsWith('.') || path.startsWith('packages')
      ? join(__dirname, '..', path)
      : path;
  try {
    return require(versionsPath);
  } catch {
    throw new Error(`Could not load ${path}. Please make sure it is valid.`);
  }
}

function getPackages(versions: Record<string, string>): string[][] {
  return Object.entries(versions).reduce((acc, [name, version]) => {
    if (!excluded.includes(name)) {
      const npmName = getNpmName(name);
      acc.push([npmName, version, name]);
    }
    return acc;
  }, [] as string[][]);
}

function getNpmName(name: string): string {
  const dashedName = dasherize(name.replace(/Version$/, ''));
  const scope = scoped.find((s) => dashedName.startsWith(`${s}-`));

  if (scope) {
    const rest = dashedName.split(`${scope}-`)[1];
    return `@${scope}/${rest}`;
  } else {
    return dashedName;
  }
}

function getVersionData(
  p: string,
  v: string,
  o: string
): {
  variable: string;
  package: string;
  outdated: boolean;
  invalid: boolean;
  latest: string;
  prev?: string;
} {
  try {
    const latest = JSON.parse(
      execSync(`npm view ${p} version --json --silent`, {
        stdio: ['ignore'],
      }).toString('utf-8')
    );
    if (gt(latest, v)) {
      return {
        variable: o,
        package: p,
        outdated: true,
        invalid: false,
        latest,
        prev: v,
      };
    }
    if (gt(v, latest)) {
      return {
        variable: o,
        package: p,
        outdated: false,
        invalid: true,
        latest,
        prev: v,
      };
    }
  } catch {
    // ignored
  }
  return {
    variable: o,
    package: p,
    outdated: false,
    invalid: false,
    latest: v,
  };
}
