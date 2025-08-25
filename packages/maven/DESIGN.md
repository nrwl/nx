# Nx Maven Plugin Design

## Overview

The Nx Maven Plugin enables seamless integration between Maven projects and Nx, allowing Maven builds to benefit from Nx's intelligent caching, task scheduling, and dependency graph analysis. The plugin acts as a bridge between Maven's project model and Nx's execution framework.

## Architecture

### Two-Component Design

The plugin consists of two main components that work together:

1. **TypeScript Plugin (`packages/maven/src/`)** - Nx plugin interface
2. **Kotlin Maven Analyzer Plugin** - External Maven plugin for project analysis

```
┌─────────────────┐    spawns    ┌─────────────────────┐
│   Nx Plugin     │─────────────▶│  Maven Analyzer    │
│  (TypeScript)   │              │   Plugin (Kotlin)  │
│                 │              │                     │
│ - Plugin entry  │              │ - Reads Maven POMs  │
│ - Node creation │              │ - Analyzes deps     │
│ - Dep resolution│◀─────────────│ - Outputs JSON      │
└─────────────────┘   JSON data  └─────────────────────┘
```

### Core Workflow

1. **Discovery**: Nx discovers `pom.xml` files using the `**/pom.xml` glob pattern
2. **Root Check**: Plugin only processes if a root `pom.xml` exists in workspace root
3. **Analysis**: TypeScript plugin spawns external Kotlin analyzer via Maven execution
4. **Caching**: Results are cached and reused until POMs change or verbose mode is enabled
5. **Integration**: Pre-computed Nx project configurations are returned directly

## Key Components

### 1. Entry Point (`src/index.ts`)

Exports the main plugin functions:
- `createNodesV2` - Project discovery and configuration
- `createDependencies` - Inter-project dependency resolution
- `getCachedMavenData` / `clearMavenDataCache` - Cache management

### 2. Node Creation (`src/plugins/nodes.ts`)

Implements Nx's `CreateNodesV2` interface:

```typescript
export const createNodesV2: CreateNodesV2 = [
  '**/pom.xml',  // Discovers all Maven projects
  async (configFiles, options, context) => {
    // Only process if root pom.xml exists
    const rootPomExists = configFiles.some(file => file === 'pom.xml');
    if (!rootPomExists) return [];
    
    // Get cached data or run fresh analysis
    let mavenData = getCachedMavenData(context.workspaceRoot, isVerbose);
    if (!mavenData) {
      mavenData = await runMavenAnalysis({...opts, verbose: isVerbose});
    }
    
    // Return pre-computed Nx configurations
    return mavenData.createNodesResults || [];
  }
];
```

**Key Features:**
- **Root POM Guard**: Only analyzes when root `pom.xml` present to avoid partial processing
- **Verbose Mode Support**: Bypasses cache when `NX_VERBOSE_LOGGING=true` or `verbose` option set
- **Error Resilience**: Returns empty array on analysis failure with warning message
- **Direct Passthrough**: Returns analyzer's pre-computed `createNodesResults` without modification

### 3. Maven Analysis (`src/plugins/maven-analyzer.ts`)

Orchestrates external Kotlin analyzer execution:

```typescript
export async function runMavenAnalysis(options: MavenPluginOptions): Promise<MavenAnalysisData> {
  // Detect Maven wrapper or fallback to 'mvn'
  const mavenExecutable = detectMavenWrapper();
  
  // Configure Maven command
  const mavenArgs = [
    'dev.nx.maven:nx-maven-analyzer-plugin:1.0.1:analyze',
    `-Dnx.outputFile=${outputFile}`,
    '--batch-mode',
    '--no-transfer-progress'
  ];
  
  // Execute and parse JSON output
  const result = JSON.parse(jsonContent) as MavenAnalysisData;
  return result;
}
```

**Key Features:**
- **Maven Wrapper Detection**: Automatically uses `./mvnw` or `mvnw.cmd` if present
- **External Plugin Execution**: Runs `dev.nx.maven:nx-maven-analyzer-plugin:1.0.1:analyze`
- **Output File Management**: Writes analysis to workspace data directory
- **Verbose Mode**: Forwards Maven output in real-time when verbose enabled
- **Error Handling**: Comprehensive logging and error reporting

### 4. Caching System (`src/plugins/maven-data-cache.ts`)

Manages analysis result caching to improve performance:

```typescript
export function getCachedMavenData(workspaceRoot: string, ignoreCache?: boolean): MavenAnalysisData | null {
  if (ignoreCache) return null;
  
  // Check if cache exists and is newer than any POM files
  // Return cached data if valid, null if stale
}
```

**Cache Strategy:**
- **File-based**: Stores JSON analysis in workspace data directory
- **Staleness Detection**: Invalidates when any POM file is newer than cache
- **Verbose Override**: Bypasses cache entirely in verbose mode
- **Performance**: Eliminates repeated Maven analysis on unchanged projects

### 5. Dependency Resolution (`src/plugins/dependencies.ts`)

Creates Nx dependency graph from Maven analysis:

