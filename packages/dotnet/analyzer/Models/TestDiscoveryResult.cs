namespace MsbuildAnalyzer.Models;

/// <summary>
/// What test discovery found, and what it deliberately left out.
/// </summary>
public sealed record TestDiscoveryResult
{
    public required List<TestUnit> Units { get; init; }

    /// <summary>
    /// Test classes nested inside another type. Excluded because the platform's
    /// encoding of nested type names in a filter is unconfirmed.
    /// </summary>
    public int SkippedNested { get; init; }

    /// <summary>
    /// Generic test classes, and (in method mode) generic test methods. Excluded
    /// because their names are mangled in both filter syntaxes.
    /// </summary>
    public int SkippedGeneric { get; init; }

    /// <summary>
    /// Workspace-relative paths of scanned sources that lie outside the project
    /// directory — linked files, shared sources, anything a
    /// <c>&lt;Compile Include="../..." /&gt;</c> pulls in.
    /// </summary>
    /// <remarks>
    /// The plugin hashes each atomized project with a glob rooted at the
    /// project, which cannot reach these, so they are reported to be hashed
    /// separately.
    /// </remarks>
    public List<string> ExternalSources { get; init; } = [];

    public static TestDiscoveryResult Empty => new() { Units = [] };
}
