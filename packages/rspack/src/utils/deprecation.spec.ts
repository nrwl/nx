describe('@nx/rspack compose helpers deprecation', () => {
  async function setup() {
    vi.resetModules();
    const { logger } = await import('@nx/devkit');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const mod = await import('./deprecation');
    return { warn, mod };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns once per process even when several helpers are composed', async () => {
    const { warn, mod } = await setup();

    mod.warnRspackComposeHelpersDeprecation();
    mod.warnRspackComposeHelpersDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('@nx/rspack');
    expect(warn.mock.calls[0][0]).toContain('convert-to-inferred');
  });

  it('does not warn when called inside a suppression scope', async () => {
    const { warn, mod } = await setup();

    mod.suppressRspackComposeHelperWarnings(() =>
      mod.warnRspackComposeHelpersDeprecation()
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('restores warning after the suppression scope exits', async () => {
    const { warn, mod } = await setup();

    mod.suppressRspackComposeHelperWarnings(() =>
      mod.warnRspackComposeHelpersDeprecation()
    );
    mod.warnRspackComposeHelpersDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
