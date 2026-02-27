import {
  formatFiles,
  joinPathFragments,
  type Tree,
  updateJson,
} from '@nx/devkit';
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

// Common tsconfig file names to account for non-buildable libraries
const KNOWN_TSCONFIG_FILES = [
  'tsconfig.json',
  'tsconfig.lib.json',
  'tsconfig.spec.json',
];

export default async function (tree: Tree) {
  const uniqueTsConfigs = new Set<string>();

  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/core',
  ]);

  for (const graphNode of projects) {
    const projectRoot = graphNode.data.root;

    // Add existing known tsconfig files
    for (const tsconfigName of KNOWN_TSCONFIG_FILES) {
      const tsconfigPath = joinPathFragments(projectRoot, tsconfigName);
      if (tree.exists(tsconfigPath)) {
        uniqueTsConfigs.add(tsconfigPath);
      }
    }

    for (const [, target] of allProjectTargets(graphNode.data)) {
      for (const [, options] of allTargetOptions<{ tsConfig?: string }>(
        target
      )) {
        if (
          typeof options?.tsConfig === 'string' &&
          tree.exists(options.tsConfig) &&
          // Exclude tsconfig.server.json - handled by update-ssr-webpack-config migration
          !options.tsConfig.endsWith('tsconfig.server.json')
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
