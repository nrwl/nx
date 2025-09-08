import { ProjectConfiguration, TargetConfiguration } from '@nx/devkit';
import { addTestCiTargets, shouldEnableTestAtomization } from './test-atomization';
import { MavenPluginOptions, MavenAnalysisData, CreateNodesResult } from '../plugins/types';

interface TestClass {
  className: string;
  packagePath: string;
  filePath: string;
  packageName?: string;
}

interface MavenProjectAnalysis {
  projectName: string;
  testClasses: TestClass[];
  hasTests: boolean;
  [key: string]: any;
}

/**
 * Post-process Maven analysis data to add test atomization
 */
export function addTestAtomization(
  mavenData: MavenAnalysisData,
  options: MavenPluginOptions
): MavenAnalysisData {
  if (!options.atomizeTests) {
    return mavenData;
  }

  const processedResults: CreateNodesResult[] = [];

  for (const [rootPath, projectsWrapper] of mavenData.createNodesResults) {
    const processedProjects: Record<string, ProjectConfiguration> = {};

    for (const [projectPath, projectConfig] of Object.entries(projectsWrapper.projects)) {
      // Copy the original project configuration
      const newProjectConfig: ProjectConfiguration = {
        ...projectConfig,
        targets: { ...projectConfig.targets }
      };

      // Check if we have project metadata with test classes
      const projectMetadata = (projectConfig as any).metadata?.mavenAnalysis;
      if (projectMetadata && shouldEnableAtomization(projectMetadata, options)) {
        // Preserve existing target groups from Maven analysis
        const existingTargetGroups = (projectConfig as any).metadata?.targetGroups || {};
        const targetGroups: Record<string, string[]> = { ...existingTargetGroups };
        
        addTestCiTargets(
          projectMetadata,
          newProjectConfig.targets || {},
          targetGroups,
          projectConfig.root || projectPath,
          'test-ci'
        );

        // Merge target groups with existing metadata
        newProjectConfig.metadata = {
          ...newProjectConfig.metadata,
          targetGroups
        };
      }

      processedProjects[projectPath] = newProjectConfig;
    }

    processedResults.push([rootPath, { projects: processedProjects }]);
  }

  return {
    ...mavenData,
    createNodesResults: processedResults
  };
}

/**
 * Check if test atomization should be enabled for a project
 */
function shouldEnableAtomization(
  projectMetadata: MavenProjectAnalysis,
  options: MavenPluginOptions
): boolean {
  return shouldEnableTestAtomization(projectMetadata, {
    enabled: options.atomizeTests,
    minTestClasses: options.minTestClassesForAtomization || 1
  });
}