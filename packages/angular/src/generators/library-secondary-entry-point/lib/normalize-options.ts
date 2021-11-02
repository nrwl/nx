import {
  getProjects,
  joinPathFragments,
  names,
  readJson,
  Tree,
} from '@nrwl/devkit';
import { GeneratorOptions, NormalizedGeneratorOptions } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: GeneratorOptions
): NormalizedGeneratorOptions {
  const name = names(options.name).fileName;

  const projects = getProjects(tree);
  const libraryProject = projects.get(options.library);
  if (!libraryProject) {
    throw new Error(
      `The specified library "${options.library}" couldn't be found in the workspace.`
    );
  }

  if (libraryProject.projectType !== 'library') {
    throw new Error(
      `The specified project "${options.library}" is not a library.`
    );
  }

  const entryPointDestination = joinPathFragments(
    libraryProject.root,
    options.name
  );
  if (tree.exists(entryPointDestination)) {
    throw new Error(
      `The folder for the secondary entry point "${entryPointDestination}" already exists.`
    );
  }

  const { name: mainEntryPoint } = readJson(
    tree,
    joinPathFragments(libraryProject.root, 'package.json')
  );
  const secondaryEntryPoint = `${mainEntryPoint}/${options.name}`;

  return {
    ...options,
    entryPointDestination,
    mainEntryPoint,
    name,
    libraryProject,
    secondaryEntryPoint,
    skipModule: options.skipModule ?? false,
  };
}
