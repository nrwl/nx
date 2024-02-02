import { prompt } from 'enquirer';
import type { ProjectConfiguration } from 'nx/src/config/workspace-json-project-json';
import type { Tree } from 'nx/src/generators/tree';
import { join, relative } from 'path';
import { requireNx } from '../../nx';
import { names } from '../utils/names';

const {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
  getProjects,
  joinPathFragments,
  logger,
  normalizePath,
  output,
  workspaceRoot,
} = requireNx();

export type NameAndDirectoryFormat = 'as-provided' | 'derived';
export type ArtifactGenerationOptions = {
  artifactType: string;
  callingGenerator: string | null;
  name: string;
  directory?: string;
  disallowPathInNameForDerived?: boolean;
  fileExtension?: 'js' | 'jsx' | 'ts' | 'tsx' | 'vue';
  fileName?: string;
  flat?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  pascalCaseDirectory?: boolean;
  pascalCaseFile?: boolean;
  project?: string;
  suffix?: string;
  derivedDirectory?: string;
};

export type NameAndDirectoryOptions = {
  /**
   * Normalized artifact name.
   */
  artifactName: string;
  /**
   * Normalized directory path where the artifact will be generated.
   */
  directory: string;
  /**
   * Normalized file name of the artifact without the extension.
   */
  fileName: string;
  /**
   * Normalized full file path of the artifact.
   */
  filePath: string;
  /**
   * Project name where the artifact will be generated.
   */
  project: string;
};

type NameAndDirectoryFormats = {
  'as-provided': NameAndDirectoryOptions;
  derived: NameAndDirectoryOptions | undefined;
};

export async function determineArtifactNameAndDirectoryOptions(
  tree: Tree,
  options: ArtifactGenerationOptions
): Promise<
  NameAndDirectoryOptions & {
    nameAndDirectoryFormat: NameAndDirectoryFormat;
  }
> {
  if (
    !options.nameAndDirectoryFormat &&
    (process.env.NX_INTERACTIVE !== 'true' || !isTTY())
  ) {
    options.nameAndDirectoryFormat = 'derived';
  }

  const formats = getNameAndDirectoryOptionFormats(tree, options);
  const format =
    options.nameAndDirectoryFormat ?? (await determineFormat(formats, options));

  validateResolvedProject(
    tree,
    formats[format]?.project,
    options,
    formats[format]?.directory
  );

  if (format === 'derived' && options.callingGenerator) {
    logDeprecationMessage(options, formats);
  }

  return {
    ...formats[format],
    nameAndDirectoryFormat: format,
  };
}

