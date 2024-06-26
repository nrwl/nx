import { ProjectConfiguration, Tree } from '@nx/devkit';
import { findNextConfigPath } from './utils';
import { tsquery } from '@phenomnomnominal/tsquery';

export function skipProjectFilterFactory(tree: Tree) {
  /**
   * We should skip if the following are true:
   * - If the project contains a next.config.mjs file
   * - If the next config contains does not contain composePlugins
   */
  return function skipProjectFilter(
    projectConfiguration: ProjectConfiguration
  ): false | string {
    const nextConfigPath = findNextConfigPath(tree, projectConfiguration.root);
    if (!nextConfigPath) {
      return `The project (${projectConfiguration.root}) does not have a valid next config file. Only .js and .cjs files are supported.`;
    }

    if (!checkForComposePlugins(tree, projectConfiguration.root)) {
      return `The project (${projectConfiguration.root}) does not have a composePlugins function in ${nextConfigPath}. Migration is not supported.`;
    }

    return false;
  };
}

export function checkForComposePlugins(
  tree: Tree,
  projectRoot: string
): boolean {
  const nextConfigPath = findNextConfigPath(tree, projectRoot);
  if (!nextConfigPath) {
    return false;
  }

  const nextConfigContents = tree.read(nextConfigPath, 'utf-8');
  const ast = tsquery.ast(nextConfigContents);

  // Query to check for composePlugins in module.exports
  const composePluginsQuery = `ExpressionStatement > BinaryExpression > CallExpression > CallExpression:has(Identifier[name=composePlugins])`;
  const matches = tsquery(ast, composePluginsQuery);

  return matches.length > 0;
}
