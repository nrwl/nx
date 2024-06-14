import { relative, resolve } from 'path/posix';
import { workspaceRoot, type Tree, joinPathFragments } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

export function toProjectRelativePath(
  path: string,
  projectRoot: string
): string {
  if (projectRoot === '.') {
    // workspace and project root are the same, we normalize it to ensure it
    // works with Jest since some paths only work when they start with `./`
    return path.startsWith('.') ? path : `./${path}`;
  }

  const relativePath = relative(
    resolve(workspaceRoot, projectRoot),
    resolve(workspaceRoot, path)
  );

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

export function getViteConfigPath(tree: Tree, root: string) {
  return [
    joinPathFragments(root, `vite.config.ts`),
    joinPathFragments(root, `vite.config.cts`),
    joinPathFragments(root, `vite.config.mts`),
    joinPathFragments(root, `vite.config.js`),
    joinPathFragments(root, `vite.config.cjs`),
    joinPathFragments(root, `vite.config.mjs`),
  ].find((f) => tree.exists(f));
}

export function addConfigValuesToViteConfig(
  tree: Tree,
  configFile: string,
  configValues: Record<string, Record<string, unknown>>
) {
  const IMPORT_PROPERTY_SELECTOR = 'ImportDeclaration';
  const viteConfigContents = tree.read(configFile, 'utf-8');

  const ast = tsquery.ast(viteConfigContents);
  // AST TO GET SECTION TO APPEND TO
  const importNodes = tsquery(ast, IMPORT_PROPERTY_SELECTOR, {
    visitAllChildren: true,
  });
  if (importNodes.length === 0) {
    return;
  }
  const lastImportNode = importNodes[importNodes.length - 1];

  const configValuesString = `
  // These options were migrated by @nx/vite:convert-to-inferred from the project.json file.
  const configValues = ${JSON.stringify(configValues)};
  
  // Determine the correct configValue to use based on the configuration
  const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
  
  const options = {
    ...configValues.default,
    ...(configValues[nxConfiguration] ?? {})
  }`;

  tree.write(
    configFile,
    `${viteConfigContents.slice(0, lastImportNode.getEnd())}
  ${configValuesString}
  ${viteConfigContents.slice(lastImportNode.getEnd())}`
  );
}
