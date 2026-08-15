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
    /// Structured, evaluated .NET metadata for this project (project-level capabilities plus
    /// per-target-framework facts). Namespaced under <c>dotnet</c> to avoid colliding with other
    /// technologies' metadata on the same project. Null for non-.NET projects.
    /// </summary>
    public DotnetProjectMetadata? Dotnet { get; init; }
}
