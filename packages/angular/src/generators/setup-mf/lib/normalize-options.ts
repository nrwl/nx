import { names, readProjectConfiguration, type Tree } from '@nx/devkit';
import {
  getAppComponentInfo,
  getNxWelcomeComponentInfo,
} from '../../utils/app-components-info';
import {
  getComponentType,
  getModuleTypeSeparator,
} from '../../utils/artifact-types';
import { getProjectPrefix } from '../../utils/project';
import type { NormalizedOptions, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedOptions {
  const componentType = getComponentType(tree);
  const componentFileSuffix = componentType ? `.${componentType}` : '';
  const moduleTypeSeparator = getModuleTypeSeparator(tree);
  const entryModuleFileName = `entry${moduleTypeSeparator}module`;

  const project = readProjectConfiguration(tree, options.appName);

  return {
    ...options,
    typescriptConfiguration: options.typescriptConfiguration ?? true,
    federationType: options.federationType ?? 'static',
    prefix: options.prefix ?? getProjectPrefix(tree, options.appName) ?? 'app',
    standalone: options.standalone ?? true,
    componentType: componentType ? names(componentType).className : '',
    componentFileSuffix,
    entryModuleFileName,
    appComponentInfo: getAppComponentInfo(tree, componentFileSuffix, project),
    nxWelcomeComponentInfo: getNxWelcomeComponentInfo(
      tree,
      componentFileSuffix,
      project
    ),
  };
}
