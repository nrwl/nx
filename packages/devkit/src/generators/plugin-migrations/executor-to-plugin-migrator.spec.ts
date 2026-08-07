import type { TargetDefaults } from 'nx/src/devkit-exports';
import { readNxJson, readJson, updateNxJson } from 'nx/src/devkit-exports';
import { mergeTargetConfigurations } from 'nx/src/devkit-internals';
import {
  collectMigrationScope,
  computeResidualByProject,
  computeStrictCommon,
  inferOncePerOptionSet,
  migrateProjectExecutorsToPlugin,
  readTargetDefaultsForExecutor,
} from './executor-to-plugin-migrator';
import {
  addExecutorProject,
  createSyntheticPlugin,
  defaultInferredTarget,
  setupFixture,
  teardownFixture,
  SYNTHETIC_CONFIG_FILE,
  SYNTHETIC_EXECUTOR,
  SYNTHETIC_PLUGIN_PATH,
  type FixtureContext,
  type SyntheticPluginOptions,
} from './executor-to-plugin-migrator.test-utils';
import type { ExpandedPluginConfiguration } from 'nx/src/devkit-exports';

function uniformExecutorTarget() {
  return {
    options: { config: SYNTHETIC_CONFIG_FILE, mode: 'production' },
    cache: true,
    outputs: ['{projectRoot}/dist'],
  };
}

function syntheticMigrations() {
  return [
    {
      executors: [SYNTHETIC_EXECUTOR],
      targetPluginOptionMapper: (targetName: string) => ({ targetName }),
      postTargetTransformer: (target: any) => {
        if (target.options) {
          delete target.options.config;
          if (Object.keys(target.options).length === 0) {
            delete target.options;
          }
        }
        return target;
      },
    },
  ];
}

describe('readTargetDefaultsForExecutor', () => {
  it('reads the exact executor-keyed default from legacy record-shaped targetDefaults', () => {
    const targetDefaults: TargetDefaults = {
      '@nx/example:build': {
        cache: true,
        dependsOn: ['^build'],
      },
      build: {
        executor: '@nx/example:build',
        cache: false,
      },
    };

    expect(
      readTargetDefaultsForExecutor('@nx/example:build', targetDefaults)
    ).toEqual({
      cache: true,
      dependsOn: ['^build'],
    });
  });

  it('reads the unfiltered executor entry from an executor-keyed default', () => {
    const targetDefaults: TargetDefaults = {
      '@nx/example:test': {
        inputs: ['default', '^default'],
      },
    };

    expect(
      readTargetDefaultsForExecutor('@nx/example:test', targetDefaults)
    ).toEqual({
      inputs: ['default', '^default'],
    });
  });

  it('does not broaden to target-scoped or filtered entries', () => {
    const targetDefaults: TargetDefaults = {
      build: [
        {
          filter: { executor: '@nx/example:build' },
          cache: false,
        },
      ],
      '@nx/example:build': [
        {
          filter: { projects: ['app'] },
          cache: true,
        },
      ],
    };

    expect(
      readTargetDefaultsForExecutor('@nx/example:build', targetDefaults)
    ).toBeUndefined();
  });
});

