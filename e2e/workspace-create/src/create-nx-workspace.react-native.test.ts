import {
  expectCodeIsFormatted,
  expectNoAngularDevkit,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

import { registerCreateNxWorkspaceCleanup } from './create-nx-workspace.setup';

describe('create-nx-workspace react native preset', () => {
  registerCreateNxWorkspaceCleanup();

  it('should be able to create react-native workspace', () => {
    const wsName = uniq('react-native');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'react-native',
      appName,
      packageManager: 'npm',
      e2eTestRunner: 'none',
    });

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });

  it('should be able to create an expo workspace', () => {
    const wsName = uniq('expo');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'expo',
      appName,
      packageManager: 'npm',
      e2eTestRunner: 'none',
    });

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });
});

