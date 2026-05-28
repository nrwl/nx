import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateJson, writeJson, type Tree } from '@nx/devkit';
import { isEsmProject } from './is-esm-project';

describe('isEsmProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('does not treat TS solution setup as ESM without a package.json type field', () => {
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['packages/*'];
      return json;
    });
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { composite: true, declaration: true },
    });
    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      files: [],
      references: [],
    });

    expect(isEsmProject(tree, 'packages/my-lib')).toBe(false);
  });

  it('returns true for TS solution projects when package.json declares "type": "module"', () => {
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['packages/*'];
      return json;
    });
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { composite: true, declaration: true },
    });
    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      files: [],
      references: [],
    });
    writeJson(tree, 'packages/my-lib/package.json', { type: 'module' });

    expect(isEsmProject(tree, 'packages/my-lib')).toBe(true);
  });

  it('returns true when project package.json declares "type": "module"', () => {
    writeJson(tree, 'apps/my-app/package.json', { type: 'module' });

    expect(isEsmProject(tree, 'apps/my-app')).toBe(true);
  });

  it('returns false when project package.json declares "type": "commonjs"', () => {
    writeJson(tree, 'apps/my-app/package.json', { type: 'commonjs' });

    expect(isEsmProject(tree, 'apps/my-app')).toBe(false);
  });

  it('walks up to workspace package.json when project package.json has no type field', () => {
    // Mirrors Node's "nearest package.json with a `type` field wins" rule:
    // a thin project package.json without `type` does NOT shadow the
    // workspace's `type`. Without this, Node would load .ts files as ESM
    // (per workspace type:module) while the generator emitted CJS based
    // on the project-level absence of type, mismatching at runtime.
    updateJson(tree, 'package.json', (json) => {
      json.type = 'module';
      return json;
    });
    writeJson(tree, 'apps/my-app/package.json', { name: '@scope/my-app' });

    expect(isEsmProject(tree, 'apps/my-app')).toBe(true);
  });

  it('falls back to workspace package.json when project has no package.json', () => {
    updateJson(tree, 'package.json', (json) => {
      json.type = 'module';
      return json;
    });

    expect(isEsmProject(tree, 'apps/my-app')).toBe(true);
  });

  it('returns false when neither project nor workspace package.json declares type', () => {
    // workspace package.json from createTreeWithEmptyWorkspace has no `type`
    expect(isEsmProject(tree, 'apps/my-app')).toBe(false);
  });
});
