import {
  cleanupProject,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';
import { existsSync, readFileSync } from 'fs';

import {
  getYarnBerryVersion,
  registerYarnBerrySetup,
  yarnBerryTmpDir,
} from './create-nx-workspace.yarn-berry-setup';

describe('create-nx-workspace yarn berry', () => {
  registerYarnBerrySetup();

  let wsName: string;

  afterEach(() => cleanupProject({ cwd: `${yarnBerryTmpDir}/${wsName}` }));

  it('should create a workspace with yarn berry', () => {
    wsName = uniq('apps');

    runCreateWorkspace(wsName, {
      preset: 'apps',
      packageManager: 'yarn',
      cwd: yarnBerryTmpDir,
    });

    expect(existsSync(`${yarnBerryTmpDir}/${wsName}/.yarnrc.yml`)).toBeTruthy();
    expect(
      readFileSync(`${yarnBerryTmpDir}/${wsName}/.yarnrc.yml`, {
        encoding: 'utf-8',
      })
    ).toMatchInlineSnapshot(
      `"nodeLinker: node-modules

yarnPath: .yarn/releases/yarn-${getYarnBerryVersion()}.cjs
"`
    );
  });

  it('should create a js workspace with yarn berry', () => {
    wsName = uniq('ts');

    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager: 'yarn',
      cwd: yarnBerryTmpDir,
    });

    expect(existsSync(`${yarnBerryTmpDir}/${wsName}/.yarnrc.yml`)).toBeTruthy();
    expect(
      readFileSync(`${yarnBerryTmpDir}/${wsName}/.yarnrc.yml`, {
        encoding: 'utf-8',
      })
    ).toMatchInlineSnapshot(
      `"nodeLinker: node-modules

yarnPath: .yarn/releases/yarn-${getYarnBerryVersion()}.cjs
"`
    );
  });
});

