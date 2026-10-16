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
    /// Set on the no-op parent of an atomized target group, naming the ordinary
    /// (non-split) target that runs the same tests in one task. Nx core keys the
    /// Nx Cloud requirement, .env resolution and target-defaults matching off it.
    /// </summary>
    public string? NonAtomizedTarget { get; init; }
}
