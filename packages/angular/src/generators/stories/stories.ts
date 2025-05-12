import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import componentStoryGenerator from '../component-story/component-story';
import type { ComponentInfo } from '../utils/storybook-ast/component-info';
import {
  getComponentsInfo,
  getStandaloneComponentsInfo,
} from '../utils/storybook-ast/component-info';
import { getProjectEntryPoints } from '../utils/storybook-ast/entry-point';
import { getModuleFilePaths } from '../utils/storybook-ast/module-info';
import type { StoriesGeneratorOptions } from './schema';
import picomatch = require('picomatch');
import { nxVersion } from '../../utils/versions';

export async function angularStoriesGenerator(
  tree: Tree,
  options: StoriesGeneratorOptions
) {
  const entryPoints = getProjectEntryPoints(tree, options.name);
  const componentsInfo: ComponentInfo[] = [];
  for (const entryPoint of entryPoints) {
    const moduleFilePaths = getModuleFilePaths(tree, entryPoint);
    componentsInfo.push(
      ...getComponentsInfo(tree, entryPoint, moduleFilePaths, options.name),
      ...getStandaloneComponentsInfo(tree, entryPoint)
    );
  }

  const componentInfos = componentsInfo.filter(
    (f) =>
      !options.ignorePaths?.some((pattern) => {
        const shouldIgnorePath = picomatch(pattern)(
          joinPathFragments(
            f.moduleFolderPath,
            f.path,
            `${f.componentFileName}.ts`
          )
        );
        return shouldIgnorePath;
      })
  );

  for (const info of componentInfos) {
    if (info === undefined) {
      continue;
    }

    await componentStoryGenerator(tree, {
      projectPath: info.moduleFolderPath,
      componentName: info.name,
      componentPath: info.path,
      componentFileName: info.componentFileName,
      interactionTests: options.interactionTests ?? true,
      skipFormat: true,
    });
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default angularStoriesGenerator;
