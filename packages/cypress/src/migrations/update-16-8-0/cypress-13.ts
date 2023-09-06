import {
  updateJson,
  installPackagesTask,
  getProjects,
  visitNotIgnoredFiles,
  formatFiles,
  type Tree,
} from '@nx/devkit';
import { installedCypressVersion } from '../../utils/cypress-version';
import {
  isObjectLiteralExpression,
  isCallExpression,
  type CallExpression,
  type MethodDeclaration,
  type PropertyAccessExpression,
  type PropertyAssignment,
} from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import type { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';

const JS_TS_FILE_MATCHER = /\.[jt]sx?$/;

export async function updateToCypress13(tree: Tree) {
  if (installedCypressVersion() < 12) {
    return;
  }

  const projects = getProjects(tree);

  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    '@nx/cypress:cypress',
    (options, projectName) => {
      if (!options.cypressConfig || !tree.exists(options.cypressConfig)) {
        return;
      }
      const projectConfig = projects.get(projectName);

      removeNodeVersionOption(tree, options.cypressConfig);
      removeVideoUploadOnPassesOption(tree, options.cypressConfig);

      visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
        if (!JS_TS_FILE_MATCHER.test(filePath)) {
          return;
        }
        shouldNotOverrideReadFile(tree, filePath);
      });
    }
  );

  updateJson(tree, 'package.json', (json) => {
    json.devDependencies ??= {};
    json.devDependencies.cypress = '^13.0.0';
    return json;
  });

  await formatFiles(tree);
}

function removeVideoUploadOnPassesOption(tree: Tree, configPath: string) {
  const config = tree.read(configPath, 'utf-8');
  const isUsingDeprecatedOption =
    tsquery.query(config, getPropertyQuery('videoUploadOnPasses'))?.length > 0;

  if (!isUsingDeprecatedOption) {
    return;
  }

  const importStatement = configPath.endsWith('.ts')
    ? "import fs from 'fs';"
    : "const fs = require('fs');";

  const replacementFunction = `/**
* Delete videos for specs that do not contain failing or retried tests.
* This function is to be used in the 'setupNodeEvents' configuration option as a replacement to 
* 'videoUploadOnPasses' which has been removed.
*
* https://docs.cypress.io/guides/guides/screenshots-and-videos#Delete-videos-for-specs-without-failing-or-retried-tests
**/
function removePassedSpecs(on) {
  on('after:spec', (spec, results) => {
    if(results && results.vide) {
      const hasFailures = results.tests.some(t => t.attempts.some(a =>  a.state === 'failed'));

      if(!hasFailures) {
        fs.unlinkSync(results.video);
      }
    }
  })
}`;

  const withReplacementFn = `${importStatement}\n${config}\n${replacementFunction}`;

  // setupNodeEvents can be a property or method.
  const setupNodeEventsQuery =
    'ExportAssignment ObjectLiteralExpression > :matches(PropertyAssignment:has(Identifier[name="setupNodeEvents"]), MethodDeclaration:has(Identifier[name="setupNodeEvents"]))';

  const hasSetupNodeEvents =
    tsquery.query(withReplacementFn, setupNodeEventsQuery)?.length > 0;

  let updatedWithSetupNodeEvents = withReplacementFn;
  if (hasSetupNodeEvents) {
    // if have setupNodeEvents, update existing fn to use removePassedSpecs helper and remove videoUploadOnPasses
    const noVideoUploadOption = tsquery.replace(
      withReplacementFn,
      getPropertyQuery('videoUploadOnPasses'),
      (node: PropertyAssignment) => {
        if (isObjectLiteralExpression(node.initializer)) {
          // is a nested config object
          const key = node.name.getText().trim();
          const listOfProperties = node.initializer.properties
            .map((j) => j.getText())
            .filter((j) => !j.includes('videoUploadOnPasses'))
            .join(',\n');

          return `${key}: {
    ${listOfProperties}
}
  `;
        } else {
          if (isPropertyTopLevel(node)) {
            return `// ${node.getText()} `;
          }
        }
      }
    );

    updatedWithSetupNodeEvents = tsquery.replace(
      noVideoUploadOption,
      `${setupNodeEventsQuery} Block`,
      (node: PropertyAssignment | MethodDeclaration) => {
        const blockWithoutBraces = node
          .getFullText()
          .trim()
          .slice(1, -1)
          .trim();
        return `{
  ${blockWithoutBraces}
  removePassedSpecs(on);
}
`;
      },
      { visitAllChildren: false }
    );
  } else {
    // if don't have setupNodeEvents, replace videoUploadOnPasses with setupNodeEvents method
    updatedWithSetupNodeEvents = tsquery.replace(
      withReplacementFn,
      getPropertyQuery('videoUploadOnPasses'),
      () => {
        return `setupNodeEvents(on, config) {
  removePassedSpecs(on);
}`;
      }
    );
  }

  tree.write(configPath, updatedWithSetupNodeEvents);
}

/**
 * remove the nodeVersion option from the config file
 **/
function removeNodeVersionOption(tree: Tree, configPath: string) {
  const config = tree.read(configPath, 'utf-8');

  const updated = tsquery.replace(
    config,
    getPropertyQuery('nodeVersion'),
    (node: PropertyAssignment) => {
      if (isObjectLiteralExpression(node.initializer)) {
        // is a nested config object
        const key = node.name.getText().trim();
        const listOfProperties = node.initializer.properties
          .map((j) => j.getFullText())
          .filter((j) => !j.includes('nodeVersion'))
          .join(',    ');
        return `${key}: {
    ${listOfProperties}
  }`;
      } else {
        if (isPropertyTopLevel(node)) {
          return `// ${node.getText()}`;
        }
      }
    }
  );

  if (updated !== config) {
    tree.write(configPath, updated);
  }
}

/**
 * leave a comment on all usages of overriding built-ins that are now banned
 **/
export function shouldNotOverrideReadFile(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  const markedOverrideUsage = tsquery.replace(
    content,
    'PropertyAccessExpression:has(Identifier[name="overwrite"]):has(Identifier[name="Cypress"])',
    (node: PropertyAccessExpression) => {
      if (isAlreadyCommented(node)) {
        return;
      }
      const expression = node.expression.getText().trim();
      // prevent grabbing other Cypress.<something>.defaults

      if (expression === 'Cypress.Commands') {
        // get value.
        const overwriteExpression = node.parent as CallExpression;

        const command = (overwriteExpression.arguments?.[0] as any)?.text; // need string without quotes
        if (command === 'readFile') {
          // overwrite
          return `/**
* TODO(@nx/cypress): This command can no longer be overridden
* Consider using a different name like 'custom_${command}'
* More info: https://docs.cypress.io/guides/references/migration-guide#readFile-can-no-longer-be-overwritten-with-CypressCommandsoverwrite
**/
${node.getText()}`;
        }
      }
    }
  );
  tree.write(filePath, markedOverrideUsage);
}

function isAlreadyCommented(node: PropertyAccessExpression) {
  return node.getFullText().includes('TODO(@nx/cypress)');
}

function isPropertyTopLevel(node: PropertyAssignment) {
  return (
    node.parent &&
    isObjectLiteralExpression(node.parent) &&
    node.parent.parent &&
    isCallExpression(node.parent.parent)
  );
}

const getPropertyQuery = (propertyName: string) =>
  `ExportAssignment ObjectLiteralExpression > PropertyAssignment:has(Identifier[name="${propertyName}"])`;

export default updateToCypress13;
