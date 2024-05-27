import { TempFs } from '../../internal-testing-utils/temp-fs';
import { HashPlanner, transferProjectGraph } from '../index';
import { Task, TaskGraph } from '../../config/task-graph';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { transformProjectGraphForRust } from '../transform-objects';
import { DependencyType } from '../../config/project-graph';

let tempFs = new TempFs('task-planner');

describe('task planner', () => {
  // disable NX_NATIVE_TASK_HASHER for this test because we need to compare the results of the new planner with the old task hasher
  process.env.NX_NATIVE_TASK_HASHER = 'false';

  const packageJson = {
    name: 'nrwl',
  };

  const tsConfigBaseJson = JSON.stringify({
    compilerOptions: {
      paths: {
        '@nx/parent': ['libs/parent/src/index.ts'],
        '@nx/child': ['libs/child/src/index.ts'],
        '@nx/grandchild': ['libs/grandchild/src/index.ts'],
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

  // TODO(cammisuli): This function is temporary until the new file hashing is implemented
  // This should just match snapshots of the planner
  async function assertHashPlan(
    task: Task | Task[],
    taskGraph: TaskGraph,
    taskHasher: InProcessTaskHasher,
    hashPlanner: HashPlanner
  ) {
    if (!Array.isArray(task)) task = [task];

    function getHashPlans(
      tasks: Task[],
      taskGraph: TaskGraph
    ): Record<string, string[]> {
      const plans = hashPlanner.getPlans(
        tasks.map((task) => task.id),
        taskGraph
      );

      for (const planId of Object.keys(plans)) {
        plans[planId] = plans[planId].sort();
      }

      return plans;
    }

    const hashes = await taskHasher.hashTasks(task, taskGraph);
    const plans = getHashPlans(task, taskGraph);

    // hashNodes here are completed in order because this is run with javascript.
    // we can then map the task id's by their index number with the hash nodes
    let hashNodes: Record<string, object> = task.reduce((acc, task, index) => {
      acc[task.id] = Object.keys(hashes[index].details.nodes).sort();
      return acc;
    }, {});

    for (let taskId of task.map((task) => task.id)) {
      expect(plans[taskId]).toEqual(hashNodes[taskId]);
    }

    return plans;
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

      const builder = new ProjectGraphBuilder();

      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'parent',
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
      });
      builder.addNode({
        name: 'unrelated',
        type: 'lib',
        data: {
          root: 'libs/unrelated',
          targets: { build: {} },
        },
      });
      builder.addNode({
        name: 'tagged',
        type: 'lib',
        data: {
          root: 'libs/tagged',
          targets: { build: {} },
          tags: ['some-tag'],
        },
      });
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['parent'],
        ['build'],
        undefined,
        {},
        false
      );

      let nxJson = {} as any;

      const hasher = new InProcessTaskHasher(
        projectFileMap,
        allWorkspaceFiles,
        projectGraph,
        nxJson,
        null,
        {}
      );

      const ref = transferProjectGraph(
        transformProjectGraphForRust(projectGraph)
      );
      const planner = new HashPlanner(nxJson as any, ref);

      await assertHashPlan(
        taskGraph.tasks['parent:build'],
        taskGraph,
        hasher,
        planner
      );
    });
  });

  it('should plan the task where the project has dependencies', async () => {
    const projectFileMap = {
      parent: [
        { file: '/filea.ts', hash: 'a.hash' },
        { file: '/filea.spec.ts', hash: 'a.spec.hash' },
      ],
      child: [
        { file: '/fileb.ts', hash: 'b.hash' },
        { file: '/fileb.spec.ts', hash: 'b.spec.hash' },
      ],
      grandchild: [
        { file: '/filec.ts', hash: 'c.hash' },
        { file: '/filec.spec.ts', hash: 'c.spec.hash' },
      ],
    };

    const builder = new ProjectGraphBuilder(undefined, projectFileMap);

    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: { build: { executor: 'unknown' } },
      },
    });

    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',
        targets: { build: { executor: 'none' } },
      },
    });
    builder.addNode({
      name: 'grandchild',
      type: 'lib',
      data: {
        root: 'libs/grandchild',
        targets: { build: { executor: 'none' } },
      },
    });
    builder.addStaticDependency('parent', 'child', '/filea.ts');
    builder.addStaticDependency('child', 'grandchild', '/fileb.ts');

    const projectGraph = builder.getUpdatedProjectGraph();

    let taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );
    let nxJson = {} as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      nxJson,
      null,
      {}
    );
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const hashPlan = await assertHashPlan(
      taskGraph.tasks['parent:build'],
      taskGraph,
      hasher,
      planner
    );

    expect(hashPlan).toMatchSnapshot();
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

    let builder = new ProjectGraphBuilder(undefined, projectFileMap);

    builder.addNode({
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
    });
    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',
        namedInputs: {
          prod: ['default'],
        },
        targets: { build: { executor: 'unknown' } },
      },
    });
    builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');

    let projectGraph = builder.getUpdatedProjectGraph();

    let taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );
    let nxJson = {
      namedInputs: {
        prod: ['!{projectRoot}/**/*.spec.ts'],
      },
    } as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      nxJson,
      null,
      {}
    );
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    let hashPlans = await assertHashPlan(
      taskGraph.tasks['parent:build'],
      taskGraph,
      hasher,
      planner
    );

    expect(hashPlans).toMatchSnapshot();
  });

  it('should make a plan with multiple filesets of a project', async () => {
    let projectFileMap = {
      parent: [
        { file: 'libs/parent/filea.ts', hash: 'a.hash' },
        { file: 'libs/parent/filea.spec.ts', hash: 'a.spec.hash' },
      ],
    };
    let builder = new ProjectGraphBuilder(undefined, projectFileMap);
    builder.addNode({
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
    });
    let projectGraph = builder.getUpdatedProjectGraph();

    let taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['parent'],
      ['build', 'test'],
      undefined,
      {}
    );
    let nxJson = {
      namedInputs: {
        prod: ['!{projectRoot}/**/*.spec.ts'],
      },
    } as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      nxJson,
      null,
      {}
    );
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const tasks = Object.values(taskGraph.tasks);

    let plans = await assertHashPlan(tasks, taskGraph, hasher, planner);
    expect(plans).toMatchSnapshot();
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
        const builder = new ProjectGraphBuilder(undefined, projectFileMap);
        builder.addNode({
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
        });
        builder.addNode({
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
        });
        builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');
        let projectGraph = builder.getUpdatedProjectGraph();
        let taskGraph = createTaskGraph(
          projectGraph,
          { build: ['^build'] },
          ['parent'],
          ['test'],
          undefined,
          {}
        );
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
          nxJson as any,
          null,
          {}
        );

        const planner = new HashPlanner(
          nxJson as any,
          transferProjectGraph(transformProjectGraphForRust(projectGraph))
        );
        const tasks = Object.values(taskGraph.tasks);
        let plans = await assertHashPlan(tasks, taskGraph, hasher, planner);
        expect(plans).toMatchSnapshot();
      }
    );
  });

  it('should hash executors', async () => {
    let projectFileMap = {
      parent: [],
      child: [],
    };
    const builder = new ProjectGraphBuilder(undefined, projectFileMap);
    builder.addNode({
      name: 'proj',
      type: 'lib',
      data: {
        root: 'libs/proj',
        targets: {
          lint: {
            inputs: ['default'],
            executor: '@nx/eslint:lint',
          },
        },
      },
    });
    builder.addExternalNode({
      type: 'npm',
      name: 'npm:@nx/eslint',
      data: {
        packageName: '@nx/eslint',
        hash: 'hash1',
        version: '1.0.0',
      },
    });
    builder.addExternalNode({
      type: 'npm',
      name: 'npm:@nx/devkit',
      data: {
        packageName: '@nx/devkit',
        hash: 'hash2',
        version: '1.0.0',
      },
    });
    builder.addDependency(
      'npm:@nx/eslint',
      'npm:@nx/devkit',
      DependencyType.static
    );
    let projectGraph = builder.getUpdatedProjectGraph();
    let taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['proj'],
      ['lint'],
      undefined,
      {}
    );
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
      nxJson as any,
      null,
      {}
    );

    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const tasks = Object.values(taskGraph.tasks);
    let plans = await assertHashPlan(tasks, taskGraph, hasher, planner);
    expect(plans).toMatchSnapshot();
  });

  it('should build plans where the project graph has circular dependencies', async () => {
    let projectFileMap = {
      parent: [{ file: '/filea.ts', hash: 'a.hash' }],
      child: [{ file: '/fileb.ts', hash: 'b.hash' }],
    };
    let builder = new ProjectGraphBuilder(undefined, projectFileMap);
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: { build: { executor: 'nx:run-commands' } },
      },
    });
    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',
        targets: { build: { executor: 'nx:run-commands' } },
      },
    });
    builder.addStaticDependency('parent', 'child', '/filea.ts');
    builder.addStaticDependency('child', 'parent', '/fileb.ts');
    let projectGraph = builder.getUpdatedProjectGraph();
    let taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );
    let nxJson = {} as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      nxJson,
      null,
      {}
    );
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    let tasks = Object.values(taskGraph.tasks);
    let plans = await assertHashPlan(tasks, taskGraph, hasher, planner);
    expect(plans).toMatchSnapshot();
  });

  it('should include npm projects', async () => {
    let projectFileMap = {
      app: [{ file: '/filea.ts', hash: 'a.hash' }],
    };
    let builder = new ProjectGraphBuilder(undefined, projectFileMap);
    builder.addNode({
      name: 'app',
      type: 'app',
      data: {
        root: 'apps/app',
        targets: { build: { executor: 'nx:run-commands' } },
      },
    });
    builder.addExternalNode({
      name: 'npm:react',
      type: 'npm',
      data: {
        version: '17.0.0',
        packageName: 'react',
      },
    });
    builder.addStaticDependency('app', 'npm:react', '/filea.ts');
    let projectGraph = builder.getUpdatedProjectGraph();
    let taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['app'],
      ['build'],
      undefined,
      {}
    );
    let nxJson = {} as any;
    const hasher = new InProcessTaskHasher(
      projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      nxJson,
      null,
      {}
    );
    const transformed = transferProjectGraph(
      transformProjectGraphForRust(projectGraph)
    );
    const planner = new HashPlanner(nxJson as any, transformed);
    let plans = await assertHashPlan(
      taskGraph.tasks['app:build'],
      taskGraph,
      hasher,
      planner
    );
    expect(plans).toMatchSnapshot();
  });

  describe('dependentTasksOutputFiles', () => {
    it('should depend on dependent tasks output files', async () => {
      const projectFileMap = {
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
      };

      let builder = new ProjectGraphBuilder(undefined, projectFileMap);
      builder.addNode({
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
      });
      builder.addNode({
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
      });

      builder.addNode({
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
      });

      builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');
      builder.addStaticDependency('child', 'grandchild', 'libs/child/fileb.ts');

      let projectGraph = builder.getUpdatedProjectGraph();
      let taskGraph = createTaskGraph(
        projectGraph,
        { build: ['^build'] },
        ['parent'],
        ['build'],
        undefined,
        {}
      );

      let nxJson = {
        namedInputs: {
          prod: ['!{projectRoot}/**/*.spec.ts'],
          deps: [{ dependentTasksOutputFiles: '**/*.d.ts', transitive: true }],
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
      } as any;

      await tempFs.createFiles({
        'dist/libs/child/index.d.ts': '',
        'dist/libs/grandchild/index.d.ts': '',
      });

      const hasher = new InProcessTaskHasher(
        projectFileMap,
        allWorkspaceFiles,
        projectGraph,
        nxJson,
        null,
        {}
      );

      const transformed = transferProjectGraph(
        transformProjectGraphForRust(projectGraph)
      );
      const planner = new HashPlanner(nxJson, transformed);
      let plans = await assertHashPlan(
        taskGraph.tasks['parent:build'],
        taskGraph,
        hasher,
        planner
      );
      expect(plans).toMatchSnapshot();
    });
  });
});
