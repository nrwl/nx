import {
  CreateDependencies,
  CreateNodesResultV2,
  CreateNodesV2,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
  TargetConfiguration,
  DependencyType,
} from '@nx/devkit';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';

export interface MavenPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  serveTargetName?: string;
  verbose?: boolean;
}

const DEFAULT_OPTIONS: MavenPluginOptions = {};

// Global cache to avoid running Maven analysis multiple times
let globalAnalysisCache: any = null;
let globalCacheKey: string | null = null;

// Cache management functions
function readMavenCache(cachePath: string): Record<string, any> {
  try {
    return existsSync(cachePath) ? readJsonFile(cachePath) : {};
  } catch {
    return {};
  }
}

function writeMavenCache(cachePath: string, cache: Record<string, any>) {
  try {
    writeJsonFile(cachePath, cache);
  } catch (error) {
    console.warn('Failed to write Maven cache:', error instanceof Error ? error.message : String(error));
  }
}


/**
 * Maven plugin that analyzes Maven projects and returns configurations
 */
export const createNodesV2: CreateNodesV2 = [
  '**/pom.xml',
  async (configFiles, options, context): Promise<CreateNodesResultV2> => {
    const opts: MavenPluginOptions = {...DEFAULT_OPTIONS, ...(options as MavenPluginOptions)};
    
    // Check for verbose logging from multiple sources  
    const isVerbose = false; // Disable all verbose logging for cleaner output

    // Only process if we have the root pom.xml in the workspace root
    const rootPomExists = configFiles.some(file => file === 'pom.xml');
    if (!rootPomExists) {
      return [];
    }



    // Generate cache key based on pom.xml files and options
    const projectHash = await calculateHashForCreateNodes(
      workspaceRoot,
      (options as object) ?? {},
      context,
      ['{projectRoot}/pom.xml', '{workspaceRoot}/**/pom.xml']
    );
    const cacheKey = projectHash;


    // OPTIMIZATION: Check global in-memory cache first
    if (globalAnalysisCache && globalCacheKey === cacheKey) {
      return globalAnalysisCache.createNodesResults || [];
    }

    // Set up cache path
    const cachePath = join(workspaceDataDirectory, 'maven-analysis-cache.json');
    const cache = readMavenCache(cachePath);

    // Check if we have valid cached results
    if (cache[cacheKey]) {
      // Store in global cache for faster subsequent access
      globalAnalysisCache = cache[cacheKey];
      globalCacheKey = cacheKey;
      return cache[cacheKey].createNodesResults || [];
    }


    // Run analysis if not cached
    const result = await runMavenAnalysis({...opts, verbose: isVerbose});

    // Cache the complete result
    cache[cacheKey] = result;
    writeMavenCache(cachePath, cache);

    // Store in global cache
    globalAnalysisCache = result;
    globalCacheKey = cacheKey;


    return result.createNodesResults || [];
  },
];

/**
 * Run Maven analysis using our existing Java plugin
 */
