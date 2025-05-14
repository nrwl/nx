---
title: Add a New .NET Project
description: Learn how to integrate .NET projects with Nx using the @nx-dotnet/core plugin, including setup, configuration, and leveraging Nx features.
---

# Add a New .NET Project

**Supported Features**

Because we are using an Nx plugin for .NET, all the features of Nx are available.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/getting-started/editor-setup" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}✅ Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Framework Dependencies{% /pill %}

## Install the @nx-dotnet/core Plugin

{% callout type="warning" title="Have .NET already installed?" %}
Make sure you have .NET installed on your machine. Consult the [.NET docs for more details](https://dotnet.microsoft.com/learn/dotnet/hello-world-tutorial/install)
{% /callout %}

{% tabs %}
{%tab label="npm"%}

```shell
npm add -D @nx-dotnet/core
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add -D @nx-dotnet/core
```

{% /tab %}
{%tab label="pnpm"%}

```shell
pnpm add -D @nx-dotnet/core
```

{% /tab %}

{% tab label="bun" %}

```shell
bun add -D @nx-dotnet/core
```

{% /tab %}
{% /tabs %}

## Set up your workspace

Use the `init` generator to scaffold out some root level configuration files.

```shell
nx g @nx-dotnet/core:init
```

This generates the following files:

```json {% fileName=".config/dotnet-tools.json" %}
{
  "version": 1,
  "isRoot": true,
  "tools": {}
}
```

```xml {% fileName="Directory.Build.props" %}
<!--
  This file is imported early in the build order.
  Use it to set default property values that can be overridden in specific projects.
-->
<Project>
  <PropertyGroup>
    <!-- Output path configuration -->
    <RepoRoot>$([System.IO.Path]::GetFullPath('$(MSBuildThisFileDirectory)'))</RepoRoot>
    <ProjectRelativePath>$([MSBuild]::MakeRelative($(RepoRoot), $(MSBuildProjectDirectory)))</ProjectRelativePath>
    <BaseOutputPath>$(RepoRoot)dist/$(ProjectRelativePath)</BaseOutputPath>
    <OutputPath>$(BaseOutputPath)</OutputPath>
    <BaseIntermediateOutputPath>$(RepoRoot)dist/intermediates/$(ProjectRelativePath)/obj</BaseIntermediateOutputPath>
    <IntermediateOutputPath>$(BaseIntermediateOutputPath)</IntermediateOutputPath>
    <AppendTargetFrameworkToOutputPath>true</AppendTargetFrameworkToOutputPath>
  </PropertyGroup>
  <PropertyGroup>
    <RestorePackagesWithLockFile>false</RestorePackagesWithLockFile>
  </PropertyGroup>
</Project>
```

```xml {% fileName="Directory.Build.targets" %}
<!--
  This file is imported late in the build order.
  Use it to override properties and define dependent properties.
-->
<Project>
  <PropertyGroup>
    <MSBuildProjectDirRelativePath>$([MSBuild]::MakeRelative($(RepoRoot), $(MSBuildProjectDirectory)))</MSBuildProjectDirRelativePath>
    <NodeModulesRelativePath>$([MSBuild]::MakeRelative($(MSBuildProjectDirectory), $(RepoRoot)))</NodeModulesRelativePath>
  </PropertyGroup>
  <Target Name="CheckNxModuleBoundaries" BeforeTargets="Build">
    <Exec Command="node $(NodeModulesRelativePath)/node_modules/@nx-dotnet/core/src/tasks/check-module-boundaries.js --project-root &quot;$(MSBuildProjectDirRelativePath)&quot;"/>
  </Target>
</Project>
```

And on Nx versions earlier than 17:

```json {% fileName=".nx-dotnet.rc.json" %}
{
  "nugetPackages": {}
}
```

## Create an Application

Use the `app` generator to create a new .NET app. For this demo, use the `nx` path naming convention and the `web-api` project template.

```shell
nx g @nx-dotnet/core:app my-api --directory=apps/my-api --test-template nunit --language C#
```

Serve the API by running

```shell
nx serve my-api
```

## Create a Library

To create a new library, run the library generator. Use the `classlib` template.

```shell
nx g @nx-dotnet/core:lib dotnet-lib --directory=libs/dotnet-lib
```

We also want to add a project reference from `my-api` to `dotnet-lib` using the `project-reference` generator:

```shell
nx generate @nx-dotnet/core:project-reference --project=my-api --reference=dotnet-lib
```

Now we can move the `WeatherForecast.cs` file out of the `my-api` folder and into the `dotnet-lib` folder. We also need to update the namespace for the file like this:

```c# {% fileName="libs/dotnet-lib/WeatherForecast.cs" %}
namespace DotnetLib;

public class WeatherForecast
{
    public DateOnly Date { get; set; }

    public int TemperatureC { get; set; }

    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);

    public string? Summary { get; set; }
}
```

Now use the `dotnet-lib` version of `WeatherForecast` in `my-api`:

```c# {% fileName="apps/my-api/Controllers/WeatherForecastController.cs" %}
using Microsoft.AspNetCore.Mvc;
using DotnetLib;

namespace MyApi.Controllers;

// the rest of the file is unchanged
```

Now when you serve your api it will use the class from the library.

## More Documentation

- [nx-dotnet](https://www.nx-dotnet.com/)
- [.NET](https://dotnet.microsoft.com/en-us/)
