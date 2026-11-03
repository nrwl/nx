import { composePlugins } from './compose-plugins';

describe('removed Next composePlugins stub', () => {
  // Nx sets this when it runs the spec; the warning only fires once per process.
  const target = process.env.NX_TASK_TARGET_TARGET;
  beforeEach(() => delete process.env.NX_TASK_TARGET_TARGET);
  afterEach(() => {
    if (target === undefined) delete process.env.NX_TASK_TARGET_TARGET;
    else process.env.NX_TASK_TARGET_TARGET = target;
  });

  it('returns the original config without invoking old wrappers', async () => {
    const wrapper = vi.fn(() => {
      throw new Error('requires removed Nx behavior');
    });
    const config = Object.freeze({
      distDir: 'custom',
      env: { marker: 'preserved' },
    });
    const load = composePlugins(wrapper)(config);
    for (const phase of [
      'phase-development-server',
      'phase-production-build',
      'phase-production-server',
    ]) {
      expect(await load(phase, {})).toBe(config);
    }
    expect(wrapper).not.toHaveBeenCalled();
  });
  it('should not load the deprecation module, which is not copied into the .nx-helpers build output', async () => {
    vi.resetModules();
    vi.doMock('./deprecation', () => {
      throw new Error('compose-plugins must not require ./deprecation');
    });
    try {
      const {
        composePlugins: isolatedComposePlugins,
      } = require('./compose-plugins');
      const { PHASE_PRODUCTION_SERVER } = require('next/constants');
      const fn = await isolatedComposePlugins();
      const output = await fn({ env: {} })(PHASE_PRODUCTION_SERVER, {});

      expect(output).toEqual({ env: {} });
    } finally {
      vi.doUnmock('./deprecation');
      vi.resetModules();
    }
  });

  it('warns during Nx task runs but not on production server start', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NX_TASK_TARGET_TARGET = 'build';
    try {
      const load = composePlugins()({});
      await load('phase-production-server', {});
      expect(warn).not.toHaveBeenCalled();
      await load('phase-production-build', {});
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '`composePlugins()` from `@nx/next` was removed'
        )
      );
    } finally {
      warn.mockRestore();
    }
  });
});
