import {
  checkFilesExist,
  packageInstall,
  runCLI,
  uniq,
} from '@nx/e2e-utils';
import {
  setupNpmWorkspaceTest,
  getWorkspaceName,
} from './create-nx-workspace-npm-setup';

describe('create-nx-workspace --preset=npm', () => {
  setupNpmWorkspaceTest();

  it('should add web application', () => {
    const wsName = getWorkspaceName();
    packageInstall('@nx/web', wsName);

    const appName = uniq('my-app');

    expect(() =>
      runCLI(`generate @nx/web:app packages/${appName} --no-interactive`)
    ).not.toThrow();
    checkFilesExist('tsconfig.base.json');
  });
});
