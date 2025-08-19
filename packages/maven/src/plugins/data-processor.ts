import { MavenAnalysisData, CreateNodesResult } from './types';

/**
 * Process Maven analysis data - now just passes through pre-computed Nx format from Kotlin analyzer
 */
export async function processMavenData(mavenData: MavenAnalysisData) {
  // The Kotlin analyzer now generates the complete createNodesResults format
  if (mavenData.createNodesResults && Array.isArray(mavenData.createNodesResults)) {
    return {
      createNodesResults: mavenData.createNodesResults as CreateNodesResult[],
      createDependencies: []
    };
  }

  // Fallback: if no pre-computed results, return empty
  console.warn('No pre-computed createNodesResults found from Maven analyzer');
  return {
    createNodesResults: [] as CreateNodesResult[],
    createDependencies: []
  };
}