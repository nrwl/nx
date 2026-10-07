using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// The test target runs with cwd at the project root, so a `results-directory`
/// option is resolved by dotnet relative to the project directory. The declared
/// output has to carry the same prefix or Nx looks for it under the workspace root.
/// </summary>
public class TargetBuilderTestResultsOutputTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static Target TestTarget() =>
        TargetBuilder.BuildTargets(
            projectName: "MyProj.Tests",
            fileName: "MyProj.Tests.csproj",
            isTest: true,
            isExe: false,
            packageRefs: new List<PackageReference>(),
            properties: new Dictionary<string, string>(),
            projectDirectory: Path.Combine(WorkspaceRoot, "apps", "MyProj.Tests"),
            workspaceRoot: WorkspaceRoot,
            options: new PluginOptions(),
            nxJson: null,
            directoryBuildInputs: new List<string>())["test"];

    [Fact]
    public void Test_DeclaresProjectRelativeResultsDirectoryOptionOutput()
    {
        Assert.Contains("{projectRoot}/{options.results-directory}", TestTarget().Outputs!);
    }

    [Fact]
    public void Test_KeepsDefaultTestResultsOutput()
    {
        Assert.Contains("{projectRoot}/TestResults", TestTarget().Outputs!);
    }
}
