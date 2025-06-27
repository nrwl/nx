import { applyBaseConfig } from './apply-base-config';
import { NormalizedNxAppWebpackPluginOptions } from '../nx-app-webpack-plugin-options';
import { Configuration } from 'webpack';

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
