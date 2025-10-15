import { CreateNodesV2, CreateDependencies, logger } from '@nx/devkit';

// Import analyzer-based implementations
import {
  createNodesV2Analyzer,
  DotNetPluginOptions as AnalyzerOptions,
} from './analyzer/create-nodes-analyzer';
import { createDependenciesAnalyzer } from './analyzer/create-dependencies-analyzer';

// Import legacy implementations
import {
  createNodesV2Legacy,
  DotNetPluginOptions as LegacyOptions,
} from './legacy/create-nodes-legacy';
import { createDependenciesLegacy } from './legacy/create-dependencies-legacy';

// Re-export for compatibility
export { parseProjectFile } from './legacy/create-nodes-legacy';

export interface DotNetPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  cleanTargetName?: string;
  restoreTargetName?: string;
  publishTargetName?: string;
  packTargetName?: string;
  /**
   * Use the legacy regex-based parser instead of MSBuild analyzer.
   * @default false
   */
  useLegacyParser?: boolean;
}

const dotnetProjectGlob = '**/*.{csproj,fsproj,vbproj}';

export const createNodesV2: CreateNodesV2<DotNetPluginOptions> = [
  dotnetProjectGlob,
  async (configFilePaths, options, context) => {
    // If user explicitly requests legacy parser, use it
    if (options?.useLegacyParser === true) {
      logger.debug('[dotnet] Using legacy regex-based parser (user requested)');
      const [, legacyFn] = createNodesV2Legacy;
      return legacyFn(configFilePaths, options, context);
    }

    logger.debug('[dotnet] Using MSBuild analyzer');
    const [, analyzerFn] = createNodesV2Analyzer;
    return await analyzerFn(configFilePaths, options, context);
  },
];

/**
 * @deprecated The 'createDependencies' function is now a no-op. Dependency detection
 * should be handled in 'createNodesV2' instead.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};
