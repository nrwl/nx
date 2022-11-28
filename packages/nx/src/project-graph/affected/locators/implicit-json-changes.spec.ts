import { getImplicitlyTouchedProjectsByJsonChanges } from './implicit-json-changes';
import { WholeFileChange } from '../../file-utils';
import { JsonDiffType } from '../../../utils/json-diff';
import { NxConfiguration } from '../../../config/nx-json';

function getModifiedChange(path: string[]) {
  return {
    type: JsonDiffType.Modified,
    path,
    value: {
      lhs: 'before',
      rhs: 'after',
    },
  };
}

describe('getImplicitlyTouchedProjectsByJsonChanges', () => {
  let workspaceJson;
  let nxConfig: NxConfiguration<string[]>;
  beforeEach(() => {
    workspaceJson = {};
    nxConfig = {
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
    };
  });

  it('should handle deep json changes', () => {
    const result = getImplicitlyTouchedProjectsByJsonChanges(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [getModifiedChange(['some', 'deep-field'])],
        },
      ],
      workspaceJson,
      nxConfig
    );
    expect(result).toEqual(['proj2']);
  });

  it('should handle glob json changes', () => {
    const result = getImplicitlyTouchedProjectsByJsonChanges(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [
            getModifiedChange(['some', 'deep-glob-anything']),
            getModifiedChange(['match-anything']),
            getModifiedChange(['dependencies']),
          ],
        },
      ],
      workspaceJson,
      nxConfig
    );
    expect(result).toEqual(['proj3', 'proj4', 'proj5', 'proj1']);
  });

  it('should handle whole file changes', () => {
    const result = getImplicitlyTouchedProjectsByJsonChanges(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [new WholeFileChange()],
        },
      ],
      workspaceJson,
      nxConfig
    );
    expect(result).toEqual(['proj1', 'proj2', 'proj3', 'proj4', 'proj5']);
  });
});
