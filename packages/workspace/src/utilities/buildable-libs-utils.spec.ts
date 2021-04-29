jest.mock('../core/file-utils', () => ({
  readNxJson: jest.fn(() => ({})),
}));
jest.mock('./fileutils', () => ({
  ...jest.requireActual('./fileutils'),
  readJsonFile: jest.fn(() => ({
    name: '@my-org/lib',
    version: '0.0.1',
  })),
}));
const getDependencyConfigs = jest.fn(() => ({}));
jest.mock('../tasks-runner/utils', () => ({
  getDefaultDependencyConfigs: jest.fn(() => ({})),
  getDependencyConfigs,
  getOutputsForTargetAndConfiguration: jest.fn(() => []),
}));

import { TargetDependencyConfig } from '@nrwl/devkit';
import {
  DependencyType,
  ProjectGraph,
  ProjectType,
} from '../core/project-graph';
import {
  calculateProjectDependencies,
  calculateProjectTargetDependencies,
  DependentBuildableProjectNode,
  updatePaths,
} from './buildable-libs-utils';

describe('updatePaths', () => {
  const deps: DependentBuildableProjectNode[] = [
    { name: '@proj/lib', node: {} as any, outputs: ['dist/libs/lib'] },
  ];

  it('should add path', () => {
    const paths: Record<string, string[]> = {
      '@proj/test': ['libs/test/src/index.ts'],
    };
    updatePaths(deps, paths);
    expect(paths).toEqual({
      '@proj/lib': ['dist/libs/lib'],
      '@proj/test': ['libs/test/src/index.ts'],
    });
  });

  it('should replace paths', () => {
    const paths: Record<string, string[]> = {
      '@proj/lib': ['libs/lib/src/index.ts'],
      '@proj/lib/sub': ['libs/lib/sub/src/index.ts'],
    };
    updatePaths(deps, paths);
    expect(paths).toEqual({
      '@proj/lib': ['dist/libs/lib'],
      '@proj/lib/sub': ['dist/libs/lib/sub'],
    });
  });
});

describe('calculateProjectDependencies', () => {
  it('should include npm packages in dependency list', () => {
    const graph: ProjectGraph = {
      nodes: {
        example: {
          type: ProjectType.lib,
          name: 'example',
          data: {
            files: [],
            root: '/root/example',
          },
        },
        'npm:formik': {
          type: 'npm',
          name: 'npm:formik',
          data: {
            files: [],
            packageName: 'formik',
            version: '0.0.0',
          },
        },
      },
      dependencies: {
        example: [
          {
            source: 'example',
            target: 'npm:formik',
            type: DependencyType.static,
          },
        ],
      },
    };

    const results = calculateProjectDependencies(
      graph,
      'root',
      'example',
      'build',
      undefined
    );
    expect(results).toMatchObject({
      target: {
        type: ProjectType.lib,
        name: 'example',
      },
      dependencies: [{ name: 'formik' }],
    });
  });
});

describe('calculateProjectTargetDependencies', () => {
  const graph: ProjectGraph = {
    nodes: {
      myapp: {
        type: ProjectType.app,
        name: 'myapp',
        data: {
          files: [],
          root: '/root/myapp',
        },
      },
      mylib: {
        type: ProjectType.lib,
        name: 'mylib',
        data: {
          files: [],
          root: '/root/mylib',
        },
      },
      'npm:formik': {
        type: 'npm',
        name: 'npm:formik',
        data: {
          files: [],
          packageName: 'formik',
          version: '0.0.0',
        },
      },
    },
    dependencies: {
      myapp: [
        {
          source: 'myapp',
          target: 'mylib',
          type: DependencyType.static,
        },
      ],
      mylib: [
        {
          source: 'mylib',
          target: 'npm:formik',
          type: DependencyType.static,
        },
      ],
    },
  };

  it('should include dependencies when target depends on dependencies', () => {
    getDependencyConfigs.mockReturnValue([
      { target: 'build', projects: 'dependencies' },
    ]);

    const result = calculateProjectTargetDependencies(
      graph,
      'root',
      'myapp',
      'build',
      undefined
    );

    expect(result).toMatchObject({
      target: {
        type: ProjectType.app,
        name: 'myapp',
      },
      dependencies: [{ name: '@my-org/lib' }, { name: 'formik' }],
    });
  });

  it('should not include dependencies when target only depends on self', () => {
    const dependsOn: TargetDependencyConfig[][] = [
      [{ target: 'pre-build', projects: 'self' }],
      [],
    ];
    getDependencyConfigs.mockImplementation(() => dependsOn.shift());

    const result = calculateProjectTargetDependencies(
      graph,
      'root',
      'myapp',
      'build',
      undefined
    );

    expect(result).toMatchObject({
      target: {
        type: ProjectType.app,
        name: 'myapp',
      },
      dependencies: [],
    });
  });

  it('should include dependencies when target depends on dependencies through another self target', () => {
    const dependsOn: TargetDependencyConfig[][] = [
      [{ target: 'pre-build', projects: 'self' }],
      [{ target: 'build', projects: 'dependencies' }],
      [{ target: 'build', projects: 'dependencies' }],
    ];
    getDependencyConfigs.mockImplementation(() => dependsOn.shift());

    const result = calculateProjectTargetDependencies(
      graph,
      'root',
      'myapp',
      'build',
      undefined
    );

    expect(result).toMatchObject({
      target: {
        type: ProjectType.app,
        name: 'myapp',
      },
      dependencies: [{ name: '@my-org/lib' }, { name: 'formik' }],
    });
  });

  it('should not include dependencies when target has no depends on', () => {
    getDependencyConfigs.mockReturnValue([]);

    const result = calculateProjectTargetDependencies(
      graph,
      'root',
      'myapp',
      'build',
      undefined
    );

    expect(result).toMatchObject({
      target: {
        type: ProjectType.app,
        name: 'myapp',
      },
      dependencies: [],
    });
  });
});
