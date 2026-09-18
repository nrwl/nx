import type { Configuration } from '@rspack/core';
import { withModuleFederation } from './with-module-federation';
import { withModuleFederationForSSR } from './with-module-federation-ssr';

vi.mock('./utils', () => ({
  getModuleFederationConfig: () => ({
    sharedDependencies: {},
    sharedLibraries: { getReplacementPlugin: () => ({ apply() {} }) },
    mappedRemotes: {},
  }),
}));

describe('Rspack federation config callbacks', () => {
  const previousGraphCreation = global.NX_GRAPH_CREATION;

  beforeEach(() => {
    global.NX_GRAPH_CREATION = false;
    vi.stubEnv('WEBPACK_SERVE', '');
    vi.stubEnv('RSPACK_SERVE', '');
    vi.stubEnv('NX_MF_DEV_REMOTES', '');
  });

  afterEach(() => {
    global.NX_GRAPH_CREATION = previousGraphCreation;
    vi.unstubAllEnvs();
  });

  it.each(['omitted', 'undefined', 'legacy context'])(
    'configures browser federation with %s executor context',
    async (argument) => {
      const configure = await withModuleFederation(
        { name: 'host', remotes: [] },
        { dts: false }
      );
      const seed: Configuration = {
        mode: 'development',
        output: {},
        plugins: [],
      };
      const result =
        argument === 'omitted'
          ? configure(seed)
          : configure(
              seed,
              argument === 'undefined' ? undefined : { context: {} }
            );

      expect(result).toBe(seed);
      expect(result.output).toMatchObject({
        uniqueName: 'host',
        publicPath: 'auto',
      });
      expect(result.plugins).toHaveLength(3);
      expect(result.optimization.runtimeChunk).toBe(false);
    }
  );

  it.each(['omitted', 'undefined', 'legacy context'])(
    'configures SSR federation with %s executor context',
    async (argument) => {
      const configure = await withModuleFederationForSSR(
        { name: 'host', remotes: [] },
        { dts: false }
      );
      const seed: Configuration = {
        mode: 'development',
        entry: {},
        output: { library: { type: 'commonjs' } },
        plugins: [],
      };
      const result =
        argument === 'omitted'
          ? configure(seed)
          : configure(
              seed,
              argument === 'undefined' ? undefined : { context: {} }
            );

      expect(result).toBe(seed);
      expect(result.target).toBe('async-node');
      expect(result.output).toMatchObject({
        uniqueName: 'host',
        library: { type: 'commonjs-module' },
      });
      expect(result.plugins).toHaveLength(3);
      expect(result.optimization.runtimeChunk).toBe(false);
    }
  );
});
