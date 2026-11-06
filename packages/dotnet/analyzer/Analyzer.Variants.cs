using Microsoft.Build.Definition;
using Microsoft.Build.Evaluation;
using Microsoft.Build.Execution;
using Microsoft.Build.Graph;
using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;

namespace MsbuildAnalyzer;

public static partial class Analyzer
{
    private static List<FrameworkVariant>? CollectFrameworkVariants(
        List<ProjectGraphNode> nodes,
        string projectPath,
        string workspaceRoot,
        NxJsonConfig? nxJson,
        Dictionary<string, HashSet<string>> directoryFilesByDir,
        SortedSet<string> evaluationInputs)
    {
        var outer = nodes.FirstOrDefault(node =>
            !string.IsNullOrWhiteSpace(node.ProjectInstance.GetPropertyValue("TargetFrameworks")) &&
            string.IsNullOrWhiteSpace(node.ProjectInstance.GetPropertyValue("TargetFramework")));
        if (outer is null)
        {
            return null;
        }

        var frameworks = outer.ProjectInstance.GetPropertyValue("TargetFrameworks")
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
        if (frameworks.Length < 2)
        {
            return null;
        }

        using var collection = new ProjectCollection();
        var instances = new Dictionary<string, Dictionary<string, ProjectInstance>>();
        var graphs = new Dictionary<string, Dictionary<string, ProjectGraphNode>>();
        foreach (var tfm in frameworks)
        {
            instances[tfm] = new Dictionary<string, ProjectInstance>();
            graphs[tfm] = new Dictionary<string, ProjectGraphNode>();
            foreach (var configuration in new[] { "Debug", "Release" })
            {
                var graph = EvaluateVariantGraph(outer.ProjectInstance, tfm, configuration, collection);
                graphs[tfm][configuration.ToLowerInvariant()] = graph;
                instances[tfm][configuration.ToLowerInvariant()] = graph.ProjectInstance;
            }
        }

        var allItemFiles = instances.Values.SelectMany(configs => configs.Values)
            .SelectMany(GetVariantItemFiles).ToHashSet(StringComparer.Ordinal);
        var variants = new List<FrameworkVariant>();
        foreach (var (tfm, configurations) in instances)
        {
            var referenceNodes = graphs[tfm].ToDictionary(pair => pair.Key, pair => GetProjectReferenceClosure(pair.Value));
            var externalItems = configurations.Values.Concat(referenceNodes.Values.SelectMany(references =>
                    references.Select(node => node.ProjectInstance))).SelectMany(GetVariantItemFiles)
                .Where(path => !ProjectUtilities.IsUnderDirectory(path, workspaceRoot)).Distinct().ToArray();
            if (externalItems.Length > 0)
            {
                Console.Error.WriteLine($"Warning: disabling cache for '{projectPath}' framework '{tfm}' because evaluated build items are outside the workspace: {string.Join(", ", externalItems)}");
            }
            variants.Add(new FrameworkVariant
            {
                TargetFramework = tfm,
                Configurations = configurations.ToDictionary(pair => pair.Key, pair => CollectProperties(pair.Value)),
                References = referenceNodes.ToDictionary(pair => pair.Key, pair => pair.Value.Select(node => new VariantReference
                {
                    ProjectFile = node.ProjectInstance.FullPath,
                    Properties = CollectProperties(node.ProjectInstance)
                }).ToList()),
                Cacheable = externalItems.Length == 0,
                Inputs = CollectVariantInputs(configurations.Values, allItemFiles, graphs[tfm].Values, tfm,
                    projectPath, workspaceRoot, nxJson, directoryFilesByDir, evaluationInputs)
            });
        }
        return variants;
    }

    private static ProjectGraphNode EvaluateVariantGraph(
        ProjectInstance seed,
        string tfm,
        string configuration,
        ProjectCollection collection,
        string? runtimeIdentifier = null)
    {
        var globals = new Dictionary<string, string>(seed.GlobalProperties, StringComparer.OrdinalIgnoreCase)
        {
            ["TargetFramework"] = tfm,
            ["Configuration"] = configuration
        };
        globals.Remove("EnableDefaultEmbeddedResourceItems");
        globals.Remove("EnableDefaultNoneItems");
        globals.Remove("EnableDefaultContentItems");
        if (runtimeIdentifier is not null)
        {
            globals["RuntimeIdentifier"] = runtimeIdentifier;
        }
        var graph = new ProjectGraph(
            [new ProjectGraphEntryPoint(seed.FullPath, globals)],
            collection,
            (path, properties, projects) =>
            {
                ProjectInstance Load(IDictionary<string, string> values) => ProjectInstance.FromFile(path, new ProjectOptions
                {
                    GlobalProperties = values,
                    ProjectCollection = projects
                });
                if (!path.Equals(seed.FullPath, StringComparison.OrdinalIgnoreCase) &&
                    (properties.ContainsKey("RuntimeIdentifier") || properties.ContainsKey("SelfContained")))
                {
                    var withoutRuntime = new Dictionary<string, string>(properties, StringComparer.OrdinalIgnoreCase);
                    withoutRuntime.Remove("RuntimeIdentifier");
                    withoutRuntime.Remove("SelfContained");
                    var reference = Load(withoutRuntime);
                    // The SDK negotiates IsRidAgnostic before forwarding runtime globals.
                    if (!reference.GetPropertyValue("IsRidAgnostic").Equals("false", StringComparison.OrdinalIgnoreCase))
                    {
                        return reference;
                    }
                }
                return Load(properties);
            });
        return graph.EntryPointNodes.Single();
    }

