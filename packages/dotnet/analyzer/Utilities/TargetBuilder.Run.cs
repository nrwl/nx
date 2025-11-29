using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Run target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddRunTarget(
        Dictionary<string, Target> targets,
        string fileName,
        PluginOptions options)
    {
        string[] defaultFlags = ["--no-build"];

        targets[options.RunTargetName] = new Target
        {
            Command = "dotnet run",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = defaultFlags
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
            DependsOn = [new TargetDependency { Target = options.BuildTargetName, Params = "forward", Options = "forward" }],
            Cache = false,
            Metadata = new TargetMetadata
            {
                Description = "Run the .NET application",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
