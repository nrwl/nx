using Microsoft.Build.Evaluation;
using Microsoft.Build.Execution;
using Microsoft.Build.Graph;
using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;

namespace MsbuildAnalyzer;

public static partial class Analyzer
{
    private static List<FrameworkVariant> CollectRidVariants(
        List<ProjectGraphNode> nodes,
        List<FrameworkVariant> frameworks,
        string projectPath,
        string workspaceRoot,
        NxJsonConfig? nxJson,
        Dictionary<string, HashSet<string>> directoryFilesByDir,
        SortedSet<string> evaluationInputs)
    {
        var seed = nodes.First().ProjectInstance;
        using var collection = new ProjectCollection();
        var graphs = new Dictionary<string, Dictionary<string, Dictionary<string, ProjectGraphNode>>>();
        foreach (var framework in frameworks)
        {
            if (!framework.Configurations.Values.Any(properties => properties.IsExecutable))
            {
                continue;
            }
            if (!framework.Configurations.Values.All(properties => properties.IsExecutable))
            {
                Console.Error.WriteLine(
                    $"Warning: skipping RID variants for '{framework.TargetFramework}' " +
                    "because OutputType is not executable in both Debug and Release.");
                continue;
            }
            var runtimes = new Dictionary<string, Dictionary<string, ProjectGraphNode>>();
            foreach (var rid in RidVariantUtilities.ResolveRuntimeIdentifiers(framework.Properties))
            {
                runtimes[rid] = framework.Configurations.ToDictionary(
                    pair => pair.Key,
                    pair => EvaluateVariantGraph(
                        seed, framework.TargetFramework, pair.Value.Configuration!, collection, rid));
            }
            graphs[framework.TargetFramework] = runtimes;
        }

        var allItemFiles = nodes.Select(node => node.ProjectInstance).SelectMany(GetVariantItemFiles)
            .Concat(graphs.Values.SelectMany(runtimes => runtimes.Values).SelectMany(configurations => configurations.Values)
                .SelectMany(node => GetVariantItemFiles(node.ProjectInstance)))
            .ToHashSet(StringComparer.Ordinal);
        return frameworks.Select(framework =>
        {
            if (!graphs.TryGetValue(framework.TargetFramework, out var runtimes))
            {
                return framework;
            }
            return framework with
            {
                RidVariants = runtimes.Select(runtime =>
                {
                    var references = runtime.Value.ToDictionary(
                        pair => pair.Key, pair => GetProjectReferenceClosure(pair.Value));
                    var instances = runtime.Value.Values.Select(node => node.ProjectInstance).ToArray();
                    var externalItems = instances.Concat(references.Values.SelectMany(reference =>
                            reference.Select(node => node.ProjectInstance))).SelectMany(instance =>
                            GetVariantItemFiles(instance).Append(instance.FullPath))
                        .Where(path => !ProjectUtilities.IsUnderDirectory(path, workspaceRoot)).Distinct().ToArray();
                    if (externalItems.Length > 0)
                    {
                        Console.Error.WriteLine(
                            $"Warning: disabling cache for '{projectPath}' framework '{framework.TargetFramework}' RID '{runtime.Key}' " +
                            $"because evaluated build items are outside the workspace: {string.Join(", ", externalItems)}");
                    }
                    return new RidVariant
                    {
                        RuntimeIdentifier = runtime.Key,
                        Configurations = runtime.Value.ToDictionary(
                            pair => pair.Key, pair => CollectProperties(pair.Value.ProjectInstance)),
                        References = references.ToDictionary(pair => pair.Key, pair => pair.Value.Select(node => new VariantReference
                        {
                            ProjectFile = node.ProjectInstance.FullPath,
                            Properties = CollectProperties(node.ProjectInstance)
                        }).ToList()),
                        Cacheable = externalItems.Length == 0 && framework.Cacheable,
                        Inputs = CollectVariantInputs(instances, allItemFiles, runtime.Value.Values,
                            framework.TargetFramework, projectPath, workspaceRoot, nxJson, directoryFilesByDir, evaluationInputs)
                    };
                }).ToList()
            };
        }).ToList();
    }
}
