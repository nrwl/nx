using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Which projects get <c>publish</c> and <c>run</c>. Test projects evaluate to
/// OutputType=Exe, since Microsoft.NET.Test.Sdk sets it on .NET Core and MTP
/// runners set it themselves, but they are not applications.
/// </summary>
public class TargetBuilderExecutableTargetsTests
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

    [Fact]
    public void Executable_GetsPublishAndRun()
    {
        var targets = BuildTargets(isExe: true, isTest: false);

        Assert.Contains("publish", targets.Keys);
        Assert.Contains("run", targets.Keys);
    }

    [Fact]
    public void ExecutableTestProject_GetsNoPublishOrRun()
    {
        var targets = BuildTargets(isExe: true, isTest: true);

        Assert.Contains("test", targets.Keys);
        Assert.DoesNotContain("publish", targets.Keys);
        Assert.DoesNotContain("run", targets.Keys);
    }
}
