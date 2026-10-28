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
    /// Every workspace file MSBuild read while evaluating the projects, relative to the
    /// workspace root. The plugin hashes these to decide whether a cached analysis is
    /// still valid; it cannot know them up front, since an arbitrary import is only
    /// discovered by evaluating.
    /// </summary>
    public List<string> EvaluationInputs { get; init; } = new();
}

public record ReferencesInfo
{
    public List<string> Refs { get; init; } = new();
    public string? SourceConfigFile { get; set; }
}
