import {
  checkFilesExist,
  getSelectedPackageManager,
  readJson,
} from '@nx/e2e-utils';
import {
  setupNpmWorkspaceTest,
  getWorkspaceName,
} from './create-nx-workspace-npm-setup';

describe('create-nx-workspace --preset=npm', () => {
  setupNpmWorkspaceTest();

  it('should setup package-based workspace', () => {
    const packageJson = readJson('package.json');
    expect(packageJson.dependencies).toEqual({});

    if (getSelectedPackageManager() === 'pnpm') {
      checkFilesExist('pnpm-workspace.yaml');
    } else {
      expect(packageJson.workspaces).toEqual(['packages/*']);
    }
  });
});
