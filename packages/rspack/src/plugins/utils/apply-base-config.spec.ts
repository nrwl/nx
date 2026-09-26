import { applyBaseConfig } from './apply-base-config';
import { NormalizedNxAppRspackPluginOptions } from './models';
import type { Configuration, Stats } from '@rspack/core';
import * as path from 'path';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { runInNewContext } from 'vm';
import { createRequire } from 'module';
import {
  mockCjsModule,
  unmockCjsModule,
} from '@nx/devkit/internal-testing-utils';

// The source `require`s these lazily, which `vi.mock`/`vi.doMock` cannot reach.
const cjsRequire = createRequire(import.meta.url);

// applyBaseConfig branches on the loaded @rspack/core's version, so each block pins it.
function reportingRspackVersion(version: string) {
  return new Proxy(cjsRequire('@rspack/core'), {
    get(target, prop) {
      if (prop === 'rspackVersion') return version;
      return (target as any)[prop];
    },
  });
}

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

  let applyBaseConfigV1: typeof applyBaseConfig;
  beforeEach(async () => {
    vi.resetModules();
    mockCjsModule(
      import.meta.url,
      '@rspack/core',
      reportingRspackVersion('1.6.8')
    );
    ({ applyBaseConfig: applyBaseConfigV1 } =
      await import('./apply-base-config'));
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
    unmockCjsModule(import.meta.url, '@rspack/core');
    vi.resetModules();
  });

  it('should not set libraryTarget when user configures library.type', async () => {
    config.output = {
      library: { type: 'module' },
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should respect user libraryTarget when set explicitly', async () => {
    config.output = {
      libraryTarget: 'umd',
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBe('umd');
  });

  it('should default to commonjs for node targets when nothing configured', async () => {
    config.output = {};

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should default to commonjs-module for async-node targets when nothing configured', async () => {
    options.target = 'async-node';
    config.output = {};

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBe('commonjs-module');
  });

  it('should not set libraryTarget for web targets when nothing configured', async () => {
    options.target = 'web';
    config.output = {};

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should prioritize library.type over libraryTarget when both are present', async () => {
    config.output = {
      libraryTarget: 'umd',
      library: { type: 'module' },
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should handle empty output config gracefully', async () => {
    config.output = undefined;

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should handle undefined library type values', async () => {
    config.output = {
      library: { type: undefined as any },
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should handle explicit undefined libraryTarget', async () => {
    config.output = {
      libraryTarget: undefined,
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should respect empty string libraryTarget', async () => {
    config.output = {
      libraryTarget: '' as any,
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBe('');
  });

  it('should handle complex library configuration', async () => {
    config.output = {
      library: {
        type: 'module',
        name: 'MyLib',
      },
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
    expect((config.output.library as any).type).toBe('module');
    expect((config.output.library as any).name).toBe('MyLib');
  });

  it('should respect user configuration for async-node with library.type', async () => {
    options.target = 'async-node';
    config.output = {
      library: { type: 'module' },
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
    expect((config.output.library as any).type).toBe('module');
  });

  it('should respect user libraryTarget for async-node target', async () => {
    options.target = 'async-node';
    config.output = {
      libraryTarget: 'umd',
    };

    applyBaseConfigV1(options, config);

    expect(config.output.libraryTarget).toBe('umd');
  });

  describe('@rspack/core@2 (pure-ESM) translation', () => {
    beforeEach(() => {
      // Force the loaded module to report v2 so the v1/v2 branch in
      // applyBaseConfig picks the modern output.library.type shape.
      vi.resetModules();
      mockCjsModule(
        import.meta.url,
        '@rspack/core',
        reportingRspackVersion('2.0.3')
      );
    });

    afterEach(() => {
      unmockCjsModule(import.meta.url, '@rspack/core');
      vi.resetModules();
    });

    it('emits output.library.type instead of libraryTarget on v2', async () => {
      const { applyBaseConfig: applyBaseConfigV2 } =
        await import('./apply-base-config');
      options.target = 'node';
      config.output = {};
      applyBaseConfigV2(options, config);
      expect(config.output.libraryTarget).toBeUndefined();
      expect((config.output.library as any).type).toBe('commonjs');
    });

    it('clears a user-provided libraryTarget when translating to library.type on v2', async () => {
      const { applyBaseConfig: applyBaseConfigV2 } =
        await import('./apply-base-config');
      options.target = 'web';
      config.output = { libraryTarget: 'commonjs' };
      applyBaseConfigV2(options, config);
      expect(config.output.libraryTarget).toBeUndefined();
      expect((config.output.library as any).type).toBe('commonjs');
    });

    it('clears a stale libraryTarget when the user already set library.type on v2', async () => {
      const { applyBaseConfig: applyBaseConfigV2 } =
        await import('./apply-base-config');
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
    vi.resetModules();
    global.NX_GRAPH_CREATION = false;
    mockCjsModule(import.meta.url, 'ts-checker-rspack-plugin', {
      TsCheckerRspackPlugin: class {
        constructor(pluginConfig: any) {
          capturedPluginConfigs.push(pluginConfig);
        }
        apply() {}
      },
    });
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
    unmockCjsModule(import.meta.url, 'ts-checker-rspack-plugin');
    // Unlike jest.resetModules, vi.resetModules keeps doMock registrations.
    vi.doUnmock('@nx/js/internal');
    vi.doUnmock('../../utils/is-serve-mode');
    vi.resetModules();
  });

  const baseOptions = {
    root: '/test',
    projectRoot: 'apps/test',
    target: 'web',
    tsConfig: 'apps/test/tsconfig.app.json',
  } as NormalizedNxAppRspackPluginOptions;

  it('widens the ts-checker rootDir to the workspace root in a classic setup', async () => {
    vi.doMock('@nx/js/internal', async () => ({
      ...(await vi.importActual<any>('@nx/js/internal')),
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
    vi.doMock('@nx/js/internal', async () => ({
      ...(await vi.importActual<any>('@nx/js/internal')),
      isUsingTsSolutionSetup: () => true,
    }));
    // The TS solution setup only type-checks during serve, so force serve mode
    // to make the plugin be installed at all.
    vi.doMock('../../utils/is-serve-mode', () => ({
      isServeMode: () => true,
    }));

    const { applyBaseConfig } = await import('./apply-base-config');
    applyBaseConfig({ ...baseOptions }, {});

    expect(capturedPluginConfigs).toHaveLength(1);
    expect(capturedPluginConfigs[0].typescript.configOverwrite).toBeUndefined();
    expect(capturedPluginConfigs[0].typescript.build).toBe(true);
  });
});

describe('apply-base-config cache option', () => {
  const baseOptions = {
    root: '/test',
    projectRoot: 'apps/test',
    target: 'web',
  } as NormalizedNxAppRspackPluginOptions;

  beforeEach(() => {
    vi.resetModules();
    global.NX_GRAPH_CREATION = false;
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
    unmockCjsModule(import.meta.url, '@rspack/core');
    vi.resetModules();
  });

  it('writes the public cache value as-is in executor mode', async () => {
    const { applyBaseConfig } = await import('./apply-base-config');

    const defaults: Partial<Configuration> = {};
    applyBaseConfig({ ...baseOptions }, defaults);
    expect(defaults.cache).toBe(true);

    const disabled: Partial<Configuration> = {};
    applyBaseConfig({ ...baseOptions, cache: false }, disabled);
    expect(disabled.cache).toBe(false);
  });

  it('writes the shape produced by the rspack normalizer into compiler.options in plugin mode', async () => {
    // Stub the normalizer so the expected shape does not depend on the
    // installed @rspack/core version.
    const normalize = (cache: unknown) =>
      cache === true
        ? { type: 'memory', snapshot: {} }
        : { ...(cache as object), snapshot: {} };
    const getNormalizedRspackOptions = vi.fn(({ cache }) => ({
      cache: normalize(cache),
    }));
    mockCjsModule(
      import.meta.url,
      '@rspack/core',
      new Proxy(cjsRequire('@rspack/core'), {
        get(target, prop) {
          if (prop === 'config') {
            return { ...(target as any).config, getNormalizedRspackOptions };
          }
          return (target as any)[prop];
        },
      })
    );
    const { applyBaseConfig } = await import('./apply-base-config');

    const defaults: Partial<Configuration> = {};
    applyBaseConfig({ ...baseOptions }, defaults, { useNormalizedEntry: true });
    expect(getNormalizedRspackOptions).toHaveBeenCalledWith({
      context: path.join('/test', 'apps/test'),
      cache: true,
    });
    expect(defaults.cache).toEqual({ type: 'memory', snapshot: {} });

    const persistent: Partial<Configuration> = {};
    applyBaseConfig(
      { ...baseOptions, cache: { type: 'persistent' } as any },
      persistent,
      { useNormalizedEntry: true }
    );
    expect(persistent.cache).toEqual({ type: 'persistent', snapshot: {} });
  });

  it('passes an explicit cache option through the installed normalizer in plugin mode', async () => {
    const { applyBaseConfig } = await import('./apply-base-config');
    const rspackCore: typeof import('@rspack/core') =
      await vi.importActual<any>('@rspack/core');
    const normalizedCache = (cache: Configuration['cache']) =>
      rspackCore.config.getNormalizedRspackOptions({
        context: path.join('/test', 'apps/test'),
        cache,
      }).cache;

    const enabled: Partial<Configuration> = {};
    applyBaseConfig({ ...baseOptions, cache: true }, enabled, {
      useNormalizedEntry: true,
    });
    expect(enabled.cache).toEqual(normalizedCache(true));

    const disabled: Partial<Configuration> = {};
    applyBaseConfig({ ...baseOptions, cache: false }, disabled, {
      useNormalizedEntry: true,
    });
    expect(disabled.cache).toBe(false);

    const persistent: Partial<Configuration> = {};
    applyBaseConfig(
      { ...baseOptions, cache: { type: 'persistent' } as any },
      persistent,
      { useNormalizedEntry: true }
    );
    expect(persistent.cache).toEqual(normalizedCache({ type: 'persistent' }));
  });
});

describe('apply-base-config minimizer', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'nx-rspack-minimizer-'));
    writeFileSync(
      path.join(dir, 'index.js'),
      `
        function wrap(cb) { return () => cb(); }
        class C { static n = 0; id = ++C.n; v = wrap(() => this.id); }
        console.log([new C(), new C(), new C()].map((c) => c.v()).join(','));
      `
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.resetModules();
    global.NX_GRAPH_CREATION = false;
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
    vi.resetModules();
  });

  it.each(['web', 'node'] as const)(
    'keeps per-instance closures from class field initializers when minifying for %s targets',
    async (target) => {
      const { applyBaseConfig } = await import('./apply-base-config');
      const { rspack } = await import('@rspack/core');
      const config: Partial<Configuration> = {};
      applyBaseConfig(
        {
          root: '/test',
          projectRoot: 'apps/test',
          target,
          mode: 'production',
          optimization: true,
        } as NormalizedNxAppRspackPluginOptions,
        config
      );

      const outDir = path.join(dir, `out-${target}`);
      const compiler = rspack({
        mode: 'production',
        context: dir,
        entry: './index.js',
        target,
        output: { path: outDir, filename: 'main.js' },
        devtool: false,
        optimization: config.optimization,
      });
      const stats = await new Promise<Stats>((res, rej) => {
        compiler.run((err, stats) => {
          compiler.close((closeErr) => {
            if (err || closeErr) {
              rej(err ?? closeErr);
            } else if (stats.hasErrors()) {
              rej(new Error(stats.toString({ errors: true, all: false })));
            } else {
              res(stats);
            }
          });
        });
      });
      const mainAsset = stats.compilation.getAsset('main.js');
      expect(mainAsset && mainAsset.info.minimized).toBe(true);

      const logs: string[] = [];
      runInNewContext(readFileSync(path.join(outDir, 'main.js'), 'utf8'), {
        console: { log: (message: string) => logs.push(message) },
      });
      expect(logs).toEqual(['1,2,3']);
    }
  );
});
