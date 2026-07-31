import type { TargetDefaults } from 'nx/src/devkit-exports';
import {
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
