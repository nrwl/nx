using System.Text.Json;
using Microsoft.Build.Locator;

// Read project files from stdin (one per line) or from args
var projectFiles = new List<string>();
if (args.Length > 0)
{
    projectFiles.AddRange(args);
}
else
{
    string? line;
    while ((line = Console.ReadLine()) != null && line != "")
    {
        projectFiles.Add(line.Trim());
    }
}

if (projectFiles.Count == 0)
{
    Console.Error.WriteLine("No project files provided. Provide as command-line args or via stdin (one per line).\n");
    return 1;
}

// Register MSBuild BEFORE any MSBuild types are referenced
try
{
    VisualStudioInstanceQueryOptions queryOptions = new()
    {
        AllowAllDotnetLocations = true,
        AllowAllRuntimeVersions = true,
        DiscoveryTypes = DiscoveryType.DotNetSdk
    };

    var instances = MSBuildLocator.QueryVisualStudioInstances(queryOptions).Distinct(
        new VSInstanceComparer()
    ).ToList();

    // Select an SDK that is compatible with the current runtime
    // SDK APIs must match the runtime version to avoid MissingMethodException
    var currentMajor = Environment.Version.Major;
    var selectedInstance = instances
        .Where(i => i.Version.Major == currentMajor)
        .OrderByDescending(i => i.Version)
        .FirstOrDefault();

    if (selectedInstance == null)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("No compatible .NET SDK found.");
        sb.AppendLine($"  Current runtime: .NET {Environment.Version.Major}");
        sb.AppendLine($"  Available SDKs:");
        foreach (var inst in instances)
        {
            sb.AppendLine($"    - .NET {inst.Version} at {inst.MSBuildPath}");
        }
        if (instances.Any(
            i => i.MSBuildPath.Contains("preview", StringComparison.OrdinalIgnoreCase)
        ))
        {
            sb.AppendLine();
            sb.AppendLine("By default, dotnet will not run via a preview SDK.");
            sb.AppendLine("If you are using a preview SDK, set DOTNET_ROLL_FORWARD_TO_PRERELEASE=1 in the environment.");
        }
        Console.Error.WriteLine(sb.ToString());
        Console.Error.WriteLine("To install the correct SDK:");
        Console.Error.WriteLine($"  - Visit: https://dotnet.microsoft.com/download/dotnet/{currentMajor}.0");
        Console.Error.WriteLine($"  - Or use the .NET install script with --version {currentMajor}.0");
        return 2;
    }

    MSBuildLocator.RegisterInstance(selectedInstance);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Failed to register MSBuild: {ex.Message}");
    return 2;
}

// Now call method that uses MSBuild types
var results = Analyzer.AnalyzeProjects(projectFiles);

var options = new JsonSerializerOptions { WriteIndented = false };
Console.WriteLine(JsonSerializer.Serialize(results, options));
return 0;

// This class is separate so MSBuild types are not loaded until after RegisterDefaults
static class Analyzer
{
    public static List<object> AnalyzeProjects(List<string> projectFiles)
    {
        var results = new List<object>();

        // Create a ProjectGraph - use fully qualified names to avoid loading types in main
        var projectGraph = new Microsoft.Build.Graph.ProjectGraph(projectFiles);

        // Use ProjectCollection for evaluation
        var projectCollection = new Microsoft.Build.Evaluation.ProjectCollection();

        foreach (var node in projectGraph.ProjectNodes)
        {
            try
            {
                var projectPath = node.ProjectInstance?.FullPath;
                if (string.IsNullOrEmpty(projectPath))
                {
                    results.Add(new { error = "Unable to determine project path for node", node = node.GetHashCode() });
                    continue;
                }

                // Load the project for evaluation
                var project = projectCollection.LoadProject(projectPath);

                // Collect PackageReference items
                var packageRefs = new List<object>();
                foreach (var item in project.GetItems("PackageReference"))
                {
                    packageRefs.Add(new
                    {
                        Include = item.EvaluatedInclude,
                        Version = item.Metadata.FirstOrDefault(m => m.Name == "Version")?.EvaluatedValue
                    });
                }

                // Collect ProjectReference items (raw relative paths)
                var projectRefs = new List<string>();
                foreach (var item in project.GetItems("ProjectReference"))
                {
                    projectRefs.Add(item.EvaluatedInclude);
                }

                // Collect some evaluated properties useful for inference
                var properties = new Dictionary<string, string>();
                foreach (var prop in new[] {
                    "TargetFramework", "TargetFrameworks", "OutputType", "AssemblyName",
                    "OutputPath", "OutDir", "TargetPath", "TargetDir", "TargetFileName"
                })
                {
                    var val = project.GetPropertyValue(prop);
                    if (!string.IsNullOrEmpty(val)) properties[prop] = val;
                }

                results.Add(new
                {
                    path = projectPath,
                    evaluatedProperties = properties,
                    packageReferences = packageRefs,
                    projectReferences = projectRefs
                });
            }
            catch (Exception ex)
            {
                results.Add(new { error = ex.Message, node = node.ProjectInstance?.FullPath });
            }
        }

        return results;
    }
}

class VSInstanceComparer : IEqualityComparer<VisualStudioInstance>
{
    public bool Equals(VisualStudioInstance? x, VisualStudioInstance? y)
    {
        if (x == null && y == null) return true;
        if (x == null || y == null) return false;
        return x.MSBuildPath.Equals(y.MSBuildPath, StringComparison.OrdinalIgnoreCase);
    }

    public int GetHashCode(VisualStudioInstance obj)
    {
        return obj.MSBuildPath.GetHashCode(StringComparison.OrdinalIgnoreCase);
    }
}
