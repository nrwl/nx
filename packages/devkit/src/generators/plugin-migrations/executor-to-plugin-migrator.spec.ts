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
  // set (Phase 1) plus exactly one verification pass (Phase 4). For a uniform
  // fixture that is `1 + 1 = 2`, independent of the number of projects.
  const EXPECTED_UNIFORM_PASSES = 1 /* distinctOptionSets */ + 1; /* verify */

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
    addExecutorProject(ctx, { name: 'app3', root: 'app3', targetName: 'check' });

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
    expect([...scope.targetsToMigrate.keys()].sort()).toEqual(['check', 'test']);
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
    addExecutorProject(ctx, { name: 'app1', root: 'app1', targetName: 'build' });
    addExecutorProject(ctx, { name: 'app2', root: 'app2', targetName: 'build' });
    addExecutorProject(ctx, { name: 'app3', root: 'app3', targetName: 'build' });

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
    addExecutorProject(ctx, { name: 'app1', root: 'app1', targetName: 'build' });

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
    const { inferredByRoot } = await inferOncePerOptionSet(
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
      inferredByRoot,
      nxJson
    );

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
    const { inferredByRoot } = await inferOncePerOptionSet(
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
      inferredByRoot,
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

    // central targetDefaults holds the shared residual, merged onto the
    // workspace's pre-existing `build: { cache: true }` default.
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({
      cache: true,
      options: { mode: 'production' },
    });
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
    // remainder sits once in the target-name default (merged onto the
    // workspace's pre-existing `build: { cache: true }` default)
    expect(td.build).toEqual({ cache: true, dependsOn: ['^build'] });
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
    // the shared default still exists for the others
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({
      cache: true,
      options: { mode: 'production' },
    });
    // exactly one warn, naming only the fallback project
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('app3 > build');
    expect(warn.mock.calls[0][0]).not.toContain('app1');
    expect(warn.mock.calls[0][0]).not.toContain('app2');
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
  });
});
