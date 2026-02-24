import { PluginCapabilities } from './plugin-capabilities';
import {
  formatPluginCapabilitiesAsJson,
  formatPluginsAsJson,
  listPluginCapabilities,
} from './output';

jest.mock('../workspace-root', () => ({
  workspaceRoot: '/workspace',
}));

jest.mock('../output', () => ({
  output: {
    log: jest.fn(),
    warn: jest.fn(),
    note: jest.fn(),
  },
}));

jest.mock('../package-manager', () => ({
  getPackageManagerCommand: jest.fn().mockReturnValue({
    addDev: 'npm install -D',
    exec: 'npx',
  }),
}));

const mockGetPluginCapabilities = jest.fn();
jest.mock('./plugin-capabilities', () => ({
  getPluginCapabilities: (...args: unknown[]) =>
    mockGetPluginCapabilities(...args),
}));

const { output } = require('../output');

describe('formatPluginCapabilitiesAsJson', () => {
  it('should format a plugin with generators and executors', () => {
    const plugin: PluginCapabilities = {
      name: '@nx/workspace-plugin',
      path: 'tools/workspace-plugin',
      generators: {
        'my-generator': {
          schema: './src/generators/my-generator/schema.json',
          factory: './src/generators/my-generator/generator',
          description: 'My generator description',
        },
      },
      executors: {
        'my-executor': {
          schema: './src/executors/my-executor/schema.json',
          implementation: './src/executors/my-executor/executor',
          description: 'My executor description',
        },
      },
      projectGraphExtension: true,
      projectInference: false,
    };

    const result = formatPluginCapabilitiesAsJson(plugin);

    expect(result).toEqual({
      name: '@nx/workspace-plugin',
      path: 'tools/workspace-plugin',
      generators: {
        'my-generator': {
          description: 'My generator description',
          path: 'tools/workspace-plugin/src/generators/my-generator/generator',
          schema:
            'tools/workspace-plugin/src/generators/my-generator/schema.json',
        },
      },
      executors: {
        'my-executor': {
          description: 'My executor description',
          path: 'tools/workspace-plugin/src/executors/my-executor/executor',
          schema:
            'tools/workspace-plugin/src/executors/my-executor/schema.json',
        },
      },
      projectGraphExtension: true,
      projectInference: false,
    });
  });

  it('should handle generators with implementation instead of factory', () => {
    const plugin: PluginCapabilities = {
      name: '@nx/test',
      path: 'node_modules/@nx/test',
      generators: {
        init: {
          schema: './src/generators/init/schema.json',
          implementation: './src/generators/init/init',
          description: 'Initialize the plugin',
        },
      },
      executors: {},
    };

    const result = formatPluginCapabilitiesAsJson(plugin);

    expect(result.generators['init'].path).toBe(
      'node_modules/@nx/test/src/generators/init/init'
    );
  });

  it('should handle string-type executor entries', () => {
    const plugin: PluginCapabilities = {
      name: '@nx/test',
      path: 'node_modules/@nx/test',
      generators: {},
      executors: {
        'string-executor': './src/executors/string-executor',
      },
    };

    const result = formatPluginCapabilitiesAsJson(plugin);

    expect(result.executors['string-executor']).toEqual({
      description: '',
      path: null,
      schema: null,
    });
  });

  it('should handle empty generators and executors', () => {
    const plugin: PluginCapabilities = {
      name: '@nx/empty',
      path: 'node_modules/@nx/empty',
      generators: {},
      executors: {},
      projectGraphExtension: false,
      projectInference: false,
    };

    const result = formatPluginCapabilitiesAsJson(plugin);

    expect(result).toEqual({
      name: '@nx/empty',
      path: 'node_modules/@nx/empty',
      generators: {},
      executors: {},
      projectGraphExtension: false,
      projectInference: false,
    });
  });

  it('should handle undefined generators and executors', () => {
    const plugin: PluginCapabilities = {
      name: '@nx/minimal',
      path: 'node_modules/@nx/minimal',
    };

    const result = formatPluginCapabilitiesAsJson(plugin);

    expect(result.generators).toEqual({});
    expect(result.executors).toEqual({});
    expect(result.path).toBe('node_modules/@nx/minimal');
  });

  it('should handle undefined path', () => {
    const plugin: PluginCapabilities = {
      name: '@nx/no-path',
      generators: {
        gen: {
          schema: './schema.json',
          factory: './generator',
          description: 'test',
        },
      },
    };

    const result = formatPluginCapabilitiesAsJson(plugin);

    expect(result.path).toBeNull();
    expect(result.generators['gen'].path).toBeNull();
    expect(result.generators['gen'].schema).toBeNull();
  });
});

