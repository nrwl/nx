using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Publish target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddPublishTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        bool isTest,
        Dictionary<string, string> properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput,
        List<string> directoryBuildInputs)
    {
        // The configuration MSBuild evaluated the paths at; the target runs at Release.
        var defaultConfiguration = properties.GetValueOrDefault("Configuration");
        var releaseProperties = WithConfiguration(properties, "Release");

        var publishDir = GetPublishDir(releaseProperties, defaultConfiguration, projectDirectory, workspaceRoot);
        // `dotnet publish` writes incremental-publish state (e.g.
        // obj/<Configuration>/PublishOutputs.<hash>.txt) into the intermediate
        // (obj) directory, so it must be declared as an output alongside the
        // publish directory, mirroring the build target.
        var intermediatePath = GetIntermediateOutputPath(releaseProperties, projectDirectory, workspaceRoot);

        string[] defaultFlags = ["--no-build", "--no-dependencies", "--no-restore"];

        var buildReleaseTarget = $"{options.BuildTargetName}:release";
        targets[options.PublishTargetName] = new Target
        {
            Command = "dotnet publish",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = [.. defaultFlags, "--configuration", "Release"]
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
            DependsOn = [buildReleaseTarget],
            Cache = true,
            Inputs =
            [
                "default",
                $"^{productionInput}",
                "{workspaceRoot}/.editorconfig",
                new { workingDirectory = "absolute" },
                new { dependentTasksOutputFiles = "**/*" },
                .. directoryBuildInputs
            ],
            Outputs = new[] { publishDir, intermediatePath }
                .Where(p => p is not null)
                .ToArray()!,
            Metadata = new TargetMetadata
            {
                Description = "Publish the .NET application",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