describe('whole-workspace inference passes', () => {
  let ctx: FixtureContext;

  afterEach(() => {
    if (ctx) {
      teardownFixture(ctx.fs);
      ctx = undefined;
    }
  });

  async function migrateUniformFixture(projectCount: number) {
    ctx = setupFixture(`inference-count-${projectCount}`);
    const plugin = createSyntheticPlugin();

    for (let i = 0; i < projectCount; i++) {
      const name = `app${i}`;
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    return plugin.inferenceCount();
  }

  // The engine runs one whole-workspace inference per distinct plugin-option
  // set (Phase 1) plus one verification pass per registration group (Phase 4).
  // A uniform fixture has one option set and one registration group, so
  // `1 + 1 = 2` — independent of the number of projects either way.
  const EXPECTED_UNIFORM_PASSES =
    1 /* distinctOptionSets */ + 1; /* verify (per registration group) */

  it('runs distinctOptionSets + 1 passes for a 3-project fixture', async () => {
    const passes = await migrateUniformFixture(3);
    expect(passes).toBe(EXPECTED_UNIFORM_PASSES);
  });

  it('does not grow with project count (constant passes)', async () => {
    const passes = await migrateUniformFixture(5);
    expect(passes).toBe(EXPECTED_UNIFORM_PASSES);
  });

  it('is identical for 3 and 20 projects (O(1) in project count)', async () => {
    const passesFor3 = await migrateUniformFixture(3);
    // teardown between runs
    teardownFixture(ctx.fs);
    ctx = undefined;
    const passesFor20 = await migrateUniformFixture(20);
    expect(passesFor3).toBe(EXPECTED_UNIFORM_PASSES);
    expect(passesFor20).toBe(EXPECTED_UNIFORM_PASSES);
  });
});

describe('collectMigrationScope (Phase 0)', () => {
  let ctx: FixtureContext;

  afterEach(() => {
    if (ctx) {
      teardownFixture(ctx.fs);
      ctx = undefined;
    }
  });

  it('collects targets, per-project plugin options and distinct option sets', () => {
    ctx = setupFixture('collect-scope');
    // 2 projects share target name `test`, 1 uses a custom target name `check`
    addExecutorProject(ctx, { name: 'app1', root: 'app1', targetName: 'test' });
    addExecutorProject(ctx, { name: 'app2', root: 'app2', targetName: 'test' });
    addExecutorProject(ctx, {
      name: 'app3',
      root: 'app3',
      targetName: 'check',
    });

    const scope = collectMigrationScope(
      ctx.tree,
      ctx.projectGraph,
      [
        {
          executors: [SYNTHETIC_EXECUTOR],
          targetPluginOptionMapper: (targetName: string) => ({ targetName }),
          postTargetTransformer: (t: any) => t,
        },
      ],
      { targetName: 'build', extra: true },
      undefined,
      undefined
    );

    // targetsToMigrate: target -> set of projects
    expect([...scope.targetsToMigrate.keys()].sort()).toEqual([
      'check',
      'test',
    ]);
    expect([...scope.targetsToMigrate.get('test')].sort()).toEqual([
      'app1',
      'app2',
    ]);
    expect([...scope.targetsToMigrate.get('check')]).toEqual(['app3']);

    // pluginOptionsByProject: defaults merged with per-target mapper output
    expect(scope.pluginOptionsByProject.get('app1')).toEqual({
      targetName: 'test',
      extra: true,
    });
    expect(scope.pluginOptionsByProject.get('app2')).toEqual({
      targetName: 'test',
      extra: true,
    });
    expect(scope.pluginOptionsByProject.get('app3')).toEqual({
      targetName: 'check',
      extra: true,
    });

    // distinct inference option sets (mapper output, no defaults): one per
    // distinct target-name mapping
    expect(scope.distinctOptionSets).toHaveLength(2);
    expect(scope.distinctOptionSets).toContainEqual({ targetName: 'test' });
    expect(scope.distinctOptionSets).toContainEqual({ targetName: 'check' });
  });

  it('collapses distinct option sets to one when every project shares a target name', () => {
    ctx = setupFixture('collect-scope-uniform');
    addExecutorProject(ctx, {
      name: 'app1',
      root: 'app1',
      targetName: 'build',
    });
    addExecutorProject(ctx, {
      name: 'app2',
      root: 'app2',
      targetName: 'build',
    });
    addExecutorProject(ctx, {
      name: 'app3',
      root: 'app3',
      targetName: 'build',
    });

    const scope = collectMigrationScope(
      ctx.tree,
      ctx.projectGraph,
      syntheticMigrations(),
      { targetName: 'build' },
      undefined,
      undefined
    );

    expect(scope.distinctOptionSets).toHaveLength(1);
    expect(scope.distinctOptionSets[0]).toEqual({ targetName: 'build' });
    expect([...scope.targetsToMigrate.get('build')].sort()).toEqual([
      'app1',
      'app2',
      'app3',
    ]);
  });

  it('throws (not warns) when a specific project cannot be migrated', () => {
    ctx = setupFixture('collect-scope-throw');
    addExecutorProject(ctx, {
      name: 'app1',
      root: 'app1',
      targetName: 'build',
    });

    expect(() =>
      collectMigrationScope(
        ctx.tree,
        ctx.projectGraph,
        [
          {
            executors: [SYNTHETIC_EXECUTOR],
            targetPluginOptionMapper: (targetName: string) => ({ targetName }),
            postTargetTransformer: (t: any) => t,
            skipTargetFilter: () => 'nope',
          },
        ],
        { targetName: 'build' },
        'app1',
        undefined
      )
    ).toThrow('The build target on project "app1" cannot be migrated. nope');
  });
});

describe('computeResidualByProject (Phase 2)', () => {
  let ctx: FixtureContext;

  afterEach(() => {
    if (ctx) {
      teardownFixture(ctx.fs);
      ctx = undefined;
    }
  });

  it('captures the residual (byte-for-byte project.json target) and baselineFinal', async () => {
    ctx = setupFixture('residual');
    const plugin = createSyntheticPlugin();
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }

    const scope = collectMigrationScope(
      ctx.tree,
      ctx.projectGraph,
      syntheticMigrations(),
      { targetName: 'build' },
      undefined,
      undefined
    );
    const nxJson = readNxJson(ctx.tree);
    const { inferredTargetsByOptionSet } = await inferOncePerOptionSet(
      ctx.tree,
      plugin.pluginPath,
      plugin.createNodes,
      undefined,
      nxJson,
      scope
    );
    const residualByProject = await computeResidualByProject(
      ctx.tree,
      ctx.projectGraph,
      scope,
      inferredTargetsByOptionSet,
      nxJson
    );
    const inferredByRoot = inferredTargetsByOptionSet.get(
      scope.optionSetGroups[0].id
    )!;

    // residual = only the non-inferred deviation (mode was not inferred; config
    // was deleted by the postTargetTransformer; cache/outputs match inferred).
    for (const name of ['app1', 'app2']) {
      const entry = residualByProject.get(name).get('build');
      expect(entry.residual).toEqual({ options: { mode: 'production' } });

      // baselineFinal = the migrated command-based effective config, i.e. the
      // full inferred target with the residual layered on top.
      const fullInferred = inferredByRoot.get(name).get('build');
      expect(entry.baselineFinal).toEqual(
        mergeTargetConfigurations(
          structuredClone(entry.residual),
          structuredClone(fullInferred)
        )
      );
      // sanity: baselineFinal is the command-based effective config — the
      // inferred run-commands base with the residual's `mode` layered on.
      expect(entry.baselineFinal.executor).toBe('nx:run-commands');
      expect(entry.baselineFinal.options).toEqual({
        cwd: name,
        command: 'acme-build',
        mode: 'production',
      });
    }
  });

  it('keeps inferred targets isolated when option sets infer the same target name', async () => {
    ctx = setupFixture('residual-option-set-isolation');
    const otherExecutor = '@acme/other:build';
    const removeConfigOption = (target: any) => {
      if (target.options) {
        delete target.options.config;
        if (Object.keys(target.options).length === 0) {
          delete target.options;
        }
      }
      return target;
    };
    const plugin = createSyntheticPlugin((root, targetName, options) => ({
      ...defaultInferredTarget(root, targetName),
      command: `acme-build-${options?.variant}`,
      outputs: [`{projectRoot}/dist-${options?.variant}`],
    }));

    addExecutorProject(ctx, {
      name: 'app1',
      root: 'app1',
      targetName: 'build',
      executor: SYNTHETIC_EXECUTOR,
      target: {
        options: { config: SYNTHETIC_CONFIG_FILE },
        cache: true,
        outputs: ['{projectRoot}/dist-primary'],
      },
    });
    addExecutorProject(ctx, {
      name: 'app2',
      root: 'app2',
      targetName: 'build',
      executor: otherExecutor,
      target: {
        options: { config: SYNTHETIC_CONFIG_FILE },
        cache: true,
        outputs: ['{projectRoot}/dist-secondary'],
      },
    });

    const migrations: Array<{
      executors: string[];
      targetPluginOptionMapper: (
        targetName: string
      ) => Partial<SyntheticPluginOptions>;
      postTargetTransformer: (target: any) => any;
    }> = [
      {
        executors: [SYNTHETIC_EXECUTOR],
        targetPluginOptionMapper: (targetName: string) => ({
          targetName,
          variant: 'primary',
        }),
        postTargetTransformer: removeConfigOption,
      },
      {
        executors: [otherExecutor],
        targetPluginOptionMapper: (targetName: string) => ({
          targetName,
          variant: 'secondary',
        }),
        postTargetTransformer: removeConfigOption,
      },
    ];
    const scope = collectMigrationScope<SyntheticPluginOptions>(
      ctx.tree,
      ctx.projectGraph,
      migrations,
      { targetName: 'build' },
      undefined,
      undefined
    );
    expect(scope.optionSetGroups).toHaveLength(2);

    const nxJson = readNxJson(ctx.tree);
    const { inferredTargetsByOptionSet } = await inferOncePerOptionSet(
      ctx.tree,
      plugin.pluginPath,
      plugin.createNodes,
      undefined,
      nxJson,
      scope
    );
    const residualByProject = await computeResidualByProject(
      ctx.tree,
      ctx.projectGraph,
      scope,
      inferredTargetsByOptionSet,
      nxJson
    );

    expect(residualByProject.get('app1').get('build').residual).toEqual({});
    expect(residualByProject.get('app2').get('build').residual).toEqual({});
    expect(
      residualByProject.get('app1').get('build').baselineFinal.options.command
    ).toBe('acme-build-primary');
    expect(
      residualByProject.get('app2').get('build').baselineFinal.options.command
    ).toBe('acme-build-secondary');
  });

  it('residual equals what a single-project migration writes into project.json', async () => {
    // In single-project (`--project`) mode nothing is hoisted, so the full
    // residual stays in project.json — the byte-identical guarantee.
    ctx = setupFixture('residual-write');
    const plugin = createSyntheticPlugin();
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }

    // Compute residual (Phase 2 only) from a snapshot before mutating the tree.
    const scope = collectMigrationScope(
      ctx.tree,
      ctx.projectGraph,
      syntheticMigrations(),
      { targetName: 'build' },
      'app1',
      undefined
    );
    const nxJson = readNxJson(ctx.tree);
    const { inferredTargetsByOptionSet } = await inferOncePerOptionSet(
      ctx.tree,
      plugin.pluginPath,
      plugin.createNodes,
      undefined,
      nxJson,
      scope
    );
    const residualByProject = await computeResidualByProject(
      ctx.tree,
      ctx.projectGraph,
      scope,
      inferredTargetsByOptionSet,
      nxJson
    );
    const expectedResidual = structuredClone(
      residualByProject.get('app1').get('build').residual
    );

    // Now run the real single-project migration end to end and compare.
    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      'app1'
    );

    const projectJson = readJson(ctx.tree, 'app1/project.json');
    expect(projectJson.targets.build).toEqual(expectedResidual);
    // sibling project untouched
    expect(ctx.tree.exists('app2/project.json')).toBe(true);
    const app2 = readJson(ctx.tree, 'app2/project.json');
    expect(app2.targets.build.executor).toBe(SYNTHETIC_EXECUTOR);
    // no hoist in single-project mode: the workspace default is untouched
    // (the empty workspace ships targetDefaults.build = { cache: true }).
    expect(readNxJson(ctx.tree).targetDefaults?.build).toEqual({ cache: true });
  });
});

