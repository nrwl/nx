import { MavenAnalysisData, MavenProject } from './types';
import { buildTargetsForProject } from './target-builder';

/**
 * Process Maven analysis data and convert to Nx createNodesV2 format
 */
export async function processMavenData(mavenData: MavenAnalysisData) {
  // Convert to Nx createNodesV2 format
  const createNodesResults: any[] = [];
  
  if (mavenData.projects && Array.isArray(mavenData.projects)) {
    // Use pre-computed coordinates mapping from analyzer mojo
    const coordinatesToProjectName = new Map(Object.entries(mavenData.coordinatesToProjectName || {}));
    
    // If no pre-computed mapping, create one
    if (coordinatesToProjectName.size === 0) {
      for (const project of mavenData.projects) {
        const { artifactId, groupId } = project;
        if (artifactId && groupId) {
          const coordinates = `${groupId}:${artifactId}`;
          const projectName = `${groupId}.${artifactId}`;
          coordinatesToProjectName.set(coordinates, projectName);
        }
      }
    }
    
    // Create project configurations with dependency relationships
    for (const project of mavenData.projects) {
      const { artifactId, groupId, packaging, root, sourceRoot } = project;
      
      // Skip root project with empty root to avoid conflict with Nx workspace
      if (!artifactId || !root) continue;
      
      const projectType = packaging === 'pom' ? 'library' : 'application';
      
      // Build all targets for this project
      const targets = buildTargetsForProject(project, mavenData, coordinatesToProjectName);

      // Handle root project with empty root path
      // If root is empty, use 'maven-root' to avoid conflict with Nx workspace root
      const normalizedRoot = root || 'maven-root';
      
      const projectConfig = {
        name: `${groupId}.${artifactId}`,
        root: normalizedRoot,
        projectType,
        sourceRoot: sourceRoot,
        targets,
        tags: project.tags || [`maven:${groupId}`, `maven:${packaging}`]
      };
      
      createNodesResults.push([normalizedRoot, { projects: { [normalizedRoot]: projectConfig } }]);
    }
  }

  return {
    createNodesResults,
    createDependencies: []
  };
}