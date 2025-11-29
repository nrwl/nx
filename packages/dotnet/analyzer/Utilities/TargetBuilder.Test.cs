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
        string workspaceRoot,
        PluginOptions options,
        string productionInput)
    {
        // TODO(@AgentEnder): We should add this back in after external deps
        // support is fleshed out.
        //
        // var externalDeps = packageRefs.Select(p => p.Include).ToArray();
        var testResultsDir = GetTestResultsDirectory(properties, projectName, workspaceRoot);

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        string[] defaultFlags = ["--no-build", "--no-restore"];

        targets[options.TestTargetName] = new Target
        {
            Command = "dotnet test",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = [.. defaultFlags]
            },
            DependsOn = [new TargetDependency { Target = options.BuildTargetName, Params = "forward", Options = "forward" }],
            Cache = true,
            Inputs =
            [
                "default",
                $"^{productionInput}",
                // new { externalDependencies = externalDeps }
            ],
            Outputs = [$"{outputPrefix}/{testResultsDir}"],
            Metadata = new TargetMetadata
            {
                Description = "Run .NET tests",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }
}
