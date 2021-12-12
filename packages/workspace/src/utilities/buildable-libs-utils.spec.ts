import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
  updatePaths,
} from './buildable-libs-utils';
import {
  DependencyType,
  ProjectGraph,
  ProjectType,
} from '../core/project-graph';

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
          type: ProjectType.lib,
          name: 'example',
          data: {
            files: [],
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
        type: ProjectType.lib,
        name: 'example',
      },
      dependencies: [{ name: 'formik' }],
    });
  });
});
