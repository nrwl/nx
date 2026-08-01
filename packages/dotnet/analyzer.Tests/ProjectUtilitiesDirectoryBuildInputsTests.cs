using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for <see cref="ProjectUtilities.GetDirectoryBuildInputs"/>. The function
/// walks ancestors of a project file and returns the closest existing occurrence of each
/// canonical Directory.* filename — mirroring MSBuild's "first ancestor wins" import rule
/// for Directory.Build.props/.targets/.rsp, Directory.Solution.{props,targets}, and
/// Directory.Packages.props. Inputs are returned as "{workspaceRoot}/..."-prefixed paths
/// so Nx hashes the right files for sandboxed task execution.
/// </summary>
public class ProjectUtilitiesDirectoryBuildInputsTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    /// <summary>
    /// Build the directory→filenames index the same way Analyzer.AnalyzeWorkspace does
    /// when it sees Directory.* files come in over stdin (workspace-root-relative paths,
    /// forward-slashed; "." denotes the workspace root itself).
    /// </summary>
    private static Dictionary<string, HashSet<string>> IndexByDir(params string[] relativePaths)
    {
        var index = new Dictionary<string, HashSet<string>>();
        foreach (var rel in relativePaths)
        {
            var normalized = rel.Replace('\\', '/');
            var lastSlash = normalized.LastIndexOf('/');
            var dir = lastSlash < 0 ? "." : normalized.Substring(0, lastSlash);
            var name = lastSlash < 0 ? normalized : normalized.Substring(lastSlash + 1);
            if (!index.TryGetValue(dir, out var set))
            {
                set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                index[dir] = set;
            }
            set.Add(name);
        }
        return index;
    }

    private static string ProjectPath(params string[] segments) =>
        Path.Combine(new[] { WorkspaceRoot }.Concat(segments).ToArray());

    [Fact]
    public void ReturnsEmpty_WhenNoDirectoryFilesIndexed()
    {
        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("apps", "foo", "foo.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: new Dictionary<string, HashSet<string>>());

        Assert.Empty(inputs);
    }

    [Fact]
    public void ReturnsWorkspaceRootFile_WhenOnlyRootHasOne()
    {
        var index = IndexByDir("Directory.Build.props");

        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("apps", "foo", "foo.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: index);

        Assert.Equal(new[] { "{workspaceRoot}/Directory.Build.props" }, inputs);
    }

    [Fact]
    public void ClosestAncestorWins_PerFileName()
    {
        // The same filename exists at two depths. MSBuild stops at the first
        // ancestor it finds (closest to the project), so we should too.
        var index = IndexByDir(
            "Directory.Build.props",
            "apps/Directory.Build.props");

        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("apps", "foo", "foo.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: index);

        Assert.Equal(new[] { "{workspaceRoot}/apps/Directory.Build.props" }, inputs);
    }

    [Fact]
    public void DifferentFileNames_PickedUpFromDifferentAncestors()
    {
        // props sits at the project directory, targets only exists at the root.
        // Each filename is resolved independently to its own closest ancestor.
        var index = IndexByDir(
            "apps/foo/Directory.Build.props",
            "Directory.Build.targets");

        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("apps", "foo", "foo.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: index);

        Assert.Contains("{workspaceRoot}/apps/foo/Directory.Build.props", inputs);
        Assert.Contains("{workspaceRoot}/Directory.Build.targets", inputs);
        Assert.Equal(2, inputs.Count);
    }

    [Fact]
    public void ProjectAtWorkspaceRoot_FindsRootLevelFiles()
    {
        // A project file living at the workspace root still needs its sibling
        // Directory.* files declared as inputs.
        var index = IndexByDir(
            "Directory.Build.props",
            "Directory.Packages.props");

        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("root.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: index);

        Assert.Contains("{workspaceRoot}/Directory.Build.props", inputs);
        Assert.Contains("{workspaceRoot}/Directory.Packages.props", inputs);
        Assert.Equal(2, inputs.Count);
    }

    [Fact]
    public void MissingIntermediateAncestor_IsTransparentlySkipped()
    {
        // Project at apps/foo/bar/bar.csproj with files only at the workspace root
        // and at apps/foo (gap at apps/foo/bar and apps/). The walk should keep
        // climbing past empty levels rather than stopping at the first one.
        var index = IndexByDir(
            "apps/foo/Directory.Build.targets",
            "Directory.Build.props");

        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("apps", "foo", "bar", "bar.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: index);

        Assert.Contains("{workspaceRoot}/apps/foo/Directory.Build.targets", inputs);
        Assert.Contains("{workspaceRoot}/Directory.Build.props", inputs);
        Assert.Equal(2, inputs.Count);
    }

    [Fact]
    public void OnlyCanonicalFileNames_ArePicked()
    {
        // The index could theoretically contain extra entries (e.g. an unrelated
        // file in the same directory). The walker should ignore anything that
        // isn't in the canonical list.
        var index = IndexByDir(
            "Directory.Build.props",
            "Directory.Build.targets",
            "Directory.Build.rsp",
            "Directory.Solution.props",
            "Directory.Solution.targets",
            "Directory.Packages.props",
            "Directory.NotRecognized.props");

        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("apps", "foo", "foo.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: index);

        Assert.Equal(6, inputs.Count);
        Assert.DoesNotContain(
            inputs,
            i => i.Contains("Directory.NotRecognized.props"));
    }

    [Fact]
    public void AllSixCanonicalFileNames_AreSupportedAtSameDirectory()
    {
        var index = IndexByDir(
            "Directory.Build.props",
            "Directory.Build.targets",
            "Directory.Build.rsp",
            "Directory.Solution.props",
            "Directory.Solution.targets",
            "Directory.Packages.props");

        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("apps", "foo", "foo.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: index);

        Assert.Contains("{workspaceRoot}/Directory.Build.props", inputs);
        Assert.Contains("{workspaceRoot}/Directory.Build.targets", inputs);
        Assert.Contains("{workspaceRoot}/Directory.Build.rsp", inputs);
        Assert.Contains("{workspaceRoot}/Directory.Solution.props", inputs);
        Assert.Contains("{workspaceRoot}/Directory.Solution.targets", inputs);
        Assert.Contains("{workspaceRoot}/Directory.Packages.props", inputs);
    }

    [Fact]
    public void StopsWalkingOnceAllFileNamesFound()
    {
        // Every canonical filename exists at the project's own directory. The
        // walker should NOT continue to ancestors and pick up shadowed copies.
        var index = IndexByDir(
            "apps/foo/Directory.Build.props",
            "apps/foo/Directory.Build.targets",
            "apps/foo/Directory.Build.rsp",
            "apps/foo/Directory.Solution.props",
            "apps/foo/Directory.Solution.targets",
            "apps/foo/Directory.Packages.props",
            // These ancestors should be shadowed and NOT included:
            "apps/Directory.Build.props",
            "Directory.Build.props");

        var inputs = ProjectUtilities.GetDirectoryBuildInputs(
            projectPath: ProjectPath("apps", "foo", "foo.csproj"),
            workspaceRoot: WorkspaceRoot,
            filesByDir: index);

        Assert.All(inputs, i => Assert.StartsWith("{workspaceRoot}/apps/foo/", i));
        Assert.Equal(6, inputs.Count);
    }
}
