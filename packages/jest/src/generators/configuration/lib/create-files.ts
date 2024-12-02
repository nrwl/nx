import {
  generateFiles,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { join } from 'path';
import type { JestPresetExtension } from '../../../utils/config/config-file';
import { NormalizedJestProjectSchema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export function createFiles(
  tree: Tree,
  options: NormalizedJestProjectSchema,
  presetExt: JestPresetExtension
) {
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

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);

  const projectRoot = options.rootProject
    ? options.project
    : projectConfig.root;
  const rootOffset = offsetFromRoot(projectConfig.root);
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
    projectRoot,
    offsetFromRoot: rootOffset,
    presetExt,
    coverageDirectory: isTsSolutionSetup
      ? `test-output/jest/coverage`
      : `${rootOffset}coverage/${projectRoot}`,
    extendedConfig: isTsSolutionSetup
      ? `${rootOffset}tsconfig.base.json`
      : './tsconfig.json',
    outDir: isTsSolutionSetup ? `./out-tsc/jest` : `${rootOffset}dist/out-tsc`,
    module: !isTsSolutionSetup ? 'commonjs' : undefined,
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
