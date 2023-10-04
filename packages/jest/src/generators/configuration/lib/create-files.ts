import {
  generateFiles,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { join } from 'path';
import { NormalizedJestProjectSchema } from '../schema';

export function createFiles(tree: Tree, options: NormalizedJestProjectSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const filesFolder =
    options.setupFile === 'angular' ? '../files-angular' : '../files';

  let transformer: string;
  let transformerOptions: string | null = null;
  if (options.compiler === 'babel' || options.babelJest) {
    transformer = 'babel-jest';
  } else if (options.compiler === 'swc') {
    transformer = '@swc/jest';
    if (options.supportTsx) {
      transformerOptions =
        "{ jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } } }";
    }
  } else {
    transformer = 'ts-jest';
    transformerOptions = "{ tsconfig: '<rootDir>/tsconfig.spec.json' }";
  }

  generateFiles(tree, join(__dirname, filesFolder), projectConfig.root, {
    tmpl: '',
    ...options,
    // jsdom is the default
    testEnvironment:
      options.testEnvironment === 'none' || options.testEnvironment === 'jsdom'
        ? ''
        : options.testEnvironment,
    transformer,
    transformerOptions,
    js: !!options.js,
    rootProject: options.rootProject,
    projectRoot: options.rootProject ? options.project : projectConfig.root,
    offsetFromRoot: offsetFromRoot(projectConfig.root),
  });

  if (options.setupFile === 'none') {
    tree.delete(join(projectConfig.root, './src/test-setup.ts'));
  }

  if (options.js) {
    tree.rename(
      join(projectConfig.root, 'jest.config.ts'),
      join(projectConfig.root, 'jest.config.js')
    );
  }
}
