using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Clean target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddCleanTarget(Dictionary<string, Target> targets, string fileName, bool isTest, PluginOptions options)
    {
        targets[options.CleanTargetName] = new Target
        {
            Command = "dotnet clean",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}"
            },
            Cache = false,
            Metadata = new TargetMetadata
            {
                Description = "Clean build artifacts",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
