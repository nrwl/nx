using Microsoft.Build.Definition;
using Microsoft.Build.Evaluation;
using Microsoft.Build.Evaluation.Context;
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
            // Evaluation only. The SDK's default EmbeddedResource, None and Content globs
            // are switched off: they walk every file under each project directory to
            // produce items that all sit inside it, and the only items read here are the
            // explicit ones linked in from outside, which survive. Compile stays on
            // because its evaluated items are the only faithful answer to "what does this
            // project compile" (excludes, Remove/Update entries, hand-listed sources),
            // which per-class test splitting needs; it costs a few milliseconds per
            // project. The shared context caches SDK resolution and directory listings
            // across the projects.
            var globalProperties = new Dictionary<string, string>
            {
                ["EnableDefaultEmbeddedResourceItems"] = "false",
                ["EnableDefaultNoneItems"] = "false",
                ["EnableDefaultContentItems"] = "false",
            };
            var evaluationContext = EvaluationContext.Create(EvaluationContext.SharingPolicy.Shared);
            using var projectCollection = new ProjectCollection();
            projectGraph = new ProjectGraph(
                absoluteProjectFiles.Select(p => new ProjectGraphEntryPoint(p, globalProperties)),
                projectCollection,
                (path, properties, collection) => ProjectInstance.FromFile(
                    path,
                    new ProjectOptions
                    {
                        GlobalProperties = properties,
                        ProjectCollection = collection,
                        EvaluationContext = evaluationContext,
                        LoadSettings = ProjectLoadSettings.DoNotEvaluateElementsWithFalseCondition,
                    }));
        }

        var nodesByFile = new Dictionary<string, NxProjectGraphNode>();
        var referencesByRoot = new Dictionary<string, ReferencesInfo>();
        var evaluationInputs = new SortedSet<string>(StringComparer.Ordinal);

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

                    // Everything outside the project directory that feeds the build — the nearest
                    // Directory.* ancestors, every file MSBuild imported, and sources or analyzer
                    // files linked in from elsewhere — declared as inputs on every target that
                    // already has an Inputs array. Imports and items are unioned across inner
                    // builds, since a conditional import can differ per target framework.
                    var instances = nodes
                        .Select(n => n.ProjectInstance)
                        .Where(instance => instance is not null)
                        .Select(instance => instance!)
                        .ToList();
                    var importPaths = instances.SelectMany(instance => instance.ImportPaths).ToList();
                    var linkedFiles = instances
                        .SelectMany(instance => LinkedItemTypes.SelectMany(instance.GetItems))
                        .Select(item => item.GetMetadataValue("FullPath"));
                    var directoryBuildInputs = ProjectUtilities.GetDirectoryBuildInputs(
                            projectPath,
                            workspaceRoot,
                            directoryFilesByDir
                        )
                        .Concat(ProjectUtilities.GetSharedInputs(projectDirectory, workspaceRoot, importPaths.Concat(linkedFiles)))
                        .Distinct()
                        .ToList();

                    evaluationInputs.Add(relativeProjectFile);
                    evaluationInputs.UnionWith(ProjectUtilities.GetWorkspaceRelativePaths(workspaceRoot, importPaths));

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
            EvaluationInputs = evaluationInputs.ToList()
        };
    }

    /// <summary>
    /// Item types whose includes are build inputs. Only entries resolving outside the
    /// project directory are declared; the rest are covered by the {projectRoot} input.
    /// </summary>
    private static readonly string[] LinkedItemTypes = { "Compile", "AdditionalFiles", "EmbeddedResource", "Content" };

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

    /// <summary>
    /// Snapshots the project's evaluated MSBuild properties. Every property is
    /// captured rather than a curated list: the helpers that read them look up
    /// by name, so a list is one more thing to keep in sync and a typo in it
    /// fails silently. Empty values are skipped so callers can treat a missing
    /// key and an unset property alike.
    /// </summary>
    private static Dictionary<string, string> CollectProperties(ProjectInstance project)
    {
        // MSBuild property names are case-insensitive; matching that here keeps
        // a project that spells one <outputpath> readable to the helpers.
        var properties = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var property in project.Properties)
        {
            if (!string.IsNullOrEmpty(property.EvaluatedValue))
            {
                properties[property.Name] = property.EvaluatedValue;
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
