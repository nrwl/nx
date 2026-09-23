import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  closeDbConnection,
  connectToNxDb,
  HashPlanner,
  IoSnapshotStore,
  getIoSnapshotDeferredTaskIds,
  getIoSnapshotReport,
  TaskHasher,
  testOnlyTransferFileMap,
  transferProjectGraph,
} from '../index';
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
            "parent:parent/**/*",
            "tagged:libs/tagged/**/*",
            "unrelated:libs/unrelated/**/*",
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

  describe('includeIgnored filesets', () => {
    function planFor(inputs: any[], namedInputs?: Record<string, any[]>) {
      const builder = new ProjectGraphBuilder();
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          namedInputs,
          targets: { build: { executor: 'nx:run-commands', inputs } },
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
      const ref = transferProjectGraph(
        transformProjectGraphForRust(projectGraph)
      );
      return new HashPlanner({} as any, ref).getPlans(
        ['parent:build'],
        taskGraph
      )['parent:build'];
    }

    it('aggregates includeIgnored filesets into one disk-backed group with tokens resolved', () => {
      const plan = planFor([
        'default',
        { fileset: '{projectRoot}/dist/**/*.js', includeIgnored: true },
        { fileset: '!{projectRoot}/dist/**/*.map', includeIgnored: true },
        { fileset: '{workspaceRoot}/.env.generated', includeIgnored: true },
      ]);

      expect(plan).toContain(
        'files:[libs/parent/dist/**/*.js,!libs/parent/dist/**/*.map,.env.generated]'
      );
      // The map-backed fileset is untouched by the flag.
      expect(plan).toContain('parent:libs/parent/**/*');
    });

    it('plans a disk-backed group declared through a named input', () => {
      const plan = planFor(['generated'], {
        generated: [
          { fileset: '{projectRoot}/generated', includeIgnored: true },
        ],
      });

      expect(plan).toContain('files:[libs/parent/generated]');
    });

    it('accepts a root brace group of literal file names', () => {
      const plan = planFor([
        {
          fileset: '{workspaceRoot}/{nx,tsconfig.base}.json',
          includeIgnored: true,
        },
      ]);

      expect(plan).toContain('files:[{nx,tsconfig.base}.json]');
    });

    it('plans a glob that walks from the workspace root', () => {
      expect(
        planFor([{ fileset: '{workspaceRoot}/**', includeIgnored: true }])
      ).toContain('files:[**]');
      expect(
        planFor([
          { fileset: '{workspaceRoot}/{nx,*}.json', includeIgnored: true },
        ])
      ).toContain('files:[{nx,*}.json]');
    });

    it('rejects a negation with no positive includeIgnored fileset to filter', () => {
      expect(() =>
        planFor([
          'default',
          { fileset: '!{projectRoot}/dist/**/*.map', includeIgnored: true },
        ])
      ).toThrow(/no positive includeIgnored fileset/);
    });

    function twoConsumersOfShared(aInputs: any[], bInputs: any[]) {
      const builder = new ProjectGraphBuilder();
      builder.addNode({
        name: 'a',
        type: 'lib',
        data: {
          root: 'libs/a',
          targets: { build: { executor: 'nx:run-commands', inputs: aInputs } },
        },
      });
      builder.addNode({
        name: 'b',
        type: 'lib',
        data: {
          root: 'libs/b',
          targets: { build: { executor: 'nx:run-commands', inputs: bInputs } },
        },
      });
      builder.addNode({
        name: 'shared',
        type: 'lib',
        data: {
          root: 'libs/shared',
          targets: { build: { executor: 'nx:run-commands' } },
        },
      });
      builder.addImplicitDependency('a', 'shared');
      builder.addImplicitDependency('b', 'shared');
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['a', 'b'],
        ['build'],
        undefined,
        {},
        false
      );
      const ref = transferProjectGraph(
        transformProjectGraphForRust(projectGraph)
      );
      return (order: string[]) =>
        new HashPlanner({} as any, ref).getPlans(order, taskGraph);
    }

    // A chain, so the group has to be handed on: a depends on shared, which
    // depends on core. Depth one never exercises the re-propagation.
    function chainOfThree(aInputs: any[]) {
      const builder = new ProjectGraphBuilder();
      for (const [name, root] of [
        ['a', 'libs/a'],
        ['shared', 'libs/shared'],
        ['core', 'libs/core'],
      ]) {
        builder.addNode({
          name,
          type: 'lib',
          data: {
            root,
            targets: {
              build: {
                executor: 'nx:run-commands',
                ...(name === 'a' ? { inputs: aInputs } : {}),
              },
            },
          },
        });
      }
      builder.addImplicitDependency('a', 'shared');
      builder.addImplicitDependency('shared', 'core');
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['a'],
        ['build'],
        undefined,
        {},
        false
      );
      const ref = transferProjectGraph(
        transformProjectGraphForRust(projectGraph)
      );
      return new HashPlanner({} as any, ref).getPlans(['a:build'], taskGraph);
    }

    const ignoredDepGroup = [
      {
        fileset: '{projectRoot}/dist/**',
        includeIgnored: true,
        dependencies: true,
      },
      {
        fileset: '!{projectRoot}/dist/**/*.map',
        includeIgnored: true,
        dependencies: true,
      },
    ];

    it('hands the group on to a dependency of a dependency', () => {
      const plans = chainOfThree(ignoredDepGroup);
      // Both dependencies get the whole group, each rooted at its own project.
      expect(plans['a:build']).toContain(
        'files:[libs/shared/dist/**,!libs/shared/dist/**/*.map]'
      );
      expect(plans['a:build']).toContain(
        'files:[libs/core/dist/**,!libs/core/dist/**/*.map]'
      );
      // The negation never leaks across projects.
      expect(plans['a:build']).not.toContain('files:[libs/core/dist/**]');
      expect(plans['a:build']).not.toContain('files:[libs/shared/dist/**]');
    });

    // The group is resolved before the other inputs and shares one cycle
    // scope. Without rolling that scope back, a sibling input finds the
    // dependencies already visited and silently contributes nothing.
    it('leaves the dependencies for the inputs that follow the group', () => {
      const plans = chainOfThree([
        ...ignoredDepGroup,
        { fileset: '{projectRoot}/src/**/*.ts', dependencies: true },
      ]);
      expect(plans['a:build']).toContain(
        'files:[libs/shared/dist/**,!libs/shared/dist/**/*.map]'
      );
      const plan = plans['a:build'] as string[];
      expect(plan.filter((i) => i.includes('src/**/*.ts')).sort()).toEqual([
        'core:libs/core/src/**/*.ts',
        'shared:libs/shared/src/**/*.ts',
      ]);
    });

    it('hands the group on around a cycle without duplicating it', () => {
      const builder = new ProjectGraphBuilder();
      for (const [name, root] of [
        ['a', 'libs/a'],
        ['b', 'libs/b'],
      ]) {
        builder.addNode({
          name,
          type: 'lib',
          data: {
            root,
            targets: {
              build: {
                executor: 'nx:run-commands',
                ...(name === 'a' ? { inputs: ignoredDepGroup } : {}),
              },
            },
          },
        });
      }
      builder.addImplicitDependency('a', 'b');
      builder.addImplicitDependency('b', 'a');
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['a'],
        ['build'],
        undefined,
        {},
        false
      );
      const ref = transferProjectGraph(
        transformProjectGraphForRust(projectGraph)
      );
      const plans = new HashPlanner({} as any, ref).getPlans(
        ['a:build'],
        taskGraph
      );
      const group = 'files:[libs/b/dist/**,!libs/b/dist/**/*.map]';
      expect(plans['a:build']).toContain(group);
      expect(plans['a:build'].filter((i: string) => i === group)).toHaveLength(
        1
      );
    });

    it('resolves a dependency includeIgnored group so a negation filters it', () => {
      const plans = twoConsumersOfShared(
        [
          {
            fileset: '{projectRoot}/dist/**',
            dependencies: true,
            includeIgnored: true,
          },
          {
            fileset: '!{projectRoot}/dist/**/*.map',
            dependencies: true,
            includeIgnored: true,
          },
        ],
        ['default']
      )(['a:build', 'b:build']);

      expect(plans['a:build']).toContain(
        'files:[libs/shared/dist/**,!libs/shared/dist/**/*.map]'
      );
    });

    it('rejects a dependency group that is only negations', () => {
      expect(() =>
        twoConsumersOfShared(
          [
            {
              fileset: '!{projectRoot}/dist/**/*.map',
              dependencies: true,
              includeIgnored: true,
            },
            {
              fileset: '!{projectRoot}/dist/**/*.d.ts',
              dependencies: true,
              includeIgnored: true,
            },
          ],
          ['default']
        )(['a:build'])
      ).toThrow(/no positive includeIgnored fileset/);
    });

    it('keys the dependency memo on the whole group', () => {
      const plansIn = twoConsumersOfShared(
        [
          {
            fileset: '{projectRoot}/dist/**',
            dependencies: true,
            includeIgnored: true,
          },
          {
            fileset: '!{projectRoot}/dist/**/*.map',
            dependencies: true,
            includeIgnored: true,
          },
        ],
        [
          {
            fileset: '{projectRoot}/dist/**',
            dependencies: true,
            includeIgnored: true,
          },
          {
            fileset: '!{projectRoot}/dist/**/*.d.ts',
            dependencies: true,
            includeIgnored: true,
          },
        ]
      );

      // Whichever task is planned first must not hand its group to the other.
      for (const order of [
        ['a:build', 'b:build'],
        ['b:build', 'a:build'],
      ]) {
        const plans = plansIn(order);
        expect(plans['a:build']).toContain(
          'files:[libs/shared/dist/**,!libs/shared/dist/**/*.map]'
        );
        expect(plans['b:build']).toContain(
          'files:[libs/shared/dist/**,!libs/shared/dist/**/*.d.ts]'
        );
      }
    });

    it('keys the dependency subtree memo on the backing store', () => {
      const plansIn = twoConsumersOfShared(
        [
          {
            fileset: '{projectRoot}/dist/**',
            dependencies: true,
            includeIgnored: true,
          },
        ],
        [{ fileset: '{projectRoot}/dist/**', dependencies: true }]
      );

      // Whichever task is planned first must not hand its store to the other.
      for (const order of [
        ['a:build', 'b:build'],
        ['b:build', 'a:build'],
      ]) {
        const plans = plansIn(order);
        expect(plans['a:build']).toContain('files:[libs/shared/dist/**]');
        expect(plans['a:build']).not.toContain('shared:libs/shared/dist/**');
        expect(plans['b:build']).toContain('shared:libs/shared/dist/**');
        expect(plans['b:build']).not.toContain('files:[libs/shared/dist/**]');
      }
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

  it.each([
    [
      'before production',
      ['default', '^{projectRoot}/tsconfig*.json', '^prod'],
    ],
    ['after production', ['default', '^prod', '^{projectRoot}/tsconfig*.json']],
  ])(
    'should apply multiple dependency inputs to the same dependency when tsconfig inputs are listed %s',
    async (_, targetInputs) => {
      const projectFileMap = {
        parent: [{ file: 'libs/parent/e2e.spec.ts', hash: 'parent.hash' }],
        child: [
          { file: 'libs/child/src/index.ts', hash: 'child.hash' },
          { file: 'libs/child/src/index.spec.ts', hash: 'child.spec.hash' },
          {
            file: 'libs/child/tsconfig.spec.json',
            hash: 'child.tsconfig.hash',
          },
        ],
      };

      const builder = new ProjectGraphBuilder(undefined, projectFileMap);
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          targets: {
            e2e: {
              inputs: targetInputs,
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
          targets: {},
        },
      });
      builder.addStaticDependency('parent', 'child', 'libs/parent/e2e.spec.ts');

      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['parent'],
        ['e2e'],
        undefined,
        {}
      );
      const nxJson = {
        namedInputs: {
          prod: [
            '!{projectRoot}/**/*.spec.ts',
            '!{projectRoot}/tsconfig.spec.json',
          ],
        },
      } as any;

      const planner = new HashPlanner(
        nxJson,
        transferProjectGraph(transformProjectGraphForRust(projectGraph))
      );
      const plans = planner.getPlans(['parent:e2e'], taskGraph);

      expect(plans['parent:e2e']).toEqual(
        expect.arrayContaining([
          'child:libs/child/tsconfig*.json',
          'child:!libs/child/**/*.spec.ts,!libs/child/tsconfig.spec.json',
        ])
      );
    }
  );

  it('should apply multiple dependency inputs to shared transitive dependencies', async () => {
    const projectFileMap = {
      parent: [{ file: 'libs/parent/e2e.spec.ts', hash: 'parent.hash' }],
      left: [{ file: 'libs/left/src/index.ts', hash: 'left.hash' }],
      right: [{ file: 'libs/right/src/index.ts', hash: 'right.hash' }],
      shared: [
        { file: 'libs/shared/src/index.ts', hash: 'shared.hash' },
        { file: 'libs/shared/src/index.spec.ts', hash: 'shared.spec.hash' },
        {
          file: 'libs/shared/tsconfig.spec.json',
          hash: 'shared.tsconfig.hash',
        },
      ],
    };

    const builder = new ProjectGraphBuilder(undefined, projectFileMap);
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          e2e: {
            inputs: ['default', '^{projectRoot}/tsconfig*.json', '^prod'],
            executor: 'nx:run-commands',
          },
        },
      },
    });
    for (const name of ['left', 'right', 'shared']) {
      builder.addNode({
        name,
        type: 'lib',
        data: {
          root: `libs/${name}`,
          targets: {},
        },
      });
    }
    builder.addStaticDependency('parent', 'left', 'libs/parent/e2e.spec.ts');
    builder.addStaticDependency('parent', 'right', 'libs/parent/e2e.spec.ts');
    builder.addStaticDependency('left', 'shared', 'libs/left/src/index.ts');
    builder.addStaticDependency('right', 'shared', 'libs/right/src/index.ts');

    const projectGraph = builder.getUpdatedProjectGraph();
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['parent'],
      ['e2e'],
      undefined,
      {}
    );
    const nxJson = {
      namedInputs: {
        prod: [
          '!{projectRoot}/**/*.spec.ts',
          '!{projectRoot}/tsconfig.spec.json',
        ],
      },
    } as any;

    const planner = new HashPlanner(
      nxJson,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const plans = planner.getPlans(['parent:e2e'], taskGraph);

    expect(plans['parent:e2e']).toEqual(
      expect.arrayContaining([
        'shared:libs/shared/tsconfig*.json',
        'shared:!libs/shared/**/*.spec.ts,!libs/shared/tsconfig.spec.json',
      ])
    );
  });

  it('should apply multiple dependency inputs in circular dependencies', async () => {
    const projectFileMap = {
      parent: [{ file: 'libs/parent/e2e.spec.ts', hash: 'parent.hash' }],
      child: [
        { file: 'libs/child/src/index.ts', hash: 'child.hash' },
        { file: 'libs/child/src/index.spec.ts', hash: 'child.spec.hash' },
        {
          file: 'libs/child/tsconfig.spec.json',
          hash: 'child.tsconfig.hash',
        },
      ],
    };

    const builder = new ProjectGraphBuilder(undefined, projectFileMap);
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          e2e: {
            inputs: ['default', '^{projectRoot}/tsconfig*.json', '^prod'],
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
        targets: {},
      },
    });
    builder.addStaticDependency('parent', 'child', 'libs/parent/e2e.spec.ts');
    builder.addStaticDependency('child', 'parent', 'libs/child/src/index.ts');

    const projectGraph = builder.getUpdatedProjectGraph();
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['parent'],
      ['e2e'],
      undefined,
      {}
    );
    const nxJson = {
      namedInputs: {
        prod: [
          '!{projectRoot}/**/*.spec.ts',
          '!{projectRoot}/tsconfig.spec.json',
        ],
      },
    } as any;

    const planner = new HashPlanner(
      nxJson,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const plans = planner.getPlans(['parent:e2e'], taskGraph);

    expect(plans['parent:e2e']).toEqual(
      expect.arrayContaining([
        'child:libs/child/tsconfig*.json',
        'child:!libs/child/**/*.spec.ts,!libs/child/tsconfig.spec.json',
      ])
    );
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

  it('should build plans where a project specifies no external dependencies', async () => {
    let projectFileMap = {
      proj: [{ file: '/file.ts', hash: 'file.hash' }],
    };
    let builder = new ProjectGraphBuilder(undefined, projectFileMap);
    builder.addNode({
      name: 'proj',
      type: 'lib',
      data: {
        root: 'libs/proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: [
              {
                externalDependencies: [],
              },
            ],
          },
        },
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
    let projectGraph = builder.getUpdatedProjectGraph();
    let taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['proj'],
      ['build'],
      undefined,
      {}
    );
    let nxJson = {} as any;
    const planner = new HashPlanner(
      nxJson,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const taskIds = Object.keys(taskGraph.tasks);

    const plans = planner.getPlans(taskIds, taskGraph);
    expect(plans['proj:build']).not.toContain('AllExternalDependencies');
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

  it.each(['explicit', 'executor', 'all'])(
    'should deduplicate overlapping external closures for %s inputs without losing sibling project inputs',
    (mode) => {
      const builder = new ProjectGraphBuilder();
      builder.addNode({
        name: 'app',
        type: 'app',
        data: {
          root: 'apps/app',
          targets: {
            build: {
              executor:
                mode === 'executor' ? '@nx/left:build' : 'nx:run-commands',
              inputs: [
                'default',
                '^prod',
                '^test',
                ...(mode === 'explicit'
                  ? [
                      {
                        externalDependencies: ['@nx/left', 'right', '@nx/left'],
                      },
                    ]
                  : []),
              ],
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
            prod: ['{projectRoot}/prod.ts'],
            test: ['{projectRoot}/test.ts'],
          },
          targets: {},
        },
      });
      for (const packageName of ['@nx/left', 'right', 'shared', 'leaf']) {
        builder.addExternalNode({
          name: `npm:${packageName}`,
          type: 'npm',
          data: { packageName, version: '1.0.0' },
        });
      }
      builder.addImplicitDependency('app', 'child');
      builder.addImplicitDependency('child', 'app');
      builder.addImplicitDependency('app', 'npm:@nx/left');
      builder.addImplicitDependency('child', 'npm:@nx/left');
      builder.addImplicitDependency('child', 'npm:right');
      builder.addStaticDependency('npm:@nx/left', 'npm:shared');
      builder.addStaticDependency('npm:right', 'npm:shared');
      builder.addStaticDependency('npm:shared', 'npm:leaf');
      builder.addStaticDependency('npm:leaf', 'npm:shared');
      const graph = builder.getUpdatedProjectGraph();
      const tasks = createTaskGraph(
        graph,
        {},
        ['app'],
        ['build'],
        undefined,
        {}
      );
      const planner = new HashPlanner(
        {},
        transferProjectGraph(transformProjectGraphForRust(graph))
      );
      const plan = planner.getPlans(['app:build'], tasks)['app:build'];
      expect(
        plan.filter((instruction) => instruction.startsWith('npm:'))
      ).toEqual(['npm:@nx/left', 'npm:leaf', 'npm:right', 'npm:shared']);
      expect(plan).toContain('child:libs/child/prod.ts');
      expect(plan).toContain('child:libs/child/test.ts');
      expect(plan.includes('AllExternalDependencies')).toBe(mode === 'all');
      const hashGraph = (
        reverse: boolean,
        changes: {
          leafVersion?: string;
          prodHash?: string;
          ignoredHash?: string;
          acyclic?: boolean;
        } = {}
      ) => {
        const files = testOnlyTransferFileMap(
          {
            app: [],
            child: [
              {
                file: 'libs/child/prod.ts',
                hash: changes.prodHash ?? 'prod-hash',
              },
              { file: 'libs/child/test.ts', hash: 'test-hash' },
              {
                file: 'libs/child/ignored.ts',
                hash: changes.ignoredHash ?? 'ignored-hash',
              },
            ],
          },
          [{ file: 'nx.json', hash: 'nx-json-hash' }]
        );
        const transformed = transformProjectGraphForRust(graph);
        if (changes.acyclic) {
          transformed.dependencies.child =
            transformed.dependencies.child.filter((dep) => dep !== 'app');
        }
        if (changes.leafVersion)
          transformed.externalNodes['npm:leaf'].version = changes.leafVersion;
        if (reverse) {
          transformed.nodes = Object.fromEntries(
            Object.entries(transformed.nodes).reverse()
          );
          transformed.externalNodes = Object.fromEntries(
            Object.entries(transformed.externalNodes).reverse()
          );
          transformed.dependencies = Object.fromEntries(
            Object.entries(transformed.dependencies)
              .reverse()
              .map(([name, deps]) => [name, [...deps].reverse()])
          );
        }
        const ref = transferProjectGraph(transformed);
        const reorderedPlanner = new HashPlanner({}, ref);
        expect(
          reorderedPlanner.getPlans(['app:build'], tasks)['app:build']
        ).toEqual(plan);
        const hasher = new TaskHasher(
          tempFs.tempDir,
          ref,
          files.projectFiles,
          files.allWorkspaceFiles,
          Buffer.from('{}'),
          {},
          undefined,
          { selectivelyHashTsConfig: false },
          files.ignoredIndex
        );
        return hasher.hashPlans(
          reorderedPlanner.getPlansReference(['app:build'], tasks),
          { 'app:build': {} },
          tempFs.tempDir,
          true
        )['app:build'];
      };
      const hash = hashGraph(false);
      expect(hash).toMatchSnapshot(`overlapping external ${mode} hash`);
      expect(hashGraph(true)).toEqual(hash);
      expect(hashGraph(false, { leafVersion: '2.0.0' }).value).not.toBe(
        hash.value
      );
      expect(hashGraph(false, { prodHash: 'changed' }).value).not.toBe(
        hash.value
      );
      expect(hashGraph(false, { ignoredHash: 'changed' })).toEqual(hash);
      // Removing the back-edge enables subtree memoization. The same inputs
      // must survive both the initial plan and the subsequent cached call.
      expect(hashGraph(false, { acyclic: true })).toEqual(hash);
      expect(hashGraph(true, { acyclic: true })).toEqual(hash);
      expect(
        hashGraph(false, { acyclic: true, leafVersion: '2.0.0' }).value
      ).not.toBe(hash.value);
      expect(
        hashGraph(false, { acyclic: true, prodHash: 'changed' }).value
      ).not.toBe(hash.value);
    }
  );

  it('should interpolate {projectRoot} and {projectName} in {workspaceRoot} input patterns', async () => {
    let projectFileMap = {
      parent: [
        { file: 'libs/parent/file.go', hash: 'go.hash' },
        { file: 'libs/parent/file.ts', hash: 'ts.hash' },
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
            inputs: ['goSource'],
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
      ['build'],
      undefined,
      {}
    );
    let nxJson = {
      namedInputs: {
        goSource: ['{workspaceRoot}/{projectRoot}/**/*.go'],
      },
    };
    const planner = new HashPlanner(
      nxJson as any,
      transferProjectGraph(transformProjectGraphForRust(projectGraph))
    );
    const plans = planner.getPlans(['parent:build'], taskGraph);
    // {projectRoot} should be interpolated to 'libs/parent', so the workspace fileset
    // should have '{projectRoot}' replaced in the instruction ('{workspaceRoot}/' is stripped later during hashing)
    expect(plans['parent:build']).toContain(
      'workspace:[{workspaceRoot}/libs/parent/**/*.go]'
    );
    // The original pattern with uninterpolated {projectRoot} should NOT be present
    expect(plans['parent:build']).not.toContain(
      'workspace:[{workspaceRoot}/{projectRoot}/**/*.go]'
    );
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
  describe('continuous dependencies', () => {
    it("hashes a continuous dependency's inputs into the task it serves", () => {
      const builder = new ProjectGraphBuilder(undefined, {
        parent: [{ file: 'libs/parent/filea.ts', hash: 'a.hash' }],
        child: [{ file: 'libs/child/fileb.ts', hash: 'b.hash' }],
      });
      builder.addNode({
        name: 'child',
        type: 'lib',
        data: {
          root: 'libs/child',
          targets: {
            serve: { executor: 'nx:run-commands', continuous: true },
          },
        },
      });
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          targets: {
            test: {
              executor: 'nx:run-commands',
              inputs: ['{projectRoot}/**/*'],
              dependsOn: [{ projects: 'child', target: 'serve' }],
            },
          },
        },
      });
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['parent'],
        ['test'],
        undefined,
        {}
      );
      const planner = new HashPlanner(
        {} as any,
        transferProjectGraph(transformProjectGraphForRust(projectGraph))
      );

      // The dependency serving this task runs in its own process, so only its
      // declared inputs can stand in for what it reads.
      expect(taskGraph.continuousDependencies['parent:test']).toContain(
        'child:serve'
      );
      expect(
        planner.getPlans(['parent:test'], taskGraph)['parent:test']
      ).toContain('child:libs/child/**/*');
    });

    it('follows the servers that serve a continuous dependency', () => {
      const builder = new ProjectGraphBuilder(undefined, {
        parent: [{ file: 'libs/parent/filea.ts', hash: 'a.hash' }],
        child: [{ file: 'libs/child/fileb.ts', hash: 'b.hash' }],
        grandchild: [{ file: 'libs/grandchild/filec.ts', hash: 'c.hash' }],
      });
      // grandchild serves child over the network: no project dependency, so
      // only the task graph links them.
      builder.addNode({
        name: 'grandchild',
        type: 'lib',
        data: {
          root: 'libs/grandchild',
          targets: {
            serve: { executor: 'nx:run-commands', continuous: true },
          },
        },
      });
      builder.addNode({
        name: 'child',
        type: 'lib',
        data: {
          root: 'libs/child',
          targets: {
            serve: {
              executor: 'nx:run-commands',
              continuous: true,
              dependsOn: [{ projects: 'grandchild', target: 'serve' }],
            },
          },
        },
      });
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          targets: {
            test: {
              executor: 'nx:run-commands',
              inputs: ['{projectRoot}/**/*'],
              dependsOn: [{ projects: 'child', target: 'serve' }],
            },
          },
        },
      });
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['parent'],
        ['test'],
        undefined,
        {}
      );
      const planner = new HashPlanner(
        {} as any,
        transferProjectGraph(transformProjectGraphForRust(projectGraph))
      );

      expect(taskGraph.continuousDependencies['child:serve']).toContain(
        'grandchild:serve'
      );
      const plan = planner.getPlans(['parent:test'], taskGraph)['parent:test'];
      expect(plan).toContain('child:libs/child/**/*');
      expect(plan).toContain('grandchild:libs/grandchild/**/*');
    });

    // Builds the served/server pair the tests below vary: parent:test depends
    // on child:serve, a continuous target with the given configuration.
    function servedBy(
      serve: Record<string, unknown>,
      extraTargets: Record<string, unknown> = {},
      externals: string[] = [],
      testInputs: unknown[] = ['{projectRoot}/**/*']
    ) {
      const builder = new ProjectGraphBuilder(undefined, {
        parent: [{ file: 'libs/parent/filea.ts', hash: 'a.hash' }],
        child: [{ file: 'libs/child/fileb.ts', hash: 'b.hash' }],
      });
      for (const name of externals) {
        builder.addExternalNode({
          name: `npm:${name}`,
          type: 'npm',
          data: { packageName: name, version: '1.0.0', hash: `${name}.hash` },
        });
      }
      builder.addNode({
        name: 'child',
        type: 'lib',
        data: {
          root: 'libs/child',
          targets: {
            serve: { executor: 'nx:run-commands', continuous: true, ...serve },
            ...extraTargets,
          },
        },
      });
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          targets: {
            test: {
              executor: 'nx:run-commands',
              inputs: testInputs,
              dependsOn: [{ projects: 'child', target: 'serve' }],
            },
          },
        },
      });
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['parent'],
        ['test'],
        undefined,
        {}
      );
      const planner = new HashPlanner(
        {} as any,
        transferProjectGraph(transformProjectGraphForRust(projectGraph))
      );
      return { planner, taskGraph };
    }

    it("hashes a continuous dependency's external dependencies", () => {
      const { planner, taskGraph } = servedBy(
        { inputs: ['{projectRoot}/**/*', { externalDependencies: ['vite'] }] },
        {},
        ['vite', 'cypress'],
        ['{projectRoot}/**/*', { externalDependencies: ['cypress'] }]
      );

      const plan = planner.getPlans(['parent:test'], taskGraph)['parent:test'];
      expect(plan).toContain('npm:cypress');
      expect(plan).toContain('npm:vite');
      expect(plan).not.toContain('AllExternalDependencies');
    });

    it('hashes all external dependencies for a continuous dependency that declares none', () => {
      // The served task declares its own, so the fallback can only be the server's.
      const { planner, taskGraph } = servedBy(
        {},
        {},
        ['cypress'],
        ['{projectRoot}/**/*', { externalDependencies: ['cypress'] }]
      );

      const plan = planner.getPlans(['parent:test'], taskGraph)['parent:test'];
      expect(plan).toContain('npm:cypress');
      expect(plan).toContain('AllExternalDependencies');
    });

    it("hashes the outputs of a continuous dependency's own dependencies", () => {
      const { planner, taskGraph } = servedBy(
        {
          dependsOn: ['build'],
          inputs: [
            '{projectRoot}/**/*',
            { dependentTasksOutputFiles: '**/*.d.ts', transitive: true },
          ],
        },
        {
          build: {
            executor: 'nx:run-commands',
            outputs: ['{workspaceRoot}/dist/libs/child'],
          },
        }
      );

      // parent:test has no task dependency of its own; the TaskOutput entry
      // is what makes hash_plans_upfront hold it back until child:build ran.
      expect(taskGraph.dependencies['parent:test']).toEqual([]);
      const plan = planner.getPlans(['parent:test'], taskGraph)['parent:test'];
      expect(plan).toContain('child:libs/child/**/*');
      expect(plan).toContain('**/*.d.ts:dist/libs/child');
    });

    it('terminates on a cycle of continuous dependencies and hashes each server once', () => {
      const { planner, taskGraph } = servedBy({});
      // child:serve is (nonsensically) served by parent:test, closing a loop.
      taskGraph.continuousDependencies['child:serve'] = ['parent:test'];

      const plan = planner.getPlans(['parent:test'], taskGraph)['parent:test'];
      expect(
        plan.filter((entry) => entry === 'child:libs/child/**/*')
      ).toHaveLength(1);
      expect(
        plan.filter((entry) => entry === 'parent:libs/parent/**/*')
      ).toHaveLength(1);
    });

    it('hashes a server shared by two continuous dependencies once', () => {
      const builder = new ProjectGraphBuilder(undefined, {
        parent: [{ file: 'libs/parent/filea.ts', hash: 'a.hash' }],
        left: [{ file: 'libs/left/fileb.ts', hash: 'b.hash' }],
        right: [{ file: 'libs/right/filec.ts', hash: 'c.hash' }],
        shared: [{ file: 'libs/shared/filed.ts', hash: 'd.hash' }],
      });
      const serve = (dependsOn?: unknown[]) => ({
        executor: 'nx:run-commands',
        continuous: true,
        ...(dependsOn ? { dependsOn } : {}),
      });
      builder.addNode({
        name: 'shared',
        type: 'lib',
        data: { root: 'libs/shared', targets: { serve: serve() } },
      });
      for (const name of ['left', 'right']) {
        builder.addNode({
          name,
          type: 'lib',
          data: {
            root: `libs/${name}`,
            targets: {
              serve: serve([{ projects: 'shared', target: 'serve' }]),
            },
          },
        });
      }
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          targets: {
            test: {
              executor: 'nx:run-commands',
              inputs: ['{projectRoot}/**/*'],
              dependsOn: [
                { projects: 'left', target: 'serve' },
                { projects: 'right', target: 'serve' },
              ],
            },
          },
        },
      });
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['parent'],
        ['test'],
        undefined,
        {}
      );
      const planner = new HashPlanner(
        {} as any,
        transferProjectGraph(transformProjectGraphForRust(projectGraph))
      );

      const plan = planner.getPlans(['parent:test'], taskGraph)['parent:test'];
      for (const name of ['left', 'right', 'shared']) {
        expect(
          plan.filter((entry) => entry === `${name}:libs/${name}/**/*`)
        ).toHaveLength(1);
      }
    });
  });
  describe('io snapshots', () => {
    function fixture(opts: { cyclic?: boolean } = {}) {
      const builder = new ProjectGraphBuilder(undefined, {
        parent: [
          { file: 'libs/parent/filea.ts', hash: 'a.hash' },
          { file: 'libs/parent/package.json', hash: 'p.hash' },
        ],
        child: [{ file: 'libs/child/fileb.ts', hash: 'b.hash' }],
      });
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          targets: {
            build: {
              executor: 'nx:run-commands',
              inputs: [
                'prod',
                '^prod',
                { env: 'TESTENV' },
                { runtime: 'echo runtime123' },
                { json: '{projectRoot}/package.json', fields: ['version'] },
                { fileset: '{projectRoot}/generated', includeIgnored: true },
              ],
              outputs: ['{workspaceRoot}/dist/libs/parent'],
            },
          },
        },
      });
      builder.addNode({
        name: 'child',
        type: 'lib',
        data: {
          root: 'libs/child',
          // The child's own negation must scope to the child's reads.
          namedInputs: { prod: ['default', '!{workspaceRoot}/**/*.md'] },
          targets: {
            build: {
              executor: 'nx:run-commands',
              outputs: ['{workspaceRoot}/dist/libs/child'],
            },
          },
        },
      });
      builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');
      if (opts.cyclic) {
        builder.addStaticDependency('child', 'parent', 'libs/child/fileb.ts');
      }
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        { build: ['^build'] },
        ['parent'],
        ['build'],
        undefined,
        {}
      );
      const nxJson = {
        namedInputs: { prod: ['default', '!{projectRoot}/**/*.spec.ts'] },
      } as any;
      const planner = new HashPlanner(
        nxJson,
        transferProjectGraph(transformProjectGraphForRust(projectGraph))
      );
      return { planner, taskGraph, projectGraph };
    }

    /** The task graph a continuous dependency produces, e.g. an e2e on a serve. */
    function withContinuousDependency(taskGraph: any) {
      return {
        ...taskGraph,
        continuousDependencies: { 'parent:build': ['child:build'] },
      };
    }

    const snapshotDbDir = join(
      tmpdir(),
      `nx-planner-io-snapshots-${process.pid}-${Date.now()}`
    );
    const snapshotDb = connectToNxDb(snapshotDbDir, 'io-snapshots');
    afterAll(() => {
      closeDbConnection(snapshotDb);
      rmSync(snapshotDbDir, { recursive: true, force: true });
    });
    let bundleCount = 0;
    /** Stores a set with the given entries and loads it as the daemon would. */
    function snapshotsFor(
      entries: Record<
        string,
        {
          inputs?: string[];
          taskOutputs?: Record<string, string[]>;
          outputs?: string[];
        }
      >
    ) {
      const commit = `c${bundleCount++}`.padEnd(40, 'c');
      new IoSnapshotStore(snapshotDb).import({
        requestedCommit: commit,
        commits: [commit],
        clientVersion: 'nx/test',
        snapshotsJson: JSON.stringify(
          Object.fromEntries(
            Object.entries(entries).map(([id, e]) => [
              id,
              {
                commit,
                inputs: e.inputs ?? [],
                taskOutputs: e.taskOutputs,
                outputs: e.outputs ?? [],
              },
            ])
          )
        ),
      });
      return new IoSnapshotStore(snapshotDb).get(commit);
    }

    const PARENT_NEG = '!libs/parent/**/*.spec.ts';
    const CHILD_NEG = '!**/*.md';

    it('leaves plans byte-identical when no task has a snapshot', () => {
      const { planner, taskGraph } = fixture();
      const plain = planner.getPlans(['parent:build'], taskGraph);
      expect(plain['parent:build']).toEqual(
        expect.arrayContaining([
          'parent:libs/parent/**/*,!libs/parent/**/*.spec.ts',
          'child:libs/child/**/*',
          'workspace:[!{workspaceRoot}/**/*.md]',
          'parent:TsConfig',
          'parent:json:libs/parent/package.json[version]',
          'files:[libs/parent/generated]',
        ])
      );
      expect(
        planner.getPlans(['parent:build'], taskGraph, snapshotsFor({}))
      ).toEqual(plain);
      expect(
        planner.getPlans(
          ['parent:build'],
          taskGraph,
          snapshotsFor({ 'child:build': {} })
        )['parent:build']
      ).toEqual(plain['parent:build']);
      expect(plain['parent:build']).not.toContainEqual(
        expect.stringMatching(/^io-snapshot:/)
      );
    });

    it("marks a task with the digest of its own writes, so another task's snapshot does not move it", () => {
      const { planner, taskGraph } = fixture();
      const planFor = (snapshots: ReturnType<typeof snapshotsFor>) =>
        planner.getPlans(['parent:build'], taskGraph, snapshots)[
          'parent:build'
        ];
      const marker = (snapshots: ReturnType<typeof snapshotsFor>) =>
        planFor(snapshots).find((i) => i.startsWith('io-snapshot:'));
      const base = {
        'parent:build': {
          inputs: ['libs/parent/filea.ts'],
          outputs: ['dist/parent/a.js'],
        },
        'child:build': { inputs: ['libs/child/fileb.ts'] },
      };
      const same = marker(snapshotsFor(base));
      const childChanged = marker(
        snapshotsFor({
          ...base,
          'child:build': { inputs: ['libs/child/other.ts'] },
        })
      );
      const parentWroteMore = marker(
        snapshotsFor({
          ...base,
          'parent:build': {
            ...base['parent:build'],
            outputs: ['dist/parent/a.js', 'dist/parent/b.js'],
          },
        })
      );
      const parentReadOther = snapshotsFor({
        ...base,
        'parent:build': {
          ...base['parent:build'],
          inputs: ['libs/parent/other.ts'],
        },
      });

      expect(same).toMatch(/^io-snapshot:[0-9a-f]{64}$/);
      expect(childChanged).toBe(same);
      expect(parentWroteMore).not.toBe(same);
      // The reads are hashed as the file group they become, so they move the
      // plan without moving the digest — hashing them here too would make a
      // read the plan drops, or one naming a missing file, move the key.
      expect(marker(parentReadOther)).toBe(same);
      expect(planFor(parentReadOther)).not.toEqual(planFor(snapshotsFor(base)));
    });

    it("keeps a continuous dependency's inputs in the task it serves", () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(
        ['parent:build'],
        withContinuousDependency(taskGraph),
        snapshotsFor({ 'parent:build': { inputs: ['libs/parent/filea.ts'] } })
      )['parent:build'];

      // The task keeps its own snapshot precision and additionally hashes what
      // the dependency serving it reads, which no trace of this task can see.
      expect(plan).toContainEqual(expect.stringMatching(/^io-snapshot:/));
      expect(plan).toContain('child:libs/child/**/*');
    });

    it('replaces declared filesets (self and dependency) with one files group per owning project, each with its own negations', () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(
        ['parent:build'],
        taskGraph,
        snapshotsFor({
          'parent:build': {
            inputs: [
              'docs/readme.md',
              'libs/child/src/index.ts',
              'libs/parent/src/**/*.ts',
            ],
          },
        })
      )['parent:build'];
      expect(plan).toEqual(
        expect.arrayContaining([
          `files:[libs/child/src/index.ts,${CHILD_NEG}]`,
          // Reads under no project root belong to the task's own project, so
          // the dependency's !**/*.md never suppresses docs/readme.md.
          `files:[docs/readme.md,libs/parent/src/**/*.ts,${PARENT_NEG}]`,
          // A declared includeIgnored input hashes from disk regardless; it survives.
          'files:[libs/parent/generated]',
          'parent:ProjectConfiguration',
          'child:ProjectConfiguration',
          'env:TESTENV',
          'runtime:echo runtime123',
          'env:NX_CLOUD_ENCRYPTION_KEY',
          'workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]',
          'AllExternalDependencies',
          expect.stringMatching(/^io-snapshot:[0-9a-f]{64}$/),
        ])
      );
      expect(plan).not.toContainEqual(
        expect.stringMatching(/^(parent|child):libs\//)
      );
      expect(plan).not.toContain('parent:TsConfig');
      expect(plan).not.toContain('child:TsConfig');
      expect(plan).not.toContain(
        'parent:json:libs/parent/package.json[version]'
      );
    });

    it('keeps TsConfig and JsonFileSet only when the trace read those files', () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(
        ['parent:build'],
        taskGraph,
        snapshotsFor({
          'parent:build': {
            inputs: ['libs/parent/package.json', 'tsconfig.base.json'],
          },
        })
      )['parent:build'];
      expect(plan).toEqual(
        expect.arrayContaining([
          'parent:TsConfig',
          'child:TsConfig',
          'parent:json:libs/parent/package.json[version]',
          // Both files are hashed whole too: the native instructions cover
          // only selected fields and a stripped tsconfig.
          `files:[libs/parent/package.json,tsconfig.base.json,${PARENT_NEG}]`,
        ])
      );
    });

    it('drops reads that externals cover and keeps the rest, including the root package.json', () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(
        ['parent:build'],
        taskGraph,
        snapshotsFor({
          'parent:build': {
            inputs: [
              'node_modules/foo/index.js',
              'package.json',
              'tools/x.ts',
              'yarn.lock',
            ],
          },
        })
      )['parent:build'];
      // package.json stays: externals hash resolved versions, not its scripts.
      expect(plan).toContain(`files:[package.json,tools/x.ts,${PARENT_NEG}]`);
      expect(plan).toContain('AllExternalDependencies');
      expect(plan).not.toContainEqual(
        expect.stringMatching(/node_modules|yarn\.lock/)
      );
    });

    it("hashes reads of a producer task's outputs from disk and defers the task", () => {
      const { planner, taskGraph } = fixture();
      const snapshots = snapshotsFor({
        'parent:build': {
          inputs: ['dist/libs/child/index.js'],
          taskOutputs: { 'child:build': ['dist/libs/child/index.js'] },
        },
      });
      const plan = planner.getPlans(['parent:build'], taskGraph, snapshots)[
        'parent:build'
      ];
      expect(plan).toContain(`files:[dist/libs/child/index.js,${PARENT_NEG}]`);
      expect(plan).not.toContainEqual(
        expect.stringMatching(/^dist\/libs\/child\/index\.js:/)
      );
      expect(getIoSnapshotDeferredTaskIds(snapshots, taskGraph)).toEqual([
        'parent:build',
      ]);
    });

    it('reports eligibility the same way it plans', () => {
      const { planner, taskGraph } = fixture();
      const withProducer = snapshotsFor({
        'parent:build': {
          inputs: ['dist/x'],
          taskOutputs: { 'gone:build': ['dist/x'] },
        },
      });
      const report = getIoSnapshotReport(withProducer, taskGraph, {
        customHasherTaskIds: ['child:build'],
      });
      expect(report.used).toEqual([]);
      expect(report.diagnostics.map((d) => [d.reason, d.taskId])).toEqual([
        ['custom-hasher', 'child:build'],
        ['producer-not-in-graph', 'parent:build'],
      ]);
      expect(report.resolution.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(getIoSnapshotDeferredTaskIds(withProducer, taskGraph)).toEqual([]);

      const plain = planner.getPlans(['parent:build'], taskGraph);
      expect(
        planner.getPlans(['parent:build'], taskGraph, withProducer, [
          'child:build',
        ])
      ).toEqual(plain);
    });

    it('withholds the snapshot from a task that opted out', () => {
      const { planner, taskGraph } = fixture();
      const snapshots = snapshotsFor({
        'parent:build': { inputs: ['libs/parent/filea.ts'] },
      });
      const plain = planner.getPlans(['parent:build'], taskGraph);
      expect(
        planner.getPlans(
          ['parent:build'],
          taskGraph,
          snapshots,
          [],
          ['parent:build']
        )
      ).toEqual(plain);
      expect(
        getIoSnapshotReport(snapshots, taskGraph, {
          optedOutTaskIds: ['parent:build'],
        }).diagnostics
      ).toContainEqual(
        expect.objectContaining({ reason: 'disabled', taskId: 'parent:build' })
      );
    });

    it('falls back to the native plan for a root-anchored snapshot glob instead of throwing', () => {
      const { planner, taskGraph } = fixture();
      const plain = planner.getPlans(['parent:build'], taskGraph);
      const snapshots = snapshotsFor({
        'parent:build': { inputs: ['**/*.gen', 'libs/parent/a.ts'] },
      });
      expect(planner.getPlans(['parent:build'], taskGraph, snapshots)).toEqual(
        plain
      );
      expect(
        getIoSnapshotReport(snapshots, taskGraph).diagnostics.find(
          (d) => d.taskId === 'parent:build'
        )
      ).toMatchObject({ reason: 'root-anchored-glob', glob: '**/*.gen' });
    });

    it('hashes a task that read nothing from native instructions plus the marker', () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(
        ['parent:build'],
        taskGraph,
        snapshotsFor({ 'parent:build': {} })
      )['parent:build'];
      expect(plan).toEqual(
        expect.arrayContaining([
          'parent:ProjectConfiguration',
          'child:ProjectConfiguration',
          'env:TESTENV',
          'runtime:echo runtime123',
          'files:[libs/parent/generated]',
          expect.stringMatching(/^io-snapshot:[0-9a-f]{64}$/),
        ])
      );
      expect(plan).not.toContainEqual(
        expect.stringMatching(/^(parent|child):libs\//)
      );
      expect(plan).not.toContainEqual(expect.stringMatching(/TsConfig$/));
      expect(plan.filter((i) => i.startsWith('files:'))).toEqual([
        'files:[libs/parent/generated]',
      ]);
    });

    it('applies dependency negations on cyclic graphs too (non-memo traversal)', () => {
      const { planner, taskGraph } = fixture({ cyclic: true });
      const plan = planner.getPlans(
        ['parent:build'],
        taskGraph,
        snapshotsFor({
          'parent:build': { inputs: ['libs/child/src/index.ts'] },
        })
      )['parent:build'];
      expect(plan).toContain(`files:[libs/child/src/index.ts,${CHILD_NEG}]`);
      expect(plan).not.toContainEqual(expect.stringMatching(/^child:libs\//));
    });

    it("defers a task whose reads sit under a producer's declared outputs even without taskOutputs", () => {
      const { planner, taskGraph } = fixture();
      const snapshots = snapshotsFor({
        'parent:build': { inputs: ['dist/libs/child/index.js'] },
      });
      expect(getIoSnapshotDeferredTaskIds(snapshots, taskGraph)).toEqual([
        'parent:build',
      ]);
      expect(getIoSnapshotReport(snapshots, taskGraph).used).toEqual([
        'parent:build',
      ]);
    });

    it('refuses snapshot globs that leave the workspace and plans natively', () => {
      const { planner, taskGraph } = fixture();
      const plain = planner.getPlans(['parent:build'], taskGraph);
      for (const glob of ['../secret.txt', 'libs/../../x', '/etc/passwd']) {
        const snapshots = snapshotsFor({
          'parent:build': { inputs: ['libs/parent/a.ts', glob] },
        });
        expect(
          planner.getPlans(['parent:build'], taskGraph, snapshots)
        ).toEqual(plain);
        expect(
          getIoSnapshotReport(snapshots, taskGraph).diagnostics.find(
            (d) => d.taskId === 'parent:build'
          )
        ).toMatchObject({ reason: 'escapes-workspace', glob });
      }
    });

    function lonelyParent(inputs: { fileset: string; includeIgnored: true }[]) {
      const builder = new ProjectGraphBuilder(undefined, {
        parent: [{ file: 'libs/parent/filea.ts', hash: 'a.hash' }],
      });
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          targets: { build: { executor: 'nx:run-commands', inputs } },
        },
      });
      const projectGraph = builder.getUpdatedProjectGraph();
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['parent'],
        ['build'],
        undefined,
        {}
      );
      const planner = new HashPlanner(
        {} as any,
        transferProjectGraph(transformProjectGraphForRust(projectGraph))
      );
      const snapshots = snapshotsFor({
        'parent:build': { inputs: ['libs/parent/filea.ts'] },
      });
      return { planner, taskGraph, snapshots };
    }

    it('withholds the snapshot when a declared includeIgnored group is invalid, so the native error still fires', () => {
      // A well-formed negation with nothing to filter: the group, not the
      // entry, is the native error the snapshot must not hide.
      const { planner, taskGraph, snapshots } = lonelyParent([
        { fileset: '!{projectRoot}/dist/**/*.map', includeIgnored: true },
      ]);
      expect(() =>
        planner.getPlans(['parent:build'], taskGraph, snapshots)
      ).toThrow(/no positive includeIgnored fileset/);
    });

    it('keeps the snapshot when a declared includeIgnored negation has a positive fileset to filter', () => {
      const { planner, taskGraph, snapshots } = lonelyParent([
        { fileset: '{projectRoot}/dist/**', includeIgnored: true },
        { fileset: '!{projectRoot}/dist/**/*.map', includeIgnored: true },
      ]);
      const plan = planner.getPlans(['parent:build'], taskGraph, snapshots)[
        'parent:build'
      ];
      expect(plan).toEqual(
        expect.arrayContaining([
          'files:[libs/parent/dist/**,!libs/parent/dist/**/*.map]',
          expect.stringMatching(/^io-snapshot:[0-9a-f]{64}$/),
        ])
      );
    });
  });
});
