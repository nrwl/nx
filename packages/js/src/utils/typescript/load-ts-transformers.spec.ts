import { loadTsTransformers } from './load-ts-transformers';

jest.mock('plugin-a');
jest.mock('plugin-b');
const mockRequireResolve = jest.fn((path) => path);

describe('loadTsTransformers', () => {
  it('should return empty hooks if plugins is falsy', () => {
    const result = loadTsTransformers(undefined);
    assertEmptyResult(result);
  });

  it('should return empty hooks if plugins is []', () => {
    const result = loadTsTransformers([]);
    assertEmptyResult(result);
  });

  it('should return correct compiler hooks', () => {
    const result = loadTsTransformers(
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

  function assertEmptyResult(result: ReturnType<typeof loadTsTransformers>) {
    expect(result.hasPlugin).toEqual(false);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [],
      afterHooks: [],
      afterDeclarationsHooks: [],
    });
  }
});
