using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Build target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    /// <summary>
    /// Shared helper method to create build targets (both debug and release variants).
    /// </summary>
    private static Target CreateBuildTarget(
        string targetName,
        string fileName,
        string projectName,
        Dictionary<string, string> properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput,
        string defaultConfiguration,
        string description)
    {
        var outputPath = GetOutputPath(properties, projectName, projectDirectory, workspaceRoot);
        var intermediatePath = GetIntermediateOutputPath(properties, projectName, projectDirectory, workspaceRoot);
        string[] defaultFlags = ["--no-restore", "--no-dependencies"];

        var defaultArgs = defaultConfiguration == "Release"
            ? [.. defaultFlags, "--configuration", "Release"]
            : defaultFlags;

        return new Target
        {
            Command = "dotnet build",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = defaultArgs
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["debug"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Debug"]
                },
                ["release"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Release"]
                }
            },
            DependsOn = [$"^{targetName}"],
            Cache = true,
            Inputs =
            [
                productionInput,
                $"^{productionInput}",
                "{workspaceRoot}/.editorconfig",
                new { workingDirectory = "absolute" },
                new { dependentTasksOutputFiles = "**/*" },
            ],
            Outputs = new[] { outputPath, intermediatePath }
                .Where(p => p is not null)
                .ToArray()!,
            Metadata = new TargetMetadata
            {
                Description = description,
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }

    private static void AddBuildTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        bool isTest,
        Dictionary<string, string> properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput)
    {
        var targetName = options.BuildTargetName;
        targets[targetName] = CreateBuildTarget(
            targetName,
            fileName,
            projectName,
            properties,
            projectDirectory,
            workspaceRoot,
            options,
            productionInput,
            "Debug",
            "Build the .NET project");
    }

    private static void AddBuildReleaseTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        bool isTest,
        Dictionary<string, string> properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput)
    {
        var releaseTargetName = $"{options.BuildTargetName}:release";
        targets[releaseTargetName] = CreateBuildTarget(
            releaseTargetName,
            fileName,
            projectName,
            properties,
            projectDirectory,
            workspaceRoot,
            options,
            productionInput,
            "Release",
            "Build the .NET project in Release configuration");
    }
}
