import { e2eCwd, runCommand, uniq } from '@nx/e2e-utils';
import { mkdirSync, rmSync } from 'fs-extra';

export const yarnBerryTmpDir = `${e2eCwd}/${uniq('yarn-berry')}`;

let yarnBerryVersion: string;

export function registerYarnBerrySetup() {
  beforeAll(() => {
    mkdirSync(yarnBerryTmpDir, { recursive: true });
    runCommand('corepack prepare yarn@3.6.1 --activate', {
      cwd: yarnBerryTmpDir,
    });
    runCommand('yarn set version 3.6.1', { cwd: yarnBerryTmpDir });
    yarnBerryVersion = runCommand('yarn --version', {
      cwd: yarnBerryTmpDir,
    }).trim();
    // previous command creates a package.json file which we don't want
    rmSync(`${yarnBerryTmpDir}/package.json`);
    process.env.YARN_ENABLE_IMMUTABLE_INSTALLS = 'false';
  });
}

export function getYarnBerryVersion() {
  return yarnBerryVersion;
}

