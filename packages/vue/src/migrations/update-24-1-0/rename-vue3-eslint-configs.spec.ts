import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './rename-vue3-eslint-configs';

describe('rename-vue3-eslint-configs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('renames vue3- configs in eslintrc files, flat configs and package.json', async () => {
    tree.write(
      'apps/a/.eslintrc.json',
      JSON.stringify({
        extends: ['plugin:vue/vue3-essential', 'eslint:recommended'],
      })
    );
    tree.write(
      'apps/b/.eslintrc.yml',
      'extends:\n  - plugin:vue/vue3-strongly-recommended\n'
    );
    tree.write(
      'apps/c/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [...compat.extends('plugin:eslint-plugin-vue/vue3-recommended')];
`
    );
    tree.write(
      'apps/d/package.json',
      JSON.stringify({
        name: 'd',
        eslintConfig: { extends: ['plugin:vue/vue3-essential'] },
      })
    );

    const result = await migration(tree);
    const contents = () =>
      [
        'apps/a/.eslintrc.json',
        'apps/b/.eslintrc.yml',
        'apps/c/eslint.config.mjs',
        'apps/d/package.json',
      ].map((path) => tree.read(path, 'utf-8'));
    const migrated = contents();

    expect(migrated[0]).toContain('"plugin:vue/essential"');
    expect(migrated[1]).toContain('- plugin:vue/strongly-recommended');
    expect(migrated[2]).toContain(
      "compat.extends('plugin:eslint-plugin-vue/recommended')"
    );
    expect(migrated[3]).toContain('"plugin:vue/essential"');
    expect(result).toEqual({ skipAgentic: true });

    await migration(tree);
    expect(contents()).toEqual(migrated);
  });

  it('leaves other eslint-plugin-vue configs and files that are not ESLint configs alone', async () => {
    tree.write(
      'apps/a/.eslintrc.json',
      JSON.stringify({
        extends: [
          'plugin:vue/vue3-recommended',
          'plugin:vue/vue2-essential',
          'plugin:vue/base',
        ],
      })
    );
    tree.write(
      'apps/a/src/notes.ts',
      `export const config = 'plugin:vue/vue3-essential';\n`
    );

    await migration(tree);

    expect(readJson(tree, 'apps/a/.eslintrc.json').extends).toEqual([
      'plugin:vue/recommended',
      'plugin:vue/vue2-essential',
      'plugin:vue/base',
    ]);
    expect(tree.read('apps/a/src/notes.ts', 'utf-8')).toContain(
      'plugin:vue/vue3-essential'
    );
  });

  it('reports vue3- configs referenced in a form it does not rewrite', async () => {
    tree.write(
      'apps/a/eslint.config.mjs',
      `import vue from 'eslint-plugin-vue';
export default [...compat.config(vue.configs['vue3-essential'])];
`
    );

    const result = await migration(tree);

    expect(tree.read('apps/a/eslint.config.mjs', 'utf-8')).toContain(
      "vue.configs['vue3-essential']"
    );
    expect(result).toEqual({
      nextSteps: [expect.stringContaining('apps/a/eslint.config.mjs')],
      agentContext: [expect.stringContaining('apps/a/eslint.config.mjs')],
    });
  });
});
