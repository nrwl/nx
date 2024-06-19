import { type Tree, joinPathFragments } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

export const REMIX_PROPERTY_MAPPINGS = {
  sourcemap: 'sourcemap',
  devServerPort: 'port',
  command: 'command',
  manual: 'manual',
  tlsKey: 'tls-key',
  tlsCert: 'tls-cert',
};

export function getConfigFilePath(tree: Tree, root: string) {
  return [
    joinPathFragments(root, `remix.config.js`),
    joinPathFragments(root, `remix.config.cjs`),
    joinPathFragments(root, `remix.config.mjs`),
  ].find((f) => tree.exists(f));
}

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
  let startPosition = 0;
  if (importNodes.length !== 0) {
    const lastImportNode = importNodes[importNodes.length - 1];
    startPosition = lastImportNode.getEnd();
  }

  const configValuesString = `
  // These options were migrated by @nx/remix:convert-to-inferred from the project.json file.
  const configValues = ${JSON.stringify(configValues)};
  
  // Determine the correct configValue to use based on the configuration
  const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
  
  const options = {
    ...configValues.default,
    ...(configValues[nxConfiguration] ?? {})
  }`;

  tree.write(
    configFile,
    `${configFileContents.slice(0, startPosition)}
  ${configValuesString}
  ${configFileContents.slice(startPosition)}`
  );
}
