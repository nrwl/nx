using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests verifying that the per-project Directory.* input list passed into
/// <see cref="TargetBuilder.BuildTargets"/> is appended to the Inputs of every
/// cacheable .NET target (build, build:release, test, publish, pack) while leaving
/// targets without an Inputs array (restore, clean, watch, run) untouched.
///
/// The intent is to lock in two pieces of behavior:
///   1. The analyzer is the single place where these inputs are written, so plugin
///      callers don't have to think about per-target injection.
///   2. We don't accidentally narrow Nx's default-input fallback for non-cacheable
///      targets, in case a user later enables caching on them via plugin options.
/// </summary>
public class TargetBuilderDirectoryBuildInputsTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static string ProjectDir(params string[] segments) =>
        Path.Combine(new[] { WorkspaceRoot }.Concat(segments).ToArray());

    private static Dictionary<string, Target> BuildTargets(
        bool isExe,
        bool isTest,
        List<string>? directoryBuildInputs = null,
        Dictionary<string, string>? properties = null) =>
        TargetBuilder.BuildTargets(
            projectName: "MyProj",
            fileName: "MyProj.csproj",
            isTest: isTest,
            isExe: isExe,
            packageRefs: new List<PackageReference>(),
            properties: properties ?? new Dictionary<string, string>(),
            projectDirectory: ProjectDir("apps", "MyProj"),
            workspaceRoot: WorkspaceRoot,
            options: new PluginOptions(),
            nxJson: null,
            directoryBuildInputs: directoryBuildInputs ?? new List<string>());

    private static IEnumerable<string> StringInputs(Target t) =>
        t.Inputs?.OfType<string>() ?? Enumerable.Empty<string>();

    [Fact]
    public void BuildAndBuildRelease_AppendDirectoryBuildInputs()
    {
        var directoryBuildInputs = new List<string>
        {
            "{workspaceRoot}/Directory.Build.props",
            "{workspaceRoot}/apps/Directory.Build.targets",
        };

        var targets = BuildTargets(isExe: false, isTest: false, directoryBuildInputs: directoryBuildInputs);

        Assert.Contains("{workspaceRoot}/Directory.Build.props", StringInputs(targets["build"]));
        Assert.Contains("{workspaceRoot}/apps/Directory.Build.targets", StringInputs(targets["build"]));
        Assert.Contains("{workspaceRoot}/Directory.Build.props", StringInputs(targets["build:release"]));
        Assert.Contains("{workspaceRoot}/apps/Directory.Build.targets", StringInputs(targets["build:release"]));
    }

    [Fact]
    public void TestTarget_AppendsDirectoryBuildInputs()
    {
        var directoryBuildInputs = new List<string>
        {
            "{workspaceRoot}/Directory.Packages.props",
        };

        var targets = BuildTargets(isExe: false, isTest: true, directoryBuildInputs: directoryBuildInputs);

        Assert.Contains("{workspaceRoot}/Directory.Packages.props", StringInputs(targets["test"]));
    }

    [Fact]
    public void PublishTarget_AppendsDirectoryBuildInputs_WhenIsExe()
    {
        var directoryBuildInputs = new List<string>
        {
            "{workspaceRoot}/Directory.Build.props",
        };

        var targets = BuildTargets(isExe: true, isTest: false, directoryBuildInputs: directoryBuildInputs);

        Assert.Contains("{workspaceRoot}/Directory.Build.props", StringInputs(targets["publish"]));
    }

    [Fact]
    public void PackTarget_AppendsDirectoryBuildInputs_WhenLibrary()
    {
        var directoryBuildInputs = new List<string>
        {
            "{workspaceRoot}/Directory.Build.props",
        };

        var targets = BuildTargets(isExe: false, isTest: false, directoryBuildInputs: directoryBuildInputs);

        Assert.Contains("{workspaceRoot}/Directory.Build.props", StringInputs(targets["pack"]));
    }

    [Fact]
    public void Restore_Clean_Watch_HaveNoInputsArray()
    {
        // These targets don't declare Inputs today, and we explicitly want to keep
        // it that way so Nx's "default named input" fallback applies if a user
        // turns caching on for them via plugin options.
        var directoryBuildInputs = new List<string>
        {
            "{workspaceRoot}/Directory.Build.props",
        };

        var targets = BuildTargets(isExe: false, isTest: false, directoryBuildInputs: directoryBuildInputs);

        Assert.Null(targets["restore"].Inputs);
        Assert.Null(targets["clean"].Inputs);
        Assert.Null(targets["watch"].Inputs);
    }

    [Fact]
    public void RunTarget_HasNoInputsArray_WhenIsExe()
    {
        var directoryBuildInputs = new List<string>
        {
            "{workspaceRoot}/Directory.Build.props",
        };

        var targets = BuildTargets(isExe: true, isTest: false, directoryBuildInputs: directoryBuildInputs);

        Assert.Null(targets["run"].Inputs);
    }

    [Fact]
    public void EmptyDirectoryBuildInputs_LeavesExistingInputsIntact()
    {
        // No Directory.* files for this project. The base inputs the analyzer
        // always emits (productionInput, ^productionInput, .editorconfig, etc.)
        // must still be there.
        var targets = BuildTargets(isExe: false, isTest: false, directoryBuildInputs: new List<string>());

        var buildInputs = StringInputs(targets["build"]).ToList();
        Assert.Contains("default", buildInputs);
        Assert.Contains("^default", buildInputs);
        Assert.Contains("{workspaceRoot}/.editorconfig", buildInputs);
        // No Directory.* files leaked in.
        Assert.DoesNotContain(buildInputs, i => i.Contains("Directory."));
    }

    [Fact]
    public void DirectoryBuildInputs_AreAppendedAfterBaseInputs()
    {
        // Ordering matters less for correctness than for human readability, but
        // we want the Directory.* paths to live at the tail of the array so the
        // existing "default" / "^production" / "{workingDirectory}" entries stay
        // visually near the top. Lock that in.
        var directoryBuildInputs = new List<string>
        {
            "{workspaceRoot}/Directory.Build.props",
        };

        var targets = BuildTargets(isExe: false, isTest: false, directoryBuildInputs: directoryBuildInputs);

        var inputs = targets["build"].Inputs!;
        var lastInput = inputs[^1] as string;
        Assert.Equal("{workspaceRoot}/Directory.Build.props", lastInput);
    }
}
