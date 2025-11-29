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
        string workspaceRoot,
        PluginOptions options,
        string productionInput)
    {
        // Create a copy of properties with Configuration=Release
        var releaseProperties = new Dictionary<string, string>(properties)
        {
            ["Configuration"] = "Release"
        };

        var publishDir = GetPublishDir(releaseProperties, projectName, workspaceRoot);

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

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
            DependsOn = [new TargetDependency { Target = buildReleaseTarget, Params = "forward", Options = "forward" }],
            Cache = true,
            Inputs = ["default", $"^{productionInput}"],
            Outputs = [$"{outputPrefix}/{publishDir}"],
            Metadata = new TargetMetadata
            {
                Description = "Publish the .NET application",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
