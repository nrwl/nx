import { addProjectConfiguration } from 'nx/src/generators/utils/project-configuration';
import type { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';
import { migrateProjectExecutorsToPlugin } from './executor-to-plugin-migrator';
import {
  createSyntheticPlugin,
  setupFixture,
  teardownFixture,
  SYNTHETIC_CONFIG_FILE,
  type FixtureContext,
} from './executor-to-plugin-migrator.test-utils';

/**
 * Synthetic large-workspace benchmark mirroring the clickup-frontend profile:
 * ~600 projects, each with a `lint` + `test` executor target (mostly uniform,
 * a few deviating). It pins the two headline properties of the rewrite:
 *
 *   1. whole-workspace inference passes stay single-digit (O(distinct option
 *      sets) + 1 verify), NOT O(projects) — the previous engine ran
 *      ~(targets + 2*projects) passes, i.e. thousands here.
 *   2. total emitted config (nx.json + every project.json) does not grow —
 *      shared config is centralized once instead of duplicated per project.
 */

const LINT_EXECUTOR = '@acme/tool:lint';
const TEST_EXECUTOR = '@acme/tool:test';
const LINT_PLUGIN_PATH = '@acme/eslint/plugin';
const TEST_PLUGIN_PATH = '@acme/jest/plugin';
const PROJECT_COUNT = 600;
// A handful of projects deviate from the uniform config.
const DEVIATING = new Set([7, 42, 123, 456, 599]);

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

function addBenchProject(ctx: FixtureContext, index: number): string {
  const name = `app${index}`;
  const root = `packages/${name}`;
  const deviating = DEVIATING.has(index);
  const project = {
    name,
    root,
    projectType: 'application' as const,
    targets: {
      lint: executorTarget(LINT_EXECUTOR, deviating),
      test: executorTarget(TEST_EXECUTOR, deviating),
    },
  };
  addProjectConfiguration(ctx.tree, name, project);
  ctx.projectGraph.nodes[name] = {
    name,
    type: 'app',
    data: { root, targets: project.targets } as any,
  };
  ctx.fs.createFileSync(`${root}/${SYNTHETIC_CONFIG_FILE}`, '{}');
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

  it('runs single-digit inference passes and does not grow emitted config', async () => {
    ctx = setupFixture('bench');
    const lintPlugin = createSyntheticPlugin(undefined, LINT_PLUGIN_PATH);
    const testPlugin = createSyntheticPlugin(undefined, TEST_PLUGIN_PATH);

    const roots: string[] = [];
    for (let i = 0; i < PROJECT_COUNT; i++) {
      roots.push(addBenchProject(ctx, i));
    }

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

    // De-bloat: centralized config must not exceed the per-project executor
    // config it replaced.
    expect(postBytes).toBeLessThanOrEqual(preBytes);

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
});