async function runMavenAnalysis(options: MavenPluginOptions): Promise<any> {
  const outputFile = join(workspaceDataDirectory, 'nx-maven-projects.json');
  const isVerbose = options.verbose || process.env.NX_VERBOSE_LOGGING === 'true';


  // Detect Maven wrapper or fallback to 'mvn'
  const mavenExecutable = detectMavenWrapper();
  
  const mavenArgs = [
    'com.nx.maven:nx-maven-analyzer-plugin:1.0-SNAPSHOT:analyze',
    `-Doutput.file=${outputFile}`,
    '--batch-mode',
    '--no-transfer-progress'
  ];

  if (!isVerbose) {
    mavenArgs.push('-q');
  }


  // Run Maven plugin
  await new Promise<void>((resolve, reject) => {
    const child = spawn(mavenExecutable, mavenArgs, {
      cwd: workspaceRoot,
      stdio: isVerbose ? 'inherit' : 'pipe'
    });

    let stdout = '';
    let stderr = '';

    if (!isVerbose) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        let errorMsg = `Maven analysis failed with code ${code}`;
        if (stderr) errorMsg += `\nStderr: ${stderr}`;
        if (stdout && !isVerbose) errorMsg += `\nStdout: ${stdout}`;
        reject(new Error(errorMsg));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn Maven process: ${error.message}`));
    });
  });

  // Read and parse the JSON output
  if (!existsSync(outputFile)) {
    throw new Error(`Maven analysis output file not found: ${outputFile}`);
  }

  const jsonContent = readFileSync(outputFile, 'utf8');
  const mavenData = JSON.parse(jsonContent);
  

  // Convert to Nx createNodesV2 format
  const createNodesResults: any[] = [];
  
  if (mavenData.projects && Array.isArray(mavenData.projects)) {
    // First pass: create a map of Maven coordinates to qualified project names for dependency resolution
    const coordinatesToProjectName = new Map();
    for (const project of mavenData.projects) {
      const { artifactId, groupId } = project;
      if (artifactId && groupId) {
        const coordinates = `${groupId}:${artifactId}`;
        const projectName = `${groupId}.${artifactId}`;
        coordinatesToProjectName.set(coordinates, projectName);
      }
    }
    
    // Second pass: create project configurations with dependsOn relationships
    for (const project of mavenData.projects) {
      const { artifactId, groupId, packaging, root, sourceRoot, hasTests, lifecycle, dependencies: projectDeps } = project;
      
      if (!artifactId || !root) continue;
      
      const projectType = packaging === 'pom' ? 'library' : 'application';
      const targets: Record<string, TargetConfiguration> = {};
      
      // Use qualified name with group and artifact for Maven -pl flag
      const qualifiedName = `${groupId}:${artifactId}`;
      
      // Create dependsOn relationships for Maven dependencies
      const createDependsOnForPhase = (phaseName: string): string[] => {
        const dependsOn: string[] = [];
        if (projectDeps && Array.isArray(projectDeps)) {
          for (const dep of projectDeps) {
            const depCoordinates = `${dep.groupId}:${dep.artifactId}`;
            const depProjectName = coordinatesToProjectName.get(depCoordinates);
            if (depProjectName && depProjectName !== `${groupId}.${artifactId}`) {
              dependsOn.push(`${depProjectName}:${phaseName}`);
            }
          }
        }
        return dependsOn;
      };
      
      // Generate targets from actual Maven lifecycle data using run-commands
      const allPhases = new Set();
      
      // Add all detected phases from execution plan
      if (lifecycle && lifecycle.phases) {
        for (const phase of lifecycle.phases) {
          allPhases.add(phase);
        }
      }
      
      // Add common phases for this packaging type
      if (lifecycle && lifecycle.commonPhases) {
        for (const phase of lifecycle.commonPhases) {
          allPhases.add(phase);
        }
      }
      
      // Create targets for all unique phases with dependency relationships
      allPhases.forEach(phase => {
        const phaseName = phase as string;
        const dependsOn = createDependsOnForPhase(phaseName);
        const target: TargetConfiguration = {
          executor: 'nx:run-commands',
          options: { 
            command: `mvn ${phaseName} -pl ${qualifiedName}`,
            cwd: '{workspaceRoot}'
          }
        };
        
        // Add dependsOn only if there are dependencies
        if (dependsOn.length > 0) {
          target.dependsOn = dependsOn;
        }
        
        targets[phaseName] = target;
      });
      
      // Add specific goal-based targets from lifecycle data
      if (lifecycle && lifecycle.goals) {
        const goalsByPhase = new Map();
        const seenGoals = new Set();
        
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
            goalsByPhase.get(goal.phase).push(goalCommand);
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
        const compileDependsOn = createDependsOnForPhase('compile');
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
          const testDependsOn = createDependsOnForPhase('test');
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
          const packageDependsOn = createDependsOnForPhase('package');
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
        
        const cleanDependsOn = createDependsOnForPhase('clean');
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

      const projectConfig = {
        name: `${groupId}.${artifactId}`,
        root: root,
        projectType,
        sourceRoot: sourceRoot,
        targets,
        tags: project.tags || [`maven:${groupId}`, `maven:${packaging}`]
      };
      
      createNodesResults.push([root, { projects: { [root]: projectConfig } }]);
    }
  }
  

  return {
    createNodesResults,
    createDependencies: []
  };
}

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

  let mavenData;
  try {
    const fileContent = readFileSync(actualAnalysisFile, 'utf-8');
    mavenData = JSON.parse(fileContent);
  } catch (error) {
    return [];
  }

  const dependencies = [];
  
  if (mavenData.projects && Array.isArray(mavenData.projects)) {
    
    // First, create a map of Maven coordinates to project names
    const projectMap = new Map();
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

/**
 * Detect Maven wrapper in workspace root, fallback to 'mvn'
 */
function detectMavenWrapper(): string {
  const isWindows = process.platform === 'win32';
  const wrapperFile = isWindows ? 'mvnw.cmd' : 'mvnw';
  const wrapperPath = join(workspaceRoot, wrapperFile);

  if (existsSync(wrapperPath)) {
    return wrapperPath;
  }

  return 'mvn';
}