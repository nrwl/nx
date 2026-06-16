import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-remix-eslint-config';

const PACKAGE = '@remix-run/eslint-config';

function setPackageJson(
  tree: Tree,
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {}
): void {
  writeJson(tree, 'package.json', {
    name: 'test',
    dependencies: deps,
    devDependencies: devDeps,
  });
}

function getDeps(tree: Tree) {
  const json = readJson(tree, 'package.json');
  return { ...json.dependencies, ...json.devDependencies };
}

describe('remove-remix-eslint-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('removes the dependency when present in dependencies and unreferenced', async () => {
    setPackageJson(tree, { [PACKAGE]: '2.17.3' });

    await migration(tree);

    expect(getDeps(tree)[PACKAGE]).toBeUndefined();
  });

  it('removes the dependency when present in devDependencies and unreferenced', async () => {
    setPackageJson(tree, {}, { [PACKAGE]: '2.17.3' });

    await migration(tree);

    expect(getDeps(tree)[PACKAGE]).toBeUndefined();
  });

  it('keeps the dependency when an eslintrc config extends the preset', async () => {
    setPackageJson(tree, {}, { [PACKAGE]: '2.17.3' });
    writeJson(tree, '.eslintrc.json', { extends: [PACKAGE] });

    await migration(tree);

    expect(getDeps(tree)[PACKAGE]).toBe('2.17.3');
  });

  it('keeps the dependency when a flat config imports the preset', async () => {
    setPackageJson(tree, {}, { [PACKAGE]: '2.17.3' });
    tree.write(
      'eslint.config.mjs',
      `import remix from '${PACKAGE}';\nexport default [...remix];\n`
    );

    await migration(tree);

    expect(getDeps(tree)[PACKAGE]).toBe('2.17.3');
  });

  it('keeps the dependency when a TypeScript flat config references the preset', async () => {
    setPackageJson(tree, {}, { [PACKAGE]: '2.17.3' });
    tree.write(
      'eslint.config.ts',
      `import remix from '${PACKAGE}';\nexport default [...remix];\n`
    );

    await migration(tree);

    expect(getDeps(tree)[PACKAGE]).toBe('2.17.3');
  });

  it('keeps the dependency when a project-level eslintrc references the preset', async () => {
    setPackageJson(tree, {}, { [PACKAGE]: '2.17.3' });
    writeJson(tree, 'apps/my-app/.eslintrc.json', { extends: [PACKAGE] });

    await migration(tree);

    expect(getDeps(tree)[PACKAGE]).toBe('2.17.3');
  });

  it('is a no-op when the dependency is not declared', async () => {
    setPackageJson(tree, { react: '18.0.0' });

    await migration(tree);

    expect(getDeps(tree)).toEqual({ react: '18.0.0' });
  });
});
