import { CY_FILE_MATCHER } from '../../utils/ct-helpers';
import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  joinPathFragments,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { extname } from 'path';
import * as ts from 'typescript';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import { installedCypressVersion } from '../../utils/cypress-version';
import { cypressVersion } from '../../utils/versions';

export async function updateToCypress11(tree: Tree) {
  const installedVersion = installedCypressVersion();
  if (installedVersion < 10) {
    return;
  }

  const projects = getProjects(tree);
  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    '@nrwl/cypress:cypress',
    (options, projectName, targetName, configurationName) => {
      if (
        options.testingType !== 'component' ||
        !(options.cypressConfig && tree.exists(options.cypressConfig))
      ) {
        return;
      }
      const projectConfig = projects.get(projectName);
      const commandsFile = joinPathFragments(
        projectConfig.root,
        'cypress',
        'support',
        'commands.ts'
      );
      const framework = getFramework(
        tree.exists(commandsFile)
          ? tree.read(commandsFile, 'utf-8')
          : tree.read(options.cypressConfig, 'utf-8')
      );

      visitNotIgnoredFiles(tree, projectConfig.sourceRoot, (filePath) => {
        if (!CY_FILE_MATCHER.test(filePath)) {
          return;
        }
        const frameworkFromFile = getFramework(tree.read(filePath, 'utf-8'));

        if (framework === 'react' || frameworkFromFile === 'react') {
          updateUnmountUsage(tree, filePath);
          updateMountHookUsage(tree, filePath);
        }
        if (framework === 'angular' || frameworkFromFile === 'angular') {
          updateProviderUsage(tree, filePath);
        }
      });
    }
  );

  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    { cypress: cypressVersion }
  );

  await formatFiles(tree);
  return () => {
    installTask();
  };
}

export function updateMountHookUsage(tree: Tree, filePath: string) {
  const originalContents = tree.read(filePath, 'utf-8');
  const commentedMountHook = tsquery.replace(
    originalContents,
    ':matches(ImportDeclaration, VariableStatement):has(Identifier[name="mountHook"]):has(StringLiteral[value="cypress/react"], StringLiteral[value="cypress/react18"])',
    (node) => {
      return `/** TODO: mountHook is deprecate. 
* Use a wrapper component instead. 
* See post for details: https://www.cypress.io/blog/2022/11/04/upcoming-changes-to-component-testing/#reactmounthook-removed 
* */\n${node.getText()}`;
    }
  );

  tree.write(filePath, commentedMountHook);
}

export function updateUnmountUsage(tree: Tree, filePath: string) {
  const reactDomImport = extname(filePath).includes('ts')
    ? `import ReactDom from 'react-dom'`
    : `const ReactDom = require('react-dom')`;

  const originalContents = tree.read(filePath, 'utf-8');

  const updatedImports = tsquery.replace(
    originalContents,
    ':matches(ImportDeclaration, VariableStatement):has(Identifier[name="unmount"]):has(StringLiteral[value="cypress/react"], StringLiteral[value="cypress/react18"])',
    (node) => {
      return `${node.getText().replace('unmount', 'getContainerEl')}
${reactDomImport}`;
    }
  );

  const updatedUnmountApi = tsquery.replace(
    updatedImports,
    'ExpressionStatement > CallExpression:has(Identifier[name="unmount"])',
    (node: ts.ExpressionStatement) => {
      if (node.expression.getText() === 'unmount') {
        return `cy.then(() => ReactDom.unmountComponentAtNode(getContainerEl()))`;
      }
    }
  );

  tree.write(filePath, updatedUnmountApi);
}

export function updateProviderUsage(tree: Tree, filePath: string) {
  const originalContents = tree.read(filePath, 'utf-8');
  const isTestBedImported =
    tsquery.query(
      originalContents,
      ':matches(ImportDeclaration, VariableStatement):has(Identifier[name="TestBed"]):has(StringLiteral[value="@angular/core/testing"])'
    )?.length > 0;

  let updatedProviders = tsquery.replace(
    originalContents,
    'CallExpression:has(PropertyAccessExpression:has(Identifier[name="mount"]))',
    (node: ts.CallExpression) => {
      const expressionName = node.expression.getText();
      if (expressionName === 'cy.mount' && node?.arguments?.length > 1) {
        const component = node.arguments[0].getText();

        if (ts.isObjectLiteralExpression(node.arguments[1])) {
          const providers = node.arguments[1]?.properties
            ?.find((p) => p.name?.getText() === 'providers')
            ?.getText();
          const noProviders = tsquery.replace(
            node.getText(),
            'PropertyAssignment:has(Identifier[name="providers"])',
            (n) => {
              // set it to undefined so we don't run into a hanging comma causing invalid syntax
              return 'providers: undefined';
            }
          );
          return `TestBed.overrideComponent(${component}, { add: { ${providers} }});\n${noProviders}`;
        } else {
          return `TestBed.overrideComponent(${component}, {add: { providers: ${node.arguments[1].getText()}.providers}});\n${node.getText()}`;
        }
      }
    }
  );
  tree.write(
    filePath,
    `${
      isTestBedImported
        ? ''
        : "import {TestBed} from '@angular/core/testing';\n"
    }${updatedProviders}`
  );
}

function getFramework(contents: string): 'react' | 'angular' | null {
  if (contents.includes('cypress/react') || contents.includes('@nrwl/react')) {
    return 'react';
  }
  if (
    contents.includes('cypress/angular') ||
    contents.includes('@nrwl/angular')
  ) {
    return 'angular';
  }
  return null;
}

export default updateToCypress11;
