import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type NxJsonConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  createTargetDefaultsResults,
  mergeTargetConfigurations,
} from '@nx/devkit/internal';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-pnpm-prune-lockfile-cache-config';
import { PNPM_MAJOR_RUNTIME_INPUT } from '../../utils/pnpm-install-settings-inputs';

// What the migration writes for a target that declared no `inputs`: nx's own
// default, spelled out, plus the two workspace root files the pnpm artifacts
// are built from.
const PRUNE_INPUTS = [
  'default',
  '^default',
  '{workspaceRoot}/pnpm-workspace.yaml',
  '{workspaceRoot}/package.json',
  PNPM_MAJOR_RUNTIME_INPUT,
];

// Resolves what a target ends up with through nx's own targetDefaults
// synthesis and per-entry merge, the same path the project graph takes (an
// entry pinning an incompatible executor is dropped individually while its
// compatible siblings survive), so assertions cover the effective
// configuration rather than the serialized entries alone.
function resolveEffective(
  targetDefaults: NxJsonConfiguration['targetDefaults'],
  targetName: string,
  target: TargetConfiguration,
  projectName = 'app1'
) {
  const root = `apps/${projectName}`;
  const projects = {
    [root]: { name: projectName, root, targets: { [targetName]: target } },
  };
  const results = createTargetDefaultsResults({}, projects, {
    targetDefaults,
  } as NxJsonConfiguration);
  let accumulated: TargetConfiguration | undefined;
  for (const result of results) {
    const synthetic = result[2].projects?.[root]?.targets?.[targetName];
    if (synthetic) {
      accumulated = mergeTargetConfigurations(synthetic, accumulated);
    }
  }
  return mergeTargetConfigurations(target, accumulated);
}

