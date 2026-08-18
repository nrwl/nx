describe('@nx/webpack compose helpers deprecation', () => {
  // Each test runs in an isolated module registry so the warn-once flag and the
  // logger spy resolve to the same fresh instances.
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

    mod.warnWebpackComposeHelpersDeprecation();
    mod.warnWebpackComposeHelpersDeprecation();
    mod.warnWebpackComposeHelpersDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('@nx/webpack');
    expect(warn.mock.calls[0][0]).toContain('convert-to-inferred');
  });

  it('does not warn when called inside a suppression scope', () => {
    const { warn, mod } = setup();

    mod.suppressWebpackComposeHelperWarnings(() =>
      mod.warnWebpackComposeHelpersDeprecation()
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('restores warning after the suppression scope exits', () => {
    const { warn, mod } = setup();

    mod.suppressWebpackComposeHelperWarnings(() =>
      mod.warnWebpackComposeHelpersDeprecation()
    );
    mod.warnWebpackComposeHelpersDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns when a user constructs withNx', () => {
    let warn!: jest.SpyInstance;
    jest.isolateModules(() => {
      const { logger } = require('@nx/devkit');
      warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      const { withNx } = require('./with-nx');
      withNx();
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('@nx/webpack');
  });
});
