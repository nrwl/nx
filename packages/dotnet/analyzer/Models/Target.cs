namespace MsbuildAnalyzer.Models;

/// <summary>
/// Represents an Nx target that can be executed.
/// </summary>
public record Target
{
    /// <summary>
    /// The command to execute (e.g., "dotnet build").
    /// </summary>
    public string? Command { get; init; }

    /// <summary>
    /// Options for executing the command.
    /// </summary>
    public TargetOptions? Options { get; init; }

    /// <summary>
    /// Configuration variants for this target (e.g., Debug, Release).
    /// </summary>
    public Dictionary<string, TargetConfiguration>? Configurations { get; init; }

    /// <summary>
    /// The default configuration to use when none is specified.
    /// </summary>
    public string? DefaultConfiguration { get; init; }

    /// <summary>
    /// Other targets this target depends on.
    /// </summary>
    public string[]? DependsOn { get; init; }

    /// <summary>
    /// Whether this target should be cached.
    /// </summary>
    public bool? Cache { get; init; }

    /// <summary>
    /// Input patterns for cache invalidation.
    /// </summary>
    public object[]? Inputs { get; init; }

    /// <summary>
    /// Output patterns for caching.
    /// </summary>
    public string[]? Outputs { get; init; }

    /// <summary>
    /// Additional metadata about the target.
    /// </summary>
    public TargetMetadata? Metadata { get; init; }
}
