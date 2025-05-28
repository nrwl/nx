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

const DEFAULT_ALLOWED_JS_FILE_EXTENSIONS = ['js', 'cjs', 'mjs', 'jsx'];
const DEFAULT_ALLOWED_TS_FILE_EXTENSIONS = ['ts', 'cts', 'mts', 'tsx'];
const DEFAULT_ALLOWED_FILE_EXTENSIONS = [
  ...DEFAULT_ALLOWED_JS_FILE_EXTENSIONS,
  ...DEFAULT_ALLOWED_TS_FILE_EXTENSIONS,
  'vue',
];

export type ArtifactGenerationOptions = {
  path: string;
  name?: string;
  fileExtension?: string;
  suffix?: string;
  suffixSeparator?: string;
  allowedFileExtensions?: string[];
  /**
   * @deprecated Provide the full file path including the file extension in the `path` option. This option will be removed in Nx v21.
   */
  js?: boolean;
  /**
   * @deprecated Provide the full file path including the file extension in the `path` option. This option will be removed in Nx v21.
   */
  jsOptionName?: string;
};

export type FileExtensionType = 'js' | 'ts' | 'other';
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
   * Normalized file extension.
   */
  fileExtension: string;
  /**
   * Normalized file extension type.
   */
  fileExtensionType: FileExtensionType;
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
): NameAndDirectoryOptions {
  const path = options.path
    ? normalizePath(options.path.replace(/^\.?\//, ''))
    : undefined;
  let { name: extractedName, directory } =
    extractNameAndDirectoryFromPath(path);
  const relativeCwd = getRelativeCwd();

  // append the directory to the current working directory if it doesn't start with it
  if (directory !== relativeCwd && !directory.startsWith(`${relativeCwd}/`)) {
    directory = joinPathFragments(relativeCwd, directory);
  }

  const project = findProjectFromPath(tree, directory);

  let fileName = extractedName;
  let fileExtension: string = options.fileExtension ?? 'ts';

  const allowedFileExtensions =
    options.allowedFileExtensions ?? DEFAULT_ALLOWED_FILE_EXTENSIONS;
  const fileExtensionRegex = new RegExp(
    `\\.(${allowedFileExtensions.join('|')})$`
  );
  const fileExtensionMatch = fileName.match(fileExtensionRegex);

  if (fileExtensionMatch) {
    fileExtension = fileExtensionMatch[1];
    fileName = fileName.replace(fileExtensionRegex, '');
    extractedName = fileName;
  } else if (options.suffix) {
    fileName = `${fileName}${options.suffixSeparator ?? '.'}${options.suffix}`;
  }

  const filePath = joinPathFragments(directory, `${fileName}.${fileExtension}`);
  const fileExtensionType = getFileExtensionType(fileExtension);

  validateFileExtension(
    fileExtension,
    allowedFileExtensions,
    options.js,
    options.jsOptionName
  );

  return {
    artifactName: options.name ?? extractedName,
    directory,
    fileName,
    fileExtension,
    fileExtensionType,
    filePath,
    project,
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

function getFileExtensionType(fileExtension: string): FileExtensionType {
  if (DEFAULT_ALLOWED_JS_FILE_EXTENSIONS.includes(fileExtension)) {
    return 'js';
  }

  if (DEFAULT_ALLOWED_TS_FILE_EXTENSIONS.includes(fileExtension)) {
    return 'ts';
  }

  return 'other';
}

function validateFileExtension(
  fileExtension: string,
  allowedFileExtensions: string[],
  js: boolean | undefined,
  jsOptionName: string | undefined
): FileExtensionType {
  const fileExtensionType = getFileExtensionType(fileExtension);

  if (!allowedFileExtensions.includes(fileExtension)) {
    throw new Error(
      `The provided file path has an extension (.${fileExtension}) that is not supported by this generator.
The supported extensions are: ${allowedFileExtensions
        .map((ext) => `.${ext}`)
        .join(', ')}.`
    );
  }

  if (js !== undefined) {
    jsOptionName = jsOptionName ?? 'js';

    if (js && fileExtensionType === 'ts') {
      throw new Error(
        `The provided file path has an extension (.${fileExtension}) that conflicts with the provided "--${jsOptionName}" option.`
      );
    }
    if (!js && fileExtensionType === 'js') {
      throw new Error(
        `The provided file path has an extension (.${fileExtension}) that conflicts with the provided "--${jsOptionName}" option.`
      );
    }
  }

  return fileExtensionType;
}
