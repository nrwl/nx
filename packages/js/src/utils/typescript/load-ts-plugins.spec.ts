import { loadTsPlugins } from './load-ts-plugins';

jest.mock('plugin-a');
jest.mock('plugin-b');
const mockRequireResolve = jest.fn((path) => path);

describe('loadTsPlugins', () => {
  it('should return empty hooks if plugins is falsy', () => {
    const result = loadTsPlugins(undefined);
    assertEmptyResult(result);
  });

  it('should return empty hooks if plugins is []', () => {
    const result = loadTsPlugins([]);
    assertEmptyResult(result);
  });

  it('should return correct compiler hooks', () => {
    const result = loadTsPlugins(
      ['plugin-a', 'plugin-b'],
      mockRequireResolve as any
    );

    expect(result.hasPlugin).toEqual(true);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [expect.any(Function)],
      afterHooks: [expect.any(Function)],
      afterDeclarationsHooks: [],
    });
  });

  function assertEmptyResult(result: ReturnType<typeof loadTsPlugins>) {
    expect(result.hasPlugin).toEqual(false);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [],
      afterHooks: [],
      afterDeclarationsHooks: [],
    });
  }
});
