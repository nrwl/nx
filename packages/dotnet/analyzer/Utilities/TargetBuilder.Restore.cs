using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Restore target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddRestoreTarget(
        Dictionary<string, Target> targets,
        string fileName,
        PluginOptions options)
    {
        var targetName = options.RestoreTargetName;
        targets[targetName] = new Target
        {
            Command = "dotnet restore",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = ["--no-dependencies"]
            },
            DependsOn = [new TargetDependency { Target = $"^{targetName}", Params = "forward", Options = "forward" }],
            Metadata = new TargetMetadata
            {
                Description = "Restore .NET project dependencies",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
