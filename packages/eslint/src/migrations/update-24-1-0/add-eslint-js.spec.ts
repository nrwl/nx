import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-eslint-js';

describe('add-eslint-js migration', () => {
  let tree: Tree;

  function setDeps(
    devDependencies: Record<string, string>,
    dependencies: Record<string, string> = {}
  ) {
    writeJson(tree, 'package.json', {
      name: 'test',
      dependencies,
      devDependencies,
    });
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add @eslint/js when @nx/eslint-plugin is installed without it', async () => {
    setDeps({ '@nx/eslint-plugin': '24.1.0', eslint: '^10.0.0' });

    const result = await update(tree);

    expect(readJson(tree, 'package.json').devDependencies['@eslint/js']).toBe(
      '^10.0.0'
    );
    expect(result).toEqual({
      nextSteps: [expect.stringContaining('Added @eslint/js ^10.0.0')],
    });
  });

  it('should bump a v9 @eslint/js to v10', async () => {
    setDeps({
      '@nx/eslint-plugin': '24.1.0',
      '@eslint/js': '^9.32.0',
      eslint: '^10.0.0',
    });

    const result = await update(tree);

    expect(readJson(tree, 'package.json').devDependencies['@eslint/js']).toBe(
      '^10.0.0'
    );
    expect(result).toEqual({
      nextSteps: [expect.stringContaining('Updated @eslint/js ^10.0.0')],
    });
  });

  it('should bump @eslint/js where it is declared in dependencies', async () => {
    setDeps({ '@nx/eslint-plugin': '24.1.0' }, { '@eslint/js': '9.39.5' });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@eslint/js']).toBe('^10.0.0');
    expect(packageJson.devDependencies['@eslint/js']).toBeUndefined();
  });

  it('should keep a v10 @eslint/js', async () => {
    setDeps({ '@nx/eslint-plugin': '24.1.0', '@eslint/js': '^10.2.0' });
    const original = tree.read('package.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(original);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should keep a non-semver @eslint/js specifier', async () => {
    setDeps({ '@nx/eslint-plugin': '24.1.0', '@eslint/js': 'latest' });
    const original = tree.read('package.json', 'utf-8');

    await update(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(original);
  });

  it('should not touch workspaces without @nx/eslint-plugin', async () => {
    setDeps({ eslint: '^10.0.0', '@eslint/js': '^9.32.0' });
    const original = tree.read('package.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(original);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should be a no-op when run twice', async () => {
    setDeps({ '@nx/eslint-plugin': '24.1.0', '@eslint/js': '^9.32.0' });
    await update(tree);
    const afterFirstRun = tree.read('package.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(afterFirstRun);
    expect(result).toEqual({ skipAgentic: true });
  });
});
