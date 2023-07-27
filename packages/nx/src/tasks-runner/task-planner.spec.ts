import { TempFs } from '../utils/testing/temp-fs';
let tempFs = new TempFs('task-planner');

import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { InProcessTaskHasher } from '../hasher/task-hasher';
import { fileHasher } from '../hasher/file-hasher';
import { DependencyType, ProjectGraph } from '../config/project-graph';
import { TaskPlanner } from './task-planner';
import { Task } from '../config/task-graph';

jest.mock('../utils/workspace-root', () => {
  return {
    workspaceRoot: tempFs.tempDir,
  };
});

describe('task planner', () => {
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

  const legacyFilesetInputs = [
    'nx.json',

    // ignore files will change the set of inputs to the hasher
    '.gitignore',
    '.nxignore',
  ].map((d) => ({ fileset: `{workspaceRoot}/${d}` }));

  // TODO(cammisuli): This function is temporary until the new file hashing is implemented
  // This should just match snapshots of the planner
  async function assertNodes(
    task: Task | Task[],
    taskHasher: InProcessTaskHasher,
    taskPlanner: TaskPlanner
  ) {
    if (!Array.isArray(task)) task = [task];

    const hashes = await taskHasher.hashTasks(task);
    const plans = taskPlanner.getTaskPlans(task);

    let hashNodes = hashes.map((hash) => {
      return Object.keys(hash.details.nodes).sort();
    });

    let planNodes = Object.values(plans).map((plan) => plan.sort());

    for (let i = 0; i < hashNodes.length; i++) {
      expect(planNodes[i]).toEqual(hashNodes[i]);
    }
  }

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

  it('should build a plan that matches the original task-hasher', async () => {
    await withEnvironmentVariables({ TESTENV: 'env123' }, async () => {
      let projectFileMap = {
        parent: [{ file: '/file', hash: 'file.hash' }],
        unrelated: [{ file: 'libs/unrelated/filec.ts', hash: 'filec.hash' }],
      };
      let projectGraph: ProjectGraph = {
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
      };
      let taskGraph = {
        roots: ['parent-build'],
        tasks: {
          'parent-build': {
            id: 'parent-build',
            target: { project: 'parent', target: 'build' },
            overrides: {},
          },
        },
        dependencies: {},
      };
      let options = {
        runtimeCacheInputs: ['echo runtime456'],
      };
      let nxJson = {} as any;

      const hasher = new InProcessTaskHasher(
        projectFileMap,
        allWorkspaceFiles,
        projectGraph,
        taskGraph,
        nxJson,
        options,
        fileHasher
      );

      const planner = new TaskPlanner(
        nxJson,
        projectGraph,
        taskGraph,
        options.runtimeCacheInputs.map((r) => ({ runtime: r })),
        legacyFilesetInputs
      );

      await assertNodes(
        {
          target: { project: 'parent', target: 'build' },
          id: 'parent-build',
          overrides: { prop: 'prop-value' },
        },
        hasher,
        planner
      );
    });
  });

  it('should plan the task where the project has dependencies', async () => {
    let projectFileMap = {
      parent: [
        { file: '/filea.ts', hash: 'a.hash' },
        { file: '/filea.spec.ts', hash: 'a.spec.hash' },
      ],
      child: [
        { file: '/fileb.ts', hash: 'b.hash' },
        { file: '/fileb.spec.ts', hash: 'b.spec.hash' },
      ],
    };
    let projectGraph: ProjectGraph = {
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
    };
    let taskGraph = {
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
    };
    let nxJson = {} as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      taskGraph,
      nxJson,
      {},
      fileHasher
    );
    const planner = new TaskPlanner(
      nxJson,
      projectGraph,
      taskGraph,
      [],
      legacyFilesetInputs
    );

    await assertNodes(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
      },
      hasher,
      planner
    );
  });

  it('should plan non-default filesets', async () => {
    let projectFileMap = {
      parent: [
        { file: 'libs/parent/filea.ts', hash: 'a.hash' },
        { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
      ],
      child: [
        { file: 'libs/child/fileb.ts', hash: 'b.hash' },
        { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
      ],
    };
    let projectGraph: ProjectGraph = {
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
    };
    let taskGraph = {
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
    };
    let nxJson = {
      namedInputs: {
        prod: ['!{projectRoot}/**/*.spec.ts'],
      },
    } as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      taskGraph,
      nxJson,
      {},
      fileHasher
    );
    const planner = new TaskPlanner(
      nxJson,
      projectGraph,
      taskGraph,
      [],
      legacyFilesetInputs
    );

    await assertNodes(
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
      },
      hasher,
      planner
    );
  });

  it('should make a plan with multiple filesets of a project', async () => {
    let projectFileMap = {
      parent: [
        { file: 'libs/parent/filea.ts', hash: 'a.hash' },
        { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
      ],
    };
    let projectGraph: ProjectGraph = {
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
    };
    let taskGraph = {
      roots: ['parent-test'],
      tasks: {
        'parent-test': {
          id: 'parent-test',
          target: { project: 'parent', target: 'test' },
          overrides: {},
        },
      },
      dependencies: {},
    };
    let nxJson = {
      namedInputs: {
        prod: ['!{projectRoot}/**/*.spec.ts'],
      },
    } as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      taskGraph,
      nxJson,
      {},
      fileHasher
    );
    const planner = new TaskPlanner(
      nxJson,
      projectGraph,
      taskGraph,
      [],
      legacyFilesetInputs
    );

    const tasks = [
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
      },
      {
        target: { project: 'parent', target: 'test' },
        id: 'parent-test',
        overrides: { prop: 'prop-value' },
      },
    ];

    assertNodes(tasks, hasher, planner);
  });

  it('should be able to handle multiple filesets per project', async () => {
    await withEnvironmentVariables(
      { MY_TEST_HASH_ENV: 'MY_TEST_HASH_ENV_VALUE' },
      async () => {
        let projectFileMap = {
          parent: [
            { file: 'libs/parent/filea.ts', hash: 'a.hash' },
            { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
          ],
          child: [
            { file: 'libs/child/fileb.ts', hash: 'b.hash' },
            { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
          ],
        };
        let projectGraph: ProjectGraph = {
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
        };
        let taskGraph = {
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
        };
        let nxJson = {
          namedInputs: {
            default: ['{projectRoot}/**/*', '{workspaceRoot}/global1'],
            prod: ['!{projectRoot}/**/*.spec.ts'],
          },
        };
        const hasher = new InProcessTaskHasher(
          projectFileMap,
          allWorkspaceFiles,
          projectGraph,
          taskGraph,
          nxJson as any,
          {},
          fileHasher
        );

        const planner = new TaskPlanner(
          nxJson as any,
          projectGraph,
          taskGraph,
          [],
          legacyFilesetInputs
        );

        const tasks = [
          {
            target: { project: 'parent', target: 'test' },
            id: 'parent-test',
            overrides: { prop: 'prop-value' },
          },
          {
            target: { project: 'child', target: 'test' },
            id: 'child-test',
            overrides: { prop: 'prop-value' },
          },
        ];
        await assertNodes(tasks, hasher, planner);
      }
    );
  });

  it('should use targetDefaults from nx.json', async () => {
    let projectFileMap = {
      parent: [
        { file: 'libs/parent/filea.ts', hash: 'a.hash' },
        { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
      ],
      child: [
        { file: 'libs/child/fileb.ts', hash: 'b.hash' },
        { file: 'libs/child/fileb.spec.ts', hash: 'b.spec.hash' },
      ],
    };
    let projectGraph: ProjectGraph = {
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
    };
    let taskGraph = {
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
    };
    let nxJson = {
      namedInputs: {
        prod: ['!{projectRoot}/**/*.spec.ts'],
      },
      targetDefaults: {
        build: {
          inputs: ['prod', '^prod'],
        },
      },
    } as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,

      projectGraph,
      taskGraph,
      nxJson,
      {},
      fileHasher
    );

    const planner = new TaskPlanner(
      nxJson,
      projectGraph,
      taskGraph,
      [],
      legacyFilesetInputs
    );

    let tasks = [
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
      },
    ];
    await assertNodes(tasks, hasher, planner);
  });

  it('should build plans where the project graph has circular dependencies', async () => {
    let projectFileMap = {
      parent: [{ file: '/filea.ts', hash: 'a.hash' }],
      child: [{ file: '/fileb.ts', hash: 'b.hash' }],
    };
    let projectGraph: ProjectGraph = {
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
    };
    let taskGraph = {
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
    };
    let nxJson = {} as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      taskGraph,
      nxJson,
      {},
      fileHasher
    );
    let planner = new TaskPlanner(
      nxJson,
      projectGraph,
      taskGraph,
      [],
      legacyFilesetInputs
    );

    let tasks = [
      {
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: { prop: 'prop-value' },
      },
      {
        target: { project: 'child', target: 'build' },
        id: 'child-build',
        overrides: { prop: 'prop-value' },
      },
    ];
    await assertNodes(tasks, hasher, planner);
  });

  it('should include npm projects', async () => {
    let projectFileMap = {
      app: [{ file: '/filea.ts', hash: 'a.hash' }],
    };
    let projectGraph: ProjectGraph = {
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
    };
    let taskGraph = {
      roots: ['app-build'],
      tasks: {
        'app-build': {
          id: 'app-build',
          target: { project: 'app', target: 'build' },
          overrides: {},
        },
      },
      dependencies: {},
    };
    let nxJson = {} as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      taskGraph,
      nxJson,
      {},
      fileHasher
    );
    const planner = new TaskPlanner(
      nxJson,
      projectGraph,
      taskGraph,
      [],
      legacyFilesetInputs
    );

    let tasks = [
      {
        target: { project: 'app', target: 'build' },
        id: 'app-build',
        overrides: { prop: 'prop-value' },
      },
    ];

    await assertNodes(tasks, hasher, planner);
  });
});
