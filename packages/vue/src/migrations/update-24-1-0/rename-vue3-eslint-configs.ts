import {
  formatFiles,
  visitNotIgnoredFiles,
  type MigrationReturnObject,
  type Tree,
} from '@nx/devkit';
import { isEslintConfigFile } from '@nx/eslint/internal';
import { basename } from 'node:path/posix';

// eslintrc resolves `plugin:vue/` and `plugin:eslint-plugin-vue/` to the same plugin.
const VUE3_CONFIG_REFERENCE =
  /(plugin:(?:eslint-plugin-)?vue\/)vue3-(essential|strongly-recommended|recommended)(?![\w-])/g;
const VUE3_CONFIG_NAME =
  /vue3-(?:essential|strongly-recommended|recommended)(?![\w-])/;

export default async function update(
  tree: Tree
): Promise<MigrationReturnObject> {
  const remaining: string[] = [];

  visitNotIgnoredFiles(tree, '', (path) => {
    if (!isEslintConfigFile(path) && basename(path) !== 'package.json') {
      return;
    }
    const content = tree.read(path, 'utf-8');
    if (!content?.includes('vue3-')) {
      return;
    }

    const updated = content.replace(VUE3_CONFIG_REFERENCE, '$1$2');
    if (updated !== content) {
      tree.write(path, updated);
    }
    if (VUE3_CONFIG_NAME.test(updated)) {
      remaining.push(path);
    }
  });

  await formatFiles(tree);

  if (!remaining.length) {
    return { skipAgentic: true };
  }
  const nextSteps = remaining.map(
    (path) =>
      `${path} references an eslint-plugin-vue "vue3-" config in a form the migration does not rewrite. eslint-plugin-vue 10 removed those configs: use the name without the "vue3-" prefix, which targets Vue 3.`
  );
  return { nextSteps, agentContext: nextSteps };
}
