import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
  OverwriteStrategy,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { assertSupportedAngularVersion } from '../../utils/assert-supported-angular-version';
import { addSnippet, normalizeOptions } from './lib';
import type { WebWorkerGeneratorOptions } from './schema';
import { getRelativePathToRootTsConfig } from '@nx/js';

const unitTestExecutors = new Set([
  '@angular/build:unit-test',
  '@nx/angular:unit-test',
]);

export async function webWorkerGenerator(
  tree: Tree,
  rawOptions: WebWorkerGeneratorOptions
): Promise<void> {
  assertSupportedAngularVersion(tree);
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
    substitutions,
    { overwriteStrategy: OverwriteStrategy.KeepExisting }
  );

  if (options.snippet) {
    addSnippet(tree, workerNames.fileName, options.path);
  }

  projectConfig.targets['build'].options.webWorkerTsConfig ??=
    joinPathFragments(projectConfig.root, 'tsconfig.worker.json');
  const testTarget = projectConfig.targets['test'];
  // The unit-test executors have no such option and use the build target's.
  if (testTarget && !unitTestExecutors.has(testTarget.executor)) {
    testTarget.options.webWorkerTsConfig ??= joinPathFragments(
      projectConfig.root,
      'tsconfig.worker.json'
    );
  }
  updateProjectConfiguration(tree, options.project, projectConfig);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default webWorkerGenerator;
