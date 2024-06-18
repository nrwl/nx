import type { Tree } from 'nx/src/generators/tree';
import { tsquery } from '@phenomnomnominal/tsquery';

export function addConfigValuesToConfigFile(
  tree: Tree,
  configFile: string,
  configValues: Record<string, Record<string, unknown>>
) {
  const IMPORT_PROPERTY_SELECTOR = 'ImportDeclaration';
  const configFileContents = tree.read(configFile, 'utf-8');

  const ast = tsquery.ast(configFileContents);
  // AST TO GET SECTION TO APPEND TO
  const importNodes = tsquery(ast, IMPORT_PROPERTY_SELECTOR, {
    visitAllChildren: true,
  });
  if (importNodes.length === 0) {
    return;
  }
  const lastImportNode = importNodes[importNodes.length - 1];

  const configValuesString = `
  // These options were migrated by @nx/storybook:convert-to-inferred from the project.json file.
  const configValues = ${JSON.stringify(configValues)};
  
  // Determine the correct configValue to use based on the configuration
  const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
  
  const options = {
    ...configValues.default,
    ...(configValues[nxConfiguration] ?? {})
  }`;

  tree.write(
    configFile,
    `${configFileContents.slice(0, lastImportNode.getEnd())}
  ${configValuesString}
  ${configFileContents.slice(lastImportNode.getEnd())}`
  );
}
