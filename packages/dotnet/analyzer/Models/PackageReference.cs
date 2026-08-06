namespace MsbuildAnalyzer.Models;

/// <summary>
/// Represents a NuGet package reference.
/// </summary>
public record PackageReference
{
    /// <summary>
    /// The package name.
    /// </summary>
    public string Include { get; init; } = string.Empty;

    /// <summary>
    /// The package version. Empty under Central Package Management, where the version is
    /// sourced from a PackageVersion item instead.
    /// </summary>
    public string? Version { get; init; }

    /// <summary>
    /// A per-project override of the centrally managed version. Takes precedence over both
    /// Version and the matching PackageVersion item.
    /// </summary>
    public string? VersionOverride { get; init; }
}
