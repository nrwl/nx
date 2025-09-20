import {
  cleanupProject,
  e2eCwd,
  getSelectedPackageManager,
  runCommand,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';
import { readFileSync } from 'fs';
import { mkdirSync, rmSync } from 'fs-extra';

describe('create-nx-workspace yarn berry', () => {
  const tmpDir = `${e2eCwd}/${uniq('yarn-berry')}`;
  let wsName: string;
  let yarnVersion: string;

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    runCommand('corepack prepare yarn@3.6.1 --activate', { cwd: tmpDir });
    runCommand('yarn set version 3.6.1', { cwd: tmpDir });
    yarnVersion = runCommand('yarn --version', { cwd: tmpDir }).trim();
    // previous command creates a package.json file which we don't want
    rmSync(`${tmpDir}/package.json`);
    process.env.YARN_ENABLE_IMMUTABLE_INSTALLS = 'false';
  });

  afterEach(() => cleanupProject({ cwd: `${tmpDir}/${wsName}` }));

  it('should create a workspace with yarn berry', () => {
    wsName = uniq('apps');

    runCreateWorkspace(wsName, {
      preset: 'apps',
      packageManager: 'yarn',
      cwd: tmpDir,
    });

    expect(
      readFileSync(`${tmpDir}/${wsName}/.yarnrc.yml`, { encoding: 'utf-8' })
    ).toContain('nodeLinker: node-modules');
    expect(
      readFileSync(`${tmpDir}/${wsName}/.yarnrc.yml`, { encoding: 'utf-8' })
    ).toContain(`yarn-${yarnVersion}`);
  });

  it('should create a js workspace with yarn berry', () => {
    wsName = uniq('ts');

    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager: 'yarn',
      cwd: tmpDir,
    });

    expect(
      readFileSync(`${tmpDir}/${wsName}/.yarnrc.yml`, { encoding: 'utf-8' })
    ).toContain('nodeLinker: node-modules');
    expect(
      readFileSync(`${tmpDir}/${wsName}/.yarnrc.yml`, { encoding: 'utf-8' })
    ).toContain(`yarn-${yarnVersion}`);
  });
});
