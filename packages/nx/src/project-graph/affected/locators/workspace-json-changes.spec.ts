import { getTouchedProjectsInWorkspaceJson } from './workspace-json-changes';
import { WholeFileChange } from '../../file-utils';
import { JsonDiffType } from '../../../utils/json-diff';

describe('getTouchedProjectsInWorkspaceJson', () => {
  it('should not return changes when angular.json is not touched', async () => {
    const result = await getTouchedProjectsInWorkspaceJson(
      [
        {
          file: 'source.ts',
          hash: 'some-hash',
          getChanges: () => [new WholeFileChange()],
        },
      ],
      {},
      {
        npmScope: 'proj',
      }
    );
    expect([...result.keys()]).toEqual([]);
  });

  it('should return all projects for a whole file change', async () => {
    const result = await getTouchedProjectsInWorkspaceJson(
      [
        {
          file: 'angular.json',
          hash: 'some-hash',
          getChanges: () => [new WholeFileChange()],
        },
      ],
      {
        proj1: {
          name: 'proj1',
          type: 'lib',
          data: {
            root: 'proj1',
            files: [],
            tags: [],
          },
        },
        proj2: {
          name: 'proj2',
          type: 'lib',
          data: {
            root: 'proj2',
            files: [],
            tags: [],
          },
        },
      }
    );
    expect([...result.keys()]).toEqual(['proj1', 'proj2']);
  });

  it('should return all projects for changes to newProjectRoot', async () => {
    const result = await getTouchedProjectsInWorkspaceJson(
      [
        {
          file: 'angular.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['newProjectRoot'],
              value: {
                lhs: '',
                rhs: 'projects',
              },
            },
          ],
        },
      ],
      {
        proj1: {
          name: 'proj1',
          type: 'lib',
          data: {
            files: [],
            root: 'proj1',
            tags: [],
          },
        },
        proj2: {
          name: 'proj2',
          type: 'lib',
          data: {
            files: [],
            root: 'proj2',
            tags: [],
          },
        },
      }
    );
    expect([...result.keys()]).toEqual(['proj1', 'proj2']);
  });

  it('should return projects added in angular.json', async () => {
    const result = await getTouchedProjectsInWorkspaceJson(
      [
        {
          file: 'angular.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Added,
              path: ['projects', 'proj1'],
              value: {
                lhs: undefined,
                rhs: {
                  root: 'proj1',
                },
              },
            },

            {
              type: JsonDiffType.Added,
              path: ['projects', 'proj1', 'root'],
              value: {
                lhs: undefined,
                rhs: 'proj1',
              },
            },
          ],
        },
      ],
      {
        proj1: {
          name: 'proj1',
          type: 'lib',
          data: {
            files: [],
            root: 'proj1',
            tags: [],
          },
        },
      }
    );
    expect([...result.keys()]).toEqual(['proj1']);
  });

  it('should affect all projects if a project is removed from angular.json', async () => {
    const result = await getTouchedProjectsInWorkspaceJson(
      [
        {
          file: 'angular.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Deleted,
              path: ['projects', 'proj3'],
              value: {
                lhs: {
                  root: 'proj3',
                },
                rhs: undefined,
              },
            },
          ],
        },
      ],
      {
        proj1: {
          name: 'proj1',
          type: 'lib',
          data: {
            files: [],
            root: 'proj1',
            tags: [],
          },
        },
        proj2: {
          name: 'proj2',
          type: 'lib',
          data: {
            files: [],
            root: 'proj2',
            tags: [],
          },
        },
      }
    );
    expect([...result.keys()]).toEqual(['proj1', 'proj2']);
  });

  it('should return projects modified in angular.json', async () => {
    const result = await getTouchedProjectsInWorkspaceJson(
      [
        {
          file: 'angular.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['projects', 'proj1'],
              value: {
                lhs: {
                  root: 'proj3',
                },
                rhs: {
                  root: 'proj1',
                },
              },
            },
            {
              type: JsonDiffType.Modified,
              path: ['projects', 'proj1', 'root'],
              value: {
                lhs: 'proj3',
                rhs: 'proj1',
              },
            },
          ],
        },
      ],
      {
        proj1: {
          name: 'proj1',
          type: 'lib',
          data: {
            files: [],
            root: 'proj1',
            tags: [],
          },
        },
        proj2: {
          name: 'proj2',
          type: 'lib',
          data: {
            files: [],
            root: 'proj2',
            tags: [],
          },
        },
      }
    );
    expect([...result.keys()]).toEqual(['proj1']);
  });
});
