namespace MsbuildAnalyzer.Models;

/// <summary>
/// A NuGet package a project depends on, with the version MSBuild resolved for it. Under
/// Central Package Management the version lives on a PackageVersion item rather than the
/// PackageReference.
/// </summary>
public record ResolvedPackage
{
    /// <summary>
    /// The package id, e.g. "Serilog".
    /// </summary>
    public string Id { get; init; } = string.Empty;

    /// <summary>
    /// The resolved version, e.g. "4.0.0".
    /// </summary>
    public string Version { get; init; } = string.Empty;
}
