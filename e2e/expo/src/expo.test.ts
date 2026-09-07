import { ChildProcess } from 'child_process';
import { renameSync } from 'fs';
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
  exists,
  removeFile,
  runCommand,
  tmpProjPath,
  reservePort,
} from '@nx/e2e-utils';
import { join } from 'path';
import { setupExpoEnv } from './setup';

describe('@nx/expo', () => {
  let appName: string;
  let libName: string;
  let restoreExpoEnv: () => void;

  beforeAll(() => {
    restoreExpoEnv = setupExpoEnv();

    newProject({
      packages: [
        '@nx/cypress',
        '@nx/expo',
        '@nx/jest',
        '@nx/react',
        '@nx/rollup',
        '@nx/storybook',
      ],
    });
    appName = uniq('app');
    libName = uniq('lib');
    // Uses `--e2eTestRunner=cypress`, whose fresh config @nx/cypress now
    // generates via base-setup templating (no tsquery).
    runCLI(
      `generate @nx/expo:app ${appName} --no-interactive --unitTestRunner=jest --e2eTestRunner=cypress --linter=eslint`
    );
    runCLI(
      `generate @nx/expo:library ${libName} --buildable --publishable --importPath=@proj/${libName} --unitTestRunner=jest --linter=eslint`
    );
  });

  afterAll(() => {
    restoreExpoEnv();
    cleanupProject();
  });

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

  it('should test, lint and build library', async () => {
    const componentName = uniq('Component');

    runCLI(
      `generate @nx/expo:component ${libName}/src/${componentName} --name ${componentName} --export --no-interactive`
    );

    updateFile(`${appName}/src/app/App.tsx`, (content) => {
      let updated = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport {${componentName}} from '@proj/${libName}';\n${content}`;
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

    const buildResults = await runCLIAsync(`build ${libName}`);
    expect(buildResults.combinedOutput).toContain(
      'Successfully ran target build'
    );
    checkFilesExist(
      `dist/${libName}/index.esm.js`,
      `dist/${libName}/src/index.d.ts`
    );
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
    const port = await reservePort();

    try {
      process = await runCommandUntil(
        `start ${appName} -- --port=${port}`,
        (output) => output.includes(`http://localhost:${port}`)
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
    const port = await reservePort();

    try {
      process = await runCommandUntil(
        `serve ${appName} -- --port=${port}`,
        (output) => output.includes(`http://localhost:${port}`)
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    if (process && process.pid) {
      await killProcessAndPorts(process.pid, port);
    }
  });

  it('should derive metro projectRoot and node_modules from the app being bundled', () => {
    createFile(
      'check-metro.js',
      `const { realpathSync } = require('fs');
const { join, resolve } = require('path');
const config = require(join(process.cwd(), process.argv[2], 'metro.config.js'));
console.log(
  'METRO_CHECK ' +
    JSON.stringify({
      projectRoot: config.projectRoot,
      nodeModulesPaths: config.resolver.nodeModulesPaths,
      processExpoMetro: require.resolve('@expo/metro/metro-config'),
      appRoot: realpathSync(resolve(process.argv[2])),
      workspaceRoot: realpathSync(resolve('.')),
      workspaceNodeModules: realpathSync(resolve('node_modules')),
    })
);
`
    );
    const readMergedConfig = () => {
      const output = runCommand(`node check-metro.js ${appName}`, {
        failOnError: true,
      });
      return JSON.parse(output.match(/METRO_CHECK (.*)/)[1]);
    };
    const hadAppNodeModules = exists(
      tmpProjPath(join(appName, 'node_modules'))
    );

    try {
      // SDK 55+ app keeps its own projectRoot
      let config = readMergedConfig();
      expect(config.projectRoot).toBe(config.appRoot);
      expect(config.nodeModulesPaths).toContain(config.workspaceNodeModules);

      // an app pinning its own expo copy stays anchored at the app
      createFile(
        `${appName}/node_modules/expo/package.json`,
        JSON.stringify({ name: 'expo', version: '54.0.0' })
      );
      // shim the subpath metro.config.js requires so the pinned copy still
      // loads the real implementation
      createFile(
        `${appName}/node_modules/expo/metro-config.js`,
        `module.exports = require(require('path').join(__dirname, '..', '..', '..', 'node_modules', 'expo', 'metro-config'));`
      );
      config = readMergedConfig();
      expect(config.projectRoot).toBe(config.appRoot);
      expect(config.nodeModulesPaths[0]).toBe(
        join(config.appRoot, 'node_modules')
      );

      // an SDK 54 app relying on hoisted Expo uses the workspace root even
      // when a sibling app keeps @expo/metro process-resolvable
      removeFile(join(appName, 'node_modules', 'expo'));
      const hoistedExpoPackage = readJson('node_modules/expo/package.json');
      try {
        updateFile(
          'node_modules/expo/package.json',
          JSON.stringify({ ...hoistedExpoPackage, version: '54.0.0' })
        );
        config = readMergedConfig();
        expect(config.processExpoMetro).toBeDefined();
        expect(config.projectRoot).toBe(config.workspaceRoot);
      } finally {
        updateFile(
          'node_modules/expo/package.json',
          JSON.stringify(hoistedExpoPackage)
        );
      }

      // no hoisted expo at all: the app-local copy is the only one, so the
      // app keeps its projectRoot. The workspace expo is hidden while probing,
      // so call withNxMetro directly - the app's metro.config.js cannot load
      // without the hoisted @expo/metro-config resolving expo.
      createFile(
        `${appName}/node_modules/expo/package.json`,
        JSON.stringify({ name: 'expo', version: '54.0.0' })
      );
      createFile(
        'check-metro-direct.js',
        `const { realpathSync } = require('fs');
const { resolve } = require('path');
const { withNxMetro } = require('@nx/expo');
const appRoot = realpathSync(resolve(process.argv[2]));
const config = withNxMetro({
  projectRoot: appRoot,
  resolver: {},
  transformer: { babelTransformerPath: 'babel-transformer' },
});
console.log(
  'METRO_CHECK ' + JSON.stringify({ projectRoot: config.projectRoot, appRoot })
);
`
      );
      const wsExpo = tmpProjPath(join('node_modules', 'expo'));
      const wsExpoHidden = tmpProjPath(join('node_modules', '.expo-hidden'));
      renameSync(wsExpo, wsExpoHidden);
      try {
        const output = runCommand(`node check-metro-direct.js ${appName}`, {
          failOnError: true,
        });
        config = JSON.parse(output.match(/METRO_CHECK (.*)/)[1]);
        expect(config.projectRoot).toBe(config.appRoot);
      } finally {
        renameSync(wsExpoHidden, wsExpo);
        removeFile('check-metro-direct.js');
      }
    } finally {
      // remove only what this test created
      removeFile(join(appName, 'node_modules', 'expo'));
      if (!hadAppNodeModules) {
        removeFile(join(appName, 'node_modules'));
      }
      removeFile('check-metro.js');
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
      `install ${appName} --force --no-interactive`
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
    const packageJson = readJson(join(appName, 'package.json'));
    expect(packageJson).toMatchObject({
      dependencies: {
        '@react-native-async-storage/async-storage': '*',
        'react-native-image-picker': '*',
      },
    });
  });

  it('should run e2e for cypress', async () => {
    if (await runE2ETests()) {
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
      `generate @nx/react:storybook-configuration ${appName} --generateStories --no-interactive --linter=eslint`
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
