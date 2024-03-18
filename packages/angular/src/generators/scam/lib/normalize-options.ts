import type { Tree } from '@nx/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { names } from '@nx/devkit';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  options.type ??= 'component';
  const {
    artifactName: name,
    directory,
    fileName,
    filePath,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    artifactType: options.type,
    callingGenerator: '@nx/angular:scam',
    name: options.name,
    directory: options.directory ?? options.path,
    flat: options.flat,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    suffix: options.type ?? 'component',
  });

  const { className } = names(name);
  const { className: suffixClassName } = names(options.type);
  const symbolName = `${className}${suffixClassName}`;

  return {
    ...options,
    export: options.export ?? true,
    inlineScam: options.inlineScam ?? true,
    directory,
    fileName,
    filePath,
    name,
    symbolName,
    projectName,
  };
}
