namespace MsbuildAnalyzer.Models;

/// <summary>
/// Result of analyzing a workspace containing .NET projects.
/// </summary>
public record AnalysisResult
{
    /// <summary>
    /// Maps project file path (relative to workspace root) to node configuration.
    /// </summary>
    public Dictionary<string, NxProjectGraphNode> NodesByFile { get; init; } = new();

    /// <summary>
    /// Maps project root (relative to workspace root) to referenced project roots.
    /// </summary>
    public Dictionary<string, ReferencesInfo> ReferencesByRoot { get; init; } = new();

    /// <summary>
    /// Project roots whose targets were derived from C# sources rather than from
    /// project files alone (i.e. projects that produced atomized test targets).
    /// </summary>
    /// <remarks>
    /// The plugin's analyzer cache is keyed on the hash of project files, which
    /// does not change when a test class is added or removed. This list tells
    /// the TypeScript client which roots additionally need their sources hashed;
    /// when it is empty that extra hashing is skipped entirely, so workspaces
    /// that never opt in pay nothing.
    ///
    /// Null rather than empty when unused, so existing serialized output is
    /// unchanged and results cached by an older analyzer still deserialize.
    /// </remarks>
    public List<string>? AtomizedRoots { get; init; }

    /// <summary>
    /// Workspace-relative paths of sources that fed discovery but live outside
    /// their project's directory — linked or shared files.
    /// </summary>
    /// <remarks>
    /// <see cref="AtomizedRoots"/> is hashed by the plugin as a per-root glob,
    /// which cannot reach these. Null rather than empty when there are none, so
    /// the common case adds nothing to the output.
    /// </remarks>
    public List<string>? AtomizedExternalSources { get; init; }
}

public record ReferencesInfo
{
    public List<string> Refs { get; init; } = new();
    public string? SourceConfigFile { get; set; }
}
