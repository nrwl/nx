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

        using (var analyzeProjectsPerf = PerfLogger.Start($"analyze workspace > transform {projectGraph.ProjectNodes.Count} projects"))
        {
            foreach (var node in projectGraph.ProjectNodes)
            {
                try
                {
                    if (node.ProjectInstance is null)
                    {
                        throw new InvalidOperationException("ProjectInstance is null.");
                    }
                    var projectPath = node.ProjectInstance.FullPath;
                    if (string.IsNullOrEmpty(projectPath))
                    {
                        continue;
                    }

                    var projectRoot = ProjectUtilities.GetRelativeProjectRoot(projectPath, workspaceRoot);
                    var relativeProjectFile = ProjectUtilities.GetRelativeProjectFile(projectPath, workspaceRoot);

                    // Collect package references
                    var packageRefs = CollectPackageReferences(node.ProjectInstance!);

                    // Collect project references
                    var projectRefs = CollectProjectReferences(node, projectPath, workspaceRoot);

                    // Collect MSBuild properties
                    var properties = CollectProperties(node.ProjectInstance!);

                    // Determine project type
                    var isTest = IsTestProject(properties, packageRefs);
                    var isExe = IsExecutableProject(properties);

                    // Build targets
                    var projectName = ProjectUtilities.GetProjectName(node.ProjectInstance);
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
                            Refs = projectRefs,
                            SourceConfigFile = relativeProjectFile
                        };
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Error analyzing {node.ProjectInstance?.FullPath}: {ex.Message}");
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
               packageRefs.Any(p => p.Include == "Microsoft.NET.Test.Sdk");
    }

    private static bool IsExecutableProject(Dictionary<string, string> properties)
    {
        return properties.GetValueOrDefault("OutputType")?
            .Equals("Exe", StringComparison.OrdinalIgnoreCase) == true;
    }
}
