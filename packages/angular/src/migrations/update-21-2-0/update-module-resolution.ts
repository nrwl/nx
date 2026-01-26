import {
  formatFiles,
  joinPathFragments,
  readJson,
  type Tree,
  updateJson,
} from '@nx/devkit';
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
          tree.exists(options.tsConfig)
        ) {
          uniqueTsConfigs.add(options.tsConfig);
        }
      }
    }
  }

  for (const tsConfig of uniqueTsConfigs) {
    updateModuleResolution(tree, tsConfig);
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
