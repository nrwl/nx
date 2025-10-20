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
        string workspaceRoot,
        PluginOptions options,
        NxJsonConfig? nxJson)
    {
        var targets = new Dictionary<string, Target>();

        // Determine the appropriate input for production builds
        var productionInput = GetProductionInput(nxJson);

        AddBuildTarget(targets, projectName, fileName, isTest, properties, workspaceRoot, options, productionInput);
        AddBuildReleaseTarget(targets, projectName, fileName, isTest, properties, workspaceRoot, options, productionInput);

        if (isTest)
        {
            AddTestTarget(targets, projectName, fileName, packageRefs, properties, workspaceRoot, options, productionInput);
        }

        AddRestoreTarget(targets, fileName, options);
        AddCleanTarget(targets, fileName, isTest, options);
        AddWatchTarget(targets, fileName, options);

        if (isExe)
        {
            AddPublishTarget(targets, projectName, fileName, isTest, properties, workspaceRoot, options, productionInput);
            AddRunTarget(targets, fileName, options);
        }

        if (!isExe && !isTest)
        {
            AddPackTarget(targets, projectName, fileName, properties, workspaceRoot, options, productionInput);
        }

        return targets;
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
