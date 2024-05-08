import {
  logger,
  names,
  output,
  stripIndents,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { prompt } from 'enquirer';
import { getImportPath, getNpmScope } from '../../../utilities/get-import-path';
import type { NormalizedSchema, Schema } from '../schema';
import {
  getDestination,
  getNewProjectName,
  normalizePathSlashes,
} from './utils';

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

  return {
    ...schema,
    destination: normalizePathSlashes(schema.destination),
    importPath,
    newProjectName,
    relativeToRootDestination: destination,
  };
}

type ProjectNameAndRootOptions = {
  destination: string;
  newProjectName: string;
  importPath?: string;
};

type ProjectNameAndRootFormats = {
  'as-provided': ProjectNameAndRootOptions;
  derived?: ProjectNameAndRootOptions;
};

async function determineProjectNameAndRootOptions(
  tree: Tree,
  options: Schema,
  projectConfiguration: ProjectConfiguration
): Promise<ProjectNameAndRootOptions> {
  if (
    !options.projectNameAndRootFormat &&
    (process.env.NX_INTERACTIVE !== 'true' || !isTTY())
  ) {
    options.projectNameAndRootFormat = 'derived';
  }

  validateName(
    options.newProjectName,
    options.projectNameAndRootFormat,
    projectConfiguration
  );
  const formats = getProjectNameAndRootFormats(
    tree,
    options,
    projectConfiguration
  );
  const format =
    options.projectNameAndRootFormat ?? (await determineFormat(formats));

  if (format === 'derived') {
    logDeprecationMessage(formats, options);
  }

  return formats[format];
}

function validateName(
  name: string | undefined,
  projectNameAndRootFormat: ProjectNameAndRootFormat | undefined,
  projectConfiguration: ProjectConfiguration
): void {
  if (!name) {
    return;
  }

  if (projectNameAndRootFormat === 'derived' && name.startsWith('@')) {
    throw new Error(
      `The new project name "${name}" cannot start with "@" when the "projectNameAndRootFormat" is "derived".`
    );
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

  if (projectConfiguration.projectType === 'application') {
    const validationRegex = new RegExp(appPattern);
    if (!validationRegex.test(name)) {
      throw new Error(
        `The new project name should match the pattern "${appPattern}". The provided value "${name}" does not match.`
      );
    }
  } else if (projectConfiguration.projectType === 'library') {
    const validationRegex = new RegExp(libraryPattern);
    if (!validationRegex.test(name)) {
      throw new Error(
        `The new project name should match the pattern "${libraryPattern}". The provided value "${name}" does not match.`
      );
    }
  }
}

function getProjectNameAndRootFormats(
  tree: Tree,
  options: Schema,
  projectConfiguration: ProjectConfiguration
): ProjectNameAndRootFormats {
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

  const asProvidedOptions = getAsProvidedOptions(
    tree,
    { ...options, destination },
    projectConfiguration
  );

  if (options.projectNameAndRootFormat === 'as-provided') {
    return {
      'as-provided': asProvidedOptions,
      derived: undefined,
    };
  }

  if (asProvidedOptions.newProjectName.startsWith('@')) {
    if (!options.projectNameAndRootFormat) {
      output.warn({
        title: `The provided new project name "${asProvidedOptions.newProjectName}" is a scoped project name and this is not supported by the move generator when using the "derived" format.`,
        bodyLines: [
          `The generator will try to move the project using the "as-provided" format with the new name "${asProvidedOptions.newProjectName}" located at "${asProvidedOptions.destination}".`,
        ],
      });

      return {
        'as-provided': asProvidedOptions,
        derived: undefined,
      };
    }

    throw new Error(
      `The provided new project name "${options.newProjectName}" is a scoped project name and this is not supported by the move generator when using the "derived" format. ` +
        `Please provide a name without "@" or use the "as-provided" format.`
    );
  }

  const derivedOptions = getDerivedOptions(
    tree,
    { ...options, destination },
    projectConfiguration
  );

  return {
    'as-provided': asProvidedOptions,
    derived: derivedOptions,
  };
}

async function determineFormat(
  formats: ProjectNameAndRootFormats
): Promise<ProjectNameAndRootFormat> {
  if (!formats.derived) {
    return 'as-provided';
  }

  const asProvidedDescription = `As provided:
    Name: ${formats['as-provided'].newProjectName}
    Destination: ${formats['as-provided'].destination}`;
  const asProvidedSelectedValue = `${formats['as-provided'].newProjectName} @ ${formats['as-provided'].destination}`;
  const derivedDescription = `Derived:
    Name: ${formats['derived'].newProjectName}
    Destination: ${formats['derived'].destination}`;
  const derivedSelectedValue = `${formats['derived'].newProjectName} @ ${formats['derived'].destination}`;

  const result = await prompt<{ format: ProjectNameAndRootFormat }>({
    type: 'select',
    name: 'format',
    message:
      'What should be the new project name and where should it be moved to?',
    choices: [
      {
        message: asProvidedDescription,
        name: asProvidedSelectedValue,
      },
      {
        message: derivedDescription,
        name: derivedSelectedValue,
      },
    ],
    initial: 0,
  }).then(({ format }) =>
    format === asProvidedSelectedValue ? 'as-provided' : 'derived'
  );

  return result;
}

function logDeprecationMessage(
  formats: ProjectNameAndRootFormats,
  options: Schema
) {
  const callingGenerator =
    process.env.NX_ANGULAR_MOVE_INVOKED === 'true'
      ? '@nx/angular:move'
      : '@nx/workspace:move';

  logger.warn(
    stripIndents`
    In Nx 19, the project name and destination will no longer be derived.
    Please provide the exact new project name and destination in the future.
    Example: nx g ${callingGenerator} --projectName ${options.projectName} --destination ${formats['derived'].destination}` +
      (options.projectName !== formats['derived'].newProjectName
        ? ` --newProjectName ${formats['derived'].newProjectName}`
        : '')
  );
}

function getAsProvidedOptions(
  tree: Tree,
  options: Schema,
  projectConfiguration: ProjectConfiguration
): ProjectNameAndRootOptions {
  const newProjectName = options.newProjectName ?? options.projectName;
  const destination = options.destination;

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

function getDerivedOptions(
  tree: Tree,
  options: Schema,
  projectConfiguration: ProjectConfiguration
): ProjectNameAndRootOptions {
  const newProjectName = options.newProjectName
    ? names(options.newProjectName).fileName
    : getNewProjectName(options.destination);
  const destination = getDestination(tree, options, projectConfiguration);

  let importPath: string | undefined;
  if (projectConfiguration.projectType === 'library') {
    importPath =
      options.importPath ??
      normalizePathSlashes(getImportPath(tree, options.destination));
  }

  return { destination, newProjectName, importPath };
}

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}
