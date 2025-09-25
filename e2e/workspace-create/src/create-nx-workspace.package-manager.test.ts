import {
  checkFilesDoNotExist,
  checkFilesExist,
  packageManagerLockFile,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

import {
  getCreateNxWorkspacePackageManager,
  registerCreateNxWorkspaceCleanup,
} from './create-nx-workspace.setup';

const packageManager = getCreateNxWorkspacePackageManager();

describe('create-nx-workspace package managers', () => {
  registerCreateNxWorkspaceCleanup();

  it('should respect package manager preference', () => {
    const wsName = uniq('pm');

    process.env.YARN_REGISTRY = `http://localhost:4872`;
    process.env.SELECTED_PM = 'npm';

    runCreateWorkspace(wsName, {
      preset: 'apps',
      packageManager: 'npm',
    });

    checkFilesDoNotExist('yarn.lock');
    checkFilesExist('package-lock.json');
    process.env.SELECTED_PM = packageManager;
  });

  describe('Use detected package manager', () => {
    function setupProject(envPm: 'npm' | 'yarn' | 'pnpm' | 'bun') {
      process.env.SELECTED_PM = envPm;
      runCreateWorkspace(uniq('pm'), {
        preset: 'apps',
        packageManager: envPm,
        useDetectedPm: true,
      });
    }

    if (packageManager === 'npm') {
      it('should use npm when invoked with npx', () => {
        setupProject('npm');
        checkFilesExist(packageManagerLockFile['npm']);
        checkFilesDoNotExist(
          packageManagerLockFile['yarn'],
          packageManagerLockFile['pnpm'],
          packageManagerLockFile['bun']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }

    if (packageManager === 'pnpm') {
      it('should use pnpm when invoked with pnpx', () => {
        setupProject('pnpm');
        checkFilesExist(packageManagerLockFile['pnpm']);
        checkFilesDoNotExist(
          packageManagerLockFile['yarn'],
          packageManagerLockFile['npm'],
          packageManagerLockFile['bun']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }

    if (packageManager === 'bun') {
      it('should use bun when invoked with bunx', () => {
        setupProject('bun');
        checkFilesExist(packageManagerLockFile['bun']);
        checkFilesDoNotExist(
          packageManagerLockFile['yarn'],
          packageManagerLockFile['npm'],
          packageManagerLockFile['pnpm']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }

    // skipping due to packageManagerCommand for createWorkspace not using yarn create nx-workspace
    if (packageManager === 'yarn') {
      xit('should use yarn when invoked with yarn create', () => {
        setupProject('yarn');
        checkFilesExist(packageManagerLockFile['yarn']);
        checkFilesDoNotExist(
          packageManagerLockFile['pnpm'],
          packageManagerLockFile['npm'],
          packageManagerLockFile['bun']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }
  });
});
