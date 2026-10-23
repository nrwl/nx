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
        EvaluatedProperties Properties,
        List<PackageReference> PackageReferences);

    /// <summary>
    /// Builds project-level <c>metadata.dotnet</c> from one evaluation per target framework.
    /// Project-level package identity requires agreement across the frameworks that evaluate one.
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

        return new DotnetProjectMetadata
        {
            PackageId = ResolveProjectPackageId(frameworks),
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
            TargetFramework = properties.TargetFramework ?? string.Empty,
            TargetFrameworkIdentifier = NullIfEmpty(properties.TargetFrameworkIdentifier),
            TargetFrameworkVersion = NullIfEmpty(properties.TargetFrameworkVersion),
            TargetPlatformIdentifier = NullIfEmpty(properties.TargetPlatformIdentifier),
            TargetPlatformVersion = NullIfEmpty(properties.TargetPlatformVersion),
            RuntimeIdentifier = NullIfEmpty(properties.RuntimeIdentifier),
            RuntimeIdentifiers = SplitList(properties.RuntimeIdentifiers),
            Capabilities = BuildCapabilities(evaluation),
        };
    }

    private static DotnetCapabilities BuildCapabilities(TargetFrameworkEvaluation evaluation)
    {
        var properties = evaluation.Properties;

        return new DotnetCapabilities
        {
            Test = ProjectUtilities.IsTestProject(properties, evaluation.PackageReferences),
            Executable = properties.IsExecutable,
            Packable = properties.IsPackable,
            Publishable = properties.IsPublishable,
            Tool = properties.PackAsTool,
        };
    }

    // Matches the NuGet packaging SDK's own PackageId default resolution: PackageId, else
    // AssemblyName (which MSBuild itself defaults to the project file name when unset).
    private static string? ResolvePackageId(EvaluatedProperties properties) =>
        NullIfEmpty(properties.PackageId) ?? NullIfEmpty(properties.AssemblyName);

    private static string? NullIfEmpty(string? value) => string.IsNullOrEmpty(value) ? null : value;

    private static List<string> SplitList(string? value) =>
        string.IsNullOrEmpty(value)
            ? new List<string>()
            : value
                .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
}
