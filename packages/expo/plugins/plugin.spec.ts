import { CreateNodesContext } from '@nx/devkit';
import * as configUtils from '@nx/devkit/internal';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { setupWorkspaceContext } from 'nx/src/utils/workspace-context';
import { resolve } from 'path';
import { createNodesV2, ExpoPluginOptions } from './plugin';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe('@nx/expo/plugin', () => {
  const createNodesFunction = createNodesV2[1];
  const options: ExpoPluginOptions = {};
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd: string;
  let loadConfigFileSpy: jest.SpyInstance;

  beforeEach(() => {
    tempFs = new TempFs('expo-plugin');
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

  it('should create nodes for an Expo app config', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/mobile/app.json': '{ "expo": { "name": "mobile" } }',
      'apps/mobile/package.json': '{}',
      'apps/mobile/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const results = await createNodesFunction(
      ['apps/mobile/app.json'],
      options,
      context
    );

    expect(results).toHaveLength(1);
    const [configFile, result] = results[0];
    expect(configFile).toBe('apps/mobile/app.json');
    expect(Object.keys(result.projects['apps/mobile'].targets)).toEqual([
      'start',
      'serve',
      'run-ios',
      'run-android',
      'export',
      'install',
      'prebuild',
      'build',
      'submit',
    ]);
  });

  it('should include a project whose package.json depends on expo even if the app config has no expo key', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/mobile/app.json': '{ "name": "mobile" }',
      'apps/mobile/package.json': '{ "dependencies": { "expo": "*" } }',
      'apps/mobile/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const results = await createNodesFunction(
      ['apps/mobile/app.json'],
      options,
      context
    );

    expect(results).toHaveLength(1);
  });

  it('should exclude projects that are not Expo apps', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      // no expo key and no expo dependency
      'apps/rn/app.json': '{ "name": "rn" }',
      'apps/rn/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn/metro.config.js': '',
      // missing metro.config.js
      'apps/other/app.json': '{ "expo": { "name": "other" } }',
      'apps/other/package.json': '{}',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const results = await createNodesFunction(
      ['apps/rn/app.json', 'apps/other/app.json'],
      options,
      context
    );

    expect(results).toHaveLength(0);
  });

  it('should make per-config-file decisions within the same project root', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      // app.json alone does not qualify; app.config.js does
      'apps/mobile/app.json': '{ "name": "mobile" }',
      'apps/mobile/app.config.js':
        'module.exports = { expo: { name: "mobile" } };',
      'apps/mobile/package.json': '{}',
      'apps/mobile/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const results = await createNodesFunction(
      ['apps/mobile/app.json', 'apps/mobile/app.config.js'],
      options,
      context
    );

    expect(results.map(([configFile]) => configFile)).toEqual([
      'apps/mobile/app.config.js',
    ]);
  });

  it('should not execute any app config on a warm cache when nothing changed', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/mobile/app.json': '{ "expo": { "name": "mobile" } }',
      'apps/mobile/package.json': '{}',
      'apps/mobile/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    // Cold run populates the on-disk cache.
    const coldResults = await createNodesFunction(
      ['apps/mobile/app.json'],
      options,
      context
    );
    expect(loadedConfigPaths()).toContain(abs('apps/mobile/app.json'));

    // Warm run: cached filter decision and targets -> no load.
    loadConfigFileSpy.mockClear();
    const warmResults = await createNodesFunction(
      ['apps/mobile/app.json'],
      options,
      context
    );
    expect(loadConfigFileSpy).not.toHaveBeenCalled();
    expect(warmResults).toEqual(coldResults);
  });

  it('should cache the exclusion decision as well', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/rn/app.json': '{ "name": "rn" }',
      'apps/rn/package.json': '{ "dependencies": { "react-native": "*" } }',
      'apps/rn/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    await createNodesFunction(['apps/rn/app.json'], options, context);
    expect(loadedConfigPaths()).toContain(abs('apps/rn/app.json'));

    loadConfigFileSpy.mockClear();
    const warmResults = await createNodesFunction(
      ['apps/rn/app.json'],
      options,
      context
    );
    expect(loadConfigFileSpy).not.toHaveBeenCalled();
    expect(warmResults).toHaveLength(0);
  });

  it('should re-evaluate only the project that changed', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/mobile-a/app.json': '{ "expo": { "name": "mobile-a" } }',
      'apps/mobile-a/package.json': '{}',
      'apps/mobile-a/metro.config.js': '',
      'apps/mobile-b/app.json': '{ "expo": { "name": "mobile-b" } }',
      'apps/mobile-b/package.json': '{}',
      'apps/mobile-b/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const configFiles = ['apps/mobile-a/app.json', 'apps/mobile-b/app.json'];
    await createNodesFunction(configFiles, options, context);

    // Change only mobile-a's project files -> only its key moves.
    loadConfigFileSpy.mockClear();
    tempFs.writeFile(
      'apps/mobile-a/app.json',
      '{ "expo": { "name": "mobile-a-renamed" } }'
    );
    setupWorkspaceContext(tempFs.tempDir);
    await createNodesFunction(configFiles, options, context);

    const reloaded = loadedConfigPaths();
    expect(reloaded).toContain(abs('apps/mobile-a/app.json'));
    expect(reloaded).not.toContain(abs('apps/mobile-b/app.json'));
  });

  it('should re-execute js/ts configs whose decision is not pinned by package.json', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      // included only because the executed config exports an expo key; that
      // decision can depend on inputs outside the cache key, so it is
      // re-evaluated on every run
      'apps/mobile/app.config.js':
        'module.exports = { expo: { name: "mobile" } };',
      'apps/mobile/package.json': '{}',
      'apps/mobile/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const coldResults = await createNodesFunction(
      ['apps/mobile/app.config.js'],
      options,
      context
    );
    expect(coldResults).toHaveLength(1);

    loadConfigFileSpy.mockClear();
    const warmResults = await createNodesFunction(
      ['apps/mobile/app.config.js'],
      options,
      context
    );
    expect(loadedConfigPaths()).toContain(abs('apps/mobile/app.config.js'));
    expect(warmResults).toEqual(coldResults);
  });

  it('should not re-execute js/ts configs when package.json declares expo', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/mobile/app.config.js': 'module.exports = { name: "mobile" };',
      'apps/mobile/package.json': '{ "dependencies": { "expo": "*" } }',
      'apps/mobile/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    const coldResults = await createNodesFunction(
      ['apps/mobile/app.config.js'],
      options,
      context
    );
    expect(coldResults).toHaveLength(1);

    // The package.json dependency pins the decision regardless of what the
    // config exports, so the cached decision is sound and no load happens.
    loadConfigFileSpy.mockClear();
    const warmResults = await createNodesFunction(
      ['apps/mobile/app.config.js'],
      options,
      context
    );
    expect(loadConfigFileSpy).not.toHaveBeenCalled();
    expect(warmResults).toEqual(coldResults);
  });

  it('should not mutate user-provided options', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/mobile/app.json': '{ "expo": { "name": "mobile" } }',
      'apps/mobile/package.json': '{}',
      'apps/mobile/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    // The daemon passes the same options object on every invocation; mutating
    // it would change the option-derived hashes between runs.
    const userOptions: ExpoPluginOptions = { startTargetName: 'dev' };
    await createNodesFunction(['apps/mobile/app.json'], userOptions, context);

    expect(userOptions).toEqual({ startTargetName: 'dev' });
  });

  it('should resurface app config load errors on every run', async () => {
    await tempFs.createFiles({
      'package-lock.json': '{}',
      'apps/mobile/app.config.js': 'throw new Error("broken config");',
      'apps/mobile/package.json': '{}',
      'apps/mobile/metro.config.js': '',
    });
    setupWorkspaceContext(tempFs.tempDir);

    await expect(
      createNodesFunction(['apps/mobile/app.config.js'], options, context)
    ).rejects.toThrow();

    // Errors are not cached: the config is executed and fails again.
    loadConfigFileSpy.mockClear();
    await expect(
      createNodesFunction(['apps/mobile/app.config.js'], options, context)
    ).rejects.toThrow();
    expect(loadedConfigPaths()).toContain(abs('apps/mobile/app.config.js'));
  });
});
