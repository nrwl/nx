import { formatFiles, logger, stripIndents, Tree } from '@nrwl/devkit';
import { join } from 'path';

import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '../../executors/jest/schema';
import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '../../utils/config/update-config';

function updateJestConfig(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, project) => {
      if (!options.jestConfig) {
        return;
      }

      const jestConfigPath = options.jestConfig;
      const jestConfig = require(join(
        tree.root,
        jestConfigPath
      )) as PartialJestConfig;

      if (!usesJestPresetAngular(jestConfig)) {
        return;
      }

      try {
        updateASTTransformers(tree, jestConfigPath, jestConfig);
        updateTransform(tree, jestConfigPath, jestConfig);
      } catch {
        logger.error(
          stripIndents`Unable to update jest.config.js for project ${project}.`
        );
      }
    }
  );
}

export default async function update(tree: Tree) {
  updateJestConfig(tree);
  await formatFiles(tree);
}

export function updateASTTransformers(
  tree: Tree,
  jestConfigPath: string,
  jestConfig: PartialJestConfig
) {
  const newTransformers = getNewAstTransformers(
    jestConfig.globals?.['ts-jest']?.astTransformers
  );
  if (newTransformers === null) {
    removePropertyFromJestConfig(
      tree,
      jestConfigPath,
      'globals.ts-jest.astTransformers'
    );
  } else {
    addPropertyToJestConfig(
      tree,
      jestConfigPath,
      'globals.ts-jest.astTransformers',
      newTransformers
    );
  }
}

export function updateTransform(
  tree: Tree,
  jestConfigPath: string,
  jestConfig: PartialJestConfig
) {
  removePropertyFromJestConfig(tree, jestConfigPath, 'transform');
  addPropertyToJestConfig(tree, jestConfigPath, 'transform', {
    '^.+\\.(ts|js|html)$': 'jest-preset-angular',
  });
}

interface PartialJestConfig {
  globals: {
    'ts-jest': {
      astTransformers: ASTTransformers;
    };
  };
  transform?: Record<string, string>;
}

interface ASTTransformer {
  path: string;
  options: unknown;
}

interface ASTTransformers {
  before: (ASTTransformer | string)[];
  after: (ASTTransformer | string)[];
  afterDeclarations: (ASTTransformer | string)[];
}

export function getNewAstTransformers(
  astTransformers: ASTTransformers
): ASTTransformers | null {
  let result = {
    before: astTransformers?.before?.filter?.(
      (x) => !transformerIsFromJestPresetAngular(x)
    ),
    after: astTransformers?.after?.filter?.(
      (x) => !transformerIsFromJestPresetAngular(x)
    ),
    afterDeclarations: astTransformers?.afterDeclarations?.filter?.(
      (x) => !transformerIsFromJestPresetAngular(x)
    ),
  };

  result = {
    before: result.before?.length > 0 ? result.before : undefined,
    after: result.after?.length > 0 ? result.after : undefined,
    afterDeclarations:
      result.afterDeclarations?.length > 0
        ? result.afterDeclarations
        : undefined,
  };

  if (!result.before && !result.after && !result.afterDeclarations) {
    return null;
  } else {
    return result;
  }
}

export function transformerIsFromJestPresetAngular(
  transformer: ASTTransformer | string
) {
  return typeof transformer === 'string'
    ? transformer.includes('jest-preset-angular')
    : transformer.path.includes('jest-preset-angular');
}

export function usesJestPresetAngular(jestConfig: PartialJestConfig) {
  const transformers = Array.isArray(
    jestConfig.globals?.['ts-jest']?.astTransformers
  )
    ? jestConfig.globals?.['ts-jest']?.astTransformers || []
    : jestConfig.globals?.['ts-jest']?.astTransformers?.before || [];

  return transformers.some((x) => transformerIsFromJestPresetAngular(x));
}
