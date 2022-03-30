import * as chalk from 'chalk';
import { workspaceRoot } from 'nx/src/utils/app-root';
import { output } from '../utils/output';
import { join } from 'path';
import {
  detectPackageManager,
  getPackageManagerVersion,
} from 'nx/src/utils/package-manager';
import { readJsonFile } from 'nx/src/utils/fileutils';

export const packagesWeCareAbout = [
  'nx',
  '@nrwl/angular',
  '@nrwl/cypress',
  '@nrwl/detox',
  '@nrwl/devkit',
  '@nrwl/eslint-plugin-nx',
  '@nrwl/express',
  '@nrwl/jest',
  '@nrwl/js',
  '@nrwl/linter',
  '@nrwl/nest',
  '@nrwl/next',
  '@nrwl/node',
  '@nrwl/nx-cloud',
  '@nrwl/nx-plugin',
  '@nrwl/react',
  '@nrwl/react-native',
  '@nrwl/schematics',
  '@nrwl/storybook',
  '@nrwl/web',
  '@nrwl/workspace',
  'typescript',
  'rxjs',
];

export const patternsWeIgnoreInCommunityReport: Array<string | RegExp> = [
  ...packagesWeCareAbout,
  '@schematics/angular',
  new RegExp('@angular/*'),
  '@nestjs/schematics',
];

/**
 * Reports relevant version numbers for adding to an Nx issue report
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
export function reportHandler() {
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
    const packageJsonPath = require.resolve(`${p}/package.json`, {
      paths: [workspaceRoot],
    });
    return readJsonFile(packageJsonPath);
  } catch {
    return {};
  }
}

export function readPackageVersion(p: string): string {
  return readPackageJson(p).version || 'Not Found';
}

export function findInstalledCommunityPlugins(): {
  package: string;
  version: string;
}[] {
  const { dependencies, devDependencies } = readJsonFile(
    join(workspaceRoot, 'package.json')
  );
  const deps = [
    Object.keys(dependencies || {}),
    Object.keys(devDependencies || {}),
  ].flat();

  return deps.reduce(
    (arr: any[], nextDep: string): { project: string; version: string }[] => {
      if (
        patternsWeIgnoreInCommunityReport.some((pattern) =>
          typeof pattern === 'string'
            ? pattern === nextDep
            : pattern.test(nextDep)
        )
      ) {
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
