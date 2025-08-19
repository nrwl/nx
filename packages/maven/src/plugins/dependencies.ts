import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { CreateDependencies, DependencyType } from '@nx/devkit';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { MavenPluginOptions, DEFAULT_OPTIONS, MavenAnalysisData } from './types';

/**
 * Create dependencies between Maven projects based on their Maven dependencies
 */
export const createDependencies: CreateDependencies = (options, context) => {
  const opts: MavenPluginOptions = {...DEFAULT_OPTIONS, ...(options as MavenPluginOptions)};
  const isVerbose = false; // Disable verbose logging

  // Read Maven analysis data - check both possible locations
  const analysisFile = join(workspaceDataDirectory, 'nx-maven-projects.json');
  const fallbackAnalysisFile = join(context.workspaceRoot, 'nx-maven-projects.json');
  
  let actualAnalysisFile = analysisFile;
  if (!existsSync(analysisFile)) {
    if (existsSync(fallbackAnalysisFile)) {
      actualAnalysisFile = fallbackAnalysisFile;
    } else {
      return [];
    }
  }

  let mavenData: MavenAnalysisData;
  try {
    const fileContent = readFileSync(actualAnalysisFile, 'utf-8');
    mavenData = JSON.parse(fileContent);
  } catch (error) {
    return [];
  }

  const dependencies = [];
  
  if (mavenData.projects && Array.isArray(mavenData.projects)) {
    
    // First, create a map of Maven coordinates to project names
    const projectMap = new Map<string, string>();
    for (const project of mavenData.projects) {
      const { artifactId, groupId } = project;
      if (artifactId && groupId) {
        const coordinates = `${groupId}:${artifactId}`;
        const projectName = `${groupId}.${artifactId}`;
        projectMap.set(coordinates, projectName);
      }
    }
    
    // Then create dependencies
    for (const project of mavenData.projects) {
      const { artifactId, groupId, dependencies: projectDeps } = project;
      
      if (!artifactId || !groupId || !projectDeps) continue;
      
      const sourceProjectName = `${groupId}.${artifactId}`;
      
      // Create dependencies for each Maven dependency that exists in the reactor
      if (Array.isArray(projectDeps)) {
        for (const dep of projectDeps) {
          const depCoordinates = `${dep.groupId}:${dep.artifactId}`;
          const targetProjectName = projectMap.get(depCoordinates);
          
          // Only create dependency if target exists in reactor and is different from source
          if (targetProjectName && targetProjectName !== sourceProjectName) {
            dependencies.push({
              source: sourceProjectName,
              target: targetProjectName,
              type: DependencyType.static,
              sourceFile: join(project.root || '', 'pom.xml')
            });
          }
        }
      }
    }
  }
  
  return dependencies;
};