import {
  generateFiles,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { addSwcTestConfig } from '@nx/js/src/utils/swc/add-swc-config';
import { join } from 'path';
import type { JestPresetExtension } from '../../../utils/config/config-file';
import { NormalizedJestProjectSchema } from '../schema';

export function createFiles(
  tree: Tree,
  options: NormalizedJestProjectSchema,
  presetExt: JestPresetExtension
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const commonFilesFolder =
    options.setupFile === 'angular' ? '../files-angular' : '../files/common';

  let transformer: string;
  let transformerOptions: string | null = null;
  if (options.compiler === 'babel' || options.babelJest) {
    transformer = 'babel-jest';
  } else if (options.compiler === 'swc') {
    transformer = '@swc/jest';
    if (options.isTsSolutionSetup) {
      transformerOptions = 'swcJestConfig';
    } else if (options.supportTsx) {
      transformerOptions =
        "{ jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } } }";
    }
  } else {
    transformer = 'ts-jest';
    transformerOptions = "{ tsconfig: '<rootDir>/tsconfig.spec.json' }";
  }

  if (options.compiler === 'swc' && options.isTsSolutionSetup) {
    addSwcTestConfig(tree, projectConfig.root, 'es6', options.supportTsx);
  }

  const projectRoot = options.rootProject
    ? options.project
    : projectConfig.root;
  const rootOffset = offsetFromRoot(projectConfig.root);
  // jsdom is the default in the nx preset
  const testEnvironment =
    options.testEnvironment === 'none' || options.testEnvironment === 'jsdom'
      ? ''
      : options.testEnvironment;
  const coverageDirectory = options.isTsSolutionSetup
    ? `test-output/jest/coverage`
    : `${rootOffset}coverage/${projectRoot}`;

  generateFiles(tree, join(__dirname, commonFilesFolder), projectConfig.root, {
    tmpl: '',
    ...options,
    testEnvironment,
    transformer,
    transformerOptions,
    js: !!options.js,
    rootProject: options.rootProject,
    projectRoot,
    offsetFromRoot: rootOffset,
    presetExt,
    coverageDirectory,
    extendedConfig: options.isTsSolutionSetup
      ? `${rootOffset}tsconfig.base.json`
      : './tsconfig.json',
    outDir: options.isTsSolutionSetup
      ? `./out-tsc/jest`
      : `${rootOffset}dist/out-tsc`,
    module:
      !options.isTsSolutionSetup || transformer === 'ts-jest'
        ? 'commonjs'
        : undefined,
  });

  if (options.setupFile !== 'angular') {
    generateFiles(
      tree,
      join(
        __dirname,
        options.isTsSolutionSetup
          ? '../files/jest-config-ts-solution'
          : '../files/jest-config-non-ts-solution'
      ),
      projectConfig.root,
      {
        tmpl: '',
        ...options,
        testEnvironment,
        transformer,
        transformerOptions,
        js: !!options.js,
        rootProject: options.rootProject,
        offsetFromRoot: rootOffset,
        presetExt,
        coverageDirectory,
      }
    );
  }

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
