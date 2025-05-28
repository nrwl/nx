import type { Tree } from '@nx/devkit';
import { joinPathFragments, names } from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { getModuleTypeSeparator } from '../../utils/artifact-types';
import { validateClassName } from '../../utils/validations';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion < 20) {
    options.type ??= 'directive';
  }

  const {
    artifactName: name,
    directory,
    fileName,
    filePath,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    name: options.name,
    path: options.path,
    suffix: options.type,
    allowedFileExtensions: ['ts'],
    fileExtension: 'ts',
  });

  const { className } = names(name);
  const suffixClassName = options.type ? names(options.type).className : '';
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
