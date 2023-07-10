import 'nx/src/utils/testing/mock-fs';
import { vol } from 'memfs';
import { findNpmDependencies } from './find-npm-dependencies';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('findNpmDependencies', () => {
  afterEach(() => {
    vol.reset();
  });

  it('should pick up external npm dependencies and their versions', () => {
    const libWithExternalDeps = {
      name: 'my-lib',
      type: 'lib' as const,
      data: {
        root: 'libs/my-lib',
        targets: {},
      },
    };
    const projectGraph = {
      nodes: {
        'my-lib': libWithExternalDeps,
      },
      externalNodes: {
        'npm:foo': {
          name: 'npm:foo' as const,
          type: 'npm' as const,
          data: {
            packageName: 'foo',
            version: '1.0.0',
          },
        },
      },
      dependencies: {},
    };
    const projectFileMap = {
      'my-lib': [
        {
          file: 'libs/my-lib/index.ts',
          hash: '123',
          deps: ['npm:foo'],
        },
      ],
    };

    const results = findNpmDependencies(
      '/root',
      libWithExternalDeps,
      projectGraph,
      projectFileMap
    );

    expect(results).toEqual({
      foo: '1.0.0',
    });
  });

  it('should pick up helper npm dependencies if required', () => {
    vol.fromJSON(
      {
        './libs/my-lib/tsconfig.json': JSON.stringify({
          compilerOptions: {
            importHelpers: true,
          },
        }),
        './libs/my-lib/.swcrc': JSON.stringify({
          jsc: {
            externalHelpers: true,
          },
        }),
      },
      '/root'
    );
    const libWithHelpers = {
      name: 'my-lib',
      type: 'lib' as const,
      data: {
        root: 'libs/my-lib',
        targets: {
          build1: {
            executor: '@nx/js:tsc',
            options: {
              tsConfig: 'libs/my-lib/tsconfig.json',
            },
          },
          build2: {
            executor: '@nx/js:swc',
            options: {},
          },
        },
      },
    };
    const projectGraph = {
      nodes: {
        'my-lib': libWithHelpers,
      },
      externalNodes: {
        'npm:tslib': {
          name: 'npm:tslib' as const,
          type: 'npm' as const,
          data: {
            packageName: 'tslib',
            version: '2.6.0',
          },
        },
        'npm:@swc/helpers': {
          name: 'npm:@swc/helpers' as const,
          type: 'npm' as const,
          data: {
            packageName: '@swc/helpers',
            version: '0.5.0',
          },
        },
      },
      dependencies: {},
    };
    const projectFileMap = {
      'my-lib': [],
    };

    const results = findNpmDependencies(
      '/root',
      libWithHelpers,
      projectGraph,
      projectFileMap
    );

    expect(results).toEqual({
      '@swc/helpers': '0.5.0',
      tslib: '2.6.0',
    });
  });

  it('should not pick up helper npm dependencies if not required', () => {
    vol.fromJSON(
      {
        './libs/my-lib/tsconfig.json': JSON.stringify({
          compilerOptions: {
            importHelpers: false,
          },
        }),
        './libs/my-lib/.swcrc': JSON.stringify({
          jsc: {
            externalHelpers: false,
          },
        }),
      },
      '/root'
    );
    const libWithInlinedHelpers = {
      name: 'my-lib',
      type: 'lib' as const,
      data: {
        root: 'libs/my-lib',
        targets: {
          build1: {
            executor: '@nx/js:tsc',
            options: {
              tsConfig: 'libs/my-lib/tsconfig.json',
            },
          },
          build2: {
            executor: '@nx/js:swc',
            options: {},
          },
        },
      },
    };
    const projectGraph = {
      nodes: {
        'my-lib': libWithInlinedHelpers,
      },
      externalNodes: {
        'npm:tslib': {
          name: 'npm:tslib' as const,
          type: 'npm' as const,
          data: {
            packageName: 'tslib',
            version: '2.6.0',
          },
        },
        'npm:@swc/helpers': {
          name: 'npm:@swc/helpers' as const,
          type: 'npm' as const,
          data: {
            packageName: '@swc/helpers',
            version: '0.5.0',
          },
        },
      },
      dependencies: {},
    };
    const projectFileMap = {
      'my-lib': [],
    };

    const results = findNpmDependencies(
      '/root',
      libWithInlinedHelpers,
      projectGraph,
      projectFileMap
    );

    expect(results).toEqual({});
  });

  it('should support recursive collection of dependencies', () => {
    const parentLib = {
      name: 'parent',
      type: 'lib' as const,
      data: {
        root: 'libs/parent',
        targets: {},
      },
    };
    const projectGraph = {
      nodes: {
        parent: parentLib,
        child1: {
          name: 'child1',
          type: 'lib' as const,
          data: {
            root: 'libs/child1',
            targets: {},
          },
        },
        child2: {
          name: 'child2',
          type: 'lib' as const,
          data: {
            root: 'libs/child2',
            targets: {},
          },
        },
      },
      externalNodes: {
        'npm:foo': {
          name: 'npm:foo' as const,
          type: 'npm' as const,
          data: {
            packageName: 'foo',
            version: '1.0.0',
          },
        },
      },
      dependencies: {
        parent: [
          {
            type: 'static',
            source: 'parent',
            target: 'child1',
          },
        ],
        child1: [
          {
            type: 'static',
            source: 'child1',
            target: 'child2',
          },
        ],
        child2: [
          {
            type: 'static',
            source: 'child2',
            target: 'npm:foo',
          },
        ],
      },
    };
    const projectFileMap = {
      parent: [{ file: 'libs/parent/index.ts', hash: '123', deps: ['child1'] }],
      child1: [{ file: 'libs/child1/index.ts', hash: '123', deps: ['child2'] }],
      child2: [
        { file: 'libs/child2/index.ts', hash: '123', deps: ['npm:foo'] },
      ],
    };

    const results = findNpmDependencies(
      '/root',
      parentLib,
      projectGraph,
      projectFileMap,
      {
        recursive: true,
      }
    );

    expect(results).toEqual({
      foo: '1.0.0',
    });
  });

  it('should find workspace dependencies', () => {
    vol.fromJSON(
      {
        './libs/lib3/package.json': JSON.stringify({
          name: '@acme/lib3',
          version: '0.0.1',
        }),
      },
      '/root'
    );
    const lib1 = {
      name: 'lib1',
      type: 'lib' as const,
      data: {
        root: 'libs/lib1',
        targets: {},
      },
    };
    const lib2 = {
      name: 'lib2',
      type: 'lib' as const,
      data: {
        root: 'libs/lib2',
        targets: {},
      },
    };
    const lib3 = {
      name: 'lib3',
      type: 'lib' as const,
      data: {
        root: 'libs/lib3',
        targets: {},
      },
    };
    const projectGraph = {
      nodes: {
        lib1: lib1,
        lib2: lib2,
        lib3: lib3,
      },
      externalNodes: {},
      dependencies: {},
    };
    const projectFileMap = {
      lib1: [{ file: 'libs/lib1/index.ts', hash: '123', deps: ['lib3'] }],
      lib2: [{ file: 'libs/lib1/index.ts', hash: '123', deps: ['lib3'] }],
      lib3: [],
    };

    expect(
      findNpmDependencies('/root', lib1, projectGraph, projectFileMap)
    ).toEqual({
      '@acme/lib3': '*',
    });
    expect(
      findNpmDependencies('/root', lib2, projectGraph, projectFileMap)
    ).toEqual({
      '@acme/lib3': '*',
    });
  });

  it('should find peer and optional dependencies', () => {
    vol.fromJSON(
      {
        './libs/lib1/package.json': JSON.stringify({
          name: '@acme/lib1',
          version: '0.0.1',
          peerDependencies: {
            foo: '>=1.0.0',
          },
          optionalDependencies: {
            bar: '*',
          },
        }),
      },
      '/root'
    );
    const lib1 = {
      name: 'lib1',
      type: 'lib' as const,
      data: {
        root: 'libs/lib1',
        targets: {},
      },
    };
    const projectGraph = {
      nodes: {
        lib1: lib1,
      },
      externalNodes: {
        'npm:foo': {
          name: 'npm:foo' as const,
          type: 'npm' as const,
          data: {
            packageName: 'foo',
            version: '1.0.0',
          },
        },
        'npm:bar': {
          name: 'npm:bar' as const,
          type: 'npm' as const,
          data: {
            packageName: 'bar',
            version: '1.0.0',
          },
        },
      },
      dependencies: {},
    };
    const projectFileMap = {
      lib1: [],
    };

    expect(
      findNpmDependencies('/root', lib1, projectGraph, projectFileMap)
    ).toEqual({
      foo: '1.0.0',
      bar: '1.0.0',
    });
  });
});
