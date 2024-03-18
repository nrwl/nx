import {
  GeneratorCallback,
  getProjects,
  installPackagesTask,
  stripIndents,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import {
  CallExpression,
  isArrowFunction,
  isCallExpression,
  isFunctionExpression,
  isObjectLiteralExpression,
  PropertyAccessExpression,
  PropertyAssignment,
} from 'typescript';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import { installedCypressVersion } from '../../utils/cypress-version';
import { BANNED_COMMANDS, isAlreadyCommented } from './helpers';

const JS_TS_FILE_MATCHER = /\.[jt]sx?$/;

export function updateToCypress12(tree: Tree): GeneratorCallback {
  if (installedCypressVersion() < 11) {
    return;
  }
  const projects = getProjects(tree);

  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    '@nrwl/cypress:cypress',
    (options, projectName, targetName, configName) => {
      if (!(options.cypressConfig && tree.exists(options.cypressConfig))) {
        return;
      }
      const projectConfig = projects.get(projectName);
      turnOffTestIsolation(tree, options.cypressConfig);

      visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
        if (!JS_TS_FILE_MATCHER.test(filePath)) {
          return;
        }
        shouldUseCyIntercept(tree, filePath);
        shouldUseCySession(tree, filePath);
        shouldNotUseCyInShouldCB(tree, filePath);
        shouldNotOverrideCommands(tree, filePath);
      });
    }
  );

  console.warn(stripIndents`Cypress 12 has lots of breaking changes that might subtly break your tests.
This migration marked known issues that need to be manually migrated, 
but there can still be runtime based errors that were not detected.
Please consult the offical Cypress v12 migration guide for more info on these changes and the next steps.
https://docs.cypress.io/guides/references/migration-guide
      `);

  updateJson(tree, 'package.json', (json) => {
    json.devDependencies.cypress = '^12.2.0';
    return json;
  });

  return () => {
    installPackagesTask(tree);
  };
}

export function turnOffTestIsolation(tree: Tree, configPath: string) {
  const config = tree.read(configPath, 'utf-8');
  const isTestIsolationSet = tsquery.query<PropertyAssignment>(
    config,
    'ExportAssignment ObjectLiteralExpression > PropertyAssignment:has(Identifier[name="testIsolation"])'
  );

  if (isTestIsolationSet.length > 0) {
    return;
  }

  const testIsolationProperty = `/**
    * TODO(@nrwl/cypress): In Cypress v12,the testIsolation option is turned on by default. 
    * This can cause tests to start breaking where not indended.
    * You should consider enabling this once you verify tests do not depend on each other
    * More Info: https://docs.cypress.io/guides/references/migration-guide#Test-Isolation
    **/
    testIsolation: false,`;
  const updated = tsquery.replace(
    config,
    'ExportAssignment ObjectLiteralExpression > PropertyAssignment:has(Identifier[name="e2e"])',
    (node: PropertyAssignment) => {
      if (isObjectLiteralExpression(node.initializer)) {
        const listOfProperties = node.initializer.properties
          .map((j) => j.getText())
          .join(',\n    ');
        return `e2e: {
    ${listOfProperties},
    ${testIsolationProperty}
 }`;
      }
      return `e2e: {
    ...${node.initializer.getText()},
    ${testIsolationProperty}
  }`;
    }
  );

  tree.write(configPath, updated);
}

/**
 * Leave a comment on all apis that have been removed andsuperseded by cy.intercept
 * stating they these API are now removed and need to update.
 * cy.route, cy.server, Cypress.Server.defaults
 **/