describe('computeStrictCommon', () => {
  it('keeps only values deep-equal across ALL residuals (per-options-key)', () => {
    const common = computeStrictCommon([
      { options: { mode: 'production', a: 1 }, cache: true },
      { options: { mode: 'production', a: 2 }, cache: true },
      { options: { mode: 'production' }, cache: true },
    ]);
    // `mode` is shared everywhere; `a` differs / is missing; `cache` is shared.
    expect(common).toEqual({ options: { mode: 'production' }, cache: true });
  });

  it('hoists configurations only when deep-equal across ALL residuals (whole-value)', () => {
    expect(
      computeStrictCommon([
        { configurations: { ci: { quiet: true } } },
        { configurations: { ci: { quiet: true } } },
      ])
    ).toEqual({ configurations: { ci: { quiet: true } } });
    // any difference keeps configurations per-project entirely
    expect(
      computeStrictCommon([
        { configurations: { ci: { quiet: true } } },
        { configurations: { ci: { quiet: false } } },
      ])
    ).toEqual({});
  });

  it('does not hoist a top-level prop missing from some residuals', () => {
    const common = computeStrictCommon([
      { outputs: ['{projectRoot}/dist'], cache: true },
      { cache: true },
    ]);
    expect(common).toEqual({ cache: true });
  });
});

