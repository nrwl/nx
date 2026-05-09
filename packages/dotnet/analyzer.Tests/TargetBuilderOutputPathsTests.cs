using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for <see cref="TargetBuilder.BuildTargets"/> output path
/// computation. These exercise the scenarios reported in
/// https://github.com/nrwl/nx/issues/33971:
///
///  1. The original bug: Microsoft.NET.Sdk.Web projects evaluate
///     BaseIntermediateOutputPath to an absolute path, and the analyzer
///     previously emitted "{projectRoot}/&lt;ProjectName&gt;/obj".
///
///  2. The follow-up reported in the thread: repositories that set a
///     centralized "dist/" folder via Directory.Build.props (paths resolve
///     above the project directory) must use {workspaceRoot}-relative outputs
///     rather than {projectRoot}.
///
/// The tests drive the analyzer's pure-logic path via property dictionaries
/// that mirror what MSBuild would hand back, avoiding the cost of spinning up
/// a full MSBuild evaluation.
/// </summary>
public class TargetBuilderOutputPathsTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static string ProjectDir(params string[] segments) =>
        Path.Combine(new[] { WorkspaceRoot }.Concat(segments).ToArray());

    private static Dictionary<string, Target> BuildTargets(
        Dictionary<string, string> properties,
        string projectDirectory,
        string projectName = "MyProj",
        bool isExe = false,
        bool isTest = false) =>
        TargetBuilder.BuildTargets(
            projectName: projectName,
            fileName: $"{projectName}.csproj",
            isTest: isTest,
            isExe: isExe,
            packageRefs: new List<PackageReference>(),
            properties: properties,
            projectDirectory: projectDirectory,
            workspaceRoot: WorkspaceRoot,
            options: new PluginOptions(),
            nxJson: null);

    // --- Original #33971: Microsoft.NET.Sdk.Web ---------------------------

    [Fact]
    public void Build_WebSdk_WithAbsoluteBaseIntermediatePath_EmitsProjectRootObj()
    {
        // Microsoft.NET.Sdk.Web runs BaseIntermediateOutputPath through
        // [MSBuild]::NormalizePath, producing an absolute path anchored at
        // the project directory. BaseOutputPath stays relative.
        var projectDirectory = ProjectDir("MyWebApi");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = projectDirectory + Path.DirectorySeparatorChar + "obj" + Path.DirectorySeparatorChar,
        };

        var targets = BuildTargets(properties, projectDirectory);

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_Sdk_WithRelativeDefaults_EmitsProjectRootBinAndObj()
    {
        var projectDirectory = ProjectDir("MyLibrary");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
        };

        var targets = BuildTargets(properties, projectDirectory);

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_WebSdk_DoesNotDoubleCountProjectDirectory()
    {
        // Regression guard for the exact shape reported in #33971.
        var projectDirectory = ProjectDir("MyWebApp");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = Path.Combine(projectDirectory, "obj") + Path.DirectorySeparatorChar,
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "MyWebApp");

        Assert.DoesNotContain(
            targets["build"].Outputs!,
            o => o.Contains("MyWebApp/obj") || o.Contains("MyWebApp\\obj"));
    }

    // --- Follow-up: centralized dist via Directory.Build.props ------------

    [Fact]
    public void Build_CentralizedDist_EmitsWorkspaceRootRelativeOutputs()
    {
        // Directory.Build.props configuration modeled after nx-dotnet:
        //   <BaseOutputPath>$(MSBuildThisFileDirectory)dist/$(MSBuildProjectName)/bin/</BaseOutputPath>
        //   <BaseIntermediateOutputPath>$(MSBuildThisFileDirectory)dist/intermediates/$(MSBuildProjectName)/obj/</BaseIntermediateOutputPath>
        // After MSBuild evaluation these are absolute paths rooted at the
        // workspace root, not the project directory.
        var projectDirectory = ProjectDir("apps", "foo");
        var distBin = Path.Combine(WorkspaceRoot, "dist", "foo", "bin") + Path.DirectorySeparatorChar;
        var distObj = Path.Combine(WorkspaceRoot, "dist", "intermediates", "foo", "obj") + Path.DirectorySeparatorChar;

        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = distBin,
            ["BaseIntermediateOutputPath"] = distObj,
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[]
            {
                "{workspaceRoot}/dist/foo/bin",
                "{workspaceRoot}/dist/intermediates/foo/obj",
            },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_PartialRedirect_MixesProjectRootAndWorkspaceRoot()
    {
        // Only the obj tree is redirected; bin stays at the project default.
        var projectDirectory = ProjectDir("apps", "foo");
        var distObj = Path.Combine(WorkspaceRoot, "dist", "intermediates", "foo", "obj") + Path.DirectorySeparatorChar;

        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = distObj,
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[]
            {
                "{projectRoot}/bin",
                "{workspaceRoot}/dist/intermediates/foo/obj",
            },
            targets["build"].Outputs);
    }

    // --- Sanity: SDK artifacts layout -------------------------------------

    [Fact]
    public void Build_ArtifactsOutput_EmitsWorkspaceRootOutputs()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["UseArtifactsOutput"] = "true",
            // ArtifactsPath defaults to "artifacts" relative to workspace root.
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[]
            {
                "{workspaceRoot}/artifacts/bin/foo",
                "{workspaceRoot}/artifacts/obj/foo",
            },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_ArtifactsOutput_WithCustomArtifactsPath_EmitsWorkspaceRootOutputs()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["UseArtifactsOutput"] = "true",
            ["ArtifactsPath"] = Path.Combine(WorkspaceRoot, "build-output"),
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[]
            {
                "{workspaceRoot}/build-output/bin/foo",
                "{workspaceRoot}/build-output/obj/foo",
            },
            targets["build"].Outputs);
    }
}
