import {
  formatFiles,
  GeneratorCallback,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import {
  addTailwindConfig,
  addTailwindConfigPathToProject,
  addTailwindRequiredPackages,
  detectTailwindInstalledVersion,
  normalizeOptions,
  updateApplicationStyles,
} from './lib';
import { GeneratorOptions } from './schema';

export async function setupTailwindGenerator(
  tree: Tree,
  rawOptions: GeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  const project = readProjectConfiguration(tree, options.project);

  const tailwindInstalledVersion = detectTailwindInstalledVersion(tree);

  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    if (tailwindInstalledVersion === undefined) {
      installTask = addTailwindRequiredPackages(tree);
    }
  }

  addTailwindConfig(tree, options, project, tailwindInstalledVersion ?? '3');

  if (project.projectType === 'application') {
    updateApplicationStyles(tree, options, project);
  } else if (project.projectType === 'library') {
    addTailwindConfigPathToProject(tree, options, project);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default setupTailwindGenerator;