describe('Phase 3 — strict-common hoist', () => {
  let ctx: FixtureContext;

  afterEach(() => {
    if (ctx) {
      teardownFixture(ctx.fs);
      ctx = undefined;
    }
  });

  it('A: uniform residual is hoisted to targetDefaults; project targets emptied', async () => {
    ctx = setupFixture('hoist-uniform');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    // the shared residual is hoisted as a plugin-scoped entry appended after
    // the workspace's pre-existing `build: { cache: true }` catch-all, so only
    // this plugin's targets ever receive it.
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    // every project.json target is now empty (pure deviation = {})
    for (const name of ['app1', 'app2', 'app3']) {
      const pj = readJson(ctx.tree, `${name}/project.json`);
      expect(pj.targets.build).toBeUndefined();
    }
  });

  it('B: executor-keyed targetDefault is de-duped into targetDefaults[target]', async () => {
    ctx = setupFixture('hoist-dedup');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, { name, root: name, targetName: 'build' });
    }
    // an executor-keyed default that the previous engine inlined into every
    // project — its non-inferred remainder (`dependsOn`) should hoist once.
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults[SYNTHETIC_EXECUTOR] = { dependsOn: ['^build'] };
    updateNxJson(ctx.tree, nxJson);

    const plugin = createSyntheticPlugin();
    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    const td = readNxJson(ctx.tree).targetDefaults;
    // dead executor-keyed entry removed
    expect(td[SYNTHETIC_EXECUTOR]).toBeUndefined();
    // the remainder stays scoped to this plugin's targets — re-homing an
    // executor-scoped `dependsOn` as an unscoped name key would alter task
    // scheduling for every same-named target in the workspace.
    expect(td.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        dependsOn: ['^build'],
      },
    ]);
    // no project.json duplicates it
    for (const name of ['app1', 'app2', 'app3']) {
      const pj = readJson(ctx.tree, `${name}/project.json`);
      expect(pj.targets.build).toBeUndefined();
    }
  });

  it('C: single-project mode does not hoist and leaves siblings untouched', async () => {
    ctx = setupFixture('hoist-single');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      'app1'
    );

    // no central hoist: the workspace default is untouched
    expect(readNxJson(ctx.tree).targetDefaults?.build).toEqual({ cache: true });
    // migrated project keeps its full residual
    expect(readJson(ctx.tree, 'app1/project.json').targets.build).toEqual({
      options: { mode: 'production' },
    });
    // sibling untouched (still an executor target)
    expect(readJson(ctx.tree, 'app2/project.json').targets.build.executor).toBe(
      SYNTHETIC_EXECUTOR
    );
  });

  it('D: preserves pre-existing target-name default keys the hoist does not touch', async () => {
    ctx = setupFixture('hoist-preserve-existing');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // a user-authored default carrying a key that is neither inferred nor part
    // of any project's residual — it must never be lost or overwritten.
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults.build = { cache: true, options: { verbose: true } };
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // the pre-existing default survives byte-for-byte as the catch-all; the
    // hoisted common is a separate plugin-scoped entry
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true, options: { verbose: true } },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    // centralization still completes: the Phase 1 inference pass merges the
    // pre-existing target-name default into the inferred baseline, so the
    // oracle verifies equivalence without any fallback
    for (const name of ['app1', 'app2']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('E: a conflicting pre-existing target-name default is preserved for bystanders; the plugin-scoped entry wins only for migrated targets', async () => {
    ctx = setupFixture('hoist-conflict');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // the user default conflicts with the strict-common residual on the same
    // options key — every migrated project's own value won over this default
    // pre-migration, and keeps winning post-migration.
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults.build = {
      cache: true,
      options: { mode: 'development' },
    };
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // the user's conflicting default value is never rewritten — any
    // non-migrated target named `build` keeps inheriting `mode: 'development'`.
    // Migrated targets resolve the plugin-scoped entry (document order, last
    // match wins), so they still get `mode: 'production'`.
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true, options: { mode: 'development' } },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    for (const name of ['app1', 'app2']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('F: executor-keyed targetDefault survives while the executor is still in use', async () => {
    ctx = setupFixture('hoist-executor-alive');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, { name, root: name, targetName: 'build' });
    }
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults[SYNTHETIC_EXECUTOR] = { dependsOn: ['^build'] };
    updateNxJson(ctx.tree, nxJson);

    // app3 is skipped, so its target keeps using the executor post-migration
    // (the filter receives the graph node's data, which carries root, not name)
    const migrations = syntheticMigrations();
    (migrations[0] as any).skipProjectFilter = (project: any) =>
      project.root === 'app3' ? 'skipped for this test' : false;
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      migrations
    );

    const td = readNxJson(ctx.tree).targetDefaults;
    // still alive: app3's target uses the executor, so the entry must survive
    expect(td[SYNTHETIC_EXECUTOR]).toEqual({ dependsOn: ['^build'] });
    // the migrated projects' inlined remainder still hoists once, scoped to
    // this plugin's targets (app3's executor-keyed entry wins for app3 anyway)
    expect(td.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        dependsOn: ['^build'],
      },
    ]);
    // app3 was not rewritten
    expect(readJson(ctx.tree, 'app3/project.json').targets.build).toEqual({
      executor: SYNTHETIC_EXECUTOR,
    });
  });

  it('G: array-shaped pre-existing target-name default gains the plugin-scoped entry; existing entries untouched', async () => {
    ctx = setupFixture('hoist-array-existing');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const nxJson = readNxJson(ctx.tree);
    (nxJson.targetDefaults as any).build = [{ cache: true }];
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // existing entries are never modified; the hoist appends after them
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    // centralization completes normally — no fallback churn for the
    // array-shaped case anymore
    for (const name of ['app1', 'app2', 'app3']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('H: a lone migrated project in whole-workspace mode keeps its residual (no hoist)', async () => {
    ctx = setupFixture('hoist-lone-project');
    addExecutorProject(ctx, {
      name: 'app1',
      root: 'app1',
      targetName: 'build',
      target: uniformExecutorTarget(),
    });
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // a single project never hoists (it would leak its config onto future
    // same-named targets); the workspace default is untouched
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    expect(readJson(ctx.tree, 'app1/project.json').targets.build).toEqual({
      options: { mode: 'production' },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('I: a non-migrated project sharing the target name is not rewritten; hoist is exactly the strict common', async () => {
    ctx = setupFixture('hoist-bystander');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // bystander: same target name, different executor — never migrated
    addExecutorProject(ctx, {
      name: 'app3',
      root: 'app3',
      targetName: 'build',
      executor: '@other/tool:build',
      target: { options: { mode: 'development' } },
    });
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    // the bystander's project.json is byte-identical
    expect(readJson(ctx.tree, 'app3/project.json').targets.build).toEqual({
      executor: '@other/tool:build',
      options: { mode: 'development' },
    });
    // the hoist is plugin-scoped, so the only default a same-named
    // non-migrated target can resolve is the untouched catch-all — its
    // effective config cannot change
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
  });

  it('J: sequential migrations sharing a target name stay isolated per plugin', async () => {
    // The `@nx/workspace:infer-targets` flow: plugin A migrates app1/app2,
    // plugin B migrates app3/app4, all on target `build`. Neither plugin's
    // hoisted config may reach the other's projects.
    ctx = setupFixture('hoist-sequential');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const OTHER_EXECUTOR = '@acme/other:build';
    const OTHER_PLUGIN_PATH = '@acme/other/plugin';
    for (const name of ['app3', 'app4']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        executor: OTHER_EXECUTOR,
        target: {
          options: { config: SYNTHETIC_CONFIG_FILE, level: 'high' },
          cache: true,
          outputs: ['{projectRoot}/dist'],
        },
      });
    }
    // each plugin only infers for its own projects' roots
    const pluginA = createSyntheticPlugin((root, targetName) =>
      defaultInferredTarget(root, targetName)
    );
    const pluginB = createSyntheticPlugin(
      (root, targetName) => defaultInferredTarget(root, targetName),
      OTHER_PLUGIN_PATH
    );

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      pluginA.pluginPath,
      pluginA.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );
    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      pluginB.pluginPath,
      pluginB.createNodes,
      { targetName: 'build' },
      [
        {
          executors: [OTHER_EXECUTOR],
          targetPluginOptionMapper: (targetName: string) => ({ targetName }),
          postTargetTransformer: (target: any) => {
            if (target.options) {
              delete target.options.config;
              if (Object.keys(target.options).length === 0) {
                delete target.options;
              }
            }
            return target;
          },
        },
      ]
    );

    // each hoist is scoped to its own plugin — no cross-pollution
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
      {
        filter: { plugin: OTHER_PLUGIN_PATH },
        options: { level: 'high' },
      },
    ]);
    for (const name of ['app1', 'app2', 'app3', 'app4']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
  });

  it('K: a project skipped by skipProjectFilter never inherits the hoisted config', async () => {
    ctx = setupFixture('hoist-skipped');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const migrations = syntheticMigrations();
    (migrations[0] as any).skipProjectFilter = (project: any) =>
      project.root === 'app3' ? 'skipped for this test' : false;
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      migrations,
      undefined,
      { warn } as any
    );

    // app3 keeps its executor target untouched
    expect(readJson(ctx.tree, 'app3/project.json').targets.build.executor).toBe(
      SYNTHETIC_EXECUTOR
    );
    // and the hoist is plugin-scoped, so app3's executor-based target (which
    // has no source plugin) can only ever resolve the untouched catch-all
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
  });

  it('L: reverts the hoist when a non-migrated project root infers the same target', async () => {
    // The plugin is already registered workspace-wide, and app3 is
    // inferred-only (config file, no executor target). Hoisting would change
    // app3's inferred `build`, so the verification pass must revert it.
    ctx = setupFixture('hoist-inferred-only');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // app3: a project the plugin infers for, with no executor target
    addExecutorProject(ctx, {
      name: 'app3',
      root: 'app3',
      targetName: 'unrelated',
      executor: '@other/tool:noop',
    });
    // pre-registered, unscoped — app3 keeps inferring after the migration
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [SYNTHETIC_PLUGIN_PATH];
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // no hoisted entry survives — the catch-all collapses back to the plain
    // object form
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    // migrated projects keep their full residuals (previous-engine output)
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    // app3 gained no project.json target
    expect(
      readJson(ctx.tree, 'app3/project.json').targets.build
    ).toBeUndefined();
    // the revert is surfaced once
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('build');
  });
});

