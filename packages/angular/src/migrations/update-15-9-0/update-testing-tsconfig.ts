import {
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nx/devkit';
import { forEachExecutorOptionsInGraph } from '@nx/devkit/src/generators/executor-options-utils';
import type { JestExecutorOptions } from '@nx/jest/src/executors/jest/schema';

export async function updateTestingTsconfigForJest(tree: Tree) {
  const graph = await createProjectGraphAsync();
  const projects = getProjects(tree);
  forEachExecutorOptionsInGraph<JestExecutorOptions>(
    graph,
    '@nrwl/jest:jest',
    (options, projectName) => {
      const projectConfig = projects.get(projectName);

      if (!isJestPresetAngular(tree, options.jestConfig)) {
        return;
      }
      const tsconfigPath = joinPathFragments(
        projectConfig.root,
        'tsconfig.spec.json'
      );

      if (tree.exists(tsconfigPath)) {
        updateJson<TsConfig>(
          tree,
          tsconfigPath,
          (json) => {
            json.compilerOptions ??= {};
            json.compilerOptions.target ??= 'es2016';

            return json;
          },
          { expectComments: true, allowTrailingComma: true }
        );
      }
    }
  );

  await formatFiles(tree);
}

function isJestPresetAngular(tree: Tree, jestConfigPath: string) {
  if (jestConfigPath && tree.exists(jestConfigPath)) {
    const contents = tree.read(jestConfigPath, 'utf-8');

    return contents.includes('jest-preset-angular');
  }
  return false;
}

export default updateTestingTsconfigForJest;

interface TsConfig {
  compilerOptions: {
    target?: string;
  };
}
