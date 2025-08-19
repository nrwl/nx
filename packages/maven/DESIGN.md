# Nx Maven Plugin Design

## Overview

The Nx Maven Plugin enables seamless integration between Maven projects and Nx, allowing Maven builds to benefit from Nx's intelligent caching, task scheduling, and dependency graph analysis. The plugin acts as a bridge between Maven's project model and Nx's execution framework.

## Architecture

### Two-Component Design

The plugin consists of two main components that work together:

1. **TypeScript Plugin (`packages/maven/src/plugin.ts`)** - Nx plugin interface
2. **Kotlin Analyzer (`packages/maven/analyzer-plugin/`)** - Maven project analysis

```
┌─────────────────┐    spawns    ┌─────────────────────┐
│   Nx Plugin     │─────────────▶│  Maven Analyzer    │
│  (TypeScript)   │              │    (Kotlin)         │
│                 │              │                     │
│ - Creates nodes │              │ - Reads Maven POMs  │
│ - Maps targets  │              │ - Analyzes deps     │
│ - Handles deps  │◀─────────────│ - Outputs JSON      │
└─────────────────┘   JSON data  └─────────────────────┘
```

### Core Workflow

1. **Discovery**: Nx discovers `pom.xml` files in the workspace
2. **Analysis**: TypeScript plugin spawns Kotlin analyzer via Maven
3. **Processing**: Analyzer scans all Maven projects and generates structured data
4. **Integration**: Plugin converts Maven data to Nx project configurations

## Key Features

### 1. Project Detection and Mapping

The plugin automatically discovers Maven projects by scanning for `pom.xml` files and creates corresponding Nx project configurations:

```typescript
export const createNodesV2: CreateNodesV2 = [
  '**/pom.xml',  // Pattern to match Maven projects
  async (configFiles, options, context) => {
    // Run Maven analysis and convert to Nx format
  }
];
```

### 2. Complete Lifecycle Support

The analyzer detects all Maven lifecycles, not just the default one:

- **Default Lifecycle**: compile, test, package, install, deploy
- **Clean Lifecycle**: clean
- **Site Lifecycle**: site, site-deploy

This ensures all Maven targets are available in Nx, including clean operations.

### 3. Smart Dependency Resolution

The plugin implements intelligent phase fallback logic to handle dependencies between projects that may not have all lifecycle phases:

```kotlin
// Find best available phase for dependency resolution
val availablePhases = depProject.lifecycle.phases
val requestedPhaseIndex = mavenPhases.indexOf(requestedPhase)

// Fallback to highest available phase before requested phase
for (i in requestedPhaseIndex - 1 downTo 0) {
    if (availablePhases.contains(mavenPhases[i])) {
        return mavenPhases[i]
    }
}
```

### 4. Multi-Module Project Support

The plugin properly handles Maven's multi-module project structure:

- Parent POM relationships
- Module dependencies
- Inheritance of configuration
- Proper build ordering

### 5. Target Mapping

Maven phases/goals are mapped to Nx targets with proper dependency chains:

| Maven Phase | Nx Target | Dependencies |
|-------------|-----------|-------------|
| clean | clean | - |
| compile | compile | process-resources of dependencies |
| test | test | compile + test dependencies |
| package | package | compile |
| install | install | package |
| verify | verify | test (with fallback logic) |

## Technical Implementation

### Kotlin Analyzer Deep Dive

The `NxProjectAnalyzerMojo` performs comprehensive Maven project analysis:

```kotlin
@Mojo(
    name = "analyze",
    defaultPhase = LifecyclePhase.VALIDATE,
    aggregator = true,  // Process all projects in one execution
    requiresDependencyResolution = ResolutionScope.NONE
)
class NxProjectAnalyzerMojo : AbstractMojo() {
    // Analyzes all projects in the reactor
}
```

#### Lifecycle Detection Strategy

The analyzer uses Maven's `LifecycleExecutor` to calculate execution plans for all major lifecycles:

