import { getImplicitlyTouchedProjectsByJsonChanges } from './implicit-json-changes';
import { WholeFileChange } from '../../file-utils';
import { JsonDiffType } from '../../../utils/json-diff';
import { NxJsonConfiguration } from '../../../config/nx-json';

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
  let projectsConfigurations;
  let nxJson: NxJsonConfiguration<string[]>;
  beforeEach(() => {
    projectsConfigurations = {};
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
      projectsConfigurations,
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
          getChanges: () => [
            getModifiedChange(['some', 'deep-glob-anything']),
            getModifiedChange(['match-anything']),
            getModifiedChange(['dependencies']),
          ],
        },
      ],
      projectsConfigurations,
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
          getChanges: () => [new WholeFileChange()],
        },
      ],
      projectsConfigurations,
      nxJson
    );
    expect(result).toEqual(['proj1', 'proj2', 'proj3', 'proj4', 'proj5']);
  });
});
