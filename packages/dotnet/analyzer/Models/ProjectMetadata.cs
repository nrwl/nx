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
    /// Evaluated package identity and per-target-framework facts under <c>metadata.dotnet</c>.
    /// </summary>
    public DotnetProjectMetadata? Dotnet { get; init; }
}
