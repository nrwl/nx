import { applyBaseConfig } from './apply-base-config';
import { NormalizedNxAppWebpackPluginOptions } from '../nx-app-webpack-plugin-options';
import { Configuration } from 'webpack';

// swc-loader is an optional peer dependency that isn't installed in this
// workspace; stub the loader factory so tests don't depend on resolving it.
jest.mock('./compiler-loaders', () => ({
  createLoaderFromCompiler: () => ({ test: /\.([jt])sx?$/ }),
}));

describe('apply-base-config libraryTarget handling', () => {
  let options: NormalizedNxAppWebpackPluginOptions;
  let config: Partial<Configuration>;

  beforeEach(() => {
    options = {
      root: '/test',
      projectRoot: 'apps/test',
      sourceRoot: 'apps/test/src',
      target: 'node',
    } as NormalizedNxAppWebpackPluginOptions;

    config = {};
    global.NX_GRAPH_CREATION = false;
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
  });

  it('should not set libraryTarget when user configures library.type', () => {
    config.output = {
      library: { type: 'module' },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should respect user libraryTarget when set explicitly', () => {
    config.output = {
      libraryTarget: 'umd',
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('umd');
  });

  it('should default to commonjs for node targets when nothing configured', () => {
    config.output = {};

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should not set libraryTarget for non-node targets when nothing configured', () => {
    options.target = 'web';
    config.output = {};

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should prioritize library.type over libraryTarget when both are present', () => {
    config.output = {
      libraryTarget: 'umd',
      library: { type: 'module' },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
  });

  it('should handle empty output config gracefully', () => {
    config.output = undefined;

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should handle undefined library type values', () => {
    config.output = {
      library: { type: undefined as any },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should handle explicit undefined libraryTarget', () => {
    config.output = {
      libraryTarget: undefined,
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs');
  });

  it('should respect empty string libraryTarget', () => {
    config.output = {
      libraryTarget: '' as any,
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('');
  });

  it('should handle complex library configuration', () => {
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
});

describe('apply-base-config minimizer', () => {
  let options: NormalizedNxAppWebpackPluginOptions;
  let config: Partial<Configuration>;

  beforeEach(() => {
    options = {
      root: '/test',
      projectRoot: 'apps/test',
      sourceRoot: 'apps/test/src',
      target: 'web',
      optimization: true,
    } as NormalizedNxAppWebpackPluginOptions;

    config = {};
    global.NX_GRAPH_CREATION = false;
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
  });

  // terser-webpack-plugin 5.6+ forwards `extractComments` into swc's minify
  // options, which rejects it as an unknown field. Both compiler branches must
  // disable it. See https://github.com/nrwl/nx/issues/36233.
  it('should set extractComments: false on the swc minimizer', () => {
    options.compiler = 'swc';

    applyBaseConfig(options, config);

    const terserPlugin = config.optimization.minimizer[0] as any;
    expect(terserPlugin.options.extractComments).toBe(false);
  });

  it('should set extractComments: false on the babel minimizer', () => {
    options.compiler = 'babel';

    applyBaseConfig(options, config);

    const terserPlugin = config.optimization.minimizer[0] as any;
    expect(terserPlugin.options.extractComments).toBe(false);
  });
});
