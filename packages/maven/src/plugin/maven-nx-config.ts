import {
  ProjectConfiguration,
  ProjectMetadata,
} from 'nx/src/config/workspace-json-project-json';
import { join } from 'path';

export interface MavenPluginGoal {
  pluginKey: string;
  goal: string;
  phase: string | null;
  executionId: string;
  targetName: string;
  targetType: string;
  suggestedDependencies: string[];
}

export interface MavenNxConfig {
  name: string;
  projectType: string;
  implicitDependencies: {
    projects: string[];
    inheritsFrom?: string[];
  };
  relevantPhases: string[];
  pluginGoals: MavenPluginGoal[];
  phaseDependencies: Record<string, string[]>;
  crossProjectDependencies: Record<string, string[]>;
  goalsByPhase: Record<string, string[]>;
  goalDependencies: Record<string, string[]>;
}

export function convertMavenNxConfigToProjectConfiguration(
  relativePath: string,
  nxConfig: MavenNxConfig
): ProjectConfiguration {
  return {
    name: nxConfig.name,
    root: relativePath,
    sourceRoot: join(relativePath, 'src/main/java'),
    projectType: nxConfig.projectType ?? 'library',
    implicitDependencies: (
      nxConfig.implicitDependencies?.projects || []
    ).concat(nxConfig.implicitDependencies?.inheritsFrom || []),
    metadata: {
      technologies: ['maven', 'java'],
      targetGroups: getTargetGruopsFromMavenNxConfig(nxConfig),
    } as ProjectMetadata,
  } as ProjectConfiguration;
}

export function getTargetGruopsFromMavenNxConfig(
  nxConfig: MavenNxConfig
): Record<string, string[]> {
  const targetGroups: Record<string, string[]> = {};
  Object.entries(nxConfig.goalsByPhase).forEach(([phase, goals]) => {
    targetGroups[phase] = goals;
    targetGroups[phase].push(phase);
  });
  return targetGroups;
}
