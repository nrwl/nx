import type { Tree } from '@nx/devkit';
import { names, readProjectConfiguration } from '@nx/devkit';
import type { AngularProjectConfiguration } from '../../../utils/types';
import { buildSelector } from '../../utils/selector';
import type { NormalizedSchema, Schema } from '../schema';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    directory,
    fileName,
    filePath,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    artifactType: 'directive',
    callingGenerator: '@nx/angular:directive',
    name: options.name,
    directory: options.directory ?? options.path,
    flat: options.flat,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    suffix: 'directive',
  });

  const { className } = names(name);
  const { className: suffixClassName } = names('directive');
  const symbolName = `${className}${suffixClassName}`;

  const { prefix } = readProjectConfiguration(
    tree,
    projectName
  ) as AngularProjectConfiguration;

  const selector =
    options.selector ??
    buildSelector(tree, name, options.prefix, prefix, 'propertyName');

  return {
    ...options,
    projectName,
    name,
    directory,
    fileName,
    filePath,
    symbolName,
    selector,
    standalone: options.standalone ?? true,
  };
}
