import { TempFs } from '../../internal-testing-utils/temp-fs';
import { HashPlanner, transferProjectGraph } from '../index';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { transformProjectGraphForRust } from '../transform-objects';
import { DependencyType } from '../../config/project-graph';

let tempFs = new TempFs('task-planner');

describe('task planner', () => {
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

  it('should build a plan', async () => {
    await withEnvironmentVariables({ TESTENV: 'env123' }, async () => {
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

      const ref = transferProjectGraph(
        transformProjectGraphForRust(projectGraph)
      );
      const planner = new HashPlanner(nxJson as any, ref);

      const plans = planner.getPlans(['parent:build'], taskGraph);
      expect(plans).toMatchInlineSnapshot(`
        {
          "parent:build": [
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]",
            "runtime:echo runtime123",
            "env:NONEXISTENTENV",
            "env:NX_CLOUD_ENCRYPTION_KEY",
            "env:TESTENV",
            "parent:{projectRoot}/**/*",
            "tagged:{projectRoot}/**/*",
            "unrelated:{projectRoot}/**/*",
            "parent:ProjectConfiguration",
            "tagged:ProjectConfiguration",
            "unrelated:ProjectConfiguration",
            "parent:TsConfig",
            "tagged:TsConfig",
            "unrelated:TsConfig",
            "AllExternalDependencies",
          ],
        }
      `);
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
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const plans = planner.getPlans(['parent:build'], taskGraph);

    expect(plans).toMatchSnapshot();
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
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const plans = planner.getPlans(['parent:build'], taskGraph);

    expect(plans).toMatchSnapshot();
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
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const taskIds = Object.keys(taskGraph.tasks);

    const plans = planner.getPlans(taskIds, taskGraph);
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

        const planner = new HashPlanner(
          nxJson as any,
          transferProjectGraph(transformProjectGraphForRust(projectGraph))
        );
        const taskIds = Object.keys(taskGraph.tasks);

        const plans = planner.getPlans(taskIds, taskGraph);
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

    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const taskIds = Object.keys(taskGraph.tasks);

    const plans = planner.getPlans(taskIds, taskGraph);
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
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const taskIds = Object.keys(taskGraph.tasks);

    const plans = planner.getPlans(taskIds, taskGraph);
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
    const transformed = transferProjectGraph(
      transformProjectGraphForRust(projectGraph)
    );
    const planner = new HashPlanner(nxJson as any, transformed);

    const plans = planner.getPlans(['app:build'], taskGraph);
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

      const transformed = transferProjectGraph(
        transformProjectGraphForRust(projectGraph)
      );
      const planner = new HashPlanner(nxJson, transformed);

      const plans = planner.getPlans(['parent:build'], taskGraph);
      expect(plans).toMatchSnapshot();
    });
  });
});
