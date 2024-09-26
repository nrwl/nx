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

export type ArtifactGenerationOptions = {
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

export async function determineArtifactNameAndDirectoryOptions(
  tree: Tree,
  options: ArtifactGenerationOptions
): Promise<NameAndDirectoryOptions> {
  const normalizedOptions = getNameAndDirectoryOptions(tree, options);

  validateResolvedProject(
    normalizedOptions.project,
    normalizedOptions.directory
  );

  return normalizedOptions;
}

function getNameAndDirectoryOptions(
  tree: Tree,
  options: ArtifactGenerationOptions
) {
  const path = options.path
    ? normalizePath(options.path.replace(/^\.?\//, ''))
    : undefined;
  const fileExtension = options.fileExtension ?? 'ts';
  let { name: extractedName, directory } =
    extractNameAndDirectoryFromPath(path);
  const relativeCwd = getRelativeCwd();

  // append the directory to the current working directory if it doesn't start with it
  if (directory !== relativeCwd && !directory.startsWith(`${relativeCwd}/`)) {
    directory = joinPathFragments(relativeCwd, directory);
  }

  const project = findProjectFromPath(tree, directory);
  const name =
    options.fileName ??
    (options.suffix ? `${extractedName}.${options.suffix}` : extractedName);
  const filePath = joinPathFragments(directory, `${name}.${fileExtension}`);

  return {
    artifactName: options.name ?? extractedName,
    directory: directory,
    fileName: name,
    filePath: filePath,
    project: project,
  };
}

function validateResolvedProject(
  project: string | undefined,
  normalizedDirectory: string
): void {
  if (project) {
    return;
  }

  throw new Error(
    `The provided directory resolved relative to the current working directory "${normalizedDirectory}" does not exist under any project root. ` +
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

function extractNameAndDirectoryFromPath(path: string): {
  name: string;
  directory: string;
} {
  // Remove trailing slash
  path = path.replace(/\/$/, '');

  const parsedPath = normalizePath(path).split('/');
  const name = parsedPath.pop();
  const directory = parsedPath.join('/');

  return { name, directory };
}
