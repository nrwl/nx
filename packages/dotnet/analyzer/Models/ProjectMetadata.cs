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
}
