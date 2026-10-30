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
    public static BuildTargetsResult BuildTargets(
        string projectName,
        string fileName,
        bool isTest,
        bool isExe,
        List<PackageReference> packageRefs,
        EvaluatedProperties properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        NxJsonConfig? nxJson,
        List<string> directoryBuildInputs,
        List<FrameworkVariant>? frameworkVariants = null)
    {
        var targets = new Dictionary<string, Target>();

        // Determine the appropriate input for production builds
        var productionInput = GetProductionInput(nxJson);

        AddBuildTarget(targets, projectName, fileName, isTest, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs);
        AddBuildReleaseTarget(targets, projectName, fileName, isTest, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs);

        if (isTest)
        {
            AddTestTarget(targets, projectName, fileName, packageRefs, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs);
        }

        // restore/clean/watch/run intentionally omit Directory.* inputs — they don't declare an
        // Inputs array, and adding one here would narrow Nx's default-input fallback should a
        // user enable caching on them later.
        AddRestoreTarget(targets, fileName, options);
        AddCleanTarget(targets, fileName, isTest, options);
        AddWatchTarget(targets, fileName, options);

        if (isExe)
        {
            AddPublishTarget(targets, projectName, fileName, isTest, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs);
            AddRunTarget(targets, fileName, options);
        }

        if (!isExe && !isTest)
        {
            AddPackTarget(targets, projectName, fileName, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs);
        }

        var groups = options.TfmVariants && frameworkVariants is { Count: > 1 }
            ? AddFrameworkVariantTargets(targets, projectName, fileName, frameworkVariants, projectDirectory, workspaceRoot, options)
            : null;
        if (options.TfmVariants && options.RidVariants && frameworkVariants is { Count: > 1 })
        {
            var ridGroups = AddRidVariantTargets(
                targets, fileName, frameworkVariants, projectDirectory, workspaceRoot, options);
            if (ridGroups.Count > 0)
            {
                groups ??= new();
                foreach (var group in ridGroups)
                {
                    groups.Add(group.Key, group.Value);
                }
            }
        }

        return new BuildTargetsResult { Targets = targets, TargetGroups = groups };
    }

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
