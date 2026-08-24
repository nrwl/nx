import { dirname } from 'node:path/posix';
import type { CreateNodes } from 'nx/src/devkit-exports';
import {
  readJson,
  readNxJson,
  updateNxJson,
  writeJson,
} from 'nx/src/devkit-exports';
import { AggregateCreateNodesError } from 'nx/src/devkit-internals';
import { finalizeBatchConversion } from './batch-conversion-finalize';
import { openBatchConversionSession } from './batch-conversion-session';
import { migrateProjectExecutorsToPlugin } from './executor-to-plugin-migrator';
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
  type SyntheticPlugin,
  type SyntheticPluginOptions,
} from './executor-to-plugin-migrator.test-utils';

// See the engine spec: keeps executor resolution honest to the temp workspace.
jest.mock('nx/src/utils/has-nx-js-plugin', () => ({
  hasNxJsPlugin: () => false,
}));

const OTHER_PLUGIN_PATH = '@acme/other/plugin';
const OTHER_EXECUTOR = '@acme/other:build';
const OTHER_CONFIG_FILE = 'other.config.json';
const OTHER_CONFIG_GLOB = `**/${OTHER_CONFIG_FILE}`;

function uniformExecutorTarget() {
  return {
    options: { config: SYNTHETIC_CONFIG_FILE, mode: 'production' },
    cache: true,
    outputs: ['{projectRoot}/dist'],
  };
}

function cleanTransformer(target: any) {
  if (target.options) {
    delete target.options.config;
    if (Object.keys(target.options).length === 0) {
      delete target.options;
    }
  }
  return target;
}

function migrationsFor(executor: string) {
  return [
    {
      executors: [executor],
      targetPluginOptionMapper: (targetName: string) => ({ targetName }),
      postTargetTransformer: cleanTransformer,
    },
  ];
}

