import { DependencyType, ProjectGraph } from '@nx/devkit';
import {
  calculateProjectDependencies,
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

  it('should identify buildable libraries correctly', () => {
    const graph: ProjectGraph = {
      nodes: {
        somejslib1: {
          name: 'somejslib1',
          type: 'lib',
          data: {
            name: 'somejslib1',
            sourceRoot: 'libs/somejslib1/src',
            projectType: 'library',
            targets: {
              'my-custom-build-target': {
                executor: '@nx/js:tsc',
                outputs: ['{options.outputPath}'],
                options: {
                  outputPath: 'dist/libs/somejslib1',
                  main: 'libs/somejslib1/src/index.ts',
                },
              },
            },
            tags: [],
            root: 'libs/somejslib1',
            implicitDependencies: [],
          },
        },
        somejslib2: {
          name: 'somejslib2',
          type: 'lib',
          data: {
            name: 'somejslib2',
            sourceRoot: 'libs/somejslib2/src',
            projectType: 'library',
            targets: {
              'my-other-build-target': {
                executor: '@nx/js:swc',
                outputs: ['{options.outputPath}'],
                options: {
                  outputPath: 'dist/libs/somejslib2',
                  main: 'libs/somejslib2/src/index.ts',
                },
              },
            },
            tags: [],
            root: 'libs/somejslib2',
            implicitDependencies: [],
          },
        },
      },
      externalNodes: {},
      dependencies: {
        example: [
          {
            source: 'example',
            target: 'npm:some-lib',
            type: DependencyType.static,
          },
        ],
        somejslib1: [
          {
            source: 'somejslib2',
            target: 'somejslib2',
            type: DependencyType.static,
          },
        ],
      },
    };

    const results = calculateProjectDependencies(
      graph,
      'root',
      'somejslib1',
      'build',
      undefined
    );
    expect(results).toMatchObject({
      target: {
        name: 'somejslib1',
        type: 'lib',
        data: {
          name: 'somejslib1',
          sourceRoot: 'libs/somejslib1/src',
          projectType: 'library',
          targets: {
            'my-custom-build-target': {
              executor: '@nx/js:tsc',
              outputs: ['{options.outputPath}'],
              options: {
                outputPath: 'dist/libs/somejslib1',
                main: 'libs/somejslib1/src/index.ts',
              },
            },
          },
          tags: [],
          root: 'libs/somejslib1',
          implicitDependencies: [],
        },
      },
      dependencies: [
        {
          name: 'somejslib2',
          outputs: ['dist/libs/somejslib2'],
          node: {
            name: 'somejslib2',
            type: 'lib',
            data: {
              name: 'somejslib2',
              sourceRoot: 'libs/somejslib2/src',
              projectType: 'library',
              targets: {
                'my-other-build-target': {
                  executor: '@nx/js:swc',
                  outputs: ['{options.outputPath}'],
                  options: {
                    outputPath: 'dist/libs/somejslib2',
                    main: 'libs/somejslib2/src/index.ts',
                  },
                },
              },
              tags: [],
              root: 'libs/somejslib2',
              implicitDependencies: [],
            },
          },
        },
      ],
      nonBuildableDependencies: [],
      topLevelDependencies: [
        {
          name: 'somejslib2',
          outputs: ['dist/libs/somejslib2'],
          node: {
            name: 'somejslib2',
            type: 'lib',
            data: {
              name: 'somejslib2',
              sourceRoot: 'libs/somejslib2/src',
              projectType: 'library',
              targets: {
                'my-other-build-target': {
                  executor: '@nx/js:swc',
                  outputs: ['{options.outputPath}'],
                  options: {
                    outputPath: 'dist/libs/somejslib2',
                    main: 'libs/somejslib2/src/index.ts',
                  },
                },
              },
              tags: [],
              root: 'libs/somejslib2',
              implicitDependencies: [],
            },
          },
        },
      ],
    });
  });

  it('should make sure fallback buildable identification based on target name works', async () => {
    const graph: ProjectGraph = {
      nodes: {
        example: {
          type: 'lib',
          name: 'example',
          data: {
            root: '/root/example',
            targets: {
              'my-build-target': {
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
              'my-build-target': {
                executor: 'x',
              },
            },
          },
        },
      },
      externalNodes: {},
      dependencies: {
        example: [
          // when example2 dependency is listed first
          {
            source: 'example',
            target: 'example2',
            type: DependencyType.static,
          },
        ],
      },
    };

    const results = calculateProjectDependencies(
      graph,
      'root',
      'example',
      'my-build-target',
      undefined
    );
    expect(results).toMatchObject({
      target: {
        name: 'example',
      },
      topLevelDependencies: [
        // expect example2
        expect.objectContaining({ name: 'example2' }),
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
