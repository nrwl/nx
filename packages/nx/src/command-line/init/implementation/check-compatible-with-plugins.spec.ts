import {
  AggregateCreateNodesError,
  MergeNodesError,
  ProjectConfigurationsError,
  ProjectsWithNoNameError,
} from '../../../project-graph/error-types';
import { checkCompatibleWithPlugins } from './check-compatible-with-plugins';
import { retrieveProjectConfigurations } from '../../../project-graph/utils/retrieve-workspace-files';
import { tmpdir } from 'os';

jest.mock('../../../project-graph/plugins/internal-api', () => ({
  loadNxPlugins: jest.fn().mockReturnValue([[], []]),
}));
jest.mock('../../../project-graph/utils/retrieve-workspace-files', () => ({
  retrieveProjectConfigurations: jest.fn(),
}));

describe('checkCompatibleWithPlugins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty object if no errors are thrown', async () => {
    (retrieveProjectConfigurations as any).mockReturnValueOnce(
      Promise.resolve({})
    );
    const result = await checkCompatibleWithPlugins(
      ['plugin1', 'plugin2'],
      'projectRootPathToCheck',
      tmpdir()
    );
    expect(result).toEqual({});
  });

  it('should return empty object if error is not ProjectConfigurationsError', async () => {
    (retrieveProjectConfigurations as any).mockReturnValueOnce(
      Promise.reject(new Error('random error'))
    );
    const result = await checkCompatibleWithPlugins(
      ['plugin1', 'plugin2'],
      'projectRootPathToCheck',
      tmpdir()
    );
    expect(result).toEqual({});
  });

  it('should return empty object if error is ProjectsWithNoNameError', async () => {
    (retrieveProjectConfigurations as any).mockReturnValueOnce(
      Promise.reject(
        new ProjectConfigurationsError(
          [
            new ProjectsWithNoNameError([], {
              project1: { root: 'root1' },
            }),
          ],
          undefined
        )
      )
    );
    const result = await checkCompatibleWithPlugins(
      ['plugin1', 'plugin2'],
      'projectRootPathToCheck',
      tmpdir()
    );
    expect(result).toEqual({});
  });

  it('should return incompatible plugin with excluded files if error is AggregateCreateNodesError', async () => {
    (retrieveProjectConfigurations as any).mockReturnValueOnce(
      Promise.reject(
        new ProjectConfigurationsError(
          [
            new AggregateCreateNodesError(
              [
                ['file1', undefined],
                ['file2', undefined],
              ],
              [],
              'plugin1'
            ),
          ],
          undefined
        )
      )
    );
    const result = await checkCompatibleWithPlugins(
      ['plugin1', 'plugin2'],
      'projectRootPathToCheck',
      tmpdir()
    );
    expect(result).toEqual({ plugin1: new Set(['file1', 'file2']) });
  });

  it('should return true if error is MergeNodesError', async () => {
    (retrieveProjectConfigurations as any).mockReturnValueOnce(
      Promise.reject(
        new ProjectConfigurationsError(
          [
            new MergeNodesError({
              file: 'file2',
              pluginName: 'plugin2',
              error: new Error(),
            }),
          ],
          undefined
        )
      )
    );
    const result = await checkCompatibleWithPlugins(
      ['plugin1', 'plugin2'],
      'projectRootPathToCheck',
      tmpdir()
    );
    expect(result).toEqual({ plugin2: new Set(['file2']) });
  });

  it('should handle multiple errors', async () => {
    (retrieveProjectConfigurations as any).mockReturnValueOnce(
      Promise.reject(
        new ProjectConfigurationsError(
          [
            new ProjectsWithNoNameError([], {
              project1: { root: 'root1' },
            }),
            new AggregateCreateNodesError([], [], 'randomPlugin'),
            new AggregateCreateNodesError(
              [
                ['file1', undefined],
                ['file2', undefined],
              ],
              [],
              'plugin1'
            ),
            new MergeNodesError({
              file: 'file2',
              pluginName: 'plugin2',
              error: new Error(),
            }),
            new AggregateCreateNodesError(
              [
                ['file3', undefined],
                ['file4', undefined],
              ],
              [],
              'plugin2'
            ),
          ],
          undefined
        )
      )
    );
    const result = await checkCompatibleWithPlugins(
      ['plugin1', 'plugin2'],
      'projectRootPathToCheck',
      tmpdir()
    );
    expect(result).toEqual({
      plugin1: new Set(['file1', 'file2']),
      plugin2: new Set(['file2', 'file3', 'file4']),
    });
  });
});
