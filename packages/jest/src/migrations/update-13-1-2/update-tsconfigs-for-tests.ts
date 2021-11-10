import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import {
  formatFiles,
  logger,
  readProjectConfiguration,
  stripIndents,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { basename } from 'path';

function updateTsConfigsForTests(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (jestOptions, projectName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);

      visitNotIgnoredFiles(tree, projectConfig.root, (path) => {
        const fileName = basename(path);
        if (fileName.startsWith('tsconfig') && fileName.endsWith('.json')) {
          updateTsConfig(tree, path);
        }
      });
    }
  );

  function updateTsConfig(tree: Tree, tsconfigSpecPath: string) {
    try {
      updateJson<TsConfig>(tree, tsconfigSpecPath, (value) => {
        if (value.include) {
          value.include = makeAllPatternsFromSpecPatterns(value.include);
        }

        if (value.exclude) {
          value.exclude = makeAllPatternsFromSpecPatterns(value.exclude);
        }
        return value;
      });
    } catch (error) {
      // issue trying to parse the tsconfig file bc it's invalid JSON from template markup/comments
      // ignore and move on
      logger.warn(stripIndents`Unable to update ${tsconfigSpecPath}. `);
    }
  }
}

/**
 * take an array of patterns and create patterns from those containing .spec. with .test.
 * by default the pattern ** /*.spec.ts will be used if no value is passed in.
 */
function makeAllPatternsFromSpecPatterns(
  specGlobs: string[] = ['**/*.spec.ts']
): string[] {
  return makeUniquePatterns(
    specGlobs.reduce((patterns, current) => {
      patterns.push(current);
      // .spec. and _spec. can used as testing file name patterns
      if (current.includes('spec.')) {
        patterns.push(current.replace('spec.', 'test.'));
      }
      return patterns;
    }, [])
  );
}

function makeUniquePatterns(items: string[] = []): string[] {
  return [...new Set(items)];
}

export default async function update(tree: Tree) {
  updateTsConfigsForTests(tree);
  await formatFiles(tree);
}

interface TsConfig {
  files?: string[];
  include?: string[];
  exclude?: string[];
  references?: {
    path: string;
  }[];
}
