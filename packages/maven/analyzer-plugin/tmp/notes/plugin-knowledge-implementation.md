# Plugin Knowledge Implementation

## Overview
Added a comprehensive plugin knowledge system to the Maven analyzer plugin that provides predefined mappings of known Maven plugin parameters to their input/output roles.

## Components Created

### 1. JSON Resource File (`known-plugin-parameters.json`)
- Located: `src/main/resources/known-plugin-parameters.json`
- Structure: `plugins -> goals -> {inputParameters[], outputParameters[]}`
- Contains mappings for 15+ common Maven plugins including:
  - maven-compiler-plugin
  - maven-surefire-plugin
  - maven-jar-plugin
  - maven-resources-plugin
  - maven-war-plugin
  - spring-boot-maven-plugin
  - And many others

### 2. PluginKnowledge Class
- Located: `src/main/kotlin/dev/nx/maven/PluginKnowledge.kt`
- Singleton pattern for efficient resource loading
- Jackson-based JSON parsing with caching
- Key methods:
  - `getParameterRole(pluginId, goal, parameter)` - Returns INPUT/OUTPUT/null
  - `isKnownPlugin(pluginId)` - Checks if plugin is in knowledge base
  - `isKnownGoal(pluginId, goal)` - Checks if goal is known
  - `getKnownInputParameters(pluginId, goal)` - Returns input parameter names
  - `getKnownOutputParameters(pluginId, goal)` - Returns output parameter names

### 3. PhaseAnalyzer Integration
- Modified `analyzeParameterRole()` method to check plugin knowledge first
- Plugin knowledge has highest priority before Maven expressions
- Falls back to existing heuristics for unknown plugins/parameters
- Added plugin context (artifactId + goal) to parameter analysis

## Benefits
- **Improved Accuracy**: Explicit knowledge about well-known plugins vs heuristic guessing
- **Better Performance**: Fast lookups vs complex pattern matching
- **Extensibility**: Easy to add new plugins by updating JSON
- **Maintainability**: Clear separation of plugin knowledge from analysis logic

## JSON Structure Example
```json
{
  "plugins": {
    "maven-compiler-plugin": {
      "goals": {
        "compile": {
          "inputParameters": ["sourceDirectory", "classpath"],
          "outputParameters": ["outputDirectory", "target"]
        }
      }
    }
  }
}
```

## Dependencies Added
- `jackson-module-kotlin:2.16.1` for Kotlin-friendly JSON parsing

## Implementation Notes
- Null-safe parameter handling
- Graceful fallback if JSON loading fails
- Thread-safe singleton initialization
- Detailed logging for debugging