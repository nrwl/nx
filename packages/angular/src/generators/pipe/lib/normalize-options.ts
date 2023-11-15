import type { Tree } from '@nx/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { names } from '@nx/devkit';

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
    artifactType: 'pipe',
    callingGenerator: '@nx/angular:pipe',
    name: options.name,
    directory: options.directory ?? options.path,
    flat: options.flat,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    suffix: 'pipe',
  });

  const { className } = names(name);
  const { className: suffixClassName } = names('pipe');
  const symbolName = `${className}${suffixClassName}`;

  return {
    ...options,
    projectName,
    name,
    directory,
    fileName,
    filePath,
    symbolName,
    standalone: options.standalone ?? true,
  };
}
