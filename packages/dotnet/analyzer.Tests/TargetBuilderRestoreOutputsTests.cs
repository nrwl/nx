using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// restore runs outside the task chain and is not cached, so the files only it
/// writes into obj must not be outputs of build, publish or pack. Otherwise a
/// cache hit replays another machine's project.assets.json, absolute packages
/// path and all, over the local restore. The obj entry is a glob rather than a
/// bare directory because of how Nx hashes dependent outputs: a bare directory
/// is walked wholesale with nothing subtracted, and a negated literal path is
/// walked as its own root and added back, so the exclusions are wildcards that
/// partition to obj.
/// </summary>
public class TargetBuilderRestoreOutputsTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static readonly string[] RestoreOnlyExclusions =
    [
        "!{projectRoot}/obj/**/project.assets.json",
        "!{projectRoot}/obj/**/project.nuget.cache",
        "!{projectRoot}/obj/**/project.packagespec.json",
        "!{projectRoot}/obj/**/*.nuget.dgspec.json",
        "!{projectRoot}/obj/**/*.nuget.g.props",
        "!{projectRoot}/obj/**/*.nuget.g.targets",
    ];

    private static Dictionary<string, Target> BuildTargets(bool isExe, Dictionary<string, string>? properties = null) =>
        TargetBuilder.BuildTargets(
            projectName: "MyProj",
            fileName: "MyProj.csproj",
            isTest: false,
            isExe: isExe,
            packageRefs: new List<PackageReference>(),
            properties: properties ?? new Dictionary<string, string>(),
            projectDirectory: Path.Combine(WorkspaceRoot, "apps", "MyProj"),
            workspaceRoot: WorkspaceRoot,
            options: new PluginOptions(),
            nxJson: null,
            directoryBuildInputs: new List<string>());

    [Theory]
    [InlineData("build", false)]
    [InlineData("build:release", false)]
    [InlineData("pack", false)]
    [InlineData("publish", true)]
    public void ObjOutputs_ExcludeRestoreOnlyFiles(string targetName, bool isExe)
    {
        var outputs = BuildTargets(isExe)[targetName].Outputs!;

        Assert.Contains("{projectRoot}/obj/**/*", outputs);
        Assert.DoesNotContain("{projectRoot}/obj", outputs);
        foreach (var exclusion in RestoreOnlyExclusions)
        {
            Assert.Contains(exclusion, outputs);
        }
    }

    [Fact]
    public void ObjOutputs_ExclusionsFollowARelocatedIntermediatePath()
    {
        var properties = new Dictionary<string, string>
        {
            ["BaseIntermediateOutputPath"] = Path.Combine(WorkspaceRoot, "dist", "obj", "MyProj") + Path.DirectorySeparatorChar,
        };

        var outputs = BuildTargets(isExe: false, properties)["build"].Outputs!;

        Assert.Contains("{workspaceRoot}/dist/obj/MyProj/**/*", outputs);
        Assert.Contains("!{workspaceRoot}/dist/obj/MyProj/**/project.assets.json", outputs);
        Assert.Contains("!{workspaceRoot}/dist/obj/MyProj/**/*.nuget.g.props", outputs);
        Assert.DoesNotContain("!{projectRoot}/obj/**/project.assets.json", outputs);
    }
}