export function shouldUseCyIntercept(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  const markedRemovedCommands = tsquery.replace(
    content,
    ':matches(PropertyAccessExpression:has(Identifier[name="cy"]):has(Identifier[name="server"], Identifier[name="route"]), PropertyAccessExpression:has(Identifier[name="defaults"]):has(Identifier[name="Cypress"], Identifier[name="Server"]))',
    (node: PropertyAccessExpression) => {
      if (isAlreadyCommented(node)) {
        return;
      }
      const expression = node.expression.getText().trim();
      // prevent extra chaining i.e. cy.route().as() will return 2 results
      // cy.route and cy.route().as
      // only need the first 1 so skip any extra chaining
      if (expression === 'cy' || expression === 'Cypress.Server') {
        return `// TODO(@nrwl/cypress): this command has been removed, use cy.intercept instead. https://docs.cypress.io/guides/references/migration-guide#cy-server-cy-route-and-Cypress-Server-defaults
${node.getText()}`;
      }
    }
  );

  tree.write(filePath, markedRemovedCommands);
}

/**
 * Leave a comment on all apis that have been removed and superseded by cy.session
 * stating they these API are now removed and need to update.
 * Cypress.Cookies.defaults & Cypress.Cookies.preserveOnce
 **/
export function shouldUseCySession(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  const markedRemovedCommands = tsquery.replace(
    content,
    ':matches(PropertyAccessExpression:has(Identifier[name="defaults"]):has(Identifier[name="Cypress"], Identifier[name="Cookies"]), PropertyAccessExpression:has(Identifier[name="preserveOnce"]):has(Identifier[name="Cypress"], Identifier[name="Cookies"]))',
    (node: PropertyAccessExpression) => {
      if (isAlreadyCommented(node)) {
        return;
      }
      const expression = node.expression.getText().trim();
      // prevent grabbing other Cypress.<something>.defaults
      if (expression === 'Cypress.Cookies') {
        return `// TODO(@nrwl/cypress): this command has been removed, use cy.session instead. https://docs.cypress.io/guides/references/migration-guide#Command-Cypress-API-Changes
${node.getText()}`;
      }
    }
  );

  tree.write(filePath, markedRemovedCommands);
}

/**
 * leave a comment about nested cy commands in a cy.should callback
 * */
export function shouldNotUseCyInShouldCB(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  const markedNestedCyCommands = tsquery.replace(
    content,
    'CallExpression > PropertyAccessExpression:has(Identifier[name="cy"]):has(Identifier[name="should"])',
    (node: PropertyAccessExpression) => {
      if (
        isAlreadyCommented(node) ||
        (node.parent && !isCallExpression(node.parent))
      ) {
        return;
      }
      const parentExpression = node.parent as CallExpression;
      if (
        parentExpression?.arguments?.[0] &&
        (isArrowFunction(parentExpression.arguments[0]) ||
          isFunctionExpression(parentExpression.arguments[0]))
      ) {
        const isUsingNestedCyCommand =
          tsquery.query<PropertyAccessExpression>(
            parentExpression.arguments[0],
            'CallExpression > PropertyAccessExpression:has(Identifier[name="cy"])'
          )?.length > 0;
        if (isUsingNestedCyCommand) {
          return `/**
* TODO(@nrwl/cypress): Nesting Cypress commands in a should assertion now throws.
* You should use .then() to chain commands instead.
* More Info: https://docs.cypress.io/guides/references/migration-guide#-should
**/
${node.getText()}`;
        }
        return node.getText();
      }
    }
  );

  tree.write(filePath, markedNestedCyCommands);
}

/**
 * leave a comment on all usages of overriding built-ins that are now banned
 * */
export function shouldNotOverrideCommands(tree: Tree, filePath: string) {
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
        if (BANNED_COMMANDS.includes(command)) {
          // overwrite
          return `/**
* TODO(@nrwl/cypress): This command can no longer be overridden
* Consider using a different name like 'custom_${command}'
* More info: https://docs.cypress.io/guides/references/migration-guide#Cypress-Commands-overwrite
**/
${node.getText()}`;
        }
      }
    }
  );

  tree.write(filePath, markedOverrideUsage);
}

export default updateToCypress12;
