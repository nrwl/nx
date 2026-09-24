import {
  addProjectConfiguration,
  readProjectConfiguration,
  updateProjectConfiguration,
  updateNxJson,
} from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { migrateRemovedExecutors } from './remove-executors';

describe('migrateRemovedExecutors', () => {
  const executors = ['@nx/next:build'];

  it('skips the prompt only when there is nothing to convert', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const convert = jest.fn();
    expect(await migrateRemovedExecutors(tree, executors, convert)).toEqual({
      skipAgentic: true,
    });
    expect(convert).not.toHaveBeenCalled();
  });

  it('preserves the original configuration and leaves installs to the runner', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'app',
      targets: {
        bundle: { executor: executors[0], options: { outputPath: 'dist/app' } },
      },
    });
    updateNxJson(tree, { targetDefaults: { [executors[0]]: { cache: true } } });
    const install = jest.fn();
    const result = await migrateRemovedExecutors(
      tree,
      executors,
      async (tree, options) => {
        const project = readProjectConfiguration(tree, options.project);
        delete project.targets.bundle;
        updateProjectConfiguration(tree, options.project, project);
        return install;
      }
    );
    expect(result.skipAgentic).not.toBe(true);
    expect(result.agentContext.join('\n')).toContain('dist/app');
    expect(result.agentContext.join('\n')).toContain('"cache":true');
    expect(install).not.toHaveBeenCalled();
  });

  it('continues other projects and hands partial conversion errors to the prompt', async () => {
    const tree = createTreeWithEmptyWorkspace();
    for (const name of ['broken', 'working']) {
      addProjectConfiguration(tree, name, {
        root: name,
        targets: { build: { executor: executors[0] } },
      });
    }
    const convert = jest.fn(async (tree, { project }) => {
      if (project === 'broken') {
        tree.write('broken/next.config.js', 'module.exports = {};');
        throw new Error('custom configuration');
      }
    });
    const result = await migrateRemovedExecutors(tree, executors, convert);
    expect(convert).toHaveBeenCalledTimes(2);
    expect(result.agentContext.join('\n')).toContain('custom configuration');
    expect(result.skipAgentic).not.toBe(true);
    expect(tree.exists('broken/next.config.js')).toBe(true);
  });

  it('names targets a successful converter left behind', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'app',
      targets: {
        'build-ios': { executor: executors[0] },
        'build-android': { executor: executors[0] },
      },
    });
    // A converter can only claim one target per plugin option, so it converts
    // one and returns without error.
    const result = await migrateRemovedExecutors(
      tree,
      executors,
      async (tree, options) => {
        const project = readProjectConfiguration(tree, options.project);
        delete project.targets['build-ios'];
        updateProjectConfiguration(tree, options.project, project);
      }
    );
    const context = result.agentContext.join('\n');
    expect(context).toContain('app:build-android');
    expect(context).not.toContain('app:build-ios');
  });

  it('requires the prompt for inherited executors in filtered defaults', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateNxJson(tree, {
      targetDefaults: {
        build: [{ filter: { projects: ['app'] }, executor: executors[0] }],
      },
    });
    const result = await migrateRemovedExecutors(tree, executors, jest.fn());
    expect(result.skipAgentic).not.toBe(true);
    expect(result.agentContext.join('\n')).toContain(executors[0]);
  });
});
