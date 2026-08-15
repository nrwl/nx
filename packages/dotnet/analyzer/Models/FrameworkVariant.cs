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

    /// <summary>
    /// Whether this specific inner build is an executable, per the plugin's
    /// existing <c>IsExecutableProject</c> rule (evaluated <c>OutputType</c> equal
    /// to <c>Exe</c>; <c>WinExe</c> is not recognized, matching the unqualified
    /// publish/run targets). Evaluated per framework because <c>OutputType</c> can
    /// be conditioned on <c>TargetFramework</c>, so one framework of a project can
    /// be an app while another is a library. Gates per-RID publish variants, which
    /// only make sense for executables.
    /// </summary>
    public bool IsExecutable { get; init; }

    /// <summary>
    /// The runtime identifiers evaluated for this framework. The plural
    /// <c>RuntimeIdentifiers</c> is authoritative when non-empty; otherwise the
    /// evaluated singular <c>RuntimeIdentifier</c> is used, which for platform
    /// frameworks may be an SDK default rather than an authored value. Empty when
    /// neither is set.
    /// </summary>
    public List<string> RuntimeIdentifiers { get; init; } = new();
}
