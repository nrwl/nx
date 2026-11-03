import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type TargetConfiguration,
  type TargetDefaults,
  type Tree,
} from 'nx/src/devkit-exports';
import { addReadyWhenSignalToTargets } from './add-ready-when-signal';

const executor = '@acme/web:serve';
const portCheck = { port: 4200 };

describe('addReadyWhenSignalToTargets', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setup(serve: TargetConfiguration, targetDefaults?: TargetDefaults) {
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      tags: ['web'],
      targets: { serve },
    });
    if (targetDefaults) {
      updateNxJson(tree, { ...readNxJson(tree), targetDefaults });
    }
  }

  const readServe = () => readProjectConfiguration(tree, 'app').targets.serve;

  it('adds a signal readyWhen to the targets running a listed executor', async () => {
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        serve: { executor, options: { port: 4200 } },
        'serve-ssr': { executor: '@acme/web:serve-ssr', continuous: true },
        build: { executor: '@acme/web:build' },
        dev: { command: 'acme serve' },
      },
    });

    const result = await addReadyWhenSignalToTargets(tree, [
      executor,
      '@acme/web:serve-ssr',
    ]);

    expect(result).toBeUndefined();
    expect(readProjectConfiguration(tree, 'app').targets).toEqual({
      serve: {
        executor,
        options: { port: 4200 },
        readyWhen: { signal: true },
      },
      'serve-ssr': {
        executor: '@acme/web:serve-ssr',
        continuous: true,
        readyWhen: { signal: true },
      },
      build: { executor: '@acme/web:build' },
      dev: { command: 'acme serve' },
    });
    expect(
      await addReadyWhenSignalToTargets(tree, [executor, '@acme/web:serve-ssr'])
    ).toEqual({ skipAgentic: true });
  });

  it.each([[portCheck], [null]])(
    'leaves a target that sets readyWhen to %j alone',
    async (readyWhen) => {
      setup({ executor, readyWhen });

      expect(await addReadyWhenSignalToTargets(tree, [executor])).toEqual({
        skipAgentic: true,
      });
      expect(readServe().readyWhen).toEqual(readyWhen);
    }
  );

  it.each<[string, TargetConfiguration, TargetDefaults | undefined]>([
    [
      'the target sets continuous: false',
      { executor, continuous: false },
      undefined,
    ],
    [
      'the applicable default sets continuous: false',
      { executor },
      { [executor]: { continuous: false } },
    ],
    [
      'the executor-keyed default sets readyWhen',
      { executor },
      { [executor]: { readyWhen: portCheck } },
    ],
    [
      'the target-name default sets readyWhen to null',
      { executor },
      { serve: { readyWhen: null } },
    ],
    [
      'a default filtered to the project sets readyWhen',
      { executor },
      { serve: [{ filter: { projects: ['tag:web'] }, readyWhen: portCheck }] },
    ],
  ])('skips the target when %s', async (_, serve, targetDefaults) => {
    setup(serve, targetDefaults);

    await addReadyWhenSignalToTargets(tree, [executor]);

    expect(readServe().readyWhen).toBeUndefined();
  });

  it.each<[string, TargetDefaults]>([
    [
      'the executor-keyed default shadows the one that sets readyWhen',
      {
        [executor]: { options: { port: 4300 } },
        serve: { readyWhen: portCheck },
      },
    ],
    [
      'the selected default that sets readyWhen runs another executor',
      {
        serve: { executor: 'nx:run-commands', readyWhen: portCheck },
        'serve*': { readyWhen: portCheck },
      },
    ],
    [
      'the selected default that sets readyWhen runs a command',
      { serve: { command: 'acme serve', readyWhen: portCheck } },
    ],
  ])('adds readyWhen when %s', async (_, targetDefaults) => {
    setup({ executor }, targetDefaults);

    await addReadyWhenSignalToTargets(tree, [executor]);

    expect(readServe().readyWhen).toEqual({ signal: true });
  });

  it('leaves a target unchanged and reports no change when onAdded returns false', async () => {
    setup({ executor });

    const result = await addReadyWhenSignalToTargets(
      tree,
      [executor],
      () => false
    );

    expect(result).toEqual({ skipAgentic: true });
    expect(readServe().readyWhen).toBeUndefined();
  });

  it('uses the executor that targetDefaults give a target without its own', async () => {
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        serve: { options: { port: 4200 } },
        preview: { options: { port: 4300 } },
      },
    });
    updateNxJson(tree, {
      ...readNxJson(tree),
      targetDefaults: {
        serve: { executor },
        // the later entry's command replaces the executor at runtime
        preview: [{ executor }, { command: 'acme preview' }],
      },
    });

    await addReadyWhenSignalToTargets(tree, [executor]);

    const { targets } = readProjectConfiguration(tree, 'app');
    expect(targets.serve.readyWhen).toEqual({ signal: true });
    expect(targets.preview.readyWhen).toBeUndefined();
  });
});
