namespace MsbuildAnalyzer.Models;

/// <summary>
/// Metadata about a target.
/// </summary>
public record TargetMetadata
{
    public string? TargetFramework { get; init; }

    public string? VariantOf { get; init; }

    /// <summary>
    /// Human-readable description of what the target does.
    /// </summary>
    public string? Description { get; init; }

    /// <summary>
    /// Technologies used by this target.
    /// </summary>
    public List<string>? Technologies { get; init; }
}
