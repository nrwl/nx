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
    projectRoot: options.rootProject ? options.project : projectConfig.root,
    offsetFromRoot: offsetFromRoot(projectConfig.root),
  });

  if (options.rootProject) {
    // if the project is a root project,
    // then we need to set the root jest.config.ts to be what would normally be in the project level instead of the root one
    // if it's not a root project we need to make sure that the root jest.config.ts correctly has the monorepo setup support
  }
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
