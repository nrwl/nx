import { formatFiles, type Tree, updateJson } from '@nx/devkit';
import { readCompilerOptionsFromTsConfig } from '../../generators/utils/tsconfig-utils';
import { allProjectTargets, allTargetOptions } from '../../utils/targets';
import { getProjectsFilteredByDependencies } from '../utils/projects';

type TsConfig = {
  compilerOptions?: {
    lib?: string[];
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
    updateTypeScriptLib(tree, tsConfig);
  }

  await formatFiles(tree);
}

function updateTypeScriptLib(tree: Tree, tsConfigPath: string): void {
  // Read resolved compiler options (includes extends chain)
  const { lib: resolvedLib } = readCompilerOptionsFromTsConfig(
    tree,
    tsConfigPath
  );

  // Check if already correct
  if (!resolvedLib || !Array.isArray(resolvedLib)) {
    return; // No lib to update
  }

  // Normalize lib entries from TypeScript's full format (e.g., 'lib.es2020.d.ts')
  const normalizedResolvedLib = resolvedLib.map((l) =>
    typeof l === 'string' ? normalizeLibEntry(l) : l
  );

  const esLibs = normalizedResolvedLib.filter(
    (l) => typeof l === 'string' && l.toLowerCase().startsWith('es')
  );

  if (esLibs.length === 0) {
    return; // No ES libs to update
  }

  const esLibToVersion = new Map<string, number>();
  for (const l of esLibs) {
    const version = l.toLowerCase().match(/^es(next|(\d+))$/)?.[1];
    if (version) {
      // Use lowercase key for case-insensitive comparison
      esLibToVersion.set(
        l.toLowerCase(),
        version === 'next' ? Infinity : Number(version)
      );
    }
  }

  if (esLibToVersion.size === 0) {
    return;
  }

  const latestVersion = Math.max(...esLibToVersion.values());

  // Only upgrade if ES version is strictly less than 2022
  if (latestVersion < 2022) {
    updateJson<TsConfig>(tree, tsConfigPath, (json) => {
      json.compilerOptions ??= {};

      const directLib = json.compilerOptions.lib;
      const sourceLib =
        directLib && Array.isArray(directLib)
          ? directLib
          : normalizedResolvedLib;

      // Filter out old ES versions (case-insensitive) and add ES2022
      const otherLibs = sourceLib.filter((l) => {
        if (typeof l === 'string') {
          return !esLibToVersion.has(l.toLowerCase());
        }
        return true;
      });

      json.compilerOptions.lib = [...otherLibs, 'es2022'];
      return json;
    });
  }
}

/**
 * Normalize lib entry from TypeScript's full format (e.g., 'lib.es2020.d.ts')
 * to the shorthand format (e.g., 'es2020')
 */
function normalizeLibEntry(lib: string): string {
  // TypeScript's parseJsonConfigFileContent returns full lib file names like 'lib.es2020.d.ts'
  // We need to extract just 'es2020' from it
  if (lib.startsWith('lib.') && lib.endsWith('.d.ts')) {
    return lib.slice(4, -5); // Remove 'lib.' prefix and '.d.ts' suffix
  }
  return lib;
}
