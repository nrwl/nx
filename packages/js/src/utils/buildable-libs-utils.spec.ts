import { DependencyType, ProjectGraph, TaskGraph } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { readFileSync } from 'fs';
import {
  calculateDependenciesFromTaskGraph,
  calculateProjectDependencies,
  createTmpTsConfig,
  DependentBuildableProjectNode,
  updatePaths,
} from './buildable-libs-utils';
import { join } from 'path';

describe('updatePaths', () => {
  const deps: DependentBuildableProjectNode[] = [
    {
      name: '@proj/lib',
      node: { type: 'lib', data: { root: 'libs/lib' } } as any,
      outputs: ['dist/libs/lib'],
    },
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
      '@proj/lib/sub': [
        'dist/libs/lib/sub',
        'dist/libs/lib/sub/src/index',
        'dist/libs/lib/sub/src/index.ts',
      ],
    });
  });

  it('should handle outputs with glob patterns', () => {
    const paths: Record<string, string[]> = {
      '@proj/lib1': ['libs/lib1/src/index.ts'],
      '@proj/lib2': ['libs/lib2/src/index.ts'],
      '@proj/lib3': ['libs/lib3/src/index.ts'],
    };

    updatePaths(
      [
        {
          name: '@proj/lib1',
          node: { name: 'lib1', type: 'lib', data: { root: 'libs/lib1' } },
          outputs: ['dist/libs/lib1/**/*.js'],
        },
        {
          name: '@proj/lib2',
          node: { name: 'lib2', type: 'lib', data: { root: 'libs/lib2' } },
          outputs: ['dist/libs/lib2/*.js'],
        },
        {
          name: '@proj/lib3',
          node: { name: 'lib3', type: 'lib', data: { root: 'libs/lib3' } },
          outputs: ['dist/libs/lib3/foo-*/*.js'],
        },
      ],
      paths
    );

    expect(paths).toEqual({
      '@proj/lib1': ['dist/libs/lib1'],
      '@proj/lib2': ['dist/libs/lib2'],
      '@proj/lib3': ['dist/libs/lib3'],
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
      continuousDependencies: {},
      roots: [],
      tasks: {
        'lib1:build': {
          id: 'lib1:build',
          overrides: {},
          target: { project: 'lib1', target: 'build' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib2:build': {
          id: 'lib2:build',
          overrides: {},
          target: { project: 'lib2', target: 'build' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib2:build-base': {
          id: 'lib2:build-base',
          overrides: {},
          target: { project: 'lib2', target: 'build-base' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib3:build': {
          id: 'lib3:build',
          overrides: {},
          target: { project: 'lib3', target: 'build' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib4:build': {
          id: 'lib4:build',
          overrides: {},
          target: { project: 'lib4', target: 'build' },
          outputs: [],
          parallelism: true,
          continuous: false,
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
      continuousDependencies: {},
      roots: [],
      tasks: {
        'lib1:build': {
          id: 'lib1:build',
          overrides: {},
          target: { project: 'lib1', target: 'build' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib1:build-base': {
          id: 'lib1:build-base',
          overrides: {},
          target: { project: 'lib1', target: 'build-base' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib2:build': {
          id: 'lib2:build',
          overrides: {},
          target: { project: 'lib2', target: 'build' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib2:build-base': {
          id: 'lib2:build-base',
          overrides: {},
          target: { project: 'lib2', target: 'build-base' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib3:build': {
          id: 'lib3:build',
          overrides: {},
          target: { project: 'lib3', target: 'build' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib3:build-base': {
          id: 'lib3:build-base',
          overrides: {},
          target: { project: 'lib3', target: 'build-base' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib4:build': {
          id: 'lib4:build',
          overrides: {},
          target: { project: 'lib4', target: 'build' },
          outputs: [],
          parallelism: true,
          continuous: false,
        },
        'lib4:build-base': {
          id: 'lib4:build-base',
          overrides: {},
          target: { project: 'lib4', target: 'build-base' },
          outputs: [],
          parallelism: true,
          continuous: false,
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
      continuousDependencies: {},
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

describe('createTmpTsConfig', () => {
  it('should create a temporary tsconfig file extending the provided tsconfig', () => {
    const fs = new TempFs('buildable-libs-utils#createTmpTsConfig');
    const tsconfigPath = 'packages/foo/tsconfig.json';
    fs.createFileSync(tsconfigPath, '{}');

    const tmpTsConfigPath = createTmpTsConfig(
      tsconfigPath,
      fs.tempDir,
      'packages/foo',
      []
    );

    const tmpTsConfig = readFileSync(tmpTsConfigPath, 'utf8');
    // would be generated at <workspaceRoot>/tmp/packages/foo/build/tsconfig.generated.json
    // while the extended tsconfig path is <workspaceRoot>/packages/foo/tsconfig.json
    expect(JSON.parse(tmpTsConfig).extends).toBe(
      '../../../../packages/foo/tsconfig.json'
    );
  });

  it('should also work when the provided tsconfig is an absolute path', () => {
    const fs = new TempFs('buildable-libs-utils#createTmpTsConfig');
    const tsconfigPath = join(fs.tempDir, 'packages/foo/tsconfig.json');
    fs.createFileSync(tsconfigPath, '{}');

    const tmpTsConfigPath = createTmpTsConfig(
      tsconfigPath,
      fs.tempDir,
      'packages/foo',
      []
    );

    const tmpTsConfig = readFileSync(tmpTsConfigPath, 'utf8');
    // would be generated at <workspaceRoot>/tmp/packages/foo/build/tsconfig.generated.json
    // while the extended tsconfig path is <workspaceRoot>/packages/foo/tsconfig.json
    expect(JSON.parse(tmpTsConfig).extends).toBe(
      '../../../../packages/foo/tsconfig.json'
    );
  });
});
