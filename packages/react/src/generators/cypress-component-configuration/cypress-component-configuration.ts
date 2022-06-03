import { cypressComponentProject } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import componentTestGenerator from '@nrwl/react/src/generators/component-test/component-test';
import { getComponentNode } from '@nrwl/react/src/utils/ast-utils';
import * as ts from 'typescript';
import { cypressReactVersion } from '../../utils/versions';
import { CypressComponentConfigurationSchema } from './schema';

const allowedFileExt = new RegExp(/\.[jt]sx?/g);
const isSpecFile = new RegExp(/(spec|test)\./g);

/**
 * This is for using cypresses own Component testing, if you want to use test
 * storybook components then use componentCypressGenerator instead.
 *
 */
export async function cypressComponentConfigGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const baseDepInstallTask = await cypressComponentProject(tree, {
    project: options.project,
    skipFormat: true,
  });
  const installReactDeps = addDeps(tree);

  addFiles(tree, projectConfig, options);
  updateTsConfig(tree, projectConfig);

  return () => {
    baseDepInstallTask();
    installReactDeps();
  };
}

function addDeps(tree: Tree) {
  const devDeps = {
    '@cypress/react': cypressReactVersion,
  };
  // TODO(caleb): add swc deps if using swc as a compiler?
  return addDependenciesToPackageJson(tree, {}, devDeps);
}

function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigurationSchema
) {
  const cypressConfigPath = joinPathFragments(
    projectConfig.root,
    'cypress.config.ts'
  );
  if (tree.exists(cypressConfigPath)) {
    tree.delete(cypressConfigPath);
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {
      tpl: '',
    }
  );

  if (options.generateTests) {
    visitNotIgnoredFiles(tree, projectConfig.sourceRoot, (filePath) => {
      if (isComponent(tree, filePath)) {
        componentTestGenerator(tree, {
          project: options.project,
          componentPath: filePath,
        });
      }
    });
  }
}

function updateTsConfig(tree: Tree, projectConfig: ProjectConfiguration) {
  const tsConfigPath = joinPathFragments(
    projectConfig.root,
    projectConfig.projectType === 'library'
      ? 'tsconfig.lib.json'
      : 'tsconfig.app.json'
  );
  if (tree.exists(tsConfigPath)) {
    updateJson(tree, tsConfigPath, (json) => {
      const excluded = new Set([
        ...(json.exclude || []),
        'cypress/**/*',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.js',
        '**/*.cy.tsx',
        '**/*.cy.jsx',
      ]);

      json.exclude = Array.from(excluded);
      return json;
    });
  }

  const projectBaseTsConfig = joinPathFragments(
    projectConfig.root,
    'tsconfig.json'
  );
  if (tree.exists(projectBaseTsConfig)) {
    updateJson(tree, projectBaseTsConfig, (json) => {
      if (json.references) {
        const hasCyTsConfig = json.references.some(
          (r) => r.path === './tsconfig.cy.json'
        );
        if (!hasCyTsConfig) {
          json.references.push({ path: './tsconfig.cy.json' });
        }
      } else {
        const excluded = new Set([
          ...(json.exclude || []),
          'cypress/**/*',
          'cypress.config.ts',
          '**/*.cy.ts',
          '**/*.cy.js',
          '**/*.cy.tsx',
          '**/*.cy.jsx',
        ]);

        json.exclude = Array.from(excluded);
      }
      return json;
    });
  }
}

function isComponent(tree: Tree, filePath: string): boolean {
  if (isSpecFile.test(filePath) || !allowedFileExt.test(filePath)) {
    return false;
  }

  const content = tree.read(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const cmpDeclaration = getComponentNode(sourceFile);
  return !!cmpDeclaration;
}

export default cypressComponentConfigGenerator;
