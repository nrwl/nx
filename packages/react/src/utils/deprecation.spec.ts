describe('@nx/react withReact deprecation', () => {
  function setup() {
    let warn!: jest.SpyInstance;
    let mod!: typeof import('./deprecation');
    jest.isolateModules(() => {
      const { logger } = require('@nx/devkit');
      warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      mod = require('./deprecation');
    });
    return { warn, mod };
  }

  it('warns once per process', () => {
    const { warn, mod } = setup();

    mod.warnReactWithReactDeprecation();
    mod.warnReactWithReactDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('@nx/react');
    expect(warn.mock.calls[0][0]).toContain('convert-to-inferred');
  });

  it('does not warn when called inside a suppression scope', () => {
    const { warn, mod } = setup();

    mod.suppressReactComposeHelperWarnings(() =>
      mod.warnReactWithReactDeprecation()
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('restores warning after the suppression scope exits', () => {
    const { warn, mod } = setup();

    mod.suppressReactComposeHelperWarnings(() =>
      mod.warnReactWithReactDeprecation()
    );
    mod.warnReactWithReactDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
