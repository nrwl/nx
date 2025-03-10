import {
  joinPathFragments,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { getNpmScope } from '../../../utilities/get-import-path';
import type { NormalizedSchema, Schema } from '../schema';
import { normalizePathSlashes } from './utils';
import { getProjectType } from '../../../utils/ts-solution-setup';

export async function normalizeSchema(
  tree: Tree,
  schema: Schema,
  projectConfiguration: ProjectConfiguration
): Promise<NormalizedSchema> {
  const { destination, newProjectName, importPath } =
    await determineProjectNameAndRootOptions(
      tree,
      schema,
      projectConfiguration
    );

  const isNxConfiguredInPackageJson = !tree.exists(
    joinPathFragments(projectConfiguration.root, 'project.json')
  );

  return {
    ...schema,
    destination: normalizePathSlashes(schema.destination),
    importPath,
    newProjectName,
    relativeToRootDestination: destination,
    isNxConfiguredInPackageJson,
  };
}

type ProjectNameAndRootOptions = {
  destination: string;
  newProjectName: string;
  importPath?: string;
};

async function determineProjectNameAndRootOptions(
  tree: Tree,
  options: Schema,
  projectConfiguration: ProjectConfiguration
): Promise<ProjectNameAndRootOptions> {
  validateName(tree, options.newProjectName, projectConfiguration);

  let destination = normalizePathSlashes(options.destination);

  if (
    options.newProjectName &&
    options.newProjectName.includes('/') &&
    !options.newProjectName.startsWith('@')
  ) {
    throw new Error(
      `You can't specify a new project name with a directory path (${options.newProjectName}). ` +
        `Please provide a valid name without path segments and the full destination with the "--destination" option.`
    );
  }

  const newProjectName = options.newProjectName ?? options.projectName;

  if (projectConfiguration.projectType !== 'library') {
    return { destination, newProjectName };
  }

  let importPath = options.importPath;
  if (importPath) {
    return { destination, newProjectName, importPath };
  }

  if (options.newProjectName?.startsWith('@')) {
    // keep the existing import path if the name didn't change
    importPath =
      options.newProjectName && options.projectName !== options.newProjectName
        ? newProjectName
        : undefined;
  } else if (options.newProjectName) {
    const npmScope = getNpmScope(tree);
    importPath = npmScope
      ? `${npmScope === '@' ? '' : '@'}${npmScope}/${newProjectName}`
      : newProjectName;
  }

  return { destination, newProjectName, importPath };
}

function validateName(
  tree: Tree,
  name: string | undefined,
  projectConfiguration: ProjectConfiguration
): void {
  if (!name) {
    return;
  }

  /**
   * Matches two types of project names:
   *
   * 1. Valid npm package names (e.g., '@scope/name' or 'name').
   * 2. Names starting with a letter and can contain any character except whitespace and ':'.
   *
   * The second case is to support the legacy behavior (^[a-zA-Z].*$) with the difference
   * that it doesn't allow the ":" character. It was wrong to allow it because it would
   * conflict with the notation for tasks.
   */
  const libraryPattern =
    '(?:^@[a-zA-Z0-9-*~][a-zA-Z0-9-*._~]*\\/[a-zA-Z0-9-~][a-zA-Z0-9-._~]*|^[a-zA-Z][^:]*)$';
  const appPattern = '^[a-zA-Z][^:]*$';
  const projectType = getProjectType(
    tree,
    projectConfiguration.root,
    projectConfiguration.projectType
  );

  if (projectType === 'application') {
    const validationRegex = new RegExp(appPattern);
    if (!validationRegex.test(name)) {
      throw new Error(
        `The new project name should match the pattern "${appPattern}". The provided value "${name}" does not match.`
      );
    }
  } else if (
    getProjectType(
      tree,
      projectConfiguration.root,
      projectConfiguration.projectType
    ) === 'library'
  ) {
    const validationRegex = new RegExp(libraryPattern);
    if (!validationRegex.test(name)) {
      throw new Error(
        `The new project name should match the pattern "${libraryPattern}". The provided value "${name}" does not match.`
      );
    }
  }
}