describe('listPluginCapabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should output JSON when json flag is true', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    mockGetPluginCapabilities.mockResolvedValue({
      name: '@nx/test',
      path: 'node_modules/@nx/test',
      generators: {
        init: {
          schema: './src/generators/init/schema.json',
          factory: './src/generators/init/init',
          description: 'Initialize',
        },
      },
      executors: {},
      projectGraphExtension: false,
      projectInference: false,
    });

    await listPluginCapabilities('@nx/test', {}, true);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(parsed.name).toBe('@nx/test');
    expect(parsed.path).toBe('node_modules/@nx/test');
    expect(parsed.generators['init']).toBeDefined();
    expect(parsed.generators['init'].path).toBe(
      'node_modules/@nx/test/src/generators/init/init'
    );

    consoleSpy.mockRestore();
  });

  it('should output JSON error when plugin is not installed and json flag is true', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    mockGetPluginCapabilities.mockResolvedValue(null);

    await listPluginCapabilities('@nx/missing', {}, true);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(parsed.error).toContain('not installed');

    consoleSpy.mockRestore();
  });

  it('should output JSON for plugin with no capabilities when json flag is true', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    mockGetPluginCapabilities.mockResolvedValue({
      name: '@nx/empty',
      path: 'node_modules/@nx/empty',
      generators: {},
      executors: {},
      projectGraphExtension: false,
      projectInference: false,
    });

    await listPluginCapabilities('@nx/empty', {}, true);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(parsed.name).toBe('@nx/empty');
    expect(parsed.generators).toEqual({});
    expect(parsed.executors).toEqual({});

    consoleSpy.mockRestore();
  });

  it('should show plugin path in text output', async () => {
    mockGetPluginCapabilities.mockResolvedValue({
      name: '@nx/test',
      path: 'node_modules/@nx/test',
      generators: {
        init: {
          schema: './schema.json',
          factory: './init',
          description: 'Initialize',
        },
      },
      executors: {},
    });

    await listPluginCapabilities('@nx/test', {});

    expect(output.log).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Capabilities in @nx/test:',
        bodyLines: expect.arrayContaining([
          expect.stringContaining('node_modules/@nx/test'),
        ]),
      })
    );
  });

  it('should show not installed message in text mode', async () => {
    mockGetPluginCapabilities.mockResolvedValue(null);

    await listPluginCapabilities('@nx/missing', {});

    expect(output.note).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('not currently installed'),
      })
    );
  });

  it('should show warning for no capabilities in text mode', async () => {
    mockGetPluginCapabilities.mockResolvedValue({
      name: '@nx/empty',
      path: 'node_modules/@nx/empty',
      generators: {},
      executors: {},
      projectGraphExtension: false,
      projectInference: false,
    });

    await listPluginCapabilities('@nx/empty', {});

    expect(output.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('No capabilities found'),
      })
    );
  });
});

describe('formatPluginsAsJson', () => {
  it('should format local and installed plugins', () => {
    const localPlugins = new Map<string, PluginCapabilities>([
      [
        '@my/workspace-plugin',
        {
          name: '@my/workspace-plugin',
          path: 'tools/workspace-plugin',
          generators: {
            'my-gen': {
              schema: './schema.json',
              factory: './generator',
              description: 'My generator',
            },
          },
          executors: {},
          projectGraphExtension: false,
          projectInference: true,
        },
      ],
    ]);

    const installedPlugins = new Map<string, PluginCapabilities>([
      [
        '@nx/js',
        {
          name: '@nx/js',
          path: 'node_modules/@nx/js',
          generators: {
            init: {
              schema: './schema.json',
              factory: './init',
              description: 'Init',
            },
          },
          executors: {
            build: {
              schema: './schema.json',
              implementation: './build',
              description: 'Build',
            },
          },
          projectGraphExtension: true,
          projectInference: false,
        },
      ],
    ]);

    const result = formatPluginsAsJson(localPlugins, installedPlugins);

    expect(result).toEqual({
      localWorkspacePlugins: [
        {
          name: '@my/workspace-plugin',
          path: 'tools/workspace-plugin',
          capabilities: ['generators', 'project-inference'],
        },
      ],
      installedPlugins: [
        {
          name: '@nx/js',
          path: 'node_modules/@nx/js',
          capabilities: ['executors', 'generators', 'graph-extension'],
        },
      ],
    });
  });

  it('should handle empty plugin maps', () => {
    const result = formatPluginsAsJson(
      new Map<string, PluginCapabilities>(),
      new Map<string, PluginCapabilities>()
    );

    expect(result).toEqual({
      localWorkspacePlugins: [],
      installedPlugins: [],
    });
  });
});
