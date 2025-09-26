import {
  checkFilesDoNotExist,
  checkFilesExist,
  expectCodeIsFormatted,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

import {
  getCreateNxWorkspacePackageManager,
  registerCreateNxWorkspaceCleanup,
} from './create-nx-workspace.setup';

const packageManager = getCreateNxWorkspacePackageManager();

describe('create-nx-workspace react root', () => {
  registerCreateNxWorkspaceCleanup();

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
});
