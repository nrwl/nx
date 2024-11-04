import {
  formatFiles,
  joinPathFragments,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { dirname } from 'path';
import { tsquery } from '@phenomnomnominal/tsquery';

export default async function (tree: Tree) {
  visitNotIgnoredFiles(tree, '', (path) => {
    if (
      !path.endsWith('.storybook/main.ts') &&
      !path.endsWith('.storybook/main.js')
    ) {
      return;
    }
    const projectRoot = dirname(dirname(path));
    const possibleNuxtConfigPaths = [
      joinPathFragments(projectRoot, 'nuxt.config.ts'),
      joinPathFragments(projectRoot, 'nuxt.config.js'),
    ];
    if (!possibleNuxtConfigPaths.some((p) => tree.exists(p))) {
      return;
    }
    const pathToStorybookConfig = path;

    const storybookConfigContents = tree.read(pathToStorybookConfig, 'utf-8');
    if (
      !storybookConfigContents.includes('viteFinal') &&
      !storybookConfigContents.includes('@vitejs/plugin-vue')
    ) {
      return;
    }

    const VITE_FINAL_PLUGINS_SELECTOR =
      'PropertyAssignment:has(Identifier[name=viteFinal]) PropertyAssignment:has(Identifier[name=plugins]) > ArrayLiteralExpression';
    const ast = tsquery.ast(storybookConfigContents);
    const nodes = tsquery(ast, VITE_FINAL_PLUGINS_SELECTOR, {
      visitAllChildren: true,
    });
    if (!nodes.length) {
      // This would be an invalid config modified by the user already if it does work
      // Therefore, do not touch their config file
      return;
    }

    const pluginsValueNode = nodes[0];
    if (pluginsValueNode.getText().includes('vue()')) {
      // The plugin has already been registered, do nothing
      return;
    }

    const updatedPluginsValue = `[vue(), ${pluginsValueNode
      .getText()
      .slice(1)}`;

    let newStorybookConfigContents = `${storybookConfigContents.slice(
      0,
      pluginsValueNode.getStart()
    )}${updatedPluginsValue}${storybookConfigContents.slice(
      pluginsValueNode.getEnd()
    )}`;
    newStorybookConfigContents = `import vue from '@vitejs/plugin-vue';
    ${newStorybookConfigContents}`;

    tree.write(pathToStorybookConfig, newStorybookConfigContents);
  });

  await formatFiles(tree);
}
