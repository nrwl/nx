import { JestProjectSchema } from '../schema';
import {
  Tree,
  offsetFromRoot,
  generateFiles,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { join } from 'path';

export function createFiles(tree: Tree, options: JestProjectSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  generateFiles(tree, join(__dirname, '../files'), projectConfig.root, {
    tmpl: '',
    ...options,
    transformer: options.babelJest ? 'babel-jest' : 'ts-jest',
    projectRoot: projectConfig.root,
    offsetFromRoot: offsetFromRoot(projectConfig.root),
  });

  if (options.setupFile === 'none') {
    tree.delete(join(projectConfig.root, './src/test-setup.ts'));
  }
}
