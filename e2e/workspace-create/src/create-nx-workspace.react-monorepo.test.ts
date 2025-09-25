import {
  checkFilesDoNotExist,
  checkFilesExist,
  expectCodeIsFormatted,
  expectNoAngularDevkit,
  expectNoTsJestInJestConfig,
  readJson,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

import {
  getCreateNxWorkspacePackageManager,
  registerCreateNxWorkspaceCleanup,
} from './create-nx-workspace.setup';

const packageManager = getCreateNxWorkspacePackageManager();

describe('create-nx-workspace react monorepo', () => {
  registerCreateNxWorkspaceCleanup();

  it('should be able to create a react workspace with webpack', () => {
    const wsName = uniq('react');
    const appName = uniq('app');

    runCreateWorkspace(wsName, {
      preset: 'react-monorepo',
      style: 'css',
      appName,
      packageManager,
      bundler: 'webpack',
      e2eTestRunner: 'none',
    });

    expectNoAngularDevkit();
    expectNoTsJestInJestConfig(appName);
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nx/webpack']).toBeDefined();
    expectCodeIsFormatted();
  });

  it('should be able to create a react workspace with vite', () => {
    const wsName = uniq('react');
    const appName = uniq('app');

    runCreateWorkspace(wsName, {
      preset: 'react-monorepo',
      style: 'css',
      appName,
      packageManager,
      bundler: 'vite',
      e2eTestRunner: 'none',
    });

    expectNoAngularDevkit();
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nx/webpack']).not.toBeDefined();
    expect(packageJson.devDependencies['@nx/vite']).toBeDefined();
    expectCodeIsFormatted();
  });

  it('should be able to create a react workspace without options and --no-interactive', () => {
    const wsName = uniq('react');

    runCreateWorkspace(wsName, {
      preset: 'react-monorepo',
    });

    expectNoAngularDevkit();
    checkFilesExist('vitest.workspace.ts');
    checkFilesDoNotExist('jest.config.ts');
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nx/vite']).toBeDefined();
    expectCodeIsFormatted();
  });
});
