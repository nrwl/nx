import {
  checkFilesDoNotExist,
  expectCodeIsFormatted,
  expectNoAngularDevkit,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

import {
  getCreateNxWorkspacePackageManager,
  registerCreateNxWorkspaceCleanup,
} from './create-nx-workspace.setup';

const packageManager = getCreateNxWorkspacePackageManager();

describe('create-nx-workspace empty workspaces', () => {
  registerCreateNxWorkspaceCleanup();

  it('should be able to create an empty workspace built for apps', () => {
    const wsName = uniq('apps');
    runCreateWorkspace(wsName, {
      preset: 'apps',
      packageManager,
    });

    expectNoAngularDevkit();
    checkFilesDoNotExist('yarn.lock');
  });

  it('should be able to create an empty workspace with npm capabilities', () => {
    const wsName = uniq('npm');
    runCreateWorkspace(wsName, {
      preset: 'npm',
      packageManager,
    });

    expectNoAngularDevkit();
    checkFilesDoNotExist('tsconfig.base.json');
  });

  it('should be able to create an empty workspace with ts/js capabilities', () => {
    const wsName = uniq('ts');
    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager,
    });

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });
});
