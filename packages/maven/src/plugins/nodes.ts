import {
  CreateNodesResultV2,
  CreateNodesV2,
} from '@nx/devkit';
import { MavenPluginOptions, DEFAULT_OPTIONS } from './types';
import { runMavenAnalysis } from './maven-analyzer';
import { getCachedMavenData } from './maven-data-cache';

/**
 * Maven plugin that analyzes Maven projects and returns configurations
 */
export const createNodesV2: CreateNodesV2 = [
  '**/pom.xml',
  async (configFiles, options, context): Promise<CreateNodesResultV2> => {
    const opts: MavenPluginOptions = {...DEFAULT_OPTIONS, ...(options as MavenPluginOptions)};
    
    // Check for verbose logging from multiple sources  
    const isVerbose = opts.verbose || 
                     process.env.NX_VERBOSE_LOGGING === 'true';

    if (isVerbose) {
      console.error(`Maven plugin running in verbose mode (NX_VERBOSE_LOGGING=${process.env.NX_VERBOSE_LOGGING})`);
    }

    // Only process if we have the root pom.xml in the workspace root
    const rootPomExists = configFiles.some(file => file === 'pom.xml');
    if (!rootPomExists) {
      return [];
    }

    try {
      // Try to get cached data first (skip cache if in verbose mode)
      let mavenData = getCachedMavenData(context.workspaceRoot, isVerbose);
      
      // If no cached data or cache is stale, run fresh Maven analysis
      if (!mavenData) {
        mavenData = await runMavenAnalysis({...opts, verbose: isVerbose});
      }
      
      // Return Kotlin analyzer's pre-computed createNodesResults directly
      return mavenData.createNodesResults || [];
    } catch (error) {
      console.warn('Maven analysis failed:', error instanceof Error ? error.message : error);
      return [];
    }
  },
];