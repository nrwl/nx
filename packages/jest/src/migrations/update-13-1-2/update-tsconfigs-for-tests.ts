import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import {
  formatFiles,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';

function updateTsConfigsForTests(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (jestOptions, projectName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);

      const tsconfigSpecPath = joinPathFragments(
        projectConfig.root,
        'tsconfig.spec.json'
      );

      updateTsConfigInclude(tree, tsconfigSpecPath);

      switch (projectConfig.projectType) {
        case 'library':
          const tsConfigLibPath = joinPathFragments(
            projectConfig.root,
            'tsconfig.lib.json'
          );
          updateTsConfigExclude(tree, tsConfigLibPath);
          break;
        case 'application':
          const tsConfigAppPath = joinPathFragments(
            projectConfig.root,
            'tsconfig.app.json'
          );
          updateTsConfigExclude(tree, tsConfigAppPath);
          break;
        default:
          logger.error(
            `Unable to update tsconfig for project type ${projectConfig.projectType} since it is unknown type in ${projectName}`
          );
      }
    }
  );

  /**
   * will update the TSConfig file pass in exclude property to include .test. patterns
   * where .spec. patterns are found.
   */
  function updateTsConfigExclude(tree: Tree, tsConfigPath: string) {
    if (tree.exists(tsConfigPath)) {
      const appConfig = JSON.parse(tree.read(tsConfigPath, 'utf-8'));
      appConfig.exclude = makeAllPatternsFromSpecPatterns(appConfig.exclude);
      tree.write(tsConfigPath, JSON.stringify(appConfig));
    } else {
      logger.error(stripIndents`Unable to find a tsconfig at ${tsConfigPath}`);
    }
  }

  /**
   * will update the TSConfig file pass in include property to include .test. patterns
   * where .spec. patterns are found.
   */
  function updateTsConfigInclude(tree: Tree, tsconfigSpecPath: string) {
    if (tree.exists(tsconfigSpecPath)) {
      const specConfig = JSON.parse(tree.read(tsconfigSpecPath, 'utf-8'));
      specConfig.include = makeAllPatternsFromSpecPatterns(specConfig.include);
      tree.write(tsconfigSpecPath, JSON.stringify(specConfig));
    } else {
      logger.error(
        stripIndents`Unable to update tsconfig.spec.json at ${tsconfigSpecPath}`
      );
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
      if (current.includes('.spec.')) {
        patterns.push(current.replace('.spec.', '.test.'));
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
