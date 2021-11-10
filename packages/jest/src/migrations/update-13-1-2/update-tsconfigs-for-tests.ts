import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import {
  formatFiles,
  readProjectConfiguration,
  Tree,
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
        if (fileName.startsWith('tsconfig.') && fileName.endsWith('.json')) {
          updateTsConfigInclude(tree, path);
          updateTsConfigExclude(tree, path);
        }
      });
    }
  );

  /**
   * will update the TSConfig file pass in exclude property to include .test. patterns
   * where .spec. patterns are found.
   * will not update if exclude property is not present.
   */
  function updateTsConfigExclude(tree: Tree, tsConfigPath: string) {
    try {
      const appConfig = JSON.parse(tree.read(tsConfigPath, 'utf-8'));
      if (appConfig.exclude) {
        appConfig.exclude = makeAllPatternsFromSpecPatterns(
          appConfig.exclude || []
        );
        tree.write(tsConfigPath, JSON.stringify(appConfig));
      }
    } catch (error) {
      // issue trying to parse the tsconfig file bc it's invalid JSON from template markup/comments
      // ignore and move on
    }
  }

  /**
   * will update the TSConfig file pass in include property to include .test. patterns
   * where .spec. patterns are found.
   * will not update if include property is not present.
   */
  function updateTsConfigInclude(tree: Tree, tsconfigSpecPath: string) {
    try {
      const specConfig = JSON.parse(tree.read(tsconfigSpecPath, 'utf-8'));
      if (specConfig.include) {
        specConfig.include = makeAllPatternsFromSpecPatterns(
          specConfig.include
        );
        tree.write(tsconfigSpecPath, JSON.stringify(specConfig));
      }
    } catch (error) {
      // issue trying to parse the tsconfig file bc it's invalid JSON from template markup/comments
      // ignore and move on
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
