import {
  generateFiles,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import * as ts from 'typescript';
import { getComponentNode } from '../../../utils/ast-utils';
import { componentTestGenerator } from '../../component-test/component-test';
import { CypressComponentConfigurationSchema } from '../schema';

const allowedFileExt = new RegExp(/\.[jt]sx?/g);
const isSpecFile = new RegExp(/(spec|test)\./g);

export function addFiles(
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
    joinPathFragments(__dirname, '..', 'files'),
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
