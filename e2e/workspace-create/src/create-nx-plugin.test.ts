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

  it('should be able to create a plugin repo build a plugin', () => {
    const pluginName = uniq('plugin');

    runCreatePlugin(pluginName, {
      packageManager,
    });

    checkFilesExist(
      'package.json',
      packageManagerLockFile[packageManager],
      `project.json`,
      `generators.json`,
      `executors.json`
    );

    runCLI(`build ${pluginName}`);

    checkFilesExist(
      `dist/package.json`,
      `dist/generators.json`,
      `dist/executors.json`
    );
  });
});
