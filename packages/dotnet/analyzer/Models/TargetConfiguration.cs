namespace MsbuildAnalyzer.Models;

/// <summary>
/// Represents a configuration variant of a target (e.g., Debug, Release).
/// </summary>
public record TargetConfiguration
{
    /// <summary>
    /// Options that override or extend the base target options for this configuration.
    /// </summary>
    public TargetOptions? Options { get; init; }
}
