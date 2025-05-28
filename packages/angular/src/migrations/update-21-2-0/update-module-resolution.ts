import { formatFiles, readJson, type Tree, updateJson } from '@nx/devkit';
import { allProjectTargets, allTargetOptions } from '../../utils/targets';
import { getProjectsFilteredByDependencies } from '../utils/projects';

type TsConfig = {
  compilerOptions?: {
    module?: string;
    moduleResolution?: string;
  };
};

export default async function (tree: Tree) {
  const uniqueTsConfigs = new Set<string>();

  const projects = await getProjectsFilteredByDependencies(tree, [
    'npm:@angular/core',
  ]);

  for (const { project } of projects) {
    for (const [, target] of allProjectTargets(project)) {
      for (const [, options] of allTargetOptions<{ tsConfig?: string }>(
        target
      )) {
        if (typeof options?.tsConfig === 'string') {
          uniqueTsConfigs.add(options.tsConfig);
        }
      }
    }
  }

  for (const tsConfig of uniqueTsConfigs) {
    if (tree.exists(tsConfig)) {
      updateModuleResolution(tree, tsConfig);
    }
  }

  await formatFiles(tree);
}

function updateModuleResolution(tree: Tree, tsConfigPath: string): void {
  const tsConfig = readJson<TsConfig>(tree, tsConfigPath);

  if (!tsConfig.compilerOptions) {
    return;
  }

  const { compilerOptions } = tsConfig;

  // Only update if module is not 'preserve' and moduleResolution is not already 'bundler'
  if (
    compilerOptions.module === 'preserve' ||
    compilerOptions.moduleResolution === 'bundler'
  ) {
    return;
  }

  // Update moduleResolution to 'bundler'
  updateJson<TsConfig>(tree, tsConfigPath, (json) => {
    json.compilerOptions ??= {};
    json.compilerOptions.moduleResolution = 'bundler';
    return json;
  });
}
