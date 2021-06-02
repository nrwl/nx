import {
  formatFiles,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { join } from 'path';

import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '../../executors/jest/schema';
import { getJestObject } from '../update-10-0-0/require-jest-config';
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
      const jestConfig = getJestObject(
        join(tree.root, jestConfigPath)
      ) as PartialJestConfig;

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
    jestConfig.globals?.['ts-jest'].astTransformers
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
  addPropertyToJestConfig(tree, jestConfigPath, 'transform', {
    ...jestConfig.transform,
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
    ? transformer.startsWith('jest-preset-angular')
    : transformer.path.startsWith('jest-preset-angular');
}

export function usesJestPresetAngular(jestConfig: PartialJestConfig) {
  return jestConfig.globals['ts-jest']?.astTransformers?.before?.some?.((x) =>
    transformerIsFromJestPresetAngular(x)
  );
}
