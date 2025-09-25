import { expectCodeIsFormatted, runCreateWorkspace, uniq } from '@nx/e2e-utils';

import {
  getCreateNxWorkspacePackageManager,
  registerCreateNxWorkspaceCleanup,
} from './create-nx-workspace.setup';

const packageManager = getCreateNxWorkspacePackageManager();

describe('create-nx-workspace nest', () => {
  registerCreateNxWorkspaceCleanup();

  it('should be able to create a nest workspace', () => {
    const wsName = uniq('nest');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'nest',
      docker: false,
      appName,
      packageManager,
    });
    expectCodeIsFormatted();
  });
});

