import { join } from 'path';
import { CreateDependencies, DependencyType } from '@nx/devkit';
import { MavenPluginOptions, DEFAULT_OPTIONS } from './types';
import { getCachedMavenData } from './maven-data-cache';

/**
 * Create dependencies between Maven projects by analyzing the Nx project configurations
 * Since all Maven logic is now in Kotlin, we extract dependencies from the generated targets
 */
export const createDependencies: CreateDependencies = (options, context) => {
  const opts: MavenPluginOptions = {...DEFAULT_OPTIONS, ...(options as MavenPluginOptions)};

  // Get cached Maven analysis data
  const mavenData = getCachedMavenData(context.workspaceRoot);
  if (!mavenData) {
    return [];
  }

  const dependencies = [];
  
  // Extract dependencies from the createNodesResults
  for (const [projectRoot, projectsWrapper] of mavenData.createNodesResults) {
    const projectConfig = projectsWrapper.projects[projectRoot];
    if (!projectConfig) continue;

    // Look at the compile target's dependsOn to find Maven dependencies
    const compileTarget = projectConfig.targets?.compile;
    if (compileTarget && compileTarget.dependsOn) {
      for (const dep of compileTarget.dependsOn) {
        // Handle both string and TargetDependencyConfig formats
        let targetProjectName: string | undefined;
        
        if (typeof dep === 'string') {
          // Dependencies are in format "projectName:phase"
          [targetProjectName] = dep.split(':');
        } else if (dep.target) {
          // TargetDependencyConfig format
          targetProjectName = dep.target;
        }
        
        if (targetProjectName && targetProjectName !== projectConfig.name) {
          dependencies.push({
            source: projectConfig.name!,
            target: targetProjectName,
            type: DependencyType.static,
            sourceFile: join(projectRoot, 'pom.xml')
          });
        }
      }
    }
  }
  
  return dependencies;
};