import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-bun-prune-lockfile-cache-config';

describe('add-bun-prune-lockfile-cache-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('declares the patches and local_path_modules outputs and hashes the root package.json', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: [
            '{workspaceRoot}/dist/apps/app1/package.json',
            '{workspaceRoot}/dist/apps/app1/bun.lock',
          ],
        },
      },
    });

    await update(tree);
    await update(tree);

    const target = readProjectConfiguration(tree, 'app1').targets[
      'prune-lockfile'
    ];
    expect(target.outputs).toEqual([
      '{workspaceRoot}/dist/apps/app1/package.json',
      '{workspaceRoot}/dist/apps/app1/bun.lock',
      '{workspaceRoot}/dist/apps/app1/patches',
      '{workspaceRoot}/dist/apps/app1/local_path_modules',
    ]);
    expect(target.inputs).toEqual([
      'default',
      '^default',
      '{workspaceRoot}/package.json',
    ]);
  });

  it('adds the root package.json to the targetDefaults entry supplying the inherited inputs', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/js:prune-lockfile': { inputs: ['production', '^production'] },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: ['{workspaceRoot}/dist/apps/app1/bun.lock'],
        },
      },
    });

    await update(tree);

    expect(
      readNxJson(tree).targetDefaults['@nx/js:prune-lockfile'].inputs
    ).toEqual(['production', '^production', '{workspaceRoot}/package.json']);
    expect(
      readProjectConfiguration(tree, 'app1').targets['prune-lockfile'].inputs
    ).toBeUndefined();
  });

  it('adds the text bun.lock next to a binary bun.lockb output', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: [
            '{workspaceRoot}/dist/apps/app1/package.json',
            '{workspaceRoot}/dist/apps/app1/bun.lockb',
          ],
        },
      },
    });

    await update(tree);
    await update(tree);

    const target = readProjectConfiguration(tree, 'app1').targets[
      'prune-lockfile'
    ];
    expect(target.outputs).toEqual([
      '{workspaceRoot}/dist/apps/app1/package.json',
      '{workspaceRoot}/dist/apps/app1/bun.lockb',
      '{workspaceRoot}/dist/apps/app1/bun.lock',
      '{workspaceRoot}/dist/apps/app1/patches',
      '{workspaceRoot}/dist/apps/app1/local_path_modules',
    ]);
    expect(target.inputs).toEqual([
      'default',
      '^default',
      '{workspaceRoot}/package.json',
    ]);
  });

  it.each([
    ['another package manager', ['{workspaceRoot}/dist/apps/app1/yarn.lock']],
    [
      'excluded from its outputs',
      [
        '{workspaceRoot}/dist/apps/app1',
        '!{workspaceRoot}/dist/apps/app1/bun.lock',
      ],
    ],
  ])('leaves a target whose lockfile is %s alone', async (_, outputs) => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs: [...outputs],
        },
      },
    });

    await update(tree);

    const target = readProjectConfiguration(tree, 'app1').targets[
      'prune-lockfile'
    ];
    expect(target.outputs).toEqual(outputs);
    expect(target.inputs).toBeUndefined();
  });
});
