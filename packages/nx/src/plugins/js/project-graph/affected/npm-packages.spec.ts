import { NxJsonConfiguration } from '../../../../config/nx-json';
import { ProjectGraph } from '../../../../config/project-graph';
import { jsonDiff, JsonDiffType } from '../../../../utils/json-diff';
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
    nxJson = {};
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
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    expect(() => {
      getTouchedNpmPackages(
        [
          {
            file: 'package.json',
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
    }).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      'The affected projects might have not been identified properly. The package(s) changed-test-pkg-name-1, changed-test-pkg-name-2 were not found. Please open an issue in GitHub including the package.json file.'
    );
  });

  it('should mark all projects as affected when overrides are changed for unknown packages', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['overrides', 'some-unknown-package'],
              value: {
                lhs: '1.0.0',
                rhs: '2.0.0',
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
        overrides: {
          'some-unknown-package': '2.0.0',
        },
      },
      projectGraph
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should mark specific package as affected when overrides are changed for known packages', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['overrides', 'happy-nrwl'],
              value: {
                lhs: '1.0.0',
                rhs: '2.0.0',
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
        overrides: {
          'happy-nrwl': '2.0.0',
        },
      },
      projectGraph
    );
    expect(result).toEqual(['npm:happy-nrwl']);
  });

  it('should preserve the original package when an override changes from a string to an object', () => {
    projectGraph.externalNodes['npm:nested-nrwl'] = {
      name: 'npm:nested-nrwl',
      type: 'npm',
      data: {
        packageName: 'nested-nrwl',
        version: '1',
      },
    };
    const basePackageJson = {
      overrides: {
        'happy-nrwl': '1.0.0',
      },
    };
    const headPackageJson = {
      overrides: {
        'happy-nrwl': {
          'nested-nrwl': '1.0.0',
        },
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => jsonDiff(basePackageJson, headPackageJson),
        },
      ],
      projectsConfigurations,
      nxJson,
      headPackageJson,
      projectGraph
    );

    expect(result).toEqual(['npm:happy-nrwl', 'npm:nested-nrwl']);
  });

  it('should fall back to all projects when a scoped override target is missing', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['overrides', '@scope/happy-nrwl@^1'],
              value: {
                lhs: '1.0.0',
                rhs: '2.0.0',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        overrides: {
          '@scope/happy-nrwl@^1': '2.0.0',
        },
      },
      projectGraph
    );

    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should mark every installed package version as affected for version-scoped overrides', () => {
    projectGraph.externalNodes['npm:happy-nrwl@2'] = {
      name: 'npm:happy-nrwl@2',
      type: 'npm',
      data: {
        packageName: 'happy-nrwl',
        version: '2',
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Added,
              path: ['pnpm', 'overrides', 'happy-nrwl@>=1.0.0 <2.0.0'],
              value: {
                lhs: undefined,
                rhs: '2.0.0',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        pnpm: {
          overrides: {
            'happy-nrwl@>=1.0.0 <2.0.0': '2.0.0',
          },
        },
      },
      projectGraph
    );

    expect(result).toEqual(['npm:happy-nrwl', 'npm:happy-nrwl@2']);
  });

  it('should scope affected packages when versioned override keys are replaced', () => {
    for (const version of ['1.1.18', '2.1.4', '5.0.9']) {
      const name = `npm:brace-expansion@${version}`;
      projectGraph.externalNodes[name] = {
        name,
        type: 'npm',
        data: {
          packageName: 'brace-expansion',
          version,
        },
      };
    }

    const basePackageJson = {
      pnpm: {
        overrides: {
          'brace-expansion@>=5.0.0 <5.0.6': '5.0.6',
        },
      },
    };
    const headPackageJson = {
      pnpm: {
        overrides: {
          'brace-expansion@<1.1.17': '1.1.18',
          'brace-expansion@>=2.0.0 <2.1.3': '2.1.4',
          'brace-expansion@>=5.0.0 <5.0.9': '5.0.9',
        },
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => jsonDiff(basePackageJson, headPackageJson),
        },
      ],
      projectsConfigurations,
      nxJson,
      headPackageJson,
      projectGraph
    );

    expect(result).toEqual([
      'npm:brace-expansion@1.1.18',
      'npm:brace-expansion@2.1.4',
      'npm:brace-expansion@5.0.9',
    ]);
  });

  it('should handle version-scoped overrides for scoped packages', () => {
    projectGraph.externalNodes['npm:@scope/happy-nrwl'] = {
      name: 'npm:@scope/happy-nrwl',
      type: 'npm',
      data: {
        packageName: '@scope/happy-nrwl',
        version: '2',
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['overrides', '@scope/happy-nrwl@>=1.0.0 <2.0.0'],
              value: {
                lhs: '1.0.0',
                rhs: '2.0.0',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        overrides: {
          '@scope/happy-nrwl@>=1.0.0 <2.0.0': '2.0.0',
        },
      },
      projectGraph
    );

    expect(result).toEqual(['npm:@scope/happy-nrwl']);
  });

  it('should mark the child package as affected for parent-scoped pnpm overrides', () => {
    projectGraph.externalNodes['npm:parent-nrwl'] = {
      name: 'npm:parent-nrwl',
      type: 'npm',
      data: {
        packageName: 'parent-nrwl',
        version: '2',
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: [
                'pnpm',
                'overrides',
                'parent-nrwl@>1.0.0>happy-nrwl@>=1.0.0',
              ],
              value: {
                lhs: '1.0.0',
                rhs: '2.0.0',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        pnpm: {
          overrides: {
            'parent-nrwl@>1.0.0>happy-nrwl@>=1.0.0': '2.0.0',
          },
        },
      },
      projectGraph
    );

    expect(result).toEqual(['npm:happy-nrwl']);
  });

  it('should fall back to all projects when a pnpm override target is missing', () => {
    projectGraph.externalNodes['npm:parent-nrwl'] = {
      name: 'npm:parent-nrwl',
      type: 'npm',
      data: {
        packageName: 'parent-nrwl',
        version: '1',
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['pnpm', 'overrides', 'parent-nrwl@1>unknown-child@1'],
              value: {
                lhs: '1.0.0',
                rhs: '2.0.0',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        pnpm: {
          overrides: {
            'parent-nrwl@1>unknown-child@1': '2.0.0',
          },
        },
      },
      projectGraph
    );

    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should mark the child package as affected for nested npm overrides', () => {
    projectGraph.externalNodes['npm:parent-nrwl'] = {
      name: 'npm:parent-nrwl',
      type: 'npm',
      data: {
        packageName: 'parent-nrwl',
        version: '2',
      },
    };
    const basePackageJson = {
      overrides: {
        'parent-nrwl@^2.0.0': {
          'happy-nrwl': '1.0.0',
        },
      },
    };
    const headPackageJson = {
      overrides: {
        'parent-nrwl@^2.0.0': {
          'happy-nrwl': '2.0.0',
        },
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => jsonDiff(basePackageJson, headPackageJson),
        },
      ],
      projectsConfigurations,
      nxJson,
      headPackageJson,
      projectGraph
    );

    expect(result).toEqual(['npm:happy-nrwl']);
  });

  it('should handle the self key in nested npm overrides', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['overrides', 'happy-nrwl@^1.0.0', '.'],
              value: {
                lhs: '1.0.0',
                rhs: '1.1.0',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        overrides: {
          'happy-nrwl@^1.0.0': {
            '.': '1.1.0',
          },
        },
      },
      projectGraph
    );

    expect(result).toEqual(['npm:happy-nrwl']);
  });

  it('should fall back to all projects when a resolution path target is missing', () => {
    projectGraph.externalNodes['npm:parent-nrwl'] = {
      name: 'npm:parent-nrwl',
      type: 'npm',
      data: {
        packageName: 'parent-nrwl',
        version: '1',
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['resolutions', 'parent-nrwl@^1/unknown-child@^1'],
              value: {
                lhs: '1.0.0',
                rhs: '2.0.0',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        resolutions: {
          'parent-nrwl@^1/unknown-child@^1': '2.0.0',
        },
      },
      projectGraph
    );

    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should mark all projects as affected when resolutions are changed for unknown packages', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Added,
              path: ['resolutions', 'some-unknown-package'],
              value: {
                lhs: undefined,
                rhs: '2.0.0',
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
        resolutions: {
          'some-unknown-package': '2.0.0',
        },
      },
      projectGraph
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });

  it('should not treat a pnpm greater-than range as a parent selector', () => {
    projectGraph.externalNodes['npm:1'] = {
      name: 'npm:1',
      type: 'npm',
      data: {
        packageName: '1',
        version: '1',
      },
    };

    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Modified,
              path: ['pnpm', 'overrides', 'happy-nrwl@>1'],
              value: {
                lhs: '1.0.0',
                rhs: '2.0.0',
              },
            },
          ],
        },
      ],
      projectsConfigurations,
      nxJson,
      {
        pnpm: {
          overrides: {
            'happy-nrwl@>1': '2.0.0',
          },
        },
      },
      projectGraph
    );

    expect(result).toEqual(['npm:happy-nrwl']);
  });

  it('should mark specific package as affected when pnpm.overrides are changed for known packages', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Deleted,
              path: ['pnpm', 'overrides', 'happy-nrwl'],
              value: {
                lhs: '1.0.0',
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
        pnpm: {
          overrides: {},
        },
      },
      projectGraph
    );
    expect(result).toEqual(['npm:happy-nrwl']);
  });

  it('should mark all projects as affected when pnpm.overrides are changed for unknown packages', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: JsonDiffType.Deleted,
              path: ['pnpm', 'overrides', 'some-unknown-package'],
              value: {
                lhs: '1.0.0',
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
        pnpm: {
          overrides: {},
        },
      },
      projectGraph
    );
    expect(result).toEqual(['proj1', 'proj2']);
  });
});
