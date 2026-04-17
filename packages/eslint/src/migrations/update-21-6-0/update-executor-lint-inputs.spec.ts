import { type Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-executor-lint-inputs';

describe('update-executor-lint-inputs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add ^default and tools/eslint-rules glob to existing inputs', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/eslint:lint': {
        cache: true,
        inputs: [
          'default',
          '{workspaceRoot}/.eslintrc.json',
          '{workspaceRoot}/.eslintignore',
          '{workspaceRoot}/eslint.config.mjs',
        ],
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updated = readNxJson(tree);
    expect(updated.targetDefaults['@nx/eslint:lint'].inputs).toEqual([
      'default',
      '^default',
      '{workspaceRoot}/.eslintrc.json',
      '{workspaceRoot}/.eslintignore',
      '{workspaceRoot}/eslint.config.mjs',
      '{workspaceRoot}/tools/eslint-rules/**/*',
    ]);
  });

  it('should not duplicate inputs if already present', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/eslint:lint': {
        cache: true,
        inputs: [
          'default',
          '^default',
          '{workspaceRoot}/.eslintrc.json',
          '{workspaceRoot}/tools/eslint-rules/**/*',
        ],
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updated = readNxJson(tree);
    expect(updated.targetDefaults['@nx/eslint:lint'].inputs).toEqual([
      'default',
      '^default',
      '{workspaceRoot}/.eslintrc.json',
      '{workspaceRoot}/tools/eslint-rules/**/*',
    ]);
  });

  it('should do nothing if no executor target defaults exist', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {};
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updated = readNxJson(tree);
    expect(updated.targetDefaults['@nx/eslint:lint']).toBeUndefined();
  });

  it('should do nothing if no inputs are configured', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/eslint:lint': {
        cache: true,
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updated = readNxJson(tree);
    expect(updated.targetDefaults['@nx/eslint:lint'].inputs).toBeUndefined();
  });

  it('should add ^default at beginning if default is not in the list', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/eslint:lint': {
        cache: true,
        inputs: ['{workspaceRoot}/.eslintrc.json'],
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updated = readNxJson(tree);
    expect(updated.targetDefaults['@nx/eslint:lint'].inputs).toEqual([
      '^default',
      '{workspaceRoot}/.eslintrc.json',
      '{workspaceRoot}/tools/eslint-rules/**/*',
    ]);
  });
});