describe('add-pnpm-prune-lockfile-cache-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('appends the pnpm artifacts next to the pnpm-lock.yaml entry', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: [
            '{workspaceRoot}/dist/apps/app1/package.json',
            '{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml',
          ],
        },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].outputs
    ).toEqual([
      '{workspaceRoot}/dist/apps/app1/package.json',
      '{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml',
      '{workspaceRoot}/dist/apps/app1/pnpm-workspace.yaml',
      '{workspaceRoot}/dist/apps/app1/patches',
      '{workspaceRoot}/dist/apps/app1/local_path_modules',
    ]);
  });

  it('derives the prefix from a hand-authored path spelling', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: ['dist/apps/app1/pnpm-lock.yaml'],
        },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].outputs
    ).toEqual([
      'dist/apps/app1/pnpm-lock.yaml',
      'dist/apps/app1/pnpm-workspace.yaml',
      'dist/apps/app1/patches',
      'dist/apps/app1/local_path_modules',
    ]);
  });

  it('updates a package.json-based project', async () => {
    tree.write(
      'apps/app1/package.json',
      JSON.stringify({
        name: 'app1',
        version: '0.0.1',
        nx: {
          targets: {
            'prune-lockfile': {
              executor: '@nx/js:prune-lockfile',
              outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
            },
          },
        },
      })
    );

    await update(tree);

    expect(
      readJson(tree, 'apps/app1/package.json').nx.targets['prune-lockfile']
        .outputs
    ).toEqual([
      '{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml',
      '{workspaceRoot}/dist/apps/app1/pnpm-workspace.yaml',
      '{workspaceRoot}/dist/apps/app1/patches',
      '{workspaceRoot}/dist/apps/app1/local_path_modules',
    ]);
  });

  it('updates targetDefaults keyed by the executor, declaring it, or filtering on it', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': {
        outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
      },
      'prune-lockfile': {
        executor: '@nx/js:prune-lockfile',
        outputs: ['{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml'],
      },
      prune: [
        {
          filter: { executor: '@nx/js:prune-lockfile' },
          outputs: ['{workspaceRoot}/build/{projectRoot}/pnpm-lock.yaml'],
        },
        {
          filter: { executor: 'other-plugin:prune' },
          outputs: ['{workspaceRoot}/build/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/js:prune-lockfile': {
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
        inputs: PRUNE_INPUTS,
      },
      'prune-lockfile': {
        executor: '@nx/js:prune-lockfile',
        outputs: [
          '{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/out/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/out/{projectRoot}/patches',
          '{workspaceRoot}/out/{projectRoot}/local_path_modules',
        ],
        inputs: PRUNE_INPUTS,
      },
      prune: [
        // No filter-less entry establishes this key's match domain, so no
        // fallback is authored: a carrier would make the key win for targets
        // that previously fell through to other defaults.
        {
          filter: { executor: '@nx/js:prune-lockfile' },
          outputs: [
            '{workspaceRoot}/build/{projectRoot}/pnpm-lock.yaml',
            '{workspaceRoot}/build/{projectRoot}/pnpm-workspace.yaml',
            '{workspaceRoot}/build/{projectRoot}/patches',
            '{workspaceRoot}/build/{projectRoot}/local_path_modules',
          ],
        },
        {
          filter: { executor: 'other-plugin:prune' },
          outputs: ['{workspaceRoot}/build/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    });
  });

  it('does not dedupe against a project-filtered sibling in a defaults-only workspace', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': [
        {
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
        {
          filter: { projects: ['only-app1'] },
          inputs: [
            '{workspaceRoot}/pnpm-workspace.yaml',
            PNPM_MAJOR_RUNTIME_INPUT,
          ],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    // The filtered sibling supplies nothing to the projects it excludes, so
    // the prepended fallback carries every source; and the sibling's own
    // array replaces it for the projects its filter selects, so it is
    // completed too.
    const entries = readNxJson(tree).targetDefaults[
      '@nx/js:prune-lockfile'
    ] as any[];
    expect(entries[0]).toEqual({ inputs: PRUNE_INPUTS });
    expect(entries[1].inputs).toBeUndefined();
    expect(entries[2].inputs).toEqual([
      '{workspaceRoot}/pnpm-workspace.yaml',
      PNPM_MAJOR_RUNTIME_INPUT,
      '{workspaceRoot}/package.json',
    ]);
  });

  it('updates an identity-neutral supplier following the locating entry in a defaults-only workspace', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
        { inputs: ['production'] },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    // The neutral entry's array replaces the locating entry's for a future
    // target, so it must carry the sources itself; the locating entry stays
    // input-less rather than authoring an array the neutral one would fight.
    const entries = readNxJson(tree).targetDefaults['prune-lockfile'] as any[];
    expect(entries[0].inputs).toBeUndefined();
    expect(entries[1].inputs).toEqual([
      'production',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('updates an identity-neutral supplier preceding the locating entry in a defaults-only workspace', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        { inputs: ['production'] },
        {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    const entries = readNxJson(tree).targetDefaults['prune-lockfile'] as any[];
    expect(entries[0].inputs).toEqual([
      'production',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
    // Writing an array here would replace the supplier's custom inputs.
    expect(entries[1].inputs).toBeUndefined();
  });

  it('prepends the fallback instead of replacing an earlier filtered supplier in a defaults-only workspace', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': [
        {
          filter: { projects: ['only-app1'] },
          inputs: [{ env: 'PRUNE_MODE' }],
        },
        {
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);
    // second run must change nothing
    await update(tree);

    // An array authored on the output entry would come after the filtered
    // supplier and replace its custom inputs for the projects it selects, so
    // the fallback lands on a new first entry instead.
    const entries = readNxJson(tree).targetDefaults[
      '@nx/js:prune-lockfile'
    ] as any[];
    expect(entries).toEqual([
      { inputs: PRUNE_INPUTS },
      {
        filter: { projects: ['only-app1'] },
        inputs: [
          { env: 'PRUNE_MODE' },
          '{workspaceRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/package.json',
          PNPM_MAJOR_RUNTIME_INPUT,
        ],
      },
      {
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
      },
    ]);
    // The supplier's array wins for its project; the fallback covers the rest.
    const defaults = readNxJson(tree).targetDefaults;
    expect(
      resolveEffective(
        defaults,
        'prune-lockfile',
        { executor: '@nx/js:prune-lockfile' },
        'only-app1'
      ).inputs
    ).toEqual([
      { env: 'PRUNE_MODE' },
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
    const excluded = resolveEffective(defaults, 'prune-lockfile', {
      executor: '@nx/js:prune-lockfile',
    });
    expect(excluded.inputs).toEqual(PRUNE_INPUTS);
    expect(excluded.outputs).toBeDefined();
  });

  it('does not count a project-filtered output entry as the universal fallback', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': [
        {
          filter: { projects: ['only-app1'] },
          outputs: ['{workspaceRoot}/filtered/{projectRoot}/pnpm-lock.yaml'],
        },
        {
          filter: { projects: ['only-app2'] },
          inputs: [{ env: 'PRUNE_MODE' }],
        },
        {
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);
    // second run must change nothing
    await update(tree);

    // A project outside both filters must still get the sources, so the
    // fallback is prepended rather than counted as covered by the filtered
    // output entry.
    const entries = readNxJson(tree).targetDefaults[
      '@nx/js:prune-lockfile'
    ] as any[];
    expect(entries).toEqual([
      { inputs: PRUNE_INPUTS },
      {
        filter: { projects: ['only-app1'] },
        outputs: ['{workspaceRoot}/filtered/{projectRoot}/pnpm-lock.yaml'],
      },
      {
        filter: { projects: ['only-app2'] },
        inputs: [
          { env: 'PRUNE_MODE' },
          '{workspaceRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/package.json',
          PNPM_MAJOR_RUNTIME_INPUT,
        ],
      },
      {
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
      },
    ]);
  });

  it('does not treat an incompatible unfiltered sibling as coverage in a defaults-only workspace', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': [
        {
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
        {
          executor: 'other-plugin:prune',
          inputs: [
            '{workspaceRoot}/pnpm-workspace.yaml',
            PNPM_MAJOR_RUNTIME_INPUT,
          ],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    // nx discards the foreign-executor entry before merging a prune target,
    // so its array covers nothing here and the fallback is prepended.
    const entries = readNxJson(tree).targetDefaults[
      '@nx/js:prune-lockfile'
    ] as any[];
    expect(entries[0]).toEqual({ inputs: PRUNE_INPUTS });
    expect(entries[1].inputs).toBeUndefined();
    expect(entries[2].inputs).toEqual([
      '{workspaceRoot}/pnpm-workspace.yaml',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('does not leak the fallback onto a same-name target of another executor', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);
    // second run must change nothing
    await update(tree);

    const defaults = readNxJson(tree).targetDefaults;
    expect(defaults['prune-lockfile']).toEqual([
      { executor: '@nx/js:prune-lockfile', inputs: PRUNE_INPUTS },
      {
        executor: '@nx/js:prune-lockfile',
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
      },
    ]);
    // The fallback is pinned, so the merge discards it for a same-name target
    // of another executor while prune targets still inherit it.
    expect(
      resolveEffective(defaults, 'prune-lockfile', {
        executor: 'other-plugin:prune',
      }).inputs
    ).toBeUndefined();
    expect(
      resolveEffective(defaults, 'prune-lockfile', {
        executor: '@nx/js:prune-lockfile',
      }).inputs
    ).toEqual(PRUNE_INPUTS);
    const executorless = resolveEffective(defaults, 'prune-lockfile', {});
    expect(executorless.executor).toBe('@nx/js:prune-lockfile');
    expect(executorless.inputs).toEqual(PRUNE_INPUTS);
  });

  it('keeps a neutral sibling for a foreign-executor target when the pinned fallback is prepended', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        { cache: false, options: { retained: true } },
        {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);
    // second run must change nothing
    await update(tree);

    // nx drops the pinned entries individually for the foreign target, so the
    // neutral sibling's fields survive while the added inputs do not leak.
    const defaults = readNxJson(tree).targetDefaults;
    const foreign = resolveEffective(defaults, 'prune-lockfile', {
      executor: 'other-plugin:prune',
    });
    expect(foreign.inputs).toBeUndefined();
    expect(foreign.cache).toBe(false);
    expect(foreign.options).toEqual({ retained: true });
    const prune = resolveEffective(defaults, 'prune-lockfile', {
      executor: '@nx/js:prune-lockfile',
    });
    expect(prune.inputs).toEqual(PRUNE_INPUTS);
    expect(prune.cache).toBe(false);
  });

  it('authors no fallback when a name key pairs a neutral entry with a filtered locator', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      build: [
        { cache: true },
        {
          filter: { executor: '@nx/js:prune-lockfile' },
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);
    // second run must change nothing
    await update(tree);

    // The filter-less entry does not pin the executor, so a pinned carrier
    // would introduce the prune identity to targets that never had it here;
    // the key keeps its entries and the input gap is intentional.
    const defaults = readNxJson(tree).targetDefaults;
    expect(defaults['build']).toEqual([
      { cache: true },
      {
        filter: { executor: '@nx/js:prune-lockfile' },
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
      },
    ]);
    const prune = resolveEffective(defaults, 'build', {
      executor: '@nx/js:prune-lockfile',
    });
    expect(prune.cache).toBe(true);
    expect(prune.inputs).toBeUndefined();
    const executorless = resolveEffective(defaults, 'build', {});
    expect(executorless.executor).toBeUndefined();
    expect(executorless.cache).toBe(true);
  });

  it('supplies an executor-less future target past an executor-filtered supplier', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        {
          filter: { executor: '@nx/js:prune-lockfile' },
          inputs: [{ env: 'PRUNE_MODE' }],
        },
        {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);
    // second run must change nothing
    await update(tree);

    const defaults = readNxJson(tree).targetDefaults;
    expect(defaults['prune-lockfile']).toEqual([
      { executor: '@nx/js:prune-lockfile', inputs: PRUNE_INPUTS },
      {
        filter: { executor: '@nx/js:prune-lockfile' },
        inputs: [
          { env: 'PRUNE_MODE' },
          '{workspaceRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/package.json',
          PNPM_MAJOR_RUNTIME_INPUT,
        ],
      },
      {
        executor: '@nx/js:prune-lockfile',
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
      },
    ]);
    // The executor filter is evaluated against the target's own executor, so
    // an executor-less target inherits the fallback while an explicit prune
    // target resolves the filtered supplier's array.
    const executorless = resolveEffective(defaults, 'prune-lockfile', {});
    expect(executorless.executor).toBe('@nx/js:prune-lockfile');
    expect(executorless.inputs).toEqual(PRUNE_INPUTS);
    expect(
      resolveEffective(defaults, 'prune-lockfile', {
        executor: '@nx/js:prune-lockfile',
      }).inputs
    ).toEqual([
      { env: 'PRUNE_MODE' },
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('does not use an executor-filtered entry as the base of a later spread supplier', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': [
        {
          filter: { executor: '@nx/js:prune-lockfile' },
          inputs: [
            '{workspaceRoot}/pnpm-workspace.yaml',
            '{workspaceRoot}/package.json',
            PNPM_MAJOR_RUNTIME_INPUT,
          ],
        },
        {
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
        { inputs: ['...', 'production'] },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    // The filtered entry supplies nothing to a target its filter excludes, so
    // its sources cannot satisfy the spread supplier's base.
    const entries = readNxJson(tree).targetDefaults[
      '@nx/js:prune-lockfile'
    ] as any[];
    expect(entries[0].inputs).toEqual([
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
    expect(entries[1].inputs).toBeUndefined();
    expect(entries[2].inputs).toEqual([
      '...',
      'production',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('does not widen an all-filtered executor key with a fallback', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': [
        {
          filter: { projects: ['other-app'] },
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
      build: { cache: false, options: { buildTarget: 'compile' } },
    };
    updateNxJson(tree, nxJson);
    const before = JSON.stringify(readNxJson(tree).targetDefaults);

    await update(tree);
    // second run must change nothing
    await update(tree);

    // A carrier here would make the executor key win for the excluded
    // project's prune target, shadowing the name key it resolves today.
    const defaults = readNxJson(tree).targetDefaults;
    expect(JSON.stringify(defaults)).toEqual(before);
    const excluded = resolveEffective(defaults, 'build', {
      executor: '@nx/js:prune-lockfile',
    });
    expect(excluded.cache).toBe(false);
    expect(excluded.inputs).toBeUndefined();
    const included = resolveEffective(
      defaults,
      'build',
      { executor: '@nx/js:prune-lockfile' },
      'other-app'
    );
    expect(included.outputs).toBeDefined();
    expect(included.cache).toBeUndefined();
  });

  it('does not widen a name key located only through an executor filter', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      build: [
        {
          filter: { executor: '@nx/js:prune-lockfile' },
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
      '*': { executor: '@nx/js:tsc', options: { main: 'src/main.ts' } },
    };
    updateNxJson(tree, nxJson);

    await update(tree);
    // second run must change nothing
    await update(tree);

    const defaults = readNxJson(tree).targetDefaults;
    expect(defaults['build']).toEqual([
      {
        filter: { executor: '@nx/js:prune-lockfile' },
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
      },
    ]);
    // An executor-less target must keep falling through to the glob key; a
    // carrier under the exact key would shadow it.
    const executorless = resolveEffective(defaults, 'build', {});
    expect(executorless.executor).toBe('@nx/js:tsc');
    expect(executorless.inputs).toBeUndefined();
    expect(
      resolveEffective(defaults, 'build', { executor: '@nx/js:prune-lockfile' })
        .outputs
    ).toBeDefined();
  });

  it('updates name-keyed and glob-keyed targetDefaults resolving to a prune-lockfile target', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': { executor: '@nx/js:prune-lockfile' },
      },
    });
    // the glob key is shadowed by the exact-name key for app1's target, so it
    // is only reached through app2's differently-named target
    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      targets: {
        'prune-app': { executor: '@nx/js:prune-lockfile' },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        { outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'] },
        // filtered to another executor: never applies to our targets
        {
          filter: { executor: 'other-plugin:prune' },
          outputs: ['{workspaceRoot}/other/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
      'prune-*': {
        outputs: ['{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml'],
      },
      // matches only app1's target name, where the exact-name key shadows it
      'prune-lock*': {
        outputs: ['{workspaceRoot}/shadowed/{projectRoot}/pnpm-lock.yaml'],
      },
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      'prune-lockfile': [
        {
          outputs: [
            '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
            '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
            '{workspaceRoot}/dist/{projectRoot}/patches',
            '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
          ],
        },
        {
          filter: { executor: 'other-plugin:prune' },
          outputs: ['{workspaceRoot}/other/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
      'prune-*': {
        outputs: [
          '{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/out/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/out/{projectRoot}/patches',
          '{workspaceRoot}/out/{projectRoot}/local_path_modules',
        ],
      },
      'prune-lock*': {
        outputs: ['{workspaceRoot}/shadowed/{projectRoot}/pnpm-lock.yaml'],
      },
    });
  });

  it('selects the executor key over a resolving exact-name key', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': { executor: '@nx/js:prune-lockfile' },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': {
        outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
      },
      // resolves for the target too, but the runtime only applies the executor
      // key, so appending here would declare outputs the runtime never merges
      'prune-lockfile': {
        outputs: ['{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml'],
      },
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/js:prune-lockfile': {
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
      },
      'prune-lockfile': {
        outputs: ['{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml'],
      },
    });
  });

  it('selects the longer glob when two glob keys match the target', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': { executor: '@nx/js:prune-lockfile' },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-*': {
        outputs: ['{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml'],
      },
      'prune-lock*': {
        outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
      },
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      'prune-*': {
        outputs: ['{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml'],
      },
      'prune-lock*': {
        outputs: [
          '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/dist/{projectRoot}/patches',
          '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
        ],
      },
    });
  });

  it('evaluates entry filters before the key or executor field, like the runtime matcher', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': { executor: '@nx/js:prune-lockfile' },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': [
        // prune-lockfile targets are never plugin-inferred, so a plugin
        // filter can never apply to them
        {
          filter: { plugin: '@nx/some-plugin' },
          outputs: ['{workspaceRoot}/plugin/{projectRoot}/pnpm-lock.yaml'],
        },
        {
          filter: { projects: ['app1'] },
          outputs: ['{workspaceRoot}/covered/{projectRoot}/pnpm-lock.yaml'],
        },
        {
          filter: { projects: ['other-app'] },
          outputs: ['{workspaceRoot}/uncovered/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
      // the runtime rejects the entry on its filter before the executor field
      // is ever considered
      'prune-lockfile': [
        {
          filter: { executor: 'other-plugin:prune' },
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/filtered/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/js:prune-lockfile': [
        {
          filter: { plugin: '@nx/some-plugin' },
          outputs: ['{workspaceRoot}/plugin/{projectRoot}/pnpm-lock.yaml'],
        },
        {
          filter: { projects: ['app1'] },
          outputs: [
            '{workspaceRoot}/covered/{projectRoot}/pnpm-lock.yaml',
            '{workspaceRoot}/covered/{projectRoot}/pnpm-workspace.yaml',
            '{workspaceRoot}/covered/{projectRoot}/patches',
            '{workspaceRoot}/covered/{projectRoot}/local_path_modules',
          ],
        },
        {
          filter: { projects: ['other-app'] },
          outputs: ['{workspaceRoot}/uncovered/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
      'prune-lockfile': [
        {
          filter: { executor: 'other-plugin:prune' },
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/filtered/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    });
  });

  it('resolves a target executor supplied by the defaults themselves', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        // no executor and no outputs on the target: both come from the
        // matching default below
        'prune-lockfile': {},
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      // the runtime reads defaults with the pre-default executor (undefined
      // here), so neither the executor key nor an executor-filtered entry can
      // ever match this target
      '@nx/js:prune-lockfile': {
        outputs: ['{workspaceRoot}/exec/{projectRoot}/pnpm-lock.yaml'],
      },
      'prune-lockfile': [
        {
          filter: { projects: ['app1'] },
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
        {
          filter: { executor: '@nx/js:prune-lockfile' },
          outputs: ['{workspaceRoot}/filtered/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/js:prune-lockfile': {
        outputs: ['{workspaceRoot}/exec/{projectRoot}/pnpm-lock.yaml'],
      },
      'prune-lockfile': [
        {
          filter: { projects: ['app1'] },
          executor: '@nx/js:prune-lockfile',
          outputs: [
            '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
            '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
            '{workspaceRoot}/dist/{projectRoot}/patches',
            '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
          ],
        },
        {
          filter: { executor: '@nx/js:prune-lockfile' },
          outputs: ['{workspaceRoot}/filtered/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    });
    // the target has no outputs of its own; nothing is invented on it
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].outputs
    ).toBeUndefined();
  });

  it('never treats a command target as a prune target, even when a default supplies the executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          command: 'node prune.js',
          outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
        },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': { executor: '@nx/js:prune-lockfile' },
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    // command sugar resolves to nx:run-commands before defaults apply, so the
    // default's executor never reaches this target
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].outputs
    ).toEqual(['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml']);
  });

  it('follows the "..." spread when composing outputs', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        // the target's '...' expands the defaults outputs, so those still
        // reach the target and drive its cache replay
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: ['...', '{workspaceRoot}/dist/apps/app1/extra'],
        },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        { outputs: ['{workspaceRoot}/first/{projectRoot}/pnpm-lock.yaml'] },
        // the second entry's '...' keeps the first entry contributing
        { outputs: ['...', '{workspaceRoot}/second/{projectRoot}/extra'] },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      'prune-lockfile': [
        {
          outputs: [
            '{workspaceRoot}/first/{projectRoot}/pnpm-lock.yaml',
            '{workspaceRoot}/first/{projectRoot}/pnpm-workspace.yaml',
            '{workspaceRoot}/first/{projectRoot}/patches',
            '{workspaceRoot}/first/{projectRoot}/local_path_modules',
          ],
        },
        // no pnpm-lock.yaml anchor of its own
        { outputs: ['...', '{workspaceRoot}/second/{projectRoot}/extra'] },
      ],
    });
    // no pnpm-lock.yaml anchor on the target itself
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].outputs
    ).toEqual(['...', '{workspaceRoot}/dist/apps/app1/extra']);
  });

  it('does not classify a target as prune when a later default entry replaces the executor with a command', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
        },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      // at merge time the later command identity replaces the prune executor,
      // so the target ends up running nx:run-commands
      'prune-lockfile': [
        { executor: '@nx/js:prune-lockfile' },
        { command: 'echo hi' },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].outputs
    ).toEqual(['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml']);
  });

  it('drops an incompatible payload entry individually for a target with its own executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': { executor: '@nx/js:prune-lockfile' },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      // the target's executor is fixed, so the runtime drops only the foreign
      // payload entry and the catch-all sibling still applies
      'prune-lockfile': [
        { outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'] },
        {
          executor: 'other-plugin:prune',
          outputs: ['{workspaceRoot}/payload/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      'prune-lockfile': [
        {
          outputs: [
            '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
            '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
            '{workspaceRoot}/dist/{projectRoot}/patches',
            '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
          ],
        },
        {
          executor: 'other-plugin:prune',
          outputs: ['{workspaceRoot}/payload/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    });
  });

  it('leaves name-keyed targetDefaults alone when nothing resolves to the executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': { executor: '@nx/js:prune-lockfile' },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      // no project has a prune-lockfile-executor target with this name
      'other-prune': {
        outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
      },
    };
    updateNxJson(tree, nxJson);
    const before = structuredClone(readNxJson(tree).targetDefaults);

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual(before);
  });

  it('spells out the default inputs before adding the root settings sources', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
        },
      },
    });

    await update(tree);

    // An absent `inputs` means nx's own default, so it has to be written out
    // rather than replaced by the two root files alone.
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toEqual([
      'default',
      '^default',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('adds the root settings sources to inputs a target already declares', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          inputs: ['production', { externalDependencies: ['pnpm'] }],
          outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
        },
      },
    });

    await update(tree);
    // second run must change nothing
    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toEqual([
      'production',
      { externalDependencies: ['pnpm'] },
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  // A target's own `inputs` replaces the defaults' array rather than merging
  // with it, so the two arrangements below decide which layer the root sources
  // have to land on.
  it('adds the root sources to the defaults entry the target inherits its inputs from', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': { inputs: ['production'] },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
        },
      },
    });

    await update(tree);
    // second run must change nothing
    await update(tree);

    // Writing nx's default onto the target would have replaced `production`.
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toBeUndefined();
    expect(
      readNxJson(tree).targetDefaults['@nx/js:prune-lockfile'].inputs
    ).toEqual([
      'production',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('adds the root sources to the matching defaults entry, not a later filtered one', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': [
        {
          filter: { projects: ['app1'] },
          inputs: ['matching-input'],
        },
        {
          filter: { projects: ['app2'] },
          inputs: ['nonmatching-input'],
        },
      ],
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
        },
      },
    });

    await update(tree);

    const entries = readNxJson(tree).targetDefaults[
      '@nx/js:prune-lockfile'
    ] as any[];
    // The app2-filtered entry supplies some other target's array; appending
    // there would leave app1 hashing only `matching-input` at runtime.
    expect(entries[0].inputs).toEqual([
      'matching-input',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
    expect(entries[1].inputs).toEqual(['nonmatching-input']);
  });

  it('adds the root sources to the target when it owns inputs and the defaults own outputs', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': {
        outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
      },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          inputs: ['production'],
        },
      },
    });

    await update(tree);

    // The target's own array wins, so the sources are useless anywhere else.
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toEqual([
      'production',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('classifies a target that spreads the defaults outputs into its own', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          // The lockfile entry is inherited, so the target's own array never
          // names it; only the merged outputs do.
          inputs: ['production'],
          outputs: ['...', '{workspaceRoot}/dist/apps/app1/extra'],
        },
      },
    });

    await update(tree);
    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toEqual([
      'production',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('adds each root source once when a later defaults entry spreads an earlier one', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        {
          executor: '@nx/js:prune-lockfile',
          inputs: ['production'],
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
        { executor: '@nx/js:prune-lockfile', inputs: ['...', 'after'] },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);
    await update(tree);

    // No concrete target, so the entries own the decision. Only the entry
    // declaring the lockfile output takes the sources, and the later entry's
    // spread carries them through exactly once.
    const entries = readNxJson(tree).targetDefaults['prune-lockfile'] as any[];
    expect(entries[0].inputs).toEqual([
      'production',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
    expect(entries[1].inputs).toEqual(['...', 'after']);
  });

  // The runtime drops a defaults entry whose executor is foreign to the target
  // and keeps its compatible siblings, so neither the outputs it would have
  // replaced nor the inputs it declares belong to the target.
  it('classifies against the compatible sibling a foreign-executor entry follows', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        { outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'] },
        { executor: 'other-plugin:prune', inputs: ['foreign-input'] },
      ],
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { 'prune-lockfile': { executor: '@nx/js:prune-lockfile' } },
    });

    await update(tree);
    await update(tree);

    // The foreign entry hides the inherited lockfile output from an unfiltered
    // read, which would skip this target entirely.
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toEqual([
      'default',
      '^default',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  it('does not spread against inputs only a foreign-executor entry declares', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        { cache: true },
        { executor: 'other-plugin:prune', inputs: ['foreign-input'] },
      ],
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
        },
      },
    });

    await update(tree);
    await update(tree);

    // A `'...'` here would expand against nothing at runtime, narrowing the
    // target from nx's default to just the two root files.
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toEqual([
      'default',
      '^default',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  // nx reads an empty `command`/`executor` as no identity at all
  // (resolveCommandSyntacticSugar, isCompatibleTarget), so these entries apply
  // to a prune target and a nullish check would drop them from both passes.
  it.each([
    ['command', { command: '' }],
    ['executor', { executor: '' }],
  ])('applies a defaults entry with an empty %s', async (_field, identity) => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': {
        ...identity,
        inputs: ['from-empty-identity'],
        outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
      },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { 'prune-lockfile': { executor: '@nx/js:prune-lockfile' } },
    });

    await update(tree);
    await update(tree);

    const migrated = readNxJson(tree).targetDefaults['prune-lockfile'];
    expect(migrated.outputs).toEqual([
      '{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml',
      '{workspaceRoot}/dist/{projectRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/dist/{projectRoot}/patches',
      '{workspaceRoot}/dist/{projectRoot}/local_path_modules',
    ]);
    expect(migrated.inputs).toEqual([
      'from-empty-identity',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toBeUndefined();
  });

  // An executor-less target's identity comes from the defaults, so nx compares
  // each entry against no identity at all and every one survives its guard;
  // whether the middle entry's inputs then reach the target depends on the
  // document-order resets in nx's own merge. Writing a `'...'` on the target
  // would bet on that and narrow it to the two root files when the bet is lost.
  it('never writes a spread onto a target whose executor comes from the defaults', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'prune-lockfile': [
        { executor: 'other-plugin:prune', cache: true },
        { inputs: ['middle'] },
        {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/{projectRoot}/pnpm-lock.yaml'],
        },
      ],
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { 'prune-lockfile': {} },
    });

    await update(tree);
    await update(tree);

    const target = readProjectConfiguration(tree, 'app1').targets[
      'prune-lockfile'
    ];
    expect(target.inputs).toBeUndefined();
    const entries = readNxJson(tree).targetDefaults['prune-lockfile'] as any[];
    expect(entries[1].inputs).toEqual([
      'middle',
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ]);
  });

  // A `'...'` in the owner's array pulls the layer below into the effective
  // one, so a source already declared there is not visible in the owner's own
  // entries and would be added a second time.
  it.each([
    [
      'target',
      { inputs: ['{workspaceRoot}/package.json', 'base'] },
      { inputs: ['...', 'target-after'] },
    ],
    [
      'defaults entry',
      { inputs: ['{workspaceRoot}/package.json', 'base'] },
      { inputs: ['...', 'after'] },
    ],
  ])(
    'skips a root source the spread base already supplies (%s owns the spread)',
    async (owner, base, spread) => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        'prune-lockfile':
          owner === 'target'
            ? [{ executor: '@nx/js:prune-lockfile', ...base }]
            : [
                { executor: '@nx/js:prune-lockfile', ...base },
                { executor: '@nx/js:prune-lockfile', ...spread },
              ],
      };
      updateNxJson(tree, nxJson);
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          'prune-lockfile': {
            executor: '@nx/js:prune-lockfile',
            outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
            ...(owner === 'target' ? spread : {}),
          },
        },
      });

      await update(tree);
      await update(tree);

      const written =
        owner === 'target'
          ? readProjectConfiguration(tree, 'app1').targets['prune-lockfile']
              .inputs
          : (readNxJson(tree).targetDefaults['prune-lockfile'] as any[])[1]
              .inputs;
      expect(written).toEqual([
        '...',
        owner === 'target' ? 'target-after' : 'after',
        '{workspaceRoot}/pnpm-workspace.yaml',
        PNPM_MAJOR_RUNTIME_INPUT,
      ]);
    }
  );

  it('appends only the missing artifacts and never duplicates', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: [
            '{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml',
            '{workspaceRoot}/dist/apps/app1/patches',
          ],
        },
      },
    });

    await update(tree);
    // second run must change nothing
    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].outputs
    ).toEqual([
      '{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml',
      '{workspaceRoot}/dist/apps/app1/patches',
      '{workspaceRoot}/dist/apps/app1/pnpm-workspace.yaml',
      '{workspaceRoot}/dist/apps/app1/local_path_modules',
    ]);
  });

  it('leaves non-pnpm targets, other executors, and outputs-less targets alone', async () => {
    const targets = {
      // npm workspace: no pnpm lockfile entry
      'prune-lockfile': {
        executor: '@nx/js:prune-lockfile',
        outputs: [
          '{workspaceRoot}/dist/apps/app1/package.json',
          '{workspaceRoot}/dist/apps/app1/package-lock.json',
        ],
      },
      // another executor writing a pnpm lockfile path
      'custom-prune': {
        executor: 'my-plugin:prune',
        outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
      },
      // no outputs to anchor on: skipped rather than invented
      'prune-lockfile-no-outputs': {
        executor: '@nx/js:prune-lockfile',
        options: {},
      },
      // command sugar resolves to nx:run-commands before defaults apply, so
      // this is never a prune target even with a lockfile-shaped output
      'command-prune': {
        command: 'node prune.js',
        outputs: ['{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml'],
      },
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: structuredClone(targets),
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets).toEqual(targets);
  });
});
