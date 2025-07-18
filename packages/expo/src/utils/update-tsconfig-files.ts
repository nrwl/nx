import {
  Tree,
  updateJson,
  readProjectConfiguration,
  joinPathFragments,
} from '@nx/devkit';
import { join } from 'path';

function determineTsConfig(tree: Tree, projectName: string) {
  const project = readProjectConfiguration(tree, projectName);

  const appJson = joinPathFragments(project.root, 'tsconfig.app.json');
  if (tree.exists(appJson)) return 'tsconfig.app.json';

  const libJson = joinPathFragments(project.root, 'tsconfig.lib.json');
  if (tree.exists(libJson)) return 'tsconfig.lib.json';

  return 'tsconfig.json';
}

export function updateTsConfigFiles(
  tree: Tree,
  projectName: string,
  projectRoot: string
) {
  // Determine which main tsconfig file to update (app or lib)
  const mainTsConfigFile = determineTsConfig(tree, projectName);
  const mainTsConfigPath = join(projectRoot, mainTsConfigFile);

  // Update main tsconfig (app or lib) to exclude jest.resolver.js
  if (tree.exists(mainTsConfigPath)) {
    updateJson(tree, mainTsConfigPath, (json) => {
      if (!json.exclude) {
        json.exclude = [];
      }
      if (!json.exclude.includes('jest.resolver.js')) {
        json.exclude.push('jest.resolver.js');
      }
      return json;
    });
  }

  // Update tsconfig.spec.json to include jest.resolver.js
  const specTsConfigPath = join(projectRoot, 'tsconfig.spec.json');
  if (tree.exists(specTsConfigPath)) {
    updateJson(tree, specTsConfigPath, (json) => {
      if (!json.include) {
        json.include = [];
      }
      if (!json.include.includes('jest.resolver.js')) {
        json.include.push('jest.resolver.js');
      }
      return json;
    });
  }
}
