using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Test target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddTestTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        List<PackageReference> packageRefs,
        Dictionary<string, string> properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput)
    {
        // TODO(@AgentEnder): We should add this back in after external deps
        // support is fleshed out.
        //
        // var externalDeps = packageRefs.Select(p => p.Include).ToArray();
        var testResultsDir = GetTestResultsDirectory(properties, projectName, projectDirectory, workspaceRoot);

        string[] defaultFlags = ["--no-build", "--no-restore"];

        targets[options.TestTargetName] = new Target
        {
            Command = "dotnet test",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = [.. defaultFlags]
            },
            DependsOn = [options.BuildTargetName],
            Cache = true,
            Inputs =
            [
                "default",
                $"^{productionInput}",
                "{workspaceRoot}/.editorconfig",
                new { workingDirectory = "absolute" },
                new { dependentTasksOutputFiles = "**/*" },
                // new { externalDependencies = externalDeps }
            ],
            Outputs = testResultsDir is null ? [] : [testResultsDir],
            Metadata = new TargetMetadata
            {
                Description = "Run .NET tests",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
