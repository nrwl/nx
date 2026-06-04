import { CreateNodesContext } from '@nx/devkit';
import * as configUtils from '@nx/devkit/internal';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { setupWorkspaceContext } from 'nx/src/utils/workspace-context';
import { resolve } from 'path';
import { createNodesV2, ReactNativePluginOptions } from './plugin';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe('@nx/react-native/plugin', () => {
  const createNodesFunction = createNodesV2[1];
  const options: ReactNativePluginOptions = {};
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd: string;
  let loadConfigFileSpy: jest.SpyInstance;

  beforeEach(() => {
    tempFs = new TempFs('react-native-plugin');
    cwd = process.cwd();
    process.chdir(tempFs.tempDir);
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };
    // Spy with call-through: configs still load, we just count executions.
    loadConfigFileSpy = jest.spyOn(configUtils, 'loadConfigFile');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    tempFs.cleanup();
    process.chdir(cwd);
  });

  // Absolute path as the plugin computes it (join(workspaceRoot, file)).
  const abs = (file: string) => resolve(tempFs.tempDir, file);
  const loadedConfigPaths = () =>
    loadConfigFileSpy.mock.calls.map((call) => call[0] as string);

  it('should create nodes for a React Native app config', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/rn/app.json': '{ "name": "rn" }',
      'apps/rn/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const results = await createNodesFunction(
      ['apps/rn/app.json'],
      options,
      context
    );

    expect(results).toHaveLength(1);
    const [configFile, result] = results[0];
    expect(configFile).toBe('apps/rn/app.json');
    expect(Object.keys(result.projects['apps/rn'].targets)).toEqual([
      'start',
      'pod-install',
      'run-ios',
      'run-android',
      'build-ios',
      'build-android',
      'bundle',
      'sync-deps',
      'upgrade',
    ]);
  });

  it('should exclude Expo projects and projects without metro config', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      // expo key in the app config
      'apps/expo-a/app.json': '{ "expo": { "name": "expo-a" } }',
      'apps/expo-a/package.json': '{}',
      'apps/expo-a/metro.config.js': '',
      // expo dependency in package.json
      'apps/expo-b/app.json': '{ "name": "expo-b" }',
      'apps/expo-b/package.json': '{ "dependencies": { "expo": "*" } }',
      'apps/expo-b/metro.config.js': '',
      // missing metro.config.js
      'apps/other/app.json': '{ "name": "other" }',
      'apps/other/package.json': '{}',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const results = await createNodesFunction(
      ['apps/expo-a/app.json', 'apps/expo-b/app.json', 'apps/other/app.json'],
      options,
      context
    );

    expect(results).toHaveLength(0);
  });

  it('should not execute any app config on a warm cache when nothing changed', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/rn/app.json': '{ "name": "rn" }',
      'apps/rn/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    // Cold run populates the on-disk cache.
    const coldResults = await createNodesFunction(
      ['apps/rn/app.json'],
      options,
      context
    );
    expect(loadedConfigPaths()).toContain(abs('apps/rn/app.json'));

    // Warm run: cached filter decision and targets -> no load.
    loadConfigFileSpy.mockClear();
    const warmResults = await createNodesFunction(
      ['apps/rn/app.json'],
      options,
      context
    );
    expect(loadConfigFileSpy).not.toHaveBeenCalled();
    expect(warmResults).toEqual(coldResults);
  });

  it('should cache the exclusion decision as well', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/expo/app.json': '{ "expo": { "name": "expo" } }',
      'apps/expo/package.json': '{}',
      'apps/expo/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    await createNodesFunction(['apps/expo/app.json'], options, context);
    expect(loadedConfigPaths()).toContain(abs('apps/expo/app.json'));

    loadConfigFileSpy.mockClear();
    const warmResults = await createNodesFunction(
      ['apps/expo/app.json'],
      options,
      context
    );
    expect(loadConfigFileSpy).not.toHaveBeenCalled();
    expect(warmResults).toHaveLength(0);
  });

  it('should re-evaluate only the project that changed', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/rn-a/app.json': '{ "name": "rn-a" }',
      'apps/rn-a/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn-a/metro.config.js': '',
      'apps/rn-b/app.json': '{ "name": "rn-b" }',
      'apps/rn-b/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn-b/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const configFiles = ['apps/rn-a/app.json', 'apps/rn-b/app.json'];
    await createNodesFunction(configFiles, options, context);

    // Change only rn-a's project files -> only its key moves.
    loadConfigFileSpy.mockClear();
    tempFs.writeFile('apps/rn-a/app.json', '{ "name": "rn-a-renamed" }');
    setupWorkspaceContext(tempFs.tempDir);
    await createNodesFunction(configFiles, options, context);

    const reloaded = loadedConfigPaths();
    expect(reloaded).toContain(abs('apps/rn-a/app.json'));
    expect(reloaded).not.toContain(abs('apps/rn-b/app.json'));
  });

  it('should re-execute js/ts configs whose decision is not pinned by package.json', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      // included only because the executed config exports no expo key; that
      // decision can depend on inputs outside the cache key, so it is
      // re-evaluated on every run
      'apps/rn/app.config.js': 'module.exports = { name: "rn" };',
      'apps/rn/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const coldResults = await createNodesFunction(
      ['apps/rn/app.config.js'],
      options,
      context
    );
    expect(coldResults).toHaveLength(1);

    loadConfigFileSpy.mockClear();
    const warmResults = await createNodesFunction(
      ['apps/rn/app.config.js'],
      options,
      context
    );
    expect(loadedConfigPaths()).toContain(abs('apps/rn/app.config.js'));
    expect(warmResults).toEqual(coldResults);
  });

  it('should not re-execute js/ts configs when package.json declares expo', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/expo/app.config.js': 'module.exports = { name: "expo" };',
      'apps/expo/package.json': '{ "dependencies": { "expo": "*" } }',
      'apps/expo/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    await createNodesFunction(['apps/expo/app.config.js'], options, context);
    expect(loadedConfigPaths()).toContain(abs('apps/expo/app.config.js'));

    // The package.json dependency pins the exclusion regardless of what the
    // config exports, so the cached decision is sound and no load happens.
    loadConfigFileSpy.mockClear();
    const warmResults = await createNodesFunction(
      ['apps/expo/app.config.js'],
      options,
      context
    );
    expect(loadConfigFileSpy).not.toHaveBeenCalled();
    expect(warmResults).toHaveLength(0);
  });

  it('should not mutate user-provided options', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/rn/app.json': '{ "name": "rn" }',
      'apps/rn/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    // The daemon passes the same options object on every invocation; mutating
    // it would change the option-derived hashes between runs.
    const userOptions: ReactNativePluginOptions = { startTargetName: 'dev' };
    await createNodesFunction(['apps/rn/app.json'], userOptions, context);

    expect(userOptions).toEqual({ startTargetName: 'dev' });
  });

  it('should resurface app config load errors on every run', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/rn/app.config.js': 'throw new Error("broken config");',
      'apps/rn/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    await expect(
      createNodesFunction(['apps/rn/app.config.js'], options, context)
    ).rejects.toThrow();

    // Errors are not cached: the config is executed and fails again.
    loadConfigFileSpy.mockClear();
    await expect(
      createNodesFunction(['apps/rn/app.config.js'], options, context)
    ).rejects.toThrow();
    expect(loadedConfigPaths()).toContain(abs('apps/rn/app.config.js'));
  });
});
