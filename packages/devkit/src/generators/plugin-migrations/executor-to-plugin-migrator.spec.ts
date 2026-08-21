import { dirname } from 'node:path/posix';
import type {
  CreateNodes,
  ExpandedPluginConfiguration,
  TargetDefaults,
} from 'nx/src/devkit-exports';
import { readNxJson, readJson, updateNxJson } from 'nx/src/devkit-exports';
import {
  AggregateCreateNodesError,
  mergeTargetConfigurations,
} from 'nx/src/devkit-internals';
import {
  collectMigrationScope,
  computeResidualByProject,
  computeStrictCommon,
  generatedIncludeRoots,
  inferOncePerOptionSet,
  migrateProjectExecutorsToPlugin,
  readTargetDefaultsForExecutor,
} from './executor-to-plugin-migrator';
import {
  addExecutorProject,
  createSyntheticPlugin,
  defaultInferredTarget,
  resolveThroughRealPipeline,
  setupFixture,
  teardownFixture,
  SYNTHETIC_CONFIG_FILE,
  SYNTHETIC_CONFIG_GLOB,
  SYNTHETIC_EXECUTOR,
  SYNTHETIC_PLUGIN_PATH,
  type FixtureContext,
  type SyntheticPluginOptions,
} from './executor-to-plugin-migrator.test-utils';

// The temp workspaces these specs build have no real `@nx/js`, so the implicit
// `nx-release-publish` target (`@nx/js:release-publish`) the package-json plugin
// adds to non-private projects does not apply. But inside this monorepo `@nx/js`
// still resolves to `packages/js` SOURCE through the jest resolver, so left alone
// `hasNxJsPlugin` returns true, the target gets added, and target normalization
// reads `packages/js`'s executors.json + schema.json (plus a package.json resolver
// probe) -- all outside `devkit:test`'s declared inputs, which the Nx Cloud
// task-isolation sandbox flags. `has-nx-js-plugin` lives in its own module so
// tests can mock it; returning false keeps resolution honest to the temp workspace.
jest.mock('nx/src/utils/has-nx-js-plugin', () => ({
  hasNxJsPlugin: () => false,
}));

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

    // per-executor slice: target -> set of projects
    const targetAndProjects = scope.executorScopes[0].targetAndProjects;
    expect([...targetAndProjects.keys()].sort()).toEqual(['check', 'test']);
    expect([...targetAndProjects.get('test')].sort()).toEqual(['app1', 'app2']);
    expect([...targetAndProjects.get('check')]).toEqual(['app3']);

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
    const distinctOptionSets = scope.optionSetGroups.map(
      (group) => group.options
    );
    expect(distinctOptionSets).toHaveLength(2);
    expect(distinctOptionSets).toContainEqual({ targetName: 'test' });
    expect(distinctOptionSets).toContainEqual({ targetName: 'check' });
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

    expect(scope.optionSetGroups).toHaveLength(1);
    expect(scope.optionSetGroups[0].options).toEqual({ targetName: 'build' });
    expect(
      [...scope.executorScopes[0].targetAndProjects.get('build')].sort()
    ).toEqual(['app1', 'app2', 'app3']);
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

