import {
  checkFilesExist,
  cleanupProject,
  expectTestsPass,
  killPorts,
  newProject,
  promisifiedTreeKill,
  readJson,
  readResolvedConfiguration,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('expo', () => {
  let proj: string;
  let appName = uniq('my-app');
  let libName = uniq('lib');

  beforeAll(() => {
    proj = newProject();
    runCLI(`generate @nx/expo:application ${appName} --no-interactive`);
    runCLI(
      `generate @nx/expo:library ${libName} --buildable --publishable --importPath=${proj}/${libName}`
    );
  });
  afterAll(() => cleanupProject());

  it('should test and lint', async () => {
    const componentName = uniq('component');

    runCLI(
      `generate @nx/expo:component ${componentName} --project=${libName} --export --no-interactive`
    );

    updateFile(`apps/${appName}/src/app/App.tsx`, (content) => {
      let updated = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport {${componentName}} from '${proj}/${libName}';\n${content}`;
      return updated;
    });

    expectTestsPass(await runCLIAsync(`test ${appName}`));
    expectTestsPass(await runCLIAsync(`test ${libName}`));

    const appLintResults = await runCLIAsync(`lint ${appName}`);
    expect(appLintResults.combinedOutput).toContain('All files pass linting.');

    const libLintResults = await runCLIAsync(`lint ${libName}`);
    expect(libLintResults.combinedOutput).toContain('All files pass linting.');
  });

  it('should export', async () => {
    const exportResults = await runCLIAsync(
      `export ${appName} --no-interactive`
    );
    expect(exportResults.combinedOutput).toContain(
      'Export was successful. Your exported files can be found'
    );
    checkFilesExist(`dist/apps/${appName}/metadata.json`);
  });

  it('should export-web', async () => {
    expect(() => {
      runCLI(`export-web ${appName}`);
      checkFilesExist(`apps/${appName}/dist/index.html`);
      checkFilesExist(`apps/${appName}/dist/metadata.json`);
    }).not.toThrow();
  });

  it('should prebuild', async () => {
    // run prebuild command with git check disable
    // set a mock package name for ios and android in expo's app.json
    const workspace = readResolvedConfiguration();
    const root = workspace.projects[appName].root;
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
    expect(prebuildResult.combinedOutput).toContain('Config synced');
  });

  // TODO(emily): expo-cli always fetches the latest version of react native
  // re-enable it when expo-cli is fixed
  xit('should install', async () => {
    // run install command
    const installResults = await runCLIAsync(
      `install ${appName} --no-interactive --check`
    );
    expect(installResults.combinedOutput).toContain(
      'Dependencies are up to date'
    );
  });

  it('should start', async () => {
    // run start command
    const startProcess = await runCommandUntil(
      `start ${appName} -- --port=8081`,
      (output) =>
        output.includes(`Packager is ready at http://localhost:8081`) ||
        output.includes(`Web is waiting on http://localhost:8081`)
    );

    // port and process cleanup
    try {
      await promisifiedTreeKill(startProcess.pid, 'SIGKILL');
      await killPorts(8081);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  });

  it('should build publishable library', async () => {
    expect(() => {
      runCLI(`build ${libName}`);
      checkFilesExist(`dist/libs/${libName}/index.js`);
      checkFilesExist(`dist/libs/${libName}/src/index.d.ts`);
    }).not.toThrow();
  });
});
