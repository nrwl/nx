import { getProjects, logger, names, Tree } from '@nx/devkit';
import {
  determineArtifactNameAndDirectoryOptions,
  type FileExtensionType,
} from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { Schema } from '../schema';
import { getProjectType } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface NormalizedSchema extends Omit<Schema, 'js'> {
  directory: string;
  projectSourceRoot: string;
  fileName: string;
  className: string;
  filePath: string;
  fileExtension: string;
  fileExtensionType: FileExtensionType;
  projectName: string;
  projectRoot: string;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    directory,
    fileName,
    filePath,
    fileExtension,
    fileExtensionType,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    path: options.path,
    name: options.name,
    allowedFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
    fileExtension: options.js ? 'js' : 'tsx',
    js: options.js,
  });

  const project = getProjects(host).get(projectName);

  const { className } = names(name);

  const { root, sourceRoot: projectSourceRoot, projectType } = project;

  if (
    options.export &&
    getProjectType(host, root, projectType) === 'application'
  ) {
    logger.warn(
      `The "--export" option should not be used with applications and will do nothing.`
    );
  }

  options.classComponent = options.classComponent ?? false;

  return {
    ...options,
    name,
    directory,
    className,
    fileName,
    filePath,
    fileExtension,
    fileExtensionType,
    projectSourceRoot,
    projectName,
    projectRoot: root,
  };
}
