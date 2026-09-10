using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// MSBuild hands back absolute paths for imports and item includes. Only the
/// ones outside the project directory need declaring: the project's own files
/// are already covered by the {projectRoot} input, and SDK files are outside
/// the workspace, where Nx cannot hash them.
/// </summary>
public class ProjectUtilitiesEvaluatedInputsTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");
    private static readonly string ProjectDirectory = Path.Combine(WorkspaceRoot, "apps", "foo");

    private static string Ws(params string[] segments) =>
        Path.Combine(new[] { WorkspaceRoot }.Concat(segments).ToArray());

    [Fact]
    public void SharedInputs_KeepsWorkspaceFilesOutsideTheProjectDirectory()
    {
        var inputs = ProjectUtilities.GetSharedInputs(
            ProjectDirectory,
            WorkspaceRoot,
            new[] { Ws("build", "Common.Build.props"), Ws("shared", "Shared.cs") });

        Assert.Equal(
            new[] { "{workspaceRoot}/build/Common.Build.props", "{workspaceRoot}/shared/Shared.cs" },
            inputs);
    }

    [Fact]
    public void SharedInputs_DropsFilesUnderTheProjectDirectory()
    {
        var inputs = ProjectUtilities.GetSharedInputs(
            ProjectDirectory,
            WorkspaceRoot,
            new[] { Path.Combine(ProjectDirectory, "foo.csproj"), Path.Combine(ProjectDirectory, "build", "local.props") });

        Assert.Empty(inputs);
    }

    [Fact]
    public void SharedInputs_DropsFilesOutsideTheWorkspace()
    {
        var sdk = Path.Combine(Path.GetTempPath(), "dotnet-sdk", "Microsoft.Common.props");

        Assert.Empty(ProjectUtilities.GetSharedInputs(ProjectDirectory, WorkspaceRoot, new[] { sdk }));
    }

    [Fact]
    public void SharedInputs_DeduplicatesAndSorts()
    {
        var inputs = ProjectUtilities.GetSharedInputs(
            ProjectDirectory,
            WorkspaceRoot,
            new[] { Ws("shared", "Z.cs"), Ws("build", "A.props"), Ws("shared", "Z.cs") });

        Assert.Equal(new[] { "{workspaceRoot}/build/A.props", "{workspaceRoot}/shared/Z.cs" }, inputs);
    }

    [Fact]
    public void WorkspaceRelativePaths_KeepsEveryWorkspaceFileIncludingTheProjectsOwn()
    {
        var paths = ProjectUtilities.GetWorkspaceRelativePaths(
            WorkspaceRoot,
            new[]
            {
                Path.Combine(ProjectDirectory, "foo.csproj"),
                Ws("build", "Common.Build.props"),
                Path.Combine(Path.GetTempPath(), "dotnet-sdk", "Microsoft.Common.props"),
            });

        Assert.Equal(new[] { "apps/foo/foo.csproj", "build/Common.Build.props" }, paths);
    }
}
