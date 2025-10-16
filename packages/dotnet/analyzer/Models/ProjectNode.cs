namespace MsbuildAnalyzer.Models;

/// <summary>
/// Represents an Nx project node for a .NET project.
/// </summary>
public record ProjectNode
{
    /// <summary>
    /// The Nx project name (kebab-case).
    /// </summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// The project root directory (relative to workspace root).
    /// </summary>
    public string Root { get; init; } = string.Empty;

    /// <summary>
    /// Nx targets available for this project.
    /// </summary>
    public Dictionary<string, Target> Targets { get; init; } = new();

    /// <summary>
    /// Additional metadata about the project.
    /// </summary>
    public ProjectMetadata? Metadata { get; init; }
}
