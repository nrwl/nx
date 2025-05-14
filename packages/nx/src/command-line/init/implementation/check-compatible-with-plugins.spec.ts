import {
  AggregateCreateNodesError,
  CreateMetadataError,
  MergeNodesError,
  ProjectGraphError,
  ProjectsWithNoNameError,
} from '../../../project-graph/error-types';
import { checkCompatibleWithPlugins } from './check-compatible-with-plugins';
import { createProjectGraphAsync } from '../../../project-graph/project-graph';

jest.mock('../../../project-graph/project-graph', () => ({
  createProjectGraphAsync: jest.fn(),
}));

describe('checkCompatibleWithPlugins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty object if no errors are thrown', async () => {
    (createProjectGraphAsync as any).mockReturnValueOnce(Promise.resolve({}));
    const result = await checkCompatibleWithPlugins();
    expect(result).toEqual({});
  });

  it('should return empty object if error is not ProjectConfigurationsError', async () => {
    (createProjectGraphAsync as any).mockReturnValueOnce(
      Promise.reject(new Error('random error'))
    );
    const result = await checkCompatibleWithPlugins();
    expect(result).toEqual({});
  });

  it('should return empty object if error is ProjectsWithNoNameError', async () => {
    (createProjectGraphAsync as any).mockReturnValueOnce(
      Promise.reject(
        new ProjectGraphError(
          [
            new ProjectsWithNoNameError([], {
              project1: { root: 'root1' },
            }),
          ],
          undefined,
          undefined
        )
      )
    );
    const result = await checkCompatibleWithPlugins();
    expect(result).toEqual({});
  });

  it('should return incompatible plugin with excluded files if error is AggregateCreateNodesError', async () => {
    const error = new AggregateCreateNodesError(
      [
        ['file1', undefined],
        ['file2', undefined],
      ],
      []
    );
    error.pluginIndex = 0;
    (createProjectGraphAsync as any).mockReturnValueOnce(
      Promise.reject(new ProjectGraphError([error], undefined, undefined))
    );
    const result = await checkCompatibleWithPlugins();
    expect(result).toEqual({
      0: [
        { file: 'file1', error: undefined },
        { file: 'file2', error: undefined },
      ],
    });
  });

  it('should return true if error is MergeNodesError', async () => {
    let error = new MergeNodesError({
      file: 'file2',
      pluginName: 'plugin2',
      error: new Error(),
      pluginIndex: 1,
    });
    (createProjectGraphAsync as any).mockReturnValueOnce(
      Promise.reject(new ProjectGraphError([error], undefined, undefined))
    );
    const result = await checkCompatibleWithPlugins();
    expect(result).toEqual({ 1: [{ error, file: 'file2' }] });
  });

  it('should handle multiple errors', async () => {
    const mergeNodesError = new MergeNodesError({
      file: 'file2',
      pluginName: 'plugin2',
      error: new Error(),
      pluginIndex: 2,
    });
    const aggregateError0 = new AggregateCreateNodesError(
      [
        ['file1', undefined],
        ['file2', undefined],
      ],
      []
    );
    aggregateError0.pluginIndex = 0;
    const aggregateError2 = new AggregateCreateNodesError(
      [
        ['file3', undefined],
        ['file4', undefined],
      ],
      []
    );
    aggregateError2.pluginIndex = 2;
    (createProjectGraphAsync as any).mockReturnValueOnce(
      Promise.reject(
        new ProjectGraphError(
          [
            new ProjectsWithNoNameError([], {
              project1: { root: 'root1' },
            }),
            new CreateMetadataError(new Error(), 'file1'),
            new AggregateCreateNodesError([], []),
            aggregateError0,
            mergeNodesError,
            aggregateError2,
          ],
          undefined,
          undefined
        )
      )
    );
    const result = await checkCompatibleWithPlugins();
    expect(result).toEqual({
      0: [{ file: 'file1' }, { file: 'file2' }],
      2: [
        { file: 'file2', error: mergeNodesError },
        { file: 'file3' },
        { file: 'file4' },
      ],
    });
  });
});
