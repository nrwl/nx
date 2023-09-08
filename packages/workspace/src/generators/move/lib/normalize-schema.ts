import {
  ProjectConfiguration,
  Tree,
  logger,
  names,
  readNxJson,
  stripIndents,
  updateNxJson,
} from '@nx/devkit';
import { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
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
    options.projectNameAndRootFormat ??
    (await determineFormat(tree, formats, options));

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
  schema: Schema,
  projectConfiguration: ProjectConfiguration
): ProjectNameAndRootFormats {
  let destination = normalizePathSlashes(schema.destination);
  const normalizedNewProjectName = schema.newProjectName
    ? names(schema.newProjectName).fileName
    : undefined;

  const asProvidedProjectName = normalizedNewProjectName ?? schema.projectName;
  const asProvidedDestination = destination;

  if (normalizedNewProjectName?.startsWith('@')) {
    return {
      'as-provided': {
        destination: asProvidedDestination,
        importPath:
          schema.importPath ??
          // keep the existing import path if the name didn't change
          (normalizedNewProjectName &&
          schema.projectName !== normalizedNewProjectName
            ? asProvidedProjectName
            : undefined),
        newProjectName: asProvidedProjectName,
      },
    };
  }

  let npmScope: string;
  let asProvidedImportPath = schema.importPath;
  if (
    !asProvidedImportPath &&
    schema.newProjectName &&
    projectConfiguration.projectType === 'library'
  ) {
    npmScope = getNpmScope(tree);
    asProvidedImportPath = npmScope
      ? `${npmScope === '@' ? '' : '@'}${npmScope}/${asProvidedProjectName}`
      : asProvidedProjectName;
  }

  const derivedProjectName =
    schema.newProjectName ?? getNewProjectName(destination);
  const derivedDestination = getDestination(tree, schema, projectConfiguration);

  let derivedImportPath: string;
  if (projectConfiguration.projectType === 'library') {
    derivedImportPath =
      schema.importPath ??
      normalizePathSlashes(getImportPath(tree, destination));
  }

  return {
    'as-provided': {
      destination: asProvidedDestination,
      newProjectName: asProvidedProjectName,
      importPath: asProvidedImportPath,
    },
    derived: {
      destination: derivedDestination,
      newProjectName: derivedProjectName,
      importPath: derivedImportPath,
    },
  };
}

async function determineFormat(
  tree: Tree,
  formats: ProjectNameAndRootFormats,
  schema: Schema
): Promise<ProjectNameAndRootFormat> {
  if (!formats.derived) {
    return 'as-provided';
  }

  if (process.env.NX_INTERACTIVE !== 'true' || !isTTY()) {
    return 'derived';
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
    initial: 'as-provided' as any,
  }).then(({ format }) =>
    format === asProvidedSelectedValue ? 'as-provided' : 'derived'
  );

  const callingGenerator =
    process.env.NX_ANGULAR_MOVE_INVOKED === 'true'
      ? '@nx/angular:move'
      : '@nx/workspace:move';
  const deprecationWarning = stripIndents`
    In Nx 18, the project name and destination will no longer be derived.
    Please provide the exact new project name and destination in the future.`;

  if (result === 'as-provided') {
    const { saveDefault } = await prompt<{ saveDefault: boolean }>({
      type: 'confirm',
      message: `Would you like to configure Nx to always take the project name and destination as provided for ${callingGenerator}?`,
      name: 'saveDefault',
      initial: true,
    });
    if (saveDefault) {
      const nxJson = readNxJson(tree);
      nxJson.generators ??= {};
      nxJson.generators[callingGenerator] ??= {};
      nxJson.generators[callingGenerator].projectNameAndRootFormat = result;
      updateNxJson(tree, nxJson);
    } else {
      logger.warn(deprecationWarning);
    }
  } else {
    const example =
      `Example: nx g ${callingGenerator} --projectName ${schema.projectName} --destination ${formats[result].destination}` +
      (schema.projectName !== formats[result].newProjectName
        ? ` --newProjectName ${formats[result].newProjectName}`
        : '');
    logger.warn(deprecationWarning + '\n' + example);
  }

  return result;
}

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}
