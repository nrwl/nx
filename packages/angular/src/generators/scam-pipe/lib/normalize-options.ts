import type { Tree } from '@nx/devkit';
import { joinPathFragments, names } from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/internal';
import { getModuleTypeSeparator } from '../../utils/artifact-types';
import { validateClassName } from '../../utils/validations';
import type { NormalizedSchema, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  options.typeSeparator ??= '-';

  const {
    artifactName: name,
    directory,
    fileName,
    filePath,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    name: options.name,
    path: options.path,
    suffix: 'pipe',
    suffixSeparator: options.typeSeparator,
    allowedFileExtensions: ['ts'],
    fileExtension: 'ts',
  });

  const { className } = names(name);
  const { className: suffixClassName } = names('pipe');
  const symbolName = `${className}${suffixClassName}`;
  validateClassName(symbolName);

  const moduleTypeSeparator = getModuleTypeSeparator(tree);
  const modulePath = joinPathFragments(
    directory,
    `${name}${moduleTypeSeparator}module.ts`
  );

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
    modulePath,
  };
}