describe('Phase 4 — verify + equivalence oracle + fallback', () => {
  let ctx: FixtureContext;

  afterEach(() => {
    if (ctx) {
      teardownFixture(ctx.fs);
      ctx = undefined;
    }
  });

  it('falls back a project whose centralized config cannot be verified, warning once', async () => {
    ctx = setupFixture('fallback');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // app3 infers a DIVERGENT target on the verification pass (invocation >= 2),
    // so its real post-migration config no longer matches the baseline.
    const plugin = createSyntheticPlugin(
      (root, targetName, _options, invocation) => {
        const target = defaultInferredTarget(root, targetName);
        if (root === 'app3' && invocation >= 2) {
          target.outputs = ['{projectRoot}/divergent'];
        }
        return target;
      }
    );
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // app1 / app2 stay centralized (deviation empty)
    expect(
      readJson(ctx.tree, 'app1/project.json').targets.build
    ).toBeUndefined();
    expect(
      readJson(ctx.tree, 'app2/project.json').targets.build
    ).toBeUndefined();
    // app3 kept a full override
    expect(readJson(ctx.tree, 'app3/project.json').targets.build).toEqual({
      options: { mode: 'production' },
    });
    // the shared plugin-scoped default still exists for the others
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    // exactly one warn, naming only the fallback project — and making no
    // behavioral-equivalence claim the code cannot check: the restored output
    // matches the pre-centralization engine, but the live inferred
    // configuration diverged, so the warn must ask for manual review instead
    // of asserting preservation.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('app3 > build');
    expect(warn.mock.calls[0][0]).not.toContain('app1');
    expect(warn.mock.calls[0][0]).not.toContain('app2');
    expect(warn.mock.calls[0][0]).not.toContain('behavior is preserved');
    expect(warn.mock.calls[0][0]).toContain('could not be verified');
    expect(warn.mock.calls[0][0]).toContain('review');
  });

  it('does not claim an override was kept when the residual is empty', async () => {
    // Pure executor targets: the whole target is inferred, so the residual is
    // `{}` and the fallback "restore" deletes the project.json target. The
    // warning must not assert an override exists or that behavior is
    // preserved — the divergent inferred config IS the live config.
    ctx = setupFixture('fallback-empty-residual');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: {
          options: { config: SYNTHETIC_CONFIG_FILE },
          cache: true,
          outputs: ['{projectRoot}/dist'],
        },
      });
    }
    const plugin = createSyntheticPlugin(
      (root, targetName, _options, invocation) => {
        const target = defaultInferredTarget(root, targetName);
        if (root === 'app3' && invocation >= 2) {
          target.outputs = ['{projectRoot}/divergent'];
        }
        return target;
      }
    );
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // the empty residual removes the target — no override exists
    expect(
      readJson(ctx.tree, 'app3/project.json').targets.build
    ).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('app3 > build');
    expect(warn.mock.calls[0][0]).not.toContain('behavior is preserved');
    expect(warn.mock.calls[0][0]).toContain('could not be verified');
  });

  it('surfaces verification-pass errors in the fallback warning', async () => {
    ctx = setupFixture('fallback-verify-error');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const plugin = createSyntheticPlugin(
      (root, targetName, _options, invocation) => {
        if (invocation >= 2) {
          throw new Error('synthetic verification boom');
        }
        return defaultInferredTarget(root, targetName);
      }
    );
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // both projects fall back (missing from the partial verification result),
    // and the warn carries the underlying cause instead of discarding it
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('verification pass reported');
  });

  it('scopes the plugin include to the migrated subset (root project -> "*")', async () => {
    ctx = setupFixture('partial-include');
    // app1 (root) + app2 migrate; app3 is inferrable (has a config file) but
    // uses a different executor, so it is NOT migrated.
    addExecutorProject(ctx, {
      name: 'app1',
      root: '.',
      targetName: 'build',
      target: uniformExecutorTarget(),
    });
    addExecutorProject(ctx, {
      name: 'app2',
      root: 'app2',
      targetName: 'build',
      target: uniformExecutorTarget(),
    });
    addExecutorProject(ctx, {
      name: 'app3',
      root: 'app3',
      targetName: 'build',
      executor: '@other/tool:build',
    });
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    const registration = readNxJson(ctx.tree).plugins?.find(
      (p): p is ExpandedPluginConfiguration =>
        typeof p !== 'string' && p.plugin === SYNTHETIC_PLUGIN_PATH
    );
    expect(registration).toBeTruthy();
    // app3 is inferrable but not covered, so the include is required and scopes
    // to exactly the migrated roots — the root project as '*'.
    expect(registration.include).toEqual(['*', 'app2/**/*']);
    // app3's executor target and its resolvable defaults are untouched: the
    // hoist is plugin-scoped and app3 sits outside the registration's include
    expect(readJson(ctx.tree, 'app3/project.json').targets.build).toEqual({
      executor: '@other/tool:build',
    });
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
  });
});
