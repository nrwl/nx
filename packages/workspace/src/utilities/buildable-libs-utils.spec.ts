import {
  DependencyType,
  ProjectGraph,
  ProjectGraphProjectNode,
  readJsonFile,
} from '@nrwl/devkit';
import { join } from 'path';
import { vol } from 'memfs';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
  updateBuildableProjectPackageJsonDependencies,
  updatePaths,
} from './buildable-libs-utils';

jest.mock('fs', () => require('memfs').fs);

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
        type: 'lib',
        name: 'example',
      },
      dependencies: [{ name: 'formik' }],
    });
  });
});

describe('updateBuildableProjectPackageJsonDependencies', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should add undeclared npm packages to dependencies', () => {
    vol.fromJSON({
      './package.json': JSON.stringify({
        name: '@scope/workspace',
        version: '0.0.0',
        dependencies: {
          foo: '^1.0.0',
          bar: '~2.0.0',
          unused: '<= 9.9',
        },
        devDependencies: {
          ignored: '3.3.3',
        },
      }),
      './dist/libs/example/package.json': JSON.stringify({
        name: '@scope/example',
        version: '5.0.1',
      }),
    });

    const root = '.';
    const node = libNode('example');
    const dependencies: DependentBuildableProjectNode[] = [
      npmDep('foo', '^1.0.0'),
      npmDep('bar', '~2.0.0'),
      npmDep('ignored', '3.3.3'),
    ];

    updateBuildableProjectPackageJsonDependencies(
      root,
      'example',
      'build',
      undefined,
      node,
      dependencies
    );

    const pkg = readJsonFile(
      join(root, 'dist', 'libs', 'example', 'package.json')
    );
    expect(pkg.dependencies).toMatchObject({
      foo: '^1.0.0',
      bar: '~2.0.0',
    });
    expect(pkg.peerDependencies).toEqual({});
    expect(pkg.devDependencies).toBeUndefined();
  });

  it('should inherit versions for declared dependencies', () => {
    vol.fromJSON({
      './package.json': JSON.stringify({
        name: '@scope/workspace',
        version: '0.0.0',
        dependencies: {
          foo: '^1.0.0',
          bar: '~2.0.0',
          zed: '>=4.0.0',
          unused: '<= 9.9',
        },
        devDependencies: {
          ignored: '3.3.3',
        },
      }),
      './dist/libs/example/package.json': JSON.stringify({
        name: '@scope/example',
        version: '5.0.1',
        dependencies: {
          foo: '[inherit]',
        },
        peerDependencies: {
          bar: '[inherit]',
        },
        devDependencies: {
          ignored: '[inherit]',
        },
      }),
      './dist/libs/other/package.json': JSON.stringify({
        name: '@scope/other',
        version: '5.0.2',
      }),
    });

    const root = '.';
    const node = libNode('example');
    const dependencies: DependentBuildableProjectNode[] = [
      npmDep('foo', '^1.0.0'),
      npmDep('bar', '~2.0.0'),
      npmDep('zed', '>=4.0.0'),
      npmDep('ignored', '3.3.3'),
      libDep('scope', 'other'),
    ];

    updateBuildableProjectPackageJsonDependencies(
      root,
      'example',
      'build',
      undefined,
      node,
      dependencies,
      'peerDependencies'
    );

    const pkg = readJsonFile(
      join(root, 'dist', 'libs', 'example', 'package.json')
    );
    expect(pkg.dependencies).toMatchObject({
      foo: '^1.0.0',
    });
    expect(pkg.peerDependencies).toMatchObject({
      '@scope/other': '5.0.2',
      bar: '~2.0.0',
    });
    expect(pkg.devDependencies).toMatchObject({
      // devDependencies are not supported to inherit
      ignored: '[inherit]',
    });
  });
});

function libDep(scope: string, name: string): DependentBuildableProjectNode {
  return {
    name: `@${scope}/${name}`,
    node: libNode(name),
    outputs: [`dist/libs/${name}`],
  };
}

function libNode(name: string): ProjectGraphProjectNode {
  return {
    name,
    type: 'lib',
    data: {
      root: `src/${name}`,
      files: [],
      targets: {
        build: {
          options: {
            outputPath: `dist/libs/${name}`,
          },
          outputs: ['{options.outputPath}'],
        },
      },
    },
  };
}

function npmDep(name: string, version: string): DependentBuildableProjectNode {
  return {
    name,
    node: {
      name: `npm:${name}`,
      type: 'npm',
      data: {
        packageName: name,
        version,
      },
    },
    outputs: [],
  };
}
