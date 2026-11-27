import {
  getProjects,
  joinPathFragments,
  names,
  readJson,
  type Tree,
} from '@nx/devkit';
import { getModuleTypeSeparator } from '../../utils/artifact-types';
import { findNgPackagrTarget, usesLibraryBuilder } from '../../utils/project';
import type { GeneratorOptions, NormalizedGeneratorOptions } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: GeneratorOptions
): Promise<NormalizedGeneratorOptions> {
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

  const usesPackageExports = usesLibraryBuilder(tree, options.library);
  if (usesPackageExports) {
    const ngPackagrTarget = await findNgPackagrTarget(tree, options.library);
    if (ngPackagrTarget) {
      const { target, file } = ngPackagrTarget;
      throw new Error(
        `The "${options.library}" library uses the library builder, but the "${target}" target in "${file}" uses ng-packagr. ` +
          `Generating secondary entry points for a library that uses both builders is not supported. ` +
          `Migrate the "${target}" target to the library builder, or remove it if it's unused.`
      );
    }
  }

  const { name: mainEntryPoint } = readJson(
    tree,
    joinPathFragments(libraryProject.root, 'package.json')
  );
  const secondaryEntryPoint = `${mainEntryPoint}/${options.name}`;
  const moduleTypeSeparator = getModuleTypeSeparator(tree);

  return {
    ...options,
    entryPointDestination,
    mainEntryPoint,
    name,
    libraryProject,
    secondaryEntryPoint,
    skipModule: options.skipModule ?? false,
    moduleTypeSeparator,
    usesPackageExports,
  };
}
