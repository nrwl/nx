import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  globAsync,
  Tree,
} from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export default async function addNxTsPlugin(tree: Tree) {
  if (!isUsingTsSolutionSetup(tree)) {
    return;
  }

  const files = await globAsync(tree, [
    '**/vite.config.{js,ts,mjs,mts,cjs,cts}',
    '**/vitest.config.{js,ts,mjs,mts,cjs,cts}',
  ]);

  for (const file of files) {
    const content = tree.read(file, 'utf-8');

    // Skip if already using the plugin
    if (content.includes('nxTsPlugin')) {
      continue;
    }

    // Skip files that use nxViteTsPaths (non-TS-solution configs)
    if (content.includes('nxViteTsPaths')) {
      continue;
    }

    addImport(tree, file);
    addPlugin(tree, file);
  }

  await formatFiles(tree);
}

function addImport(tree: Tree, file: string) {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const content = tree.read(file, 'utf-8');
  const importStatement = `import { nxTsPlugin } from '@nx/vite/plugins/nx-ts.plugin';`;

  const ast = tsquery.ast(content);
  const allImports = tsquery.query(ast, 'ImportDeclaration');

  if (allImports.length) {
    const lastImport = allImports[allImports.length - 1];
    tree.write(
      file,
      applyChangesToString(content, [
        {
          type: ChangeType.Insert,
          index: lastImport.end + 1,
          text: `${importStatement}\n`,
        },
      ])
    );
  } else {
    tree.write(
      file,
      applyChangesToString(content, [
        {
          type: ChangeType.Insert,
          index: 0,
          text: `${importStatement}\n`,
        },
      ])
    );
  }
}

function addPlugin(tree: Tree, file: string) {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const content = tree.read(file, 'utf-8');

  const pluginsNode = tsquery.query(
    tsquery.ast(content),
    'PropertyAssignment:has(Identifier[name="plugins"]) > ArrayLiteralExpression'
  );

  if (pluginsNode.length) {
    const arrayNode = pluginsNode[0];
    // Insert at the beginning of the plugins array
    tree.write(
      file,
      applyChangesToString(content, [
        {
          type: ChangeType.Insert,
          index: arrayNode.getStart() + 1,
          text: `nxTsPlugin(), `,
        },
      ])
    );
  }
}
