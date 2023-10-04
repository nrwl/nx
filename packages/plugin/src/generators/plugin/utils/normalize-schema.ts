import { Tree, extractLayoutDirectory, getWorkspaceLayout } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  npmPackageName: string;
  bundler: 'swc' | 'tsc';
  publishable: boolean;
}
export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    projectName,
    projectRoot,
    importPath: npmPackageName,
    projectNameAndRootFormat,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    rootProject: options.rootProject,
    callingGenerator: '@nx/plugin:plugin',
  });
  options.projectNameAndRootFormat = projectNameAndRootFormat;
  options.rootProject = projectRoot === '.';

  let projectDirectory = projectRoot;
  if (options.projectNameAndRootFormat === 'derived') {
    let { layoutDirectory } = extractLayoutDirectory(options.directory);
    if (!layoutDirectory) {
      const { libsDir } = getWorkspaceLayout(host);
      layoutDirectory = libsDir;
    }
    if (projectRoot.startsWith(`${layoutDirectory}/`)) {
      projectDirectory = projectRoot.replace(`${layoutDirectory}/`, '');
    }
  }

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    bundler: options.compiler ?? 'tsc',
    fileName: projectName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    npmPackageName,
    publishable: options.publishable ?? false,
  };
}
