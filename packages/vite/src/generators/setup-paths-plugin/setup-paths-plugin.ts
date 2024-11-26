import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  globAsync,
  Tree,
} from '@nx/devkit';
import type { ArrayLiteralExpression, Node } from 'typescript';

export async function setupPathsPlugin(
  tree: Tree,
  schema: { skipFormat?: boolean }
) {
  const files = await globAsync(tree, [
    '**/vite.config.{js,ts,mjs,mts,cjs,cts}',
  ]);

  for (const file of files) {
    ensureImportExists(tree, file);
    ensurePluginAdded(tree, file);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

function ensureImportExists(tree: Tree, file: string) {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  let content = tree.read(file, 'utf-8');
  const ast = tsquery.ast(content);
  const allImports = tsquery.query(ast, 'ImportDeclaration');
  if (content.includes('@nx/vite/plugins/nx-tsconfig-paths.plugin')) {
    return;
  }
  if (allImports.length) {
    const lastImport = allImports[allImports.length - 1];
    tree.write(
      file,
      applyChangesToString(content, [
        {
          type: ChangeType.Insert,
          index: lastImport.end + 1,
          text: `import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';\n`,
        },
      ])
    );
  } else {
    if (file.endsWith('.cts') || file.endsWith('.cjs')) {
      tree.write(
        file,
        applyChangesToString(content, [
          {
            type: ChangeType.Insert,
            index: 0,
            text: `const { nxViteTsPaths } = require('@nx/vite/plugins/nx-tsconfig-paths.plugin');\n`,
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
            text: `import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';\n`,
          },
        ])
      );
    }
  }
}

function ensurePluginAdded(tree, file) {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const content = tree.read(file, 'utf-8');
  const ast = tsquery.ast(content);
  const foundDefineConfig = tsquery.query(
    ast,
    'CallExpression:has(Identifier[name="defineConfig"])'
  );
  if (!foundDefineConfig.length) return content;

  // Do not update defineConfig if it has an arrow function since it can be tricky and error-prone.
  const defineUsingArrowFunction = tsquery.query(
    foundDefineConfig[0],
    'ArrowFunction'
  );
  if (defineUsingArrowFunction.length) return content;

  const propertyAssignments = tsquery.query(
    foundDefineConfig[0],
    'PropertyAssignment'
  );

  if (propertyAssignments.length) {
    const pluginsNode = tsquery.query(
      foundDefineConfig[0],
      'PropertyAssignment:has(Identifier[name="plugins"])'
    );

    if (pluginsNode.length) {
      const updated = tsquery.replace(
        content,
        'PropertyAssignment:has(Identifier[name="plugins"])',
        (node: Node) => {
          const found = tsquery.query(
            node,
            'ArrayLiteralExpression'
          ) as ArrayLiteralExpression[];
          let updatedPluginsString = '';

          const existingPluginNodes = found?.[0].elements ?? [];

          for (const plugin of existingPluginNodes) {
            updatedPluginsString += `${plugin.getText()},`;
          }

          if (
            !existingPluginNodes?.some((node: Node) =>
              node.getText().includes('nxViteTsPaths')
            )
          ) {
            updatedPluginsString += ` nxViteTsPaths(),`;
          }

          return `plugins: [${updatedPluginsString}]`;
        }
      );
      tree.write(file, updated);
    } else {
      tree.write(
        file,
        applyChangesToString(content, [
          {
            type: ChangeType.Insert,
            index: propertyAssignments[0].getStart(),
            text: `plugins: [nxViteTsPaths()],
            `,
          },
        ])
      );
    }
  } else {
    tree.write(
      file,
      applyChangesToString(content, [
        {
          type: ChangeType.Insert,
          index: foundDefineConfig[0].getStart() + 14, // length of "defineConfig(" + 1
          text: `plugins: [nxViteTsPaths()],`,
        },
      ])
    );
  }
}

export default setupPathsPlugin;
