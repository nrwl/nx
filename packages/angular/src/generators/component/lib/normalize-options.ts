import type { Tree } from '@nx/devkit';
import { names, readProjectConfiguration } from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import type { AngularProjectConfiguration } from '../../../utils/types';
import { buildSelector, validateHtmlSelector } from '../../utils/selector';
import type { NormalizedSchema, Schema } from '../schema';

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
    name: options.name,
    path: options.path,
    suffix: options.type ?? 'component',
  });

  const { className } = names(name);
  const { className: suffixClassName } = names(options.type);
  const symbolName = `${className}${suffixClassName}`;

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
