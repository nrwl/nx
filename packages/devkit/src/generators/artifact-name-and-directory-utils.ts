import {
  getProjects,
  joinPathFragments,
  normalizePath,
  workspaceRoot,
  type ProjectConfiguration,
  type Tree,
} from 'nx/src/devkit-exports';
import {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from 'nx/src/devkit-internals';
import { join, relative } from 'path';

// TODO(leo): remove in a follow up
export type NameAndDirectoryFormat = 'as-provided';

export type ArtifactGenerationOptions = {
  name: string;
  directory?: string; // Deprecated in favor of path
  path?: string;
  fileExtension?: 'js' | 'jsx' | 'ts' | 'tsx' | 'vue';
  fileName?: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  suffix?: string;
};

export type ArtifactGenerationOptionsV2 = {
  path: string;
  name?: string;
  fileExtension?: 'js' | 'jsx' | 'ts' | 'tsx' | 'vue';
  fileName?: string;
  suffix?: string;
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

export async function determineArtifactNameAndDirectoryOptionsV2(
  tree: Tree,
  options: ArtifactGenerationOptions
): Promise<
  NameAndDirectoryOptions & {
    // TODO(leo): remove in a follow up
    nameAndDirectoryFormat: 'as-provided';
  }
> {
  const nameAndDirectoryOptions = getNameAndDirectoryOptions(tree, options);

  validateResolvedProject(
    tree,
    nameAndDirectoryOptions.project,
    options,
    nameAndDirectoryOptions.directory
  );

  return {
    ...nameAndDirectoryOptions,
    nameAndDirectoryFormat: 'as-provided',
  };
}

export async function determineArtifactNameAndDirectoryOptions(
  tree: Tree,
  options: ArtifactGenerationOptionsV2
): Promise<NameAndDirectoryOptions> {
  return { ...getNameAndDirectoryOptionsV2(tree, options) };
}

// TODO(nicholas): Rename to `getArtifactNameAndDirectoryOptions` after testing
function getNameAndDirectoryOptionsV2(
  tree: Tree,
  options: ArtifactGenerationOptionsV2
) {
  const path = options.path
    ? normalizePath(options.path.replace(/^\.?\//, ''))
    : undefined;
  const fileExtension = options.fileExtension ?? 'ts';
  const { name: extractedName, directory } =
    extractNameAndDirectoryFromPath(path);

  return getAsProvidedOptions(tree, {
    ...options,
    fileExtension,
    directory: options.name ? path : directory,
    name: options.name ?? extractedName,
  });
}

// TODO(nicholas): Remove after testing
function getNameAndDirectoryOptions(
  tree: Tree,
  options: ArtifactGenerationOptions
): NameAndDirectoryOptions {
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

  return asProvidedOptions;
}

function getAsProvidedOptions(
  tree: Tree,
  options: ArtifactGenerationOptions
): NameAndDirectoryOptions {
  const relativeCwd = getRelativeCwd();

  let asProvidedDirectory: string;
  if (options.directory) {
    // append the directory to the current working directory if it doesn't start with it
    if (
      options.directory === relativeCwd ||
      options.directory.startsWith(`${relativeCwd}/`)
    ) {
      asProvidedDirectory = options.directory;
    } else {
      asProvidedDirectory = joinPathFragments(relativeCwd, options.directory);
    }
  } else {
    asProvidedDirectory = relativeCwd;
  }
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

function extractNameAndDirectoryFromPath(path: string): {
  name: string;
  directory: string;
} {
  const parsedPath = normalizePath(path).split('/');
  const name = parsedPath.pop();
  const directory = parsedPath.join('/');

  return { name, directory };
}