async function determineFormat(
  formats: NameAndDirectoryFormats,
  options: ArtifactGenerationOptions
): Promise<NameAndDirectoryFormat> {
  if (!formats.derived) {
    return 'as-provided';
  }

  const asProvidedDescription = `As provided: ${formats['as-provided'].filePath}`;
  const asProvidedSelectedValue = formats['as-provided'].filePath;
  const derivedDescription = `Derived:     ${formats['derived'].filePath}`;
  const derivedSelectedValue = formats['derived'].filePath;

  if (asProvidedSelectedValue === derivedSelectedValue) {
    return 'as-provided';
  }

  const result = await prompt<{ format: NameAndDirectoryFormat }>({
    type: 'select',
    name: 'format',
    message: `Where should the ${options.artifactType} be generated?`,
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
  options: ArtifactGenerationOptions,
  formats: NameAndDirectoryFormats
) {
  logger.warn(`
In Nx 19, generating a ${options.artifactType} will no longer support providing a project and deriving the directory.
Please provide the exact directory in the future.
Example: nx g ${options.callingGenerator} ${formats['derived'].artifactName} --directory ${formats['derived'].directory}
NOTE: The example above assumes the command is being run from the workspace root. If the command is being run from a subdirectory, the directory option should be adjusted accordingly.
`);
}

function getNameAndDirectoryOptionFormats(
  tree: Tree,
  options: ArtifactGenerationOptions
): NameAndDirectoryFormats {
  const directory = options.directory
    ? normalizePath(options.directory.replace(/^\.?\//, ''))
    : undefined;
  const fileExtension = options.fileExtension ?? 'ts';
  const { name: extractedName, directory: extractedDirectory } =
    extractNameAndDirectoryFromName(options.name);

  if (extractedDirectory && directory) {
    throw new Error(
      `You can't specify both a directory (${options.directory}) and a name with a directory path (${options.name}). ` +
        `Please specify either a directory or a name with a directory path.`
    );
  }

  const asProvidedOptions = getAsProvidedOptions(tree, {
    ...options,
    directory: directory ?? extractedDirectory,
    fileExtension,
    name: extractedName,
  });

  if (!options.project) {
    validateResolvedProject(
      tree,
      asProvidedOptions.project,
      options,
      asProvidedOptions.directory
    );
  }

  if (options.nameAndDirectoryFormat === 'as-provided') {
    return {
      'as-provided': asProvidedOptions,
      derived: undefined,
    };
  }

  if (options.disallowPathInNameForDerived && options.name.includes('/')) {
    if (!options.nameAndDirectoryFormat) {
      output.warn({
        title: `The provided name "${options.name}" contains a path and this is not supported by the "${options.callingGenerator}" when using the "derived" format.`,
        bodyLines: [
          `The generator will try to generate the ${options.artifactType} using the "as-provided" format at "${asProvidedOptions.filePath}".`,
        ],
      });

      return {
        'as-provided': asProvidedOptions,
        derived: undefined,
      };
    }

    throw new Error(
      `The provided name "${options.name}" contains a path and this is not supported by the "${options.callingGenerator}" when using the "derived" format. ` +
        `Please provide a name without a path or use the "as-provided" format.`
    );
  }

  const derivedOptions = getDerivedOptions(
    tree,
    {
      ...options,
      directory,
      fileExtension,
      name: extractedName,
    },
    asProvidedOptions,
    !options.disallowPathInNameForDerived && extractedDirectory
      ? extractedDirectory
      : undefined
  );

  return {
    'as-provided': asProvidedOptions,
    derived: derivedOptions,
  };
}

function getAsProvidedOptions(
  tree: Tree,
  options: ArtifactGenerationOptions
): NameAndDirectoryOptions {
  const relativeCwd = getRelativeCwd();

  const asProvidedDirectory = options.directory
    ? joinPathFragments(relativeCwd, options.directory)
    : relativeCwd;
  const asProvidedProject = findProjectFromPath(tree, asProvidedDirectory);

  const asProvidedFileName =
    options.fileName ??
    (options.suffix ? `${options.name}.${options.suffix}` : options.name);
  const asProvidedFilePath = joinPathFragments(
    asProvidedDirectory,
    `${asProvidedFileName}.${options.fileExtension}`
  );

  return {
    artifactName: options.name,
    directory: asProvidedDirectory,
    fileName: asProvidedFileName,
    filePath: asProvidedFilePath,
    project: asProvidedProject,
  };
}

function getDerivedOptions(
  tree: Tree,
  options: ArtifactGenerationOptions,
  asProvidedOptions: NameAndDirectoryOptions,
  extractedDirectory: string | undefined
): NameAndDirectoryOptions | undefined {
  const projects = getProjects(tree);
  if (options.project && !projects.has(options.project)) {
    throw new Error(
      `The provided project "${options.project}" does not exist! Please provide an existing project name.`
    );
  }

  const projectName = options.project ?? asProvidedOptions.project;
  const project = projects.get(projectName);
  const derivedName = options.name;
  const baseDirectory = options.directory
    ? names(options.directory).fileName
    : joinPathFragments(
        project.sourceRoot ?? joinPathFragments(project.root, 'src'),
        project.projectType === 'application' ? 'app' : 'lib',
        extractedDirectory ?? ''
      );
  const derivedDirectory =
    typeof options.derivedDirectory === 'string'
      ? joinPathFragments(
          project.sourceRoot ?? project.root,
          options.derivedDirectory,
          options.flat
            ? ''
            : options.pascalCaseDirectory
            ? names(derivedName).className
            : names(derivedName).fileName
        )
      : options.flat
      ? normalizePath(baseDirectory)
      : joinPathFragments(
          baseDirectory,
          options.pascalCaseDirectory
            ? names(derivedName).className
            : names(derivedName).fileName
        );

  if (
    options.directory &&
    !isDirectoryUnderProjectRoot(derivedDirectory, project.root)
  ) {
    if (!options.nameAndDirectoryFormat) {
      output.warn({
        title: `The provided directory "${options.directory}" is not under the provided project root "${project.root}".`,
        bodyLines: [
          `The generator will try to generate the ${options.artifactType} using the "as-provided" format.`,
          `With the "as-provided" format, the "project" option is ignored and the ${options.artifactType} will be generated at "${asProvidedOptions.filePath}" (<cwd>/<provided directory>).`,
        ],
      });

      return undefined;
    }

    throw new Error(
      `The provided directory "${options.directory}" is not under the provided project root "${project.root}". ` +
        `Please provide a directory that is under the provided project root or use the "as-provided" format and only provide the directory.`
    );
  }

  let derivedFileName = options.fileName;
  if (!derivedFileName) {
    derivedFileName = options.suffix
      ? `${derivedName}.${options.suffix}`
      : derivedName;
    derivedFileName = options.pascalCaseFile
      ? names(derivedFileName).className
      : names(derivedFileName).fileName;
  }
  const derivedFilePath = joinPathFragments(
    derivedDirectory,
    `${derivedFileName}.${options.fileExtension}`
  );

  return {
    artifactName: derivedName,
    directory: derivedDirectory,
    fileName: derivedFileName,
    filePath: derivedFilePath,
    project: projectName,
  };
}

function validateResolvedProject(
  tree: Tree,
  project: string | undefined,
  options: ArtifactGenerationOptions,
  normalizedDirectory: string
): void {
  if (project) {
    return;
  }

  if (options.directory) {
    throw new Error(
      `The provided directory resolved relative to the current working directory "${normalizedDirectory}" does not exist under any project root. ` +
        `Please make sure to navigate to a location or provide a directory that exists under a project root.`
    );
  }

  throw new Error(
    `The current working directory "${
      getRelativeCwd() || '.'
    }" does not exist under any project root. ` +
      `Please make sure to navigate to a location or provide a directory that exists under a project root.`
  );
}

function findProjectFromPath(tree: Tree, path: string): string | null {
  const projectConfigurations: Record<string, ProjectConfiguration> = {};
  const projects = getProjects(tree);
  for (const [projectName, project] of projects) {
    projectConfigurations[projectName] = project;
  }
  const projectRootMappings =
    createProjectRootMappingsFromProjectConfigurations(projectConfigurations);

  return findProjectForPath(path, projectRootMappings);
}

function isDirectoryUnderProjectRoot(
  directory: string,
  projectRoot: string
): boolean {
  const normalizedDirectory = joinPathFragments(workspaceRoot, directory);
  const normalizedProjectRoot = joinPathFragments(
    workspaceRoot,
    projectRoot
  ).replace(/\/$/, '');

  return (
    normalizedDirectory === normalizedProjectRoot ||
    normalizedDirectory.startsWith(`${normalizedProjectRoot}/`)
  );
}

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}

export function getRelativeCwd(): string {
  return normalizePath(relative(workspaceRoot, getCwd()));
}

/**
 * Function for setting cwd during testing
 */
export function setCwd(path: string): void {
  process.env.INIT_CWD = join(workspaceRoot, path);
}

function getCwd(): string {
  return process.env.INIT_CWD?.startsWith(workspaceRoot)
    ? process.env.INIT_CWD
    : process.cwd();
}

function extractNameAndDirectoryFromName(rawName: string): {
  name: string;
  directory: string | undefined;
} {
  const parsedName = normalizePath(rawName).split('/');
  const name = parsedName.pop();
  const directory = parsedName.length ? parsedName.join('/') : undefined;

  return { name, directory };
}
