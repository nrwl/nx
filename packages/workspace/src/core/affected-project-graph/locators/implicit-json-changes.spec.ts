import { getImplicitlyTouchedProjectsByJsonChanges } from './implicit-json-changes';
import { NxJson } from '../../shared-interfaces';
import { WholeFileChange } from '../../file-utils';
import { DiffType } from '../../../utilities/json-diff';

function getModifiedChange(path: string[]) {
  return {
    type: DiffType.Modified,
    path,
    value: {
      lhs: 'before',
      rhs: 'after',
    },
  };
}

describe('getImplicitlyTouchedProjectsByJsonChanges', () => {
  let workspaceJson;
  let nxJson: NxJson<string[]>;
  beforeEach(() => {
    workspaceJson = null;
    nxJson = {
      implicitDependencies: {
        'package.json': {
          dependencies: ['proj1'],
          some: {
            'deep-field': ['proj2'],
            'deep-glob-*': ['proj3'],
          },
          'match-*': ['proj4', 'proj5'],
        },
      },
      npmScope: 'scope',
      projects: {},
    };
  });

  it('should handle deep json changes', () => {
    const result = getImplicitlyTouchedProjectsByJsonChanges(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          ext: '.json',
          getChanges: () => [getModifiedChange(['some', 'deep-field'])],
        },
      ],
      workspaceJson,
      nxJson
    );
    expect(result).toEqual(['proj2']);
  });

  it('should handle glob json changes', () => {
    const result = getImplicitlyTouchedProjectsByJsonChanges(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          ext: '.json',
          getChanges: () => [
            getModifiedChange(['some', 'deep-glob-anything']),
            getModifiedChange(['match-anything']),
            getModifiedChange(['dependencies']),
          ],
        },
      ],
      workspaceJson,
      nxJson
    );
    expect(result).toEqual(['proj3', 'proj4', 'proj5', 'proj1']);
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
    expect(result).toEqual(['proj1', 'proj2', 'proj3', 'proj4', 'proj5']);
  });
});
