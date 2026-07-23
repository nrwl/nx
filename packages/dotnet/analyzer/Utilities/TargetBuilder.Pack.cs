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
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput,
        List<string> directoryBuildInputs)
    {
        // Create a copy of properties with Configuration=Release
        var releaseProperties = new Dictionary<string, string>(properties)
        {
            ["Configuration"] = "Release"
        };

        var packageOutputPath = GetPackageOutputPath(releaseProperties, projectName, projectDirectory, workspaceRoot);
        // `dotnet pack` writes intermediate state into the intermediate (obj)
        // directory, so it must be declared as an output alongside the package
        // output, mirroring the build target.
        var intermediatePath = GetIntermediateOutputPath(releaseProperties, projectName, projectDirectory, workspaceRoot);

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
            // Forward CLI params and task options (e.g. --runtime) to build:release so
            // the package is produced from a build against the requested runtime.
            DependsOn = [new TargetDependency { Target = buildReleaseTarget, Params = "forward", Options = "forward" }],
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
            Outputs = new[]
                {
                    packageOutputPath is null ? null : $"{packageOutputPath.TrimEnd('/')}/*.nupkg",
                    intermediatePath
                }
                .Where(p => p is not null)
                .ToArray()!,
            Metadata = new TargetMetadata
            {
                Description = "Create NuGet package",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
