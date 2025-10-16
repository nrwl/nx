<p style="text-align: center;">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-dark.svg">
    <img alt="Nx - Smart Repos · Fast Builds" src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-light.svg" width="100%">
  </picture>
</p>

{{links}}

<hr>

# Nx: Smart Repos · Fast Builds

Get to green PRs in half the time. Nx optimizes your builds, scales your CI, and fixes failed PRs. Built for developers and AI agents.

## Build .NET with Nx

The goal of `@nx/dotnet` is to make it easy and straightforward to build .NET applications in an Nx workspace. It provides intelligent project graph analysis, automatic dependency detection, and smart target configuration using MSBuild.

### Getting Started

#### Step 1: Add the .NET plugin to your Nx workspace

```bash
nx add @nx/dotnet
```

#### Step 2: Configure the plugin in your `nx.json`

```json
{
  "plugins": ["@nx/dotnet"]
}
```

#### Step 3: Create your .NET projects

```bash
# Create a console application
dotnet new console -n MyApp

# Create a class library
dotnet new classlib -n MyLibrary

# Create a test project
dotnet new xunit -n MyApp.Tests
```

The plugin will automatically detect your .NET projects and configure appropriate Nx targets.

#### Step 4: Run Build, Test, and other commands

```bash
# Build a project
nx build my-app

# Run tests
nx test my-app-tests

# Build with Release configuration
nx build my-app --configuration Release

# Create a NuGet package
nx pack my-library

# Publish an application
nx publish my-app
```

{{content}}