    private static List<ProjectGraphNode> GetProjectReferenceClosure(ProjectGraphNode root)
    {
        var visited = new HashSet<ProjectGraphNode>();
        void Visit(ProjectGraphNode node)
        {
            foreach (var reference in node.ProjectReferences)
            {
                if (visited.Add(reference))
                {
                    Visit(reference);
                }
            }
        }
        Visit(root);
        return visited.OrderBy(node => node.ProjectInstance.FullPath, StringComparer.Ordinal)
            .ThenBy(node => node.ProjectInstance.GetPropertyValue("TargetFramework"), StringComparer.Ordinal).ToList();
    }

    private static object[] CollectVariantInputs(
        IEnumerable<ProjectInstance> configurations,
        IEnumerable<string> allItemFiles,
        IEnumerable<ProjectGraphNode> graphNodes,
        string tfm,
        string projectPath,
        string workspaceRoot,
        NxJsonConfig? nxJson,
        Dictionary<string, HashSet<string>> directoryFilesByDir,
        SortedSet<string> evaluationInputs)
    {
        var projectDirectory = Path.GetDirectoryName(projectPath)!;
        var productionInput = nxJson?.NamedInputs?.ContainsKey("production") == true ? "production" : "default";
        var activeFiles = configurations.SelectMany(GetVariantItemFiles).ToHashSet(StringComparer.Ordinal);
        var imports = configurations.SelectMany(instance =>
            instance.ImportPaths.Where(path => !ProjectUtilities.IsUnderDirectory(path,
                Path.Combine(projectDirectory, CollectProperties(instance).ProjectExtensionsPath))))
            .ToArray();
        evaluationInputs.UnionWith(ProjectUtilities.GetWorkspaceRelativePaths(workspaceRoot, imports));
        var sharedInputs = ProjectUtilities.GetDirectoryBuildInputs(projectPath, workspaceRoot, directoryFilesByDir)
            .Concat(ProjectUtilities.GetWorkspaceRelativePaths(workspaceRoot, imports.Append(projectPath))
                .Select(path => $"{{workspaceRoot}}/{path}"))
            .Concat(ProjectUtilities.GetSharedInputs(projectDirectory, workspaceRoot, imports.Concat(activeFiles)));
        var dependencies = new HashSet<ProjectGraphNode>();
        void Visit(ProjectGraphNode node)
        {
            foreach (var dependency in node.ProjectReferences)
            {
                if (dependencies.Add(dependency))
                {
                    Visit(dependency);
                }
            }
        }
        foreach (var node in graphNodes.Where(node => node.ProjectInstance.GetPropertyValue("TargetFramework") == tfm))
        {
            Visit(node);
        }
        sharedInputs = sharedInputs.Concat(dependencies.SelectMany(node =>
        {
            var instance = node.ProjectInstance;
            var directory = Path.GetDirectoryName(instance.FullPath)!;
            evaluationInputs.Add(ProjectUtilities.GetRelativeProjectFile(instance.FullPath, workspaceRoot));
            var dependencyImports = instance.ImportPaths.Where(path => !ProjectUtilities.IsUnderDirectory(path,
                Path.Combine(directory, CollectProperties(instance).ProjectExtensionsPath))).ToArray();
            evaluationInputs.UnionWith(ProjectUtilities.GetWorkspaceRelativePaths(workspaceRoot, dependencyImports));
            return ProjectUtilities.GetDirectoryBuildInputs(instance.FullPath, workspaceRoot, directoryFilesByDir)
                .Concat(ProjectUtilities.GetWorkspaceRelativePaths(workspaceRoot,
                    GetVariantItemFiles(instance).Append(instance.FullPath)).Select(path => $"{{workspaceRoot}}/{path}"))
                .Concat(ProjectUtilities.GetSharedInputs(directory, workspaceRoot,
                    dependencyImports))
                .Concat(ProjectUtilities.GetSharedInputs(directory, workspaceRoot, GetVariantItemFiles(instance)));
        }));
        var inactiveFiles = ProjectUtilities.GetWorkspaceRelativePaths(workspaceRoot,
            allItemFiles.Except(activeFiles).Where(path => ProjectUtilities.IsUnderDirectory(path, projectDirectory)));
        return
        [
            productionInput,
            $"^{productionInput}",
            .. inactiveFiles.Select(path =>
                $"!{{projectRoot}}/{Path.GetRelativePath(projectDirectory, Path.Combine(workspaceRoot, path)).Replace('\\', '/')}"),
            .. sharedInputs.Distinct().Order(StringComparer.Ordinal),
            new { workingDirectory = "absolute" },
            new { dependentTasksOutputFiles = "**/*", transitive = true },
            new { env = "NUGET_PACKAGES" }
        ];
    }

    private static IEnumerable<string> GetVariantItemFiles(ProjectInstance instance) =>
        LinkedItemTypes.SelectMany(instance.GetItems)
            .Concat(instance.GetItems("None").Where(item =>
                new[] { "CopyToOutputDirectory", "CopyToPublishDirectory" }.Any(metadata =>
                {
                    var copy = item.GetMetadataValue(metadata);
                    return !string.IsNullOrEmpty(copy) && !copy.Equals("Never", StringComparison.OrdinalIgnoreCase);
                })))
            .Select(item => item.GetMetadataValue("FullPath"))
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(Path.GetFullPath);
}
