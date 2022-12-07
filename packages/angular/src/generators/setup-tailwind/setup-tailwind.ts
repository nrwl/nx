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
import { getGeneratorDirectoryForInstalledAngularVersion } from '../../utils/get-generator-directory-for-ng-version';
import { join } from 'path';

export async function setupTailwindGenerator(
  tree: Tree,
  rawOptions: GeneratorOptions
): Promise<GeneratorCallback> {
  const generatorDirectory =
    getGeneratorDirectoryForInstalledAngularVersion(tree);
  if (generatorDirectory) {
    let previousGenerator = await import(
      join(__dirname, generatorDirectory, 'setup-tailwind')
    );
    await previousGenerator.default(tree, rawOptions);
    return;
  }

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
