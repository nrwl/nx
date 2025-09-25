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

describe('create-nx-workspace angular root', () => {
  registerCreateNxWorkspaceCleanup();

  it('should create a workspace with a single angular app at the root without routing', () => {
    const wsName = uniq('angular');

    runCreateWorkspace(wsName, {
      preset: 'angular-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      standaloneApi: false,
      routing: false,
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('src/app/app-module.ts');
    checkFilesDoNotExist('src/app/app.routes.ts');
    expectCodeIsFormatted();
  });

  it('should create a workspace with a single angular app at the root using standalone APIs', () => {
    const wsName = uniq('angular');

    runCreateWorkspace(wsName, {
      preset: 'angular-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      standaloneApi: true,
      routing: true,
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('src/app/app.routes.ts');
    checkFilesDoNotExist('src/app/app-module.ts');
    expectCodeIsFormatted();
  });
});

