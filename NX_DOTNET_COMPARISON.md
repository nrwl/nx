# Migration Guide: @nx-dotnet/core → @nx/dotnet

This guide compares the community `@nx-dotnet/core` plugin with Nx's official `@nx/dotnet` plugin. It provides detailed information about feature differences, migration paths, and configuration changes to help users transition smoothly.

> **Note**: `@nx-dotnet/core` is moving towards deprecation in favor of the official `@nx/dotnet` plugin.

---

## Table of Contents

- [Core Philosophy Differences](#core-philosophy-differences)
- [Project Management](#project-management)
- [Target System & Execution](#target-system--execution)
- [Dependency Graph Analysis](#dependency-graph-analysis)
- [Configuration System](#configuration-system)
- [Code Generation & Scaffolding](#code-generation--scaffolding)
- [Testing Support](#testing-support)
- [Special Features](#special-features)
- [Performance & Caching](#performance--caching)
- [Migration Checklist](#migration-checklist)

---

## Core Philosophy Differences

| Aspect                   | @nx-dotnet/core                          | @nx/dotnet                                   | Migration Notes                                                              |
| ------------------------ | ---------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| **Design Approach**      | Custom Nx generators wrap .NET CLI       | Project inference detects existing projects  | Switch to `dotnet new` for scaffolding, let Nx detect projects automatically |
| **Integration Strategy** | Executor-based with custom configuration | Command-based leveraging native .NET tooling | Update target configurations to use command-based approach                   |
| **.NET Ecosystem**       | Wraps .NET tools with Nx abstractions    | Embraces .NET tools directly                 | More transparent integration with standard .NET workflows                    |
| **Maintenance Model**    | Community-maintained                     | Nx-maintained with official support          | Better long-term support and updates                                         |

**Why the change?**

- .NET has mature scaffolding tools (`dotnet new`, templates)
- Project inference provides cleaner integration with the .NET ecosystem
- Command-based targets are more flexible and easier to customize
- Reduces maintenance burden by leveraging Microsoft's tooling

---

## Project Management

### Project Detection

| Feature                    | @nx-dotnet/core                                                                                                                                    | @nx/dotnet                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Detection Method**       | Scans for `*.{csproj,fsproj,vbproj}`                                                                                                               | Scans for `*.{csproj,fsproj,vbproj}`                                                                                                                        |
| **Naming Schemes**         | Two options: <br/>• **Nx scheme**: kebab-case (e.g., `my-api`) <br/>• **Dotnet scheme**: PascalCase namespace-style (e.g., `Company.Services.Api`) | Single naming based on directory/file: <br/>• Custom via `NxProjectName` property in `.csproj` <br/>• Supports custom naming via MSBuild                    |
| **Project Classification** | Based on file parsing and regex                                                                                                                    | Based on MSBuild evaluation: <br/>• `IsTestProject` property <br/>• `OutputType="Exe"` for executables <br/>• Package references (`Microsoft.NET.Test.Sdk`) |
| **Configuration**          | `inferProjects: true` (default) <br/> `ignorePaths` for filtering                                                                                  | Automatic detection, no opt-in needed                                                                                                                       |

**Migration**: Remove `inferProjects` and naming scheme configuration from `.nx-dotnet.rc.json`. Use MSBuild properties in `.csproj` files for custom naming if needed.

---

### Project Analysis Engine

| Component                | @nx-dotnet/core                                                        | @nx/dotnet                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Analysis Tool**        | XML parsing + `dotnet list`                                            | C# analyzer using `Microsoft.Build.Graph` (.NET 8+)                                                                                                     |
| **Properties Extracted** | Limited set via custom parsing                                         | 20+ MSBuild properties including: <br/>• TargetFramework <br/>• OutputPath, AssemblyName <br/>• OutputType, RootNamespace <br/>• SDK artifact locations |
| **Reference Detection**  | A call per project to `dotnet list references`, previously xml parsing | `Microsoft.Build.Graph.ProjectGraph` API (accurate, respects conditions)                                                                                |
| **Package Analysis**     | Basic NuGet package detection                                          | Full package reference analysis with transitive dependencies                                                                                            |
| **Batch Processing**     | Yes, processes all projects at once                                    | Yes, single-pass graph analysis                                                                                                                         |
| **Fallback Handling**    | Graceful degradation to file parsing                                   | Error handling with workspace-level diagnostics                                                                                                         |

**Key Improvement**: `@nx/dotnet` uses Microsoft's official MSBuild APIs for 100% accuracy, respecting all conditions and properties.

---

## Target System & Execution

### Target Types

| Target      | @nx-dotnet/core                                                               | @nx/dotnet                                                                      | Notes                                                   |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **build**   | ✅ Executor: `@nx-dotnet/core:build`                                          | ✅ Command: `dotnet build --no-restore --no-dependencies`                       | Command-based provides better transparency              |
| **test**    | ✅ Executor: `@nx-dotnet/core:test`                                           | ✅ Command: `dotnet test --no-build --no-restore` <br/> (Only on test projects) | Automatic detection based on project type               |
| **serve**   | ✅ Executor: `@nx-dotnet/core:serve` <br/> Uses `dotnet watch` + `dotnet run` | ❌ Not included                                                                 | Use `dotnet watch` directly or configure custom target  |
| **publish** | ✅ Executor: `@nx-dotnet/core:publish`                                        | ✅ Command: `dotnet publish` <br/> (Only on executable projects)                | Auto-configured for apps only                           |
| **pack**    | ❌ Not included                                                               | ✅ Command: `dotnet pack` <br/> (Only on library projects)                      | New: NuGet package creation                             |
| **restore** | ✅ Generator: `@nx-dotnet/core:restore`                                       | ✅ Command: `dotnet restore`                                                    | Now a standard target on all projects                   |
| **clean**   | ❌ Not included                                                               | ✅ Command: `dotnet clean`                                                      | New: Clean build artifacts                              |
| **format**  | ✅ Executor: `@nx-dotnet/core:format` <br/> Uses `dotnet-format` tool         | ❌ Not included                                                                 | Use `dotnet format` directly or configure custom target |

**Migration**:

- Replace executor-based targets with command-based equivalents
- Remove `serve` and `format` executors; configure them manually if needed
- Use new `pack`, `clean`, and `restore` targets

---

### Target Configuration

| Configuration Method | @nx-dotnet/core                                                                                                               | @nx/dotnet                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Location**         | Two options: <br/>1. `targetDefaults` in `nx.json` (executor-based keys) <br/>2. `.nx-dotnet.rc.json` under `inferredTargets` | Single location: <br/>`plugins[].options` in `nx.json`                                  |
| **Syntax**           | Executor-based: <br/>`"targetDefaults": { "@nx-dotnet/core:build": {...} }`                                                   | Command-based per-target: <br/>`"build": { "targetName": "compile", "options": {...} }` |
| **Customization**    | Via executor options and configurations                                                                                       | Via target-specific plugin options                                                      |

**Example Migration**:

**@nx-dotnet/core** (`nx.json`):

```json
{
  "plugins": [
    {
      "plugin": "@nx-dotnet/core",
      "options": {
        "inferredTargets": {
          "build": "build",
          "lint": {
            "targetName": "lint:dotnet",
            "cache": false
          },
          "test": false
        }
      }
    }
  ]
}
```

**@nx/dotnet** (`nx.json`):

```json
{
  "plugins": [
    {
      "plugin": "@nx/dotnet",
      "options": {
        "build": {
          "targetName": "build"
        },
        "test": false
      }
    }
  ]
}
```

---

## Dependency Graph Analysis

| Feature                   | @nx-dotnet/core                                                    | @nx/dotnet                                                   |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| **Analysis Method**       | Custom `create-dependencies.ts` utilizing `dotnet list references` | `Microsoft.Build.Graph.ProjectGraph` via C# analyzer         |
| **Accuracy**              | Good                                                               | Excellent - respects all MSBuild conditions and imports      |
| **Reference Types**       | Project-to-project references only                                 | Project-to-project + package references (for classification) |
| **Performance**           | Fast with caching                                                  | Fast with hash-based caching                                 |
| **Cross-platform Paths**  | Normalized (Windows/Unix)                                          | Normalized (Windows/Unix)                                    |
| **Unresolved References** | Graceful error handling                                            | Graceful error handling                                      |
| **Cache Invalidation**    | SHA256 hash of project files                                       | Hash includes project files + `Directory.Build.*`            |

**Key Differences**:

- `@nx/dotnet` leverages Microsoft's graph APIs for perfect accuracy
- Both use caching, but `@nx/dotnet` includes additional MSBuild files in hash

---

## Configuration System

### Configuration Files

| Configuration         | @nx-dotnet/core                            | @nx/dotnet                 |
| --------------------- | ------------------------------------------ | -------------------------- |
| **Primary Config**    | `.nx-dotnet.rc.json` (legacy) or `nx.json` | `nx.json` only             |
| **Migration Support** | Built-in migration from RC file to nx.json | N/A (new projects)         |
| **Hierarchy**         | Defaults → RC file → nx.json (deep merge)  | Defaults → nx.json (merge) |

---

### Available Options

| Option               | @nx-dotnet/core                          | @nx/dotnet                                      | Purpose                              |
| -------------------- | ---------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| **solutionFile**     | ✅ `{npmScope}.nx-dotnet.sln`            | ❌ Not applicable                               | Auto-generate `.sln` files           |
| **inferProjects**    | ✅ `true` (default)                      | ❌ Always on                                    | Toggle project detection             |
| **inferredTargets**  | ✅ Complex object with per-target config | ✅ Per-target options (build, test, pack, etc.) | Customize auto-generated targets     |
| **ignorePaths**      | ✅ Array of glob patterns                | ❌ Not needed                                   | Filter detected projects             |
| **moduleBoundaries** | ✅ Array of rules                        | ❌ Use `nx conformance` instead                 | Enforce architectural boundaries     |
| **nugetPackages**    | ✅ Object with package versions          | ❌ Not included                                 | Single Version Principle enforcement |
| **tags**             | ✅ Default tags for all projects         | ❌ Not included                                 | Auto-tagging projects                |

**Migration**:

- Remove `.nx-dotnet.rc.json`
- Move `inferredTargets` to plugin options in `nx.json`
- Replace `moduleBoundaries` with [Nx Conformance rules](https://nx.dev/concepts/conformance)
- Use central package management for NuGet versions

---

### Named Inputs

| Feature              | @nx-dotnet/core                           | @nx/dotnet                                                                                                                 |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Default Input**    | `default`                                 | Tries `production`, falls back to `default`                                                                                |
| **Custom Inputs**    | Manual configuration via `targetDefaults` | Configured in init generator                                                                                               |
| **Production Input** | Not configured                            | Excludes: <br/>• Test files (`**/*.Tests.*`, `**/*Test.*`) <br/>• Build outputs (`**/bin/**`, `**/obj/**`, `artifacts/**`) |

**@nx/dotnet init generator** creates:

```json
{
  "namedInputs": {
    "production": [
      "default",
      "!{projectRoot}/**/*.Tests.*",
      "!{projectRoot}/**/*Test.*",
      "!{projectRoot}/**/?(*.)+(spec|test).*",
      "!{projectRoot}/**/bin/**",
      "!{projectRoot}/**/obj/**",
      "!{workspaceRoot}/artifacts/**"
    ]
  }
}
```

---

## Code Generation & Scaffolding

### Generators

| Generator              | @nx-dotnet/core                                                                                          | @nx/dotnet                                                                | Migration Path                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **init**               | ✅ `nx g @nx-dotnet/core:init` <br/> Creates config, updates `.gitignore`                                | ✅ `nx g @nx/dotnet:init` <br/> Registers plugin, configures named inputs | Use `@nx/dotnet:init` for new workspaces                                                            |
| **app / application**  | ✅ Creates application with test project <br/> Options: language, testTemplate, pathScheme, solutionFile | ❌ Not included                                                           | Use `dotnet new` templates: <br/>`dotnet new webapi -n MyApi`                                       |
| **lib / library**      | ✅ Creates library with optional test project                                                            | ❌ Not included                                                           | Use `dotnet new classlib -n MyLib`                                                                  |
| **test**               | ✅ Adds test project to existing project                                                                 | ❌ Not included                                                           | Use `dotnet new nunit -n MyLib.Tests`                                                               |
| **project-reference**  | ✅ `nx g @nx-dotnet/core:project-reference --source A --target B`                                        | ❌ Not included                                                           | Use `dotnet add reference ../B/B.csproj`                                                            |
| **nuget-reference**    | ✅ `nx g @nx-dotnet/core:nuget-reference`                                                                | ❌ Not included                                                           | Use `dotnet add package PackageName`                                                                |
| **restore**            | ✅ Workspace-wide `dotnet restore`                                                                       | ❌ Not a generator (use `nx run-many -t restore`)                         | Run restore target directly                                                                         |
| **sync**               | ✅ Enforce Single Version Principle for NuGet                                                            | ❌ Not included                                                           | Use `Directory.Packages.props` or external tools                                                    |
| **move / mv**          | ✅ Move project, update all references                                                                   | ❌ Not included                                                           | Use Nx built-in: `nx g move --project A --destination new/path` (may need manual reference updates) |
| **add-swagger-target** | ✅ Configure Swagger extraction                                                                          | ❌ Not included                                                           | Manual configuration (guide TBD)                                                                    |
| **swagger-typescript** | ✅ Generate TypeScript from OpenAPI                                                                      | ❌ Not included                                                           | Use external tools or custom target                                                                 |

**Migration**:

- Use native `dotnet new` for scaffolding
- Use native `dotnet add reference` for project references
- Use native `dotnet add package` for NuGet packages
- Consider `Directory.Packages.props` for centralized package management
- Use Nx's `move` generator with caution (may need manual fixes)

---

### Template Support

| Feature              | @nx-dotnet/core                                | @nx/dotnet                                     |
| -------------------- | ---------------------------------------------- | ---------------------------------------------- |
| **Languages**        | C#, F#, Visual Basic with templates            | All languages (depends on installed templates) |
| **Custom Templates** | Via `dotnet new` integration                   | Via `dotnet new` (full native support)         |
| **Test Frameworks**  | nunit, xunit, mstest via `testTemplate` option | Any via `dotnet new` templates                 |

---

## Testing Support

### Test Project Detection

| Feature                  | @nx-dotnet/core                                                                 | @nx/dotnet                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Detection Method**     | Checks for `Microsoft.NET.Test.Sdk` package in project file (regex or analyzer) | Checks for: <br/>1. `IsTestProject` MSBuild property <br/>2. `Microsoft.NET.Test.Sdk` NuGet package <br/>3. `Microsoft.Testing.*` packages (newer framework) |
| **Accuracy**             | Good                                                                            | Excellent (uses MSBuild evaluation)                                                                                                                          |
| **Supported Frameworks** | NUnit, xUnit, MSTest                                                            | All (including Microsoft.Testing.Platform)                                                                                                                   |

---

### Test Execution

| Feature          | @nx-dotnet/core                                | @nx/dotnet                                                       |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| **Command**      | `dotnet test` via executor                     | `dotnet test --no-build --no-restore`                            |
| **Dependencies** | Manual: `dependsOn: ['^build']`                | Automatic: `dependsOn: ['build']`                                |
| **Caching**      | Disabled by default                            | Disabled (tests have side effects)                               |
| **Test Output**  | Configurable via executor options              | Standard `dotnet test` output                                    |
| **Filtering**    | Via executor options (test filters, verbosity) | Via command options: `nx test myapp -- --filter "Category=Unit"` |

**Example**:

```bash
# @nx-dotnet/core
nx test my-api --filter "Category=Unit" --verbosity normal

# @nx/dotnet
nx test my-api -- --filter "Category=Unit" --verbosity normal
```

---

## Special Features

### Module Boundaries / Architectural Rules

| Feature            | @nx-dotnet/core                                                                                                    | @nx/dotnet                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Enforcement**    | Pre-build target with custom rules                                                                                 | Use Nx Conformance                                                                           |
| **Configuration**  | `.nx-dotnet.rc.json`: <br/>`moduleBoundaries: [{ sourceTag: "api", onlyDependOnLibsWithTags: ["api", "shared"] }]` | `nx.json`: <br/>`conformance.rules: [{ "rule": "@nx/core:enforce-module-boundaries", ... }]` |
| **Cross-language** | .NET only                                                                                                          | All languages (TypeScript, Python, Go, etc.)                                                 |
| **Documentation**  | Custom implementation                                                                                              | [Nx Conformance Docs](https://nx.dev/docs/enterprise/powerpack/conformance)                  |

**Migration**: Replace `.nx-dotnet.rc.json` module boundaries with Nx Conformance rules.

---

### Swagger / OpenAPI Support

| Feature                | @nx-dotnet/core                                                              | @nx/dotnet      |
| ---------------------- | ---------------------------------------------------------------------------- | --------------- | -------------------------------------------------- |
| **Swagger Extraction** | ✅ `update-swagger` executor <br/> Creates library project with Swagger docs | ❌ Not included | Will be documented in migration guide              |
| **TypeScript Codegen** | ✅ `openapi-codegen` executor <br/> Uses OpenAPI Generator CLI               | ❌ Not included | Use external tools (e.g., `openapi-generator-cli`) |
| **Automation**         | ✅ Generator: `add-swagger-target`                                           | ❌ Manual setup | Use custom targets and hooks                       |

**Migration**: Documentation forthcoming for setting up Swagger extraction and codegen manually.

---

### NuGet Package Management

| Feature                      | @nx-dotnet/core                                      | @nx/dotnet                          |
| ---------------------------- | ---------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single Version Principle** | ✅ `sync` generator enforces workspace-wide versions | ❌ Not included                     | Use `Directory.Packages.props` (MSBuild 17+): <br/>[Central Package Management](https://learn.microsoft.com/nuget/consume-packages/central-package-management) |
| **Package Addition**         | ✅ `nuget-reference` generator                       | ❌ Not included                     | Use `dotnet add package`                                                                                                                                       |
| **Workspace Restore**        | ✅ `restore` generator                               | ✅ `restore` target on all projects | Run `nx run-many -t restore`                                                                                                                                   |

---

### Solution File Management

| Feature              | @nx-dotnet/core                                           | @nx/dotnet      |
| -------------------- | --------------------------------------------------------- | --------------- | -------------------------------------- |
| **Auto-add to .sln** | ✅ Generators automatically add projects to solution file | ❌ Not included | Use `dotnet sln add` manually          |
| **Configuration**    | `solutionFile: "{npmScope}.nx-dotnet.sln"`                | N/A             | Manage solutions independently from Nx |

---

## Performance & Caching

### Analysis Performance

| Feature                 | @nx-dotnet/core                         | @nx/dotnet                                       |
| ----------------------- | --------------------------------------- | ------------------------------------------------ |
| **Batch Analysis**      | ✅ All projects analyzed at once        | ✅ Single-pass `Microsoft.Build.Graph`           |
| **Caching**             | ✅ Hash-based (SHA256 of project files) | ✅ Hash-based (includes `Directory.Build.*`)     |
| **Cache Location**      | In-memory (session-scoped)              | Disk: `.nx/cache/dotnet-{hash}.hash` + in-memory |
| **Invalidation**        | Project file changes                    | Project file + MSBuild imports changes           |
| **Performance Logging** | Not included                            | ✅ Via `NX_PERF_LOGGING=true`                    |

---

### Build Caching

| Feature                  | @nx-dotnet/core                                  | @nx/dotnet                                                                                                               |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Nx Cache Integration** | ✅ Outputs: `bin/`, `obj/`, `dist/{projectRoot}` | ✅ Outputs: <br/>• `{projectRoot}/bin/**` <br/>• `{projectRoot}/obj/**` <br/>• `{workspaceRoot}/artifacts/**` (SDK 8.0+) |
| **Inputs**               | `default` named input                            | `production` (if available) or `default`                                                                                 |
| **Smart Hashing**        | File-based inputs                                | File-based inputs with exclusions                                                                                        |

---

## .NET Version Support

| Version            | @nx-dotnet/core | @nx/dotnet                    |
| ------------------ | --------------- | ----------------------------- |
| **.NET 8**         | ✅ Supported    | ✅ Supported (primary target) |
| **.NET 7**         | ✅ Supported    | ⚠️ May work but untested      |
| **.NET 6**         | ✅ Supported    | ⚠️ May work but untested      |
| **.NET 5**         | ✅ Supported    | ❌ Unsupported                |
| **.NET Core 3.1**  | ✅ Supported    | ❌ Unsupported                |
| **.NET Framework** | ❌ Unsupported  | ❌ Unsupported                |

**Note**: `@nx/dotnet` requires .NET SDK 8.0 or later. Older versions may work if SDK 8 is installed, but they are out of support and untested.

---

## Migration Checklist

### 1. Preparation

- [ ] Upgrade to .NET SDK 8.0 or later
- [ ] Update all projects to target at least .NET 8 (or accept unsupported status for older versions)
- [ ] Back up `.nx-dotnet.rc.json` if you have custom configurations
- [ ] Review current generators and executors in use

### 2. Install @nx/dotnet

```bash
nx add @nx/dotnet
```

This will:

- Add `@nx/dotnet` to `package.json`
- Register plugin in `nx.json`
- Configure `production` named input
- Update `.gitignore`

### 3. Remove @nx-dotnet/core

```bash
npm uninstall @nx-dotnet/core @nx-dotnet/utils @nx-dotnet/dotnet
```

- [ ] Remove plugin from `nx.json`
- [ ] Delete `.nx-dotnet.rc.json`

### 4. Migrate Configuration

- [ ] Move `inferredTargets` from `.nx-dotnet.rc.json` to `plugins[].options` in `nx.json`
- [ ] Update target names if customized
- [ ] Replace executor-based `targetDefaults` with command-based equivalents

**Example**:

```json
// Before: .nx-dotnet.rc.json
{
  "inferredTargets": {
    "build": "build",
    "test": "test:dotnet"
  }
}

// After: nx.json
{
  "plugins": [
    {
      "plugin": "@nx/dotnet",
      "options": {
        "build": { "targetName": "build" },
        "test": { "targetName": "test:dotnet" }
      }
    }
  ]
}
```

### 5. Replace Generators with Native Tools

| Old                                                            | New                                             |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `nx g @nx-dotnet/core:app my-api`                              | `dotnet new webapi -n MyApi`                    |
| `nx g @nx-dotnet/core:lib my-lib`                              | `dotnet new classlib -n MyLib`                  |
| `nx g @nx-dotnet/core:test my-lib-tests`                       | `dotnet new nunit -n MyLib.Tests`               |
| `nx g @nx-dotnet/core:project-reference --source A --target B` | `dotnet add A/A.csproj reference ../B/B.csproj` |
| `nx g @nx-dotnet/core:nuget-reference`                         | `dotnet add package PackageName`                |

### 6. Update Module Boundaries

- [ ] Evaluate replacing `moduleBoundaries` with Nx Conformance rules in `nx.json`, inlining the current script, or removing them if not needed

### 7. Setup NuGet Central Package Management (Optional)

Replace `@nx-dotnet/core:sync` with MSBuild's Central Package Management:

1. Create `Directory.Packages.props` at workspace root:

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageVersion Include="Microsoft.Extensions.Logging" Version="8.0.0" />
  </ItemGroup>
</Project>
```

2. Update project files to remove version attributes:

```xml
<!-- Before -->
<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />

<!-- After -->
<PackageReference Include="Newtonsoft.Json" />
```

[Learn more](https://learn.microsoft.com/nuget/consume-packages/central-package-management)

### 8. Handle Custom Executors

#### Serve Target

Replace:

```json
{
  "serve": {
    "executor": "@nx-dotnet/core:serve"
  }
}
```

With:

```json
{
  "serve": {
    "command": "dotnet watch run",
    "options": {
      "cwd": "{projectRoot}"
    }
  }
}
```

#### Format/Lint Target

Replace:

```json
{
  "lint": {
    "executor": "@nx-dotnet/core:format"
  }
}
```

With:

```json
{
  "lint": {
    "command": "dotnet format --verify-no-changes"
  }
}
```

### 9. Swagger & OpenAPI Migration

Documentation forthcoming. For now:

1. Use custom targets to run Swagger extraction
2. Use `openapi-generator-cli` or similar tools for TypeScript codegen
3. Set up pre/post-build hooks if needed

### 10. Verify & Test

```bash
# Clear cache
nx reset

# Verify project graph
nx graph

# Test builds
nx run-many -t build

# Test affected builds
nx affected -t build

# Run tests
nx run-many -t test
```

### 11. Update CI/CD

- [ ] Ensure .NET SDK 8.0+ is installed in CI environment
- [ ] Update any scripts using `@nx-dotnet/core` generators
- [ ] Verify caching configuration still works
- [ ] Test affected builds in CI

---

## Additional Resources

- [Nx Dotnet Plugin Docs](https://nx.dev/nx-api/dotnet)
- [Nx Conformance](https://nx.dev/concepts/conformance)
- [Central Package Management](https://learn.microsoft.com/nuget/consume-packages/central-package-management)
- [.NET CLI Reference](https://learn.microsoft.com/dotnet/core/tools/)
- [`@nx-dotnet/core` Documentation](https://www.nx-dotnet.com/)

---

## Getting Help

- **Nx Community Discord**: [Join here](https://go.nx.dev/community)
- **GitHub Discussions**: [Nx Discussions](https://github.com/nrwl/nx/discussions)
- **GitHub Issues**: Report bugs at [Nx Repository](https://github.com/nrwl/nx/issues)
