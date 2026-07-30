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
        Dictionary<string, string> properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        NxJsonConfig? nxJson,
        List<string> directoryBuildInputs,
        bool supportsSplitting = false,
        Func<SplitBy, TestDiscoveryResult>? discoverTestUnits = null,
        bool canDiscover = true)
    {
        var targets = new Dictionary<string, Target>();
        Dictionary<string, List<string>>? targetGroups = null;
        var derivedFromSources = false;
        var externalSources = new List<string>();

        // Determine the appropriate input for production builds
        var productionInput = GetProductionInput(nxJson);

        AddBuildTarget(targets, projectName, fileName, isTest, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs);
        AddBuildReleaseTarget(targets, projectName, fileName, isTest, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs);

        if (isTest)
        {
            AddTestTarget(targets, projectName, fileName, packageRefs, properties, projectDirectory, workspaceRoot, options, productionInput, directoryBuildInputs);

            if (options.TestCiTargetName is not null && discoverTestUnits is not null)
            {
                if (!supportsSplitting)
                {
                    // The filter options come from MSTest's contribution to
                    // Microsoft.Testing.Platform, so the request cannot be
                    // honored here.
                    Console.Error.WriteLine(
                        $"@nx/dotnet: cannot split tests for '{projectName}'. Splitting needs MSTest on " +
                        "Microsoft.Testing.Platform. Set <EnableMSTestRunner>true</EnableMSTestRunner> " +
                        "and <TestingPlatformDotnetTestSupport>true</TestingPlatformDotnetTestSupport>, " +
                        "or use the MSTest.Sdk project SDK.");
                }
                else if (!canDiscover)
                {
                    // Nothing the project can change; say so rather than
                    // sending the reader after MSTest properties that are
                    // already correct.
                    Console.Error.WriteLine(
                        $"@nx/dotnet: cannot split tests for '{projectName}'. The .NET SDK in use does " +
                        "not provide the C# parser the analyzer needs to discover test classes.");
                }
                else
                {
                    try
                    {
                        // Set when discovery runs rather than when it produces
                        // targets. A project that opted in but has no test classes
                        // yet still needs its sources hashed, or the first class
                        // added would not change any input the cache is keyed on.
                        derivedFromSources = true;

                        var discovery = discoverTestUnits(options.TestCiSplitBy);
                        externalSources = discovery.ExternalSources;

                        targetGroups = AddAtomizedTestTargets(
                            targets,
                            discovery,
                            targets[options.TestTargetName],
                            options,
                            properties,
                            projectName,
                            projectDirectory,
                            workspaceRoot,
                            fileName);
                    }
                    catch (Exception ex)
                    {
                        // RoslynResolver only checks that the SDK has a Roslyn build,
                        // not that its API matches what the analyzer compiled against
                        // (it says as much). A mismatch surfaces here, on first real
                        // use, rather than at that check — degrade the same way an
                        // unavailable parser does instead of losing the whole project
                        // to the per-project catch in Analyzer.cs.
                        derivedFromSources = false;
                        Console.Error.WriteLine(
                            $"@nx/dotnet: cannot split tests for '{projectName}'. Discovering test classes " +
                            $"failed: {ex.Message}");
                    }
                }
            }
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

        return new BuildTargetsResult
        {
            Targets = targets,
            TargetGroups = targetGroups,
            DerivedFromSources = derivedFromSources,
            ExternalSources = externalSources
        };
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
