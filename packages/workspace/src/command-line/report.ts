import * as chalk from 'chalk';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { appRootPath } from '../utilities/app-root';
import { detectPackageManager } from '@nrwl/tao/src/shared/package-manager';
import { output } from '../utilities/output';

export const packagesWeCareAbout = [
  'nx',
  '@nrwl/angular',
  '@nrwl/cli',
  '@nrwl/cypress',
  '@nrwl/devkit',
  '@nrwl/eslint-plugin-nx',
  '@nrwl/express',
  '@nrwl/jest',
  '@nrwl/linter',
  '@nrwl/nest',
  '@nrwl/next',
  '@nrwl/node',
  '@nrwl/react',
  '@nrwl/schematics',
  '@nrwl/tao',
  '@nrwl/web',
  '@nrwl/workspace',
  '@nrwl/storybook',
  '@nrwl/gatsby',
  'typescript',
];

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
  const pmVersion = execSync(`${pm} --version`).toString('utf-8').trim();

  const bodyLines = [
    `Node : ${process.versions.node}`,
    `OS   : ${process.platform} ${process.arch}`,
    `${pm.padEnd(5)}: ${pmVersion}`,
    ``,
  ];

  packagesWeCareAbout.forEach((p) => {
    let status = 'Not Found';
    try {
      const packageJsonPath = require.resolve(`${p}/package.json`, {
        paths: [appRootPath],
      });
      const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
      status = packageJson.version;
    } catch {}
    bodyLines.push(`${chalk.green(p)} : ${chalk.bold(status)}`);
  });

  output.log({
    title: 'Report complete - copy this into the issue template',
    bodyLines,
  });
}
