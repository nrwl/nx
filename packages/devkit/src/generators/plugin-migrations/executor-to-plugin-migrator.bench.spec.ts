import { addProjectConfiguration } from 'nx/src/generators/utils/project-configuration';
import { readNxJson, updateNxJson } from 'nx/src/devkit-exports';
import type { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';
import { finalizeBatchConversion } from './batch-conversion-finalize';
import { openBatchConversionSession } from './batch-conversion-session';
import { migrateProjectExecutorsToPlugin } from './executor-to-plugin-migrator';
import {
  createSyntheticPlugin,
  resolveThroughRealPipeline,
  setupFixture,
  teardownFixture,
  SYNTHETIC_CONFIG_FILE,
  type FixtureContext,
  type SyntheticPlugin,
} from './executor-to-plugin-migrator.test-utils';

// See the engine spec: keeps executor resolution honest to the temp workspace.
jest.mock('nx/src/utils/has-nx-js-plugin', () => ({
  hasNxJsPlugin: () => false,
}));

// The count assertions observe only the synthetic plugins' `createNodes`, so a
// whole-workspace project-graph build would not move them. Fail fast on any
// graph construction instead: the contract is exact inference-pass counts WITH
// no graph build.
jest.mock('nx/src/project-graph/project-graph', () => {
  const fail = () => {
    throw new Error('the benchmark must not build the project graph');
  };
  return {
    ...jest.requireActual('nx/src/project-graph/project-graph'),
    buildProjectGraphAndSourceMapsWithoutDaemon: fail,
    createProjectGraphAsync: fail,
    createProjectGraphAndSourceMapsAsync: fail,
  };
});

/**
 * Synthetic large-workspace benchmark mirroring the clickup-frontend profile:
 * ~600 projects, each with a `lint` + `test` executor target (mostly uniform,
 * a few deviating). It pins the two headline properties of the rewrite:
 *
 *   1. whole-workspace inference passes stay single-digit (O(distinct option
 *      sets) + 1 verify), NOT O(projects): the previous engine ran
 *      ~(targets + 2*projects) passes, i.e. thousands here.
 *   2. total emitted config (nx.json + every project.json) shrinks materially:
 *      shared config is centralized once instead of duplicated per project.
 *
 * The batch tests pin the same properties for a multi-plugin batch through the
 * real session + finalize path: exact inference-pass accounting (one pass per
 * distinct option set plus one combined verification pass invoking each final
 * registration once), per-plugin centralization for the first and middle
 * children (not only the last), retention for contested and opaque-blocked
 * plans, and resolved equivalence through the real pipeline.
 */

const LINT_EXECUTOR = '@acme/tool:lint';
const TEST_EXECUTOR = '@acme/tool:test';
const E2E_EXECUTOR = '@acme/tool:e2e';
const LINT_PLUGIN_PATH = '@acme/eslint/plugin';
const TEST_PLUGIN_PATH = '@acme/jest/plugin';
const E2E_PLUGIN_PATH = '@acme/cypress/plugin';
const E2E_CONFIG_FILE = 'e2e.config.json';
const PROJECT_COUNT = 600;
// A handful of projects deviate from the uniform config.
const DEVIATING = new Set([7, 42, 123, 456, 599]);
// Projects from this index name their test target `unit` instead of `test`,
// producing a second distinct option set for the test plugin.
const UNIT_TARGET_FROM = 550;

function cleanTransformer(target: TargetConfiguration): TargetConfiguration {
  if (target.options) {
    delete (target.options as Record<string, unknown>).config;
    if (Object.keys(target.options).length === 0) {
      delete target.options;
    }
  }
  return target;
}

function migrations(executor: string) {
  return [
    {
      executors: [executor],
      targetPluginOptionMapper: (targetName: string) => ({ targetName }),
      postTargetTransformer: cleanTransformer,
    },
  ];
}

function executorTarget(
  executor: string,
  deviating: boolean
): TargetConfiguration {
  const options: Record<string, string> = {
    config: SYNTHETIC_CONFIG_FILE,
    mode: 'production',
  };
  if (deviating) {
    options.shard = 'canary';
  }

  return {
    executor,
    cache: true,
    outputs: ['{projectRoot}/dist'],
    options,
  };
}

function addBenchProject(
  ctx: FixtureContext,
  index: number,
  targets: Record<string, TargetConfiguration>,
  configFiles: string[] = [SYNTHETIC_CONFIG_FILE]
): string {
  const name = `app${index}`;
  const root = `packages/${name}`;
  const project = {
    name,
    root,
    projectType: 'application' as const,
    targets,
  };
  addProjectConfiguration(ctx.tree, name, project);
  ctx.projectGraph.nodes[name] = {
    name,
    type: 'app',
    data: { root, targets: project.targets } as any,
  };
  for (const configFile of configFiles) {
    ctx.fs.createFileSync(`${root}/${configFile}`, '{}');
  }
  return root;
}

function totalConfigBytes(ctx: FixtureContext, roots: string[]): number {
  let bytes = ctx.tree.read('nx.json', 'utf-8')?.length ?? 0;
  for (const root of roots) {
    const file = `${root}/project.json`;
    if (ctx.tree.exists(file)) {
      bytes += ctx.tree.read(file, 'utf-8').length;
    }
  }
  return bytes;
}

describe('executor-to-plugin-migrator benchmark (synthetic ~600 projects)', () => {
  let ctx: FixtureContext;

  afterEach(() => {
    if (ctx) {
      teardownFixture(ctx.fs);
      ctx = undefined;
    }
  });

  function engineChild(
    plugin: SyntheticPlugin,
    executor: string,
    targetName: string,
    logger: { warn: jest.Mock }
  ) {
    return () =>
      migrateProjectExecutorsToPlugin(
        ctx.tree,
        ctx.projectGraph,
        plugin.pluginPath,
        plugin.createNodes,
        { targetName },
        migrations(executor),
        undefined,
        logger as any
      );
  }

  async function runBatch(
    children: Array<() => unknown | Promise<unknown>>,
    finalizeLogger: { warn: jest.Mock }
  ) {
    const session = openBatchConversionSession(ctx.tree);
    try {
      for (const child of children) {
        await session.runChild(child);
      }
      await finalizeBatchConversion(ctx.tree, session, finalizeLogger as any);
    } finally {
      session.close();
    }
  }

  it('runs single-digit inference passes and materially shrinks emitted config', async () => {
    ctx = setupFixture('bench');
    const lintPlugin = createSyntheticPlugin(undefined, LINT_PLUGIN_PATH);
    const testPlugin = createSyntheticPlugin(undefined, TEST_PLUGIN_PATH);

    const roots: string[] = [];
    for (let i = 0; i < PROJECT_COUNT; i++) {
      const deviating = DEVIATING.has(i);
      roots.push(
        addBenchProject(ctx, i, {
          lint: executorTarget(LINT_EXECUTOR, deviating),
          test: executorTarget(TEST_EXECUTOR, deviating),
        })
      );
    }

    // Unrelated targetDefaults keys (globs are the worst case: every
    // resolution scans and sorts them). The target-default preflight must not
    // scale per migrated pair against these: its per-executor memoization
    // keeps the whole run's lookups constant.
    const seededNxJson = JSON.parse(ctx.tree.read('nx.json', 'utf-8'));
    for (let i = 0; i < 200; i++) {
      seededNxJson.targetDefaults[`pad-${i}-*`] = { cache: true };
    }
    ctx.tree.write('nx.json', JSON.stringify(seededNxJson));

    const preBytes = totalConfigBytes(ctx, roots);

    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      lintPlugin.pluginPath,
      lintPlugin.createNodes,
      { targetName: 'lint' },
      migrations(LINT_EXECUTOR)
    );
    await migrateProjectExecutorsToPlugin(
      ctx.tree,
      ctx.projectGraph,
      testPlugin.pluginPath,
      testPlugin.createNodes,
      { targetName: 'test' },
      migrations(TEST_EXECUTOR)
    );

    // Every `createNodes` invocation is one whole-workspace inference pass
    // (Phase 1 runs one per distinct option set; the Phase 4 verification runs
    // one per registration group).
    const inferencePasses =
      lintPlugin.inferenceCount() + testPlugin.inferenceCount();
    const postBytes = totalConfigBytes(ctx, roots);

    // 2 plugins * (1 distinct option set + 1 verification pass) = 4.
    // The old engine would have run roughly 2 * (1 + 2*600) = ~2402 passes.
    expect(inferencePasses).toBeLessThan(10);
    expect(inferencePasses).toBe(4);

    // De-bloat: centralization must MATERIALLY shrink the emitted config, not
    // merely avoid growing it. For this fixture (uniform config + a handful of
    // deviating projects) shared config collapses from per-project copies into
    // one plugin-scoped default per target, so the total compresses well past
    // 2x. A ratio bound pins the de-bloat claim the PR body makes; a plain
    // `<=` would pass even if nothing were centralized.
    const compressionRatio = preBytes / postBytes;
    expect(compressionRatio).toBeGreaterThan(2);

    // Shared config is centralized as a plugin-scoped entry; only the
    // deviating projects keep an override.
    const nxJson = JSON.parse(ctx.tree.read('nx.json', 'utf-8'));
    expect(nxJson.targetDefaults.lint).toContainEqual({
      filter: { plugin: LINT_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(nxJson.targetDefaults.test).toContainEqual({
      filter: { plugin: TEST_PLUGIN_PATH },
      options: { mode: 'production' },
    });

    let projectsWithLintOverride = 0;
    let projectsWithTestOverride = 0;
    for (const root of roots) {
      const pj = JSON.parse(ctx.tree.read(`${root}/project.json`, 'utf-8'));
      if (pj.targets?.lint) {
        projectsWithLintOverride++;
        expect(pj.targets.lint.options).toEqual({ shard: 'canary' });
      }
      if (pj.targets?.test) {
        projectsWithTestOverride++;
        expect(pj.targets.test.options).toEqual({ shard: 'canary' });
      }
    }
    expect(projectsWithLintOverride).toBe(DEVIATING.size);
    expect(projectsWithTestOverride).toBe(DEVIATING.size);
  }, 120_000);

  it('centralizes every child of a batch with exact inference-pass accounting and equivalent resolution', async () => {
    ctx = setupFixture('bench-batch');
    const lintPlugin = createSyntheticPlugin(undefined, LINT_PLUGIN_PATH);
    const testPlugin = createSyntheticPlugin(undefined, TEST_PLUGIN_PATH);
    const e2ePlugin = createSyntheticPlugin(undefined, E2E_PLUGIN_PATH);

    const roots: string[] = [];
    for (let i = 0; i < PROJECT_COUNT; i++) {
      const deviating = DEVIATING.has(i);
      roots.push(
        addBenchProject(ctx, i, {
          lint: executorTarget(LINT_EXECUTOR, deviating),
          [i >= UNIT_TARGET_FROM ? 'unit' : 'test']: executorTarget(
            TEST_EXECUTOR,
            deviating
          ),
          e2e: executorTarget(E2E_EXECUTOR, deviating),
        })
      );
    }
    // Same unrelated-key pressure as the inline benchmark: the finalize
    // preflight resolves against these too.
    const seededNxJson = JSON.parse(ctx.tree.read('nx.json', 'utf-8'));
    for (let i = 0; i < 200; i++) {
      seededNxJson.targetDefaults[`pad-${i}-*`] = { cache: true };
    }
    ctx.tree.write('nx.json', JSON.stringify(seededNxJson));

    const preBytes = totalConfigBytes(ctx, roots);
    const warnLint = jest.fn();
    const warnTest = jest.fn();
    const warnE2e = jest.fn();
    const warnFinalize = jest.fn();

    await runBatch(
      [
        engineChild(lintPlugin, LINT_EXECUTOR, 'lint', { warn: warnLint }),
        engineChild(testPlugin, TEST_EXECUTOR, 'test', { warn: warnTest }),
        engineChild(e2ePlugin, E2E_EXECUTOR, 'e2e', { warn: warnE2e }),
      ],
      { warn: warnFinalize }
    );

    // Exact inference-pass accounting: one Phase 1 pass per distinct option
    // set (lint 1, test 2 from the `test`/`unit` target-name split, e2e 1),
    // and ONE combined verification pass that invokes each of the 4 final
    // registrations once. No pass builds the project graph, and the deferred
    // children run no per-child verification.
    expect(lintPlugin.inferenceCount()).toBe(2);
    expect(testPlugin.inferenceCount()).toBe(4);
    expect(e2ePlugin.inferenceCount()).toBe(2);

    // Aggregate compression holds for the whole batch, not only the last
    // child: every plugin's shared config is centralized.
    const postBytes = totalConfigBytes(ctx, roots);
    expect(preBytes / postBytes).toBeGreaterThan(2);

    // A plugin-scoped default exists for the FIRST and MIDDLE children too;
    // the previous batch behavior centralized only the last child.
    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    expect(targetDefaults.lint).toContainEqual({
      filter: { plugin: LINT_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(targetDefaults.test).toContainEqual({
      filter: { plugin: TEST_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(targetDefaults.unit).toContainEqual({
      filter: { plugin: TEST_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(targetDefaults.e2e).toContainEqual({
      filter: { plugin: E2E_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(warnLint).not.toHaveBeenCalled();
    expect(warnTest).not.toHaveBeenCalled();
    expect(warnE2e).not.toHaveBeenCalled();
    expect(warnFinalize).not.toHaveBeenCalled();

    // Per-target override counts: only the deviating projects keep a
    // per-project entry, and it holds only the non-shared option.
    const overrideCounts = { lint: 0, test: 0, unit: 0, e2e: 0 };
    for (const root of roots) {
      const pj = JSON.parse(ctx.tree.read(`${root}/project.json`, 'utf-8'));
      for (const targetName of Object.keys(overrideCounts)) {
        if (pj.targets?.[targetName]) {
          overrideCounts[targetName]++;
          expect(pj.targets[targetName].options).toEqual({ shard: 'canary' });
        }
      }
    }
    expect(overrideCounts).toEqual({ lint: 5, test: 4, unit: 1, e2e: 5 });

    // Resolved equivalence through the REAL pipeline: every project's every
    // migrated target resolves to the same effective config as before the
    // migration (inferred command, shared mode from the centralized default,
    // per-project shard only where it deviated).
    const resolved = await resolveThroughRealPipeline(
      ctx,
      LINT_PLUGIN_PATH,
      lintPlugin.createNodes,
      {
        [TEST_PLUGIN_PATH]: testPlugin.createNodes,
        [E2E_PLUGIN_PATH]: e2ePlugin.createNodes,
      }
    );
    for (const [i, root] of roots.entries()) {
      const deviating = DEVIATING.has(i);
      const testTargetName = i >= UNIT_TARGET_FROM ? 'unit' : 'test';
      for (const targetName of ['lint', testTargetName, 'e2e']) {
        const target = resolved[root]?.[targetName];
        expect(target).toBeDefined();
        expect(target.options?.command ?? target.command).toBe('acme-build');
        expect(target.options?.mode).toBe('production');
        expect(target.options?.shard).toBe(deviating ? 'canary' : undefined);
      }
    }
  }, 120_000);

  it('retains contested and opaque-blocked targets per project while the rest of the batch centralizes', async () => {
    ctx = setupFixture('bench-retention');
    const lintPlugin = createSyntheticPlugin(undefined, LINT_PLUGIN_PATH);
    // Its inferred targets run through a bare `runner` executor, so a later
    // child migrating a target NAMED `runner` is contested: a hoisted `runner`
    // key would resolve as the executor key for this plugin's targets.
    const testPlugin = createSyntheticPlugin(
      () => ({
        executor: 'runner',
        cache: true,
        inputs: [
          'default',
          '^default',
          { externalDependencies: ['acme-tool'] },
        ],
        outputs: ['{projectRoot}/dist'],
      }),
      TEST_PLUGIN_PATH
    );
    const runnerPlugin = createSyntheticPlugin(
      undefined,
      E2E_PLUGIN_PATH,
      `**/${E2E_CONFIG_FILE}`
    );
    const runnerProjectCount = 10;

    const roots: string[] = [];
    for (let i = 0; i < PROJECT_COUNT; i++) {
      const contested = i < runnerProjectCount;
      roots.push(
        addBenchProject(
          ctx,
          i,
          {
            lint: executorTarget(LINT_EXECUTOR, false),
            test: executorTarget(TEST_EXECUTOR, false),
            ...(contested
              ? { runner: executorTarget(E2E_EXECUTOR, false) }
              : {}),
          },
          contested
            ? [SYNTHETIC_CONFIG_FILE, E2E_CONFIG_FILE]
            : [SYNTHETIC_CONFIG_FILE]
        )
      );
    }
    const seededNxJson = readNxJson(ctx.tree);
    for (const executor of [LINT_EXECUTOR, TEST_EXECUTOR, E2E_EXECUTOR]) {
      seededNxJson.targetDefaults[executor] = { cache: true };
    }
    updateNxJson(ctx.tree, seededNxJson);

    const warnLint = jest.fn();
    const warnTest = jest.fn();
    const warnRunner = jest.fn();
    const warnFinalize = jest.fn();

    await runBatch(
      [
        engineChild(lintPlugin, LINT_EXECUTOR, 'lint', { warn: warnLint }),
        // A converter that registers a plugin the session cannot attribute to
        // any engine plan: an opaque barrier blocking the earlier lint plan.
        () => {
          const nxJson = readNxJson(ctx.tree);
          nxJson.plugins.push('@acme/rogue/plugin');
          updateNxJson(ctx.tree, nxJson);
        },
        engineChild(testPlugin, TEST_EXECUTOR, 'test', { warn: warnTest }),
        engineChild(runnerPlugin, E2E_EXECUTOR, 'runner', {
          warn: warnRunner,
        }),
      ],
      { warn: warnFinalize }
    );

    // Same per-plugin accounting as the safe batch: retention gates cost no
    // extra inference passes (1 Phase 1 option set + 1 combined-pass
    // registration each).
    expect(lintPlugin.inferenceCount()).toBe(2);
    expect(testPlugin.inferenceCount()).toBe(2);
    expect(runnerPlugin.inferenceCount()).toBe(2);

    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    // The lint plan registered before the opaque barrier is retained: the
    // workspace's pre-existing `lint` default stays in object form, so no
    // plugin-scoped entry was appended. The test plan registered after the
    // barrier still centralizes; the runner plan is retained by the collision
    // with the test plugin's inferred `runner` executor.
    expect(targetDefaults.lint).toEqual({ cache: true });
    expect(targetDefaults.test).toContainEqual({
      filter: { plugin: TEST_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(targetDefaults.runner).toBeUndefined();
    expect(readNxJson(ctx.tree).plugins).toContain('@acme/rogue/plugin');

    // Retained targets stay per-project ON EVERY project (full residuals);
    // centralized ones keep no per-project entry.
    for (const [i, root] of roots.entries()) {
      const pj = JSON.parse(ctx.tree.read(`${root}/project.json`, 'utf-8'));
      expect(pj.targets.lint).toEqual({ options: { mode: 'production' } });
      expect(pj.targets.test).toBeUndefined();
      if (i < runnerProjectCount) {
        expect(pj.targets.runner).toEqual({ options: { mode: 'production' } });
      }
    }

    expect(warnLint).toHaveBeenCalledWith(
      `convert-to-inferred retained full per-project configuration for target(s) lint because another plugin is registered after ${LINT_PLUGIN_PATH} in nx.json and may take over those targets; no configuration was lost, but shared configuration remains duplicated.`
    );
    expect(warnTest).not.toHaveBeenCalled();
    expect(warnRunner).toHaveBeenCalledWith(
      'convert-to-inferred retained full per-project configuration for target(s) runner because the target name would resolve as an executor or glob targetDefaults key and could apply to other targets; no configuration was lost, but shared configuration remains duplicated.'
    );
    expect(warnFinalize).not.toHaveBeenCalled();

    // The unattributed registration makes executor liveness opaque: the
    // executor-keyed default cleanup is skipped for every plan.
    expect(targetDefaults[LINT_EXECUTOR]).toEqual({ cache: true });
    expect(targetDefaults[TEST_EXECUTOR]).toEqual({ cache: true });
    expect(targetDefaults[E2E_EXECUTOR]).toEqual({ cache: true });
  }, 120_000);
});
