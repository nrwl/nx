using Microsoft.Build.Evaluation;
using Microsoft.Build.Execution;
using Microsoft.Build.Graph;
using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;

namespace MsbuildAnalyzer;

/// <summary>
/// Analyzes .NET projects using MSBuild to generate Nx project configurations.
/// </summary>
public static class Analyzer
{
    /// <summary>
    /// Analyzes a workspace containing .NET projects.
    /// </summary>
    /// <param name="projectFiles">Relative paths to project files from workspace root.</param>
    /// <param name="workspaceRoot">Absolute path to the workspace root.</param>
    /// <param name="pluginOptions">Plugin options for target customization.</param>
    /// <returns>Analysis results containing node configurations and project references.</returns>
    public static AnalysisResult AnalyzeWorkspace(
        List<string> projectFiles,
        List<string> directoryFiles,
        string workspaceRoot,
        PluginOptions pluginOptions,
        bool roslynAvailable = true)
    {
        // Index Directory.Build.* / Directory.Solution.* matches by their containing directory
        // (workspace-root-relative, forward-slashed; "." for the workspace root itself). Built
        // once up-front so per-project ancestor lookup is O(depth) instead of O(directoryFiles).
        var directoryFilesByDir = new Dictionary<string, HashSet<string>>();
        foreach (var rel in directoryFiles)
        {
            var normalized = rel.Replace('\\', '/');
            var lastSlash = normalized.LastIndexOf('/');
            var dir = lastSlash < 0 ? "." : normalized.Substring(0, lastSlash);
            var name = lastSlash < 0 ? normalized : normalized.Substring(lastSlash + 1);
            if (!directoryFilesByDir.TryGetValue(dir, out var set))
            {
                set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                directoryFilesByDir[dir] = set;
            }
            set.Add(name);
        }
        // Read nx.json from workspace root
        NxJsonConfig? nxJson = null;
        using (PerfLogger.Start("analyze workspace > read nx.json"))
        {
            var nxJsonPath = Path.Combine(workspaceRoot, "nx.json");
            if (File.Exists(nxJsonPath))
            {
                try
                {
                    var nxJsonContent = File.ReadAllText(nxJsonPath);
                    nxJson = System.Text.Json.JsonSerializer.Deserialize<NxJsonConfig>(nxJsonContent, new System.Text.Json.JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Warning: Failed to read nx.json: {ex.Message}");
                }
            }
        }

        // Convert relative paths to absolute for MSBuild
        var absoluteProjectFiles = projectFiles
            .Select(p => Path.Combine(workspaceRoot, p))
            .ToList();

        ProjectGraph projectGraph;
        using (var graphPerf = PerfLogger.Start("analyze workspace > create project graph"))
        {
            projectGraph = new ProjectGraph(absoluteProjectFiles);
        }

        var nodesByFile = new Dictionary<string, NxProjectGraphNode>();
        var referencesByRoot = new Dictionary<string, ReferencesInfo>();
        var atomizedRoots = new List<string>();
        var atomizedExternalSources = new SortedSet<string>(StringComparer.Ordinal);

        // Group nodes by project file path to handle multi-targeting projects.
        // Multi-targeting projects (using TargetFrameworks plural) create multiple nodes:
        // - An "outer build" with TargetFrameworks set but TargetFramework empty
        // - "Inner builds" for each target framework with TargetFramework set
        // We need to aggregate references from all builds and use an inner build for config.
        var nodesByPath = new Dictionary<string, List<ProjectGraphNode>>();
        foreach (var node in projectGraph.ProjectNodes)
        {
            if (node.ProjectInstance?.FullPath is null)
            {
                continue;
            }
            var path = node.ProjectInstance.FullPath;
            // Only real project files become Nx projects. Depending on the MSBuild/SDK version,
            // imported files (e.g. Directory.Build.props) can appear as graph nodes; treating one
            // as a project would emit a phantom project named after the file (e.g. "Directory.Build")
            // whose targets run dotnet against a directory with no project to build.
            if (!ProjectUtilities.IsProjectFile(path))
            {
                continue;
            }
            if (!nodesByPath.TryGetValue(path, out var nodes))
            {
                nodes = new List<ProjectGraphNode>();
                nodesByPath[path] = nodes;
            }
            nodes.Add(node);
        }

        using (var analyzeProjectsPerf = PerfLogger.Start($"analyze workspace > transform {nodesByPath.Count} projects"))
        {
            foreach (var kvp in nodesByPath)
            {
                var projectPath = kvp.Key;
                var nodes = kvp.Value;

                try
                {
                    // For multi-targeting projects, prefer an inner build (has TargetFramework set)
                    // over the outer build (has TargetFrameworks but no TargetFramework).
                    // Inner builds have the actual project references.
                    var primaryNode = nodes.FirstOrDefault(n =>
                        !string.IsNullOrEmpty(n.ProjectInstance?.GetPropertyValue("TargetFramework")))
                        ?? nodes.First();

                    if (primaryNode.ProjectInstance is null)
                    {
                        throw new InvalidOperationException("ProjectInstance is null.");
                    }

                    var projectRoot = ProjectUtilities.GetRelativeProjectRoot(projectPath, workspaceRoot);
                    var relativeProjectFile = ProjectUtilities.GetRelativeProjectFile(projectPath, workspaceRoot);

                    // Collect package references from primary node
                    var packageRefs = CollectPackageReferences(primaryNode.ProjectInstance!);

                    // Collect direct project references from the primary node's ProjectInstance.
                    // Uses GetItems("ProjectReference") which returns only DIRECT references,
                    // with glob patterns already evaluated by MSBuild during project loading.
                    var projectRefs = CollectProjectReferences(primaryNode.ProjectInstance!, projectPath, workspaceRoot);

                    // Collect MSBuild properties from primary node
                    var properties = CollectProperties(primaryNode.ProjectInstance!);

                    // Determine project type
                    var isTest = IsTestProject(properties, packageRefs);
                    var isExe = IsExecutableProject(properties);

                    // Build targets
                    var projectName = ProjectUtilities.GetProjectName(primaryNode.ProjectInstance);
                    var projectDirectory = Path.GetDirectoryName(projectPath)!;

                    // The closest Directory.Build.* / Directory.Solution.* ancestors that exist
                    // for this project — declared as inputs on every target that already has an
                    // Inputs array, so Nx invalidates downstream caches when they change.
                    var directoryBuildInputs = ProjectUtilities.GetDirectoryBuildInputs(
                        projectPath,
                        workspaceRoot,
                        directoryFilesByDir
                    );

                    var buildResult = TargetBuilder.BuildTargets(
                        projectName,
                        Path.GetFileName(projectPath),
                        isTest,
                        isExe,
                        packageRefs,
                        properties,
                        projectDirectory,
                        workspaceRoot,
                        pluginOptions,
                        nxJson,
                        directoryBuildInputs,
                        SupportsTestSplitting(properties),
                        // Passed as a callback so the sources are only read and
                        // parsed for projects that actually opt into splitting.
                        splitBy => TestClassScanner.Scan(
                            primaryNode.ProjectInstance!, splitBy, projectDirectory, workspaceRoot),
                        roslynAvailable
                    );

                    if (buildResult.DerivedFromSources)
                    {
                        atomizedRoots.Add(projectRoot);
                        atomizedExternalSources.UnionWith(buildResult.ExternalSources);
                    }

                    nodesByFile[relativeProjectFile] = new NxProjectGraphNode
                    {
                        Name = projectName,
                        Root = projectRoot,
                        Targets = buildResult.Targets,
                        Metadata = new Models.ProjectMetadata
                        {
                            Technologies = ProjectUtilities.GetTechnologies(projectPath),
                            TargetGroups = buildResult.TargetGroups
                        }
                    };

                    if (projectRefs.Count > 0)
                    {
                        referencesByRoot[projectRoot] = new ReferencesInfo
                        {
                            Refs = projectRefs,
                            SourceConfigFile = relativeProjectFile
                        };
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Error analyzing {projectPath}: {ex.Message}");
                }
            }
        }

        return new AnalysisResult
        {
            NodesByFile = nodesByFile,
            ReferencesByRoot = referencesByRoot,
            // Left null rather than empty when nothing split, so the plugin can
            // skip hashing C# sources entirely.
            AtomizedRoots = atomizedRoots.Count > 0 ? atomizedRoots : null,
            AtomizedExternalSources = atomizedExternalSources.Count > 0
                ? [.. atomizedExternalSources]
                : null
        };
    }

    private static List<PackageReference> CollectPackageReferences(ProjectInstance project)
    {
        var packageRefs = new List<PackageReference>();

        foreach (var item in project.GetItems("PackageReference"))
        {
            packageRefs.Add(new PackageReference
            {
                Include = item.EvaluatedInclude,
                Version = item.Metadata.FirstOrDefault(m => m.Name == "Version")?.EvaluatedValue
            });
        }

        return packageRefs;
    }

    /// <summary>
    /// Collects direct project references from the ProjectInstance.
    /// Uses GetItems("ProjectReference") to get only direct references defined in the project file.
    /// MSBuild evaluates glob patterns during project loading, so EvaluatedInclude contains
    /// resolved paths even when the original ProjectReference used globs.
    /// </summary>
    private static List<string> CollectProjectReferences(
        ProjectInstance project,
        string projectPath,
        string workspaceRoot)
    {
        var projectRefs = new List<string>();
        var projectDir = Path.GetDirectoryName(projectPath)!;

        foreach (var item in project.GetItems("ProjectReference"))
        {
            var refPath = item.EvaluatedInclude;
            if (string.IsNullOrEmpty(refPath))
            {
                continue;
            }

            // Resolve the path relative to the project directory
            var absoluteRefPath = Path.IsPathRooted(refPath)
                ? refPath
                : Path.GetFullPath(Path.Combine(projectDir, refPath));

            var relativeRefRoot = ProjectUtilities.GetRelativeProjectRoot(absoluteRefPath, workspaceRoot);
            projectRefs.Add(relativeRefRoot);
        }

        return projectRefs;
    }

    private static Dictionary<string, string> CollectProperties(ProjectInstance project)
    {
        var properties = new Dictionary<string, string>();
        var propertiesToCollect = new[]
        {
            // Project identification
            "TargetFramework",
            "TargetFrameworks",
            "OutputType",
            "AssemblyName",
            "IsTestProject",

            // Build configuration
            "Configuration",
            "Platform",
            "RuntimeIdentifier",

            // Artifacts output (new SDK layout)
            "UseArtifactsOutput",
            "ArtifactsPath",
            "ArtifactsPivots",

            // Output paths
            "OutputPath",
            "OutDir",
            "BaseIntermediateOutputPath",
            "IntermediateOutputPath",
            "BaseOutputPath",

            // Publish paths
            "PublishDir",

            // Package paths
            "PackageOutputPath",

            // Test paths
            "TestResultsDirectory",

            // Microsoft.Testing.Platform. Both are required before a project's
            // tests can be split; SupportsTestSplitting explains why.
            "EnableMSTestRunner",
            "TestingPlatformDotnetTestSupport"
        };

        foreach (var prop in propertiesToCollect)
        {
            var val = project.GetPropertyValue(prop);
            if (!string.IsNullOrEmpty(val))
            {
                properties[prop] = val;
            }
        }

        return properties;
    }

    private static bool IsTestProject(
        Dictionary<string, string> properties,
        List<PackageReference> packageRefs)
    {
        return properties.GetValueOrDefault("IsTestProject") == "true" ||
               packageRefs.Any(p => p.Include == "Microsoft.NET.Test.Sdk" || p.Include.StartsWith("Microsoft.Testing"));
    }

    /// <summary>
    /// Whether a test project can have its tests split into separate tasks.
    /// </summary>
    /// <remarks>
    /// Requires MSTest on Microsoft.Testing.Platform. The platform alone is not
    /// enough: its <c>--treenode-filter</c> is only registered by frameworks
    /// that opt in, and MSTest is not one, so the filters use <c>--filter</c>,
    /// whose syntax comes from MSTest. Short of both properties
    /// <c>dotnet test</c> routes through the VSTest bridge, which accepts the
    /// split arguments and ignores them, so every task would silently run the
    /// whole suite. <c>MSTest.Sdk</c> sets both, which is also how that SDK is
    /// detected.
    /// </remarks>
    internal static bool SupportsTestSplitting(Dictionary<string, string> properties) =>
        IsTrue(properties, "EnableMSTestRunner") &&
        IsTrue(properties, "TestingPlatformDotnetTestSupport");

    private static bool IsTrue(Dictionary<string, string> properties, string name) =>
        properties.GetValueOrDefault(name)?.Equals("true", StringComparison.OrdinalIgnoreCase) == true;

    private static bool IsExecutableProject(Dictionary<string, string> properties)
    {
        return properties.GetValueOrDefault("OutputType")?
            .Equals("Exe", StringComparison.OrdinalIgnoreCase) == true;
    }
}
