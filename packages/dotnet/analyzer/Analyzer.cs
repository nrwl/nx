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
        PluginOptions pluginOptions)
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
                    var isTest = ProjectUtilities.IsTestProject(properties, packageRefs);
                    var isExe = ProjectUtilities.IsExecutableProject(properties);

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

                    var targets = TargetBuilder.BuildTargets(
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
                        directoryBuildInputs
                    );

                    // Structured, evaluated .NET metadata (metadata.dotnet): reuses the same
                    // grouped inner-build nodes above rather than re-evaluating XML, aggregating
                    // per-target-framework facts/capabilities across every framework the
                    // project targets (not just the primary node used for target generation).
                    var frameworkEvaluations = CollectTargetFrameworkEvaluations(nodes, primaryNode);
                    var dotnetMetadata = DotnetMetadataBuilder.Build(frameworkEvaluations);

                    nodesByFile[relativeProjectFile] = new NxProjectGraphNode
                    {
                        Name = projectName,
                        Root = projectRoot,
                        Targets = targets,
                        Metadata = new Models.ProjectMetadata
                        {
                            Technologies = ProjectUtilities.GetTechnologies(projectPath),
                            Dotnet = dotnetMetadata
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
            ReferencesByRoot = referencesByRoot
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
            "PackageId",
            "IsTestProject",

            // Capabilities (metadata.dotnet)
            "IsPackable",
            "IsPublishable",
            "PackAsTool",

            // Target framework/platform facts (metadata.dotnet)
            "TargetFrameworkIdentifier",
            "TargetFrameworkVersion",
            "TargetPlatformIdentifier",
            "TargetPlatformVersion",

            // Build configuration
            "Configuration",
            "Platform",
            "RuntimeIdentifier",
            "RuntimeIdentifiers",

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
            "TestResultsDirectory"
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

    /// <summary>
    /// Collects the evaluated properties/package-references for every MSBuild inner-build node
    /// of a project (one per target framework), ordered to match the outer build's declared
    /// <c>TargetFrameworks</c> list so <c>metadata.dotnet.targetFrameworks</c> is deterministic.
    /// Falls back to just <paramref name="primaryNode"/> for legacy/non-SDK projects that never
    /// evaluate a <c>TargetFramework</c> property.
    /// </summary>
    private static List<DotnetMetadataBuilder.TargetFrameworkEvaluation> CollectTargetFrameworkEvaluations(
        List<ProjectGraphNode> nodes,
        ProjectGraphNode primaryNode)
    {
        var frameworkNodes = nodes
            .Where(n => !string.IsNullOrEmpty(n.ProjectInstance?.GetPropertyValue("TargetFramework")))
            .ToList();

        if (frameworkNodes.Count == 0)
        {
            frameworkNodes = new List<ProjectGraphNode> { primaryNode };
        }
        else
        {
            // TargetFrameworks (plural) is evaluated identically on every node for the project
            // (it isn't batched per inner build), so the primary node's value reflects the
            // author-declared order even when primaryNode itself is an inner build.
            var declaredOrder = primaryNode.ProjectInstance!.GetPropertyValue("TargetFrameworks");
            if (!string.IsNullOrEmpty(declaredOrder))
            {
                var order = declaredOrder
                    .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select((tfm, index) => (tfm, index))
                    .ToDictionary(x => x.tfm, x => x.index, StringComparer.OrdinalIgnoreCase);

                frameworkNodes = frameworkNodes
                    .OrderBy(n => order.TryGetValue(n.ProjectInstance!.GetPropertyValue("TargetFramework"), out var index)
                        ? index
                        : int.MaxValue)
                    .ToList();
            }
        }

        return frameworkNodes
            .Select(n => new DotnetMetadataBuilder.TargetFrameworkEvaluation(
                CollectProperties(n.ProjectInstance!),
                CollectPackageReferences(n.ProjectInstance!)))
            .ToList();
    }
}
