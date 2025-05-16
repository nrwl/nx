import type { Tree } from '@nx/devkit';
import { names } from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { validateClassName } from '../../utils/validations';
import type { NormalizedSchema, Schema } from '../schema';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  options.typeSeparator ??= angularMajorVersion < 20 ? '.' : '-';

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
