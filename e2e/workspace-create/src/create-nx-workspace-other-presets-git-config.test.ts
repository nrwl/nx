import {
  cleanupProject,
  getSelectedPackageManager,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --preset=other - Git Configuration', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

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
