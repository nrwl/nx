import { TargetConfiguration } from '@nx/devkit';
import { MavenProject, MavenAnalysisData } from './types';
import { getBestDependencyPhase } from './utils';

/**
 * Create dependsOn relationships for a given Maven phase using pre-computed relationships
 */
export function createDependsOnForPhase(
  project: MavenProject,
  phaseName: string,
  mavenData: MavenAnalysisData,
  coordinatesToProjectName: Map<string, string>
): string[] {
  // Use pre-computed dependency relationships from the Kotlin analyzer if available
  if ((project as any).dependencyRelationships && (project as any).dependencyRelationships[phaseName]) {
    return Array.from((project as any).dependencyRelationships[phaseName]);
  }

  // Fallback to manual computation if pre-computed relationships are not available
  const dependsOn: string[] = [];
  const { groupId, artifactId, dependencies: projectDeps, parent } = project;

  // Add parent dependency first (parent POMs must be installed before children)
  // Only include parent dependencies that exist in the reactor (exclude external parents)
  if (parent) {
    const parentCoordinates = `${parent.groupId}:${parent.artifactId}`;
    const parentProjectName = coordinatesToProjectName.get(parentCoordinates);
    if (parentProjectName && parentProjectName !== `${groupId}.${artifactId}`) {
      const depPhase = getBestDependencyPhase(mavenData, parentProjectName, phaseName);
      dependsOn.push(`${parentProjectName}:${depPhase}`);
    }
  }

  // Add regular dependencies
  if (projectDeps && Array.isArray(projectDeps)) {
    for (const dep of projectDeps) {
      const depCoordinates = `${dep.groupId}:${dep.artifactId}`;
      const depProjectName = coordinatesToProjectName.get(depCoordinates);
      if (depProjectName && depProjectName !== `${groupId}.${artifactId}`) {
        const depPhase = getBestDependencyPhase(mavenData, depProjectName, phaseName);
        dependsOn.push(`${depProjectName}:${depPhase}`);
      }
    }
  }
  
  return dependsOn;
}

/**
 * Build all targets for a Maven project
 */
export function buildTargetsForProject(
  project: MavenProject,
  mavenData: MavenAnalysisData,
  coordinatesToProjectName: Map<string, string>
): Record<string, TargetConfiguration> {
  const targets: Record<string, TargetConfiguration> = {};
  const { groupId, artifactId, lifecycle, hasTests, projectType } = project;
  
  // Use qualified name with group and artifact for Maven -pl flag
  const qualifiedName = `${groupId}:${artifactId}`;

  // Generate targets from actual Maven lifecycle data using run-commands
  const allPhases = new Set<string>();
  
  // Add all detected phases from execution plan
  if (lifecycle?.phases) {
    lifecycle.phases.forEach(phase => allPhases.add(phase));
  }
  
  // Add common phases for this packaging type
  if (lifecycle?.commonPhases) {
    lifecycle.commonPhases.forEach(phase => allPhases.add(phase));
  }
  
  // Create targets for all unique phases with dependency relationships
  allPhases.forEach(phase => {
    const dependsOn = createDependsOnForPhase(project, phase, mavenData, coordinatesToProjectName);
    const target: TargetConfiguration = {
      executor: 'nx:run-commands',
      options: { 
        command: `mvn ${phase} -pl ${qualifiedName}`,
        cwd: '{workspaceRoot}'
      }
    };
    
    // Add dependsOn only if there are dependencies
    if (dependsOn.length > 0) {
      target.dependsOn = dependsOn;
    }
    
    targets[phase] = target;
  });
  
  // Add specific goal-based targets from lifecycle data
  if (lifecycle?.goals) {
    const goalsByPhase = new Map<string, string[]>();
    const seenGoals = new Set<string>();
    
    // Group goals by phase and create individual goal targets
    for (const goal of lifecycle.goals) {
      const goalCommand = `${goal.plugin}:${goal.goal}`;
      
      // Create individual goal target (avoid duplicates)
      if (!seenGoals.has(goalCommand)) {
        seenGoals.add(goalCommand);
        const goalTargetName = `${goal.plugin}-${goal.goal}`.replace(/[^a-zA-Z0-9\-_]/g, '-');
        targets[goalTargetName] = {
          executor: 'nx:run-commands',
          options: {
            command: `mvn ${goalCommand} -pl ${qualifiedName}`,
            cwd: '{workspaceRoot}'
          }
        };
      }
      
      // Group by phase for composite targets
      if (goal.phase) {
        if (!goalsByPhase.has(goal.phase)) {
          goalsByPhase.set(goal.phase, []);
        }
        goalsByPhase.get(goal.phase)!.push(goalCommand);
      }
    }
    
    // Create composite targets for phases with multiple goals
    goalsByPhase.forEach((goals, phase) => {
      if (goals.length > 1) {
        targets[`${phase}-all`] = {
          executor: 'nx:run-commands',
          options: {
            command: `mvn ${goals.join(' ')} -pl ${qualifiedName}`,
            cwd: '{workspaceRoot}'
          }
        };
      }
    });
  }
  
  // Fallback to essential targets if no lifecycle data
  if (!lifecycle || !lifecycle.commonPhases || lifecycle.commonPhases.length === 0) {
    const compileDependsOn = createDependsOnForPhase(project, 'compile', mavenData, coordinatesToProjectName);
    const compileTarget: TargetConfiguration = {
      executor: 'nx:run-commands',
      options: { 
        command: `mvn compile -pl ${qualifiedName}`,
        cwd: '{workspaceRoot}'
      }
    };
    if (compileDependsOn.length > 0) {
      compileTarget.dependsOn = compileDependsOn;
    }
    targets['compile'] = compileTarget;
    
    if (hasTests) {
      const testDependsOn = createDependsOnForPhase(project, 'test', mavenData, coordinatesToProjectName);
      const testTarget: TargetConfiguration = {
        executor: 'nx:run-commands',
        options: { 
          command: `mvn test -pl ${qualifiedName}`,
          cwd: '{workspaceRoot}'
        }
      };
      if (testDependsOn.length > 0) {
        testTarget.dependsOn = testDependsOn;
      }
      targets['test'] = testTarget;
    }
    
    if (projectType === 'application') {
      const packageDependsOn = createDependsOnForPhase(project, 'package', mavenData, coordinatesToProjectName);
      const packageTarget: TargetConfiguration = {
        executor: 'nx:run-commands',
        options: { 
          command: `mvn package -pl ${qualifiedName}`,
          cwd: '{workspaceRoot}'
        }
      };
      if (packageDependsOn.length > 0) {
        packageTarget.dependsOn = packageDependsOn;
      }
      targets['package'] = packageTarget;
    }
    
    const cleanDependsOn = createDependsOnForPhase(project, 'clean', mavenData, coordinatesToProjectName);
    const cleanTarget: TargetConfiguration = {
      executor: 'nx:run-commands',
      options: { 
        command: `mvn clean -pl ${qualifiedName}`,
        cwd: '{workspaceRoot}'
      }
    };
    if (cleanDependsOn.length > 0) {
      cleanTarget.dependsOn = cleanDependsOn;
    }
    targets['clean'] = cleanTarget;
  }

  return targets;
}