import { join } from 'path';
import { CreateDependencies, DependencyType } from '@nx/devkit';

/**
 * Create dependencies between Maven projects by analyzing the Nx project configurations
 * Uses the projects already loaded in the context instead of reading files
 */
export const createDependencies: CreateDependencies = (_options, context) => {
  const dependencies = [];
  
  // Use projects from context instead of reading the Maven data file
  const projects = context.projects || {};
  
  for (const [, projectConfig] of Object.entries(projects)) {
    // Only process Maven projects (those with maven tags)
    if (!projectConfig.tags?.some(tag => tag.startsWith('maven:'))) {
      continue;
    }

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
            sourceFile: join(projectConfig.root!, 'pom.xml')
          });
        }
      }
    }
  }
  
  return dependencies;
};