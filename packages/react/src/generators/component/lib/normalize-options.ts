import { logger, names, readProjectConfiguration, Tree } from '@nx/devkit';

import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';
import { getProjectType } from '@nx/js/src/utils/typescript/ts-solution-setup';

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
    fileExtension,
    fileExtensionType,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    path: options.path,
    name: options.name,
    allowedFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
    fileExtension: options.js ? 'js' : 'tsx',
    js: options.js,
  });

  const project = readProjectConfiguration(tree, projectName);

  const { className } = names(name);

  const {
    sourceRoot: projectSourceRoot,
    root: projectRoot,
    projectType,
  } = project;

  const styledModule = /^(css|scss|less|none)$/.test(options.style)
    ? null
    : options.style;

  if (
    options.export &&
    getProjectType(tree, projectRoot, projectType) === 'application'
  ) {
    logger.warn(
      `The "--export" option should not be used with applications and will do nothing.`
    );
  }

  options.classComponent = options.classComponent ?? false;
  options.routing = options.routing ?? false;
  options.globalCss = options.globalCss ?? false;
  options.inSourceTests = options.inSourceTests ?? false;

  //TODO (nicholas): Remove when Next page generator is removed
  options.isNextPage = options.isNextPage ?? false;

  return {
    ...options,
    directory,
    projectName,
    styledModule,
    hasStyles: options.style !== 'none',
    className,
    fileName,
    filePath,
    projectRoot,
    projectSourceRoot,
    fileExtension,
    fileExtensionType,
  };
}
