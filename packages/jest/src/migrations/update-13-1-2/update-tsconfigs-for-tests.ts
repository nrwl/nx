import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

function updateTsConfigsForTests(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (jestOptions, projectName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);

      const tsConfig = joinPathFragments(projectConfig.root, 'tsconfig.json');

      if (!tree.exists(tsConfig)) {
        return;
      }

      const tsConfigContent: TsConfig = JSON.parse(
        tree.read(tsConfig, 'utf-8')
      );

      const specTsConfigRef = tsConfigContent?.references.find((ref) =>
        ref.path.endsWith('tsconfig.spec.json')
      );

      const appLibTsConfigRefs = tsConfigContent?.references.filter(
        (ref) =>
          ref.path.endsWith('tsconfig.app.json') ||
          ref.path.endsWith('tsconfig.lib.json')
      );

      if (!specTsConfigRef || appLibTsConfigRefs?.length === 0) {
        // couldn't find any files to update. just leave it be.
        return;
      }

      for (const config of appLibTsConfigRefs) {
        const tsConfigPath = joinPathFragments(projectConfig.root, config.path);
        updateTsConfigExclude(tree, tsConfigPath);
      }

      const tsconfigSpecPath = joinPathFragments(
        projectConfig.root,
        specTsConfigRef.path
      );
      updateTsConfigInclude(tree, tsconfigSpecPath);
    }
  );

  /**
   * will update the TSConfig file pass in exclude property to include .test. patterns
   * where .spec. patterns are found.
   */
  function updateTsConfigExclude(tree: Tree, tsConfigPath: string) {
    const appConfig = JSON.parse(tree.read(tsConfigPath, 'utf-8'));
    appConfig.exclude = makeAllPatternsFromSpecPatterns(appConfig.exclude);
    tree.write(tsConfigPath, JSON.stringify(appConfig));
  }

  /**
   * will update the TSConfig file pass in include property to include .test. patterns
   * where .spec. patterns are found.
   */
  function updateTsConfigInclude(tree: Tree, tsconfigSpecPath: string) {
    const specConfig = JSON.parse(tree.read(tsconfigSpecPath, 'utf-8'));
    specConfig.include = makeAllPatternsFromSpecPatterns(specConfig.include);
    tree.write(tsconfigSpecPath, JSON.stringify(specConfig));
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

interface TsConfig {
  files?: string[];
  include?: string[];
  exclude?: string[];
  references?: {
    path: string;
  }[];
}
