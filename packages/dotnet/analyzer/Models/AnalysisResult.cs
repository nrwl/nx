namespace MsbuildAnalyzer.Models;

/// <summary>
/// Result of analyzing a workspace containing .NET projects.
/// </summary>
public record AnalysisResult
{
    /// <summary>
    /// Maps project file path (relative to workspace root) to node configuration.
    /// </summary>
    public Dictionary<string, ProjectNode> NodesByFile { get; init; } = new();

    /// <summary>
    /// Maps project root (relative to workspace root) to referenced project roots.
    /// </summary>
    public Dictionary<string, ReferencesInfo> ReferencesByRoot { get; init; } = new();
}

public record ReferencesInfo
{
    public List<string> Refs { get; init; } = new();
    public string? SourceConfigFile { get; set; }
}
