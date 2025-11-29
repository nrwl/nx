namespace MsbuildAnalyzer.Models;

/// <summary>
/// Represents a target dependency configuration.
/// This mirrors Nx's TargetDependencyConfig type.
/// </summary>
public record TargetDependency
{
    /// <summary>
    /// The name of the target to run.
    /// </summary>
    public required string Target { get; init; }

    /// <summary>
    /// A list of projects that have the target.
    /// Can be a specific project name or "self" for the current project.
    /// </summary>
    public string? Projects { get; init; }

    /// <summary>
    /// If true, the target will be executed for each project that this project depends on.
    /// </summary>
    public bool? Dependencies { get; init; }

    /// <summary>
    /// Whether to forward CLI params to the dependency target.
    /// Use "forward" to pass --runtime and other CLI arguments to dependent targets.
    /// </summary>
    public string? Params { get; init; }
}
