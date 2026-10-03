import type { MockInstance } from 'vitest';
describe('@nx/webpack compose helpers deprecation', () => {
  // Each test runs in an isolated module registry so the warn-once flag and the
  // logger spy resolve to the same fresh instances.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setup() {
    vi.resetModules();
    const { logger } = await import('@nx/devkit');
    const warn: MockInstance = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => {});
    const mod = await import('./deprecation');
    return { warn, mod };
  }

  it('warns once per process even when several helpers are composed', async () => {
    const { warn, mod } = await setup();

    mod.warnWebpackComposeHelpersDeprecation();
    mod.warnWebpackComposeHelpersDeprecation();
    mod.warnWebpackComposeHelpersDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('@nx/webpack');
    expect(warn.mock.calls[0][0]).toContain('convert-to-inferred');
  });

  it('does not warn when called inside a suppression scope', async () => {
    const { warn, mod } = await setup();

    mod.suppressWebpackComposeHelperWarnings(() =>
      mod.warnWebpackComposeHelpersDeprecation()
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('restores warning after the suppression scope exits', async () => {
    const { warn, mod } = await setup();

    mod.suppressWebpackComposeHelperWarnings(() =>
      mod.warnWebpackComposeHelpersDeprecation()
    );
    mod.warnWebpackComposeHelpersDeprecation();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns when a user constructs withNx', async () => {
    vi.resetModules();
    const { logger } = await import('@nx/devkit');
    const warn: MockInstance = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => {});
    const { withNx } = await import('./with-nx');
    withNx();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('@nx/webpack');
  });
});
