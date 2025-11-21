import { formatFiles, type Tree, updateJson } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { readCompilerOptionsFromTsConfig } from '../../generators/utils/tsconfig-utils';
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

  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/core',
  ]);

  for (const graphNode of projects) {
    for (const [, target] of allProjectTargets(graphNode.data)) {
      for (const [, options] of allTargetOptions<{ tsConfig?: string }>(
        target
      )) {
        if (
          typeof options?.tsConfig === 'string' &&
          tree.exists(options.tsConfig)
        ) {
          uniqueTsConfigs.add(options.tsConfig);
        }
      }
    }
  }

  for (const tsConfig of uniqueTsConfigs) {
    updateModuleAndModuleResolution(tree, tsConfig);
  }

  await formatFiles(tree);
}

function updateModuleAndModuleResolution(
  tree: Tree,
  tsConfigPath: string
): void {
  const ts = ensureTypescript();

  // Read the resolved compiler options from the tsconfig
  const compilerOptions = readCompilerOptionsFromTsConfig(tree, tsConfigPath);

  // Check if both module and moduleResolution are already set correctly
  if (
    compilerOptions.module === ts.ModuleKind.Preserve &&
    compilerOptions.moduleResolution === ts.ModuleResolutionKind.Bundler
  ) {
    return;
  }

  // Ensure both module and moduleResolution are set to the correct values
  updateJson<TsConfig>(tree, tsConfigPath, (json) => {
    json.compilerOptions ??= {};
    json.compilerOptions.module = 'preserve';
    json.compilerOptions.moduleResolution = 'bundler';
    return json;
  });
}
