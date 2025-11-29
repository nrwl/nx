using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Pack target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddPackTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
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

        var packageOutputPath = GetPackageOutputPath(releaseProperties, projectName, workspaceRoot);

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        var buildReleaseTarget = $"{options.BuildTargetName}:release";
        targets[options.PackTargetName] = new Target
        {
            Command = "dotnet pack",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = ["--no-dependencies", "--no-build", "--configuration", "Release"]
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["debug"] = new TargetConfiguration
                {
                    Args = ["--no-dependencies", "--no-build", "--configuration", "Debug"]
                },
                ["release"] = new TargetConfiguration
                {
                    Args = ["--no-dependencies", "--no-build", "--configuration", "Release"]
                }
            },
            DependsOn = [new TargetDependency { Target = buildReleaseTarget, Params = "forward", Options = "forward" }],
            Cache = true,
            Inputs = ["default", $"^{productionInput}"],
            Outputs = [$"{outputPrefix}/{packageOutputPath}/*.nupkg"],
            Metadata = new TargetMetadata
            {
                Description = "Create NuGet package",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
