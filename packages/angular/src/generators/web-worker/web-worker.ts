import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { addSnippet, normalizeOptions } from './lib';
import type { WebWorkerGeneratorOptions } from './schema';
import { getRelativePathToRootTsConfig } from '@nx/js';

export async function webWorkerGenerator(
  tree: Tree,
  rawOptions: WebWorkerGeneratorOptions
): Promise<void> {
  const options = normalizeOptions(tree, rawOptions);
  const workerNames = names(options.name);
  const projectConfig = readProjectConfiguration(tree, options.project);

  const substitutions = {
    rootOffset: offsetFromRoot(projectConfig.root),
    rootTsConfig: getRelativePathToRootTsConfig(tree, projectConfig.root),
    name: workerNames.fileName,
    tpl: '',
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, './files/worker'),
    options.path,
    substitutions
  );
  generateFiles(
    tree,
    joinPathFragments(__dirname, './files/config'),
    projectConfig.root,
    substitutions
  );

  if (options.snippet) {
    addSnippet(tree, workerNames.fileName, options.path);
  }

  projectConfig.targets['build'].options.webWorkerTsConfig ??=
    joinPathFragments(projectConfig.root, 'tsconfig.worker.json');
  if (projectConfig.targets['test']) {
    projectConfig.targets['test'].options.webWorkerTsConfig ??=
      joinPathFragments(projectConfig.root, 'tsconfig.worker.json');
  }
  updateProjectConfiguration(tree, options.project, projectConfig);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default webWorkerGenerator;
