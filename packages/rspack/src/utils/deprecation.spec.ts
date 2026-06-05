describe('@nx/rspack compose helpers deprecation', () => {
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

  it('warns once per process even when several helpers are composed', () => {
    const { warn, mod } = setup();

    mod.warnRspackComposeHelpersDeprecation();
    mod.warnRspackComposeHelpersDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('@nx/rspack');
    expect(warn.mock.calls[0][0]).toContain('convert-to-inferred');
  });

  it('does not warn when called inside a suppression scope', () => {
    const { warn, mod } = setup();

    mod.suppressRspackComposeHelperWarnings(() =>
      mod.warnRspackComposeHelpersDeprecation()
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('restores warning after the suppression scope exits', () => {
    const { warn, mod } = setup();

    mod.suppressRspackComposeHelperWarnings(() =>
      mod.warnRspackComposeHelpersDeprecation()
    );
    mod.warnRspackComposeHelpersDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
