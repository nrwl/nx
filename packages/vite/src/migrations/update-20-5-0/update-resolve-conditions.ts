import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import picomatch = require('picomatch');

const REMIX_IMPORT_SELECTOR =
  'ImportDeclaration:has(StringLiteral[value=@remix-run/dev]),CallExpression:has(Identifier[name=require]) StringLiteral[value=@remix-run/dev]';
const DEFINE_CONFIG_OBJECT_SELECTOR = `CallExpression:has(Identifier[name=defineConfig]) > ObjectLiteralExpression`;
const RESOLVE_PROPERTY_SELECTOR = `PropertyAssignment:has(Identifier[name=resolve]) > ObjectLiteralExpression`;
const CONDITIONS_PROPERTY_SELECTOR = `PropertyAssignment:has(Identifier[name=conditions]) > ArrayLiteralExpression`;

const _conditions_array_values = [
  'module',
  'browser',
  'development|production',
];
const _condition_obj = `conditions: ${JSON.stringify(
  _conditions_array_values
)},`;
const _resolve = `resolve: {
  ${_condition_obj}
},`;

export default async function (tree: Tree) {
  const viteFiles = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (picomatch('**/vite.*config*.{js,ts,mjs,mts,cjs,cts}')(filePath)) {
      viteFiles.push(filePath);
    }
  });

  for (const file of viteFiles) {
    const contents = tree.read(file, 'utf-8');
    const ast = tsquery.ast(contents);
    const remixImportNodes = tsquery(ast, REMIX_IMPORT_SELECTOR, {
      visitAllChildren: true,
    });
    if (remixImportNodes.length > 0) {
      continue;
    }

    const defineConfigObjectNodes = tsquery(ast, DEFINE_CONFIG_OBJECT_SELECTOR);
    if (defineConfigObjectNodes.length === 0) {
      console.warn(
        `Could not migrate vite config at ${file}. No "defineConfig" object found. Apply "resolve.conditions: ['module', 'browser', 'development|production']" manually to your vite config.`
      );
      continue;
    }
    let newContents = contents;
    const defineConfigObjectNode = defineConfigObjectNodes[0];
    const resolvePropertyNodes = tsquery(
      defineConfigObjectNode,
      RESOLVE_PROPERTY_SELECTOR
    );
    if (resolvePropertyNodes.length === 0) {
      // Do not add resolve property if it does not already exist
      continue;
    } else {
      const resolvePropertyNode = resolvePropertyNodes[0];
      const conditionsPropertyNodes = tsquery(
        resolvePropertyNode,
        CONDITIONS_PROPERTY_SELECTOR
      );
      if (conditionsPropertyNodes.length === 0) {
        // do not add conditions property if it does not already exist
        continue;
      } else {
        const conditionPropertyNode = conditionsPropertyNodes[0];
        const conditionsArrayValues = JSON.parse(
          conditionPropertyNode.getText().replace(/['`]/g, '"')
        );
        const newConditionArrayValues = [
          ...new Set([...conditionsArrayValues, ..._conditions_array_values]),
        ];
        newContents =
          newContents.slice(0, conditionPropertyNode.getStart()) +
          `${JSON.stringify(newConditionArrayValues)}` +
          newContents.slice(conditionPropertyNode.getEnd());
      }
    }

    tree.write(file, newContents);
  }

  await formatFiles(tree);
}
