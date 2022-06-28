// This must come before the Hasher import
import { DependencyType } from '../config/project-graph';

jest.doMock('../utils/workspace-root', () => {
  return {
    workspaceRoot: '/root',
  };
});

jest.mock('fs', () => require('memfs').fs);
jest.mock('../utils/typescript');

import { vol } from 'memfs';
import tsUtils = require('../utils/typescript');
import { expandNamedInput, Hasher } from './hasher';

describe('Hasher', () => {
  const packageJson = {
    name: 'nrwl',
  };

  const tsConfigBaseJson = JSON.stringify({
    compilerOptions: {
      paths: {
        '@nrwl/parent': ['libs/parent/src/index.ts'],
        '@nrwl/child': ['libs/child/src/index.ts'],
      },
    },
  });
  const allWorkspaceFiles = [
    { file: 'yarn.lock', hash: 'yarn.lock.hash' },
    { file: 'nx.json', hash: 'nx.json.hash' },
    { file: 'package-lock.json', hash: 'package-lock.json.hash' },
    { file: 'package.json', hash: 'package.json.hash' },
    { file: 'pnpm-lock.yaml', hash: 'pnpm-lock.yaml.hash' },
    { file: 'tsconfig.base.json', hash: tsConfigBaseJson },
    { file: 'workspace.json', hash: 'workspace.json.hash' },
    { file: 'global1', hash: 'global1.hash' },
    { file: 'global2', hash: 'global2.hash' },
  ];

  function createHashing(): any {
    return {
      hashArray: (values: string[]) => values.join('|'),
    };
  }

  /**
   * const workSpaceJson = {
   *     projects: {
   *       parent: { root: 'libs/parent' },
   *       child: { root: 'libs/child' },
   *     },
   *   };
   */
  beforeEach(() => {
    vol.fromJSON(
      {
        'tsconfig.base.json': tsConfigBaseJson,
        'yarn.lock': 'content',
        'package.json': JSON.stringify(packageJson),
      },
      '/root'
    );
    tsUtils.getRootTsConfigFileName = () => '/root/tsconfig.base.json';
  });

  afterEach(() => {
    jest.resetAllMocks();
    vol.reset();
  });

  it('should create task hash', async () => {
    process.env.TESTENV = 'env123';
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: {
                build: {
                  inputs: [
                    'default',
                    '^default',
                    { runtime: 'echo runtime123' },
                    { env: 'TESTENV' },
                    { env: 'NONEXISTENTENV' },
                  ],
                },
              },
              files: [{ file: '/file', ext: '.ts', hash: 'file.hash' }],
            },
          },
        },
        dependencies: {
          parent: [],
        },
        allWorkspaceFiles,
      },
      {} as any,
      {
        runtimeCacheInputs: ['echo runtime456'],
      },
      createHashing()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hash.value).toContain('yarn.lock.hash'); //implicits
    expect(hash.value).toContain('file.hash'); //project files
    expect(hash.value).toContain('prop-value'); //overrides
    expect(hash.value).toContain('parent'); //project
    expect(hash.value).toContain('build'); //target
    expect(hash.value).toContain('runtime123');
    expect(hash.value).toContain('runtime456');
    expect(hash.value).toContain('env123');

    expect(hash.details.command).toEqual('parent|build||{"prop":"prop-value"}');
    expect(hash.details.nodes).toEqual({
      'parent:$filesets':
        '/file|file.hash|{"root":"libs/parent","targets":{"build":{"inputs":["default","^default",{"runtime":"echo runtime123"},{"env":"TESTENV"},{"env":"NONEXISTENTENV"}]}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      '{workspaceRoot}/yarn.lock': 'yarn.lock.hash',
      '{workspaceRoot}/package-lock.json': 'package-lock.json.hash',
      '{workspaceRoot}/pnpm-lock.yaml': 'pnpm-lock.yaml.hash',
      '{workspaceRoot}/nx.json': 'nx.json.hash',
      '{workspaceRoot}/.gitignore': '',
      '{workspaceRoot}/.nxignore': '',
      'runtime:echo runtime123': 'runtime123',
      'runtime:echo runtime456': 'runtime456',
      'env:TESTENV': 'env123',
      'env:NONEXISTENTENV': '',
    });
  });

  it('should hash task where the project has dependencies', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: { build: {} },
              files: [
                { file: '/filea.ts', hash: 'a.hash' },
                { file: '/filea.spec.ts', hash: 'a.spec.hash' },
              ],
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: 'libs/child',
              targets: { build: {} },
              files: [
                { file: '/fileb.ts', hash: 'b.hash' },
                { file: '/fileb.spec.ts', hash: 'b.spec.hash' },
              ],
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
        allWorkspaceFiles,
      },
      {} as any,
      {},
      createHashing()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    // note that the parent hash is based on parent source files only!
    expect(onlySourceNodes(hash.details.nodes)).toEqual({
      'child:$filesets':
        '/fileb.ts|/fileb.spec.ts|b.hash|b.spec.hash|{"root":"libs/child","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      'parent:$filesets':
        '/filea.ts|/filea.spec.ts|a.hash|a.spec.hash|{"root":"libs/parent","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });
  });

  it('should hash non-default filesets', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: {
                build: {
                  inputs: ['prod', '^prod'],
                },
              },
              files: [
                { file: 'libs/parent/filea.ts', hash: 'a.hash' },
                { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
              ],
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: 'libs/child',
              namedInputs: {
                prod: ['default'],
              },
              targets: { build: {} },
              files: [
                { file: 'libs/child/fileb.ts', hash: 'b.hash' },
                { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
              ],
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
        allWorkspaceFiles,
      },
      {
        namedInputs: {
          prod: ['!{projectRoot}/**/*.spec.ts'],
        },
      } as any,
      {},
      createHashing()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(onlySourceNodes(hash.details.nodes)).toEqual({
      'child:$filesets':
        'libs/child/fileb.ts|libs/child/fileb.spec.ts|b.hash|b.spec.hash|{"root":"libs/child","namedInputs":{"prod":["default"]},"targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      'parent:$filesets':
        'libs/parent/filea.ts|a.hash|{"root":"libs/parent","targets":{"build":{"inputs":["prod","^prod"]}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });
  });

  it('should use targetdefaults from nx.json', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: {
                build: {},
              },
              files: [
                { file: 'libs/parent/filea.ts', hash: 'a.hash' },
                { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
              ],
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: 'libs/child',
              targets: { build: {} },
              files: [
                { file: 'libs/child/fileb.ts', hash: 'b.hash' },
                { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
              ],
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
        allWorkspaceFiles,
      },
      {
        namedInputs: {
          prod: ['!{projectRoot}/**/*.spec.ts'],
        },
        targetDefaults: {
          build: {
            inputs: ['prod', '^prod'],
          },
        },
      } as any,
      {},
      createHashing()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(onlySourceNodes(hash.details.nodes)).toEqual({
      'child:$filesets':
        'libs/child/fileb.ts|b.hash|{"root":"libs/child","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      'parent:$filesets':
        'libs/parent/filea.ts|a.hash|{"root":"libs/parent","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });
  });

  it('should be able to include only a part of the base tsconfig', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: { build: {} },
              files: [{ file: '/file', hash: 'file.hash' }],
            },
          },
        },
        dependencies: {
          parent: [],
        },
        allWorkspaceFiles,
      },
      { npmScope: 'nrwl' } as any,
      {
        runtimeCacheInputs: ['echo runtime123', 'echo runtime456'],
        selectivelyHashTsConfig: true,
      },
      createHashing()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hash.value).toContain('yarn.lock.hash'); //implicits
    expect(hash.value).toContain('file.hash'); //project files
    expect(hash.value).toContain('prop-value'); //overrides
    expect(hash.value).toContain('parent'); //project
    expect(hash.value).toContain('build'); //target
    expect(hash.value).toContain('runtime123'); //target
    expect(hash.value).toContain('runtime456'); //target

    expect(hash.details.command).toEqual('parent|build||{"prop":"prop-value"}');
    expect(onlySourceNodes(hash.details.nodes)).toEqual({
      'parent:$filesets':
        '/file|file.hash|{"root":"libs/parent","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"]}}}',
    });
  });

  it('should hash tasks where the project graph has circular dependencies', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: { build: {} },
              files: [{ file: '/filea.ts', hash: 'a.hash' }],
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: 'libs/child',
              targets: { build: {} },
              files: [{ file: '/fileb.ts', hash: 'b.hash' }],
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
          child: [{ source: 'child', target: 'parent', type: 'static' }],
        },
        allWorkspaceFiles,
      },
      {} as any,
      {},
      createHashing()
    );

    const tasksHash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(tasksHash.value).toContain('yarn.lock.hash'); //implicits
    expect(tasksHash.value).toContain('a.hash'); //project files
    expect(tasksHash.value).toContain('b.hash'); //project files
    expect(tasksHash.value).toContain('prop-value'); //overrides
    expect(tasksHash.value).toContain('parent|build'); //project and target
    expect(tasksHash.value).toContain('build'); //target
    expect(onlySourceNodes(tasksHash.details.nodes)).toEqual({
      'child:$filesets':
        '/fileb.ts|b.hash|{"root":"libs/child","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      'parent:$filesets':
        '/filea.ts|a.hash|{"root":"libs/parent","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });

    const hashb = await hasher.hashTask({
      target: { project: 'child', target: 'build' },
      id: 'child-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hashb.value).toContain('yarn.lock.hash'); //implicits
    expect(hashb.value).toContain('a.hash'); //project files
    expect(hashb.value).toContain('b.hash'); //project files
    expect(hashb.value).toContain('prop-value'); //overrides
    expect(hashb.value).toContain('child|build'); //project and target
    expect(hashb.value).toContain('build'); //target
    expect(onlySourceNodes(hashb.details.nodes)).toEqual({
      'child:$filesets':
        '/fileb.ts|b.hash|{"root":"libs/child","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      'parent:$filesets':
        '/filea.ts|a.hash|{"root":"libs/parent","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });
  });

  it('should throw an error when failed to execute runtimeCacheInputs', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: { build: {} },
              files: [{ file: '/file', hash: 'some-hash' }],
            },
          },
        },
        dependencies: {
          parent: [],
        },
        allWorkspaceFiles,
      },
      {} as any,
      {
        runtimeCacheInputs: ['boom'],
      },
      createHashing()
    );

    try {
      await hasher.hashTask({
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: {},
      });
      fail('Should not be here');
    } catch (e) {
      expect(e.message).toContain('Nx failed to execute');
      expect(e.message).toContain('boom');
      expect(
        e.message.includes(' not found') || e.message.includes('not recognized')
      ).toBeTruthy();
    }
  });

  it('should hash implicit deps', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parents',
              targets: { build: {} },
              files: [],
            },
          },
        },
        dependencies: {},
        allWorkspaceFiles,
      },
      {
        implicitDependencies: {
          'global*': '*',
        },
      } as any,
      {},
      createHashing()
    );

    const tasksHash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(tasksHash.value).toContain('global1.hash');
    expect(tasksHash.value).toContain('global2.hash');
  });

  it('should hash npm project versions', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: 'apps/app',
              targets: { build: {} },
              files: [{ file: '/filea.ts', hash: 'a.hash' }],
            },
          },
        },
        externalNodes: {
          'npm:react': {
            name: 'npm:react',
            type: 'npm',
            data: {
              version: '17.0.0',
              packageName: 'react',
            },
          },
        },
        dependencies: {
          'npm:react': [],
          app: [
            { source: 'app', target: 'npm:react', type: DependencyType.static },
          ],
        },
        allWorkspaceFiles,
      },
      {} as any,
      {},
      createHashing()
    );

    const hash = await hasher.hashTask({
      target: { project: 'app', target: 'build' },
      id: 'app-build',
      overrides: { prop: 'prop-value' },
    });

    // note that the parent hash is based on parent source files only!
    expect(onlySourceNodes(hash.details.nodes)).toEqual({
      'app:$filesets':
        '/filea.ts|a.hash|{"root":"apps/app","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      'npm:react': '17.0.0',
    });
  });

  it('should hash missing dependent npm project versions', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: 'apps/app',
              targets: { build: {} },
              files: [{ file: '/filea.ts', hash: 'a.hash' }],
            },
          },
        },
        externalNodes: {},
        dependencies: {
          'npm:react': [],
          app: [
            {
              source: 'app',
              target: 'npm:react',
              type: DependencyType.static,
            },
          ],
        },
        allWorkspaceFiles,
      },
      {} as any,
      {},
      createHashing()
    );

    const hash = await hasher.hashTask({
      target: { project: 'app', target: 'build' },
      id: 'app-build',
      overrides: { prop: 'prop-value' },
    });

    // note that the parent hash is based on parent source files only!
    expect(onlySourceNodes(hash.details.nodes)).toEqual({
      'app:$filesets':
        '/filea.ts|a.hash|{"root":"apps/app","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      'npm:react': '__npm:react__',
    });
  });

  describe('expandNamedInput', () => {
    it('should expand named inputs', () => {
      const expanded = expandNamedInput('c', {
        a: ['a.txt', { fileset: 'myfileset' }],
        b: ['b.txt'],
        c: ['a', { input: 'b', projects: 'self' }],
      });
      expect(expanded).toEqual([
        { fileset: 'a.txt' },
        { fileset: 'myfileset' },
        { fileset: 'b.txt' },
      ]);
    });

    it('should throw when an input is not defined"', () => {
      expect(() => expandNamedInput('c', {})).toThrow();
      expect(() =>
        expandNamedInput('b', {
          b: [{ input: 'c', projects: 'self' }],
        })
      ).toThrow();
    });

    it('should throw when ^ is used', () => {
      expect(() =>
        expandNamedInput('b', {
          b: ['^c'],
        })
      ).toThrowError('namedInputs definitions cannot start with ^');
    });

    it('should treat strings as filesets when no matching inputs', () => {
      const expanded = expandNamedInput('b', {
        b: ['c'],
      });
      expect(expanded).toEqual([{ fileset: 'c' }]);
    });
  });
});

function onlySourceNodes(nodes: { [name: string]: string }) {
  const obj = {};
  Object.keys(nodes).forEach((n) => {
    if (n.indexOf('$filesets') > -1 || n.startsWith('npm:')) {
      obj[n] = nodes[n];
    }
  });
  return obj;
}
