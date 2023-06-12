// This must come before the Hasher import
import { DependencyType } from '../config/project-graph';

jest.mock('../utils/workspace-root', () => {
  return {
    workspaceRoot: '/root',
  };
});

jest.mock('./file-hasher', () => {
  return {
    hashArray: (values: string[]) => values.join('|'),
  };
});

jest.mock('fs', () => require('memfs').fs);
jest.mock('../plugins/js/utils/typescript', () => ({
  getRootTsConfigFileName: jest
    .fn()
    .mockImplementation(() => '/root/tsconfig.base.json'),
}));

import { vol } from 'memfs';
import {
  expandNamedInput,
  filterUsingGlobPatterns,
  Hash,
  InProcessTaskHasher,
} from './task-hasher';
import { fileHasher } from './file-hasher';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';

describe('TaskHasher', () => {
  const packageJson = {
    name: 'nrwl',
  };

  const tsConfigBaseJson = JSON.stringify({
    compilerOptions: {
      paths: {
        '@nx/parent': ['libs/parent/src/index.ts'],
        '@nx/child': ['libs/child/src/index.ts'],
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

  function createFileHasher(): any {
    return {
      allFileData: () => allWorkspaceFiles,
    };
  }

  beforeEach(() => {
    vol.fromJSON(
      {
        'tsconfig.base.json': tsConfigBaseJson,
        'yarn.lock': 'content',
        'package.json': JSON.stringify(packageJson),
      },
      '/root'
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    vol.reset();
  });

  it('should create task hash', () =>
    withEnvironmentVariables({ TESTENV: 'env123' }, async () => {
      const hasher = new InProcessTaskHasher(
        {
          parent: [{ file: '/file', hash: 'file.hash' }],
          unrelated: [{ file: 'libs/unrelated/filec.ts', hash: 'filec.hash' }],
        },
        allWorkspaceFiles,
        {
          nodes: {
            parent: {
              name: 'parent',
              type: 'lib',
              data: {
                root: 'libs/parent',
                targets: {
                  build: {
                    executor: 'nx:run-commands',
                    inputs: [
                      'default',
                      '^default',
                      { runtime: 'echo runtime123' },
                      { env: 'TESTENV' },
                      { env: 'NONEXISTENTENV' },
                      {
                        input: 'default',
                        projects: ['unrelated', 'tag:some-tag'],
                      },
                    ],
                  },
                },
              },
            },
            unrelated: {
              name: 'unrelated',
              type: 'lib',
              data: {
                root: 'libs/unrelated',
                targets: { build: {} },
              },
            },
            tagged: {
              name: 'tagged',
              type: 'lib',
              data: {
                root: 'libs/tagged',
                targets: { build: {} },
                tags: ['some-tag'],
              },
            },
          },
          dependencies: {
            parent: [],
          },
          externalNodes: {},
        },
        {
          roots: ['parent-build'],
          tasks: {
            'parent-build': {
              id: 'parent-build',
              target: { project: 'parent', target: 'build' },
              overrides: {},
            },
          },
          dependencies: {},
        },
        {} as any,
        {
          runtimeCacheInputs: ['echo runtime456'],
        },
        createFileHasher()
      );

      const hash = await hasher.hashTask({
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
      });

      expect(hash.value).toContain('file.hash'); //project files
      expect(hash.value).toContain('prop-value'); //overrides
      expect(hash.value).toContain('parent'); //project
      expect(hash.value).toContain('build'); //target
      expect(hash.value).toContain('runtime123');
      expect(hash.value).toContain('runtime456');
      expect(hash.value).toContain('env123');
      expect(hash.value).toContain('filec.hash');

      expect(hash.details.command).toEqual(
        'parent|build||{"prop":"prop-value"}'
      );
      expect(hash.details.nodes).toEqual({
        'parent:{projectRoot}/**/*':
          '/file|file.hash|{"root":"libs/parent","targets":{"build":{"executor":"nx:run-commands","inputs":["default","^default",{"runtime":"echo runtime123"},{"env":"TESTENV"},{"env":"NONEXISTENTENV"},{"input":"default","projects":["unrelated","tag:some-tag"]}]}}}|{"compilerOptions":{"paths":{"@nx/parent":["libs/parent/src/index.ts"],"@nx/child":["libs/child/src/index.ts"]}}}',
        target: 'nx:run-commands',
        'unrelated:{projectRoot}/**/*':
          'libs/unrelated/filec.ts|filec.hash|{"root":"libs/unrelated","targets":{"build":{}}}|{"compilerOptions":{"paths":{"@nx/parent":["libs/parent/src/index.ts"],"@nx/child":["libs/child/src/index.ts"]}}}',
        'tagged:{projectRoot}/**/*':
          '{"root":"libs/tagged","targets":{"build":{}},"tags":["some-tag"]}|{"compilerOptions":{"paths":{"@nx/parent":["libs/parent/src/index.ts"],"@nx/child":["libs/child/src/index.ts"]}}}',
        '{workspaceRoot}/nx.json': 'nx.json.hash',
        '{workspaceRoot}/.gitignore': '',
        '{workspaceRoot}/.nxignore': '',
        'runtime:echo runtime123': 'runtime123',
        'runtime:echo runtime456': 'runtime456',
        'env:TESTENV': 'env123',
        'env:NONEXISTENTENV': '',
      });
    }));

  it('should hash task where the project has dependencies', async () => {
    const hasher = new InProcessTaskHasher(
      {
        parent: [
          { file: '/filea.ts', hash: 'a.hash' },
          { file: '/filea.spec.ts', hash: 'a.spec.hash' },
        ],
        child: [
          { file: '/fileb.ts', hash: 'b.hash' },
          { file: '/fileb.spec.ts', hash: 'b.spec.hash' },
        ],
      },
      allWorkspaceFiles,
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: { build: { executor: 'unknown' } },
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: 'libs/child',
              targets: { build: {} },
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
      },
      {
        roots: ['child-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
          },
          'child-build': {
            id: 'child-build',
            target: { project: 'child', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {
          'parent-build': ['child-build'],
        },
      },
      {} as any,
      {},
      createFileHasher()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    assertFilesets(hash, {
      'child:{projectRoot}/**/*': {
        contains: '/fileb.ts|/fileb.spec.ts',
        excludes: '/filea.ts',
      },
      'parent:{projectRoot}/**/*': {
        contains: '/filea.ts|/filea.spec.ts',
        excludes: '/fileb.ts',
      },
    });
  });

  it('should hash non-default filesets', async () => {
    const hasher = new InProcessTaskHasher(
      {
        parent: [
          { file: 'libs/parent/filea.ts', hash: 'a.hash' },
          { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
        ],
        child: [
          { file: 'libs/child/fileb.ts', hash: 'b.hash' },
          { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
        ],
      },
      allWorkspaceFiles,
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
                  executor: 'nx:run-commands',
                },
              },
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
              targets: { build: { executor: 'unknown' } },
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
      },
      {
        roots: ['child-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
          },
          'child-build': {
            id: 'child-build',
            target: { project: 'child', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {
          'parent-build': ['child-build'],
        },
      },
      {
        namedInputs: {
          prod: ['!{projectRoot}/**/*.spec.ts'],
        },
      } as any,
      {},
      createFileHasher()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    assertFilesets(hash, {
      'child:{projectRoot}/**/*': {
        contains: 'libs/child/fileb.ts|libs/child/fileb.spec.ts',
        excludes: 'filea.ts',
      },
      'parent:!{projectRoot}/**/*.spec.ts': {
        contains: 'filea.ts',
        excludes: 'filea.spec.ts',
      },
    });
  });

  it('should hash multiple filesets of a project', async () => {
    const hasher = new InProcessTaskHasher(
      {
        parent: [
          { file: 'libs/parent/filea.ts', hash: 'a.hash' },
          { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
        ],
      },
      allWorkspaceFiles,
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: {
                build: {
                  inputs: ['prod'],
                  executor: 'nx:run-commands',
                },
                test: {
                  inputs: ['default'],
                  dependsOn: ['build'],
                  executor: 'nx:run-commands',
                },
              },
            },
          },
        },
        dependencies: {
          parent: [],
        },
      },
      {
        roots: ['parent-test'],
        tasks: {
          'parent-test': {
            id: 'parent-test',
            target: { project: 'parent', target: 'test' },
            overrides: {},
          },
        },
        dependencies: {},
      },
      {
        namedInputs: {
          prod: ['!{projectRoot}/**/*.spec.ts'],
        },
      } as any,
      {},
      createFileHasher()
    );

    const test = await hasher.hashTask({
      target: { project: 'parent', target: 'test' },
      id: 'parent-test',
      overrides: { prop: 'prop-value' },
    });

    assertFilesets(test, {
      'parent:{projectRoot}/**/*': {
        contains: 'libs/parent/filea.ts|libs/parent/filea.spec.ts',
      },
    });

    const build = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    assertFilesets(build, {
      'parent:!{projectRoot}/**/*.spec.ts': {
        contains: 'libs/parent/filea.ts',
        excludes: 'libs/parent/filea.spec.ts',
      },
    });
  });

  it('should be able to handle multiple filesets per project', async () => {
    withEnvironmentVariables(
      { MY_TEST_HASH_ENV: 'MY_TEST_HASH_ENV_VALUE' },
      async () => {
        const hasher = new InProcessTaskHasher(
          {
            parent: [
              { file: 'libs/parent/filea.ts', hash: 'a.hash' },
              { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
            ],
            child: [
              { file: 'libs/child/fileb.ts', hash: 'b.hash' },
              { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
            ],
          },
          allWorkspaceFiles,
          {
            nodes: {
              parent: {
                name: 'parent',
                type: 'lib',
                data: {
                  root: 'libs/parent',
                  targets: {
                    test: {
                      inputs: ['default', '^prod'],
                      executor: 'nx:run-commands',
                    },
                  },
                },
              },
              child: {
                name: 'child',
                type: 'lib',
                data: {
                  root: 'libs/child',
                  namedInputs: {
                    prod: [
                      '!{projectRoot}/**/*.spec.ts',
                      '{workspaceRoot}/global2',
                      { env: 'MY_TEST_HASH_ENV' },
                    ],
                  },
                  targets: {
                    test: {
                      inputs: ['default'],
                      executor: 'nx:run-commands',
                    },
                  },
                },
              },
            },
            dependencies: {
              parent: [{ source: 'parent', target: 'child', type: 'static' }],
            },
          },
          {
            roots: ['child-test'],
            tasks: {
              'parent-test': {
                id: 'parent-test',
                target: { project: 'parent', target: 'test' },
                overrides: {},
              },
              'child-test': {
                id: 'child-test',
                target: { project: 'child', target: 'test' },
                overrides: {},
              },
            },
            dependencies: {
              'parent-test': ['child-test'],
            },
          },
          {
            namedInputs: {
              default: ['{projectRoot}/**/*', '{workspaceRoot}/global1'],
              prod: ['!{projectRoot}/**/*.spec.ts'],
            },
          } as any,
          {},
          createFileHasher()
        );

        const parentHash = await hasher.hashTask({
          target: { project: 'parent', target: 'test' },
          id: 'parent-test',
          overrides: { prop: 'prop-value' },
        });

        assertFilesets(parentHash, {
          'child:!{projectRoot}/**/*.spec.ts': {
            contains: 'libs/child/fileb.ts',
            excludes: 'fileb.spec.ts',
          },
          'parent:{projectRoot}/**/*': {
            contains: 'libs/parent/filea.ts|libs/parent/filea.spec.ts',
          },
        });

        expect(parentHash.details.nodes['{workspaceRoot}/global1']).toEqual(
          'global1.hash'
        );
        expect(parentHash.details.nodes['{workspaceRoot}/global2']).toBe(
          'global2.hash'
        );
        expect(parentHash.details.nodes['env:MY_TEST_HASH_ENV']).toEqual(
          'MY_TEST_HASH_ENV_VALUE'
        );

        const childHash = await hasher.hashTask({
          target: { project: 'child', target: 'test' },
          id: 'child-test',
          overrides: { prop: 'prop-value' },
        });

        assertFilesets(childHash, {
          'child:{projectRoot}/**/*': {
            contains: 'libs/child/fileb.ts|libs/child/fileb.spec.ts',
          },
        });
        expect(childHash.details.nodes['{workspaceRoot}/global1']).toEqual(
          'global1.hash'
        );
        expect(childHash.details.nodes['{workspaceRoot}/global2']).toBe(
          undefined
        );
        expect(childHash.details.nodes['env:MY_TEST_HASH_ENV']).toBeUndefined();
      }
    );
  });

  it('should use targetDefaults from nx.json', async () => {
    const hasher = new InProcessTaskHasher(
      {
        parent: [
          { file: 'libs/parent/filea.ts', hash: 'a.hash' },
          { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
        ],
        child: [
          { file: 'libs/child/fileb.ts', hash: 'b.hash' },
          { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
        ],
      },
      allWorkspaceFiles,
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: {
                build: { executor: 'nx:run-commands' },
              },
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: 'libs/child',
              targets: { build: { executor: 'nx:run-commands' } },
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
        externalNodes: {},
      },
      {
        roots: ['child-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
          },
          'child-build': {
            id: 'child-build',
            target: { project: 'child', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {
          'parent-build': ['child-build'],
        },
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
      createFileHasher()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    assertFilesets(hash, {
      'child:!{projectRoot}/**/*.spec.ts': {
        contains: 'libs/child/fileb.ts',
        excludes: 'libs/child/fileb.spec.ts',
      },
      'parent:!{projectRoot}/**/*.spec.ts': {
        contains: 'libs/parent/filea.ts',
        excludes: 'libs/parent/filea.spec.ts',
      },
    });
  });

  it('should be able to include only a part of the base tsconfig', async () => {
    const hasher = new InProcessTaskHasher(
      {
        parent: [{ file: '/file', hash: 'file.hash' }],
      },
      allWorkspaceFiles,
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: { build: { executor: 'nx:run-commands' } },
            },
          },
        },
        dependencies: {
          parent: [],
        },
        externalNodes: {},
      },
      {
        roots: ['parent:build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {},
      },
      { npmScope: 'nrwl' } as any,
      {
        runtimeCacheInputs: ['echo runtime123', 'echo runtime456'],
        selectivelyHashTsConfig: true,
      },
      createFileHasher()
    );

    const hash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hash.value).toContain('file.hash'); //project files
    expect(hash.value).toContain('prop-value'); //overrides
    expect(hash.value).toContain('parent'); //project
    expect(hash.value).toContain('build'); //target
    expect(hash.value).toContain('runtime123'); //target
    expect(hash.value).toContain('runtime456'); //target

    expect(hash.details.command).toEqual('parent|build||{"prop":"prop-value"}');

    assertFilesets(hash, {
      'parent:{projectRoot}/**/*': {
        contains: '/file',
      },
    });
  });

  it('should hash tasks where the project graph has circular dependencies', async () => {
    const hasher = new InProcessTaskHasher(
      {
        parent: [{ file: '/filea.ts', hash: 'a.hash' }],
        child: [{ file: '/fileb.ts', hash: 'b.hash' }],
      },
      allWorkspaceFiles,
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: { build: { executor: 'nx:run-commands' } },
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: 'libs/child',
              targets: { build: { executor: 'nx:run-commands' } },
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
          child: [{ source: 'child', target: 'parent', type: 'static' }],
        },
        externalNodes: {},
      },
      {
        roots: ['child-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
          },
          'child-build': {
            id: 'child-build',
            target: { project: 'child', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {
          'parent-build': ['child-build'],
        },
      },
      {} as any,
      {},
      createFileHasher()
    );

    const tasksHash = await hasher.hashTask({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(tasksHash.value).toContain('a.hash'); //project files
    expect(tasksHash.value).toContain('b.hash'); //project files
    expect(tasksHash.value).toContain('prop-value'); //overrides
    expect(tasksHash.value).toContain('parent|build'); //project and target
    expect(tasksHash.value).toContain('build'); //target

    assertFilesets(tasksHash, {
      'child:{projectRoot}/**/*': {
        contains: 'fileb.ts',
        excludes: 'filea.tx',
      },
      'parent:{projectRoot}/**/*': {
        contains: 'filea.ts',
        excludes: 'fileb.tx',
      },
    });

    const hashb = await hasher.hashTask({
      target: { project: 'child', target: 'build' },
      id: 'child-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hashb.value).toContain('a.hash'); //project files
    expect(hashb.value).toContain('b.hash'); //project files
    expect(hashb.value).toContain('prop-value'); //overrides
    expect(hashb.value).toContain('child|build'); //project and target
    expect(hashb.value).toContain('build'); //target

    assertFilesets(hashb, {
      'child:{projectRoot}/**/*': {
        contains: 'fileb.ts',
        excludes: 'filea.tx',
      },
      'parent:{projectRoot}/**/*': {
        contains: 'filea.ts',
        excludes: 'fileb.tx',
      },
    });
  });

  it('should throw an error when failed to execute runtimeCacheInputs', async () => {
    const hasher = new InProcessTaskHasher(
      {
        parent: [{ file: '/file', hash: 'some-hash' }],
      },
      allWorkspaceFiles,
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: 'libs/parent',
              targets: { build: { executor: 'nx:run-commands' } },
            },
          },
        },
        dependencies: {
          parent: [],
        },
      },
      {
        roots: ['parent:build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {},
      },
      {} as any,
      {
        runtimeCacheInputs: ['boom'],
      },
      createFileHasher()
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

  it('should hash npm project versions', async () => {
    const hasher = new InProcessTaskHasher(
      {
        app: [{ file: '/filea.ts', hash: 'a.hash' }],
      },
      allWorkspaceFiles,
      {
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: 'apps/app',
              targets: { build: { executor: 'nx:run-commands' } },
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
      },
      {
        roots: ['app-build'],
        tasks: {
          'app-build': {
            id: 'app-build',
            target: { project: 'app', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {},
      },
      {} as any,
      {},
      createFileHasher()
    );

    const hash = await hasher.hashTask({
      target: { project: 'app', target: 'build' },
      id: 'app-build',
      overrides: { prop: 'prop-value' },
    });

    // note that the parent hash is based on parent source files only!
    assertFilesets(hash, {
      'npm:react': { contains: '17.0.0' },
    });
  });

  it('should hash missing dependent npm project versions', async () => {
    const hasher = new InProcessTaskHasher(
      {
        app: [{ file: '/filea.ts', hash: 'a.hash' }],
      },
      allWorkspaceFiles,
      {
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: 'apps/app',
              targets: { build: { executor: 'nx:run-commands' } },
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
      },
      {
        roots: ['app-build'],
        tasks: {
          'app-build': {
            id: 'app-build',
            target: { project: 'app', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {},
      },
      {} as any,
      {},
      createFileHasher()
    );

    const hash = await hasher.hashTask({
      target: { project: 'app', target: 'build' },
      id: 'app-build',
      overrides: { prop: 'prop-value' },
    });

    // note that the parent hash is based on parent source files only!
    assertFilesets(hash, {
      'npm:react': { contains: '__npm:react__' },
    });
  });

  describe('hashTarget', () => {
    it('should hash executor dependencies of @nx packages', async () => {
      const hasher = new InProcessTaskHasher(
        {},
        allWorkspaceFiles,
        {
          nodes: {
            app: {
              name: 'app',
              type: 'app',
              data: {
                root: 'apps/app',
                targets: { build: { executor: '@nx/webpack:webpack' } },
              },
            },
          },
          externalNodes: {
            'npm:@nx/webpack': {
              name: 'npm:@nx/webpack',
              type: 'npm',
              data: {
                packageName: '@nx/webpack',
                version: '16.0.0',
              },
            },
          },
          dependencies: {},
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
            },
          },
          dependencies: {},
        },
        {} as any,
        {},
        fileHasher
      );

      const hash = await hasher.hashTask({
        target: { project: 'app', target: 'build' },
        id: 'app-build',
        overrides: { prop: 'prop-value' },
      });

      assertFilesets(hash, {
        target: { contains: '@nx/webpack:webpack' },
      });

      expect(hash.value).toContain('|16.0.0|');
    });

    it('should hash entire subtree of dependencies', async () => {
      const hasher = new InProcessTaskHasher(
        {},
        allWorkspaceFiles,
        {
          nodes: {
            app: {
              name: 'app',
              type: 'app',
              data: {
                root: 'apps/app',
                targets: { build: { executor: '@nx/webpack:webpack' } },
              },
            },
          },
          externalNodes: {
            'npm:@nx/webpack': {
              name: 'npm:@nx/webpack',
              type: 'npm',
              data: {
                packageName: '@nx/webpack',
                version: '16.0.0',
                hash: '$nx/webpack16$',
              },
            },
            'npm:@nx/devkit': {
              name: 'npm:@nx/devkit',
              type: 'npm',
              data: {
                packageName: '@nx/devkit',
                version: '16.0.0',
                hash: '$nx/devkit16$',
              },
            },
            'npm:nx': {
              name: 'npm:nx',
              type: 'npm',
              data: {
                packageName: 'nx',
                version: '16.0.0',
                hash: '$nx16$',
              },
            },
            'npm:webpack': {
              name: 'npm:webpack',
              type: 'npm',
              data: {
                packageName: 'webpack',
                version: '5.0.0', // no hash intentionally
              },
            },
          },
          dependencies: {
            'npm:@nx/webpack': [
              {
                source: 'npm:@nx/webpack',
                target: 'npm:@nx/devkit',
                type: DependencyType.static,
              },
              {
                source: 'npm:@nx/webpack',
                target: 'npm:nx',
                type: DependencyType.static,
              },
              {
                source: 'npm:@nx/webpack',
                target: 'npm:webpack',
                type: DependencyType.static,
              },
            ],
            'npm:@nx/devkit': [
              {
                source: 'npm:@nx/devkit',
                target: 'npm:nx',
                type: DependencyType.static,
              },
            ],
          },
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
            },
          },
          dependencies: {},
        },
        {} as any,
        {},
        fileHasher
      );

      const hash = await hasher.hashTask({
        target: { project: 'app', target: 'build' },
        id: 'app-build',
        overrides: { prop: 'prop-value' },
      });

      assertFilesets(hash, {
        target: { contains: '@nx/webpack:webpack' },
      });

      expect(hash.value).toContain('|$nx/webpack16$|');
      expect(hash.value).toContain('|$nx/devkit16$|');
      expect(hash.value).toContain('|$nx16$|');
      expect(hash.value).toContain('|5.0.0|');
    });

    it('should not hash when nx:run-commands executor', async () => {
      const hasher = new InProcessTaskHasher(
        {},
        [],
        {
          nodes: {
            app: {
              name: 'app',
              type: 'app',
              data: {
                root: 'apps/app',
                targets: { build: { executor: 'nx:run-commands' } },
              },
            },
          },
          externalNodes: {
            'npm:nx': {
              name: 'npm:nx',
              type: 'npm',
              data: {
                packageName: 'nx',
                version: '16.0.0',
              },
            },
          },
          dependencies: {},
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
            },
          },
          dependencies: {},
        },
        {} as any,
        {},
        fileHasher
      );

      const hash = await hasher.hashTask({
        target: { project: 'app', target: 'build' },
        id: 'app-build',
        overrides: { prop: 'prop-value' },
      });

      expect(hash.value).not.toContain('|16.0.0|');
      expect(hash.details.nodes['target']).toEqual('nx:run-commands');
    });

    it('should use externalDependencies to override nx:run-commands', async () => {
      const hasher = new InProcessTaskHasher(
        {},
        allWorkspaceFiles,
        {
          nodes: {
            app: {
              name: 'app',
              type: 'app',
              data: {
                root: 'apps/app',
                targets: {
                  build: {
                    executor: 'nx:run-commands',
                    inputs: [
                      { fileset: '{projectRoot}/**/*' },
                      { externalDependencies: ['webpack', 'react'] },
                    ],
                  },
                },
              },
            },
          },
          externalNodes: {
            'npm:nx': {
              name: 'npm:nx',
              type: 'npm',
              data: {
                packageName: 'nx',
                version: '16.0.0',
              },
            },
            'npm:webpack': {
              name: 'npm:webpack',
              type: 'npm',
              data: {
                packageName: 'webpack',
                version: '5.0.0',
              },
            },
            'npm:react': {
              name: 'npm:react',
              type: 'npm',
              data: {
                packageName: 'react',
                version: '17.0.0',
              },
            },
          },
          dependencies: {},
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
            },
          },
          dependencies: {},
        },
        {} as any,
        {},
        fileHasher
      );

      const hash = await hasher.hashTask({
        target: { project: 'app', target: 'build' },
        id: 'app-build',
        overrides: { prop: 'prop-value' },
      });

      expect(hash.value).not.toContain('|16.0.0|');
      expect(hash.value).toContain('|17.0.0|');
      expect(hash.value).toContain('|5.0.0|');
      expect(hash.details.nodes['target']).toEqual('nx:run-commands');
    });

    it('should use externalDependencies with empty array to ignore all deps', async () => {
      const hasher = new InProcessTaskHasher(
        {},
        allWorkspaceFiles,
        {
          nodes: {
            app: {
              name: 'app',
              type: 'app',
              data: {
                root: 'apps/app',
                targets: {
                  build: {
                    executor: 'nx:run-commands',
                    inputs: [
                      { fileset: '{projectRoot}/**/*' },
                      { externalDependencies: [] }, // intentionally empty
                    ],
                  },
                },
              },
            },
          },
          externalNodes: {
            'npm:nx': {
              name: 'npm:nx',
              type: 'npm',
              data: {
                packageName: 'nx',
                version: '16.0.0',
              },
            },
            'npm:webpack': {
              name: 'npm:webpack',
              type: 'npm',
              data: {
                packageName: 'webpack',
                version: '5.0.0',
              },
            },
            'npm:react': {
              name: 'npm:react',
              type: 'npm',
              data: {
                packageName: 'react',
                version: '17.0.0',
              },
            },
          },
          dependencies: {},
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
            },
          },
          dependencies: {},
        },
        {} as any,
        {},
        fileHasher
      );

      const hash = await hasher.hashTask({
        target: { project: 'app', target: 'build' },
        id: 'app-build',
        overrides: { prop: 'prop-value' },
      });

      expect(hash.details.nodes['npm:nx']).not.toBeDefined();
      expect(hash.details.nodes['app']).not.toBeDefined();
    });
  });

  describe('dependentTasksOutputFiles', () => {
    it('should depend on dependent tasks output files', async () => {
      const distFolder = [
        ['dist/libs/parent/filea.js', 'a.js.hash'],
        ['dist/libs/parent/filea.d.ts', 'a.d.ts.hash'],
        ['dist/libs/child/fileb.js', 'b.js.hash'],
        ['dist/libs/child/fileb.d.ts', 'b.d.ts.hash'],
        ['dist/libs/grandchild/filec.js', 'c.js.hash'],
        ['dist/libs/grandchild/filec.d.ts', 'c.d.ts.hash'],
      ];
      const hasher = new InProcessTaskHasher(
        {
          parent: [
            { file: 'libs/parent/filea.ts', hash: 'a.hash' },
            { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
          ],
          child: [
            { file: 'libs/child/fileb.ts', hash: 'b.hash' },
            { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
          ],
          grandchild: [
            { file: 'libs/grandchild/filec.ts', hash: 'c.hash' },
            { file: 'libs/grandchild/filec.spec.ts', hash: 'c.spec.hash' },
          ],
        },
        allWorkspaceFiles,
        {
          nodes: {
            parent: {
              name: 'parent',
              type: 'lib',
              data: {
                root: 'libs/parent',
                targets: {
                  build: {
                    dependsOn: ['^build'],
                    inputs: ['prod', 'deps'],
                    executor: 'nx:run-commands',
                    outputs: ['dist/{projectRoot}'],
                  },
                },
              },
            },
            child: {
              name: 'child',
              type: 'lib',
              data: {
                root: 'libs/child',
                targets: {
                  build: {
                    dependsOn: ['^build'],
                    inputs: ['prod', 'deps'],
                    executor: 'nx:run-commands',
                    // options: {
                    //   outputPath: 'dist/{projectRoot}',
                    // },
                    // outputs: ['{options.outputPath}'],
                    outputs: ['dist/{projectRoot}'],
                  },
                },
              },
            },
            grandchild: {
              name: 'grandchild',
              type: 'lib',
              data: {
                root: 'libs/grandchild',
                targets: {
                  build: {
                    dependsOn: ['^build'],
                    inputs: ['prod', 'deps'],
                    executor: 'nx:run-commands',
                    outputs: ['dist/{projectRoot}'],
                  },
                },
              },
            },
          },
          dependencies: {
            parent: [{ source: 'parent', target: 'child', type: 'static' }],
            child: [{ source: 'child', target: 'grandchild', type: 'static' }],
          },
        },
        {
          roots: ['grandchild-build'],
          tasks: {
            'parent-build': {
              id: 'parent-build',
              target: { project: 'parent', target: 'build' },
              overrides: {},
            },
            'child-build': {
              id: 'child-build',
              target: { project: 'child', target: 'build' },
              overrides: {},
            },
            'grandchild-build': {
              id: 'grandchild-build',
              target: { project: 'grandchild', target: 'build' },
              overrides: {},
            },
          },
          dependencies: {
            'parent-build': ['child-build'],
            'child-build': ['grandchild-build'],
          },
        },
        {
          namedInputs: {
            prod: ['!{projectRoot}/**/*.spec.ts'],
            deps: [
              { dependentTasksOutputFiles: '**/*.d.ts', transitive: true },
            ],
          },
          targetDefaults: {
            build: {
              dependsOn: ['^build'],
              inputs: ['prod', 'deps'],
              executor: 'nx:run-commands',
              options: {
                outputPath: 'dist/libs/{projectRoot}',
              },
              outputs: ['{options.outputPath}'],
            },
          },
        } as any,
        {},
        {
          hashFilesMatchingGlobs: (path: string, globs: string[]) => {
            const hashes = [];
            for (const [file, hash] of distFolder) {
              if (!file.startsWith(path)) {
                continue;
              }
              for (const glob of globs) {
                if (file.endsWith(glob.split('**/*')[1])) {
                  hashes.push(hash);
                }
              }
            }
            return hashes.join('|');
          },
        } as any
      );

      const hash = await hasher.hashTask({
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
      });

      expect(hash.value).not.toContain('a.d.ts.hash');
      expect(hash.value).not.toContain('js.hash');
      expect(hash.value).toContain('b.d.ts.hash');
      expect(hash.value).toContain('c.d.ts.hash');

      assertFilesets(hash, {
        'dist/libs/child/**/*.d.ts': { contains: 'b.d.ts.hash' },
        'dist/libs/grandchild/**/*.d.ts': { contains: 'c.d.ts.hash' },
      });
    });
  });

  describe('expandNamedInput', () => {
    it('should expand named inputs', () => {
      const expanded = expandNamedInput('c', {
        a: ['a.txt', { fileset: 'myfileset' }],
        b: ['b.txt'],
        c: ['a', { input: 'b' }],
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
          b: [{ input: 'c' }],
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

  describe('filterUsingGlobPatterns', () => {
    it('should OR all positive patterns and AND all negative patterns (when positive and negative patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        [
          '{projectRoot}/**/*.ts',
          '{projectRoot}/**/*.js',
          '!{projectRoot}/**/*.spec.ts',
          '!{projectRoot}/**/*.md',
        ]
      );

      expect(filtered.map((f) => f.file)).toEqual(['root/a.ts', 'root/b.js']);
    });

    it('should OR all positive patterns and AND all negative patterns (when negative patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        ['!{projectRoot}/**/*.spec.ts', '!{projectRoot}/**/*.md']
      );

      expect(filtered.map((f) => f.file)).toEqual(['root/a.ts', 'root/b.js']);
    });

    it('should OR all positive patterns and AND all negative patterns (when positive patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        ['{projectRoot}/**/*.ts', '{projectRoot}/**/*.js']
      );

      expect(filtered.map((f) => f.file)).toEqual([
        'root/a.ts',
        'root/b.js',
        'root/c.spec.ts',
      ]);
    });

    it('should handle projects with the root set to .', () => {
      const filtered = filterUsingGlobPatterns(
        '.',
        [
          { file: 'a.ts' },
          { file: 'b.md' },
          { file: 'dir/a.ts' },
          { file: 'dir/b.md' },
        ] as any,
        ['{projectRoot}/**/*.ts', '!{projectRoot}/**/*.md']
      );

      expect(filtered.map((f) => f.file)).toEqual(['a.ts', 'dir/a.ts']);
    });
  });
});

function assertFilesets(
  hash: Hash,
  assertions: { [name: string]: { contains?: string; excludes?: string } }
) {
  const nodes = hash.details.nodes;
  for (let k of Object.keys(assertions)) {
    expect(nodes[k]).toBeDefined();
    if (assertions[k].contains) {
      expect(nodes[k]).toContain(assertions[k].contains);
    }
    if (assertions[k].excludes) {
      expect(nodes[k]).not.toContain(assertions[k].excludes);
    }
  }
}

//{ [name: string]: string }
