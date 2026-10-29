describe('@nx/react/module-federation stub', () => {
  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
  });

  it('keeps both require forms loadable during graph creation', async () => {
    global.NX_GRAPH_CREATION = true;
    const config = { output: { path: 'dist' } };
    const withModuleFederation = require('./module-federation');

    expect((await withModuleFederation({ name: 'shell' }))(config)).toBe(
      config
    );
    expect(
      (
        await withModuleFederation.withModuleFederationForSSR({ name: 'shell' })
      )(config)
    ).toBe(config);
  });

  it('fails outside graph creation', async () => {
    const { withModuleFederation } = require('./module-federation');

    await expect(withModuleFederation({ name: 'shell' })).rejects.toThrow(
      'Nx Module Federation was removed in Nx v24'
    );
  });
});
