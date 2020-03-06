import { getTouchedNpmPackages } from './npm-packages';
import { NxJson } from '../../shared-interfaces';
import { WholeFileChange } from '../..//file-utils';
import { DiffType } from '../../../utils/json-diff';

describe('getTouchedNpmPackages', () => {
  let workspaceJson;
  let nxJson: NxJson<string[]>;
  beforeEach(() => {
    workspaceJson = {
      projects: {
        proj1: {},
        proj2: {}
      }
    };
    nxJson = {
      implicitDependencies: {
        'package.json': {
          dependencies: ['proj1'],
          some: {
            'deep-field': ['proj2']
          }
        }
      },
      npmScope: 'scope',
      projects: {
        proj1: {},
        proj2: {}
      }
    };
  });

  it('should handle json changes', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          mtime: 0,
          ext: '.json',
          getChanges: () => [
            {
              type: DiffType.Modified,
              path: ['dependencies', 'happy-nrwl'],
              value: {
                lhs: '0.0.1',
                rhs: '0.0.2'
              }
            }
          ]
        }
      ],
      workspaceJson,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.2'
        }
      }
    );
    expect(result).toEqual(['happy-nrwl']);
  });

  it('should handle package deletion', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          mtime: 0,
          ext: '.json',
          getChanges: () => [
            {
              type: DiffType.Deleted,
              path: ['dependencies', 'sad-nrwl'],
              value: {
                lhs: '0.0.1',
                rhs: undefined
              }
            }
          ]
        }
      ],
      workspaceJson,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.2'
        }
      }
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should handle package addition', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          mtime: 0,
          ext: '.json',
          getChanges: () => [
            {
              type: DiffType.Added,
              path: ['dependencies', 'awesome-nrwl'],
              value: {
                lhs: undefined,
                rhs: '0.0.1'
              }
            }
          ]
        }
      ],
      workspaceJson,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.2',
          'awesome-nrwl': '0.0.1'
        }
      }
    );
    expect(result).toEqual(['awesome-nrwl']);
  });

  it('should handle whole file changes', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          mtime: 0,
          ext: '.json',
          getChanges: () => [new WholeFileChange()]
        }
      ],
      workspaceJson,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.1',
          'awesome-nrwl': '0.0.1'
        }
      }
    );
    expect(result).toEqual(['happy-nrwl', 'awesome-nrwl']);
  });
});