describe('batch conversion finalize', () => {
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
    logger?: { warn: jest.Mock },
    migrations = migrationsFor(executor)
  ) {
    return () =>
      migrateProjectExecutorsToPlugin(
        ctx.tree,
        ctx.projectGraph,
        plugin.pluginPath,
        plugin.createNodes,
        { targetName: 'build' },
        migrations,
        undefined,
        logger as any
      );
  }

  async function runBatch(
    children: Array<() => unknown | Promise<unknown>>,
    finalizeLogger?: { warn: jest.Mock }
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

  function seedExecutorDefault(executor: string) {
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults[executor] = { cache: true };
    updateNxJson(ctx.tree, nxJson);
  }

  it('centralizes every plugin in the batch, not only the last', async () => {
    ctx = setupFixture('finalize-multi-plugin');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    for (const name of ['app3', 'app4']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        executor: OTHER_EXECUTOR,
        target: {
          ...uniformExecutorTarget(),
          options: { config: OTHER_CONFIG_FILE, mode: 'staging' },
        },
        configFile: OTHER_CONFIG_FILE,
      });
    }
    seedExecutorDefault(SYNTHETIC_EXECUTOR);
    seedExecutorDefault(OTHER_EXECUTOR);
    const pluginA = createSyntheticPlugin();
    const pluginB = createSyntheticPlugin(
      (root, targetName) => ({
        ...defaultInferredTarget(root, targetName),
        command: 'other-build',
      }),
      OTHER_PLUGIN_PATH,
      OTHER_CONFIG_GLOB
    );
    const warnA = jest.fn();
    const warnB = jest.fn();

    await runBatch([
      engineChild(pluginA, SYNTHETIC_EXECUTOR, { warn: warnA }),
      engineChild(pluginB, OTHER_EXECUTOR, { warn: warnB }),
    ]);

    // BOTH plugins centralized: first and last child alike. Both target names
    // are `build`, and each plugin exposes it on the other's (non-migrated)
    // roots in the combined pass: the source-map ownership oracle must keep
    // each plugin's candidate rather than rejecting on mere target presence.
    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    expect(targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
      {
        filter: { plugin: OTHER_PLUGIN_PATH },
        options: { mode: 'staging' },
      },
    ]);
    // uniform config: every deviation is empty
    for (const name of ['app1', 'app2', 'app3', 'app4']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    // batch-global dead-executor cleanup ran once, for both plugins
    expect(targetDefaults[SYNTHETIC_EXECUTOR]).toBeUndefined();
    expect(targetDefaults[OTHER_EXECUTOR]).toBeUndefined();
    // one child inference + one combined verification pass per plugin
    expect(pluginA.inferenceCount()).toBe(2);
    expect(pluginB.inferenceCount()).toBe(2);
    expect(warnA).not.toHaveBeenCalled();
    expect(warnB).not.toHaveBeenCalled();

    // the REAL pipeline resolves each plugin's centralized default onto its
    // own projects only
    const resolved = await resolveThroughRealPipeline(
      ctx,
      SYNTHETIC_PLUGIN_PATH,
      pluginA.createNodes,
      { [OTHER_PLUGIN_PATH]: pluginB.createNodes }
    );
    for (const name of ['app1', 'app2']) {
      expect(resolved[name].build.options?.mode).toBe('production');
      expect(
        resolved[name].build.options?.command ?? resolved[name].build.command
      ).toBe('acme-build');
    }
    for (const name of ['app3', 'app4']) {
      expect(resolved[name].build.options?.mode).toBe('staging');
      expect(
        resolved[name].build.options?.command ?? resolved[name].build.command
      ).toBe('other-build');
    }
  });

  it('produces the inline conversion result for a batch of one', async () => {
    const setupParityFixture = (label: string): FixtureContext => {
      const fixture = setupFixture(label);
      for (const name of ['app1', 'app2', 'app3']) {
        addExecutorProject(fixture, {
          name,
          root: name,
          targetName: 'build',
          target: uniformExecutorTarget(),
        });
      }
      // app3's package.json authors the target's identity: excluded from the
      // hoist with a warning, in both paths
      fixture.tree.write(
        'app3/package.json',
        JSON.stringify({ name: 'app3', scripts: { build: 'echo build' } })
      );
      const nxJson = readNxJson(fixture.tree);
      nxJson.targetDefaults[SYNTHETIC_EXECUTOR] = { cache: true };
      updateNxJson(fixture.tree, nxJson);
      return fixture;
    };

    ctx = setupParityFixture('finalize-parity-batch');
    const inlineCtx = setupParityFixture('finalize-parity-inline');
    try {
      const batchPlugin = createSyntheticPlugin();
      const inlinePlugin = createSyntheticPlugin();
      const batchWarn = jest.fn();
      const inlineWarn = jest.fn();

      await runBatch([
        engineChild(batchPlugin, SYNTHETIC_EXECUTOR, { warn: batchWarn }),
      ]);
      await migrateProjectExecutorsToPlugin(
        inlineCtx.tree,
        inlineCtx.projectGraph,
        inlinePlugin.pluginPath,
        inlinePlugin.createNodes,
        { targetName: 'build' },
        migrationsFor(SYNTHETIC_EXECUTOR),
        undefined,
        { warn: inlineWarn } as any
      );

      // byte-for-byte the inline single-conversion output
      for (const file of [
        'nx.json',
        'app1/project.json',
        'app2/project.json',
        'app3/project.json',
        'app3/package.json',
      ]) {
        expect(ctx.tree.read(file, 'utf-8')).toBe(
          inlineCtx.tree.read(file, 'utf-8')
        );
      }
      expect(batchWarn.mock.calls).toEqual(inlineWarn.mock.calls);
      expect(batchPlugin.inferenceCount()).toBe(inlinePlugin.inferenceCount());
    } finally {
      teardownFixture(inlineCtx.fs);
    }
  });

  it('keeps residuals for plans registered before an unattributed registration and skips dead-default cleanup', async () => {
    ctx = setupFixture('finalize-opaque-barrier');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    for (const name of ['app3', 'app4']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        executor: OTHER_EXECUTOR,
        target: uniformExecutorTarget(),
        configFile: OTHER_CONFIG_FILE,
      });
    }
    seedExecutorDefault(SYNTHETIC_EXECUTOR);
    seedExecutorDefault(OTHER_EXECUTOR);
    const pluginA = createSyntheticPlugin();
    const pluginB = createSyntheticPlugin(
      defaultInferredTarget,
      OTHER_PLUGIN_PATH,
      OTHER_CONFIG_GLOB
    );
    const warnA = jest.fn();
    const warnB = jest.fn();

    await runBatch([
      engineChild(pluginA, SYNTHETIC_EXECUTOR, { warn: warnA }),
      // a converter that registers a plugin the session cannot attribute to
      // any engine plan: an opaque barrier at its final position
      () => {
        const nxJson = readNxJson(ctx.tree);
        nxJson.plugins.push('@acme/rogue/plugin');
        updateNxJson(ctx.tree, nxJson);
      },
      engineChild(pluginB, OTHER_EXECUTOR, { warn: warnB }),
    ]);

    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    // plugin A registered before the barrier: retained with the tail-gate
    // reason; plugin B registered after it: centralized
    expect(targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: OTHER_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    for (const name of ['app3', 'app4']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    expect(warnA).toHaveBeenCalledWith(
      `convert-to-inferred retained full per-project configuration for target(s) build because another plugin is registered after ${SYNTHETIC_PLUGIN_PATH} in nx.json and may take over those targets; no configuration was lost, but shared configuration remains duplicated.`
    );
    expect(warnB).not.toHaveBeenCalled();
    // the unattributed registration makes executor liveness opaque: cleanup is
    // skipped entirely, even for the centralized plugin's dead executor
    expect(targetDefaults[SYNTHETIC_EXECUTOR]).toEqual({ cache: true });
    expect(targetDefaults[OTHER_EXECUTOR]).toEqual({ cache: true });
  });

  it('ignores foreign plugin registrations that precede every plan', async () => {
    ctx = setupFixture('finalize-preexisting-foreign');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    seedExecutorDefault(SYNTHETIC_EXECUTOR);
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = ['@acme/foreign/plugin'];
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await runBatch([engineChild(plugin, SYNTHETIC_EXECUTOR, { warn })]);

    // the foreign plugin merges BEFORE the migrated plugin, so it cannot take
    // the targets over: centralization and dead-default cleanup both proceed
    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    expect(targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(targetDefaults[SYNTHETIC_EXECUTOR]).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('centralizes same-name targets per plugin when their inference overlaps', async () => {
    // Both plugins glob the SAME config files, so each infers `build` on every
    // root. Plugin B is pre-registered (unscoped); plugin A registers after it
    // and merges later, so A owns `build` on its own roots while B owns it on
    // the rest. Presence-based exposure checks would reject both candidates;
    // the ownership oracle keeps both.
    ctx = setupFixture('finalize-same-name-ownership');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    for (const name of ['app3', 'app4']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        executor: OTHER_EXECUTOR,
        target: {
          ...uniformExecutorTarget(),
          options: { config: SYNTHETIC_CONFIG_FILE, mode: 'staging' },
        },
      });
    }
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [
      { plugin: OTHER_PLUGIN_PATH, options: { targetName: 'build' } },
    ];
    updateNxJson(ctx.tree, nxJson);
    const pluginA = createSyntheticPlugin();
    const pluginB = createSyntheticPlugin(
      (root, targetName) => ({
        ...defaultInferredTarget(root, targetName),
        command: 'other-build',
      }),
      OTHER_PLUGIN_PATH
    );
    const warnA = jest.fn();
    const warnB = jest.fn();

    await runBatch([
      engineChild(pluginB, OTHER_EXECUTOR, { warn: warnB }),
      engineChild(pluginA, SYNTHETIC_EXECUTOR, { warn: warnA }),
    ]);

    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    expect(targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: OTHER_PLUGIN_PATH },
        options: { mode: 'staging' },
      },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    for (const name of ['app1', 'app2', 'app3', 'app4']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    expect(warnA).not.toHaveBeenCalled();
    expect(warnB).not.toHaveBeenCalled();

    // through the REAL pipeline each root resolves its owner's default
    const resolved = await resolveThroughRealPipeline(
      ctx,
      SYNTHETIC_PLUGIN_PATH,
      pluginA.createNodes,
      { [OTHER_PLUGIN_PATH]: pluginB.createNodes }
    );
    for (const name of ['app1', 'app2']) {
      expect(
        resolved[name].build.options?.command ?? resolved[name].build.command
      ).toBe('acme-build');
      expect(resolved[name].build.options?.mode).toBe('production');
    }
    for (const name of ['app3', 'app4']) {
      expect(
        resolved[name].build.options?.command ?? resolved[name].build.command
      ).toBe('other-build');
      expect(resolved[name].build.options?.mode).toBe('staging');
    }
  });

  it('rejects centralization when the plugin owns the target on a non-migrated root', async () => {
    ctx = setupFixture('finalize-non-migrated-exposure');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // app3 has the plugin's config file but is not migrated (different
    // executor); the pre-registered unscoped plugin infers `build` for it, so
    // a centralized default would change its configuration
    addExecutorProject(ctx, {
      name: 'app3',
      root: 'app3',
      targetName: 'lint',
      executor: '@acme/other:lint',
    });
    seedExecutorDefault(SYNTHETIC_EXECUTOR);
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [
      { plugin: SYNTHETIC_PLUGIN_PATH, options: { targetName: 'build' } },
    ];
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await runBatch([engineChild(plugin, SYNTHETIC_EXECUTOR, { warn })]);

    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    expect(targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    expect(warn).toHaveBeenCalledWith(
      'convert-to-inferred kept per-project configuration for target(s) build instead of centralizing it: other projects inferred by this plugin would have inherited the centralized configuration (or the verification pass could not confirm they would not). The migrated projects keep the same output as before centralization.'
    );
    // pre-registered plugin: dead-default removal fails open
    expect(targetDefaults[SYNTHETIC_EXECUTOR]).toEqual({ cache: true });
  });

  it('attributes verification errors to the erroring plan only', async () => {
    ctx = setupFixture('finalize-error-attribution');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    for (const name of ['app3', 'app4']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        executor: OTHER_EXECUTOR,
        target: uniformExecutorTarget(),
        configFile: OTHER_CONFIG_FILE,
      });
    }
    // a config file plugin B always fails on, at a root outside its migrated
    // projects; B is pre-registered unscoped so the finalize pass reaches it
    ctx.fs.createFileSync(`extra/${OTHER_CONFIG_FILE}`, '{}');
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [
      { plugin: OTHER_PLUGIN_PATH, options: { targetName: 'build' } },
    ];
    updateNxJson(ctx.tree, nxJson);
    const pluginA = createSyntheticPlugin();
    const createNodesB: CreateNodes<SyntheticPluginOptions> = [
      OTHER_CONFIG_GLOB,
      (configFiles, options) => {
        const targetName = options?.targetName ?? 'build';
        const results: Array<readonly [string, any]> = [];
        const errors: Array<[string, Error]> = [];
        for (const file of configFiles) {
          const dir = dirname(file);
          const root = dir === '' || dir === '.' ? '.' : dir;
          if (root === 'extra') {
            errors.push([file, new Error('broken extra config')]);
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
    const warnA = jest.fn();
    const warnB = jest.fn();

    await runBatch([
      () =>
        migrateProjectExecutorsToPlugin(
          ctx.tree,
          ctx.projectGraph,
          OTHER_PLUGIN_PATH,
          createNodesB,
          { targetName: 'build' },
          migrationsFor(OTHER_EXECUTOR),
          undefined,
          { warn: warnB } as any
        ),
      engineChild(pluginA, SYNTHETIC_EXECUTOR, { warn: warnA }),
    ]);

    // plugin B's candidate is rejected (its error lies outside its migrated
    // roots); plugin A's is untouched by B's failure
    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    expect(targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    for (const name of ['app3', 'app4']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    expect(warnB).toHaveBeenCalledTimes(1);
    expect(warnB.mock.calls[0][0]).toContain(
      'kept per-project configuration for target(s) build'
    );
    expect(warnB.mock.calls[0][0]).toContain(
      'The verification pass reported errors:'
    );
    expect(warnA).not.toHaveBeenCalled();
  });

  it('keeps a pair full and surfaces the cause when verification no longer infers its target', async () => {
    ctx = setupFixture('finalize-missing-pair');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // app2's config errors only on the combined verification pass; the error
    // is owned by a migrated root, so the target-wide candidate survives and
    // only app2's pair falls back
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
          if (root === 'app2' && invocation >= 2) {
            errors.push([file, new Error('app2 config exploded')]);
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

    await runBatch([
      () =>
        migrateProjectExecutorsToPlugin(
          ctx.tree,
          ctx.projectGraph,
          SYNTHETIC_PLUGIN_PATH,
          createNodes,
          { targetName: 'build' },
          migrationsFor(SYNTHETIC_EXECUTOR),
          undefined,
          { warn } as any
        ),
    ]);

    expect(readNxJson(ctx.tree).targetDefaults.build).toStrictEqual([
      { cache: true },
      {
        filter: { plugin: SYNTHETIC_PLUGIN_PATH },
        options: { mode: 'production' },
      },
    ]);
    for (const name of ['app1', 'app3']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    expect(readJson(ctx.tree, 'app2/project.json').targets.build).toEqual({
      options: { mode: 'production' },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('app2 > build');
    expect(warn.mock.calls[0][0]).toContain('could not be verified');
    expect(warn.mock.calls[0][0]).toContain('app2 config exploded');
  });

  it('produces the inline result for a batch of one when verification diverges', async () => {
    const setupDivergenceFixture = (label: string): FixtureContext => {
      const fixture = setupFixture(label);
      for (const name of ['app1', 'app2', 'app3']) {
        addExecutorProject(fixture, {
          name,
          root: name,
          targetName: 'build',
          target: uniformExecutorTarget(),
        });
      }
      const nxJson = readNxJson(fixture.tree);
      nxJson.targetDefaults[SYNTHETIC_EXECUTOR] = { cache: true };
      updateNxJson(fixture.tree, nxJson);
      return fixture;
    };
    const divergentFactory = () =>
      createSyntheticPlugin((root, targetName, _options, invocation) => {
        const target = defaultInferredTarget(root, targetName);
        if (root === 'app3' && invocation >= 2) {
          target.outputs = ['{projectRoot}/divergent'];
        }
        return target;
      });

    ctx = setupDivergenceFixture('finalize-divergence-batch');
    const inlineCtx = setupDivergenceFixture('finalize-divergence-inline');
    try {
      const batchPlugin = divergentFactory();
      const inlinePlugin = divergentFactory();
      const batchWarn = jest.fn();
      const inlineWarn = jest.fn();

      await runBatch([
        engineChild(batchPlugin, SYNTHETIC_EXECUTOR, { warn: batchWarn }),
      ]);
      await migrateProjectExecutorsToPlugin(
        inlineCtx.tree,
        inlineCtx.projectGraph,
        inlinePlugin.pluginPath,
        inlinePlugin.createNodes,
        { targetName: 'build' },
        migrationsFor(SYNTHETIC_EXECUTOR),
        undefined,
        { warn: inlineWarn } as any
      );

      for (const file of [
        'nx.json',
        'app1/project.json',
        'app2/project.json',
        'app3/project.json',
      ]) {
        expect(ctx.tree.read(file, 'utf-8')).toBe(
          inlineCtx.tree.read(file, 'utf-8')
        );
      }
      expect(batchWarn.mock.calls).toEqual(inlineWarn.mock.calls);
    } finally {
      teardownFixture(inlineCtx.fs);
    }
  });

  it('recomputes package.json identity from the final tree', async () => {
    ctx = setupFixture('finalize-final-tree-identity');
    for (const name of ['app1', 'app2', 'app3']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await runBatch([
      engineChild(plugin, SYNTHETIC_EXECUTOR, { warn }),
      // a LATER child gives app3 a same-name script: when finalize runs, the
      // package-json plugin would author the target's identity there
      () => {
        ctx.tree.write(
          'app3/package.json',
          JSON.stringify({ name: 'app3', scripts: { build: 'echo build' } })
        );
      },
    ]);

    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    for (const name of ['app1', 'app2']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    // app3 excluded against the FINAL tree: full residual, exclusion warning
    expect(readJson(ctx.tree, 'app3/project.json').targets.build).toEqual({
      options: { mode: 'production' },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('1 project(s) (app3)');
    expect(warn.mock.calls[0][0]).toContain(
      'their target identity is authored outside the plugin'
    );
  });

  it("retains a target name that collides with another plan's inferred executor", async () => {
    ctx = setupFixture('finalize-union-executor-collision');
    // plugin A migrates a target NAMED `runner`; plugin B's inference emits
    // targets with `executor: 'runner'`. A hoisted `runner` key would resolve
    // as the EXECUTOR key for B's targets, so the union collision gate must
    // retain it even though A's own inference never emits that executor.
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'runner',
        target: uniformExecutorTarget(),
      });
    }
    for (const name of ['app3', 'app4']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        executor: OTHER_EXECUTOR,
        target: uniformExecutorTarget(),
        configFile: OTHER_CONFIG_FILE,
      });
    }
    const pluginA = createSyntheticPlugin();
    const pluginB = createSyntheticPlugin(
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
      OTHER_PLUGIN_PATH,
      OTHER_CONFIG_GLOB
    );
    const warnA = jest.fn();
    const warnB = jest.fn();

    await runBatch([
      engineChild(pluginA, SYNTHETIC_EXECUTOR, { warn: warnA }),
      engineChild(pluginB, OTHER_EXECUTOR, { warn: warnB }),
    ]);

    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    expect(targetDefaults.runner).toBeUndefined();
    expect(targetDefaults.build).toContainEqual({
      filter: { plugin: OTHER_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.runner).toEqual(
        { options: { mode: 'production' } }
      );
    }
    expect(warnA).toHaveBeenCalledWith(
      'convert-to-inferred retained full per-project configuration for target(s) runner because the target name would resolve as an executor or glob targetDefaults key and could apply to other targets; no configuration was lost, but shared configuration remains duplicated.'
    );
    expect(warnB).not.toHaveBeenCalled();
  });

  it('keeps an executor-keyed default alive while any project in the batch still uses the executor', async () => {
    ctx = setupFixture('finalize-batch-global-liveness');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    for (const name of ['app3', 'app4']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        executor: OTHER_EXECUTOR,
        target: uniformExecutorTarget(),
        configFile: OTHER_CONFIG_FILE,
      });
    }
    // app5 uses plugin A's executor but is skipped by the migration, so the
    // executor-keyed default still applies to it after the batch
    addExecutorProject(ctx, {
      name: 'app5',
      root: 'app5',
      targetName: 'build',
      target: uniformExecutorTarget(),
      configFile: 'unmatched.config.json',
    });
    seedExecutorDefault(SYNTHETIC_EXECUTOR);
    seedExecutorDefault(OTHER_EXECUTOR);
    const pluginA = createSyntheticPlugin();
    const pluginB = createSyntheticPlugin(
      defaultInferredTarget,
      OTHER_PLUGIN_PATH,
      OTHER_CONFIG_GLOB
    );
    const warnA = jest.fn();
    const warnB = jest.fn();

    await runBatch([
      engineChild(pluginA, SYNTHETIC_EXECUTOR, { warn: warnA }, [
        {
          executors: [SYNTHETIC_EXECUTOR],
          targetPluginOptionMapper: (targetName: string) => ({ targetName }),
          postTargetTransformer: cleanTransformer,
          skipProjectFilter: (project) =>
            project.root === 'app5' && 'not convertible in this test',
        },
      ]),
      engineChild(pluginB, OTHER_EXECUTOR, { warn: warnB }),
    ]);

    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    // app5 still resolves plugin A's executor: its default must survive;
    // plugin B's executor is fully migrated and its default is removed
    expect(targetDefaults[SYNTHETIC_EXECUTOR]).toEqual({ cache: true });
    expect(targetDefaults[OTHER_EXECUTOR]).toBeUndefined();
    // both plugins still centralized their migrated projects
    expect(targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(targetDefaults.build).toContainEqual({
      filter: { plugin: OTHER_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(readJson(ctx.tree, 'app5/project.json').targets.build.executor).toBe(
      SYNTHETIC_EXECUTOR
    );
  });

  it('retains centralization when an executor-keyed default for the inferred executor masks the exact entry', async () => {
    ctx = setupFixture('finalize-preflight-masking');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // the migrated pairs resolve to `nx:run-commands` (command-based inferred
    // targets); an executor-keyed default for it outranks the appended exact
    // `build` key, so the hoisted keys would silently never apply
    const nxJson = readNxJson(ctx.tree);
    nxJson.targetDefaults['nx:run-commands'] = { options: { color: true } };
    updateNxJson(ctx.tree, nxJson);
    const plugin = createSyntheticPlugin();
    const warn = jest.fn();

    await runBatch([engineChild(plugin, SYNTHETIC_EXECUTOR, { warn })]);

    const targetDefaults = readNxJson(ctx.tree).targetDefaults;
    expect(targetDefaults.build).toEqual({ cache: true });
    for (const name of ['app1', 'app2']) {
      expect(readJson(ctx.tree, `${name}/project.json`).targets.build).toEqual({
        options: { mode: 'production' },
      });
    }
    expect(warn).toHaveBeenCalledWith(
      'convert-to-inferred retained full per-project configuration for target(s) build because centralization would change which existing targetDefaults apply; no configuration was lost, but shared configuration remains duplicated.'
    );
  });

  it('centralizes package-based projects and prunes an emptied nx.targets', async () => {
    ctx = setupFixture('finalize-package-based');
    ctx.tree.write(
      'package.json',
      JSON.stringify({
        name: 'workspace',
        version: '0.0.1',
        workspaces: ['libs/*'],
      })
    );
    const variants: Record<string, string | undefined> = {
      pkg1: 'a',
      pkg2: 'b',
      pkg3: undefined,
    };
    for (const [name, variant] of Object.entries(variants)) {
      const root = `libs/${name}`;
      const target = {
        executor: SYNTHETIC_EXECUTOR,
        options: {
          config: SYNTHETIC_CONFIG_FILE,
          mode: 'production',
          ...(variant ? { variant } : {}),
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
    const warn = jest.fn();

    await runBatch([engineChild(plugin, SYNTHETIC_EXECUTOR, { warn })]);

    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    // deviations land in nx.targets; an emptied entry is removed entirely so
    // the executor-free target cannot linger
    expect(
      readJson(ctx.tree, 'libs/pkg1/package.json').nx.targets.build
    ).toEqual({ options: { variant: 'a' } });
    expect(
      readJson(ctx.tree, 'libs/pkg2/package.json').nx.targets.build
    ).toEqual({ options: { variant: 'b' } });
    expect(
      readJson(ctx.tree, 'libs/pkg3/package.json').nx.targets
    ).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();

    const resolved = await resolveThroughRealPipeline(
      ctx,
      plugin.pluginPath,
      plugin.createNodes
    );
    for (const name of Object.keys(variants)) {
      expect(resolved[`libs/${name}`].build.executor).not.toBe(
        SYNTHETIC_EXECUTOR
      );
      expect(resolved[`libs/${name}`].build.options?.mode).toBe('production');
    }
  });

  it('restores the conservative state when applying the write-set fails', async () => {
    ctx = setupFixture('finalize-apply-rollback');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    seedExecutorDefault(SYNTHETIC_EXECUTOR);
    const plugin = createSyntheticPlugin();
    const finalizeWarn = jest.fn();

    const session = openBatchConversionSession(ctx.tree);
    try {
      await session.runChild(() =>
        migrateProjectExecutorsToPlugin(
          ctx.tree,
          ctx.projectGraph,
          plugin.pluginPath,
          plugin.createNodes,
          { targetName: 'build' },
          migrationsFor(SYNTHETIC_EXECUTOR)
        )
      );

      // a mode staged on a file the apply rewrites must survive the rollback
      ctx.tree.changePermissions('app1/project.json', '755');
      const before = {
        nxJson: ctx.tree.read('nx.json', 'utf-8'),
        app1: ctx.tree.read('app1/project.json', 'utf-8'),
        app2: ctx.tree.read('app2/project.json', 'utf-8'),
      };
      // nx.json and app1 are written, then app2's write fails mid-apply
      const realWrite = ctx.tree.write.bind(ctx.tree);
      let armed = true;
      (ctx.tree as any).write = (
        path: string,
        content: string | Buffer,
        options?: unknown
      ) => {
        if (armed && path === 'app2/project.json') {
          armed = false;
          throw new Error('synthetic disk failure');
        }
        return realWrite(path, content, options as any);
      };

      await finalizeBatchConversion(ctx.tree, session, {
        warn: finalizeWarn,
      } as any);

      expect(ctx.tree.read('nx.json', 'utf-8')).toBe(before.nxJson);
      expect(ctx.tree.read('app1/project.json', 'utf-8')).toBe(before.app1);
      expect(ctx.tree.read('app2/project.json', 'utf-8')).toBe(before.app2);
      expect(
        ctx.tree
          .listChanges()
          .find((change) => change.path === 'app1/project.json')?.options?.mode
      ).toBe('755');
      expect(finalizeWarn).toHaveBeenCalledTimes(1);
      expect(finalizeWarn.mock.calls[0][0]).toContain(
        'could not centralize the shared configuration for this batch'
      );
      expect(finalizeWarn.mock.calls[0][0]).toContain('synthetic disk failure');
      expect(finalizeWarn.mock.calls[0][0]).toContain(
        'restored to their pre-centralization state'
      );
    } finally {
      session.close();
    }
  });

  it('preserves staged file modes through the apply write-set', async () => {
    ctx = setupFixture('finalize-apply-modes');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    const plugin = createSyntheticPlugin();

    const session = openBatchConversionSession(ctx.tree);
    try {
      await session.runChild(() =>
        migrateProjectExecutorsToPlugin(
          ctx.tree,
          ctx.projectGraph,
          plugin.pluginPath,
          plugin.createNodes,
          { targetName: 'build' },
          migrationsFor(SYNTHETIC_EXECUTOR)
        )
      );
      // modes staged between the children and the finalize pass (e.g. by a
      // converter generator) must survive the apply rewrites
      ctx.tree.changePermissions('nx.json', '755');
      ctx.tree.changePermissions('app1/project.json', '755');
      await finalizeBatchConversion(ctx.tree, session);
    } finally {
      session.close();
    }

    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    expect(
      readJson(ctx.tree, 'app1/project.json').targets.build
    ).toBeUndefined();
    const optionsFor = (path: string) =>
      ctx.tree.listChanges().find((change) => change.path === path)?.options;
    expect(optionsFor('nx.json')?.mode).toBe('755');
    expect(optionsFor('app1/project.json')?.mode).toBe('755');
  });

  it('produces the inline result for a batch of one when nx.json extends a preset', async () => {
    const PRESET_PACKAGE = '@acme/preset';
    const PRESET_FILE = 'nx-preset.json';
    const setupExtendsFixture = (label: string): FixtureContext => {
      const fixture = setupFixture(label);
      for (const name of ['app1', 'app2']) {
        addExecutorProject(fixture, {
          name,
          root: name,
          targetName: 'build',
          target: uniformExecutorTarget(),
        });
      }
      // a preset contributing an unchanged inherited top-level property
      fixture.fs.createFileSync(
        `node_modules/${PRESET_PACKAGE}/package.json`,
        JSON.stringify({ name: PRESET_PACKAGE, version: '0.0.1' })
      );
      fixture.fs.createFileSync(
        `node_modules/${PRESET_PACKAGE}/${PRESET_FILE}`,
        JSON.stringify({
          namedInputs: { default: ['{projectRoot}/**/*'] },
        })
      );
      const rawNxJson = readJson(fixture.tree, 'nx.json');
      rawNxJson.extends = `${PRESET_PACKAGE}/${PRESET_FILE}`;
      rawNxJson.targetDefaults[SYNTHETIC_EXECUTOR] = { cache: true };
      writeJson(fixture.tree, 'nx.json', rawNxJson);
      return fixture;
    };

    ctx = setupExtendsFixture('finalize-extends-batch');
    const inlineCtx = setupExtendsFixture('finalize-extends-inline');
    try {
      const batchPlugin = createSyntheticPlugin();
      const inlinePlugin = createSyntheticPlugin();

      await runBatch([engineChild(batchPlugin, SYNTHETIC_EXECUTOR)]);
      await migrateProjectExecutorsToPlugin(
        inlineCtx.tree,
        inlineCtx.projectGraph,
        inlinePlugin.pluginPath,
        inlinePlugin.createNodes,
        { targetName: 'build' },
        migrationsFor(SYNTHETIC_EXECUTOR)
      );

      expect(ctx.tree.read('nx.json', 'utf-8')).toBe(
        inlineCtx.tree.read('nx.json', 'utf-8')
      );
      // the unchanged inherited property stays inherited: pinning it locally
      // would stop later preset changes from flowing through
      expect(readJson(ctx.tree, 'nx.json').namedInputs).toBeUndefined();
      expect(readJson(ctx.tree, 'nx.json').targetDefaults.build).toContainEqual(
        {
          filter: { plugin: SYNTHETIC_PLUGIN_PATH },
          options: { mode: 'production' },
        }
      );
    } finally {
      teardownFixture(inlineCtx.fs);
    }
  });

  it('does nothing when the batch staged no plans', async () => {
    ctx = setupFixture('finalize-no-plans');
    addExecutorProject(ctx, {
      name: 'app1',
      root: 'app1',
      targetName: 'build',
      target: uniformExecutorTarget(),
    });
    const nxJsonBefore = ctx.tree.read('nx.json', 'utf-8');
    const finalizeWarn = jest.fn();

    await runBatch([async () => {}], { warn: finalizeWarn });

    expect(ctx.tree.read('nx.json', 'utf-8')).toBe(nxJsonBefore);
    expect(finalizeWarn).not.toHaveBeenCalled();
  });

  it('verifies every migrated pair, including targets with no centralization candidate', async () => {
    ctx = setupFixture('finalize-verify-all-pairs');
    // a single migrated project: no strict common is possible, yet the pair
    // must still be verified against the combined pass
    addExecutorProject(ctx, {
      name: 'app1',
      root: 'app1',
      targetName: 'build',
      target: uniformExecutorTarget(),
    });
    const plugin = createSyntheticPlugin(
      (root, targetName, _options, invocation) => {
        const target = defaultInferredTarget(root, targetName);
        if (invocation >= 2) {
          target.outputs = ['{projectRoot}/divergent'];
        }
        return target;
      }
    );
    const warn = jest.fn();

    await runBatch([engineChild(plugin, SYNTHETIC_EXECUTOR, { warn })]);

    // nothing was centralized, but the divergence is still reported
    expect(readNxJson(ctx.tree).targetDefaults.build).toEqual({ cache: true });
    expect(readJson(ctx.tree, 'app1/project.json').targets.build).toEqual({
      options: { mode: 'production' },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('app1 > build');
    expect(warn.mock.calls[0][0]).toContain('could not be verified');
  });

  it('surfaces verification errors that no revert or fallback carries', async () => {
    ctx = setupFixture('finalize-standalone-errors');
    for (const name of ['app1', 'app2']) {
      addExecutorProject(ctx, {
        name,
        root: name,
        targetName: 'build',
        target: uniformExecutorTarget(),
      });
    }
    // a non-migrated config NESTED under migrated root app1 that errors only
    // on the combined pass: owned by app1 (no revert), contributes no migrated
    // pair (no fallback): the standalone warning must carry the errors
    ctx.fs.createFileSync('app1/nested/build.config.json', '{}');
    const nxJson = readNxJson(ctx.tree);
    nxJson.plugins = [
      { plugin: SYNTHETIC_PLUGIN_PATH, options: { targetName: 'build' } },
    ];
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
              errors.push([file, new Error('broken nested config')]);
            }
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

    await runBatch([
      () =>
        migrateProjectExecutorsToPlugin(
          ctx.tree,
          ctx.projectGraph,
          SYNTHETIC_PLUGIN_PATH,
          createNodes,
          { targetName: 'build' },
          migrationsFor(SYNTHETIC_EXECUTOR),
          undefined,
          { warn } as any
        ),
    ]);

    // the error did not block centralization, but it is not silent either
    expect(readNxJson(ctx.tree).targetDefaults.build).toContainEqual({
      filter: { plugin: SYNTHETIC_PLUGIN_PATH },
      options: { mode: 'production' },
    });
    for (const name of ['app1', 'app2']) {
      expect(
        readJson(ctx.tree, `${name}/project.json`).targets.build
      ).toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('could not fully verify');
    expect(warn.mock.calls[0][0]).toContain('broken nested config');
  });
});
