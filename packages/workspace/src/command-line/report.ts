import { terminal } from '@angular-devkit/core';
import { readFileSync } from 'fs';
import * as path from 'path';
import { appRootPath } from '../utils/app-root';
import { output } from './output';

export const packagesWeCareAbout = [
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
  'typescript'
];

/**
 * Reports relevant version numbers for adding to an Nx issue report
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
export function report() {
  const nodeModulesDir = path.join(appRootPath, 'node_modules');
  const bodyLines = [];

  packagesWeCareAbout.forEach(p => {
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
    bodyLines
  });
}
