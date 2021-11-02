/*
 * This script checks if new versions of node modules are available.
 * It uses naming conventions to transform constants to matching node module name.
 *
 * Usage:
 *   yarn check-versions [file]
 *
 * Positional arg:
 *   - [file]: relative or absolute file path to the versions file.
 *
 * Example:
 *   yarn check-versions packages/react/src/utils/versions
 */

import { join } from 'path';
import { gt } from 'semver';
import * as chalk from 'chalk';
import { dasherize } from '../packages/workspace/src/utils/strings';
import * as glob from 'glob';
import { execSync } from 'child_process';

const excluded = ['nxVersion'];
const scoped = [
  'babel',
  'emotion',
  'reduxjs',
  'testing-library',
  'types',
  'zeit',
];

try {
  const files = process.argv[2]
    ? [process.argv[2]]
    : glob.sync('packages/**/*/versions.ts');
  checkFiles(files);
} catch (e) {
  console.log(chalk.red(e.message));
  process.exitCode = 1;
}

// -----------------------------------------------------------------------------

function checkFiles(files: string[]) {
  console.log(chalk.blue(`Checking versions in the following files...\n`));
  console.log(`  - ${files.join('\n  - ')}\n`);
  const maxFileNameLength = Math.max(...files.map((f) => f.length));

  let hasError = false;

  files.forEach((f) => {
    const versions = getVersions(f);
    const npmPackages = getPackages(versions);
    const results = npmPackages.map(([p, v]) => getVersionData(p, v));
    const logContext = `${f.padEnd(maxFileNameLength)}`;
    results.forEach((r) => {
      if (r.outdated) {
        console.log(
          `${logContext} ❗ ${chalk.bold(
            r.package
          )} has new version ${chalk.bold(r.latest)} (current: ${r.prev})`
        );
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
  });

  if (hasError)
    throw new Error('Invalid versions of packages found (please see above).');
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
      acc.push([npmName, version]);
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
  v: string
): {
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
      return { package: p, outdated: true, invalid: false, latest, prev: v };
    }
    if (gt(v, latest)) {
      return { package: p, outdated: false, invalid: true, latest, prev: v };
    }
  } catch {
    // ignored
  }
  return { package: p, outdated: false, invalid: false, latest: v };
}
