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
    const generatorName = uniq('generator');
    const executorName = uniq('executor');

    runCreatePlugin(pluginName, {
      packageManager,
    });

    checkFilesExist(
      'package.json',
      packageManagerLockFile[packageManager],
      `project.json`
    );

    runCLI(`build ${pluginName}`);

    checkFilesExist(`dist/package.json`, `dist/src/index.js`);

    runCLI(
      `generate @nrwl/nx-plugin:generator ${generatorName} --project=${pluginName}`
    );
    runCLI(
      `generate @nrwl/nx-plugin:executor ${executorName} --project=${pluginName}`
    );

    runCLI(`build ${pluginName}`);

    checkFilesExist(
      `dist/package.json`,
      `dist/generators.json`,
      `dist/executors.json`,
      `dist/src/index.js`
    );

    runCLI(`build create-${pluginName}-package`);
    checkFilesExist(`dist/create-${pluginName}-package/bin/index.js`);

    expect(() => runCLI(`e2e e2e`)).not.toThrow();
  });
});
