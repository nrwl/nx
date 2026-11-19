describe('@nx/rspack unsupported transformers warning', () => {
  // Re-import so the set of already-warned projects starts empty.
  async function setup() {
    vi.resetModules();
    const { logger } = await import('@nx/devkit');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const mod = await import('./warn-unsupported-transformers');
    return { warn, mod };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when the user sets transformers', async () => {
    const { warn, mod } = await setup();

    mod.warnUnsupportedTransformers(true, 'apps/demo');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('transformers');
    expect(warn.mock.calls[0][0]).toContain('builtin:swc-loader');
  });

  it('warns once per project so watch rebuilds do not repeat it', async () => {
    const { warn, mod } = await setup();

    mod.warnUnsupportedTransformers(true, 'apps/demo');
    mod.warnUnsupportedTransformers(true, 'apps/demo');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns for every affected project in the same process', async () => {
    const { warn, mod } = await setup();

    mod.warnUnsupportedTransformers(true, 'apps/one');
    mod.warnUnsupportedTransformers(true, 'apps/two');

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not warn when the user sets no transformers', async () => {
    const { warn, mod } = await setup();

    mod.warnUnsupportedTransformers(false, 'apps/demo');

    expect(warn).not.toHaveBeenCalled();
  });
});
