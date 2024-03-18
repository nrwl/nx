// This must come before the Hasher import
import { TempFs } from '../internal-testing-utils/temp-fs';

let tempFs = new TempFs('TaskHasher');

import { DependencyType } from '../config/project-graph';
import {
  expandNamedInput,
  filterUsingGlobPatterns,
  InProcessTaskHasher,
} from './task-hasher';

describe('TaskHasher', () => {
  process.env.NX_NATIVE_TASK_HASHER = 'false';
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

  beforeEach(async () => {
    await tempFs.createFiles({
      'tsconfig.base.json': tsConfigBaseJson,
      'yarn.lock': 'content',
      'package.json': JSON.stringify(packageJson),
    });
  });

  afterEach(() => {
    tempFs.reset();
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  it('should create task hash', async () => {
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

      {} as any,
      null,
      {
        runtimeCacheInputs: ['echo runtime456'],
      }
    );

    const hash = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      {
        roots: ['parent-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {},
      },
      { TESTENV: 'env123' }
    );

    expect(hash).toMatchSnapshot();
  });

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
        externalNodes: {},
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
      },
      {} as any,
      null,
      {}
    );

    const hash = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      {
        roots: ['child-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'child-build': {
            id: 'child-build',
            target: { project: 'child', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'parent-build': ['child-build'],
        },
      },
      {}
    );

    expect(hash).toMatchSnapshot();
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
        externalNodes: {},
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
      },
      {
        namedInputs: {
          prod: ['!{projectRoot}/**/*.spec.ts'],
        },
      } as any,
      null,
      {}
    );

    const hash = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      {
        roots: ['child-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'child-build': {
            id: 'child-build',
            target: { project: 'child', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'parent-build': ['child-build'],
        },
      },
      {}
    );

    expect(hash).toMatchSnapshot();
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
        externalNodes: {},
        dependencies: {
          parent: [],
        },
      },
      {
        namedInputs: {
          prod: ['!{projectRoot}/**/*.spec.ts'],
        },
      } as any,
      null,
      {}
    );

    const taskGraph = {
      roots: ['parent-test'],
      tasks: {
        'parent-test': {
          id: 'parent-test',
          target: { project: 'parent', target: 'test' },
          overrides: {},
          outputs: [],
        },
      },
      dependencies: {},
    };

    const test = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'test' },
        id: 'parent-test',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      taskGraph,
      {}
    );

    expect(test).toMatchSnapshot();

    const build = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      taskGraph,
      {}
    );

    expect(build).toMatchSnapshot();
  });

  it('should be able to handle multiple filesets per project', async () => {
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
        externalNodes: {},
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
      },

      {
        namedInputs: {
          default: ['{projectRoot}/**/*', '{workspaceRoot}/global1'],
          prod: ['!{projectRoot}/**/*.spec.ts'],
        },
      } as any,
      null,
      {}
    );

    const taskGraph = {
      roots: ['child-test'],
      tasks: {
        'parent-test': {
          id: 'parent-test',
          target: { project: 'parent', target: 'test' },
          overrides: {},
          outputs: [],
        },
        'child-test': {
          id: 'child-test',
          target: { project: 'child', target: 'test' },
          overrides: {},
          outputs: [],
        },
      },
      dependencies: {
        'parent-test': ['child-test'],
      },
    };

    const parentHash = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'test' },
        id: 'parent-test',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      taskGraph,
      { MY_TEST_HASH_ENV: 'MY_TEST_HASH_ENV_VALUE' }
    );

    expect(parentHash).toMatchSnapshot();

    const childHash = await hasher.hashTask(
      {
        target: { project: 'child', target: 'test' },
        id: 'child-test',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      taskGraph,
      { MY_TEST_HASH_ENV: 'MY_TEST_HASH_ENV_VALUE' }
    );

    expect(childHash).toMatchSnapshot();
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
        namedInputs: {
          prod: ['!{projectRoot}/**/*.spec.ts'],
        },
        targetDefaults: {
          build: {
            inputs: ['prod', '^prod'],
          },
        },
      } as any,
      null,
      {}
    );

    const hash = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      {
        roots: ['child-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'child-build': {
            id: 'child-build',
            target: { project: 'child', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'parent-build': ['child-build'],
        },
      },
      {}
    );
    expect(hash).toMatchSnapshot();
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

      { npmScope: 'nrwl' } as any,
      null,
      {
        runtimeCacheInputs: ['echo runtime123', 'echo runtime456'],
        selectivelyHashTsConfig: true,
      }
    );

    const hash = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      {
        roots: ['parent:build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {},
      },
      {}
    );

    expect(hash).toMatchSnapshot();
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

      {} as any,
      null,
      {}
    );

    const taskGraph = {
      roots: ['child-build'],
      tasks: {
        'parent-build': {
          id: 'parent-build',
          target: { project: 'parent', target: 'build' },
          overrides: {},
          outputs: [],
        },
        'child-build': {
          id: 'child-build',
          target: { project: 'child', target: 'build' },
          overrides: {},
          outputs: [],
        },
      },
      dependencies: {
        'parent-build': ['child-build'],
      },
    };

    const tasksHash = await hasher.hashTask(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      taskGraph,
      {}
    );

    expect(tasksHash).toMatchSnapshot();

    const hashb = await hasher.hashTask(
      {
        target: { project: 'child', target: 'build' },
        id: 'child-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      taskGraph,
      {}
    );

    expect(hashb).toMatchSnapshot();
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
        externalNodes: {},
        dependencies: {
          parent: [],
        },
      },
      {} as any,
      null,
      {
        runtimeCacheInputs: ['boom'],
      }
    );

    try {
      await hasher.hashTask(
        {
          target: { project: 'parent', target: 'build' },
          id: 'parent-build',
          overrides: {},
          outputs: [],
        },
        {
          roots: ['parent:build'],
          tasks: {
            'parent-build': {
              id: 'parent-build',
              target: { project: 'parent', target: 'build' },
              overrides: {},
              outputs: [],
            },
          },
          dependencies: {},
        },
        {}
      );
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

      {} as any,
      null,
      {}
    );

    const hash = await hasher.hashTask(
      {
        target: { project: 'app', target: 'build' },
        id: 'app-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      {
        roots: ['app-build'],
        tasks: {
          'app-build': {
            id: 'app-build',
            target: { project: 'app', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {},
      },
      {}
    );
    expect(hash).toMatchSnapshot();
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
            {
              source: 'app',
              target: 'npm:react',
              type: DependencyType.static,
            },
          ],
        },
      },

      {} as any,
      null,
      {}
    );

    const hash = await hasher.hashTask(
      {
        target: { project: 'app', target: 'build' },
        id: 'app-build',
        overrides: { prop: 'prop-value' },
        outputs: [],
      },
      {
        roots: ['app-build'],
        tasks: {
          'app-build': {
            id: 'app-build',
            target: { project: 'app', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {},
      },
      {}
    );

    // note that the parent hash is based on parent source files only!
    expect(hash).toMatchSnapshot();
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
        {} as any,
        null,
        {}
      );

      const hash = await hasher.hashTask(
        {
          target: { project: 'app', target: 'build' },
          id: 'app-build',
          overrides: { prop: 'prop-value' },
          outputs: [],
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
              outputs: [],
            },
          },
          dependencies: {},
        },
        {}
      );

      expect(hash).toMatchSnapshot();
    });

    it('should hash entire subtree of dependencies deterministically', async () => {
      function createHasher() {
        return new InProcessTaskHasher(
          {
            a: [{ file: 'a/filea.ts', hash: 'a.hash' }],
            b: [{ file: 'b/fileb.ts', hash: 'b.hash' }],
          },
          allWorkspaceFiles,
          {
            nodes: {
              a: {
                name: 'a',
                type: 'lib',
                data: {
                  root: 'a',
                  targets: { build: { executor: '@nx/webpack:webpack' } },
                },
              },
              b: {
                name: 'b',
                type: 'lib',
                data: {
                  root: 'b',
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
            },
            dependencies: {
              a: [
                {
                  source: 'a',
                  target: 'b',
                  type: DependencyType.static,
                },
              ],
              b: [
                {
                  source: 'b',
                  target: 'a',
                  type: DependencyType.static,
                },
              ],
              'npm:@nx/webpack': [],
            },
          },

          {} as any,
          null,
          {}
        );
      }

      const taskGraph = {
        roots: [],
        tasks: {
          'a-build': {
            id: 'a-build',
            target: { project: 'a', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'b-build': {
            id: 'b-build',
            target: { project: 'b', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {},
      };

      const hasher1 = createHasher();
      const hasher2 = createHasher();

      const hashA1 = await hasher1.hashTask(
        {
          id: 'a-build',
          target: { project: 'a', target: 'build' },
          overrides: {},
          outputs: [],
        },
        taskGraph,
        {}
      );
      const hashB1 = await hasher1.hashTask(
        {
          id: 'b-build',
          target: { project: 'b', target: 'build' },
          overrides: {},
          outputs: [],
        },
        taskGraph,
        {}
      );

      const hashB2 = await hasher2.hashTask(
        {
          id: 'b-build',
          target: { project: 'b', target: 'build' },
          overrides: {},
          outputs: [],
        },
        taskGraph,
        {}
      );
      const hashA2 = await hasher2.hashTask(
        {
          id: 'a-build',
          target: { project: 'a', target: 'build' },
          overrides: {},
          outputs: [],
        },
        taskGraph,
        {}
      );

      expect(hashA1).toEqual(hashA2);
      expect(hashB1).toEqual(hashB2);
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
        {} as any,
        null,
        {}
      );

      const hash = await hasher.hashTask(
        {
          target: { project: 'app', target: 'build' },
          id: 'app-build',
          overrides: { prop: 'prop-value' },
          outputs: [],
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
              outputs: [],
            },
          },
          dependencies: {},
        },
        {}
      );

      expect(hash).toMatchSnapshot();
    });

    it('should hash entire subtree in a deterministic way', async () => {
      const createHasher = () =>
        new InProcessTaskHasher(
          {},
          allWorkspaceFiles,
          {
            nodes: {
              appA: {
                name: 'appA',
                type: 'app',
                data: {
                  root: 'apps/appA',
                  targets: { build: { executor: '@nx/webpack:webpack' } },
                },
              },
              appB: {
                name: 'appB',
                type: 'app',
                data: {
                  root: 'apps/appB',
                  targets: { build: { executor: '@nx/webpack:webpack' } },
                },
              },
            },
            externalNodes: {
              'npm:packageA': {
                name: 'npm:packageA',
                type: 'npm',
                data: {
                  packageName: 'packageA',
                  version: '0.0.0',
                  hash: '$packageA0.0.0$',
                },
              },
              'npm:packageB': {
                name: 'npm:packageB',
                type: 'npm',
                data: {
                  packageName: 'packageB',
                  version: '0.0.0',
                  hash: '$packageB0.0.0$',
                },
              },
              'npm:packageC': {
                name: 'npm:packageC',
                type: 'npm',
                data: {
                  packageName: 'packageC',
                  version: '0.0.0',
                  hash: '$packageC0.0.0$',
                },
              },
              'npm:@nx/webpack': {
                name: 'npm:@nx/webpack',
                type: 'npm',
                data: {
                  packageName: '@nx/webpack',
                  version: '0.0.0',
                  hash: '$@nx/webpack0.0.0$',
                },
              },
            },
            dependencies: {
              appA: [
                {
                  source: 'appA',
                  target: 'npm:packageA',
                  type: DependencyType.static,
                },
                {
                  source: 'appA',
                  target: 'npm:packageB',
                  type: DependencyType.static,
                },
                {
                  source: 'appA',
                  target: 'npm:packageC',
                  type: DependencyType.static,
                },
              ],
              appB: [
                {
                  source: 'appB',
                  target: 'npm:packageC',
                  type: DependencyType.static,
                },
              ],
              'npm:packageC': [
                {
                  source: 'npm:packageC',
                  target: 'npm:packageA',
                  type: DependencyType.static,
                },
                {
                  source: 'npm:packageC',
                  target: 'npm:packageB',
                  type: DependencyType.static,
                },
              ],
              'npm:packageB': [
                {
                  source: 'npm:packageB',
                  target: 'npm:packageA',
                  type: DependencyType.static,
                },
              ],
              'npm:packageA': [
                {
                  source: 'npm:packageA',
                  target: 'npm:packageC',
                  type: DependencyType.static,
                },
              ],
            },
          },

          {} as any,
          null,
          {}
        );

      const computeTaskHash = async (hasher, appName) => {
        return await hasher.hashTask(
          {
            target: { project: appName, target: 'build' },
            id: `${appName}-build`,
            overrides: { prop: 'prop-value' },
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
          }
        );
      };

      const hasher1 = createHasher();

      const hashAppA1 = await computeTaskHash(hasher1, 'appA');
      const hashAppB1 = await computeTaskHash(hasher1, 'appB');

      const hasher2 = createHasher();

      const hashAppB2 = await computeTaskHash(hasher2, 'appB');
      const hashAppA2 = await computeTaskHash(hasher2, 'appA');

      expect(hashAppB1).toEqual(hashAppB2);
      expect(hashAppA1).toEqual(hashAppA2);

      expect(hashAppA1).toMatchSnapshot();
      expect(hashAppB1).toMatchSnapshot();
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

        {} as any,
        null,
        {}
      );

      const hash = await hasher.hashTask(
        {
          target: { project: 'app', target: 'build' },
          id: 'app-build',
          overrides: { prop: 'prop-value' },
          outputs: [],
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
              outputs: [],
            },
          },
          dependencies: {},
        },
        {}
      );

      expect(hash.details.nodes['AllExternalDependencies']).toEqual(
        '5189537834781127994'
      );
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

        {} as any,
        null,
        {}
      );

      const hash = await hasher.hashTask(
        {
          target: { project: 'app', target: 'build' },
          id: 'app-build',
          overrides: { prop: 'prop-value' },
          outputs: [],
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
              outputs: [],
            },
          },
          dependencies: {},
        },
        {}
      );

      expect(hash).toMatchSnapshot();
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

        {} as any,
        null,
        {}
      );

      const hash = await hasher.hashTask(
        {
          target: { project: 'app', target: 'build' },
          id: 'app-build',
          overrides: { prop: 'prop-value' },
          outputs: [],
        },
        {
          roots: ['app-build'],
          tasks: {
            'app-build': {
              id: 'app-build',
              target: { project: 'app', target: 'build' },
              overrides: {},
              outputs: [],
            },
          },
          dependencies: {},
        },
        {}
      );

      expect(hash).toMatchSnapshot();
    });
  });

  describe('dependentTasksOutputFiles', () => {
    it('should depend on dependent tasks output files', async () => {
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
                    outputs: ['{workspaceRoot}/dist/{projectRoot}'],
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
                    outputs: ['{workspaceRoot}/dist/{projectRoot}'],
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
                    outputs: ['{workspaceRoot}/dist/{projectRoot}'],
                  },
                },
              },
            },
          },
          externalNodes: {},
          dependencies: {
            parent: [{ source: 'parent', target: 'child', type: 'static' }],
            child: [{ source: 'child', target: 'grandchild', type: 'static' }],
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
        null,
        {}
      );

      await tempFs.createFiles({
        'dist/libs/child/index.d.ts': '',
        'dist/libs/grandchild/index.d.ts': '',
      });

      const hash = await hasher.hashTask(
        {
          target: { project: 'parent', target: 'build' },
          id: 'parent-build',
          overrides: { prop: 'prop-value' },
          outputs: [],
        },
        {
          roots: ['grandchild-build'],
          tasks: {
            'parent-build': {
              id: 'parent-build',
              target: { project: 'parent', target: 'build' },
              overrides: {},
              outputs: ['dist/libs/libs/parent'],
            },
            'child-build': {
              id: 'child-build',
              target: { project: 'child', target: 'build' },
              overrides: {},
              outputs: ['dist/libs/libs/child'],
            },
            'grandchild-build': {
              id: 'grandchild-build',
              target: { project: 'grandchild', target: 'build' },
              overrides: {},
              outputs: ['dist/libs/libs/grandchild'],
            },
          },
          dependencies: {
            'parent-build': ['child-build'],
            'child-build': ['grandchild-build'],
          },
        },
        {}
      );

      expect(hash).toMatchSnapshot();
    });

    it('should work with dependent tasks with globs as outputs', async () => {
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
                    outputs: ['{workspaceRoot}/dist/{projectRoot}'],
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
                    outputs: ['{workspaceRoot}/dist/{projectRoot}/**/*'],
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
                    outputs: ['{workspaceRoot}/dist/{projectRoot}'],
                  },
                },
              },
            },
          },
          externalNodes: {},
          dependencies: {
            parent: [{ source: 'parent', target: 'child', type: 'static' }],
            child: [{ source: 'child', target: 'grandchild', type: 'static' }],
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
        null,
        {}
      );

      await tempFs.createFiles({
        'dist/libs/child/index.d.ts': '',
        'dist/libs/grandchild/index.d.ts': '',
      });

      const hash = await hasher.hashTask(
        {
          target: { project: 'parent', target: 'build' },
          id: 'parent-build',
          overrides: { prop: 'prop-value' },
          outputs: [],
        },
        {
          roots: ['grandchild-build'],
          tasks: {
            'parent-build': {
              id: 'parent-build',
              target: { project: 'parent', target: 'build' },
              overrides: {},
              outputs: [],
            },
            'child-build': {
              id: 'child-build',
              target: { project: 'child', target: 'build' },
              overrides: {},
              outputs: [],
            },
            'grandchild-build': {
              id: 'grandchild-build',
              target: { project: 'grandchild', target: 'build' },
              overrides: {},
              outputs: [],
            },
          },
          dependencies: {
            'parent-build': ['child-build'],
            'child-build': ['grandchild-build'],
          },
        },
        {}
      );

      expect(hash).toMatchSnapshot();
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
