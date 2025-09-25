import { runCreateWorkspace, uniq } from '@nx/e2e-utils';

import {
  getCreateNxWorkspacePackageManager,
  registerCreateNxWorkspaceCleanup,
} from './create-nx-workspace.setup';

const packageManager = getCreateNxWorkspacePackageManager();

describe('create-nx-workspace branch options', () => {
  registerCreateNxWorkspaceCleanup();

  it('should be able to create a workspace with a custom base branch and HEAD', () => {
    const wsName = uniq('branch');
    runCreateWorkspace(wsName, {
      preset: 'apps',
      base: 'main',
      packageManager,
    });
  });

  it('should be able to create a workspace with custom commit information', () => {
    const wsName = uniq('branch');
    runCreateWorkspace(wsName, {
      preset: 'apps',
      extraArgs:
        '--commit.name="John Doe" --commit.email="myemail@test.com" --commit.message="Custom commit message!"',
      packageManager,
    });
  });
});

