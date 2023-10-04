import {
  getProjects,
  joinPathFragments,
  Tree,
  formatFiles,
  updateJson,
} from '@nx/devkit';

export default async function (tree: Tree) {
  const projects = getProjects(tree);
  const reactPlugin = '@nx/react/plugins/storybook';
  let shouldIgnoreReactPlugin = false;

  for (const [, config] of projects) {
    let sbConfigPath = joinPathFragments(config.root, '.storybook/main.ts');

    if (!tree.exists(sbConfigPath)) {
      sbConfigPath = joinPathFragments(config.root, '.storybook/main.js');
    }

    if (!tree.exists(sbConfigPath)) {
      continue;
    }

    const sbConfig = tree.read(sbConfigPath, 'utf-8');
    if (sbConfig.includes(reactPlugin)) {
      shouldIgnoreReactPlugin = true;
      break;
    }
  }

  if (shouldIgnoreReactPlugin && tree.exists('.eslintrc.json')) {
    updateJson(tree, '.eslintrc.json', (json) => {
      if (json.extends?.includes('plugin:storybook/recommended')) {
        json.rules ??= {};
        json.rules['storybook/no-uninstalled-addons'] = [
          'error',
          {
            ignore: ['@nx/react/plugins/storybook'],
          },
        ];
      }
      return json;
    });
  }

  await formatFiles(tree);
}
