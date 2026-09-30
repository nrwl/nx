describe('@nx/react withReact deprecation', () => {
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

  it('warns once per process', async () => {
    const { warn, mod } = await setup();

    mod.warnReactWithReactDeprecation();
    mod.warnReactWithReactDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('@nx/react');
    expect(warn.mock.calls[0][0]).toContain('convert-to-inferred');
  });

  it('does not warn when called inside a suppression scope', async () => {
    const { warn, mod } = await setup();

    mod.suppressReactComposeHelperWarnings(() =>
      mod.warnReactWithReactDeprecation()
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('restores warning after the suppression scope exits', async () => {
    const { warn, mod } = await setup();

    mod.suppressReactComposeHelperWarnings(() =>
      mod.warnReactWithReactDeprecation()
    );
    mod.warnReactWithReactDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
