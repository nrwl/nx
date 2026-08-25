import { TempFs } from '../../internal-testing-utils/temp-fs';
import {
  HashPlanner,
  ioSnapshotDeferredTaskIds,
  loadIoSnapshots,
  transferProjectGraph,
} from '../index';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
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

  describe('files inputs', () => {
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

    it('plans one files instruction per group with tokens resolved', () => {
      const plan = planFor([
        'default',
        {
          files: ['{projectRoot}/dist/**/*.js', '!{projectRoot}/dist/**/*.map'],
        },
        { files: ['{workspaceRoot}/.env.generated'] },
      ]);

      expect(plan).toContain(
        'files:[libs/parent/dist/**/*.js,!libs/parent/dist/**/*.map]'
      );
      expect(plan).toContain('files:[.env.generated]');
    });

    it('plans a files input declared through a named input', () => {
      const plan = planFor(['generated'], {
        generated: [{ files: ['{projectRoot}/generated'] }],
      });

      expect(plan).toContain('files:[libs/parent/generated]');
    });

    it('rejects a files glob without a leading directory', () => {
      expect(() => planFor([{ files: ['**/*.gen'] }])).toThrow(
        /no leading directory/
      );
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
                { files: ['{projectRoot}/generated'] },
              ],
              outputs: ['{workspaceRoot}/dist/libs/parent'],
            },
            lint: { executor: 'nx:run-commands', ioSnapshots: false },
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

    let bundleCount = 0;
    /** Writes a bundle with the given entries and loads it as the run would. */
    function snapshotsFor(
      entries: Record<
        string,
        { inputs?: string[]; taskOutputs?: Record<string, string[]> }
      >
    ) {
      const dir = join(tempFs.tempDir, 'io-snapshots', `b${bundleCount++}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'snapshots.json'),
        JSON.stringify({
          version: 1,
          resolution: {
            requestedCommit: 'c'.repeat(40),
            commits: [],
            sourceCommits: [],
            digest: 'abc123',
            fetchedAt: 1,
            clientVersion: 'nx/test',
            tasks: Object.keys(entries).length,
          },
          snapshots: Object.fromEntries(
            Object.entries(entries).map(([id, e]) => [
              id,
              {
                commit: 'c'.repeat(40),
                inputs: e.inputs ?? [],
                taskOutputs: e.taskOutputs,
                outputs: [],
              },
            ])
          ),
        })
      );
      return loadIoSnapshots(dir);
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
          // A declared { files } input is not a fileset; it survives.
          'files:[libs/parent/generated]',
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
        ])
      );
      expect(plan).not.toContainEqual(
        expect.stringMatching(/^files:\[(?!libs\/parent\/generated\])/)
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
      expect(ioSnapshotDeferredTaskIds(snapshots, taskGraph)).toEqual([
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
      const report = planner.ioSnapshotReport(taskGraph, withProducer, [
        'child:build',
      ]);
      expect(report.used).toEqual([]);
      expect(report.diagnostics.map((d) => [d.reason, d.taskId])).toEqual([
        ['custom-hasher', 'child:build'],
        ['producer-not-in-graph', 'parent:build'],
      ]);
      expect(report.resolution.digest).toBe('abc123');
      expect(ioSnapshotDeferredTaskIds(withProducer, taskGraph)).toEqual([]);

      const plain = planner.getPlans(['parent:build'], taskGraph);
      expect(
        planner.getPlans(['parent:build'], taskGraph, withProducer)
      ).toEqual(plain);
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
        planner
          .ioSnapshotReport(taskGraph, snapshots)
          .diagnostics.find((d) => d.taskId === 'parent:build')
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
          'io-snapshot:abc123',
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
      expect(ioSnapshotDeferredTaskIds(snapshots, taskGraph)).toEqual([
        'parent:build',
      ]);
      expect(planner.ioSnapshotReport(taskGraph, snapshots).used).toEqual([
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
          planner
            .ioSnapshotReport(taskGraph, snapshots)
            .diagnostics.find((d) => d.taskId === 'parent:build')
        ).toMatchObject({ reason: 'escapes-workspace', glob });
      }
    });

    it('withholds the snapshot when a declared files glob is invalid, so the native error still fires', () => {
      const builder = new ProjectGraphBuilder(undefined, {
        parent: [{ file: 'libs/parent/filea.ts', hash: 'a.hash' }],
      });
      builder.addNode({
        name: 'parent',
        type: 'lib',
        data: {
          root: 'libs/parent',
          targets: {
            build: {
              executor: 'nx:run-commands',
              inputs: [{ files: ['**/*.gen'] }],
            },
          },
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
      expect(
        planner.ioSnapshotReport(taskGraph, snapshots).diagnostics
      ).toEqual([
        expect.objectContaining({
          reason: 'invalid-files-input',
          taskId: 'parent:build',
        }),
      ]);
      expect(() =>
        planner.getPlans(['parent:build'], taskGraph, snapshots)
      ).toThrow(/no leading directory/);
    });

    it('reports a bundle-level failure once and plans natively', () => {
      const { planner, taskGraph } = fixture();
      const missing = loadIoSnapshots(join(tempFs.tempDir, 'nope'));
      expect(missing.status).toBe('skipped');
      expect(missing.reason).toBe('no-bundle');
      const report = planner.ioSnapshotReport(taskGraph, missing);
      expect(report.used).toEqual([]);
      expect(report.diagnostics).toEqual([
        expect.objectContaining({ reason: 'no-bundle' }),
      ]);
      expect(planner.getPlans(['parent:build'], taskGraph, missing)).toEqual(
        planner.getPlans(['parent:build'], taskGraph)
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
