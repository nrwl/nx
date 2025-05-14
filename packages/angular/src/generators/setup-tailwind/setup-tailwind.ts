import {
  formatFiles,
  GeneratorCallback,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import {
  addTailwindConfig,
  addTailwindRequiredPackages,
  detectTailwindInstalledVersion,
  normalizeOptions,
  updateApplicationStyles,
  validateBuildTarget,
} from './lib';
import { GeneratorOptions } from './schema';

export async function setupTailwindGenerator(
  tree: Tree,
  rawOptions: GeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  const project = readProjectConfiguration(tree, options.project);

  if (rawOptions.buildTarget && !project.targets?.[rawOptions.buildTarget]) {
    throw new Error(
      `The provided target "${options.buildTarget}" was not found for project "${options.project}". Please provide a valid build target.`
    );
  }

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
    validateBuildTarget(options, project);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default setupTailwindGenerator;
