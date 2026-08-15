using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Builds the structured <c>metadata.dotnet</c> model (see <see cref="DotnetProjectMetadata"/>)
/// from already-evaluated MSBuild state — one <see cref="TargetFrameworkEvaluation"/> per
/// grouped inner-build node that <see cref="Analyzer"/> collects for a project. Pure and
/// unit-testable: it never touches MSBuild types directly, only the property/package-reference
/// data the analyzer already collects per node, so it does not re-evaluate or re-parse project
/// XML.
/// </summary>
public static class DotnetMetadataBuilder
{
    /// <summary>
    /// One MSBuild inner-build node's already-evaluated properties and package references, for
    /// a single target framework of a project.
    /// </summary>
    public record TargetFrameworkEvaluation(
        Dictionary<string, string> Properties,
        List<PackageReference> PackageReferences);

    /// <summary>
    /// Builds project-level <c>metadata.dotnet</c> from one evaluation per target framework.
    /// Project-level capabilities are the logical OR of every target framework's capabilities.
    /// <see cref="DotnetProjectMetadata.PackageId"/> is only set when every target framework that
    /// evaluates one agrees on the same value — see <see cref="ResolveProjectPackageId"/>.
    /// </summary>
    public static DotnetProjectMetadata Build(IReadOnlyList<TargetFrameworkEvaluation> evaluations)
    {
        var frameworks = evaluations
            .Select(BuildTargetFrameworkMetadata)
            // Defend against the same TargetFramework appearing twice (e.g. duplicate graph
            // nodes) so callers always get one entry per distinct evaluated framework.
            .GroupBy(f => f.TargetFramework, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        var capabilities = new DotnetCapabilities
        {
            Test = frameworks.Any(f => f.Capabilities.Test),
            Executable = frameworks.Any(f => f.Capabilities.Executable),
            Packable = frameworks.Any(f => f.Capabilities.Packable),
            Publishable = frameworks.Any(f => f.Capabilities.Publishable),
            Tool = frameworks.Any(f => f.Capabilities.Tool),
        };

        return new DotnetProjectMetadata
        {
            PackageId = ResolveProjectPackageId(frameworks),
            Capabilities = capabilities,
            TargetFrameworks = frameworks,
        };
    }

    // A project-level PackageId is only meaningful when it's the same for every target
    // framework that evaluates one. A conditional `PackageId` that varies per `TargetFramework`
    // (or, transitively, a per-TFM AssemblyName fallback) means no single value describes the
    // whole project, so this returns null and callers must look at each entry in
    // DotnetProjectMetadata.TargetFrameworks instead of silently picking the first one.
    private static string? ResolveProjectPackageId(IReadOnlyList<DotnetTargetFrameworkMetadata> frameworks)
    {
        var distinctIds = frameworks
            .Select(f => f.PackageId)
            .Where(id => id is not null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return distinctIds.Count == 1 ? distinctIds[0] : null;
    }

    private static DotnetTargetFrameworkMetadata BuildTargetFrameworkMetadata(TargetFrameworkEvaluation evaluation)
    {
        var properties = evaluation.Properties;

        return new DotnetTargetFrameworkMetadata
        {
            PackageId = ResolvePackageId(properties),
            TargetFramework = properties.GetValueOrDefault("TargetFramework", string.Empty),
            TargetFrameworkIdentifier = NullIfEmpty(properties.GetValueOrDefault("TargetFrameworkIdentifier")),
            TargetFrameworkVersion = NullIfEmpty(properties.GetValueOrDefault("TargetFrameworkVersion")),
            TargetPlatformIdentifier = NullIfEmpty(properties.GetValueOrDefault("TargetPlatformIdentifier")),
            TargetPlatformVersion = NullIfEmpty(properties.GetValueOrDefault("TargetPlatformVersion")),
            RuntimeIdentifier = NullIfEmpty(properties.GetValueOrDefault("RuntimeIdentifier")),
            RuntimeIdentifiers = SplitList(properties.GetValueOrDefault("RuntimeIdentifiers")),
            Capabilities = BuildCapabilities(evaluation),
        };
    }

    private static DotnetCapabilities BuildCapabilities(TargetFrameworkEvaluation evaluation)
    {
        var properties = evaluation.Properties;
        var isExecutable = ProjectUtilities.IsExecutableProject(properties);

        return new DotnetCapabilities
        {
            Test = ProjectUtilities.IsTestProject(properties, evaluation.PackageReferences),
            Executable = isExecutable,
            Packable = IsPackable(properties),
            Publishable = IsPublishable(properties, isExecutable),
            Tool = properties.GetValueOrDefault("PackAsTool") == "true",
        };
    }

    // NuGet.Build.Tasks.Pack.targets defaults IsPackable to true for every SDK-style project, so
    // an empty evaluated value means the project never overrode it away from that default.
    private static bool IsPackable(Dictionary<string, string> properties)
    {
        var value = properties.GetValueOrDefault("IsPackable");
        return string.IsNullOrEmpty(value) || value == "true";
    }

    // Microsoft.NET.Sdk derives IsPublishable from whether the project produces an executable
    // when it isn't explicitly set, and forces it off for test projects even though the test
    // host's OutputType is Exe — so only fall back to the executable heuristic when unevaluated.
    private static bool IsPublishable(Dictionary<string, string> properties, bool isExecutable)
    {
        var value = properties.GetValueOrDefault("IsPublishable");
        return string.IsNullOrEmpty(value) ? isExecutable : value == "true";
    }

    // Matches the NuGet packaging SDK's own PackageId default resolution: PackageId, else
    // AssemblyName (which MSBuild itself defaults to the project file name when unset).
    private static string? ResolvePackageId(Dictionary<string, string> properties) =>
        NullIfEmpty(properties.GetValueOrDefault("PackageId")) ?? NullIfEmpty(properties.GetValueOrDefault("AssemblyName"));

    private static string? NullIfEmpty(string? value) => string.IsNullOrEmpty(value) ? null : value;

    private static List<string> SplitList(string? value) =>
        string.IsNullOrEmpty(value)
            ? new List<string>()
            : value
                .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
}
