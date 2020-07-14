import { getImplicitlyTouchedProjectsByJsonChanges } from './implicit-json-changes';
import { NxJson } from '../../shared-interfaces';
import { WholeFileChange } from '../../file-utils';
import { DiffType } from '../../../utils/json-diff';

describe('getImplicitlyTouchedProjectsByJsonChanges', () => {
  let workspaceJson;
  let nxJson: NxJson<string[]>;
  beforeEach(() => {
    workspaceJson = {
      projects: {
        proj1: {},
        proj2: {},
      },
    };
    nxJson = {
      implicitDependencies: {
        'package.json': {
          dependencies: ['proj1'],
          some: {
            'deep-field': ['proj2'],
          },
        },
      },
      npmScope: 'scope',
      projects: {
        proj1: {},
        proj2: {},
      },
    };
  });

  it('should handle json changes', () => {
    const result = getImplicitlyTouchedProjectsByJsonChanges(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          ext: '.json',
          getChanges: () => [
            {
              type: DiffType.Modified,
              path: ['some', 'deep-field'],
              value: {
                lhs: 'before',
                rhs: 'after',
              },
            },
          ],
        },
      ],
      workspaceJson,
      nxJson
    );
    expect(result).toEqual(['proj2']);
  });

  it('should handle whole file changes', () => {
    const result = getImplicitlyTouchedProjectsByJsonChanges(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          ext: '.json',
          getChanges: () => [new WholeFileChange()],
        },
      ],
      workspaceJson,
      nxJson
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });
});
