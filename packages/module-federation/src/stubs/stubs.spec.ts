import {
  NxModuleFederationPlugin,
  withModuleFederation,
  withModuleFederationForSSR,
} from './stubs';

describe('@nx/module-federation stubs', () => {
  it('returns config unchanged from the config helpers', async () => {
    const config = { output: { path: 'dist' } };

    expect((await withModuleFederation({ name: 'shell' }))(config)).toBe(
      config
    );
    expect((await withModuleFederationForSSR({ name: 'shell' }))(config)).toBe(
      config
    );
  });

  it('constructs plugins that do nothing when applied', () => {
    const plugin = new NxModuleFederationPlugin({ config: { name: 'shell' } });

    expect(() => plugin.apply()).not.toThrow();
  });
});
