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
        bool isTest = false,
        List<string>? directoryBuildInputs = null) =>
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
            nxJson: null,
            directoryBuildInputs: directoryBuildInputs ?? new List<string>());

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

    // --- OpenApiDocumentsDirectory: the generated document is a build output --

    [Fact]
    public void Build_WithoutOpenApiDocumentsDirectory_LeavesOutputsUnchanged()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiDocumentsDirectoryInsideProject_EmitsProjectRootRelativeOutput()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = "openapi",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{projectRoot}/openapi/foo.json", "{projectRoot}/openapi/foo_*.json" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiDocumentsDirectoryFromMSBuildProjectDirectory_EmitsProjectRootRelativeOutput()
    {
        // <OpenApiDocumentsDirectory>$(MSBuildProjectDirectory)/openapi</OpenApiDocumentsDirectory>
        // evaluates to an absolute path anchored at the project directory,
        // which must still tokenize as {projectRoot}.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = Path.Combine(projectDirectory, "openapi"),
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{projectRoot}/openapi/foo.json", "{projectRoot}/openapi/foo_*.json" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiDocumentsDirectoryOutsideProject_EmitsWorkspaceRootRelativeOutput()
    {
        // OpenApiDocumentsDirectory is a plain MSBuild property and can point
        // anywhere, for example at a shared contracts folder consumed by a
        // TypeScript codegen target elsewhere in the workspace.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = Path.Combine(WorkspaceRoot, "contracts", "foo"),
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{workspaceRoot}/contracts/foo/foo.json", "{workspaceRoot}/contracts/foo/foo_*.json" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiDocumentsDirectoryAtProjectRoot_EmitsDocumentGlobNotDirectory()
    {
        // The ASP.NET Core docs recommend `.` to emit the document beside the
        // project file. The whole project directory must not become an output.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = ".",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{projectRoot}/foo.json", "{projectRoot}/foo_*.json" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiDocumentsDirectoryAtAbsoluteProjectRoot_EmitsDocumentGlobNotDirectory()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = projectDirectory,
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{projectRoot}/foo.json", "{projectRoot}/foo_*.json" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiDocumentsDirectoryRelativeAboveProject_EmitsWorkspaceRootRelativeOutput()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = "../contracts",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{workspaceRoot}/apps/contracts/foo.json", "{workspaceRoot}/apps/contracts/foo_*.json" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiDocumentsDirectoryOutsideWorkspace_IsDropped()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = Path.Combine(Path.GetTempPath(), "outside-ws", "openapi"),
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiDocumentsDirectoryAtPackageDefault_DoesNotDuplicateObj()
    {
        // Microsoft.Extensions.ApiDescription.Server.props defaults the property
        // to $(BaseIntermediateOutputPath), so merely referencing the package
        // makes it "set". That must not emit obj a second time.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = "obj\\",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj" },
            targets["build"].Outputs);
    }

    [Fact]
    public void BuildRelease_OpenApiDocumentsDirectory_EmitsSameOutputAsBuild()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = "openapi",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{projectRoot}/openapi/foo.json", "{projectRoot}/openapi/foo_*.json" },
            targets["build:release"].Outputs);
    }

    [Fact]
    public void Publish_OpenApiDocumentsDirectory_IsNotAddedToNonBuildTargets()
    {
        // Only `build` writes the document; publish/pack/test must be untouched.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["OpenApiDocumentsDirectory"] = "openapi",
        };

        var exeTargets = BuildTargets(properties, projectDirectory, projectName: "foo", isExe: true);
        var libTargets = BuildTargets(properties, projectDirectory, projectName: "foo");
        var testTargets = BuildTargets(properties, projectDirectory, projectName: "foo", isTest: true);

        Assert.Equal(
            new[] { "{projectRoot}/bin/publish", "{projectRoot}/obj" },
            exeTargets["publish"].Outputs);
        Assert.Equal(
            new[] { "{projectRoot}/bin/*.nupkg", "{projectRoot}/obj" },
            libTargets["pack"].Outputs);
        Assert.Equal(
            new[] { "{projectRoot}/TestResults" },
            testTargets["test"].Outputs);
    }

    [Fact]
    public void Build_OpenApiGenerateDocumentsOptionsWithoutFileName_UsesProjectNameStem()
    {
        // --openapi-version and --document-name do not change the stem: the
        // document name is a suffix the glob's `*` already covers.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = "openapi",
            ["OpenApiGenerateDocumentsOptions"] = "--openapi-version v3.1 --document-name internal",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{projectRoot}/openapi/foo.json", "{projectRoot}/openapi/foo_*.json" },
            targets["build"].Outputs);
    }

    [Fact]
    public void Build_OpenApiGenerateDocumentsOptionsFileName_OverridesProjectNameStem()
    {
        // --file-name replaces the stem dotnet-getdocument writes under, so the
        // project-name glob would match nothing.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = "openapi",
            ["OpenApiGenerateDocumentsOptions"] = "--file-name PublicApi",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", "{projectRoot}/openapi/PublicApi.json", "{projectRoot}/openapi/PublicApi_*.json" },
            targets["build"].Outputs);
    }

    [Theory]
    [InlineData("--file-name PublicApi", "PublicApi")]
    [InlineData("--file-name=PublicApi", "PublicApi")]
    [InlineData("--file-name:PublicApi", "PublicApi")]
    [InlineData("--openapi-version v3.1 --file-name PublicApi", "PublicApi")]
    [InlineData("--file-name \"PublicApi\"", "PublicApi")]
    [InlineData("--file-name Public-Api_v2", "Public-Api_v2")]
    public void Build_OpenApiFileNameOption_IsReadInEverySpelling(string options, string expectedStem)
    {
        // The package appends $(OpenApiGenerateDocumentsOptions) to the command
        // verbatim, and the tool's parser accepts all three separators. It
        // rejects values outside [A-Za-z0-9_-], so - and _ are the only extras.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["BaseOutputPath"] = "bin\\",
            ["BaseIntermediateOutputPath"] = "obj\\",
            ["OpenApiDocumentsDirectory"] = "openapi",
            ["OpenApiGenerateDocumentsOptions"] = options,
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin", "{projectRoot}/obj", $"{{projectRoot}}/openapi/{expectedStem}.json", $"{{projectRoot}}/openapi/{expectedStem}_*.json" },
            targets["build"].Outputs);
    }

    // --- Publish output: configuration is rewritten to match the target -----

    [Fact]
    public void Publish_RewritesEvaluatedDebugPublishDirToRelease()
    {
        // MSBuild evaluates PublishDir at the default (Debug) configuration, but
        // the publish target runs --configuration Release. The declared output
        // must point at bin/Release/publish (where the publish actually lands),
        // not the evaluated bin/Debug/publish.
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["PublishDir"] = "bin\\Debug\\publish\\",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo", isExe: true);

        Assert.Equal(
            new[] { "{projectRoot}/bin/Release/publish", "{projectRoot}/obj" },
            targets["publish"].Outputs);
    }

    [Fact]
    public void Publish_LeavesCustomPublishDirWithoutConfigurationSegmentAlone()
    {
        // A custom PublishDir that has no Debug/Release segment is passed through
        // unchanged (only configuration segments are rewritten).
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["PublishDir"] = "dist-publish",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo", isExe: true);

        Assert.Equal(
            new[] { "{projectRoot}/dist-publish", "{projectRoot}/obj" },
            targets["publish"].Outputs);
    }

    [Fact]
    public void Publish_ArtifactsLayout_EmitsWorkspaceRootPublishPath()
    {
        var projectDirectory = ProjectDir("apps", "foo");
        var properties = new Dictionary<string, string>
        {
            ["UseArtifactsOutput"] = "true",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo", isExe: true);

        Assert.Equal(
            new[] { "{workspaceRoot}/artifacts/publish/foo", "{workspaceRoot}/artifacts/obj/foo" },
            targets["publish"].Outputs);
    }

    // --- Pack output: nupkg glob plus the intermediate (obj) directory ------

    [Fact]
    public void Pack_EmitsNupkgGlobAndIntermediateObj()
    {
        // `dotnet pack` writes the .nupkg into the package output directory and
        // intermediate state into obj, so both must be declared as outputs.
        var projectDirectory = ProjectDir("libs", "foo");

        var targets = BuildTargets(properties: new Dictionary<string, string>(), projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{projectRoot}/bin/*.nupkg", "{projectRoot}/obj" },
            targets["pack"].Outputs);
    }

    [Fact]
    public void Pack_ArtifactsLayout_EmitsWorkspaceRootPackageAndObjPaths()
    {
        var projectDirectory = ProjectDir("libs", "foo");
        var properties = new Dictionary<string, string>
        {
            ["UseArtifactsOutput"] = "true",
        };

        var targets = BuildTargets(properties, projectDirectory, projectName: "foo");

        Assert.Equal(
            new[] { "{workspaceRoot}/artifacts/package/*.nupkg", "{workspaceRoot}/artifacts/obj/foo" },
            targets["pack"].Outputs);
    }
}
