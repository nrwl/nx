import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  isOSX,
  killProcessAndPorts,
  newProject,
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

describe('@nx/react-native (legacy)', () => {
  let proj: string;
  let appName = uniq('my-app');
  let libName = uniq('lib');
  let originalEnv: string;

  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';

    proj = newProject();
    // we create empty preset above which skips creation of `production` named input
    updateJson('nx.json', (nxJson) => {
      nxJson.namedInputs = {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: ['default'],
        sharedGlobals: [],
      };
      return nxJson;
    });
    runCLI(
      `generate @nx/react-native:application ${appName} --directory=apps/${appName} --bunlder=webpack --e2eTestRunner=cypress --install=false --no-interactive`
    );
    runCLI(
      `generate @nx/react-native:library ${libName} --directory=libs/${libName} --buildable --publishable --importPath=${proj}/${libName} --no-interactive`
    );
  });
  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  it('should build for web', async () => {
    expect(() => runCLI(`build ${appName}`)).not.toThrow();
  });

  it('should test and lint', async () => {
    const componentName = uniq('Component');
    runCLI(
      `generate @nx/react-native:component libs/${libName}/src/lib/${componentName}/${componentName} --export --no-interactive`
    );

    updateFile(`apps/${appName}/src/app/App.tsx`, (content) => {
      let updated = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport {${componentName}} from '${proj}/${libName}';\n${content}`;
      return updated;
    });

    expect(() => runCLI(`test ${appName}`)).not.toThrow();
    expect(() => runCLI(`test ${libName}`)).not.toThrow();
    expect(() => runCLI(`lint ${appName}`)).not.toThrow();
    expect(() => runCLI(`lint ${libName}`)).not.toThrow();
  });

  it('should run e2e for cypress', async () => {
    if (runE2ETests()) {
      expect(() => runCLI(`e2e ${appName}-e2e`)).not.toThrow();

      expect(() =>
        runCLI(`e2e ${appName}-e2e --configuration=ci`)
      ).not.toThrow();
    }
  });

  it('should bundle-ios', async () => {
    expect(() =>
      runCLI(
        `bundle-ios ${appName} --sourcemapOutput=../../dist/apps/${appName}/ios/main.map`
      )
    ).not.toThrow();
    expect(() => {
      checkFilesExist(`dist/apps/${appName}/ios/main.jsbundle`);
      checkFilesExist(`dist/apps/${appName}/ios/main.map`);
    }).not.toThrow();
  });

  it('should bundle-android', async () => {
    expect(() =>
      runCLI(
        `bundle-android ${appName} --sourcemapOutput=../../dist/apps/${appName}/android/main.map`
      )
    ).not.toThrow();

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
        await killProcessAndPorts(process.pid, port);
      }
    } catch (err) {
      expect(err).toBeFalsy();
    }
  });

  it('should serve', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `serve ${appName} --interactive=false --port=${port}`,
        (output) => {
          return output.includes(`http://localhost:${port}`);
        }
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    try {
      if (process && process.pid) {
        await killProcessAndPorts(process.pid, port);
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
    checkFilesExist(
      `apps/${appName}/.storybook/main.ts`,
      `apps/${appName}/src/app/App.stories.tsx`
    );
  });

  // TODO(@xiongemi): Look into this test failing on macos
  xit('should upgrade native for application', async () => {
    expect(() => runCLI(`upgrade ${appName}`)).not.toThrow();
  });

  it('should build publishable library', async () => {
    const componentName = uniq('Component');

    runCLI(
      `generate @nx/react-native:component libs/${libName}/src/lib/${componentName}/${componentName} --export`
    );
    expect(() => {
      runCLI(`build ${libName}`);
      checkFilesExist(`dist/libs/${libName}/index.esm.js`);
      checkFilesExist(`dist/libs/${libName}/src/index.d.ts`);
    }).not.toThrow();
  });

  it('sync npm dependencies for autolink', async () => {
    // Add npm package with native modules
    runCommand(
      `${
        getPackageManagerCommand().addDev
      } react-native-image-picker @react-native-async-storage/async-storage`
    );

    // Add import for Nx to pick up
    updateFile(join('apps', appName, 'src/app/App.tsx'), (content) => {
      return `import AsyncStorage from '@react-native-async-storage/async-storage';${content}`;
    });

    await runCLIAsync(`sync-deps ${appName}`);
    let result = readJson(join('apps', appName, 'package.json'));
    expect(result).toMatchObject({
      dependencies: {
        '@react-native-async-storage/async-storage': '*',
      },
    });

    await runCLIAsync(
      `sync-deps ${appName} --include=react-native-image-picker`
    );
    result = readJson(join('apps', appName, 'package.json'));
    expect(result).toMatchObject({
      dependencies: {
        '@react-native-async-storage/async-storage': '*',
        'react-native-image-picker': '*',
      },
    });

    await runCLIAsync(`sync-deps ${appName} --all`);
    result = readJson(join('apps', appName, 'package.json'));
    expect(result).toMatchObject({
      dependencies: {
        '@react-native-async-storage/async-storage': '*',
        'react-native-image-picker': '*',
      },
      devDependencies: {
        '@nx/react-native': '*',
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
      `generate @nx/react-native:application ${appName} --install=false --no-interactive`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/src/app/App.tsx`);
    // check tests pass
    expect(() => runCLI(`test ${appName}`)).not.toThrow();

    runCLI(`generate @nx/react-native:library ${libName} --buildable`);

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${libName}/src/index.ts`);
    // check tests pass
    expect(() => runCLI(`test ${libName}`)).not.toThrow();
  });

  it('should run build with vite bundler and e2e with playwright', async () => {
    const appName2 = uniq('my-app');
    runCLI(
      `generate @nx/react-native:application ${appName2} --directory=apps/${appName2} --bundler=vite --e2eTestRunner=playwright --install=false --no-interactive`
    );
    expect(() => runCLI(`build ${appName2}`)).not.toThrow();
    if (runE2ETests()) {
      expect(() => runCLI(`e2e ${appName2}-e2e`)).not.toThrow();
    }

    runCLI(
      `generate @nx/react-native:storybook-configuration ${appName2} --generateStories --no-interactive`
    );
    checkFilesExist(
      `apps/${appName2}/.storybook/main.ts`,
      `apps/${appName2}/src/app/App.stories.tsx`
    );
  });
});
