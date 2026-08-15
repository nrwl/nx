namespace MsbuildAnalyzer.Models;

/// <summary>
/// Describes one evaluated inner build of a multi-targeted project. The
/// analyzer builds one of these per target framework from the MSBuild
/// <c>ProjectGraph</c> inner nodes, so <see cref="Properties"/> holds the
/// framework-specific evaluated values (e.g. an <c>OutputPath</c> that already
/// includes the framework segment) rather than the outer-build aggregate.
/// </summary>
public sealed record FrameworkVariant
{
    /// <summary>
    /// The evaluated target framework short name (e.g. "net10.0-ios"). Passed
    /// verbatim to <c>--framework</c>, so it must match the declared value.
    /// </summary>
    public required string TargetFramework { get; init; }

    /// <summary>
    /// MSBuild properties evaluated for this specific inner build. These are
    /// framework-scoped, so output/intermediate paths already resolve to the
    /// framework's subdirectory.
    /// </summary>
    public required Dictionary<string, string> Properties { get; init; }
}
