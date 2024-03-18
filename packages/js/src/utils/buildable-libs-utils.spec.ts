import { DependencyType, ProjectGraph, TaskGraph } from '@nx/devkit';
import {
  calculateProjectDependencies,
  calculateDependenciesFromTaskGraph,
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
  it('should include npm packages in dependency list', async () => {
    const graph: ProjectGraph = {
      nodes: {
        example: {
          type: 'lib',
          name: 'example',
          data: {
            root: '/root/example',
          },
        },
      },
      externalNodes: {
        'npm:formik': {
          type: 'npm',
          name: 'npm:formik',
          data: {
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

    const results = await calculateProjectDependencies(
      graph,
      'root',
      'example',
      'build',
      undefined
    );
    expect(results).toMatchObject({
      target: {
        type: 'lib',
        name: 'example',
      },
      dependencies: [{ name: 'formik' }],
    });
  });

  it('should include npm packages in dependency list and sort them correctly', async () => {
    const graph: ProjectGraph = {
      nodes: {
        example: {
          type: 'lib',
          name: 'example',
          data: {
            root: '/root/example',
          },
        },
      },
      externalNodes: {
        'npm:some-lib': {
          type: 'npm',
          name: 'npm:some-lib',
          data: {
            packageName: 'some-lib',
            version: '0.0.0',
          },
        },
        'npm:formik': {
          type: 'npm',
          name: 'npm:formik',
          data: {
            packageName: 'formik',
            version: '0.0.0',
          },
        },
        'npm:@prefixed-lib': {
          type: 'npm',
          name: 'npm:@prefixed-lib',
          data: {
            packageName: '@prefixed-lib',
            version: '0.0.0',
          },
        },
      },
      dependencies: {
        example: [
          {
            source: 'example',
            target: 'npm:some-lib',
            type: DependencyType.static,
          },
          {
            source: 'example',
            target: 'npm:formik',
            type: DependencyType.static,
          },
          {
            source: 'example',
            target: 'npm:@prefixed-lib',
            type: DependencyType.static,
          },
        ],
      },
    };

    const results = await calculateProjectDependencies(
      graph,
      'root',
      'example',
      'build',
      undefined
    );
    expect(results).toMatchObject({
      target: {
        type: 'lib',
        name: 'example',
      },
      dependencies: [
        { name: '@prefixed-lib' },
        { name: 'formik' },
        { name: 'some-lib' },
      ],
    });
  });

  it('should include all top-level dependencies, even ones that are also transitive', async () => {
    const graph: ProjectGraph = {
      nodes: {
        example: {
          type: 'lib',
          name: 'example',
          data: {
            root: '/root/example',
            targets: {
              build: {
                executor: 'x',
              },
            },
          },
        },
        example2: {
          type: 'lib',
          name: 'example2',
          data: {
            root: '/root/example2',
            targets: {
              build: {
                executor: 'x',
              },
            },
          },
        },
      },
      externalNodes: {
        'npm:formik': {
          type: 'npm',
          name: 'npm:formik',
          data: {
            packageName: 'formik',
            version: '0.0.0',
          },
        },
        'npm:foo': {
          type: 'npm',
          name: 'npm:foo',
          data: {
            packageName: 'foo',
            version: '0.0.0',
          },
        },
      },
      dependencies: {
        example: [
          // when example2 dependency is listed first
          {
            source: 'example',
            target: 'example2',
            type: DependencyType.static,
          },
          {
            source: 'example',
            target: 'npm:formik',
            type: DependencyType.static,
          },
        ],
        example2: [
          // and example2 also depends on npm:formik
          {
            source: 'example2',
            target: 'npm:formik',
            type: DependencyType.static,
          },
          {
            source: 'example2',
            target: 'npm:foo',
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
        name: 'example',
      },
      topLevelDependencies: [
        // expect example2 and formik as top-level deps, but not foo
        expect.objectContaining({ name: 'example2' }),
        expect.objectContaining({ name: 'formik' }),
      ],
    });
  });
});

describe('calculateDependenciesFromTaskGraph', () => {
  it('should calculate workspace and npm dependencies correctly', () => {
    /**
     * Project Graph:
     * lib1 -> lib2 -> lib3
     *              -> lib4 -> npm:formik,npm:lodash
     *      -> lib3 // should not be duplicated
     *      -> npm:formik // should not be duplicated
     * lib5 -> npm:fs-extra // lib5 is not a dependency, not part of the task graph or the result
     *
     * Target deps config:
     * build: [^build, build-base]
     *
     * Task Graph:
     * lib1:build -> lib2:build -> lib2:build-base
     *                          -> lib3:build
     *                          -> lib4:build
     *            -> lib3:build
     */
    const projectGraph: ProjectGraph = {
      nodes: {
        lib1: {
          type: 'lib',
          name: 'lib1',
          data: { root: 'libs/lib1', targets: { build: {} } },
        },
        lib2: {
          type: 'lib',
          name: 'lib2',
          data: { root: 'libs/lib2', targets: { build: {}, 'build-base': {} } },
        },
        lib3: {
          type: 'lib',
          name: 'lib3',
          data: { root: 'libs/lib3', targets: { build: {} } },
        },
        lib4: {
          type: 'lib',
          name: 'lib4',
          data: { root: 'libs/lib4', targets: { build: {} } },
        },
        lib5: {
          type: 'lib',
          name: 'lib5',
          data: { root: 'libs/lib5', targets: { build: {} } },
        },
      },
      externalNodes: {
        'npm:formik': {
          type: 'npm',
          name: 'npm:formik',
          data: { packageName: 'formik', version: '0.0.0' },
        },
        'npm:lodash': {
          type: 'npm',
          name: 'npm:lodash',
          data: { packageName: 'lodash', version: '0.0.0' },
        },
        'npm:fs-extra': {
          type: 'npm',
          name: 'npm:fs-extra',
          data: { packageName: 'fs-extra', version: '0.0.0' },
        },
      },
      dependencies: {
        lib1: [
          {
            source: 'lib1',
            target: 'npm:formik',
            type: DependencyType.static,
          },
          {
            source: 'lib1',
            target: 'lib2',
            type: DependencyType.static,
          },
          {
            source: 'lib1',
            target: 'lib3',
            type: DependencyType.static,
          },
        ],
        lib2: [
          {
            source: 'lib2',
            target: 'lib3',
            type: DependencyType.static,
          },
          {
            source: 'lib2',
            target: 'lib4',
            type: DependencyType.static,
          },
        ],
        lib3: [],
        lib4: [
          {
            source: 'lib4',
            target: 'npm:formik',
            type: DependencyType.static,
          },
          {
            source: 'lib4',
            target: 'npm:lodash',
            type: DependencyType.static,
          },
        ],
        lib5: [
          {
            source: 'lib5',
            target: 'npm:fs-extra',
            type: DependencyType.static,
          },
        ],
      },
    };
    const taskGraph: TaskGraph = {
      dependencies: {
        'lib1:build': ['lib2:build', 'lib3:build'],
        'lib2:build': ['lib2:build-base', 'lib3:build', 'lib4:build'],
        'lib2:build-base': [],
        'lib3:build': [],
        'lib4:build': [],
      },
      roots: [],
      tasks: {
        'lib1:build': {
          id: 'lib1:build',
          overrides: {},
          target: { project: 'lib1', target: 'build' },
          outputs: [],
        },
        'lib2:build': {
          id: 'lib2:build',
          overrides: {},
          target: { project: 'lib2', target: 'build' },
          outputs: [],
        },
        'lib2:build-base': {
          id: 'lib2:build-base',
          overrides: {},
          target: { project: 'lib2', target: 'build-base' },
          outputs: [],
        },
        'lib3:build': {
          id: 'lib3:build',
          overrides: {},
          target: { project: 'lib3', target: 'build' },
          outputs: [],
        },
        'lib4:build': {
          id: 'lib4:build',
          overrides: {},
          target: { project: 'lib4', target: 'build' },
          outputs: [],
        },
      },
    };

    const results = calculateDependenciesFromTaskGraph(
      taskGraph,
      projectGraph,
      'root',
      'lib1',
      'build',
      undefined
    );

    expect(results).toMatchObject({
      target: { type: 'lib', name: 'lib1' },
      dependencies: [
        { name: 'formik' },
        { name: 'lib2' },
        { name: 'lib3' },
        { name: 'lib4' },
        { name: 'lodash' },
      ],
      nonBuildableDependencies: [],
      topLevelDependencies: [
        { name: 'lib2' },
        { name: 'lib3' },
        { name: 'formik' },
      ],
    });
  });

  it('should calculate workspace and npm dependencies correctly with a different target dependencies setup', () => {
    /**
     * Project Graph:
     * lib1 -> lib2 -> lib3
     *              -> lib4 -> npm:formik,npm:lodash
     *      -> lib3 // should not be duplicated
     *      -> npm:formik // should not be duplicated
     *
     * Target deps config:
     * build: [build-base]
     * build-base: [^build]
     *
     * Task Graph:
     * lib1:build -> lib1:build-base -> lib2:build -> lib2:build-base -> lib3:build -> lib3:build-base
     *                                                                -> lib4:build -> lib4:build-base
     *                               -> lib3:build -> lib3:build-base
     */
    const projectGraph: ProjectGraph = {
      nodes: {
        lib1: {
          type: 'lib',
          name: 'lib1',
          data: { root: 'libs/lib1', targets: { build: {}, 'build-base': {} } },
        },
        lib2: {
          type: 'lib',
          name: 'lib2',
          data: { root: 'libs/lib2', targets: { build: {}, 'build-base': {} } },
        },
        lib3: {
          type: 'lib',
          name: 'lib3',
          data: { root: 'libs/lib3', targets: { build: {}, 'build-base': {} } },
        },
        lib4: {
          type: 'lib',
          name: 'lib4',
          data: { root: 'libs/lib4', targets: { build: {}, 'build-base': {} } },
        },
      },
      externalNodes: {
        'npm:formik': {
          type: 'npm',
          name: 'npm:formik',
          data: { packageName: 'formik', version: '0.0.0' },
        },
        'npm:lodash': {
          type: 'npm',
          name: 'npm:lodash',
          data: { packageName: 'lodash', version: '0.0.0' },
        },
      },
      dependencies: {
        lib1: [
          {
            source: 'lib1',
            target: 'npm:formik',
            type: DependencyType.static,
          },
          {
            source: 'lib1',
            target: 'lib2',
            type: DependencyType.static,
          },
          {
            source: 'lib1',
            target: 'lib3',
            type: DependencyType.static,
          },
        ],
        lib2: [
          {
            source: 'lib2',
            target: 'lib3',
            type: DependencyType.static,
          },
          {
            source: 'lib2',
            target: 'lib4',
            type: DependencyType.static,
          },
        ],
        lib3: [],
        lib4: [
          {
            source: 'lib4',
            target: 'npm:formik',
            type: DependencyType.static,
          },
          {
            source: 'lib4',
            target: 'npm:lodash',
            type: DependencyType.static,
          },
        ],
      },
    };
    const taskGraph: TaskGraph = {
      dependencies: {
        'lib1:build': ['lib1:build-base'],
        'lib1:build-base': ['lib2:build', 'lib3:build'],
        'lib2:build': ['lib2:build-base'],
        'lib2:build-base': ['lib3:build', 'lib4:build'],
        'lib3:build': ['lib3:build-base'],
        'lib3:build-base': [],
        'lib4:build': ['lib4:build-base'],
        'lib4:build-base': [],
      },
      roots: [],
      tasks: {
        'lib1:build': {
          id: 'lib1:build',
          overrides: {},
          target: { project: 'lib1', target: 'build' },
          outputs: [],
        },
        'lib1:build-base': {
          id: 'lib1:build-base',
          overrides: {},
          target: { project: 'lib1', target: 'build-base' },
          outputs: [],
        },
        'lib2:build': {
          id: 'lib2:build',
          overrides: {},
          target: { project: 'lib2', target: 'build' },
          outputs: [],
        },
        'lib2:build-base': {
          id: 'lib2:build-base',
          overrides: {},
          target: { project: 'lib2', target: 'build-base' },
          outputs: [],
        },
        'lib3:build': {
          id: 'lib3:build',
          overrides: {},
          target: { project: 'lib3', target: 'build' },
          outputs: [],
        },
        'lib3:build-base': {
          id: 'lib3:build-base',
          overrides: {},
          target: { project: 'lib3', target: 'build-base' },
          outputs: [],
        },
        'lib4:build': {
          id: 'lib4:build',
          overrides: {},
          target: { project: 'lib4', target: 'build' },
          outputs: [],
        },
        'lib4:build-base': {
          id: 'lib4:build-base',
          overrides: {},
          target: { project: 'lib4', target: 'build-base' },
          outputs: [],
        },
      },
    };

    const results = calculateDependenciesFromTaskGraph(
      taskGraph,
      projectGraph,
      'root',
      'lib1',
      'build',
      undefined
    );

    expect(results).toMatchObject({
      target: { type: 'lib', name: 'lib1' },
      dependencies: [
        { name: 'formik' },
        { name: 'lib2' },
        { name: 'lib3' },
        { name: 'lib4' },
        { name: 'lodash' },
      ],
      nonBuildableDependencies: [],
      topLevelDependencies: [
        { name: 'lib2' },
        { name: 'lib3' },
        { name: 'formik' },
      ],
    });
  });

  it('should include npm packages in dependency list and sort them correctly', () => {
    const projectGraph: ProjectGraph = {
      nodes: {
        example: {
          type: 'lib',
          name: 'example',
          data: {
            root: '/root/example',
          },
        },
      },
      externalNodes: {
        'npm:some-lib': {
          type: 'npm',
          name: 'npm:some-lib',
          data: {
            packageName: 'some-lib',
            version: '0.0.0',
          },
        },
        'npm:formik': {
          type: 'npm',
          name: 'npm:formik',
          data: {
            packageName: 'formik',
            version: '0.0.0',
          },
        },
        'npm:@prefixed-lib': {
          type: 'npm',
          name: 'npm:@prefixed-lib',
          data: {
            packageName: '@prefixed-lib',
            version: '0.0.0',
          },
        },
      },
      dependencies: {
        example: [
          {
            source: 'example',
            target: 'npm:some-lib',
            type: DependencyType.static,
          },
          {
            source: 'example',
            target: 'npm:formik',
            type: DependencyType.static,
          },
          {
            source: 'example',
            target: 'npm:@prefixed-lib',
            type: DependencyType.static,
          },
        ],
      },
    };
    // not relevant for this test case
    const taskGraph: TaskGraph = {
      dependencies: {},
      roots: [],
      tasks: {},
    };

    const results = calculateDependenciesFromTaskGraph(
      taskGraph,
      projectGraph,
      'root',
      'example',
      'build',
      undefined
    );
    expect(results).toMatchObject({
      target: {
        type: 'lib',
        name: 'example',
      },
      dependencies: [
        { name: '@prefixed-lib' },
        { name: 'formik' },
        { name: 'some-lib' },
      ],
    });
  });
});

describe('missingDependencies', () => {
  it('should throw an error if dependency is missing', async () => {
    const graph: ProjectGraph = {
      nodes: {
        example: {
          type: 'lib',
          name: 'example',
          data: {
            root: '/root/example',
          },
        },
      },
      externalNodes: {},
      dependencies: {
        example: [
          {
            source: 'example',
            target: 'missing',
            type: DependencyType.static,
          },
        ],
      },
    };

    expect(() =>
      calculateProjectDependencies(graph, 'root', 'example', 'build', undefined)
    ).toThrow();
  });
});
