namespace MsbuildAnalyzer.Models;

/// <summary>
/// Capabilities describing what operations a project (or one evaluated target framework of a
/// multi-targeted project) supports. These overlap rather than being mutually exclusive — a
/// project can be both a test project and packable, for example.
/// </summary>
public record DotnetCapabilities
{
    /// <summary>
    /// True when the project opts in via <c>IsTestProject</c> or references the test SDK/platform
    /// packages (<c>Microsoft.NET.Test.Sdk</c>, <c>Microsoft.Testing.*</c>) — the same signal the
    /// analyzer uses to decide whether to emit a <c>test</c> target.
    /// </summary>
    public bool Test { get; init; }

    /// <summary>
    /// True when the evaluated <c>OutputType</c> is <c>Exe</c> — the same signal the analyzer
    /// uses to decide whether to emit <c>publish</c>/<c>run</c> targets.
    /// </summary>
    public bool Executable { get; init; }

    /// <summary>
    /// True when the evaluated <c>IsPackable</c> property allows <c>dotnet pack</c> to produce a
    /// NuGet package. The SDK's packaging targets default this to <c>true</c>, so an unevaluated
    /// value is treated as packable.
    /// </summary>
    public bool Packable { get; init; }

    /// <summary>
    /// True when the evaluated <c>IsPublishable</c> property allows <c>dotnet publish</c> to
    /// produce output. Falls back to <see cref="Executable"/> when unevaluated, since the SDK
    /// otherwise defaults <c>IsPublishable</c> based on whether the project produces an exe
    /// (and explicitly turns it off for test projects).
    /// </summary>
    public bool Publishable { get; init; }

    /// <summary>
    /// True when the evaluated <c>PackAsTool</c> property packages this project as a .NET tool.
    /// </summary>
    public bool Tool { get; init; }
}

/// <summary>
/// Evaluated MSBuild facts for a single target framework of a project — one MSBuild "inner
/// build" node. Multi-targeted projects (<c>TargetFrameworks</c>) contribute one entry per
/// framework; single-targeted projects contribute exactly one.
/// </summary>
public record DotnetTargetFrameworkMetadata
{
    /// <summary>
    /// The evaluated NuGet package identity for this target framework: the evaluated
    /// <c>PackageId</c> property, falling back to <c>AssemblyName</c> when unset (matching the
    /// NuGet packaging SDK's own default resolution), or <c>null</c> if neither is evaluated.
    /// </summary>
    public string? PackageId { get; init; }

    /// <summary>The evaluated <c>TargetFramework</c> short name (e.g. "net9.0", "net9.0-ios").</summary>
    public string TargetFramework { get; init; } = string.Empty;

    /// <summary>The evaluated <c>TargetFrameworkIdentifier</c> (e.g. ".NETCoreApp").</summary>
    public string? TargetFrameworkIdentifier { get; init; }

    /// <summary>The evaluated <c>TargetFrameworkVersion</c> (e.g. "v9.0").</summary>
    public string? TargetFrameworkVersion { get; init; }

    /// <summary>
    /// The evaluated <c>TargetPlatformIdentifier</c> (e.g. "ios", "android", "windows"), for
    /// target frameworks that target a platform (e.g. "net9.0-ios").
    /// </summary>
    public string? TargetPlatformIdentifier { get; init; }

    /// <summary>The evaluated <c>TargetPlatformVersion</c>, set alongside <see cref="TargetPlatformIdentifier"/>.</summary>
    public string? TargetPlatformVersion { get; init; }

    /// <summary>The evaluated single <c>RuntimeIdentifier</c> for this target framework, if set.</summary>
    public string? RuntimeIdentifier { get; init; }

    /// <summary>The evaluated <c>RuntimeIdentifiers</c> list for this target framework (multi-RID publish), if set.</summary>
    public List<string> RuntimeIdentifiers { get; init; } = new();

    /// <summary>Capabilities evaluated for this specific target framework.</summary>
    public DotnetCapabilities Capabilities { get; init; } = new();
}

/// <summary>
/// Structured, evaluated .NET metadata for a project (<c>metadata.dotnet</c>): project-scoped
/// capabilities aggregated across every evaluated target framework, plus the per-framework
/// facts they were derived from. Built from the analyzer's already-grouped MSBuild inner-build
/// nodes — this is intentionally a small, stable model rather than a mirror of every MSBuild
/// property.
/// </summary>
public record DotnetProjectMetadata
{
    /// <summary>
    /// The project's evaluated NuGet package identity, set only when every evaluated target
    /// framework agrees on it (see <see cref="DotnetTargetFrameworkMetadata.PackageId"/>).
    /// <c>null</c> when no target framework evaluates one, or when they disagree — e.g. a
    /// conditional <c>PackageId</c> that varies per <c>TargetFramework</c> — since a single
    /// project-level value would misrepresent one of the frameworks. Consult each entry in
    /// <see cref="TargetFrameworks"/> for the per-framework identity in that case.
    /// </summary>
    public string? PackageId { get; init; }

    /// <summary>
    /// Project-level capabilities: true if any evaluated target framework has the capability.
    /// </summary>
    public DotnetCapabilities Capabilities { get; init; } = new();

    /// <summary>
    /// Evaluated facts for each target framework, in <c>TargetFrameworks</c> declaration order.
    /// </summary>
    public List<DotnetTargetFrameworkMetadata> TargetFrameworks { get; init; } = new();
}
