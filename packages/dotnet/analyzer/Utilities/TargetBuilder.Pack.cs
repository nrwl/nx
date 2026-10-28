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
        EvaluatedProperties properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput,
        List<string> directoryBuildInputs)
    {
        // The configuration MSBuild evaluated the paths at; the target runs at Release.
        var defaultConfiguration = properties.Configuration;
        var releaseProperties = properties.WithConfiguration("Release");

        var packageOutputPath = GetPackageOutputPath(releaseProperties, defaultConfiguration, projectDirectory, workspaceRoot);
        // `dotnet pack` writes intermediate state into the intermediate (obj)
        // directory, so it must be declared as an output alongside the package
        // output, mirroring the build target.
        var intermediatePath = GetIntermediateOutputPath(releaseProperties, projectDirectory, workspaceRoot);

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
            DependsOn = [buildReleaseTarget],
            Cache = true,
            Inputs =
            [
                "default",
                $"^{productionInput}",
                new { workingDirectory = "absolute" },
                new { dependentTasksOutputFiles = "**/*" },
                new { env = "NUGET_PACKAGES" },
                .. directoryBuildInputs
            ],
            Outputs = new[]
                {
                    packageOutputPath is null ? null : $"{packageOutputPath.TrimEnd('/')}/*.nupkg",
                }
                .Where(p => p is not null)
                .Concat(GetIntermediateOutputs(intermediatePath))
                .ToArray()!,
            Metadata = new TargetMetadata
            {
                Description = "Create NuGet package",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
