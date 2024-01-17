import {
  checkFilesExist,
  cleanupProject,
  expectTestsPass,
  getPackageManagerCommand,
  isOSX,
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
import { ChildProcess } from 'child_process';
import { join } from 'path';

describe('react native', () => {
  let proj: string;
  let appName = uniq('my-app');
  let libName = uniq('lib');

  beforeAll(() => {
    proj = newProject();
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
    runCLI(
      `generate @nx/react-native:application ${appName} --install=false --no-interactive`
    );
    runCLI(
      `generate @nx/react-native:library ${libName} --buildable --publishable --importPath=${proj}/${libName} --no-interactive`
    );
  });
  afterAll(() => cleanupProject());

  it('should test and lint', async () => {
    const componentName = uniq('Component');
    runCLI(
      `generate @nx/react-native:component ${componentName} --project=${libName} --export --no-interactive`
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

  it('should bundle-ios', async () => {
    const iosBundleResult = await runCLIAsync(
      `bundle-ios ${appName} --sourcemapOutput=../../dist/apps/${appName}/ios/main.map`
    );
    expect(iosBundleResult.combinedOutput).toContain(
      'Done writing bundle output'
    );
    expect(() => {
      checkFilesExist(`dist/apps/${appName}/ios/main.jsbundle`);
      checkFilesExist(`dist/apps/${appName}/ios/main.map`);
    }).not.toThrow();
  });

  it('should bundle-android', async () => {
    const androidBundleResult = await runCLIAsync(
      `bundle-android ${appName} --sourcemapOutput=../../dist/apps/${appName}/android/main.map`
    );
    expect(androidBundleResult.combinedOutput).toContain(
      'Done writing bundle output'
    );
    expect(() => {
      checkFilesExist(`dist/apps/${appName}/android/main.jsbundle`);
      checkFilesExist(`dist/apps/${appName}/android/main.map`);
    }).not.toThrow();
  });

  it('should start', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `start ${appName} --interactive=false --port=${port}`,
        (output) => {
          return (
            output.includes(`http://localhost:${port}`) ||
            output.includes('Starting JS server...') ||
            output.includes('Welcome to Metro')
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

  if (isOSX()) {
    // TODO(@meeroslav): this test is causing git-hasher to overflow with arguments. Enable when it's fixed.
    xit('should pod install', async () => {
      expect(async () => {
        await runCLIAsync(`pod-install ${appName}`);
        checkFilesExist(`apps/${appName}/ios/Podfile.lock`);
      }).not.toThrow();
    });
  }

  it('should create storybook with application', async () => {
    runCLI(
      `generate @nx/react-native:storybook-configuration ${appName} --generateStories --no-interactive`
    );
    expect(() =>
      checkFilesExist(
        `.storybook/story-loader.ts`,
        `apps/${appName}/src/storybook/storybook.ts`,
        `apps/${appName}/src/storybook/toggle-storybook.tsx`,
        `apps/${appName}/src/app/App.stories.tsx`
      )
    ).not.toThrow();

    await runCLIAsync(`storybook ${appName}`);
    const result = readJson(join('apps', appName, 'package.json'));
    expect(result).toMatchObject({
      dependencies: {
        '@storybook/addon-ondevice-actions': '*',
        '@storybook/addon-ondevice-backgrounds': '*',
        '@storybook/addon-ondevice-controls': '*',
        '@storybook/addon-ondevice-notes': '*',
      },
    });
  });

  it('should upgrade native for application', async () => {
    expect(() =>
      runCLI(
        `generate @nx/react-native:upgrade-native ${appName} --install=false`
      )
    ).not.toThrow();
  });

  it('should build publishable library', async () => {
    const componentName = uniq('Component');

    runCLI(
      `generate @nx/react-native:component ${componentName} --project=${libName} --export`
    );
    expect(() => {
      runCLI(`build ${libName}`);
      checkFilesExist(`dist/libs/${libName}/index.esm.js`);
      checkFilesExist(`dist/libs/${libName}/src/index.d.ts`);
    }).not.toThrow();
  });

  it('sync npm dependencies for autolink', async () => {
    // Add npm package with native modules
    updateFile(join('package.json'), (content) => {
      const json = JSON.parse(content);
      json.dependencies['react-native-image-picker'] = '5.3.1';
      json.dependencies['@react-native-async-storage/async-storage'] = '1.18.1';
      return JSON.stringify(json, null, 2);
    });
    runCommand(`${getPackageManagerCommand().install}`);

    // Add import for Nx to pick up
    updateFile(join('apps', appName, 'src/app/App.tsx'), (content) => {
      return `import AsyncStorage from '@react-native-async-storage/async-storage';${content}`;
    });

    await runCLIAsync(
      `sync-deps ${appName} --include=react-native-image-picker`
    );

    const result = readJson(join('apps', appName, 'package.json'));
    expect(result).toMatchObject({
      dependencies: {
        'react-native-image-picker': '*',
        'react-native': '*',
        '@react-native-async-storage/async-storage': '*',
      },
    });
  });

  it('should tsc app', async () => {
    expect(() => {
      const pmc = getPackageManagerCommand();
      runCommand(
        `${pmc.runUninstalledPackage} tsc -p apps/${appName}/tsconfig.app.json`
      );
      checkFilesExist(
        `dist/out-tsc/apps/${appName}/src/main.js`,
        `dist/out-tsc/apps/${appName}/src/main.d.ts`,
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
      `generate @nx/react-native:application ${appName} --project-name-and-root-format=as-provided --install=false --no-interactive`
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
        `generate @nx/react-native:library ${libName} --buildable --project-name-and-root-format=derived`
      )
    ).toThrow();

    runCLI(
      `generate @nx/react-native:library ${libName} --buildable --project-name-and-root-format=as-provided`
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