```kotlin
val lifecyclePhases = listOf("deploy", "clean", "site")
val allExecutionPlans = lifecyclePhases.mapNotNull { phase ->
    try {
        lifecycleExecutor.calculateExecutionPlan(session, phase)
    } catch (e: Exception) {
        null // Skip phases that aren't applicable
    }
}
```

This approach ensures comprehensive phase detection while gracefully handling projects that don't support certain phases.

#### Dependency Analysis

The analyzer extracts several types of dependencies:

1. **Compile Dependencies**: Required for compilation
2. **Test Dependencies**: Required for testing  
3. **Parent Dependencies**: POM inheritance relationships
4. **Module Dependencies**: Multi-module relationships

### TypeScript Plugin Integration

The TypeScript plugin orchestrates the analysis and converts results to Nx format:

```typescript
async function runMavenAnalysis(options: MavenPluginOptions) {
    // Spawn Maven with our analyzer plugin
    const result = spawn('mvn', [
        'com.nx.maven:nx-maven-analyzer:analyze',
        '-Dnx.outputFile=nx-maven-projects.json'
    ], { stdio: 'pipe' });
    
    // Parse JSON output and convert to Nx format
    const mavenData = JSON.parse(jsonOutput);
    return convertToNxFormat(mavenData);
}
```

## Caching Strategy

The plugin is designed for optimal caching:

- **Nx Caching**: All Maven targets benefit from Nx's computation caching
- **Incremental Analysis**: Only re-analyzes when POMs change
- **Dependency Tracking**: Proper cache invalidation based on dependency changes

## Error Handling and Resilience

### Graceful Degradation

The plugin handles various edge cases gracefully:

- Missing lifecycle phases (e.g., POM projects without `verify`)
- Circular dependencies in parent relationships
- Invalid or incomplete POM files
- Maven execution failures

### Fallback Mechanisms

- **Phase Fallback**: Falls back to earlier phases when requested phase unavailable
- **Dependency Fallback**: Uses process-resources when compile unavailable
- **Analysis Fallback**: Continues processing other projects when one fails

## Performance Optimizations

### Parallel Execution

The plugin supports Nx's parallel execution:

```bash
# Configured via .env
NX_PARALLEL=50%
```

### Efficient Analysis

- Single Maven execution analyzes all projects
- Minimal filesystem operations
- Cached dependency resolution

## Testing Strategy

The plugin includes comprehensive testing:

### E2E Tests (`plugin.e2e.spec.ts`)

- **Project Detection**: Verifies all Maven projects are discovered
- **Target Creation**: Ensures all Maven phases become Nx targets
- **Dependency Resolution**: Tests complex dependency chains
- **Command Execution**: Validates actual Maven command execution
- **Parent POM Handling**: Tests inheritance scenarios

### Test Coverage

- Simple JAR projects
- Multi-module projects  
- POM-only projects
- Projects with complex dependencies
- Parent-child relationships

## Integration Points

### With Nx Core

- Implements `CreateNodesV2` interface for project discovery
- Uses Nx's dependency graph for build optimization
- Integrates with Nx's caching system
- Supports Nx's task scheduling

### With Maven

- Leverages Maven's project model and lifecycle
- Uses Maven's dependency resolution
- Integrates with Maven's plugin system
- Respects Maven's configuration inheritance

## Future Enhancements

### Planned Features

- **Advanced Caching**: More granular cache keys based on source changes
- **Plugin Configuration**: Support for custom Maven plugin configurations  
- **Profile Support**: Handle Maven profiles and conditional builds
- **Test Integration**: Better integration with Maven Surefire/Failsafe
- **IDE Integration**: Enhanced support for IDE features

### Extensibility

The plugin is designed to be extensible:

- Plugin options for customization
- Configurable target naming
- Pluggable dependency resolution strategies
- Support for custom Maven goals

This design enables Maven projects to fully participate in Nx's ecosystem while maintaining Maven's familiar build semantics and respecting existing Maven configurations.