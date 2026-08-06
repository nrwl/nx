using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Builds Nx target configurations for .NET projects.
/// </summary>
public static partial class TargetBuilder
{
    /// <summary>
    /// Builds all applicable targets for a .NET project.
    /// </summary>
    public static Dictionary<string, Target> BuildTargets(
        string projectName,
        string fileName,
        bool isTest,
        bool isExe,
        List<PackageReference> packageRefs,
        Dictionary<string, string> properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        NxJsonConfig? nxJson,
        List<string> directoryBuildInputs,
        List<ResolvedPackage>? resolvedPackages = null)
    {
        var targets = new Dictionary<string, Target>();

        // Determine the appropriate input for production builds
        var productionInput = GetProductionInput(nxJson);

        // Non-null only when the caller resolved every package version for this project.
        var externalDependenciesInput = CreateExternalDependenciesInput(resolvedPackages);

        AddBuildTarget(targets, projectName, fileName, isTest, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs, externalDependenciesInput);
        AddBuildReleaseTarget(targets, projectName, fileName, isTest, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs, externalDependenciesInput);

        if (isTest)
        {
            AddTestTarget(targets, projectName, fileName, packageRefs, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs, externalDependenciesInput);
        }

        // restore/clean/watch/run intentionally omit Directory.* inputs — they don't declare an
        // Inputs array, and adding one here would narrow Nx's default-input fallback should a
        // user enable caching on them later.
        AddRestoreTarget(targets, fileName, options);
        AddCleanTarget(targets, fileName, isTest, options);
        AddWatchTarget(targets, fileName, options);

        if (isExe)
        {
            AddPublishTarget(targets, projectName, fileName, isTest, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs, externalDependenciesInput);
            AddRunTarget(targets, fileName, options);
        }

        if (!isExe && !isTest)
        {
            AddPackTarget(targets, projectName, fileName, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs, externalDependenciesInput);
        }

        return targets;
    }

    /// <summary>
    /// Builds the Nx `{ "externalDependencies": [...] }` input for a project's NuGet packages.
    /// Declaring it also opts the target out of Nx's `AllExternalDependencies` fallback.
    /// Returns null when versions were not resolved; an empty list is preserved so a project
    /// with no packages is not invalidated by unrelated dependency churn.
    /// </summary>
    private static object? CreateExternalDependenciesInput(List<ResolvedPackage>? resolvedPackages)
    {
        if (resolvedPackages is null)
        {
            return null;
        }

        // The version is part of the node name so CPM scopes pinning the same package to
        // different versions produce distinct nodes, as npm does with `npm:pkg@version`.
        var names = resolvedPackages
            .Select(p => $"{NuGetExternalNodePrefix}{p.Id}@{p.Version}")
            .ToArray();

        return new { externalDependencies = names };
    }

    /// <summary>
    /// Prefix for NuGet external node names, mirroring `npm:` for JS and `maven:` for Maven.
    /// </summary>
    public const string NuGetExternalNodePrefix = "nuget:";

    /// <summary>
    /// Splices an optional input into an Inputs collection expression.
    /// </summary>
    private static object[] AsInputs(object? input) => input is null ? [] : [input];

    /// <summary>
    /// Determines the appropriate input for production builds.
    /// Returns "production" if it exists in nx.json's namedInputs, otherwise "default".
    /// </summary>
    private static string GetProductionInput(NxJsonConfig? nxJson)
    {
        if (nxJson?.NamedInputs != null && nxJson.NamedInputs.ContainsKey("production"))
        {
            return "production";
        }

        return "default";
    }
}
