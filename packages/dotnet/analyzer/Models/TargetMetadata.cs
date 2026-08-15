namespace MsbuildAnalyzer.Models;

/// <summary>
/// Metadata about a target.
/// </summary>
public record TargetMetadata
{
    /// <summary>
    /// Human-readable description of what the target does.
    /// </summary>
    public string? Description { get; init; }

    /// <summary>
    /// Technologies used by this target.
    /// </summary>
    public List<string>? Technologies { get; init; }

    /// <summary>
    /// The evaluated target framework this target invocation is scoped to
    /// (e.g. "net10.0-ios"). Only set on framework-specific target variants;
    /// left null (and omitted from JSON) for the unqualified targets.
    /// </summary>
    public string? TargetFramework { get; init; }
}
