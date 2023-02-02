import {
  formatFiles,
  logger,
  stripIndents,
  Tree,
  createProjectGraphAsync,
} from '@nrwl/devkit';
import { TS_QUERY_JEST_CONFIG_PREFIX } from '../../utils/ast-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { JestExecutorOptions } from '../../executors/jest/schema';
import { forEachExecutorOptionsInGraph } from '@nrwl/workspace/src/utilities/executor-options-utils';

export async function updateConfigsJest29(tree: Tree) {
  // have to use graph so the negative configuration targets are expanded
  const graph = await createProjectGraphAsync();
  forEachExecutorOptionsInGraph<JestExecutorOptions>(
    graph,
    '@nrwl/jest:jest',
    (options, projectName, targetName) => {
      if (options.jestConfig && tree.exists(options.jestConfig)) {
        addSnapshotOptionsToConfig(
          tree,
          options.jestConfig,
          projectName,
          targetName
        );
        updateTsJestOptions(tree, options.jestConfig);
      }
    }
  );

  await formatFiles(tree);
  logger.info(stripIndents`NX Jest Snapshot format changed in v29.
By default Nx kept the older style to prevent breaking of existing tests with snapshots.
It's recommend you update to the latest format.
You can do this in your project's jest config file.
Remove the snapshotFormat property and re-run tests with the --update-snapshot flag.
More info: https://jestjs.io/docs/upgrading-to-jest29#snapshot-format`);
}

function addSnapshotOptionsToConfig(
  tree: Tree,
  configPath: string,
  projectName: string,
  targetName: string
) {
  const config = tree.read(configPath, 'utf-8');
  const hasSnapshotOptions = tsquery.query(
    config,
    `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression PropertyAssignment:has(Identifier[name="snapshotFormat"])`
  );
  if (hasSnapshotOptions.length > 0) {
    return;
  }
  const updatedConfig = tsquery.replace(
    config,
    `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression`,
    (node: ts.ObjectLiteralExpression) => {
      return `{
${node.properties.map((p) => getNodeWithComments(config, p)).join(',\n')},
/* TODO: Update to latest Jest snapshotFormat
 * By default Nx has kept the older style of Jest Snapshot formats
 * to prevent breaking of any existing tests with snapshots.
 * It's recommend you update to the latest format.
 * You can do this by removing snapshotFormat property
 * and running tests with --update-snapshot flag.
 * Example: "nx ${targetName} ${projectName} --update-snapshot"
 * More info: https://jestjs.io/docs/upgrading-to-jest29#snapshot-format
 */
snapshotFormat: { escapeString: true, printBasicPrototype: true }
}`;
    },
    { visitAllChildren: false }
  );

  tree.write(configPath, updatedConfig);
}

function updateTsJestOptions(tree: Tree, configPath: string): string {
  // query for the globals property, if they don't have one then there's nothing to modify.
  const contents = tree.read(configPath, 'utf-8');
  let tsJestGlobalsConfig: string;
  const noTsJestGlobals = tsquery.replace(
    contents,
    `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression PropertyAssignment:has(Identifier[name="globals"])`,
    (node: ts.PropertyAssignment) => {
      if (tsJestGlobalsConfig) {
        logger.warn(
          stripIndents`Found more than one "globals" object in the jest config, ${configPath}
          Will use the first one`
        );
        return;
      }
      tsJestGlobalsConfig = getGlobalTsJestConfig(node);
      return getGlobalConfigWithoutTsJest(node);
    }
  );

  if (!tsJestGlobalsConfig) {
    return;
  }

  const updatedTsJestTransformer = tsquery.replace(
    noTsJestGlobals,
    `${TS_QUERY_JEST_CONFIG_PREFIX}> ObjectLiteralExpression PropertyAssignment:has(Identifier[name="transform"]) PropertyAssignment > StringLiteral[value="ts-jest"]`,
    (node: ts.StringLiteral) => {
      return `['ts-jest', ${tsJestGlobalsConfig}]`;
    }
  );

  tree.write(configPath, updatedTsJestTransformer);
}

function getGlobalTsJestConfig(node: ts.PropertyAssignment): string {
  const globalObject = node.initializer as ts.ObjectLiteralExpression;
  const foundConfig = globalObject.properties.find(
    (p) => ts.isPropertyAssignment(p) && p.name.getText().includes('ts-jest')
  ) as ts.PropertyAssignment;

  return foundConfig?.initializer?.getText() || '';
}

function getGlobalConfigWithoutTsJest(node: ts.PropertyAssignment): string {
  const globalObject = node?.initializer as ts.ObjectLiteralExpression;
  const withoutTsJest = globalObject?.properties?.filter((p) => {
    return !(
      ts.isPropertyAssignment(p) && p.name.getText().includes('ts-jest')
    );
  });

  const globalConfigs = withoutTsJest.map((c) => c.getText()).join(',\n');
  return `globals: { ${globalConfigs} }`;
}

function getNodeWithComments(fullText: string, node: ts.Node) {
  const commentRanges = ts.getLeadingCommentRanges(
    fullText,
    node.getFullStart()
  );

  if (commentRanges?.length > 0) {
    const withComments = `${commentRanges
      .map((r) => fullText.slice(r.pos, r.end))
      .join('\n')}\n${node.getText()}`;
    return withComments;
  }
  return node.getText();
}
export default updateConfigsJest29;
