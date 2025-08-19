import { MavenAnalysisData } from './types';

/**
 * Process Maven analysis data - pure passthrough from Kotlin analyzer
 */
export async function processMavenData(mavenData: MavenAnalysisData) {
  // The Kotlin analyzer generates the complete createNodesResults format
  return {
    createNodesResults: mavenData.createNodesResults,
    createDependencies: []
  };
}