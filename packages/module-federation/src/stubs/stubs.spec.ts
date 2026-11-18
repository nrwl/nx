import {
  NxModuleFederationDevServerPlugin,
  NxModuleFederationPlugin,
  NxModuleFederationSSRDevServerPlugin,
  withModuleFederation,
  withModuleFederationForSSR,
} from './stubs';

describe('@nx/module-federation stubs', () => {
  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
  });

  describe('during graph creation', () => {
    beforeEach(() => {
      global.NX_GRAPH_CREATION = true;
    });

    it('returns config unchanged from the config helpers', async () => {
      const config = { output: { path: 'dist' } };

      expect((await withModuleFederation({ name: 'shell' }))(config)).toBe(
        config
      );
      expect(
        (await withModuleFederationForSSR({ name: 'shell' }))(config)
      ).toBe(config);
    });

    it('constructs plugins', () => {
      expect(
        () => new NxModuleFederationPlugin({ config: { name: 'shell' } })
      ).not.toThrow();
    });
  });

  describe('outside graph creation', () => {
    it('fails the config helpers', async () => {
      await expect(withModuleFederation({ name: 'shell' })).rejects.toThrow(
        'Nx Module Federation was removed in Nx v24'
      );
      await expect(
        withModuleFederationForSSR({ name: 'shell' })
      ).rejects.toThrow('Nx Module Federation was removed in Nx v24');
    });

    it('fails plugin construction', () => {
      expect(
        () => new NxModuleFederationPlugin({ config: { name: 'shell' } })
      ).toThrow('Nx Module Federation was removed in Nx v24');
    });
  });

  it('lets dev server plugins build outside graph creation', () => {
    expect(() =>
      new NxModuleFederationDevServerPlugin({
        config: { name: 'shell' },
      }).apply()
    ).not.toThrow();
    expect(() =>
      new NxModuleFederationSSRDevServerPlugin({
        config: { name: 'shell' },
      }).apply()
    ).not.toThrow();
  });

  it('fails when a compiler applies a plugin built during graph creation', () => {
    global.NX_GRAPH_CREATION = true;
    const plugin = new NxModuleFederationPlugin({ config: { name: 'shell' } });

    expect(() => plugin.apply()).toThrow(
      'Nx Module Federation was removed in Nx v24'
    );
  });
});
