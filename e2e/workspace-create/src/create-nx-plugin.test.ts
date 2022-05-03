import {
  checkFilesExist,
  getSelectedPackageManager,
  packageManagerLockFile,
  runCLI,
  uniq,
  runCreatePlugin,
} from '@nrwl/e2e/utils';

describe('create-nx-plugin', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  it('should be able to create a plugin repo and run plugin e2e', () => {
    const wsName = uniq('ws-plugin');
    const pluginName = uniq('plugin');
    runCreatePlugin(wsName, {
      packageManager,
      pluginName,
    });

    checkFilesExist(
      'workspace.json',
      'package.json',
      packageManagerLockFile[packageManager],
      `packages/${pluginName}/package.json`
    );

    expect(() => runCLI(`e2e ${pluginName}-e2e`)).not.toThrow();
  });
});
