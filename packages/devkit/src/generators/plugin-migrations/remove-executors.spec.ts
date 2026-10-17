import {
  addProjectConfiguration,
  logger,
  readNxJson,
  readProjectConfiguration,
  updateProjectConfiguration,
  updateNxJson,
  type Tree,
} from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { NoTargetsToMigrateError } from './executor-to-plugin-migrator';
import { migrateRemovedExecutors } from './remove-executors';

describe('migrateRemovedExecutors', () => {
  const executors = ['@nx/next:build'];

  function removeTarget(tree: Tree, project: string, target: string) {
    const config = readProjectConfiguration(tree, project);
    delete config.targets[target];
    updateProjectConfiguration(tree, project, config);
  }

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
});
