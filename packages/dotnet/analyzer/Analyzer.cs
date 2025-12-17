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
        string workspaceRoot,
        PluginOptions pluginOptions)
    {
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

                    // Collect project references from ALL nodes (aggregate from inner + outer builds)
                    // This ensures we capture references from multi-targeting projects correctly
                    var projectRefs = new HashSet<string>();
                    foreach (var node in nodes)
                    {
                        var refs = CollectProjectReferences(node, projectPath, workspaceRoot);
                        foreach (var r in refs)
                        {
                            // Filter out self-references (can happen with multi-targeting inner build cross-refs)
                            if (r != projectRoot)
                            {
                                projectRefs.Add(r);
                            }
                        }
                    }

                    // Collect MSBuild properties from primary node
                    var properties = CollectProperties(primaryNode.ProjectInstance!);

                    // Determine project type
                    var isTest = IsTestProject(properties, packageRefs);
                    var isExe = IsExecutableProject(properties);

                    // Build targets
                    var projectName = ProjectUtilities.GetProjectName(primaryNode.ProjectInstance);
                    var targets = TargetBuilder.BuildTargets(
                        projectName,
                        Path.GetFileName(projectPath),
                        isTest,
                        isExe,
                        packageRefs,
                        properties,
                        workspaceRoot,
                        pluginOptions,
                        nxJson
                    );

                    nodesByFile[relativeProjectFile] = new NxProjectGraphNode
                    {
                        Name = projectName,
                        Root = projectRoot,
                        Targets = targets,
                        Metadata = new Models.ProjectMetadata
                        {
                            Technologies = ProjectUtilities.GetTechnologies(projectPath)
                        }
                    };

                    if (projectRefs.Count > 0)
                    {
                        referencesByRoot[projectRoot] = new ReferencesInfo
                        {
                            Refs = projectRefs.ToList(),
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

    private static List<string> CollectProjectReferences(
        ProjectGraphNode project,
        string projectPath,
        string workspaceRoot)
    {
        var projectRefs = new List<string>();

        foreach (var referencedProject in project.ProjectReferences)
        {
            var refPath = referencedProject.ProjectInstance?.FullPath;
            if (string.IsNullOrEmpty(refPath))
            {
                throw new InvalidOperationException(
                    $"Project reference in {projectPath} is missing a valid path.");
            }
            var absoluteRefPath = Path.IsPathRooted(refPath)
                ? refPath
                : Path.GetFullPath(Path.Combine(Path.GetDirectoryName(projectPath)!, refPath));

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

    private static bool IsTestProject(
        Dictionary<string, string> properties,
        List<PackageReference> packageRefs)
    {
        return properties.GetValueOrDefault("IsTestProject") == "true" ||
               packageRefs.Any(p => p.Include == "Microsoft.NET.Test.Sdk" || p.Include.StartsWith("Microsoft.Testing"));
    }

    private static bool IsExecutableProject(Dictionary<string, string> properties)
    {
        return properties.GetValueOrDefault("OutputType")?
            .Equals("Exe", StringComparison.OrdinalIgnoreCase) == true;
    }
}
