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

    /// <summary>
    /// The unqualified target this variant derives from (e.g. "build"). Lets the
    /// plugin apply the user's configuration for that base target to its
    /// variants, and remove the variants when the base target is disabled. Only
    /// set on framework-specific target variants.
    /// </summary>
    public string? FrameworkVariantOf { get; init; }
}
