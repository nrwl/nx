import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  expectCodeIsFormatted,
  expectNoAngularDevkit,
  expectNoTsJestInJestConfig,
  getSelectedPackageManager,
  readJson,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace react', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should create a workspace with a single react app with vite at the root', () => {
    const wsName = uniq('react');

    runCreateWorkspace(wsName, {
      preset: 'react-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      bundler: 'vite',
      e2eTestRunner: 'none',
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('vite.config.ts');
    checkFilesDoNotExist('tsconfig.base.json');
    expectCodeIsFormatted();
  });

  it('should create a workspace with a single react app with webpack and playwright at the root', () => {
    const wsName = uniq('react');

    runCreateWorkspace(wsName, {
      preset: 'react-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      bundler: 'webpack',
      e2eTestRunner: 'playwright',
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('webpack.config.js');
    checkFilesDoNotExist('tsconfig.base.json');
    expectCodeIsFormatted();
  });

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


