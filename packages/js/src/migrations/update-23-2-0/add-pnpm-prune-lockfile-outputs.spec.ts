import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-pnpm-prune-lockfile-outputs';

describe('add-pnpm-prune-lockfile-outputs migration', () => {
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
      },
      'prune-lockfile': {
        executor: '@nx/js:prune-lockfile',
        outputs: [
          '{workspaceRoot}/out/{projectRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/out/{projectRoot}/pnpm-workspace.yaml',
          '{workspaceRoot}/out/{projectRoot}/patches',
          '{workspaceRoot}/out/{projectRoot}/local_path_modules',
        ],
      },
      prune: [
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
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: structuredClone(targets),
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets).toEqual(targets);
  });
});
