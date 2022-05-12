import {
  generateFiles,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { join } from 'path';
import { JestProjectSchema } from '../schema';

export function createFiles(tree: Tree, options: JestProjectSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const filesFolder =
    options.setupFile === 'angular' ? '../files-angular' : '../files';

  let transformer: string;
  if (options.compiler === 'babel' || options.babelJest) {
    transformer = 'babel-jest';
  } else if (options.compiler === 'swc') {
    transformer = '@swc/jest';
  } else {
    transformer = 'ts-jest';
  }

  generateFiles(tree, join(__dirname, filesFolder), projectConfig.root, {
    tmpl: '',
    ...options,
    transformer,
    js: !!options.js,
    diagnostics: !!options.diagnostics,
    projectRoot: projectConfig.root,
    offsetFromRoot: offsetFromRoot(projectConfig.root),
  });

  if (options.setupFile === 'none') {
    tree.delete(join(projectConfig.root, './src/test-setup.ts'));
  }

  if (options.babelJest && !tree.exists('babel.config.json')) {
    tree.write(
      'babel.config.json',
      JSON.stringify({
        babelrcRoots: ['*'],
      })
    );
  }

  if (options.js) {
    tree.rename(
      join(projectConfig.root, 'jest.config.ts'),
      join(projectConfig.root, 'jest.config.js')
    );
  }
}
