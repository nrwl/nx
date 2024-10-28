import 'nx/src/internal-testing-utils/mock-fs';
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
  const nxJson = {
    targetDefaults: {
      build: {
        inputs: [
          '{projectRoot}/**/*',
          '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
        ],
      },
    },
  };

  afterEach(() => {
    vol.reset();
  });

  it('should pick up external npm dependencies and their versions', () => {
    vol.fromJSON(
      {
        './nx.json': JSON.stringify(nxJson),
      },
      '/root'
    );
    const libWithExternalDeps = {
      name: 'my-lib',
      type: 'lib' as const,
      data: {
        root: 'libs/my-lib',
        targets: { build: {} },
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
      projectFileMap,
      'build'
    );

    expect(results).toEqual({
      foo: '1.0.0',
    });
  });

  it('should pick up helper npm dependencies if required', () => {
    vol.fromJSON(
      {
        './nx.json': JSON.stringify(nxJson),
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

    expect(
      findNpmDependencies(
        '/root',
        libWithHelpers,
        projectGraph,
        projectFileMap,
        'build1'
      )
    ).toEqual({
      tslib: '2.6.0',
    });
    expect(
      findNpmDependencies(
        '/root',
        libWithHelpers,
        projectGraph,
        projectFileMap,
        'build2'
      )
    ).toEqual({
      '@swc/helpers': '0.5.0',
    });
  });

  it.each`
    fileName
    ${'tsconfig.base.json'}
    ${'tsconfig.json'}
  `(
    'should pick up helper npm dependencies when using tsc and run-commands',
    ({ fileName }) => {
      vol.fromJSON(
        {
          [`./${fileName}`]: JSON.stringify({
            compilerOptions: { importHelpers: true },
          }),
          './nx.json': JSON.stringify(nxJson),
          './libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              importHelpers: true,
            },
          }),
        },
        '/root'
      );
      const lib = {
        name: 'my-lib',
        type: 'lib' as const,
        data: {
          root: 'libs/my-lib',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {
                command: 'tsc --build tsconfig.lib.json --pretty --verbose',
              },
            },
          },
        },
      };
      const projectGraph = {
        nodes: {
          'my-lib': lib,
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
        },
        dependencies: {},
      };
      const projectFileMap = {
        'my-lib': [],
      };

      expect(
        findNpmDependencies('/root', lib, projectGraph, projectFileMap, 'build')
      ).toEqual({
        tslib: '2.6.0',
      });
    }
  );

  it('should handle missing ts/swc helper packages from externalNodes', () => {
    vol.fromJSON(
      {
        './nx.json': JSON.stringify(nxJson),
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
      externalNodes: {},
      dependencies: {},
    };
    const projectFileMap = {
      'my-lib': [],
    };

    expect(
      findNpmDependencies(
        '/root',
        libWithHelpers,
        projectGraph,
        projectFileMap,
        'build1'
      )
    ).toEqual({});
    expect(
      findNpmDependencies(
        '/root',
        libWithHelpers,
        projectGraph,
        projectFileMap,
        'build2'
      )
    ).toEqual({});
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
      projectFileMap,
      'build'
    );

    expect(results).toEqual({});
  });

  it('should support recursive collection of dependencies', () => {
    vol.fromJSON(
      {
        './nx.json': JSON.stringify(nxJson),
      },
      '/root'
    );
    const parentLib = {
      name: 'parent',
      type: 'lib' as const,
      data: {
        root: 'libs/parent',
        targets: { build: {} },
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
            targets: { build: {} },
          },
        },
        child2: {
          name: 'child2',
          type: 'lib' as const,
          data: {
            root: 'libs/child2',
            targets: { build: {} },
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
      'build',
      {
        includeTransitiveDependencies: true,
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
        './nx.json': JSON.stringify(nxJson),
      },
      '/root'
    );
    const lib1 = {
      name: 'lib1',
      type: 'lib' as const,
      data: {
        root: 'libs/lib1',
        targets: { build: {} },
      },
    };
    const lib2 = {
      name: 'lib2',
      type: 'lib' as const,
      data: {
        root: 'libs/lib2',
        targets: { build: {} },
      },
    };
    const lib3 = {
      name: 'lib3',
      type: 'lib' as const,
      data: {
        root: 'libs/lib3',
        targets: { build: {} },
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
      findNpmDependencies('/root', lib1, projectGraph, projectFileMap, 'build')
    ).toEqual({
      '@acme/lib3': '0.0.1',
    });
    expect(
      findNpmDependencies('/root', lib2, projectGraph, projectFileMap, 'build')
    ).toEqual({
      '@acme/lib3': '0.0.1',
    });
  });

  it('should support local path for workspace dependencies', () => {
    vol.fromJSON(
      {
        './libs/c/package.json': JSON.stringify({
          name: '@acme/c',
          version: '0.0.1',
        }),
        './nx.json': JSON.stringify(nxJson),
      },
      '/root'
    );
    const a = {
      name: 'a',
      type: 'lib' as const,
      data: {
        root: 'libs/a',
        targets: { build: {} },
      },
    };
    const b = {
      name: 'b',
      type: 'lib' as const,
      data: {
        root: 'libs/b',
        targets: { build: {} },
      },
    };
    const c = {
      name: 'c',
      type: 'lib' as const,
      data: {
        root: 'libs/c',
        targets: { build: {} },
      },
    };
    const projectGraph = {
      nodes: {
        a: a,
        b: b,
        c: c,
      },
      externalNodes: {},
      dependencies: {},
    };
    const projectFileMap = {
      a: [{ file: 'libs/a/index.ts', hash: '123', deps: ['c'] }],
      b: [{ file: 'libs/a/index.ts', hash: '123', deps: ['c'] }],
      c: [],
    };

    expect(
      findNpmDependencies('/root', a, projectGraph, projectFileMap, 'build', {
        useLocalPathsForWorkspaceDependencies: true,
      })
    ).toEqual({
      '@acme/c': 'file:../c',
    });
    expect(
      findNpmDependencies('/root', b, projectGraph, projectFileMap, 'build', {
        useLocalPathsForWorkspaceDependencies: true,
      })
    ).toEqual({
      '@acme/c': 'file:../c',
    });
  });

  it('should support ignoring extra file patterns in addition to task input', () => {
    vol.fromJSON(
      {
        './nx.json': JSON.stringify(nxJson),
      },
      '/root'
    );
    const lib = {
      name: 'my-lib',
      type: 'lib' as const,
      data: {
        root: 'libs/my-lib',
        targets: { build: {} },
      },
    };
    const projectGraph = {
      nodes: {
        'my-lib': lib,
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
          file: 'libs/my-lib/vite.config.ts',
          hash: '123',
          deps: ['npm:foo'],
        },
      ],
    };

    const results = findNpmDependencies(
      '/root',
      lib,
      projectGraph,
      projectFileMap,
      'build',
      { ignoredFiles: ['{projectRoot}/vite.config.ts'] }
    );

    expect(results).toEqual({});
  });
});
