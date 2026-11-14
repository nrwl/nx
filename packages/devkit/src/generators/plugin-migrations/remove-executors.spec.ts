import {
  addProjectConfiguration,
  createProjectGraphAsync,
  logger,
  readNxJson,
  readProjectConfiguration,
  updateProjectConfiguration,
  updateNxJson,
  type Tree,
} from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import {
  nxProjectGraph,
  nxSourceMaps,
} from 'nx/src/project-graph/nx-deps-cache';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { NoTargetsToMigrateError } from './executor-to-plugin-migrator';
import { migrateRemovedExecutors } from './remove-executors';

describe('migrateRemovedExecutors', () => {
  const executors = ['@nx/next:build'];

  function removeTarget(tree: Tree, project: string, target: string) {
    const config = readProjectConfiguration(tree, project);
    delete config.targets[target];
    updateProjectConfiguration(tree, project, config);
  }

  function writeCachedGraph(
    targets: Record<string, { executor: string }> = {},
    sourceMap: Record<string, [string, string]> = {}
  ) {
    mkdirSync(dirname(nxProjectGraph), { recursive: true });
    writeFileSync(
      nxProjectGraph,
      JSON.stringify({
        nodes: {
          app: { name: 'app', type: 'app', data: { root: 'app', targets } },
        },
        dependencies: {},
      })
    );
    writeFileSync(nxSourceMaps, JSON.stringify({ app: sourceMap }));
  }

  function removeCachedGraph() {
    rmSync(nxProjectGraph, { force: true });
    rmSync(nxSourceMaps, { force: true });
  }

  beforeEach(() => writeCachedGraph());
  afterEach(() => {
    removeCachedGraph();
    delete globalThis[
      Symbol.for('@nx/devkit/remove-executors/graph-unavailable')
    ];
  });

  it('skips the prompt only when there is nothing to convert', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const convert = vi.fn();
    expect(await migrateRemovedExecutors(tree, executors, convert)).toEqual({
      skipAgentic: true,
    });
    expect(convert).not.toHaveBeenCalled();
  });

  it('converts the whole workspace once and preserves the original configuration', async () => {
    const tree = createTreeWithEmptyWorkspace();
    for (const name of ['app', 'other']) {
      addProjectConfiguration(tree, name, {
        root: name,
        targets: {
          bundle: {
            executor: executors[0],
            options: { outputPath: `dist/${name}` },
          },
        },
      });
    }
    const install = vi.fn();
    const convert = vi.fn(async (tree: Tree) => {
      removeTarget(tree, 'app', 'bundle');
      removeTarget(tree, 'other', 'bundle');
      return install;
    });
    const result = await migrateRemovedExecutors(tree, executors, convert);
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith(tree, { skipFormat: true });
    expect(result.skipAgentic).not.toBe(true);
    expect(result.nextSteps).toBeUndefined();
    expect(result.agentContext.join('\n')).toContain('dist/app');
    expect(install).not.toHaveBeenCalled();
  });

  it('hands conversion errors to the prompt and keeps partial edits', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'app',
      targets: { build: { executor: executors[0] } },
    });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const result = await migrateRemovedExecutors(tree, executors, async () => {
      tree.write('app/next.config.js', 'module.exports = {};');
      throw new Error('custom configuration');
    });
    expect(result.agentContext.join('\n')).toContain('custom configuration');
    expect(result.nextSteps.join('\n')).toContain('custom configuration');
    expect(tree.exists('app/next.config.js')).toBe(true);
    warn.mockRestore();
  });

  it('names targets the converter skipped', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'app',
      targets: {
        'build-ios': { executor: executors[0] },
        'build-android': { executor: executors[0] },
      },
    });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    // A converter can only claim one target per plugin option, so it converts
    // one and returns without error.
    const result = await migrateRemovedExecutors(
      tree,
      executors,
      async (tree) => removeTarget(tree, 'app', 'build-ios')
    );
    const context = result.agentContext.join('\n');
    expect(context).toContain('app:build-android');
    expect(context).not.toContain('app:build-ios');
    expect(result.nextSteps.join('\n')).toContain('app:build-android');
    warn.mockRestore();
  });

  it('names targets when the converter skipped all of them', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'app',
      targets: { build: { executor: executors[0] } },
    });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const result = await migrateRemovedExecutors(tree, executors, async () => {
      throw new NoTargetsToMigrateError();
    });
    const context = result.agentContext.join('\n');
    expect(context).not.toContain('Conversion needs repair');
    expect(context).toContain('app:build');
    warn.mockRestore();
  });

  it('removes executor defaults the converted targets absorbed', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'app',
      targets: { build: { executor: executors[0] } },
    });
    updateNxJson(tree, {
      targetDefaults: {
        [executors[0]]: { cache: true },
        lint: { cache: true },
      },
    });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const result = await migrateRemovedExecutors(tree, executors, async () =>
      removeTarget(tree, 'app', 'build')
    );
    expect(readNxJson(tree).targetDefaults).toEqual({ lint: { cache: true } });
    expect(result.agentContext.join('\n')).toContain('"cache":true');
    expect(result.nextSteps).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it.each([
    [
      'a target the converter skipped',
      { [executors[0]]: { cache: true } },
      { build: { executor: executors[0] }, other: { executor: executors[0] } },
    ],
    [
      'targets inheriting it from a target default',
      { [executors[0]]: { cache: true }, test: { executor: executors[0] } },
      { build: { executor: executors[0] }, test: {} },
    ],
    [
      'only the projects of a filtered entry',
      { [executors[0]]: [{ filter: { projects: ['app'] }, cache: true }] },
      { build: { executor: executors[0] } },
    ],
  ])(
    'keeps executor defaults that still configure %s',
    async (_, targetDefaults, targets) => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', { root: 'app', targets });
      updateNxJson(tree, { targetDefaults });
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      await migrateRemovedExecutors(tree, executors, async () =>
        removeTarget(tree, 'app', 'build')
      );
      expect(readNxJson(tree).targetDefaults).toEqual(targetDefaults);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `targetDefaults still use removed executors: ${executors[0]}`
        )
      );
      warn.mockRestore();
    }
  );

  it('requires the prompt for inherited executors in filtered defaults', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateNxJson(tree, {
      targetDefaults: {
        build: [{ filter: { projects: ['app'] }, executor: executors[0] }],
      },
    });
    const result = await migrateRemovedExecutors(tree, executors, vi.fn());
    expect(result.skipAgentic).not.toBe(true);
    expect(result.agentContext.join('\n')).toContain(executors[0]);
  });

  it('warns about targetDefaults that still set a removed executor', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'app',
      targets: { test: {} },
    });
    updateNxJson(tree, {
      targetDefaults: { test: { executor: executors[0] } },
    });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const result = await migrateRemovedExecutors(tree, executors, vi.fn());
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'targetDefaults still use removed executors: test'
      )
    );
    expect(result.nextSteps.join('\n')).toContain('test');
    warn.mockRestore();
  });

  describe('targets created by plugins', () => {
    it('names them with the plugin that creates them', async () => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', { root: 'app' });
      writeCachedGraph(
        { 'e2e-ci--a': { executor: executors[0] } },
        { 'targets.e2e-ci--a.executor': ['app/e2e.ts', './tools/atomizer'] }
      );
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const convert = vi.fn();
      const result = await migrateRemovedExecutors(tree, executors, convert);
      expect(result.skipAgentic).not.toBe(true);
      expect(convert).not.toHaveBeenCalled();
      const expected = `app:e2e-ci--a (${executors[0]}, from ./tools/atomizer)`;
      expect(result.nextSteps.join('\n')).toContain(expected);
      expect(result.agentContext.join('\n')).toContain(expected);
      warn.mockRestore();
    });

    it('names a plugin target that project configuration only adds options to', async () => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', {
        root: 'app',
        targets: { e2e: { options: { ci: true } } },
      });
      writeCachedGraph(
        { e2e: { executor: executors[0] } },
        { 'targets.e2e': ['app/e2e.ts', './tools/atomizer'] }
      );
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const result = await migrateRemovedExecutors(tree, executors, vi.fn());
      expect(result.nextSteps.join('\n')).toContain(
        'app:e2e (@nx/next:build, from ./tools/atomizer)'
      );
      warn.mockRestore();
    });

    it('keeps executor defaults that still configure them', async () => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', { root: 'app' });
      const targetDefaults = { [executors[0]]: { cache: true } };
      updateNxJson(tree, { targetDefaults });
      writeCachedGraph(
        { e2e: { executor: executors[0] } },
        { 'targets.e2e': ['app/e2e.ts', './tools/atomizer'] }
      );
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      await migrateRemovedExecutors(tree, executors, vi.fn());
      expect(readNxJson(tree).targetDefaults).toEqual(targetDefaults);
      warn.mockRestore();
    });

    it('leaves targets declared in project configuration to the converter', async () => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', {
        root: 'app',
        targets: { build: { executor: executors[0] } },
      });
      writeCachedGraph({ build: { executor: executors[0] } }, {});
      const result = await migrateRemovedExecutors(tree, executors, async () =>
        removeTarget(tree, 'app', 'build')
      );
      expect(result.nextSteps).toBeUndefined();
      expect(result.agentContext.join('\n')).not.toContain(
        'created by plugins'
      );
    });

    it('leaves executors inherited from targetDefaults to the defaults report', async () => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', {
        root: 'app',
        targets: { test: {} },
      });
      updateNxJson(tree, {
        targetDefaults: { test: { executor: executors[0] } },
      });
      writeCachedGraph(
        { test: { executor: executors[0] } },
        { 'targets.test.executor': ['nx.json', 'nx/target-defaults'] }
      );
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const result = await migrateRemovedExecutors(tree, executors, vi.fn());
      expect(result.agentContext.join('\n')).not.toContain(
        'created by plugins'
      );
      warn.mockRestore();
    });

    it('creates the graph when none is cached', async () => {
      removeCachedGraph();
      vi.mocked(createProjectGraphAsync).mockResolvedValueOnce({
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: { root: 'app', targets: { e2e: { executor: executors[0] } } },
          },
        },
        dependencies: {},
      });
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', { root: 'app' });
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const result = await migrateRemovedExecutors(tree, executors, vi.fn());
      expect(result.nextSteps.join('\n')).toContain(
        `app:e2e (${executors[0]})`
      );
      warn.mockRestore();
    });

    it('notes that they were not checked when the graph cannot be created', async () => {
      removeCachedGraph();
      vi.mocked(createProjectGraphAsync).mockRejectedValueOnce(
        new Error('plugin failed')
      );
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', {
        root: 'app',
        targets: { build: { executor: executors[0] } },
      });
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const result = await migrateRemovedExecutors(tree, executors, async () =>
        removeTarget(tree, 'app', 'build')
      );
      const note = 'targets created by plugins were not checked';
      expect(result.nextSteps.join('\n')).toContain(note);
      expect(result.agentContext.join('\n')).toContain(note);
      warn.mockRestore();
    });

    it('notes that they were not checked when the graph cannot be created and nothing else uses a removed executor', async () => {
      removeCachedGraph();
      vi.mocked(createProjectGraphAsync).mockRejectedValueOnce(
        new Error('plugin failed')
      );
      const tree = createTreeWithEmptyWorkspace();
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const result = await migrateRemovedExecutors(tree, executors, vi.fn());
      expect(result).toEqual({
        skipAgentic: true,
        nextSteps: [
          expect.stringContaining(
            'targets created by plugins were not checked'
          ),
        ],
      });
      warn.mockRestore();
    });

    it('creates the graph once when it cannot be created', async () => {
      removeCachedGraph();
      vi.mocked(createProjectGraphAsync).mockClear();
      vi.mocked(createProjectGraphAsync).mockRejectedValueOnce(
        new Error('plugin failed')
      );
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const note = 'targets created by plugins were not checked';
      for (const executor of ['@nx/next:build', '@nx/jest:jest']) {
        const tree = createTreeWithEmptyWorkspace();
        const result = await migrateRemovedExecutors(tree, [executor], vi.fn());
        expect(result.nextSteps.join('\n')).toContain(note);
      }
      expect(createProjectGraphAsync).toHaveBeenCalledTimes(1);
      expect(
        warn.mock.calls.filter(([message]) => String(message).includes(note))
      ).toHaveLength(1);
      warn.mockRestore();
    });
  });
});
