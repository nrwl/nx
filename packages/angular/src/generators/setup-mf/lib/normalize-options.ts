import { names, readProjectConfiguration, type Tree } from '@nx/devkit';
import { getComponentType } from '../../utils/artifact-types';
import { getProjectPrefix } from '../../utils/project';
import type { NormalizedOptions, Schema } from '../schema';
import {
  getAppComponentInfo,
  getNxWelcomeComponentInfo,
} from '../../utils/app-components-info';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedOptions {
  const componentType = getComponentType(tree);
  const componentFileSuffix = componentType ? `.${componentType}` : '';

  const project = readProjectConfiguration(tree, options.appName);

  return {
    ...options,
    typescriptConfiguration: options.typescriptConfiguration ?? true,
    federationType: options.federationType ?? 'static',
    prefix: options.prefix ?? getProjectPrefix(tree, options.appName) ?? 'app',
    standalone: options.standalone ?? true,
    componentType: componentType ? names(componentType).className : '',
    componentFileSuffix,
    appComponentInfo: getAppComponentInfo(tree, componentFileSuffix, project),
    nxWelcomeComponentInfo: getNxWelcomeComponentInfo(
      tree,
      componentFileSuffix,
      project
    ),
  };
}
