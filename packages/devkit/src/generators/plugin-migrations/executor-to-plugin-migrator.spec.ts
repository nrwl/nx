import type { TargetDefaults } from 'nx/src/devkit-exports';
import {
  collectMigrationScope,
  migrateProjectExecutorsToPlugin,
  readTargetDefaultsForExecutor,
} from './executor-to-plugin-migrator';
import {
  addExecutorProject,
  createSyntheticPlugin,
  setupFixture,
  teardownFixture,
  SYNTHETIC_CONFIG_FILE,
  SYNTHETIC_EXECUTOR,
  type FixtureContext,
} from './executor-to-plugin-migrator.test-utils';

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

  // NOTE: Task 2 flips these expectations to `distinctOptionSets + 1` (a
  // constant, independent of project count). Today the engine runs a
  // whole-workspace inference pass once per target, once per project (to parse
  // each project's config) and once more per project (the include-necessity
  // check) => `targets + 2 * projects`.
  it('scales as ~(targets + 2 * projects) today (status quo, pre-rewrite)', async () => {
    const passes = await migrateUniformFixture(3);
    // 1 target inference + 3 registration parses + 3 include-necessity checks
    expect(passes).toBe(1 + 2 * 3);
  });

  it('grows with project count today (status quo, pre-rewrite)', async () => {
    const passes = await migrateUniformFixture(5);
    expect(passes).toBe(1 + 2 * 5);
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
