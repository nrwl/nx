import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  readNxJson,
  type Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureTypescriptPluginForTsSolution } from './add-typescript-plugin';

describe('ensureTypescriptPluginForTsSolution', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setUpTsSolution() {
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['packages/*'];
      return json;
    });
    tree.write('pnpm-workspace.yaml', `packages:\n  - 'packages/*'\n`);
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { composite: true, declaration: true },
    });
    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      files: [],
      references: [],
    });
  }

  function typescriptRegistrations() {
    return (readNxJson(tree).plugins ?? []).filter((p) =>
      typeof p === 'string'
        ? p === '@nx/js/typescript'
        : p.plugin === '@nx/js/typescript'
    );
  }

  it('should register @nx/js/typescript in a TS solution setup', async () => {
    setUpTsSolution();

    await ensureTypescriptPluginForTsSolution(tree);

    expect(typescriptRegistrations()).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: {
          typecheck: { targetName: 'typecheck' },
          build: {
            targetName: 'build',
            configName: 'tsconfig.lib.json',
            buildDepsName: 'build-deps',
            watchDepsName: 'watch-deps',
          },
        },
      },
    ]);
  });

  it('should not touch an existing registration, including a scoped one', async () => {
    setUpTsSolution();
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      { plugin: '@nx/js/typescript', include: ['packages/a/*'] },
    ];
    updateNxJson(tree, nxJson);

    await ensureTypescriptPluginForTsSolution(tree);

    expect(typescriptRegistrations()).toEqual([
      { plugin: '@nx/js/typescript', include: ['packages/a/*'] },
    ]);
  });

  it('should do nothing outside a TS solution setup', async () => {
    await ensureTypescriptPluginForTsSolution(tree);

    expect(typescriptRegistrations()).toEqual([]);
  });
});
