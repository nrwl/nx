import { NxJsonConfiguration } from '../../../../config/nx-json';
import { ProjectGraph } from '../../../../config/project-graph';
import { JsonDiffType } from '../../../../utils/json-diff';
import { logger } from '../../../../utils/logger';
import { WholeFileChange } from '../../../../project-graph/file-utils';
import { getTouchedNpmPackages } from './npm-packages';

describe('getTouchedNpmPackages', () => {
  let projectsConfigurations;
  let nxJson: NxJsonConfiguration<string[]>;
  let projectGraph: ProjectGraph;
  beforeEach(() => {
    projectsConfigurations = {
      projects: {
        proj1: {},
        proj2: {},
      },
    };
    nxJson = {
      npmScope: 'scope',
    };
    projectGraph = {
      nodes: {
        proj1: {
          type: 'app',
          name: 'proj1',
          data: {
            files: [],
          } as any,
        },
        proj2: {
          type: 'lib',
          name: 'proj2',
          data: {
            files: [],
          } as any,
        },
      },
      externalNodes: {
        'npm:happy-nrwl': {
          name: 'npm:happy-nrwl',
          type: 'npm',
          data: {
            packageName: 'happy-nrwl',
            version: '1',
          },
        },
        'npm:@types/happy-nrwl': {
          name: 'npm:@types/happy-nrwl',
          type: 'npm',
          data: {
            packageName: '@types/happy-nrwl',
            version: '1',
          },
        },
      },
      dependencies: {
        proj1: [],
        proj2: [],
      },
    };
  });

  it('should handle json changes', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['dependencies', 'happy-nrwl'],
              value: {
                lhs: '0.0.1',
                rhs: '0.0.2',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.2',
        },
      },
      projectGraph
    );
    expect(result).toEqual(['npm:happy-nrwl']);
  });

  it('should handle json changes for type declaration packages where the implementation package exists', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['dependencies', '@types/happy-nrwl'],
              value: {
                lhs: '0.0.1',
                rhs: '0.0.2',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.2',
        },
        devDependencies: {
          '@types/happy-nrwl': '0.0.2',
        },
      },
      projectGraph
    );
    expect(result).toEqual(
      expect.arrayContaining(['npm:@types/happy-nrwl', 'npm:happy-nrwl'])
    );
  });

  it('should handle json changes for type declaration packages where the implementation package does not exist', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['dependencies', '@types/happy-nrwl'],
              value: {
                lhs: '0.0.1',
                rhs: '0.0.2',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        devDependencies: {
          '@types/happy-nrwl': '0.0.2',
        },
      },
      projectGraph
    );
    expect(result).toEqual(expect.arrayContaining(['npm:@types/happy-nrwl']));
  });

  it('should handle package deletion', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Deleted,
              path: ['dependencies', 'sad-nrwl'],
              value: {
                lhs: '0.0.1',
                rhs: undefined,
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.2',
        },
      },
      projectGraph
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should handle package addition', () => {
    projectGraph.externalNodes['npm:awesome-nrwl'] = {
      name: 'npm:awesome-nrwl',
      type: 'npm',
      data: {
        packageName: 'awesome-nrwl',
        version: '1',
      },
    };
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: JsonDiffType.Added,
              path: ['dependencies', 'awesome-nrwl'],
              value: {
                lhs: undefined,
                rhs: '0.0.1',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.2',
          'awesome-nrwl': '0.0.1',
        },
      },
      projectGraph
    );
    expect(result).toEqual(['npm:awesome-nrwl']);
  });

  it('should handle whole file changes', () => {
    projectGraph.externalNodes['npm:awesome-nrwl'] = {
      name: 'npm:awesome-nrwl',
      type: 'npm',
      data: {
        packageName: 'awesome-nrwl',
        version: '1',
      },
    };
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [new WholeFileChange()],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.1',
          'awesome-nrwl': '0.0.1',
        },
      },
      projectGraph
    );
    expect(result).toEqual([
      'npm:happy-nrwl',
      'npm:@types/happy-nrwl',
      'npm:awesome-nrwl',
    ]);
  });

  it('should handle and workspace packages when defined in dependencies', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: 'JsonPropertyAdded',
              path: ['devDependencies', 'changed-test-pkg-name-1'],
              value: { rhs: 'workspace:*' },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.1',
          'awesome-nrwl': '0.0.1',
        },
      },
      {
        ...projectGraph,
        nodes: {
          ...projectGraph.nodes,
          'any-random-name': {
            name: 'changed-test-pkg-name-1',
            type: 'lib',
            data: {} as any,
          },
        },
      }
    );
    expect(result).toEqual(['changed-test-pkg-name-1']);
  });

  it('should handle and log workspace package.json changes when the changes are not in `npmPackages` (projectGraph.externalNodes)', () => {
    jest.spyOn(logger, 'warn');
    expect(() => {
      getTouchedNpmPackages(
        [
          {
            file: 'package.json',
            hash: 'some-hash',
            getChanges: () => [
              {
                type: 'JsonPropertyAdded',
                path: ['devDependencies', 'changed-test-pkg-name-1'],
                value: { rhs: 'workspace:*' },
              },
              {
                type: 'JsonPropertyAdded',
                path: ['devDependencies', 'changed-test-pkg-name-2'],
                value: { rhs: 'workspace:*' },
              },
            ],
          },
        ],
        projectsConfigurations,
        nxJson,
        {
          dependencies: {
            'happy-nrwl': '0.0.1',
            'awesome-nrwl': '0.0.1',
          },
        },
        projectGraph
      );
    }).not.toThrowError();
    expect(logger.warn).toHaveBeenCalledWith(
      'The affected projects might have not been identified properly. The package(s) changed-test-pkg-name-1, changed-test-pkg-name-2 were not found. Please open an issue in GitHub including the package.json file.'
    );
  });
});
