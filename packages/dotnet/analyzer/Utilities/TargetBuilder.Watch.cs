using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Watch target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddWatchTarget(
        Dictionary<string, Target> targets,
        string fileName,
        PluginOptions options)
    {
        targets[options.WatchTargetName] = new Target
        {
            Command = "dotnet watch",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}"
            },
            DependsOn = [new TargetDependency { Target = options.RestoreTargetName, Params = "forward" }],
            Cache = false,
            Continuous = true,
            Metadata = new TargetMetadata
            {
                Description = "Watch for changes and rebuild/rerun the .NET project",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
