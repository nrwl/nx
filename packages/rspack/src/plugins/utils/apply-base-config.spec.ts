import { applyBaseConfig } from './apply-base-config';
import { NormalizedNxAppRspackPluginOptions } from './models';
import { Configuration } from '@rspack/core';

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

  it('should default to commonjs-module for async-node targets when nothing configured', () => {
    options.target = 'async-node';
    config.output = {};

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('commonjs-module');
  });

  it('should not set libraryTarget for web targets when nothing configured', () => {
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

  it('should respect user configuration for async-node with library.type', () => {
    options.target = 'async-node';
    config.output = {
      library: { type: 'module' },
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBeUndefined();
    expect((config.output.library as any).type).toBe('module');
  });

  it('should respect user libraryTarget for async-node target', () => {
    options.target = 'async-node';
    config.output = {
      libraryTarget: 'umd',
    };

    applyBaseConfig(options, config);

    expect(config.output.libraryTarget).toBe('umd');
  });
});
