import {
  checkFilesExist,
  cleanupProject,
  expectTestsPass,
  getPackageManagerCommand,
  killPorts,
  newProject,
  promisifiedTreeKill,
  readJson,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('expo', () => {
  let proj: string;
  let appName = uniq('my-app');
  let libName = uniq('lib');

  beforeAll(() => {
    proj = newProject({ packages: ['@nx/expo'] });
    // we create empty preset above which skips creation of `production` named input
    updateJson('nx.json', (nxJson) => {
      nxJson.namedInputs = {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: ['default'],
        sharedGlobals: [],
      };
      nxJson.targetDefaults.build.inputs = ['production', '^production'];
      return nxJson;
    });
    runCLI(`generate @nx/expo:application ${appName} --no-interactive`);
    runCLI(
      `generate @nx/expo:library ${libName} --buildable --publishable --importPath=${proj}/${libName}`
    );
  });
  afterAll(() => cleanupProject());

  it('should test and lint', async () => {
    const componentName = uniq('Component');

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
    expect(appLintResults.combinedOutput).toContain('All files pass linting');

    const libLintResults = await runCLIAsync(`lint ${libName}`);
    expect(libLintResults.combinedOutput).toContain('All files pass linting');
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
    expect(prebuildResult.combinedOutput).toContain('Config synced');
  });

  it('should install', async () => {
    // run install command
    const installResults = await runCLIAsync(
      `install ${appName} --no-interactive`
    );
    expect(installResults.combinedOutput).toContain(
      'Successfully ran target install'
    );
  });

  it('should start', async () => {
    // run start command
    const startProcess = await runCommandUntil(
      `start ${appName} -- --port=8081`,
      (output) => output.includes(`http://localhost:8081`)
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
      `generate @nx/expo:application ${appName} --project-name-and-root-format=as-provided --no-interactive`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/src/app/App.tsx`);
    // check tests pass
    const appTestResult = runCLI(`test ${appName}`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );

    // assert scoped project names are not supported when --project-name-and-root-format=derived
    expect(() =>
      runCLI(
        `generate @nx/expo:library ${libName} --buildable --project-name-and-root-format=derived`
      )
    ).toThrow();

    runCLI(
      `generate @nx/expo:library ${libName} --buildable --project-name-and-root-format=as-provided`
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
});
