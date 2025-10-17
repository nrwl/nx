import { CreateNodesV2, logger } from '@nx/devkit';
import {
  analyzeProjects,
  isAnalysisErrorResult,
} from '../analyzer/analyzer-client';

export interface DotNetPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  cleanTargetName?: string;
  restoreTargetName?: string;
  publishTargetName?: string;
  packTargetName?: string;
}

const dotnetProjectGlob = '**/*.{csproj,fsproj,vbproj}';

export const createNodesV2: CreateNodesV2<DotNetPluginOptions> = [
  dotnetProjectGlob,
  async (configFilePaths, options, context) => {
    // Analyze all projects - the C# analyzer builds the complete Nx structure
    try {
      // Normalize options with defaults
      const normalizedOptions = {
        buildTargetName: options?.buildTargetName ?? 'build',
        testTargetName: options?.testTargetName ?? 'test',
        cleanTargetName: options?.cleanTargetName ?? 'clean',
        restoreTargetName: options?.restoreTargetName ?? 'restore',
        publishTargetName: options?.publishTargetName ?? 'publish',
        packTargetName: options?.packTargetName ?? 'pack',
      };

      const result = await analyzeProjects(
        [...configFilePaths],
        normalizedOptions
      );

      if (isAnalysisErrorResult(result)) {
        throw result.error;
      }
      const { nodesByFile } = result;

      // Return array of [configFile, result] tuples
      return configFilePaths.map((configFile) => {
        const node = nodesByFile[configFile];
        if (!node) {
          return [configFile, {}];
        }

        return [
          configFile,
          {
            projects: {
              [node.root]: node,
            },
          },
        ];
      });
    } catch (err) {
      const error = err as Error;
      logger.error(`Failed to run MSBuild analyzer: ${error.message}`);
      throw error;
    }
  },
];
