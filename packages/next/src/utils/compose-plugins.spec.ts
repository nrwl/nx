import { composePlugins } from './compose-plugins';

describe('removed Next composePlugins stub', () => {
  it('returns the original config without invoking old wrappers', async () => {
    const wrapper = jest.fn(() => {
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
});
