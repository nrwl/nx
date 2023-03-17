import {
  checkFilesExist,
  getSelectedPackageManager,
  packageManagerLockFile,
  runCLI,
  uniq,
  runCreatePlugin,
  cleanupProject,
  tmpProjPath,
} from '@nrwl/e2e/utils';

describe('create-nx-plugin', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should be able to create a plugin repo and run plugin e2e', () => {
    const wsName = uniq('ws-plugin');
    const pluginName = uniq('plugin');

    runCreatePlugin(wsName, {
      packageManager,
      pluginName,
    });

    checkFilesExist(
      'package.json',
      packageManagerLockFile[packageManager],
      `project.json`,
      `generators.json`,
      `executors.json`
    );

    expect(() => runCLI(`e2e e2e`)).not.toThrow();
  });
});
