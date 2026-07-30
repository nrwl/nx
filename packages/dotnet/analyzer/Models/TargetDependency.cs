namespace MsbuildAnalyzer.Models;

/// <summary>
/// An entry in a target's <c>dependsOn</c> array that needs more than a bare
/// target name.
/// </summary>
/// <remarks>
/// A plain string dependency swallows flags typed on the parent, so atomized
/// targets use the <c>forward</c> forms to reach every leaf.
/// </remarks>
public record TargetDependency
{
    /// <summary>
    /// The name of the target being depended on.
    /// </summary>
    public string Target { get; init; } = string.Empty;

    /// <summary>
    /// Set to <c>"forward"</c> to pass the parent's parsed params down to this
    /// dependency.
    /// </summary>
    public string? Params { get; init; }

    /// <summary>
    /// Set to <c>"forward"</c> to pass the parent's options down to this
    /// dependency.
    /// </summary>
    public string? Options { get; init; }
}
