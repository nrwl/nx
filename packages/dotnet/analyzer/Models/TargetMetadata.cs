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
    /// (non-split) target that runs the same tests in one task.
    /// </summary>
    /// <remarks>
    /// Nx core keys three behaviors off this: refusing to run atomized tasks
    /// without Nx Cloud, resolving .env files as though the non-atomized target
    /// were running, and target-defaults glob matching.
    /// </remarks>
    public string? NonAtomizedTarget { get; init; }
}
