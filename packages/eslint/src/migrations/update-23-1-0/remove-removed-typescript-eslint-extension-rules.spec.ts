import '@nx/devkit/internal-testing-utils/mock-project-graph';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { type Tree, updateJson } from '@nx/devkit';
import update from './remove-removed-typescript-eslint-extension-rules';

function declareDevDependency(tree: Tree, pkg: string, version: string): void {
  updateJson(tree, 'package.json', (json) => {
    json.devDependencies = { ...json.devDependencies, [pkg]: version };
    return json;
  });
}

describe('remove-removed-typescript-eslint-extension-rules migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // The migration only edits configs when typescript-eslint v8 is present, so
    // declare it for the rule-editing tests. The version-gate tests below
    // override this.
    declareDevDependency(tree, 'typescript-eslint', '^8.0.0');
  });

  it('deletes removed formatting rules, renames safe semantic rules, and leaves ban-types for the prompt migration', async () => {
    tree.write(
      'eslint.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-extra-semi': 'error',
      'no-extra-semi': 'off',
      '@typescript-eslint/quotes': ['error', 'single'],
      '@typescript-eslint/ban-types': 'error',
      '@typescript-eslint/no-throw-literal': 'warn',
      '@typescript-eslint/no-useless-template-literals': 'error',
    },
  },
];
`
    );

    await update(tree);

    const result = tree.read('eslint.config.mjs', 'utf-8');
    // removed formatting rules are deleted
    expect(result).not.toContain('@typescript-eslint/no-extra-semi');
    expect(result).not.toContain('@typescript-eslint/quotes');
    // safe 1:1 renames are rewritten to their successors, preserving the value
    expect(result).not.toContain('@typescript-eslint/no-throw-literal');
    expect(result).toContain("'@typescript-eslint/only-throw-error': 'warn'");
    expect(result).not.toContain(
      '@typescript-eslint/no-useless-template-literals'
    );
    expect(result).toContain(
      "'@typescript-eslint/no-unnecessary-template-expression': 'error'"
    );
    // ban-types is left untouched - the companion prompt migration handles it
    expect(result).toContain("'@typescript-eslint/ban-types': 'error'");
    // unrelated typescript-eslint rules and the base rule are preserved
    expect(result).toContain('@typescript-eslint/no-unused-vars');
    expect(result).toContain('no-extra-semi');
  });

  it('leaves a config without affected rules untouched', async () => {
    tree.write(
      'eslint.config.mjs',
      `export default [
  { rules: { '@typescript-eslint/no-explicit-any': 'off' } },
];
`
    );
    const before = tree.read('eslint.config.mjs', 'utf-8');

    await update(tree);

    expect(tree.read('eslint.config.mjs', 'utf-8')).toEqual(before);
  });

  it('handles per-project flat configs', async () => {
    tree.write(
      'apps/app/eslint.config.mjs',
      `export default [
  { rules: { '@typescript-eslint/semi': 'error' } },
];
`
    );

    await update(tree);

    expect(tree.read('apps/app/eslint.config.mjs', 'utf-8')).not.toContain(
      '@typescript-eslint/semi'
    );
  });

  it('runs when only the scoped @typescript-eslint/eslint-plugin v8 is declared', async () => {
    updateJson(tree, 'package.json', (json) => {
      delete json.devDependencies['typescript-eslint'];
      json.devDependencies['@typescript-eslint/eslint-plugin'] = '^8.0.0';
      return json;
    });
    tree.write(
      'eslint.config.mjs',
      `export default [
  { rules: { '@typescript-eslint/no-extra-semi': 'error' } },
];
`
    );

    await update(tree);

    expect(tree.read('eslint.config.mjs', 'utf-8')).not.toContain(
      '@typescript-eslint/no-extra-semi'
    );
  });

  it('bails when typescript-eslint is absent', async () => {
    updateJson(tree, 'package.json', (json) => {
      delete json.devDependencies['typescript-eslint'];
      return json;
    });
    const config = `export default [
  { rules: { '@typescript-eslint/no-extra-semi': 'error' } },
];
`;
    tree.write('eslint.config.mjs', config);

    await update(tree);

    expect(tree.read('eslint.config.mjs', 'utf-8')).toEqual(config);
  });

  it('bails when typescript-eslint is still on v7', async () => {
    declareDevDependency(tree, 'typescript-eslint', '^7.16.1');
    const config = `export default [
  { rules: { '@typescript-eslint/no-extra-semi': 'error' } },
];
`;
    tree.write('eslint.config.mjs', config);

    await update(tree);

    expect(tree.read('eslint.config.mjs', 'utf-8')).toEqual(config);
  });

  it('cleans the shared eslint.base.config.* files too', async () => {
    tree.write(
      'eslint.base.config.mjs',
      `export default [
  { rules: { '@typescript-eslint/indent': ['error', 2] } },
];
`
    );

    await update(tree);

    expect(tree.read('eslint.base.config.mjs', 'utf-8')).not.toContain(
      '@typescript-eslint/indent'
    );
  });
});
