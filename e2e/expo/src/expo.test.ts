import {
  checkFilesExist,
  cleanupProject,
  expectTestsPass,
  newProject,
  readJson,
  readResolvedConfiguration,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { join } from 'path';

describe('expo', () => {
  let proj: string;

  beforeEach(
    () => (proj = newProject({ name: uniq('proj'), packageManager: 'npm' }))
  );
  afterEach(() => cleanupProject());

  it('should test, lint, export, export-web and prebuild', async () => {
    const appName = uniq('my-app');
    const libName = uniq('lib');
    const componentName = uniq('component');

    runCLI(`generate @nrwl/expo:application ${appName} --no-interactive`);
    runCLI(`generate @nrwl/expo:library ${libName} --no-interactive`);
    runCLI(
      `generate @nrwl/expo:component ${componentName} --project=${libName} --export --no-interactive`
    );
    expectTestsPass(await runCLIAsync(`test ${appName}`));
    expectTestsPass(await runCLIAsync(`test ${libName}`));

    updateFile(`apps/${appName}/src/app/App.tsx`, (content) => {
      let updated = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport {${componentName}} from '${proj}/${libName}';\n${content}`;
      return updated;
    });

    expectTestsPass(await runCLIAsync(`test ${appName}`));

    const appLintResults = await runCLIAsync(`lint ${appName}`);
    expect(appLintResults.combinedOutput).toContain('All files pass linting.');

    const libLintResults = await runCLIAsync(`lint ${libName}`);
    expect(libLintResults.combinedOutput).toContain('All files pass linting.');

    const exportResults = await runCLIAsync(
      `export ${appName} --no-interactive`
    );
    expect(exportResults.combinedOutput).toContain(
      'Export was successful. Your exported files can be found'
    );
    checkFilesExist(`dist/apps/${appName}/metadata.json`);

    expect(() => {
      runCLI(`export-web ${appName}`);
      checkFilesExist(`apps/${appName}/web-build/index.html`);
      checkFilesExist(`apps/${appName}/web-build/manifest.json`);
    }).not.toThrow();

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
      `prebuild ${appName} --no-interactive`
    );
    expect(prebuildResult.combinedOutput).toContain('Config synced');
  }, 1_000_000);

  it('should build publishable library', async () => {
    const libName = uniq('lib');
    const componentName = uniq('component');

    runCLI(
      `generate @nrwl/expo:library ${libName} --buildable --publishable --importPath=${proj}/${libName}`
    );
    runCLI(
      `generate @nrwl/expo:component ${componentName} --project=${libName} --export`
    );
    expect(() => {
      runCLI(`build ${libName}`);
      checkFilesExist(`dist/libs/${libName}/index.js`);
      checkFilesExist(`dist/libs/${libName}/src/index.d.ts`);
    }).not.toThrow();
  });
});
