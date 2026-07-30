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
    /// The Nx executor to run instead of a shell command (e.g., "nx:noop").
    /// Mutually exclusive with <see cref="Command"/>.
    /// </summary>
    public string? Executor { get; init; }

    /// <summary>
    /// Options for executing the command.
    /// </summary>
    public TargetOptions? Options { get; init; }

    /// <summary>
    /// Configuration variants for this target (e.g., Debug, Release).
    /// </summary>
    public Dictionary<string, TargetConfiguration>? Configurations { get; init; }

    /// <summary>
    /// Other targets this target depends on. Elements are either a bare target
    /// name (<see cref="string"/>) or a <see cref="TargetDependency"/> when the
    /// dependency needs params/options forwarding.
    /// </summary>
    /// <remarks>
    /// Declared as <c>object[]</c> rather than a union type because
    /// System.Text.Json serializes <c>object</c>-declared values using their
    /// runtime type, which produces exactly the mixed array Nx expects.
    /// </remarks>
    public object[]? DependsOn { get; init; }

    /// <summary>
    /// Whether this target should be cached.
    /// </summary>
    public bool? Cache { get; init; }

    /// <summary>
    /// Whether this target runs continuously.
    /// </summary>
    public bool? Continuous { get; init; }

    /// <summary>
    /// Whether Nx may run this target concurrently with other tasks on the same
    /// machine. Set to <c>false</c> for atomized leaves whose tests declare
    /// <c>[DoNotParallelize]</c>, or that contend for machine-wide resources.
    /// </summary>
    public bool? Parallelism { get; init; }

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
