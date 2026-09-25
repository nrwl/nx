describe('@nx/rspack unsupported transformers warning', () => {
  function setup() {
    let warn!: jest.SpyInstance;
    let mod!: typeof import('./warn-unsupported-transformers');
    jest.isolateModules(() => {
      const { logger } = require('@nx/devkit');
      warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      mod = require('./warn-unsupported-transformers');
    });
    return { warn, mod };
  }

  it('warns when the user sets transformers', () => {
    const { warn, mod } = setup();

    mod.warnUnsupportedTransformers(true, 'apps/demo');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('transformers');
    expect(warn.mock.calls[0][0]).toContain('builtin:swc-loader');
  });

  it('warns once per project so watch rebuilds do not repeat it', () => {
    const { warn, mod } = setup();

    mod.warnUnsupportedTransformers(true, 'apps/demo');
    mod.warnUnsupportedTransformers(true, 'apps/demo');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns for every affected project in the same process', () => {
    const { warn, mod } = setup();

    mod.warnUnsupportedTransformers(true, 'apps/one');
    mod.warnUnsupportedTransformers(true, 'apps/two');

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not warn when the user sets no transformers', () => {
    const { warn, mod } = setup();

    mod.warnUnsupportedTransformers(false, 'apps/demo');

    expect(warn).not.toHaveBeenCalled();
  });
});
