import { terminal } from '@angular-devkit/core';
import { readFileSync } from 'fs';
import * as path from 'path';
import { appRootPath } from '../utils/app-root';
import { output } from '../utils/output';

export const packagesWeCareAbout = [
  'nx',
  '@nrwl/angular',
  '@nrwl/cli',
  '@nrwl/cypress',
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
  const nodeModulesDir = path.join(appRootPath, 'node_modules');
  const bodyLines = [];

  packagesWeCareAbout.forEach((p) => {
    let status = 'Not Found';
    try {
      const packageJson = JSON.parse(
        readFileSync(path.join(nodeModulesDir, p, 'package.json')).toString()
      );
      status = packageJson.version;
    } catch {}
    bodyLines.push(`${terminal.green(p)} : ${terminal.bold(status)}`);
  });

  output.log({
    title: 'Report complete - copy this into the issue template',
    bodyLines,
  });
}
