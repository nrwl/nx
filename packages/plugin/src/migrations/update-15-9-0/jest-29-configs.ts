import {
  createProjectGraphAsync,
  formatFiles,
  logger,
  stripIndents,
  Tree,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { forEachExecutorOptionsInGraph } from '@nx/devkit/src/generators/executor-options-utils';
import { TS_QUERY_JEST_CONFIG_PREFIX } from '@nx/jest/src/utils/ast-utils';
import { findRootJestPreset } from '@nx/jest/src/utils/config/find-root-jest-files';
import { JestExecutorOptions } from '@nx/jest/src/executors/jest/schema';

// NOTE: this is a copy of the @nrwl/jest v15.8.0 migrations
export async function updateConfigsJest29(tree: Tree) {
  const rootPreset = findRootJestPreset(tree);
  const targetsWithJest = new Set<string>();
  // have to use graph so the negative configuration targets are expanded
  const graph = await createProjectGraphAsync();
  forEachExecutorOptionsInGraph<JestExecutorOptions>(
    graph,
    '@nrwl/nx-plugin:e2e',
    (options, projectName, targetName) => {
      if (options.jestConfig && tree.exists(options.jestConfig)) {
        targetsWithJest.add(targetName);
        // if the default root preset exists or if the project doesn't have a 'preset' configured
        //  -> update snapshot config
        if (!rootPreset || !hasPresetConfigured(tree, options.jestConfig)) {
          addSnapshotOptionsToConfig(
            tree,
            options.jestConfig,
            `From within the project directory, run "nx test --update-snapshot"`
          );
        }
        updateTsJestOptions(tree, options.jestConfig);
        updateNgJestOptions(tree, options.jestConfig);
      }
    }
  );

  if (rootPreset && tree.exists(rootPreset)) {
    const cmd = `"nx affected --targets=${Array.from(targetsWithJest).join(
      ','
    )} --update-snapshot"`;
    addSnapshotOptionsToConfig(tree, rootPreset, cmd);
    updateTsJestOptions(tree, rootPreset);
    updateNgJestOptions(tree, rootPreset);
  }

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
  updateSnapshotExample: string
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
 * Example: ${updateSnapshotExample}
 * More info: https://jestjs.io/docs/upgrading-to-jest29#snapshot-format
 */
snapshotFormat: { escapeString: true, printBasicPrototype: true }
}`;
    },
    { visitAllChildren: false }
  );

  tree.write(configPath, updatedConfig);
}

function hasPresetConfigured(tree: Tree, configPath: string): boolean {
  const contents = tree.read(configPath, 'utf-8');

  return (
    tsquery.query(
      contents,
      `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression PropertyAssignment:has(Identifier[name="preset"])`
    )?.length > 0
  );
}

function updateTsJestOptions(tree: Tree, configPath: string) {
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
    `${TS_QUERY_JEST_CONFIG_PREFIX}> ObjectLiteralExpression PropertyAssignment:has(Identifier[name="transform"]) PropertyAssignment > :has(StringLiteral[value="ts-jest"], StringLiteral[value="jest-preset-angular"])`,
    (node: ts.StringLiteral) => {
      return `[${node.getText()}, ${tsJestGlobalsConfig}]`;
    }
  );

  tree.write(configPath, updatedTsJestTransformer);
}

function updateNgJestOptions(tree: Tree, configPath: string) {
  const contents = tree.read(configPath, 'utf-8');

  let ngJestTeardownConfig: string;
  const noTeardownConfig = tsquery.replace(
    contents,
    'BinaryExpression:has(PropertyAccessExpression:has(Identifier[name=ngJest]))  PropertyAssignment:has(Identifier[name=teardown])',
    (node: ts.PropertyAssignment) => {
      ngJestTeardownConfig = node.initializer.getText();
      return ' ';
    }
  );

  if (!ngJestTeardownConfig) {
    return;
  }

  let maybeUpdatedTestEnvOpts = tsquery.replace(
    noTeardownConfig,
    `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression PropertyAssignment:has(Identifier[name="testEnvironmentOptions"]) ObjectLiteralExpression`,
    (node: ts.ObjectLiteralExpression) => {
      return `{
  ${node.properties
    .map((p) => getNodeWithComments(noTeardownConfig, p))
    .join(',\n')},
   teardown: ${ngJestTeardownConfig}
  }`;
    }
  );

  if (maybeUpdatedTestEnvOpts !== noTeardownConfig) {
    tree.write(configPath, maybeUpdatedTestEnvOpts);
    return;
  }
  // didn't find existing testEnvironmentOptions, so add the new property

  const updatedConfig = tsquery.replace(
    maybeUpdatedTestEnvOpts,
    `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression`,
    (node: ts.ObjectLiteralExpression) => {
      return `{
${node.properties
  .map((p) => getNodeWithComments(maybeUpdatedTestEnvOpts, p))
  .join(',\n')},
testEnvironmentOptions: { teardown: ${ngJestTeardownConfig} }, 
}`;
    },
    { visitAllChildren: false }
  );
  tree.write(configPath, updatedConfig);
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
