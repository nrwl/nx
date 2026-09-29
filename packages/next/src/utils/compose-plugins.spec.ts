import { composePlugins } from './compose-plugins';

describe('removed Next composePlugins stub', () => {
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
});