```typescript
export const createDependencies: CreateDependencies = (_options, context) => {
  const mavenData = getCachedMavenData(context.workspaceRoot);
  
  // Extract dependencies from compile target's dependsOn
  for (const [projectRoot, projectsWrapper] of mavenData.createNodesResults) {
    const compileTarget = projectConfig.targets?.compile;
    if (compileTarget && compileTarget.dependsOn) {
      // Process project:phase dependencies
    }
  }
  
  return dependencies;
};
```

**Dependency Sources:**
- **Compile Dependencies**: Extracted from `compile` target's `dependsOn` array
- **Format Handling**: Supports both string (`"projectName:phase"`) and object formats
- **Static Type**: All dependencies marked as `DependencyType.static`
- **Source Tracking**: Links dependencies to source POM files

## Data Flow

### Analysis Pipeline

1. **Trigger**: Nx calls `createNodesV2` when discovering projects
2. **Guard Check**: Ensures root `pom.xml` exists in workspace
3. **Cache Check**: Looks for existing analysis results (unless verbose mode)
4. **External Analysis**: Spawns Maven with Kotlin analyzer plugin if needed
5. **JSON Output**: Kotlin analyzer writes complete Nx configuration to JSON file
6. **Direct Return**: TypeScript plugin returns pre-computed results without transformation

### Data Format

The Kotlin analyzer produces a complete `MavenAnalysisData` structure:

```typescript
export interface MavenAnalysisData {
  createNodesResults: CreateNodesResult[];  // Complete Nx project configurations
  generatedAt?: number;
  workspaceRoot?: string;
  totalProjects?: number;
}

export type CreateNodesResult = [string, ProjectsWrapper];

export interface ProjectsWrapper {
  projects: Record<string, ProjectConfiguration>;  // Full Nx ProjectConfiguration
}
```

**Key Aspects:**
- **Complete Configuration**: Each project includes full target definitions with executors, options, and dependencies
- **Maven Command Generation**: Targets use `nx:run-commands` executor with proper Maven commands
- **Dependency Chains**: Inter-project dependencies pre-computed in `dependsOn` arrays
- **Caching Configuration**: Targets include cache and parallelism settings

### Target Structure

Each Maven phase becomes an Nx target:

```json
{
  "compile": {
    "executor": "nx:run-commands",
    "options": {
      "command": "mvn compile -pl org.apache.maven:project-name",
      "cwd": "{workspaceRoot}"
    },
    "dependsOn": ["dependent-project:process-resources"],
    "cache": false,
    "parallelism": true
  }
}
```

## Performance Optimizations

### Efficient Analysis Strategy

- **Single Execution**: One Maven command analyzes entire workspace
- **External Processing**: Heavy lifting done by Kotlin analyzer, not in Nx process
- **Pre-computation**: All Nx configurations generated by analyzer, no runtime transformation
- **Smart Caching**: Results cached until POM files change

### Selective Processing

- **Root Guard**: Only processes workspaces with root `pom.xml`
- **Cache Bypass**: Verbose mode forces fresh analysis for debugging
- **Incremental**: Cache invalidation based on POM modification times

## Error Handling

### Graceful Degradation

The plugin handles various failure scenarios:

- **Maven Execution Failure**: Logs warning and returns empty project list
- **Missing Output**: Throws error if analyzer doesn't produce expected JSON
- **Parse Errors**: Logs JSON content and re-throws parse exceptions
- **Spawn Errors**: Catches process spawn failures with descriptive messages

### Debugging Support

- **Verbose Logging**: Extensive console output when `NX_VERBOSE_LOGGING=true`
- **Process Tracking**: Logs Maven command, working directory, and process IDs
- **Output Forwarding**: Real-time Maven output in verbose mode
- **Error Context**: Includes Maven stderr/stdout in error messages

## Integration Points

### With Nx Core

- **CreateNodesV2**: Implements official Nx project discovery interface
- **CreateDependencies**: Provides inter-project dependency information
- **Official Types**: Uses `@nx/devkit` types throughout for compatibility
- **Cache Integration**: Works with Nx's caching system via target configuration

### With Maven Ecosystem

- **Maven Wrapper**: Automatic detection and use of project's Maven wrapper
- **External Plugin**: Uses published `dev.nx.maven:nx-maven-analyzer-plugin:1.0.1`
- **Batch Mode**: Non-interactive Maven execution with proper progress reporting
- **Multi-module**: Handles complex Maven multi-module project structures

### External Dependencies

- **Kotlin Analyzer**: Relies on external Maven plugin for heavy analysis work
- **Maven Installation**: Requires Maven or Maven wrapper in workspace
- **Java Runtime**: Needs Java to execute Maven and Kotlin analyzer

## Current Limitations

### Scope

- **Root POM Required**: Only processes workspaces with root `pom.xml` file
- **Cache Strategy**: Simple file modification time-based cache invalidation
- **Static Dependencies**: All dependencies marked as static type

### External Dependencies

- **Maven Plugin Version**: Hardcoded to `1.0.1` version of analyzer plugin
- **Network Access**: Requires network to download analyzer plugin on first use
- **Java Environment**: Depends on proper Java/Maven setup in environment

This design enables Maven projects to fully participate in Nx's ecosystem while leveraging external tooling for the complex Maven project model analysis, resulting in a clean separation of concerns and optimal performance.