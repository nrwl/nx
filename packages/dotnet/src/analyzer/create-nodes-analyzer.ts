import { CreateNodesV2, logger } from '@nx/devkit';
import { analyzeProjects } from './analyzer-client';

export interface DotNetPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  cleanTargetName?: string;
  restoreTargetName?: string;
  publishTargetName?: string;
  packTargetName?: string;
}

const dotnetProjectGlob = '**/*.{csproj,fsproj,vbproj}';

export const createNodesV2Analyzer: CreateNodesV2<DotNetPluginOptions> = [
  dotnetProjectGlob,
  async (configFilePaths) => {
    // Analyze all projects - the C# analyzer builds the complete Nx structure
    try {
      const { nodesByFile } = await analyzeProjects([...configFilePaths]);

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
