import { logger, names, readProjectConfiguration, Tree } from '@nx/devkit';

import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  assertValidStyle(options.style);

  const {
    artifactName: name,
    directory,
    fileName,
    filePath,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    artifactType: 'component',
    callingGenerator: '@nx/react:component',
    name: options.name,
    directory: options.directory,
    derivedDirectory: options.derivedDirectory ?? options.directory,
    flat: options.flat,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    fileExtension: 'tsx',
    fileName: options.fileName,
    pascalCaseFile: options.pascalCaseFiles,
    pascalCaseDirectory: options.pascalCaseDirectory,
  });

  const project = readProjectConfiguration(tree, projectName);

  const { className } = names(name);

  const { sourceRoot: projectSourceRoot, projectType } = project;

  const styledModule = /^(css|scss|less|none)$/.test(options.style)
    ? null
    : options.style;

  if (options.export && projectType === 'application') {
    logger.warn(
      `The "--export" option should not be used with applications and will do nothing.`
    );
  }

  options.classComponent = options.classComponent ?? false;
  options.routing = options.routing ?? false;
  options.globalCss = options.globalCss ?? false;
  options.inSourceTests = options.inSourceTests ?? false;

  return {
    ...options,
    projectName,
    directory,
    styledModule,
    hasStyles: options.style !== 'none',
    className,
    fileName,
    filePath,
    projectSourceRoot,
  };
}
