namespace MsbuildAnalyzer.Models;

/// <summary>
/// What test discovery found, and what it deliberately left out.
/// </summary>
/// <remarks>
/// The exclusion counts exist so the analyzer can say so. A test class that
/// silently gets no target of its own is the one failure mode of this feature
/// that is invisible from the outside — the tests still run under the ordinary
/// test target, so nothing fails, and CI just quietly stops covering them in
/// the split run.
/// </remarks>
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
    /// The plugin invalidates its cache by hashing each atomized project's
    /// sources, which it does with a glob rooted at the project. Discovery reads
    /// MSBuild's <c>Compile</c> items instead, and those can point anywhere, so
    /// a linked test file would change the discovered units without changing
    /// that hash. Reporting the strays lets the plugin hash them too.
    /// </remarks>
    public List<string> ExternalSources { get; init; } = [];

    public static TestDiscoveryResult Empty => new() { Units = [] };
}
