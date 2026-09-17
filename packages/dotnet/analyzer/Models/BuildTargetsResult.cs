namespace MsbuildAnalyzer.Models;

/// <summary>
/// Everything target construction produces for one project. These are
/// project-level facts, only known once every target has been built, so they
/// cannot live on <see cref="Target"/>.
/// </summary>
public sealed record BuildTargetsResult
{
    public required Dictionary<string, Target> Targets { get; init; }

    /// <summary>
    /// Named groups of related target names, or null when the project has none.
    /// </summary>
    public Dictionary<string, List<string>>? TargetGroups { get; init; }

    /// <summary>
    /// Whether any target was derived from the project's C# sources rather than
    /// from its project file alone. Drives the source-hash half of the plugin's
    /// analyzer cache key.
    /// </summary>
    public bool DerivedFromSources { get; init; }

    /// <summary>
    /// Workspace-relative paths of scanned sources outside the project
    /// directory, which the plugin's per-project glob would otherwise miss.
    /// </summary>
    public List<string> ExternalSources { get; init; } = [];
}
