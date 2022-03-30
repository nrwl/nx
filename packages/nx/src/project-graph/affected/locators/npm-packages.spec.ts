import { getTouchedNpmPackages } from './npm-packages';
import { WholeFileChange } from '../../file-utils';
import { DiffType } from '../../../utils/json-diff';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { ProjectGraph } from '../../../config/project-graph';

describe('getTouchedNpmPackages', () => {
  let workspaceJson;
  let nxJson: NxJsonConfiguration<string[]>;
  let projectGraph: ProjectGraph;
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
    };
    projectGraph = {
      nodes: {
        proj1: {
          type: 'app',
          name: 'proj1',
          data: {
            files: [],
          },
        },
        proj2: {
          type: 'lib',
          name: 'proj2',
          data: {
            files: [],
          },
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
              type: DiffType.Modified,
              path: ['dependencies', 'happy-nrwl'],
              value: {
                lhs: '0.0.1',
                rhs: '0.0.2',
              },
            },
          ],
        },
      ],
      workspaceJson,
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

  it('should handle package deletion', () => {
    const result = getTouchedNpmPackages(
      [
        {
          file: 'package.json',
          hash: 'some-hash',
          getChanges: () => [
            {
              type: DiffType.Deleted,
              path: ['dependencies', 'sad-nrwl'],
              value: {
                lhs: '0.0.1',
                rhs: undefined,
              },
            },
          ],
        },
      ],
      workspaceJson,
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
              type: DiffType.Added,
              path: ['dependencies', 'awesome-nrwl'],
              value: {
                lhs: undefined,
                rhs: '0.0.1',
              },
            },
          ],
        },
      ],
      workspaceJson,
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
      workspaceJson,
      nxJson,
      {
        dependencies: {
          'happy-nrwl': '0.0.1',
          'awesome-nrwl': '0.0.1',
        },
      },
      projectGraph
    );
    expect(result).toEqual(['npm:happy-nrwl', 'npm:awesome-nrwl']);
  });
});
