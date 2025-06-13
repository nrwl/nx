import {
  CreateDependencies,
  CreateNodesV2,
  CreateNodesContextV2,
  TargetConfiguration,
  workspaceRoot,
  logger,
  cacheDir,
  CreateNodesResult,
  CreateNodesResultV2,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { readFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import {
  MavenPluginGoal,
  MavenNxConfig,
  convertMavenNxConfigToProjectConfiguration,
} from './maven-nx-config';

const javaAnalyzer = join(__dirname, '../../project-graph/build/project-graph-1.0-SNAPSHOT.jar');

export interface MavenPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  serveTargetName?: string;
  mavenExecutable?: string;
  compilerArgs?: string[];
}

const DEFAULT_OPTIONS: MavenPluginOptions = {
  buildTargetName: 'build',
  testTargetName: 'test',
  serveTargetName: 'serve',
  mavenExecutable: 'mvn',
  compilerArgs: [],
};

/**
 * Maven plugin that uses a Java program to analyze pom.xml files
 * and generate Nx project configurations with comprehensive dependencies
 */
export const createNodesV2: CreateNodesV2 = [
  '**/pom.xml',
  async (configFiles, options, context): Promise<CreateNodesResultV2> => {
    const opts: MavenPluginOptions = Object.assign(
      {},
      DEFAULT_OPTIONS,
      options || {}
    );

    logger.debug(
      `Maven plugin found ${configFiles.length} total pom.xml files`
    );

    // Filter out the build artifact directories
    const filteredConfigFiles = configFiles.filter(
      (file) => !file.includes('target/') && !file.includes('node_modules/')
    );

    logger.debug(`Filtered config files: ${filteredConfigFiles.length} files`);

    if (filteredConfigFiles.length === 0) {
      return [];
    }

    try {
      // Send all files to Java - let Java handle batching and memory management
      const batchResults = await generateBatchNxConfigFromMavenAsync(
        filteredConfigFiles,
        opts,
        context
      );

      logger.debug(
        `Generated ${
          Object.keys(batchResults).length
        } Maven project configurations`
      );

      // Convert batch results to the expected format
      const tupleResults: CreateNodesResultV2 = [];

      for (const [projectRoot, nxConfig] of Object.entries(batchResults)) {
        // Convert absolute path from Java back to relative path for matching
        const relativePath = projectRoot.startsWith(workspaceRoot)
          ? projectRoot.substring(workspaceRoot.length + 1)
          : projectRoot;

        // Find the corresponding config file
        const configFile = filteredConfigFiles.find(
          (file) => dirname(file) === relativePath
        );
        if (!configFile) {
          logger.debug(
            `No config file found for projectRoot: "${relativePath}" (from: "${projectRoot}")`
          );
          if (Object.keys(batchResults).length < 5) {
            logger.debug(
              `Available config files: ${filteredConfigFiles
                .slice(0, 3)
                .join(', ')}`
            );
          }
          continue;
        }

        // Normalize and validate targets
        const normalizedTargets = normalizeTargets(
          nxConfig as MavenNxConfig,
          opts
        );

        const result: CreateNodesResult = {
          projects: {
            [relativePath]: {
              targets: normalizedTargets,
              ...convertMavenNxConfigToProjectConfiguration(
                relativePath,
                nxConfig
              ),
            },
          },
        };

        tupleResults.push([configFile, result]);
      }

      logger.debug(
        `Generated ${tupleResults.length} valid project configurations`
      );

      return tupleResults;
    } catch (error) {
      console.error(
        `Failed to process Maven projects with Java analyzer:`,
        error.message
      );
      throw new Error(`Maven analysis failed: ${error.message}`);
    }
  },
];

/**
 * Create dependencies based on Maven dependency analysis
 */

/**
 * Create dependencies (no caching needed - Java handles batch processing)
 */
export const createDependencies: CreateDependencies = async () => {
  logger.debug(`DEBUG: Dependency creation called`);

  // Dependencies are handled via target dependsOn configuration
  return [];
};

/**
 * Generate Nx configurations for multiple projects using batch processing
 */
async function generateBatchNxConfigFromMavenAsync(
  pomPaths: string[],
  options: MavenPluginOptions,
  context: CreateNodesContextV2
): Promise<Record<string, MavenNxConfig>> {
  try {
    // Convert relative paths to absolute paths
    const absolutePomPaths = pomPaths.map((pomPath) =>
      pomPath.startsWith('/') ? pomPath : join(workspaceRoot, pomPath)
    );

    logger.debug(`Processing ${absolutePomPaths.length} Maven projects...`);

    // Create unique output file name to avoid conflicts
    const outputFile = join(cacheDir, `maven-results.json`);

    let stdout = '';
    let stderr = '';
    try {
      const child = spawn('java', [
        `-Dmaven.output.file=${outputFile}`,
        `-Duser.dir=${workspaceRoot}`,
        '-jar',
        javaAnalyzer,
        `--hierarchical`,
        `--nx`,
        ...options.compilerArgs,
      ]);

      stdout = await new Promise<string>((resolve, reject) => {
        child.stdout!.on('data', (data) => (stdout += data.toString()));
        child.stderr!.on('data', (data) => (stderr += data.toString()));
        child.on('close', (code) => {
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(
              new Error(
                `Maven process exited with code ${code}. stderr: ${stderr}`
              )
            );
          }
        });
        child.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      stderr = error.stderr?.toString() || error.message;
      throw new Error(`Maven process exited with error. stderr: ${stderr}`);
    }

    if (stderr && stderr.trim()) {
      console.warn(`Maven analyzer stderr: ${stderr}`);
    }

    // Check if process completed successfully
    if (!stdout.includes('SUCCESS:')) {
      throw new Error('Maven analyzer did not complete successfully');
    }

    // Read JSON output from the file
    try {
      const jsonContent = readFileSync(outputFile, 'utf8');

      // Clean up the temp file
      try {
        unlinkSync(outputFile);
      } catch (e) {
        console.warn(`Could not delete temp file ${outputFile}: ${e.message}`);
      }

      const result = JSON.parse(jsonContent);

      // Check for errors in the result
      if (result._errors && result._errors.length > 0) {
        console.warn(
          `Maven analyzer encountered ${result._errors.length} errors:`
        );
        result._errors.forEach((error: string, index: number) => {
          console.warn(`  ${index + 1}. ${error}`);
        });
      }

      // Log statistics
      if (result._stats) {
        logger.debug(
          `Maven analysis stats: ${result._stats.successful}/${result._stats.processed} projects processed successfully (${result._stats.errors} errors)`
        );
      }

      // Remove metadata fields from result before returning
      delete result._errors;
      delete result._stats;

      return result;
    } catch (error) {
      throw new Error(
        `Failed to read output file ${outputFile}: ${error.message}`
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to execute Maven analyzer in batch mode: ${error.message}`
    );
  }
}

/**
 * Generate targets based on pre-calculated data from Java analyzer
 * Uses goalsByPhase and goalDependencies from Java for optimal structure
 */
function normalizeTargets(
  nxConfig: MavenNxConfig,
  options: MavenPluginOptions
): Record<string, TargetConfiguration> {
  const detectedTargets: Record<string, TargetConfiguration> = {};

  // Get pre-calculated data from Java analyzer
  const relevantPhases = nxConfig.relevantPhases || [];
  const pluginGoals = nxConfig.pluginGoals || [];
  const goalsByPhase = nxConfig.goalsByPhase || {};
  const goalDependencies = nxConfig.goalDependencies || {};
  const crossProjectDependencies = nxConfig.crossProjectDependencies || {};

  // Step 1: Generate goal targets using pre-calculated dependencies
  for (const goalInfo of pluginGoals) {
    if (goalInfo.targetName && !detectedTargets[goalInfo.targetName]) {
      const goalTarget = createGoalTarget(
        goalInfo,
        options,
        goalDependencies,
        crossProjectDependencies
      );
      if (goalTarget) {
        detectedTargets[goalInfo.targetName] = goalTarget;
      }
    }
  }

  // Step 2: Generate phase targets that depend on their own goals (from Java)
  for (const phase of relevantPhases) {
    const phaseTarget = createPhaseTarget(phase, options, goalsByPhase);
    if (phaseTarget) {
      detectedTargets[phase] = phaseTarget;
    }
  }

  return detectedTargets;
}

/**
 * Create a target configuration for a Maven phase (aggregator that depends on its own goals)
 */
function createPhaseTarget(
  phase: string,
  options: MavenPluginOptions,
  goalsByPhase: Record<string, string[]>
): TargetConfiguration | null {
  const baseInputs = ['{projectRoot}/pom.xml'];
  const baseCommand = `${options.mavenExecutable} ${phase}`;

  // Define phase-specific configurations
  const phaseConfig: Record<string, Partial<TargetConfiguration>> = {
    clean: {
      inputs: baseInputs,
      outputs: [],
    },
    validate: {
      inputs: baseInputs,
      outputs: [],
    },
    compile: {
      inputs: ['{projectRoot}/src/main/**/*', ...baseInputs],
      outputs: ['{projectRoot}/target/classes/**/*'],
    },
    'test-compile': {
      inputs: [
        '{projectRoot}/src/test/**/*',
        '{projectRoot}/src/main/**/*',
        ...baseInputs,
      ],
      outputs: ['{projectRoot}/target/test-classes/**/*'],
    },
    test: {
      inputs: [
        '{projectRoot}/src/test/**/*',
        '{projectRoot}/src/main/**/*',
        ...baseInputs,
      ],
      outputs: [
        '{projectRoot}/target/surefire-reports/**/*',
        '{projectRoot}/target/test-classes/**/*',
      ],
    },
    package: {
      inputs: ['{projectRoot}/src/**/*', ...baseInputs],
      outputs: ['{projectRoot}/target/*.jar', '{projectRoot}/target/*.war'],
    },
    verify: {
      inputs: ['{projectRoot}/src/**/*', ...baseInputs],
      outputs: [
        '{projectRoot}/target/**/*',
        '{projectRoot}/target/failsafe-reports/**/*',
      ],
    },
    install: {
      inputs: ['{projectRoot}/src/**/*', ...baseInputs],
      outputs: ['{projectRoot}/target/**/*'],
    },
    deploy: {
      inputs: ['{projectRoot}/src/**/*', ...baseInputs],
      outputs: ['{projectRoot}/target/**/*'],
    },
    site: {
      inputs: ['{projectRoot}/src/**/*', ...baseInputs],
      outputs: ['{projectRoot}/target/site/**/*'],
    },
    'integration-test': {
      inputs: ['{projectRoot}/src/**/*', ...baseInputs],
      outputs: ['{projectRoot}/target/failsafe-reports/**/*'],
    },
  };

  const config = phaseConfig[phase] || {
    inputs: baseInputs,
    outputs: [],
  };

  const targetConfig: TargetConfiguration = {
    executor: '@nx/run-commands:run-commands',
    options: {
      command: baseCommand,
      cwd: '{projectRoot}',
    },
    metadata: {
      type: 'phase',
      phase: phase,
      technologies: ['maven'],
      description: `Maven lifecycle phase: ${phase} (aggregator)`,
    },
    ...config,
  };

  // Phase depends on all its own goals
  const goalsInPhase = goalsByPhase[phase] || [];
  if (goalsInPhase.length > 0) {
    targetConfig.dependsOn = goalsInPhase;
  }

  return targetConfig;
}

/**
 * Create a target configuration for a plugin goal using pre-calculated dependencies
 */
function createGoalTarget(
  goalInfo: MavenPluginGoal,
  options: MavenPluginOptions,
  goalDependencies: Record<string, string[]>,
  crossProjectDependencies: Record<string, string[]>
): TargetConfiguration | null {
  const { pluginKey, goal, targetType, phase } = goalInfo;

  // Create the Maven command
  const [groupId, artifactId] = pluginKey.split(':');
  const command = `${options.mavenExecutable} ${groupId}:${artifactId}:${goal}`;

  // Create a more user-friendly description
  const pluginName = artifactId
    .replace('-maven-plugin', '')
    .replace('-plugin', '');
  let description = `${pluginName}:${goal}`;

  // Add framework-specific descriptions
  if (pluginKey.includes('quarkus')) {
    switch (goal) {
      case 'dev':
        description = 'Start Quarkus development mode';
        break;
      case 'build':
        description = 'Build Quarkus application';
        break;
      case 'generate-code':
        description = 'Generate Quarkus code';
        break;
      case 'test':
        description = 'Run Quarkus tests';
        break;
      default:
        description = `Quarkus ${goal}`;
    }
  } else if (pluginKey.includes('spring-boot')) {
    switch (goal) {
      case 'run':
        description = 'Start Spring Boot application';
        break;
      case 'build-image':
        description = 'Build Spring Boot Docker image';
        break;
      case 'repackage':
        description = 'Repackage Spring Boot application';
        break;
      default:
        description = `Spring Boot ${goal}`;
    }
  } else if (pluginKey.includes('surefire')) {
    description = 'Run unit tests';
  } else if (pluginKey.includes('failsafe')) {
    description = 'Run integration tests';
  }

  // Base configuration
  const baseConfig: TargetConfiguration = {
    executor: '@nx/run-commands:run-commands',
    options: {
      command,
      cwd: '{projectRoot}',
    },
    metadata: {
      type: 'goal',
      plugin: pluginKey,
      goal: goal,
      targetType: targetType,
      phase: phase !== 'null' ? phase : undefined,
      technologies: ['maven'],
      description: description,
    },
    inputs: ['{projectRoot}/pom.xml'],
    outputs: [],
  };

  // Customize based on target type
  switch (targetType) {
    case 'serve':
      baseConfig.inputs!.push('{projectRoot}/src/**/*');
      break;
    case 'build':
      baseConfig.inputs!.push('{projectRoot}/src/**/*');
      baseConfig.outputs = ['{projectRoot}/target/**/*'];
      break;
    case 'test':
      baseConfig.inputs!.push(
        '{projectRoot}/src/test/**/*',
        '{projectRoot}/src/main/**/*'
      );
      baseConfig.outputs = ['{projectRoot}/target/surefire-reports/**/*'];
      break;
    case 'deploy':
      baseConfig.inputs!.push('{projectRoot}/src/**/*');
      break;
    case 'utility':
      baseConfig.inputs!.push('{projectRoot}/src/**/*');
      break;
  }

  // Get goal-to-goal dependencies from Java analyzer
  const targetName = goalInfo.targetName || goal;
  const goalDeps = goalDependencies[targetName] || [];

  // Get cross-project dependencies for this target
  const crossProjectDeps = crossProjectDependencies[targetName] || [];

  // Merge goal dependencies and cross-project dependencies
  const allDependencies = [...goalDeps, ...crossProjectDeps];
  if (allDependencies.length > 0) {
    // Resolve cross-project dependencies with fallbacks
    const resolvedDeps = allDependencies
      .map((dep) => {
        if (dep.includes(':')) {
          return resolveCrossProjectDependency(dep);
        }
        return dep;
      })
      .filter((dep) => dep !== null);

    if (resolvedDeps.length > 0) {
      baseConfig.dependsOn = resolvedDeps;
    }
  }

  return baseConfig;
}

/**
 * Resolve cross-project dependency with fallback support
 * Handles dependencies like "projectA:package|compile|validate"
 */
function resolveCrossProjectDependency(dependency: string): string {
  if (!dependency.includes(':')) {
    return dependency; // Not a cross-project dependency
  }

  const [project, fallbackChain] = dependency.split(':', 2);
  if (!fallbackChain || !fallbackChain.includes('|')) {
    return dependency; // No fallback, return as-is
  }

  // For now, just return the first target in the fallback chain
  // In a complete implementation, this would check which targets actually exist
  const targets = fallbackChain.split('|');
  return `${project}:${targets[0]}`;
}

/**
 * Plugin configuration for registration
 */
export default {
  createNodesV2,
  createDependencies,
};
