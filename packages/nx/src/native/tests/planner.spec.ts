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

  describe('io snapshot overrides', () => {
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
      return { planner, taskGraph };
    }

    const base = {
      projects: {},
      workspace: [],
      taskOutputs: {},
      digest: 'abc123',
    };

    it('leaves plans byte-identical when no task has an override', () => {
      const { planner, taskGraph } = fixture();
      const plain = planner.getPlans(['parent:build'], taskGraph);
      expect(plain['parent:build']).toEqual(
        expect.arrayContaining([
          'parent:libs/parent/**/*,!libs/parent/**/*.spec.ts',
          'child:libs/child/**/*,!libs/child/**/*.spec.ts',
          'parent:TsConfig',
          'parent:json:libs/parent/package.json[version]',
        ])
      );
      expect(planner.getPlans(['parent:build'], taskGraph, {})).toEqual(plain);
      expect(
        planner.getPlans(['parent:build'], taskGraph, { 'child:build': base })[
          'parent:build'
        ]
      ).toEqual(plain['parent:build']);
      expect(plain['parent:build']).not.toContainEqual(
        expect.stringMatching(/^io-snapshot:/)
      );
    });

    it('replaces declared filesets (self and dependency) with observed reads and keeps negations', () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(['parent:build'], taskGraph, {
        'parent:build': {
          ...base,
          projects: {
            parent: ['libs/parent/src/**/*.ts'],
            child: ['libs/child/src/index.ts'],
          },
        },
      })['parent:build'];
      expect(plan).toEqual(
        expect.arrayContaining([
          'parent:libs/parent/src/**/*.ts,!libs/parent/**/*.spec.ts',
          'child:libs/child/src/index.ts,!libs/child/**/*.spec.ts',
          'parent:ProjectConfiguration',
          'child:ProjectConfiguration',
          'env:TESTENV',
          'runtime:echo runtime123',
          'env:NX_CLOUD_ENCRYPTION_KEY',
          'workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]',
          'AllExternalDependencies',
          'io-snapshot:abc123',
        ])
      );
      // Declared filesets are gone; unread class-mapped files are not emitted.
      expect(plan).not.toContain(
        'parent:libs/parent/**/*,!libs/parent/**/*.spec.ts'
      );
      expect(plan).not.toContain(
        'child:libs/child/**/*,!libs/child/**/*.spec.ts'
      );
      expect(plan).not.toContain('parent:TsConfig');
      expect(plan).not.toContain('child:TsConfig');
      expect(plan).not.toContain(
        'parent:json:libs/parent/package.json[version]'
      );
    });

    it('keeps TsConfig and JsonFileSet only when the trace read those files', () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(['parent:build'], taskGraph, {
        'parent:build': {
          ...base,
          projects: { parent: ['libs/parent/package.json'] },
          workspace: ['tsconfig.base.json'],
        },
      })['parent:build'];
      expect(plan).toEqual(
        expect.arrayContaining([
          'parent:TsConfig',
          'child:TsConfig',
          'parent:json:libs/parent/package.json[version]',
        ])
      );
      // The raw reads are covered by those instructions, so no fileset remains.
      expect(plan).not.toContainEqual(expect.stringMatching(/^parent:libs\//));
      expect(plan).not.toContainEqual(
        expect.stringMatching(/^workspace:\[tsconfig/)
      );
    });

    it('drops workspace reads that externals cover and applies the task negations', () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(['parent:build'], taskGraph, {
        'parent:build': {
          ...base,
          workspace: [
            'node_modules/foo/index.js',
            'package.json',
            'yarn.lock',
            'tools/x.ts',
          ],
        },
      })['parent:build'];
      expect(plan).toContain(
        'workspace:[tools/x.ts,!libs/parent/**/*.spec.ts]'
      );
      expect(plan).toContain('AllExternalDependencies');
      expect(plan).not.toContainEqual(
        expect.stringMatching(/node_modules|yarn\.lock/)
      );
    });

    it("hashes reads inside a producer task's outputs through TaskOutput", () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(['parent:build'], taskGraph, {
        'parent:build': {
          ...base,
          taskOutputs: {
            'child:build': ['dist/libs/child/index.js', 'dist/libs/child/a.js'],
          },
        },
      })['parent:build'];
      // One instruction per producer: plain paths collapse into a brace group.
      expect(plan).toContain(
        '{dist/libs/child/a.js,dist/libs/child/index.js}:dist/libs/child'
      );
    });

    it('hashes a task that read nothing from native instructions plus the marker', () => {
      const { planner, taskGraph } = fixture();
      const plan = planner.getPlans(['parent:build'], taskGraph, {
        'parent:build': base,
      })['parent:build'];
      expect(plan).toEqual(
        expect.arrayContaining([
          'parent:ProjectConfiguration',
          'child:ProjectConfiguration',
          'env:TESTENV',
          'runtime:echo runtime123',
          'io-snapshot:abc123',
        ])
      );
      expect(plan).not.toContainEqual(
        expect.stringMatching(/^(parent|child):libs\//)
      );
      expect(plan).not.toContainEqual(expect.stringMatching(/TsConfig$/));
    });

    it('applies dependency negations on cyclic graphs too (non-memo traversal)', () => {
      const { planner, taskGraph } = fixture({ cyclic: true });
      const plan = planner.getPlans(['parent:build'], taskGraph, {
        'parent:build': {
          ...base,
          projects: { child: ['libs/child/src/index.ts'] },
        },
      })['parent:build'];
      expect(plan).toContain(
        'child:libs/child/src/index.ts,!libs/child/**/*.spec.ts'
      );
      expect(plan).not.toContain(
        'child:libs/child/**/*,!libs/child/**/*.spec.ts'
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
});
