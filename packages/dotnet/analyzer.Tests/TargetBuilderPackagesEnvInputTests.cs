using System.Text.Json;
using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// obj/project.assets.json embeds the absolute packages folder, so every target
/// that consumes it depends on NUGET_PACKAGES. Two agents with different values
/// must not share a hash.
/// </summary>
public class TargetBuilderPackagesEnvInputTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static Dictionary<string, Target> BuildTargets(bool isExe, bool isTest) =>
        TargetBuilder.BuildTargets(
            projectName: "MyProj",
            fileName: "MyProj.csproj",
            isTest: isTest,
            isExe: isExe,
            packageRefs: new List<PackageReference>(),
            properties: new Dictionary<string, string>(),
            projectDirectory: Path.Combine(WorkspaceRoot, "apps", "MyProj"),
            workspaceRoot: WorkspaceRoot,
            options: new PluginOptions(),
            nxJson: null,
            directoryBuildInputs: new List<string>());

    private static bool HasEnvInput(Target target, string name) =>
        target.Inputs!.Any(input => JsonSerializer.Serialize(input) == $"{{\"env\":\"{name}\"}}");

    [Theory]
    [InlineData("build", false, false)]
    [InlineData("build:release", false, false)]
    [InlineData("pack", false, false)]
    [InlineData("test", false, true)]
    [InlineData("publish", true, false)]
    public void CacheableTargets_HashNugetPackagesEnv(string targetName, bool isExe, bool isTest)
    {
        var targets = BuildTargets(isExe, isTest);

        Assert.True(HasEnvInput(targets[targetName], "NUGET_PACKAGES"), $"{targetName} lacks the NUGET_PACKAGES env input");
    }

    [Fact]
    public void Restore_DeclaresNoInputs()
    {
        Assert.Null(BuildTargets(isExe: false, isTest: false)["restore"].Inputs);
    }
}
