import { getProjects, logger, names, Tree } from '@nx/devkit';
import {
  determineArtifactNameAndDirectoryOptions,
  type FileExtensionType,
} from '@nx/devkit/internal';
import { Schema } from '../schema';
import { getProjectType } from '@nx/js/internal';

export interface NormalizedSchema extends Schema {
  directory: string;
  projectSourceRoot: string;
  fileName: string;
  fileExtension: string;
  fileExtensionType: FileExtensionType;
  className: string;
  filePath: string;
  projectName: string;
  projectRoot: string;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    fileName,
    fileExtension,
    fileExtensionType,
    filePath,
    directory,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    name: options.name,
    path: options.path,
    allowedFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
    fileExtension: 'tsx',
  });

  const { className } = names(name);
  const project = getProjects(host).get(projectName);
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
    fileExtension,
    fileExtensionType,
    filePath,
    projectSourceRoot,
    projectName,
    projectRoot: root,
  };
}
