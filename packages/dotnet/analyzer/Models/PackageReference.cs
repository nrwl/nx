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
    /// The package version.
    /// </summary>
    public string? Version { get; init; }
}
