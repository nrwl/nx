import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  packageManagerLockFile,
  runCLI,
  runCreatePlugin,
  uniq,
} from '@nx/e2e/utils';

describe('create-nx-plugin', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should be able to create a plugin repo build a plugin', () => {
    const pluginName = uniq('plugin');
    const generatorName = uniq('generator');
    const executorName = uniq('executor');

    runCreatePlugin(pluginName, {
      packageManager,
      extraArgs: `--createPackageName=false`,
    });

    checkFilesExist(
      'package.json',
      packageManagerLockFile[packageManager],
      `project.json`
    );

    runCLI(`build ${pluginName}`);

    checkFilesExist(
      `dist/${pluginName}/package.json`,
      `dist/${pluginName}/src/index.js`
    );

    runCLI(
      `generate @nx/plugin:generator ${pluginName}/src/generators/${generatorName} --name ${generatorName}`
    );
    runCLI(
      `generate @nx/plugin:executor ${pluginName}/src/executors/${executorName} --name ${executorName}`
    );

    runCLI(`build ${pluginName}`);

    checkFilesExist(
      `dist/${pluginName}/package.json`,
      `dist/${pluginName}/generators.json`,
      `dist/${pluginName}/executors.json`
    );
  });

  it('should be able to create a repo with create workspace cli', () => {
    const pluginName = uniq('plugin');

    runCreatePlugin(pluginName, {
      packageManager,
      extraArgs: `--createPackageName=create-${pluginName}-package`,
    });

    runCLI(`build ${pluginName}`);
    checkFilesExist(
      `dist/packages/${pluginName}/package.json`,
      `dist/packages/${pluginName}/generators.json`,
      `packages/${pluginName}-e2e/src/${pluginName}.spec.ts`
    );

    runCLI(`build create-${pluginName}-package`);
    checkFilesExist(`dist/packages/create-${pluginName}-package/bin/index.js`);

    expect(() => runCLI(`e2e ${pluginName}-e2e`)).not.toThrow();
  });
});
