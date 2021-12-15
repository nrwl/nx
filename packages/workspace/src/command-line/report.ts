import {
  detectPackageManager,
  getPackageManagerVersion,
  readJsonFile,
} from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import * as chalk from 'chalk';
import { join } from 'path';
import { resolve } from '../utilities/fileutils';
import { output } from '../utilities/output';

export const packagesWeCareAbout = [
  'nx',
  '@nrwl/angular',
  '@nrwl/cli',
  '@nrwl/cypress',
  '@nrwl/devkit',
  '@nrwl/eslint-plugin-nx',
  '@nrwl/express',
  '@nrwl/fastify',
  '@nrwl/jest',
  '@nrwl/linter',
  '@nrwl/nest',
  '@nrwl/next',
  '@nrwl/node',
  '@nrwl/nx-cloud',
  '@nrwl/react',
  '@nrwl/react-native',
  '@nrwl/schematics',
  '@nrwl/tao',
  '@nrwl/web',
  '@nrwl/workspace',
  '@nrwl/storybook',
  '@nrwl/gatsby',
  'typescript',
  'rxjs',
];

export const packagesWeIgnoreInCommunityReport = new Set([
  ...packagesWeCareAbout,
  '@schematics/angular',
  '@nestjs/schematics',
]);

export const report = {
  command: 'report',
  describe: 'Reports useful version numbers to copy into the Nx issue template',
  builder: (yargs) => yargs,
  handler: reportHandler,
};

/**
 * Reports relevant version numbers for adding to an Nx issue report
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
function reportHandler() {
  const pm = detectPackageManager();
  const pmVersion = getPackageManagerVersion(pm);

  const bodyLines = [
    `Node : ${process.versions.node}`,
    `OS   : ${process.platform} ${process.arch}`,
    `${pm.padEnd(5)}: ${pmVersion}`,
    ``,
  ];

  packagesWeCareAbout.forEach((p) => {
    bodyLines.push(`${chalk.green(p)} : ${chalk.bold(readPackageVersion(p))}`);
  });

  bodyLines.push('---------------------------------------');

  const communityPlugins = findInstalledCommunityPlugins();
  bodyLines.push('Community plugins:');
  communityPlugins.forEach((p) => {
    bodyLines.push(`\t ${chalk.green(p.package)}: ${chalk.bold(p.version)}`);
  });

  output.log({
    title: 'Report complete - copy this into the issue template',
    bodyLines,
  });
}

export function readPackageJson(p: string) {
  try {
    const packageJsonPath = resolve(`${p}/package.json`, {
      paths: [appRootPath],
    });
    return readJsonFile(packageJsonPath);
  } catch {
    return {};
  }
}

export function readPackageVersion(p: string) {
  let status = 'Not Found';
  try {
    status = readPackageJson(p).version;
  } catch {}
  return status;
}

export function findInstalledCommunityPlugins(): {
  package: string;
  version: string;
}[] {
  const { dependencies, devDependencies } = readJsonFile(
    join(appRootPath, 'package.json')
  );
  const deps = [
    Object.keys(dependencies || {}),
    Object.keys(devDependencies || {}),
  ].flat();

  return deps.reduce(
    (arr: any[], nextDep: string): { project: string; version: string }[] => {
      if (packagesWeIgnoreInCommunityReport.has(nextDep)) {
        return arr;
      }
      try {
        const depPackageJson = readPackageJson(nextDep);
        if (
          [
            'ng-update',
            'nx-migrations',
            'schematics',
            'generators',
            'builders',
            'executors',
          ].some((field) => field in depPackageJson)
        ) {
          arr.push({ package: nextDep, version: depPackageJson.version });
          return arr;
        } else {
          return arr;
        }
      } catch {
        console.warn(`Error parsing packageJson for ${nextDep}`);
        return arr;
      }
    },
    []
  );
}
