using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

public class TargetBuilderPublishInputsTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static string ProjectDir(params string[] segments) =>
        Path.Combine(new[] { WorkspaceRoot }.Concat(segments).ToArray());

    private static string DependencyOutputsGlob(Dictionary<string, string> properties, string projectDirectory)
    {
        var targets = TargetBuilder.BuildTargets(
            projectName: "foo",
            fileName: "foo.csproj",
            isTest: false,
            isExe: true,
            packageRefs: new List<PackageReference>(),
            properties: properties,
            projectDirectory: projectDirectory,
            workspaceRoot: WorkspaceRoot,
            options: new PluginOptions(),
            nxJson: null,
            directoryBuildInputs: new List<string>());

        return targets["publish"].Inputs!
            .Select(i => i.GetType().GetProperty("dependentTasksOutputFiles")?.GetValue(i))
            .OfType<string>()
            .Single();
    }

    [Fact]
    public void ExcludesThePublishDirAtEveryConfigurationAndThePublishFileList()
    {
        var properties = new Dictionary<string, string>
        {
            ["Configuration"] = "Debug",
            ["PublishDir"] = "bin\\Debug\\net8.0\\publish\\",
        };

        Assert.Equal(
            "!{apps/foo/bin/*/net8.0/publish/**,apps/foo/obj/**/PublishOutputs.*.txt}",
            DependencyOutputsGlob(properties, ProjectDir("apps", "foo")));
    }

    [Fact]
    public void ProjectAtTheWorkspaceRoot_UsesUnprefixedPaths()
    {
        var properties = new Dictionary<string, string>
        {
            ["Configuration"] = "Debug",
            ["PublishDir"] = "bin\\Debug\\publish\\",
        };

        Assert.Equal(
            "!{bin/*/publish/**,obj/**/PublishOutputs.*.txt}",
            DependencyOutputsGlob(properties, WorkspaceRoot));
    }

    [Fact]
    public void LeavesALiteralReleaseDirectoryAlone()
    {
        var properties = new Dictionary<string, string>
        {
            ["Configuration"] = "Debug",
            ["PublishDir"] = "out\\Release\\Debug\\",
        };

        Assert.Equal(
            "!{apps/foo/out/Release/*/**,apps/foo/obj/**/PublishOutputs.*.txt}",
            DependencyOutputsGlob(properties, ProjectDir("apps", "foo")));
    }

    [Fact]
    public void HonoursACustomPublishCleanFile()
    {
        var properties = new Dictionary<string, string>
        {
            ["Configuration"] = "Debug",
            ["PublishDir"] = "bin\\Debug\\publish\\",
            ["PublishCleanFile"] = "published-files.txt",
        };

        Assert.Equal(
            "!{apps/foo/bin/*/publish/**,apps/foo/obj/**/published-files.txt}",
            DependencyOutputsGlob(properties, ProjectDir("apps", "foo")));
    }

    [Fact]
    public void ArtifactsLayout_ExcludesTheWorkspaceRootPublishDir()
    {
        var artifactsRoot = Path.Combine(WorkspaceRoot, "artifacts");
        var properties = new Dictionary<string, string>
        {
            ["UseArtifactsOutput"] = "true",
            ["ArtifactsPath"] = artifactsRoot,
            ["ArtifactsProjectName"] = "foo",
            ["MSBuildProjectName"] = "foo",
            ["BaseOutputPath"] = Path.Combine(artifactsRoot, "bin", "foo") + Path.DirectorySeparatorChar,
            ["BaseIntermediateOutputPath"] = Path.Combine(artifactsRoot, "obj", "foo") + Path.DirectorySeparatorChar,
        };

        Assert.Equal(
            "!{artifacts/publish/foo/**,artifacts/obj/foo/**/PublishOutputs.*.txt}",
            DependencyOutputsGlob(properties, ProjectDir("apps", "foo")));
    }

    [Fact]
    public void DropsAPathThatContainsGlobSyntax()
    {
        var properties = new Dictionary<string, string>
        {
            ["Configuration"] = "Debug",
            ["PublishDir"] = "bin\\[x]\\publish\\",
        };

        Assert.Equal(
            "!apps/foo/obj/**/PublishOutputs.*.txt",
            DependencyOutputsGlob(properties, ProjectDir("apps", "foo")));
    }
}
