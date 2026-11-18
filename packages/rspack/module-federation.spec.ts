import {
  withModuleFederation,
  withModuleFederationForSSR,
} from './module-federation';

describe('@nx/rspack/module-federation stub', () => {
  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
  });

  it('returns config unchanged during graph creation', async () => {
    global.NX_GRAPH_CREATION = true;
    const config = { output: { path: 'dist' } };

    expect((await withModuleFederation({ name: 'shell' }))(config)).toBe(
      config
    );
    expect((await withModuleFederationForSSR({ name: 'shell' }))(config)).toBe(
      config
    );
  });

  it('fails outside graph creation', async () => {
    await expect(withModuleFederation({ name: 'shell' })).rejects.toThrow(
      'Nx Module Federation was removed in Nx v24'
    );
  });
});
