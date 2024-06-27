import { ChildProcess } from 'child_process';
import {
  runCLI,
  cleanupProject,
  newProject,
  uniq,
  readJson,
  runCommandUntil,
  killProcessAndPorts,
  checkFilesExist,
  updateFile,
  runCLIAsync,
  runE2ETests,
  killPorts,
  createFile,
  removeFile,
} from 'e2e/utils';
import { join } from 'path';

describe('@nx/expo', () => {
  let appName: string;

  beforeAll(() => {
    newProject();
    appName = uniq('app');
    runCLI(
      `generate @nx/expo:app ${appName} --project-name-and-root-format=as-provided --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

  it('nx.json should contain plugin configuration', () => {
    const nxJson = readJson('nx.json');
    const expoPlugin = nxJson.plugins.find(
      (plugin) => plugin.plugin === '@nx/expo/plugin'
    );
    expect(expoPlugin).toBeDefined();
    expect(expoPlugin.options).toBeDefined();
    expect(expoPlugin.options.exportTargetName).toEqual('export');
    expect(expoPlugin.options.startTargetName).toEqual('start');
  });

  it('should export the app', async () => {
    const result = runCLI(`export ${appName}`);
    checkFilesExist(
      `${appName}/dist/index.html`,
      `${appName}/dist/metadata.json`
    );

    expect(result).toContain(
      `Successfully ran target export for project ${appName}`
    );
  }, 200_000);

  it('should start the app', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `start ${appName} -- --port=${port}`,
        (output) => output.includes(`http://localhost:8081`)
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    if (process && process.pid) {
      await killProcessAndPorts(process.pid, port);
    }
  });

  it('should serve the app', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `serve ${appName} -- --port=${port}`,
        (output) => output.includes(`http://localhost:8081`)
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    if (process && process.pid) {
      await killProcessAndPorts(process.pid, port);
    }
  });

  it('should prebuild', async () => {
    // run prebuild command with git check disable
    // set a mock package name for ios and android in expo's app.json
    const appJsonPath = join(appName, `app.json`);
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
      `install ${appName} --no-interactive`
    );
    expect(installResults.combinedOutput).toContain(
      'Successfully ran target install'
    );

    installResults = await runCLIAsync(
      `install ${appName} --packages=@react-native-async-storage/async-storage,react-native-image-picker --no-interactive`
    );
    expect(installResults.combinedOutput).toContain(
      'Successfully ran target install'
    );
    const packageJson = readJson(join(appName, 'package.json'));
    expect(packageJson).toMatchObject({
      dependencies: {
        '@react-native-async-storage/async-storage': '*',
        'react-native-image-picker': '*',
      },
    });
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

  it('should create storybook with application', async () => {
    runCLI(
      `generate @nx/react:storybook-configuration ${appName} --generateStories --no-interactive`
    );
    checkFilesExist(
      `${appName}/.storybook/main.ts`,
      `${appName}/src/app/App.stories.tsx`
    );
  });

  it('should work with app.config.ts', () => {
    const appJson = join(appName, `app.json`);
    const appJsonContent = readJson(appJson);
    removeFile(appJson);
    createFile(
      join(appName, 'app.config.ts'),
      `export default { expo: { name: 'my-app', slug: 'my-app' } };`
    );
    const result = runCLI(`show project ${appName} --json false`);
    expect(result).toContain('start:');
    expect(result).toContain('serve:');
    createFile(appJson, JSON.stringify(appJsonContent));
  });
});
