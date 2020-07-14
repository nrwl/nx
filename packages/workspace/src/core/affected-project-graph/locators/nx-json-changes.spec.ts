import { getTouchedProjectsInNxJson } from './nx-json-changes';
import { WholeFileChange } from '../../file-utils';
import { DiffType } from '../../../utils/json-diff';

describe('getTouchedProjectsInNxJson', () => {
  it('should not return changes when nx.json is not touched', () => {
    const result = getTouchedProjectsInNxJson(
      [
        {
          file: 'source.ts',
          ext: '.ts',
          hash: 'some-hash',
          getChanges: () => [new WholeFileChange()],
        },
      ],
      {},
      {
        npmScope: 'proj',
        projects: {
          proj1: {
            tags: [],
          },
        },
      }
    );
    expect(result).toEqual([]);
  });

  it('should return all projects for a whole file change', () => {
    const result = getTouchedProjectsInNxJson(
      [
        {
          file: 'nx.json',
          ext: '.json',
          hash: 'some-hash',
          getChanges: () => [new WholeFileChange()],
        },
      ],
      {},
      {
        npmScope: 'proj',
        projects: {
          proj1: {
            tags: [],
          },
          proj2: {
            tags: [],
          },
        },
      }
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should return all projects for changes to npmScope', () => {
    const result = getTouchedProjectsInNxJson(
      [
        {
          file: 'nx.json',
          ext: '.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: DiffType.Modified,
              path: ['npmScope'],
              value: {
                lhs: 'proj',
                rhs: 'awesome-proj',
              },
            },
          ],
        },
      ],
      {},
      {
        npmScope: 'proj',
        projects: {
          proj1: {
            tags: [],
          },
          proj2: {
            tags: [],
          },
        },
      }
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should return projects added in nx.json', () => {
    const result = getTouchedProjectsInNxJson(
      [
        {
          file: 'nx.json',
          ext: '.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: DiffType.Added,
              path: ['projects', 'proj1'],
              value: {
                lhs: undefined,
                rhs: {
                  tags: [],
                },
              },
            },
            {
              type: DiffType.Added,
              path: ['projects', 'proj1', 'tags'],
              value: {
                lhs: undefined,
                rhs: [],
              },
            },
          ],
        },
      ],
      {},
      {
        npmScope: 'proj',
        projects: {
          proj1: {
            tags: [],
          },
          proj2: {
            tags: [],
          },
        },
      }
    );
    expect(result).toEqual(['proj1']);
  });

  it('should return all projects when a project is removed', () => {
    const result = getTouchedProjectsInNxJson(
      [
        {
          file: 'nx.json',
          ext: '.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: DiffType.Deleted,
              path: ['projects', 'proj3'],
              value: {
                lhs: {
                  tags: [],
                },
                rhs: undefined,
              },
            },
          ],
        },
      ],
      {},
      {
        npmScope: 'proj',
        projects: {
          proj1: {
            tags: [],
          },
          proj2: {
            tags: [],
          },
        },
      }
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should return projects modified in nx.json', () => {
    const result = getTouchedProjectsInNxJson(
      [
        {
          file: 'nx.json',
          ext: '.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: DiffType.Modified,
              path: ['projects', 'proj1'],
              value: {
                lhs: { tags: ['scope:feat'] },
                rhs: {
                  tags: ['scope:shared'],
                },
              },
            },
            {
              type: DiffType.Modified,
              path: ['projects', 'proj1', 'tags'],
              value: {
                lhs: ['scope:feat'],
                rhs: ['scope:shared'],
              },
            },
            {
              type: DiffType.Modified,
              path: ['projects', 'proj1', 'tags', '0'],
              value: {
                lhs: 'scope:feat',
                rhs: 'scope:shared',
              },
            },
          ],
        },
      ],
      {},
      {
        npmScope: 'proj',
        projects: {
          proj1: {
            tags: [],
          },
          proj2: {
            tags: [],
          },
        },
      }
    );
    expect(result).toEqual(['proj1']);
  });
});
