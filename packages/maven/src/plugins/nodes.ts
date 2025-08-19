import {
  CreateNodesResultV2,
  CreateNodesV2,
} from '@nx/devkit';
import { MavenPluginOptions, DEFAULT_OPTIONS } from './types';
import { runMavenAnalysis } from './maven-analyzer';

/**
 * Maven plugin that analyzes Maven projects and returns configurations
 */
export const createNodesV2: CreateNodesV2 = [
  '**/pom.xml',
  async (configFiles, options, context): Promise<CreateNodesResultV2> => {
    const opts: MavenPluginOptions = {...DEFAULT_OPTIONS, ...(options as MavenPluginOptions)};
    
    // Check for verbose logging from multiple sources  
    const isVerbose = false; // Disable all verbose logging for cleaner output

    // Only process if we have the root pom.xml in the workspace root
    const rootPomExists = configFiles.some(file => file === 'pom.xml');
    if (!rootPomExists) {
      return [];
    }

    try {
      // Run fresh Maven analysis
      const mavenData = await runMavenAnalysis({...opts, verbose: isVerbose});
      
      // Return Kotlin analyzer's pre-computed createNodesResults directly
      return mavenData.createNodesResults || [];
    } catch (error) {
      console.warn('Maven analysis failed:', error instanceof Error ? error.message : error);
      return [];
    }
  },
];