import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { CreateDependencies, DependencyType } from '@nx/devkit';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { MavenPluginOptions, DEFAULT_OPTIONS, MavenAnalysisData } from './types';

/**
 * Create dependencies between Maven projects by analyzing the Nx project configurations
 * Since all Maven logic is now in Kotlin, we extract dependencies from the generated targets
 */
export const createDependencies: CreateDependencies = (options, context) => {
  const opts: MavenPluginOptions = {...DEFAULT_OPTIONS, ...(options as MavenPluginOptions)};

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