import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  killPorts,
  newProject,
  promisifiedTreeKill,
  readJson,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { ChildProcess } from 'child_process';
import { join } from 'path';

describe('@nx/expo (legacy)', () => {
  let proj: string;
  let appName = uniq('my-app');
  let libName = uniq('lib');
  let originalEnv: string;

  beforeAll(() => {
    proj = newProject({ packages: ['@nx/expo'] });
    // we create empty preset above which skips creation of `production` named input

    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';

    updateJson('nx.json', (nxJson) => {
      nxJson.namedInputs = {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: ['default'],
        sharedGlobals: [],
      };
      return nxJson;
    });
    runCLI(
      `generate @nx/expo:application apps/${appName} --e2eTestRunner=cypress --no-interactive --unitTestRunner=jest --linter=eslint`
    );
    runCLI(
      `generate @nx/expo:library libs/${libName} --buildable --publishable --importPath=${proj}/${libName} --unitTestRunner=jest --linter=eslint`
    );
  });
  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  it('should test and lint', async () => {
    const componentName = uniq('Component');

    runCLI(
      `generate @nx/expo:component libs/${libName}/src/${componentName} --name ${componentName} --export --no-interactive`
    );

    updateFile(`apps/${appName}/src/app/App.tsx`, (content) => {
      let updated = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport {${componentName}} from '${proj}/${libName}';\n${content}`;
      return updated;
    });

    expect(() => runCLI(`test ${appName}`)).not.toThrow();
    expect(() => runCLI(`test ${libName}`)).not.toThrow();

    const appLintResults = await runCLIAsync(`lint ${appName}`);
    expect(appLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );

    const libLintResults = await runCLIAsync(`lint ${libName}`);
    expect(libLintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );
  });

  it('should serve with metro', async () => {
    let process: ChildProcess;
    const port = 8051;

    try {
      process = await runCommandUntil(
        `serve ${appName} --interactive=false --port=${port}`,
        (output) => {
          return (
            output.includes(`http://localhost::${port}`) ||
            output.includes('Starting JS server...')
          );
        }
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    try {
      if (process && process.pid) {
        await promisifiedTreeKill(process.pid, 'SIGKILL');
        await killPorts(port);
      }
    } catch (err) {
      expect(err).toBeFalsy();
    }
  });

  it('should export', async () => {
    const exportResults = await runCLIAsync(
      `export ${appName} --no-interactive`
    );
    expect(exportResults.combinedOutput).toContain(
      'Successfully ran target export for project'
    );
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/metadata.json`
    );
  });

  it('should prebuild', async () => {
    // run prebuild command with git check disable
    // set a mock package name for ios and android in expo's app.json
    const root = `apps/${appName}`;
    const appJsonPath = join(root, `app.json`);
    const appJson = await readJson(appJsonPath);
    if (appJson.expo.ios) {
      appJson.expo.ios.bundleIdentifier = 'nx.test';
    }
    if (appJson.expo.android) {
      appJson.expo.android.package = 'nx.test';
    }
    updateFile(appJsonPath, JSON.stringify(appJson));

    // run prebuild command with git check disable
    process.env['EXPO_NO_GIT_STATUS'] = 'true';
    const prebuildResult = await runCLIAsync(
      `prebuild ${appName} --no-interactive --install=false`
    );
    expect(prebuildResult.combinedOutput).toContain(
      'Successfully ran target prebuild for project'
    );
  });

  it('should install', async () => {
    // run install command
    let installResults = await runCLIAsync(
      `install ${appName} --no-interactive --force`
    );
    expect(installResults.combinedOutput).toContain(
      'Successfully ran target install'
    );

    installResults = await runCLIAsync(
      `install ${appName} --force --packages=@react-native-async-storage/async-storage,react-native-image-picker --no-interactive`
    );
    expect(installResults.combinedOutput).toContain(
      'Successfully ran target install'
    );
    const packageJson = readJson(join('apps', appName, 'package.json'));
    expect(packageJson).toMatchObject({
      dependencies: {
        '@react-native-async-storage/async-storage': '*',
        'react-native-image-picker': '*',
      },
    });
  });

  it('should start', async () => {
    const port = 8041;
    // run start command
    const startProcess = await runCommandUntil(
      `start ${appName} -- --port=${port}`,
      (output) => output.includes(`http://localhost:${port}`)
    );

    // port and process cleanup
    try {
      await promisifiedTreeKill(startProcess.pid, 'SIGKILL');
      await killPorts(port);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  });

  it('should build publishable library', async () => {
    expect(() => {
      runCLI(`build ${libName}`);
      checkFilesExist(`dist/libs/${libName}/index.esm.js`);
      checkFilesExist(`dist/libs/${libName}/src/index.d.ts`);
    }).not.toThrow();
  });

  it('should tsc app', async () => {
    expect(() => {
      const pmc = getPackageManagerCommand();
      runCommand(
        `${pmc.runUninstalledPackage} tsc -p apps/${appName}/tsconfig.app.json`
      );
      checkFilesExist(
        `dist/out-tsc/apps/${appName}/src/app/App.js`,
        `dist/out-tsc/apps/${appName}/src/app/App.d.ts`,
        `dist/out-tsc/libs/${libName}/src/index.js`,
        `dist/out-tsc/libs/${libName}/src/index.d.ts`
      );
    }).not.toThrow();
  });

  it('should support generating projects with the new name and root format', () => {
    const appName = uniq('app1');
    const libName = uniq('@my-org/lib1');

    runCLI(
      `generate @nx/expo:application ${appName} --no-interactive --unitTestRunner=jest --linter=eslint`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/src/app/App.tsx`);
    // check tests pass
    const appTestResult = runCLI(`test ${appName}`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );

    runCLI(
      `generate @nx/expo:library ${libName} --buildable --unitTestRunner=jest --linter=eslint`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${libName}/src/index.ts`);
    // check tests pass
    const libTestResult = runCLI(`test ${libName}`);
    expect(libTestResult).toContain(
      `Successfully ran target test for project ${libName}`
    );
  });

  it('should create storybook with application', async () => {
    runCLI(
      `generate @nx/react:storybook-configuration ${appName} --generateStories --no-interactive`
    );
    checkFilesExist(
      `apps/${appName}/.storybook/main.ts`,
      `apps/${appName}/src/app/App.stories.tsx`
    );
  });

  it('should run e2e for cypress', async () => {
    if (runE2ETests()) {
      const results = runCLI(`e2e ${appName}-e2e`);
      expect(results).toContain('Successfully ran target e2e');

      // port and process cleanup
      try {
        await killPorts(4200);
      } catch (err) {
        expect(err).toBeFalsy();
      }
    }
  });

  it('should run e2e for cypress with configuration ci', async () => {
    if (runE2ETests()) {
      const results = runCLI(`e2e ${appName}-e2e --configuration=ci`);
      expect(results).toContain('Successfully ran target e2e');

      // port and process cleanup
      try {
        await killPorts(4200);
      } catch (err) {
        expect(err).toBeFalsy();
      }
    }
  });

  it('should run e2e for playwright', async () => {
    const appName2 = uniq('my-app');
    runCLI(
      `generate @nx/expo:application ${appName2} --e2eTestRunner=playwright --no-interactive --unitTestRunner=jest --linter=eslint`
    );
    if (runE2ETests()) {
      const results = runCLI(`e2e ${appName2}-e2e`, { verbose: true });
      expect(results).toContain('Successfully ran target e2e');

      // port and process cleanup
      try {
        await killPorts(4200);
      } catch (err) {
        expect(err).toBeFalsy();
      }
    }
  });
});
