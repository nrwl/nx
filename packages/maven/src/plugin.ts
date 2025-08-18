import {
  CreateDependencies,
  CreateNodesResultV2,
  CreateNodesV2,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
  TargetConfiguration,
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
 * Create dependencies using Maven analysis results
 */
export const createDependencies: CreateDependencies = async (options, context) => {
  const opts: MavenPluginOptions = {...DEFAULT_OPTIONS, ...(options as MavenPluginOptions)};
  
  // Check for verbose logging from multiple sources
  const isVerbose = opts.verbose || process.env.NX_VERBOSE_LOGGING === 'true' || process.argv.includes('--verbose');

  if (isVerbose) {
    console.log(`\n📊 [DEPENDENCIES-PLUGIN] ===============================`);
    console.log(`📊 [DEPENDENCIES-PLUGIN] Maven createDependencies starting...`);
    console.log(`📊 [DEPENDENCIES-PLUGIN] Workspace root: ${context.workspaceRoot}`);
    console.log(`📊 [DEPENDENCIES-PLUGIN] ===============================`);
  }

  // For now, return empty dependencies array - can be enhanced later
  return [];
};

/**
 * Maven plugin that analyzes Maven projects and returns configurations
 */
export const createNodesV2: CreateNodesV2 = [
  '**/pom.xml',
  async (configFiles, options, context): Promise<CreateNodesResultV2> => {
    const opts: MavenPluginOptions = {...DEFAULT_OPTIONS, ...(options as MavenPluginOptions)};
    
    // Check for verbose logging from multiple sources
    const isVerbose = opts.verbose || process.env.NX_VERBOSE_LOGGING === 'true' || process.argv.includes('--verbose');

    if (isVerbose) {
      console.log(`\n🔍 [MAVEN-PLUGIN] ===========================================`);
      console.log(`🔍 [MAVEN-PLUGIN] Maven createNodesV2 starting...`);
      console.log(`🔍 [MAVEN-PLUGIN] Found ${configFiles.length} pom.xml files initially`);
      console.log(`🔍 [MAVEN-PLUGIN] Workspace root: ${context.workspaceRoot}`);
      console.log(`🔍 [MAVEN-PLUGIN] ===========================================`);
    }

    // Filter out unwanted pom.xml files
    const filteredFiles = configFiles.filter(file =>
      !file.includes('target/') &&
      !file.includes('node_modules/') &&
      !file.includes('src/test/') &&
      !file.includes('its/core-it-suite/src/test/')
    );

    if (isVerbose) {
      console.log(`🔍 [MAVEN-PLUGIN] After filtering: ${filteredFiles.length} pom.xml files`);
      if (configFiles.length !== filteredFiles.length) {
        console.log(`🔍 [MAVEN-PLUGIN] Filtered out ${configFiles.length - filteredFiles.length} test/build files`);
      }
    }

    if (filteredFiles.length === 0) {
      if (isVerbose) {
        console.log(`🔍 [MAVEN-PLUGIN] No valid pom.xml files found after filtering`);
      }
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

    if (isVerbose) {
      console.log(`🔍 [MAVEN-PLUGIN] Generated cache key: ${cacheKey}`);
    }

    // OPTIMIZATION: Check global in-memory cache first
    if (globalAnalysisCache && globalCacheKey === cacheKey) {
      if (isVerbose) {
        console.log(`🔍 [MAVEN-PLUGIN] ✅ HIT: Using global in-memory cache`);
      }
      return globalAnalysisCache.createNodesResults || [];
    }

    // Set up cache path
    const cachePath = join(workspaceDataDirectory, 'maven-analysis-cache.json');
    const cache = readMavenCache(cachePath);

    // Check if we have valid cached results
    if (cache[cacheKey]) {
      if (isVerbose) {
        console.log(`🔍 [MAVEN-PLUGIN] ✅ HIT: Using disk-cached Maven analysis results`);
      }
      // Store in global cache for faster subsequent access
      globalAnalysisCache = cache[cacheKey];
      globalCacheKey = cacheKey;
      return cache[cacheKey].createNodesResults || [];
    }

    if (isVerbose) {
      console.log(`🔍 [MAVEN-PLUGIN] ❌ MISS: No cache found - running fresh Maven analysis`);
    }

    // Run analysis if not cached
    const result = await runMavenAnalysis({...opts, verbose: isVerbose});

    // Cache the complete result
    cache[cacheKey] = result;
    writeMavenCache(cachePath, cache);

    // Store in global cache
    globalAnalysisCache = result;
    globalCacheKey = cacheKey;

    if (isVerbose) {
      console.log(`🔍 [MAVEN-PLUGIN] Results cached - returning ${result.createNodesResults?.length || 0} project nodes`);
    }

    return result.createNodesResults || [];
  },
];

/**
 * Run Maven analysis using our existing Java plugin
 */
async function runMavenAnalysis(options: MavenPluginOptions): Promise<any> {
  const outputFile = join(workspaceDataDirectory, 'nx-maven-projects.json');
  const isVerbose = options.verbose || process.env.NX_VERBOSE_LOGGING === 'true';

  if (isVerbose) {
    console.log(`\n🔧 [MAVEN-ANALYSIS] Starting Maven analysis...`);
    console.log(`🔧 [MAVEN-ANALYSIS] Output file: ${outputFile}`);
  }

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

  if (isVerbose) {
    console.log(`🔧 [MAVEN-ANALYSIS] Maven command: ${mavenExecutable} ${mavenArgs.join(' ')}`);
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
        if (isVerbose) {
          console.log(`🔧 [MAVEN-ANALYSIS] ✅ Maven analysis completed successfully`);
        }
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
  
  if (isVerbose) {
    console.log(`🔧 [MAVEN-ANALYSIS] Found ${mavenData.projects?.length || 0} projects`);
  }

  // Convert to Nx createNodesV2 format
  const createNodesResults: any[] = [];
  
  if (mavenData.projects && Array.isArray(mavenData.projects)) {
    for (const project of mavenData.projects) {
      const { artifactId, groupId, packaging, root, sourceRoot, hasTests, lifecycle } = project;
      
      if (!artifactId || !root) continue;
      
      const projectType = packaging === 'pom' ? 'library' : 'application';
      const targets: Record<string, TargetConfiguration> = {};
      
      // Use qualified name with group and artifact for Maven -pl flag
      const qualifiedName = `${groupId}:${artifactId}`;
      
      // Generate targets from actual Maven lifecycle data using run-commands
      if (lifecycle && lifecycle.commonPhases) {
        for (const phase of lifecycle.commonPhases) {
          targets[phase] = {
            executor: '@nx/workspace:run-commands',
            options: { 
              command: `mvn ${phase} -pl ${qualifiedName}`,
              cwd: '{workspaceRoot}'
            }
          };
        }
      }
      
      // Add specific goal-based targets from lifecycle data
      if (lifecycle && lifecycle.goals) {
        const goalsByPhase = new Map();
        
        // Group goals by phase
        for (const goal of lifecycle.goals) {
          if (goal.phase) {
            if (!goalsByPhase.has(goal.phase)) {
              goalsByPhase.set(goal.phase, []);
            }
            goalsByPhase.get(goal.phase).push(`${goal.plugin}:${goal.goal}`);
          }
        }
        
        // Create composite targets for phases with multiple goals
        for (const [phase, goals] of goalsByPhase.entries()) {
          if (goals.length > 1) {
            targets[`${phase}-all`] = {
              executor: '@nx/workspace:run-commands',
              options: {
                command: `mvn ${goals.join(' ')} -pl ${qualifiedName}`,
                cwd: '{workspaceRoot}'
              }
            };
          }
        }
      }
      
      // Fallback to essential targets if no lifecycle data
      if (!lifecycle || !lifecycle.commonPhases || lifecycle.commonPhases.length === 0) {
        targets['compile'] = {
          executor: '@nx/workspace:run-commands',
          options: { 
            command: `mvn compile -pl ${qualifiedName}`,
            cwd: '{workspaceRoot}'
          }
        };
        
        if (hasTests) {
          targets['test'] = {
            executor: '@nx/workspace:run-commands',
            options: { 
              command: `mvn test -pl ${qualifiedName}`,
              cwd: '{workspaceRoot}'
            }
          };
        }
        
        if (projectType === 'application') {
          targets['package'] = {
            executor: '@nx/workspace:run-commands',
            options: { 
              command: `mvn package -pl ${qualifiedName}`,
              cwd: '{workspaceRoot}'
            }
          };
        }
        
        targets['clean'] = {
          executor: '@nx/workspace:run-commands',
          options: { 
            command: `mvn clean -pl ${qualifiedName}`,
            cwd: '{workspaceRoot}'
          }
        };
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
    createDependencies: [] // Empty for now
  };
}

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