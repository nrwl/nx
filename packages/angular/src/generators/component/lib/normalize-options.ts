import type { Tree } from '@nx/devkit';
import { names, readProjectConfiguration } from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import type { AngularProjectConfiguration } from '../../../utils/types';
import { buildSelector, validateHtmlSelector } from '../../utils/selector';
import { validateClassName } from '../../utils/validations';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion < 20) {
    options.type ??= 'component';
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
  if (name.includes('/')) {
    throw new Error(
      `The component name '${name}' cannot contain a slash as it must be a valid JS symbol. Please use a different name.`
    );
  }

  const { className } = names(name);
  const suffixClassName = options.type ? names(options.type).className : '';
  const symbolName = `${className}${suffixClassName}`;
  validateClassName(symbolName);

  const { prefix, root, sourceRoot } = readProjectConfiguration(
    tree,
    projectName
  ) as AngularProjectConfiguration;

  const selector =
    options.selector ?? buildSelector(name, options.prefix, prefix, 'fileName');
  validateHtmlSelector(selector);

  return {
    ...options,
    name,
    projectName,
    changeDetection: options.changeDetection ?? 'Default',
    style: options.style ?? 'css',
    standalone: options.standalone ?? true,
    directory,
    fileName,
    filePath,
    symbolName,
    projectSourceRoot: sourceRoot,
    projectRoot: root,
    selector,
  };
}
