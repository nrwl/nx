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
