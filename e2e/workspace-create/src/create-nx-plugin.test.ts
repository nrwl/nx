import {
  checkFilesExist,
  getSelectedPackageManager,
  packageManagerLockFile,
  runCLI,
  uniq,
  runCreatePlugin,
  cleanupProject,
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
      extraArgs: `--createPackageName='false'`,
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
      `generate @nx/plugin:generator ${generatorName} --project=${pluginName}`
    );
    runCLI(
      `generate @nx/plugin:executor ${executorName} --project=${pluginName}`
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
      `dist/${pluginName}/package.json`,
      `dist/${pluginName}/generators.json`,
      `e2e/tests/${pluginName}.spec.ts`
    );

    runCLI(`build create-${pluginName}-package`);
    checkFilesExist(`dist/create-${pluginName}-package/bin/index.js`);

    expect(() => runCLI(`e2e e2e`)).not.toThrow();
  });
});
