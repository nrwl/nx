import { readCachedProjectGraph } from '@nx/devkit';
import { shouldSkipModuleFederationSetup } from './should-skip-module-federation-setup';

jest.mock('@nx/devkit', () => ({
  readCachedProjectGraph: jest.fn(),
}));

describe('shouldSkipModuleFederationSetup', () => {
  const mockedReadCachedProjectGraph = jest.mocked(readCachedProjectGraph);

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
    mockedReadCachedProjectGraph.mockReset();
  });

  it('does not skip setup when project graph creation is not in progress', () => {
    expect(shouldSkipModuleFederationSetup()).toBe(false);
    expect(mockedReadCachedProjectGraph).not.toHaveBeenCalled();
  });

  it('skips setup when project graph creation is in progress and the cache is unavailable', () => {
    global.NX_GRAPH_CREATION = true;
    mockedReadCachedProjectGraph.mockImplementation(() => {
      throw new Error('No cached project graph');
    });

    expect(shouldSkipModuleFederationSetup()).toBe(true);
  });

  it('continues setup when project graph creation is in progress but the cache is ready', () => {
    global.NX_GRAPH_CREATION = true;
    mockedReadCachedProjectGraph.mockReturnValue({
      nodes: {},
      dependencies: {},
    } as any);

    expect(shouldSkipModuleFederationSetup()).toBe(false);
  });
});
