import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import { CY_FILE_MATCHER } from '../../utils/ct-helpers';
import { installedCypressVersion } from '../../utils/cypress-version';
import {
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  joinPathFragments,
  parseTargetString,
  readJson,
  TargetConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { tsquery } from '@phenomnomnominal/tsquery';
import { gte } from 'semver';
import * as ts from 'typescript';

export async function updateCyMountUsage(tree: Tree) {
  if (installedCypressVersion() < 10) {
    return;
  }

  const projects = getProjects(tree);
  const graph = await createProjectGraphAsync();

  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    '@nrwl/cypress:cypress',
    (options, projectName) => {
      if (options.testingType !== 'component' || !options.devServerTarget) {
        return;
      }

      const parsed = parseTargetString(options.devServerTarget, graph);
      if (!parsed?.project || !parsed?.target) {
        return;
      }

      const buildProjectConfig = projects.get(parsed.project);
      const framework = getFramework(
        tree,
        parsed.configuration
          ? buildProjectConfig.targets[parsed.target].configurations[
              parsed.configuration
            ]
          : buildProjectConfig.targets[parsed.target]
      );

      const ctProjectConfig = projects.get(projectName);
      addMountCommand(tree, ctProjectConfig.root, framework);
      visitNotIgnoredFiles(tree, ctProjectConfig.sourceRoot, (filePath) => {
        if (CY_FILE_MATCHER.test(filePath)) {
          updateCyFile(tree, filePath, framework);
        }
      });
    }
  );

  await formatFiles(tree);
}

export function addMountCommand(
  tree: Tree,
  projectRoot: string,
  framework: string
) {
  const commandFilePath = joinPathFragments(
    projectRoot,
    'cypress',
    'support',
    'commands.ts'
  );
  if (!tree.exists(commandFilePath)) {
    return;
  }

  const commandFile = tree.read(commandFilePath, 'utf-8');
  const mountCommand = tsquery.query<ts.PropertyAccessExpression>(
    commandFile,
    'CallExpression:has(StringLiteral[value="mount"]) PropertyAccessExpression:has(Identifier[name="add"])'
  );
  if (mountCommand?.length > 0) {
    return;
  }
  const existingCommands = tsquery.query<
    ts.MethodSignature | ts.PropertySignature
  >(
    commandFile,
    'InterfaceDeclaration:has(Identifier[name="Chainable"]) > MethodSignature, InterfaceDeclaration:has(Identifier[name="Chainable"]) > PropertySignature'
  );
  const isGlobalDeclaration = tsquery.query<ts.ModuleDeclaration>(
    commandFile,
    'ModuleDeclaration > Identifier[name="global"]'
  );

  const updatedInterface = tsquery.replace(
    commandFile,
    'ModuleDeclaration:has(Identifier[name="Cypress"])',
    (node: ts.ModuleDeclaration) => {
      const newModuleDelcaration = `declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Chainable<Subject> {
      ${existingCommands.map((c) => c.getText()).join('\n')}
      mount: typeof mount;
    }
  }
}`;
      /*
       * this is to prevent the change being applied twice since
       * declare global { 1
       *   interface Cypress { 2
       *   }
       * }
       * matches twice.
       * i.e. if there is no global declaration, then add it
       * or if the node is the global declaration, then add it,
       * but not to the cypress module declaration inside the global declaration
       */
      if (
        isGlobalDeclaration?.length === 0 ||
        node.name.getText() === 'global'
      ) {
        return newModuleDelcaration;
      }
    }
  );

  const updatedCommandFile = `import { mount } from 'cypress/${framework}'\n${updatedInterface}\nCypress.Commands.add('mount', mount);`;
  tree.write(commandFilePath, updatedCommandFile);
}

function getFramework(
  tree: Tree,
  target: TargetConfiguration
): 'angular' | 'react' | 'react18' {
  if (
    target.executor === '@nrwl/angular:webpack-browser' ||
    target.executor === '@angular-devkit/build-angular:browser'
  ) {
    return 'angular';
  }

  const pkgJson = readJson(tree, 'package.json');
  const reactDomVersion = pkgJson?.dependencies?.['react-dom'];
  const hasReact18 =
    reactDomVersion &&
    gte(checkAndCleanWithSemver('react-dom', reactDomVersion), '18.0.0');

  if (hasReact18) {
    return 'react18';
  }

  return 'react';
}

export function updateCyFile(
  tree: Tree,
  filePath: string,
  framework: 'angular' | 'react' | 'react18'
) {
  if (!tree.exists(filePath)) {
    return;
  }

  const contents = tree.read(filePath, 'utf-8');
  const withCyMount = tsquery.replace(
    contents,
    ':matches(CallExpression>Identifier[name="mount"])',
    (node: ts.CallExpression) => {
      return `cy.mount`;
    }
  );
  const withUpdatedImports = tsquery.replace(
    withCyMount,
    ':matches(ImportDeclaration, VariableStatement):has(Identifier[name="mount"]):has(StringLiteral[value="cypress/react"], StringLiteral[value="cypress/angular"], StringLiteral[value="cypress/react18"])',
    (node: ts.ImportDeclaration) => {
      switch (framework) {
        case 'angular':
          return `import { MountConfig } from 'cypress/angular';`;
        case 'react18':
        case 'react':
          return ' '; // have to return non falsy string to remove the node
        default:
          return node.getText().replace('mount', '');
      }
    }
  );

  tree.write(filePath, withUpdatedImports);
}

export default updateCyMountUsage;
