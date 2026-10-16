namespace MsbuildAnalyzer.Models;

/// <summary>
/// Metadata about a .NET project.
/// </summary>
public record ProjectMetadata
{
    /// <summary>
    /// Technologies used by this project (e.g., "dotnet", "csharp", "test").
    /// </summary>
    public List<string> Technologies { get; init; } = new();

    /// <summary>
    /// Named groups of related target names, used to collapse a long list of
    /// atomized targets into one expandable entry in Nx Console and the graph
    /// UI. The group's no-op parent is listed first.
    /// </summary>
    /// <remarks>
    /// Null (rather than empty) when the project has no groups, so that it is
    /// omitted from the serialized output entirely.
    /// </remarks>
    public Dictionary<string, List<string>>? TargetGroups { get; init; }
}
