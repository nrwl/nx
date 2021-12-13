import {
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { relative } from 'path';
import {
  addTailwindConfigPathToProject,
  addTailwindRequiredPackages,
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

  const installTask = addTailwindRequiredPackages(tree);
  generateFiles(tree, joinPathFragments(__dirname, 'files'), project.root, {
    projectType: project.projectType,
    relativeSourceRoot: relative(project.root, project.sourceRoot),
    tmpl: '',
  });

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
