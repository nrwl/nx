import { applyBaseConfig } from './apply-base-config';
import { NormalizedNxAppRspackPluginOptions } from './models';
import type { Configuration } from '@rspack/core';

describe('apply-base-config libraryTarget handling', () => {
  let options: NormalizedNxAppRspackPluginOptions;
  let config: Partial<Configuration>;

  beforeEach(() => {
    options = {
      root: '/test',
      projectRoot: 'apps/test',
      target: 'node',
    } as NormalizedNxAppRspackPluginOptions;

    config = {};
    global.NX_GRAPH_CREATION = false;
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
  });

  it('should not set libraryTarget when user configures library.type', async () => {
    config.output = {
      library: { type: 'module' },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should respect user libraryTarget when set explicitly', async () => {
    config.output = {
      libraryTarget: 'umd',
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('umd');
  });

  it('should default to commonjs for node targets when nothing configured', async () => {
    config.output = {};

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should default to commonjs-module for async-node targets when nothing configured', async () => {
    options.target = 'async-node';
    config.output = {};

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs-module');
  });

  it('should not set libraryTarget for web targets when nothing configured', async () => {
    options.target = 'web';
    config.output = {};

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should prioritize library.type over libraryTarget when both are present', async () => {
    config.output = {
      libraryTarget: 'umd',
      library: { type: 'module' },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should handle empty output config gracefully', async () => {
    config.output = undefined;

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should handle undefined library type values', async () => {
    config.output = {
      library: { type: undefined as any },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should handle explicit undefined libraryTarget', async () => {
    config.output = {
      libraryTarget: undefined,
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should respect empty string libraryTarget', async () => {
    config.output = {
      libraryTarget: '' as any,
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('');
  });

  it('should handle complex library configuration', async () => {
    config.output = {
      library: {
        type: 'module',
        name: 'MyLib',
      },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
    expect((config.output.library as any).type).toBe('module');
    expect((config.output.library as any).name).toBe('MyLib');
  });

  it('should respect user configuration for async-node with library.type', async () => {
    options.target = 'async-node';
    config.output = {
      library: { type: 'module' },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
    expect((config.output.library as any).type).toBe('module');
  });

  it('should respect user libraryTarget for async-node target', async () => {
    options.target = 'async-node';
    config.output = {
      libraryTarget: 'umd',
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('umd');
  });

  describe('@rspack/core@2 (pure-ESM) translation', () => {
    beforeEach(() => {
      // Force the loaded module to report v2 so the v1/v2 branch in
      // applyBaseConfig picks the modern output.library.type shape.
      jest.resetModules();
      jest.doMock('@rspack/core', () => {
        const actual = jest.requireActual('@rspack/core');
        return new Proxy(actual, {
          get(target, prop) {
            if (prop === 'rspackVersion') return '2.0.3';
            return (target as any)[prop];
          },
        });
      });
    });

    afterEach(() => {
      jest.dontMock('@rspack/core');
      jest.resetModules();
    });

    it('emits output.library.type instead of libraryTarget on v2', async () => {
      const { applyBaseConfig: applyBaseConfigV2 } = await import(
        './apply-base-config'
      );
      options.target = 'node';
      config.output = {};
      applyBaseConfigV2(options, config);
      expect(config.output.libraryTarget).toBeUndefined();
      expect((config.output.library as any).type).toBe('commonjs');
    });

    it('clears a user-provided libraryTarget when translating to library.type on v2', async () => {
      const { applyBaseConfig: applyBaseConfigV2 } = await import(
        './apply-base-config'
      );
      options.target = 'web';
      config.output = { libraryTarget: 'commonjs' };
      applyBaseConfigV2(options, config);
      expect(config.output.libraryTarget).toBeUndefined();
      expect((config.output.library as any).type).toBe('commonjs');
    });

    it('clears a stale libraryTarget when the user already set library.type on v2', async () => {
      const { applyBaseConfig: applyBaseConfigV2 } = await import(
        './apply-base-config'
      );
      options.target = 'web';
      config.output = {
        libraryTarget: 'umd',
        library: { type: 'module' },
      };
      applyBaseConfigV2(options, config);
      expect(config.output.libraryTarget).toBeUndefined();
      expect((config.output.library as any).type).toBe('module');
    });
  });
});

describe('apply-base-config ts-checker rootDir (TS6059 prevention)', () => {
  const capturedPluginConfigs: any[] = [];

  beforeEach(() => {
    capturedPluginConfigs.length = 0;
    jest.resetModules();
    global.NX_GRAPH_CREATION = false;
    jest.doMock('ts-checker-rspack-plugin', () => ({
      TsCheckerRspackPlugin: class {
        constructor(pluginConfig: any) {
          capturedPluginConfigs.push(pluginConfig);
        }
        apply() {}
      },
    }));
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
    jest.resetModules();
  });

  const baseOptions = {
    root: '/test',
    projectRoot: 'apps/test',
    target: 'web',
    tsConfig: 'apps/test/tsconfig.app.json',
  } as NormalizedNxAppRspackPluginOptions;

  it('widens the ts-checker rootDir to the workspace root in a classic setup', async () => {
    jest.doMock('@nx/js/internal', () => ({
      ...jest.requireActual('@nx/js/internal'),
      isUsingTsSolutionSetup: () => false,
    }));

    const { applyBaseConfig } = await import('./apply-base-config');
    applyBaseConfig({ ...baseOptions }, {});

    expect(capturedPluginConfigs).toHaveLength(1);
    expect(
      capturedPluginConfigs[0].typescript.configOverwrite.compilerOptions
        .rootDir
    ).toBe('/test');
  });

  it('does not override rootDir when using the TS solution setup', async () => {
    jest.doMock('@nx/js/internal', () => ({
      ...jest.requireActual('@nx/js/internal'),
      isUsingTsSolutionSetup: () => true,
    }));
    // The TS solution setup only type-checks during serve, so force serve mode
    // to make the plugin be installed at all.
    jest.doMock('../../utils/is-serve-mode', () => ({
      isServeMode: () => true,
    }));

    const { applyBaseConfig } = await import('./apply-base-config');
    applyBaseConfig({ ...baseOptions }, {});

    expect(capturedPluginConfigs).toHaveLength(1);
    expect(capturedPluginConfigs[0].typescript.configOverwrite).toBeUndefined();
    expect(capturedPluginConfigs[0].typescript.build).toBe(true);
  });
});