describe('generatedIncludeRoots', () => {
  it('maps the two generated shapes to literal roots', () => {
    expect(generatedIncludeRoots(['*'])).toEqual(new Set(['.']));
    expect(generatedIncludeRoots(['apps/demo/**/*'])).toEqual(
      new Set(['apps/demo'])
    );
    expect(generatedIncludeRoots(['*', 'apps/demo/**/*'])).toEqual(
      new Set(['.', 'apps/demo'])
    );
  });

  it('falls back (undefined) when a globstar prefix carries glob metacharacters', () => {
    // These end in `/**/*` but the prefix is not a literal root, so they cannot
    // be reduced to root ownership by string equality — the glob engine must
    // handle them. Previously they were wrongly treated as literal roots.
    for (const include of [
      'apps/*/**/*',
      'apps/{a,b}/**/*',
      'apps/(a|b)/**/*',
      'apps/@(a|b)/**/*',
      'apps/!(x)/**/*',
      'apps/[ab]/**/*',
      'apps/?/**/*',
      '*/**/*',
    ]) {
      expect(generatedIncludeRoots([include])).toBeUndefined();
    }
  });

  it('falls back (undefined) for any non-generated shape', () => {
    expect(generatedIncludeRoots(['apps/demo'])).toBeUndefined();
    expect(generatedIncludeRoots(['apps/**'])).toBeUndefined();
    expect(generatedIncludeRoots(['**/*'])).toBeUndefined();
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

    // Through the REAL Nx resolution pipeline the plugin-scoped default DOES
    // apply (no command/executor in the residual), so every project resolves
    // the centralized `mode` — the hoist is genuinely equivalent.
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    for (const name of ['app1', 'app2', 'app3']) {
      expect(resolved[name].build.options?.mode).toBe('production');
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

  it('does not centralize a target whose residual carries a per-project command', async () => {
    // A residual carrying `executor`/`command` gives the project's target an
    // identity in the default (project.json) layer, so Nx's
    // `resolveSourcePlugin` refuses to apply a `filter: { plugin }` default to
    // it — the hoisted keys would be silently dropped. This mirrors @nx/detox,
    // whose postTargetTransformer stamps a per-project `command`.
    ctx = setupFixture('hoist-identity-residual');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: {
          options: { config: SYNTHETIC_CONFIG_FILE, shared: 'value' },
        },
      });
    }
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      [
        {
          executors: [SYNTHETIC_EXECUTOR],
          targetPluginOptionMapper: (targetName: string) => ({ targetName }),
          postTargetTransformer: (target: any, _tree, { projectName }) => {
            if (target.options) {
              delete target.options.config;
            }
            // per-project command, like @nx/detox's processBuildOptions
            target.command = `nx run ${projectName}:build`;
            return target;
          },
        },
      ]
    );

    // the shared `options.shared` must NOT be hoisted — a plugin-scoped default
    // would be dropped by Nx because each residual carries `command`.
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      const pj = readJson(ctx.tree, `${name}/project.json`);
      expect(pj.targets.build).toEqual({
        command: `nx run ${name}:build`,
        options: { shared: 'value' },
      });
    }

    // Assert through the REAL Nx resolution pipeline (inferred + targetDefaults
    // + project.json, with resolveSourcePlugin's filter.plugin gate): the shared
    // option survives. Had it been hoisted to a filter:{plugin} default, this
    // would resolve to `undefined` because the residual carries `command`.
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    for (const name of ['app1', 'app2']) {
      expect(resolved[name].build.options?.shared).toBe('value');
    }
  });

  it('does not centralize a target a package.json script names in the default layer', async () => {
    // The residual here carries NEITHER `executor` nor `command`, so the
    // residual-only identity check is satisfied. But a `package.json` script
    // byte-equal to the migrated target name makes the package-json DEFAULT
    // plugin emit an `nx:run-script` target for it, giving the target an
    // identity in the default layer. Nx's `resolveSourcePlugin` then refuses to
    // apply a `filter: { plugin }` default to it, so a hoist would be silently
    // dropped. The engine must consult the default layer, not just the residual.
    ctx = setupFixture('hoist-identity-package-json-script');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
      // a package.json next to project.json whose `build` script the
      // package-json plugin turns into an `nx:run-script` target
      ctx.tree.write(
        `${name}/package.json`,
        JSON.stringify({ name, scripts: { build: 'tsc -b' } })
      );
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

    // the shared `mode` must NOT be hoisted — a plugin-scoped default would be
    // dropped by Nx because the package.json script authors the target identity.
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      const pj = readJson(ctx.tree, `${name}/project.json`);
      expect(pj.targets.build).toEqual({ options: { mode: 'production' } });
    }

    // Assert through the REAL Nx resolution pipeline with BOTH default plugins
    // loaded (project.json AND package-json). Had `mode` been hoisted to a
    // filter:{plugin} default, it would resolve to `undefined` because the
    // default-layer `nx:run-script` target carries identity.
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    for (const name of ['app1', 'app2']) {
      expect(resolved[name].build.options?.mode).toBe('production');
    }
  });

  it('excludes projects whose package.json is jsonc (comment / trailing comma), keeping their config', async () => {
    // `JSON.parse` throws on `//` comments and trailing commas, but Nx reads
    // package.json with a jsonc-tolerant parser — so the real package-json plugin
    // turns the `build` script into an `nx:run-script` target and authors the
    // identity. If the gate used `JSON.parse` it would throw, treat the project
    // as eligible, hoist, and Nx would silently drop the centralized config.
    ctx = setupFixture('jsonc-package-json');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // app1: a `//` comment. app2: a trailing comma.
    ctx.tree.write(
      'app1/package.json',
      '{\n  // build script for app1\n  "name": "app1",\n  "scripts": { "build": "tsc -b" }\n}'
    );
    ctx.tree.write(
      'app2/package.json',
      '{\n  "name": "app2",\n  "scripts": { "build": "tsc -b" },\n}'
    );
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    // both excluded -> not hoisted; each keeps its full residual
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    // through REAL resolution each project resolves its own config (default refused)
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    for (const name of ['app1', 'app2']) {
      expect(resolved[name].build.options?.mode).toBe('production');
    }
  });

  it('fails closed: a genuinely unparseable package.json excludes the project', async () => {
    ctx = setupFixture('unparseable-package-json');
    for (const name of ['clean1', 'clean2', 'broken']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // `broken`'s package.json is not parseable even by the jsonc parser; the gate
    // must fail closed (treat identity as authored) rather than hoist on a guess.
    ctx.tree.write('broken/package.json', '{ this is not valid json at all');
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    // the clean pair centralizes; the broken project is kept per-project
    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(
      readJson(ctx.tree, 'clean1/project.json').targets.build
    ).toBeUndefined();
    expect(
      readJson(ctx.tree, 'clean2/project.json').targets.build
    ).toBeUndefined();
    expect(readJson(ctx.tree, 'broken/project.json').targets.build).toEqual({
      options: { mode: 'production' },
    });
  });

  it('does not centralize a target a package.json nx.targets entry authors (project.json present)', async () => {
    // A package.json `nx.targets` entry that says how to run (here a `command`)
    // makes the package-json DEFAULT plugin author the target's identity, so a
    // `filter:{plugin}` default would be refused. With a project.json present the
    // nx.targets entry is genuinely separate from the migrated target, so the
    // project must be excluded and keep its full residual. Covers the
    // `nx.targets` arm of the identity gate (the script arm is covered above).
    ctx = setupFixture('hoist-identity-nx-targets');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
      ctx.tree.write(
        `${name}/package.json`,
        JSON.stringify({
          name,
          nx: { targets: { build: { command: 'tsc -b' } } },
        })
      );
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

    // NOT hoisted — the nx.targets identity refuses a plugin-scoped default
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    for (const name of ['app1', 'app2']) {
      expect(resolved[name].build.options?.mode).toBe('production');
    }
  });

  it('centralizes in a package-based workspace (no project.json) instead of excluding every project', async () => {
    // Package-based projects author their target in package.json `nx.targets`,
    // which is exactly where the migrated executor lives PRE-migration. Reading
    // it as an authored identity would exclude every project and centralize
    // nothing. The residual is written back to `nx.targets` WITHOUT an executor,
    // so post-migration it authors no identity and the hoist resolves.
    ctx = setupFixture('package-based-centralize');
    // shared `mode` is common (hoisted); each project keeps a distinct `variant`
    const variants: Record<string, string> = { pkg1: 'a', pkg2: 'b' };
    for (const name of ['pkg1', 'pkg2']) {
      const root = `libs/${name}`;
      const target = {
        executor: SYNTHETIC_EXECUTOR,
        options: {
          config: SYNTHETIC_CONFIG_FILE,
          mode: 'production',
          variant: variants[name],
        },
        cache: true,
        outputs: ['{projectRoot}/dist'],
      };
      ctx.tree.write(
        `${root}/package.json`,
        JSON.stringify({ name, nx: { targets: { build: target } } })
      );
      ctx.projectGraph.nodes[name] = {
        name,
        type: 'lib',
        data: { root, targets: { build: target } } as any,
      };
      ctx.fs.createFileSync(`${root}/${SYNTHETIC_CONFIG_FILE}`, '{}');
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

    // the shared `mode` IS hoisted — a package-based workspace no longer blocks it
    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    // each project's nx.targets kept only its deviation: no executor (so the
    // package-json plugin authors no identity and the hoisted default resolves),
    // and no `mode` (it was centralized).
    for (const name of ['pkg1', 'pkg2']) {
      const build = readJson(ctx.tree, `libs/${name}/package.json`).nx.targets
        .build;
      expect(build).toEqual({ options: { variant: variants[name] } });
    }
  });

  it('removes the whole nx.targets entry of a package-based project when its residual is empty', async () => {
    // Uniform config: everything hoists and the residual is empty. Removing the
    // last target through `updateProjectConfiguration` leaves package.json
    // `nx.targets` untouched (it drops an empty `targets` before spreading), so
    // the executor would survive, author the identity, and the hoisted default
    // would silently not resolve.
    ctx = setupFixture('package-based-empty-residual');
    ctx.tree.write(
      'package.json',
      JSON.stringify({
        name: 'workspace',
        version: '0.0.1',
        workspaces: ['libs/*'],
      })
    );
    for (const name of ['pkg1', 'pkg2']) {
      const root = `libs/${name}`;
      const target = {
        executor: SYNTHETIC_EXECUTOR,
        options: { config: SYNTHETIC_CONFIG_FILE, mode: 'production' },
        cache: true,
        outputs: ['{projectRoot}/dist'],
      };
      ctx.tree.write(
        `${root}/package.json`,
        JSON.stringify({ name, nx: { targets: { build: target } } })
      );
      ctx.projectGraph.nodes[name] = {
        name,
        type: 'lib',
        data: { root, targets: { build: target } } as any,
      };
      ctx.fs.createFileSync(`${root}/${SYNTHETIC_CONFIG_FILE}`, '{}');
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

    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    for (const name of ['pkg1', 'pkg2']) {
      expect(
        readJson(ctx.tree, `libs/${name}/package.json`).nx.targets
      ).toBeUndefined();
    }
    // through REAL resolution the executor is gone and the hoisted default applies
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    for (const name of ['pkg1', 'pkg2']) {
      expect(resolved[`libs/${name}`].build.executor).not.toBe(
        SYNTHETIC_EXECUTOR
      );
      expect(resolved[`libs/${name}`].build.options?.mode).toBe('production');
    }
  });

  it('restores the full residual of a package-based project when the hoist is reverted after its residual emptied', async () => {
    // Same uniform package-based shape, but the plugin is pre-registered
    // workspace-wide and pkg3 is inferred-only, so the verification pass reverts
    // the hoist and writes each project's full residual a SECOND time, after
    // the first write emptied (and removed) its `nx.targets`.
    ctx = setupFixture('package-based-empty-residual-revert');
    ctx.tree.write(
      'package.json',
      JSON.stringify({
        name: 'workspace',
        version: '0.0.1',
        workspaces: ['libs/*'],
      })
    );
    for (const name of ['pkg1', 'pkg2']) {
      const root = `libs/${name}`;
      const target = {
        executor: SYNTHETIC_EXECUTOR,
        options: { config: SYNTHETIC_CONFIG_FILE, mode: 'production' },
        cache: true,
        outputs: ['{projectRoot}/dist'],
      };
      ctx.tree.write(
        `${root}/package.json`,
        JSON.stringify({ name, nx: { targets: { build: target } } })
      );
      ctx.projectGraph.nodes[name] = {
        name,
        type: 'lib',
        data: { root, targets: { build: target } } as any,
      };
      ctx.fs.createFileSync(`${root}/${SYNTHETIC_CONFIG_FILE}`, '{}');
    }
    // pkg3: inferred-only (config file, no executor target)
    ctx.tree.write(
      'libs/pkg3/package.json',
      JSON.stringify({ name: 'pkg3', nx: {} })
    );
    ctx.projectGraph.nodes.pkg3 = {
      name: 'pkg3',
      type: 'lib',
      data: { root: 'libs/pkg3', targets: {} } as any,
    };
    ctx.fs.createFileSync(`libs/pkg3/${SYNTHETIC_CONFIG_FILE}`, '{}');
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

    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['pkg1', 'pkg2']) {
      expect(
        readJson(ctx.tree, `libs/${name}/package.json`).nx.targets.build
      ).toEqual({ options: { mode: 'production' } });
    }
    expect(
      readJson(ctx.tree, 'libs/pkg3/package.json').nx.targets
    ).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('keeps the nx.targets entry of a package-based project with a same-name included script when its residual is empty (--project)', async () => {
    // Deleting the entry would let the package-json default plugin turn the
    // `build` script into an `nx:run-script` target that takes the target's
    // identity over from the inferred target. Keep the entry and warn instead.
    ctx = setupFixture('package-based-empty-residual-script');
    ctx.tree.write(
      'package.json',
      JSON.stringify({
        name: 'workspace',
        version: '0.0.1',
        workspaces: ['libs/*'],
      })
    );
    const target = {
      executor: SYNTHETIC_EXECUTOR,
      options: { config: SYNTHETIC_CONFIG_FILE },
      cache: true,
      outputs: ['{projectRoot}/dist'],
    };
    ctx.tree.write(
      'libs/pkg1/package.json',
      JSON.stringify({
        name: 'pkg1',
        scripts: { build: 'echo build' },
        nx: { targets: { build: target } },
      })
    );
    ctx.projectGraph.nodes.pkg1 = {
      name: 'pkg1',
      type: 'lib',
      data: { root: 'libs/pkg1', targets: { build: target } } as any,
    };
    ctx.fs.createFileSync(`libs/pkg1/${SYNTHETIC_CONFIG_FILE}`, '{}');
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      'pkg1',
      { warn } as any
    );

    // the entry survives verbatim, exactly as the previous engine left it
    expect(
      readJson(ctx.tree, 'libs/pkg1/package.json').nx.targets.build
    ).toEqual(target);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'kept the package.json nx.targets entry for target "build" in project "pkg1"'
      )
    );
    // through REAL resolution (package-json default plugin included) the
    // pre-migration executor still runs; without the entry the `build` script
    // would take the identity over with `nx:run-script`
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    expect(resolved['libs/pkg1'].build.executor).toBe(SYNTHETIC_EXECUTOR);
  });

  it('keeps the nx.targets entry only for the script-authoring package-based project in a whole-workspace migration', async () => {
    ctx = setupFixture('package-based-empty-residual-script-ww');
    ctx.tree.write(
      'package.json',
      JSON.stringify({
        name: 'workspace',
        version: '0.0.1',
        workspaces: ['libs/*'],
      })
    );
    const target = {
      executor: SYNTHETIC_EXECUTOR,
      options: { config: SYNTHETIC_CONFIG_FILE },
      cache: true,
      outputs: ['{projectRoot}/dist'],
    };
    // pkg1 also has an included same-name script; pkg2 does not
    ctx.tree.write(
      'libs/pkg1/package.json',
      JSON.stringify({
        name: 'pkg1',
        scripts: { build: 'echo build' },
        nx: { targets: { build: target } },
      })
    );
    ctx.tree.write(
      'libs/pkg2/package.json',
      JSON.stringify({ name: 'pkg2', nx: { targets: { build: target } } })
    );
    for (const name of ['pkg1', 'pkg2']) {
      ctx.projectGraph.nodes[name] = {
        name,
        type: 'lib',
        data: { root: `libs/${name}`, targets: { build: target } } as any,
      };
      ctx.fs.createFileSync(`libs/${name}/${SYNTHETIC_CONFIG_FILE}`, '{}');
    }
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

    // pkg1 keeps its entry (script identity), pkg2's is removed as usual
    expect(
      readJson(ctx.tree, 'libs/pkg1/package.json').nx.targets.build
    ).toEqual(target);
    expect(
      readJson(ctx.tree, 'libs/pkg2/package.json').nx.targets
    ).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'kept the package.json nx.targets entry for target "build" in project "pkg1"'
      )
    );
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    expect(resolved['libs/pkg1'].build.executor).toBe(SYNTHETIC_EXECUTOR);
    expect(resolved['libs/pkg2'].build.executor).not.toBe(SYNTHETIC_EXECUTOR);
    expect(resolved['libs/pkg2'].build.options?.command).toBe('acme-build');
  });

  it('does not centralize when another plugin is registered after the reused registration', async () => {
    // A plugin registered later in nx.json `plugins` merges later; when it
    // authors the same target, the executor/command attribution moves to it and
    // `resolveSourcePlugin` rejects the migrated plugin's `filter: { plugin }`
    // default, silently dropping the hoisted keys. The migration cannot see
    // that (its verification pass loads only the migrated plugin), so it must
    // keep the full residuals.
    const OTHER_PLUGIN_PATH = '@acme/other/plugin';
    ctx = setupFixture('hoist-blocked-by-later-plugin');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [
      { plugin: SYNTHETIC_PLUGIN_PATH, options: { targetName: 'build' } },
      OTHER_PLUGIN_PATH,
    ];
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const otherPlugin = createSyntheticPlugin(
      (root) => ({ command: 'other-build', options: { cwd: root } }),
      OTHER_PLUGIN_PATH
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

    // no hoisted entry; the full residual stays in each project.json
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'other plugins are registered after this plugin in nx.json'
      )
    );
    // through REAL resolution with BOTH plugins, the later plugin owns the
    // target's identity, and the residual still preserves the explicit options
    // (a hoisted default would have been rejected and its keys dropped)
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes,
      { [OTHER_PLUGIN_PATH]: otherPlugin.createNodes }
    );
    for (const name of ['app1', 'app2']) {
      expect(resolved[name].build.options?.command).toBe('other-build');
      expect(resolved[name].build.options?.mode).toBe('production');
    }
  });

  it('centralizes when the new registration is appended after every other plugin', async () => {
    // The migration appends its new registration at the end of `plugins`, so
    // the migrated plugin merges last, keeps the executor/command attribution
    // for its targets, and the hoisted `filter: { plugin }` default resolves
    // even though another plugin authors the same target earlier.
    const OTHER_PLUGIN_PATH = '@acme/other/plugin';
    ctx = setupFixture('hoist-appended-after-other-plugin');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [OTHER_PLUGIN_PATH];
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const otherPlugin = createSyntheticPlugin(
      (root) => ({ command: 'other-build', options: { cwd: root } }),
      OTHER_PLUGIN_PATH
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

    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    for (const name of ['app1', 'app2']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    expect(warn).not.toHaveBeenCalled();
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes,
      { [OTHER_PLUGIN_PATH]: otherPlugin.createNodes }
    );
    for (const name of ['app1', 'app2']) {
      expect(resolved[name].build.options?.command).toBe('acme-build');
      expect(resolved[name].build.options?.mode).toBe('production');
    }
  });

  it('does not throw when nx.includedScripts is malformed (non-array)', async () => {
    // A non-array `nx.includedScripts` must not crash the generator with an
    // uncaught TypeError; it is normalized to the default (all scripts).
    ctx = setupFixture('malformed-included-scripts');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
      ctx.tree.write(
        `${name}/package.json`,
        JSON.stringify({ name, nx: { includedScripts: {} } })
      );
    }
    const plugin = createSyntheticPlugin();

    // must not throw (the pre-fix `.includes` on a non-array did)
    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    // centralization proceeds normally
    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
  });

  it('partitions per-project: hoists for eligible projects, excludes authored-identity ones', async () => {
    // Mixed workspace: two clean projects (eligible) share `mode: production`,
    // one project has a package.json `build` script (default-layer identity), and
    // one carries a per-project `command` in its residual. The two excluded
    // projects must NOT block centralization for the clean pair, and the hoisted
    // default must NOT resolve for the excluded projects.
    ctx = setupFixture('per-project-partition');
    for (const name of ['clean1', 'clean2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: {
          options: { config: SYNTHETIC_CONFIG_FILE, mode: 'production' },
          cache: true,
          outputs: ['{projectRoot}/dist'],
        },
      });
    }
    // excluded via a package.json script; its residual has NO `mode`
    addExecutorProject(ctx, {
      name: 'scripted',
      root: 'scripted',
      targetName: 'build',
      target: {
        options: { config: SYNTHETIC_CONFIG_FILE },
        cache: true,
        outputs: ['{projectRoot}/dist'],
      },
    });
    ctx.tree.write(
      'scripted/package.json',
      JSON.stringify({ name: 'scripted', scripts: { build: 'tsc -b' } })
    );
    // excluded via a per-project command; its residual has NO `mode`
    addExecutorProject(ctx, {
      name: 'commanded',
      root: 'commanded',
      targetName: 'build',
      target: {
        options: { config: SYNTHETIC_CONFIG_FILE },
        cache: true,
        outputs: ['{projectRoot}/dist'],
      },
    });
    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      [
        {
          executors: [SYNTHETIC_EXECUTOR],
          targetPluginOptionMapper: () => ({ targetName: 'build' }),
          postTargetTransformer: (target: any, _tree, { projectName }) => {
            if (target.options) {
              delete target.options.config;
              if (Object.keys(target.options).length === 0)
                delete target.options;
            }
            if (projectName === 'commanded') {
              target.command = `nx run ${projectName}:build`;
            }
            return target;
          },
        },
      ]
    );

    // the eligible pair centralizes `mode`
    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    // clean projects keep no residual
    for (const name of ['clean1', 'clean2']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    // the commanded project keeps its full residual (never reduced)
    expect(readJson(ctx.tree, 'commanded/project.json').targets.build).toEqual({
      command: 'nx run commanded:build',
    });

    // Both directions through REAL resolution (project.json AND package-json):
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    // eligible: the filter default applies -> centralized `mode` resolves
    expect(resolved['clean1'].build.options?.mode).toBe('production');
    expect(resolved['clean2'].build.options?.mode).toBe('production');
    // excluded: the filter default is REFUSED -> the centralized `mode` must NOT
    // leak in (their residuals carry no `mode`). If either picks it up, the
    // partition is unsound.
    expect(resolved['scripted'].build.options?.mode).toBeUndefined();
    expect(resolved['commanded'].build.options?.mode).toBeUndefined();
  });

  it('warns (not silently) when projects are kept per-project due to authored identity', async () => {
    // A per-project exclusion is otherwise silent. The migration must surface it,
    // so a partial/total non-centralization is never mistaken for "centralization
    // did not apply" — the failure mode that hid the customer's denormalization.
    ctx = setupFixture('exclusion-warning');
    for (const name of ['clean1', 'clean2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    addExecutorProject(ctx, {
      name: 'scripted',
      root: 'scripted',
      targetName: 'build',
      target: uniformExecutorTarget(),
    });
    ctx.tree.write(
      'scripted/package.json',
      JSON.stringify({ name: 'scripted', scripts: { build: 'tsc -b' } })
    );
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

    // the eligible pair still centralizes
    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    // ...and the exclusion is announced, naming the projects and the target
    expect(warn).toHaveBeenCalled();
    const message = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(message).toContain(
      'kept per-project configuration for 1 project(s) (scripted)'
    );
    expect(message).toContain('build');
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

  it('keeps the executor-keyed targetDefault when a non-migrated inferred target in the graph uses the executor', async () => {
    ctx = setupFixture('hoist-executor-alive-graph');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, { name, root: name, targetName: 'build' });
    }
    // a target contributed by another, already-registered plugin: present in
    // the project graph but invisible to getProjects (no project.json)
    ctx.projectGraph.nodes['lib1'] = {
      name: 'lib1',
      type: 'lib',
      data: {
        root: 'lib1',
        targets: { package: { executor: SYNTHETIC_EXECUTOR } },
      } as any,
    };
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

    // still alive: lib1's inferred `package` target resolves the executor key
    expect(readNxJson(ctx.tree).targetDefaults[SYNTHETIC_EXECUTOR]).toEqual({
      dependsOn: ['^build'],
    });
  });

  it('keeps the executor-keyed targetDefault when the migrated plugin itself infers a target with the executor', async () => {
    ctx = setupFixture('hoist-executor-alive-inference');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, { name, root: name, targetName: 'build' });
    }
    // an inferred-only root: config file, no explicit project
    ctx.fs.createFileSync(`tools/${SYNTHETIC_CONFIG_FILE}`, '{}');
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults[SYNTHETIC_EXECUTOR] = { dependsOn: ['^build'] };
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin((root, targetName, options, i) =>
      root === 'tools'
        ? { executor: SYNTHETIC_EXECUTOR }
        : defaultInferredTarget(root, targetName)
    );

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      plugin.pluginPath,
      plugin.createNodes,
      { targetName: 'build' },
      syntheticMigrations()
    );

    // still alive: the plugin's own inference emits the executor for `tools`
    expect(readNxJson(ctx.tree).targetDefaults[SYNTHETIC_EXECUTOR]).toEqual({
      dependsOn: ['^build'],
    });
  });

  it('keeps the executor-keyed targetDefault when the plugin was already registered before the migration', async () => {
    ctx = setupFixture('hoist-executor-alive-position');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, { name, root: name, targetName: 'build' });
    }
    // a pre-existing registration (its own option set, or another plugin after
    // it) can win a migrated pair's identity with this executor via later-wins
    // merging, shadowed in the graph by the explicit target — removal must
    // fail open
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [
      {
        plugin: SYNTHETIC_PLUGIN_PATH,
        options: { targetName: 'build' },
        include: ['libs/**/*'],
      },
    ];
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

    expect(readNxJson(ctx.tree).targetDefaults[SYNTHETIC_EXECUTOR]).toEqual({
      dependsOn: ['^build'],
    });
  });

  it("keeps the executor-keyed targetDefault when a migrated project's package.json authors the target identity", async () => {
    ctx = setupFixture('hoist-executor-alive-package-json');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, { name, root: name, targetName: 'build' });
    }
    // the package-json DEFAULT plugin re-injects this executor at resolution,
    // invisible to getProjects because a sibling project.json exists
    ctx.tree.write(
      'app1/package.json',
      JSON.stringify({
        name: 'app1',
        nx: { targets: { build: { executor: SYNTHETIC_EXECUTOR } } },
      })
    );
    ctx.tree.write(
      'package.json',
      JSON.stringify({
        name: 'workspace',
        version: '0.0.1',
        workspaces: ['app1'],
      })
    );
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults ??= {};
    // equal to the inferred `cache: true`, so residual subtraction drops it and
    // the entry is the only remaining source once the executor is re-injected
    nxJson.targetDefaults[SYNTHETIC_EXECUTOR] = { cache: true };
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

    expect(readNxJson(ctx.tree).targetDefaults[SYNTHETIC_EXECUTOR]).toEqual({
      cache: true,
    });
    // app1 was excluded from hoisting by the identity gate and the exclusion warned
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('kept per-project configuration')
    );
    // through the real pipeline, app1 resolves the package-json-authored
    // executor and still inherits the entry's value
    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    expect(resolved['app1'].build.executor).toBe(SYNTHETIC_EXECUTOR);
    expect(resolved['app1'].build.cache).toBe(true);
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

  it('M: reverts the hoist when a non-migrated root errors during verification (fail-closed)', async () => {
    // Same shape as L, but the plugin ERRORS on app3 during verification, so
    // app3 is absent from the (partial) verification result. `reachesNonMigrated
    // Root` cannot see it — the guard must fail closed on the errored config
    // file, which sits outside the migrated roots.
    ctx = setupFixture('hoist-errored-root');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // app3: inferred-only for `build`, migrated for nothing
    addExecutorProject(ctx, {
      name: 'app3',
      root: 'app3',
      targetName: 'unrelated',
      executor: '@other/tool:noop',
    });
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [SYNTHETIC_PLUGIN_PATH];
    updateNxJson(ctx.tree, nxJson);

    // Infers app3 cleanly in Phase 1 (invocation 1) but throws an
    // AggregateCreateNodesError for app3's config on every later pass.
    let invocation = 0;
    const createNodes: CreateNodes<SyntheticPluginOptions> = [
      SYNTHETIC_CONFIG_GLOB,
      (configFiles, options) => {
        invocation++;
        const targetName = options?.targetName ?? 'build';
        const results: Array<readonly [string, any]> = [];
        const errors: Array<[string, Error]> = [];
        for (const file of configFiles) {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          if (root === 'app3' && invocation >= 2) {
            errors.push([file, new Error(`broken config in ${file}`)]);
            continue;
          }
          results.push([
            file,
            {
              projects: {
                [root]: {
                  targets: {
                    [targetName]: defaultInferredTarget(root, targetName),
                  },
                },
              },
            },
          ]);
        }
        if (errors.length > 0) {
          throw new AggregateCreateNodesError(errors, results as any);
        }
        return results;
      },
    ];
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // The errored app3 config sits outside the migrated roots, so the hoist is
    // reverted rather than leaking `mode` onto the inferred-only app3 once its
    // config is fixed.
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    // the incomplete verification is surfaced, not silent
    expect(warn).toHaveBeenCalled();
    expect(
      warn.mock.calls.some((call) => String(call[0]).includes('build'))
    ).toBe(true);
  });

  it('M2: reverts the hoist when a non-migrated root fails during MERGE (fail-closed on MergeNodesError)', async () => {
    // Sibling of M, but app3 fails during the MERGE step, not createNodes: a
    // target carrying both `command` and `executor` throws inside
    // `resolveCommandSyntacticSugar` while Nx merges the inferred nodes, so Nx
    // wraps it as a `MergeNodesError` (which carries `.file`), NOT an
    // `AggregateCreateNodesError`. Phase 1's helper swallows the
    // `ProjectConfigurationsError` and proceeds on partial results, so this
    // reaches the verification pass. The errored file must still fail closed.
    ctx = setupFixture('hoist-merge-errored-root');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // app3: inferred-only for `build`, migrated for nothing
    addExecutorProject(ctx, {
      name: 'app3',
      root: 'app3',
      targetName: 'unrelated',
      executor: '@other/tool:noop',
    });
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [SYNTHETIC_PLUGIN_PATH];
    updateNxJson(ctx.tree, nxJson);

    let invocation = 0;
    const createNodes: CreateNodes<SyntheticPluginOptions> = [
      SYNTHETIC_CONFIG_GLOB,
      (configFiles, options) => {
        invocation++;
        const targetName = options?.targetName ?? 'build';
        return configFiles.map((file) => {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          // app3 emits an invalid target on the verification pass: `command` and
          // `executor` together throw during merge -> MergeNodesError.
          const target =
            root === 'app3' && invocation >= 2
              ? { command: 'echo', executor: 'nx:run-commands' }
              : defaultInferredTarget(root, targetName);
          return [
            file,
            { projects: { [root]: { targets: { [targetName]: target } } } },
          ] as const;
        });
      },
    ];
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // The merge failure sits on app3's config, outside the migrated roots, so the
    // hoist is reverted rather than leaking `mode` onto the inferred-only app3.
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    // the incomplete verification is surfaced, not silent
    expect(warn).toHaveBeenCalled();
  });

  it('reverts the hoist when a nested non-migrated project errors during verification', async () => {
    // Same shape as M, but the errored project is NESTED under a migrated
    // root: `app1/child` is an existing non-migrated project whose config the
    // plugin globs (the parent include covers it). Ancestor-based ownership
    // would attribute the error to `app1` and skip the revert, leaking the
    // centralized default onto the child once its config is fixed — the error
    // must be attributed to the CLOSEST project root instead.
    ctx = setupFixture('hoist-errored-nested-child');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // an existing project nested under migrated app1, migrated for nothing
    addExecutorProject(ctx, {
      name: 'child',
      root: 'app1/child',
      targetName: 'unrelated',
      executor: '@other/tool:noop',
    });
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [SYNTHETIC_PLUGIN_PATH];
    updateNxJson(ctx.tree, nxJson);

    // Infers the child cleanly in Phase 1 (invocation 1) but throws an
    // AggregateCreateNodesError for its config on every later pass.
    let invocation = 0;
    const createNodes: CreateNodes<SyntheticPluginOptions> = [
      SYNTHETIC_CONFIG_GLOB,
      (configFiles, options) => {
        invocation++;
        const targetName = options?.targetName ?? 'build';
        const results: Array<readonly [string, any]> = [];
        const errors: Array<[string, Error]> = [];
        for (const file of configFiles) {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          if (root === 'app1/child' && invocation >= 2) {
            errors.push([file, new Error(`broken config in ${file}`)]);
            continue;
          }
          results.push([
            file,
            {
              projects: {
                [root]: {
                  targets: {
                    [targetName]: defaultInferredTarget(root, targetName),
                  },
                },
              },
            },
          ]);
        }
        if (errors.length > 0) {
          throw new AggregateCreateNodesError(errors, results as any);
        }
        return results;
      },
    ];
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // The errored config belongs to the nested child project, not to migrated
    // app1, so the hoist is reverted rather than leaking `mode` onto the child
    // once its config is fixed.
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    expect(
      readJson(ctx.tree, 'app1/child/project.json').targets.build
    ).toBeUndefined();
    // the incomplete verification is surfaced, not silent
    expect(warn).toHaveBeenCalled();
    expect(
      warn.mock.calls.some((call) => String(call[0]).includes('build'))
    ).toBe(true);
  });

  it('reverts the hoist when a plugin-discovered nested project errors during verification', async () => {
    // Sibling of the nested-child test above, but the nested project exists
    // ONLY through plugin inference: no project.json, no graph node, just a
    // config file the plugin turns into a project in Phase 1. A graph-only
    // ownership lookup would attribute its verification error to migrated
    // `app1` and keep the hoist — the attribution must also see the roots the
    // plugin itself inferred.
    ctx = setupFixture('hoist-errored-inferred-nested');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // config file only — the plugin discovers this project
    ctx.fs.createFileSync(`app1/child/${SYNTHETIC_CONFIG_FILE}`, '{}');
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [SYNTHETIC_PLUGIN_PATH];
    updateNxJson(ctx.tree, nxJson);

    // Infers the child cleanly in Phase 1 (invocation 1) but throws an
    // AggregateCreateNodesError for its config on every later pass.
    let invocation = 0;
    const createNodes: CreateNodes<SyntheticPluginOptions> = [
      SYNTHETIC_CONFIG_GLOB,
      (configFiles, options) => {
        invocation++;
        const targetName = options?.targetName ?? 'build';
        const results: Array<readonly [string, any]> = [];
        const errors: Array<[string, Error]> = [];
        for (const file of configFiles) {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          if (root === 'app1/child' && invocation >= 2) {
            errors.push([file, new Error(`broken config in ${file}`)]);
            continue;
          }
          results.push([
            file,
            {
              projects: {
                [root]: {
                  targets: {
                    [targetName]: defaultInferredTarget(root, targetName),
                  },
                },
              },
            },
          ]);
        }
        if (errors.length > 0) {
          throw new AggregateCreateNodesError(errors, results as any);
        }
        return results;
      },
    ];
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // Phase 1 proved a project lives at app1/child, so its verification error
    // must fail closed: revert the hoist rather than leaking `mode` onto the
    // child once its config is fixed.
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    // the incomplete verification is surfaced, not silent
    expect(warn).toHaveBeenCalled();
    expect(
      warn.mock.calls.some((call) => String(call[0]).includes('build'))
    ).toBe(true);
  });

  it('keeps the include scoped when an errored config sits outside migrated roots (hoist survives)', async () => {
    // clickup-frontend shape: an executor-keyed default + N migrated `lint`
    // projects, plus one config that fails to load (tools/eslint-rules) sitting
    // outside every migrated root. Folding the errored file into the include-
    // coverage set keeps the registration scoped to the migrated roots, so the
    // verification pass never infers (and re-errors on) that root — the hoist
    // survives instead of denormalizing into every project.
    ctx = setupFixture('errored-root-include-scope');
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults ??= {};
    (nxJson.targetDefaults as any)[SYNTHETIC_EXECUTOR] = {
      inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
      cache: true,
      dependsOn: [
        { target: 'build-svg-sprite', projects: ['core-components'] },
      ],
    };
    updateNxJson(ctx.tree, nxJson);
    for (let i = 0; i < 5; i++) {
      addExecutorProject(ctx, {
        name: `app${i}`,
        root: `apps/app${i}`,
        targetName: 'lint',
        executor: SYNTHETIC_EXECUTOR,
        target: { outputs: ['{options.outputFile}'] } as any,
      });
    }
    // a config OUTSIDE every migrated root that fails to load on every pass
    ctx.fs.createFileSync(`tools/eslint-rules/${SYNTHETIC_CONFIG_FILE}`, '{}');

    const createNodes: CreateNodes<SyntheticPluginOptions> = [
      SYNTHETIC_CONFIG_GLOB,
      (configFiles, options) => {
        const targetName = options?.targetName ?? 'build';
        const results: Array<readonly [string, any]> = [];
        const errors: Array<[string, Error]> = [];
        for (const file of configFiles) {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          if (root === 'tools/eslint-rules') {
            errors.push([
              file,
              new Error('This method cannot be used with flat config.'),
            ]);
            continue;
          }
          results.push([
            file,
            {
              projects: {
                [root]: {
                  targets: {
                    [targetName]: defaultInferredTarget(root, targetName),
                  },
                },
              },
            },
          ]);
        }
        if (errors.length > 0) {
          throw new AggregateCreateNodesError(errors, results as any);
        }
        return results;
      },
    ];

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      createNodes,
      { targetName: 'lint' },
      [
        {
          executors: [SYNTHETIC_EXECUTOR],
          targetPluginOptionMapper: () => ({ targetName: 'lint' }),
          postTargetTransformer: (t: any) => {
            if (t.options) {
              delete t.options.config;
              if (Object.keys(t.options).length === 0) delete t.options;
            }
            return t;
          },
        },
      ]
    );

    // the hoist SURVIVES — centralization happened despite the errored root
    expect(readNxJson(ctx.tree).targetDefaults.lint).toContainEqual(
      expect.objectContaining({ filter: { plugin: SYNTHETIC_PLUGIN_PATH } })
    );
    // no project denormalized
    for (let i = 0; i < 5; i++) {
      expect(
        readJson(ctx.tree, `apps/app${i}/project.json`).targets?.lint
      ).toBeUndefined();
    }
    // the registration is SCOPED (not widened workspace-wide): the include is
    // present, covers the migrated roots, and excludes the errored root — so the
    // plugin never infers tools/eslint-rules.
    const registration = readNxJson(ctx.tree).plugins?.find(
      (p): p is ExpandedPluginConfiguration =>
        typeof p !== 'string' && p.plugin === SYNTHETIC_PLUGIN_PATH
    );
    expect(registration?.include).toBeDefined();
    expect(registration.include).toEqual(
      expect.arrayContaining(['apps/app0/**/*'])
    );
    expect(
      registration.include.some((g) => g.startsWith('tools/eslint-rules'))
    ).toBe(false);
  });

  it('keeps the include scoped for NON-MIGRATED projects the plugin infers only at verification', async () => {
    // clickup-frontend shape: the root project + several tools/* projects are in
    // the graph but not migrated, and the plugin infers `lint` for them only on
    // the verification pass (a cache/error asymmetry). They are absent from this
    // pass's `matchedConfigFiles`, so the include was dropped, the plugin widened
    // workspace-wide, and `reachesNonMigratedRoot` reverted the whole target.
    // Judging include coverage against project-graph membership keeps the include
    // scoped, so those roots are never inferred and the hoist survives.
    ctx = setupFixture('non-migrated-inferred-at-verify');
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults ??= {};
    (nxJson.targetDefaults as any)[SYNTHETIC_EXECUTOR] = {
      inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
      cache: true,
      dependsOn: [
        { target: 'build-svg-sprite', projects: ['core-components'] },
      ],
    };
    updateNxJson(ctx.tree, nxJson);
    for (let i = 0; i < 5; i++) {
      addExecutorProject(ctx, {
        name: `app${i}`,
        root: `apps/app${i}`,
        targetName: 'lint',
        executor: SYNTHETIC_EXECUTOR,
        target: { outputs: ['{options.outputFile}'] } as any,
      });
    }
    // non-migrated PROJECTS (graph nodes) with config files + a different executor
    const nonMigrated = ['.', 'tools/tool1', 'tools/tool2'];
    nonMigrated.forEach((root, i) => {
      addExecutorProject(ctx, {
        name: root === '.' ? 'root-proj' : `tool${i}`,
        root,
        targetName: 'other',
        executor: '@other/tool:noop',
      });
    });

    let invocation = 0;
    const createNodes: CreateNodes<SyntheticPluginOptions> = [
      SYNTHETIC_CONFIG_GLOB,
      (configFiles, options) => {
        invocation++;
        const targetName = options?.targetName ?? 'build';
        const results: Array<readonly [string, any]> = [];
        for (const file of configFiles) {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          // non-migrated roots infer only on the verification pass
          if (nonMigrated.includes(root) && invocation < 2) continue;
          results.push([
            file,
            {
              projects: {
                [root]: {
                  targets: {
                    [targetName]: defaultInferredTarget(root, targetName),
                  },
                },
              },
            },
          ]);
        }
        return results;
      },
    ];

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      createNodes,
      { targetName: 'lint' },
      [
        {
          executors: [SYNTHETIC_EXECUTOR],
          targetPluginOptionMapper: () => ({ targetName: 'lint' }),
          postTargetTransformer: (t: any) => {
            if (t.options) {
              delete t.options.config;
              if (Object.keys(t.options).length === 0) delete t.options;
            }
            return t;
          },
        },
      ]
    );

    // the hoist SURVIVES — centralization happened
    expect(readNxJson(ctx.tree).targetDefaults.lint).toContainEqual(
      expect.objectContaining({ filter: { plugin: SYNTHETIC_PLUGIN_PATH } })
    );
    for (let i = 0; i < 5; i++) {
      expect(
        readJson(ctx.tree, `apps/app${i}/project.json`).targets?.lint
      ).toBeUndefined();
    }
    // the registration stays scoped to migrated roots (not widened workspace-wide)
    const registration = readNxJson(ctx.tree).plugins?.find(
      (p): p is ExpandedPluginConfiguration =>
        typeof p !== 'string' && p.plugin === SYNTHETIC_PLUGIN_PATH
    );
    expect(registration?.include).toBeDefined();
    expect(registration.include).toEqual(
      expect.arrayContaining(['apps/app0/**/*'])
    );
    // never scoped to the non-migrated roots
    expect(registration.include).not.toContain('*');
    expect(registration.include.some((g) => g.startsWith('tools/'))).toBe(
      false
    );
  });

  it('preserves a negated user include when the fenced-off config loads fine (fallback coverage)', async () => {
    // A user-authored registration fences a subtree off with a negated include:
    //   include: ['packages/**/*', '!packages/legacy/**/*']
    // The `!` glob defeats the generated-root fast path, so coverage falls to the
    // matcher fallback. A hand-rolled `include.some() && !exclude.some()` reports
    // the fenced-off `packages/legacy` config "covered" (OR semantics ignore the
    // negation), deletes the include, and widens the registration onto the very
    // subtree the user excluded. `findMatchingConfigFiles` applies Nx's ordered
    // override, so the include (and the fence) survives.
    ctx = setupFixture('negated-include-loads-fine');
    const seed = readNxJson(ctx.tree);
    seed.plugins ??= [];
    seed.plugins.push({
      plugin: SYNTHETIC_PLUGIN_PATH,
      options: { targetName: 'lint' } as any,
      include: ['packages/**/*', '!packages/legacy/**/*'],
    });
    updateNxJson(ctx.tree, seed);

    for (let i = 0; i < 2; i++) {
      addExecutorProject(ctx, {
        name: `app${i}`,
        root: `packages/app${i}`,
        targetName: 'lint',
        executor: SYNTHETIC_EXECUTOR,
      });
    }
    // packages/legacy is a NON-MIGRATED project whose config loads fine, so its
    // config file lands in the coverage set via project-graph membership.
    addExecutorProject(ctx, {
      name: 'legacy',
      root: 'packages/legacy',
      targetName: 'other',
      executor: '@other/tool:noop',
    });

    const plugin = createSyntheticPlugin();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      plugin.createNodes,
      { targetName: 'lint' },
      [
        {
          executors: [SYNTHETIC_EXECUTOR],
          targetPluginOptionMapper: () => ({ targetName: 'lint' }),
          postTargetTransformer: (t: any) => t,
        },
      ]
    );

    const registration = readNxJson(ctx.tree).plugins?.find(
      (p): p is ExpandedPluginConfiguration =>
        typeof p !== 'string' && p.plugin === SYNTHETIC_PLUGIN_PATH
    );
    // the include is NOT deleted; the negated fence survives
    expect(registration?.include).toBeDefined();
    expect(registration.include).toContain('!packages/legacy/**/*');
  });

  it('preserves a negated user include when the fenced-off config errors (fallback coverage)', async () => {
    // Same fence, but `packages/legacy` fails to load. It lands in the coverage
    // set via `erroredConfigFiles`. The OR-semantics fallback would still report
    // it "covered", delete the include, widen the registration, and let the
    // verification pass re-hit (and re-throw on) the fenced-off config.
    ctx = setupFixture('negated-include-errors');
    const seed = readNxJson(ctx.tree);
    seed.plugins ??= [];
    seed.plugins.push({
      plugin: SYNTHETIC_PLUGIN_PATH,
      options: { targetName: 'lint' } as any,
      include: ['packages/**/*', '!packages/legacy/**/*'],
    });
    updateNxJson(ctx.tree, seed);

    for (let i = 0; i < 2; i++) {
      addExecutorProject(ctx, {
        name: `app${i}`,
        root: `packages/app${i}`,
        targetName: 'lint',
        executor: SYNTHETIC_EXECUTOR,
      });
    }
    // a config under the fenced-off subtree that fails to load on every pass
    ctx.fs.createFileSync(`packages/legacy/${SYNTHETIC_CONFIG_FILE}`, '{}');

    const createNodes: CreateNodes<SyntheticPluginOptions> = [
      SYNTHETIC_CONFIG_GLOB,
      (configFiles, options) => {
        const targetName = options?.targetName ?? 'build';
        const results: Array<readonly [string, any]> = [];
        const errors: Array<[string, Error]> = [];
        for (const file of configFiles) {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          if (root === 'packages/legacy') {
            errors.push([file, new Error('cannot load legacy config')]);
            continue;
          }
          results.push([
            file,
            {
              projects: {
                [root]: {
                  targets: {
                    [targetName]: defaultInferredTarget(root, targetName),
                  },
                },
              },
            },
          ]);
        }
        if (errors.length > 0) {
          throw new AggregateCreateNodesError(errors, results as any);
        }
        return results;
      },
    ];

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      createNodes,
      { targetName: 'lint' },
      [
        {
          executors: [SYNTHETIC_EXECUTOR],
          targetPluginOptionMapper: () => ({ targetName: 'lint' }),
          postTargetTransformer: (t: any) => t,
        },
      ]
    );

    const registration = readNxJson(ctx.tree).plugins?.find(
      (p): p is ExpandedPluginConfiguration =>
        typeof p !== 'string' && p.plugin === SYNTHETIC_PLUGIN_PATH
    );
    expect(registration?.include).toBeDefined();
    expect(registration.include).toContain('!packages/legacy/**/*');
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

  it('surfaces verification errors when only a divergence fallback (no revert) occurs', async () => {
    // The gap: verification errors exist, NO target reverts (the errored config
    // is owned by a migrated root), and the sole fallback is a DIVERGENCE
    // fallback (a verified-but-non-equivalent target). `anyMissingFromVerification`
    // stays false, so the fallback warning intentionally omits the causes — and
    // without a revert the standalone must still surface them, or the errors
    // vanish.
    ctx = setupFixture('divergence-plus-in-root-error');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // A non-migrated config file NESTED under migrated root app1. It contributes
    // nothing in Phase 1 and ERRORS only on the verification pass: the error is
    // owned by app1 (so no revert), and app1/nested is not a migrated project
    // (so it never sets anyMissingFromVerification).
    ctx.fs.createFileSync('app1/nested/build.config.json', '{}');
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [SYNTHETIC_PLUGIN_PATH];
    updateNxJson(ctx.tree, nxJson);

    let invocation = 0;
    const createNodes: CreateNodes<SyntheticPluginOptions> = [
      SYNTHETIC_CONFIG_GLOB,
      (configFiles, options) => {
        invocation++;
        const targetName = options?.targetName ?? 'build';
        const results: Array<readonly [string, any]> = [];
        const errors: Array<[string, Error]> = [];
        for (const file of configFiles) {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          if (root === 'app1/nested') {
            if (invocation >= 2) {
              errors.push([file, new Error(`broken nested config in ${file}`)]);
            }
            continue;
          }
          const target = defaultInferredTarget(root, targetName);
          // app3 infers a DIVERGENT target on the verification pass.
          if (root === 'app3' && invocation >= 2) {
            target.outputs = ['{projectRoot}/divergent'];
          }
          results.push([
            file,
            { projects: { [root]: { targets: { [targetName]: target } } } },
          ]);
        }
        if (errors.length > 0) {
          throw new AggregateCreateNodesError(errors, results as any);
        }
        return results;
      },
    ];
    const warn = jest.fn();

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      SYNTHETIC_PLUGIN_PATH,
      createNodes,
      { targetName: 'build' },
      syntheticMigrations(),
      undefined,
      { warn } as any
    );

    // No revert: the shared plugin-scoped default survives for app1/app2.
    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    expect(
      readJson(ctx.tree, 'app1/project.json').targets.build
    ).toBeUndefined();
    expect(
      readJson(ctx.tree, 'app2/project.json').targets.build
    ).toBeUndefined();
    // app3 fell back (divergence).
    expect(readJson(ctx.tree, 'app3/project.json').targets.build).toEqual({
      options: { mode: 'production' },
    });

    // The verification errors must be surfaced — the divergence-only fallback
    // warning deliberately omits them, so a standalone warning must carry them.
    const allWarnings = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(allWarnings).toContain('could not fully verify');
    expect(allWarnings).toContain('reported errors');
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
