using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Build.Locator;
using MsbuildAnalyzer;
using MsbuildAnalyzer.Models;

// Parse input - either from stdin or command line arguments
// Format (stdin): Read newline-separated list of project files from stdin
// Args: MsbuildAnalyzer <workspace-root> [plugin-options-json]

string workspaceRoot;
List<string> projectFiles;
PluginOptions? pluginOptions = null;

// Check if stdin has data for project files
if (Console.IsInputRedirected)
{
    // Read from stdin
    if (args.Length < 1)
    {
        Console.Error.WriteLine("Usage (stdin mode): MsbuildAnalyzer <workspace-root> [plugin-options-json]");
        Console.Error.WriteLine("  workspace-root: Absolute path to the workspace root");
        Console.Error.WriteLine("  plugin-options-json: JSON string with plugin options (optional)");
        Console.Error.WriteLine("  Project files should be provided via stdin (newline-separated)");
        return 1;
    }

    workspaceRoot = args[0];

    // Parse plugin options if provided
    if (args.Length >= 2 && !string.IsNullOrEmpty(args[1]))
    {
        try
        {
            pluginOptions = JsonSerializer.Deserialize<PluginOptions>(args[1], new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Failed to parse plugin options: {ex.Message}");
            return 1;
        }
    }

    projectFiles = new List<string>();

    string? line;
    while ((line = Console.ReadLine()) != null)
    {
        line = line.Trim();
        if (!string.IsNullOrEmpty(line))
        {
            projectFiles.Add(line);
        }
    }
}
else
{
    // Read from command line arguments
    if (args.Length < 2)
    {
        Console.Error.WriteLine("Usage (args mode): MsbuildAnalyzer <workspace-root> <project-file-1> [project-file-2] ...");
        Console.Error.WriteLine("  workspace-root: Absolute path to the workspace root");
        Console.Error.WriteLine("  project-files: Relative paths to .csproj/.fsproj/.vbproj files from workspace root");
        Console.Error.WriteLine();
        Console.Error.WriteLine("Alternative (stdin mode): MsbuildAnalyzer <workspace-root> [plugin-options-json] < files.txt");
        Console.Error.WriteLine("  Provide project files via stdin (newline-separated)");
        return 1;
    }

    workspaceRoot = args[0];
    projectFiles = args.Skip(1).ToList();
}

if (projectFiles.Count == 0)
{
    Console.Error.WriteLine("No project files provided.");
    return 1;
}

// Use default plugin options if not provided
pluginOptions ??= new PluginOptions();

// Register MSBuild BEFORE any MSBuild types are referenced
try
{
    var queryOptions = new VisualStudioInstanceQueryOptions
    {
        AllowAllDotnetLocations = true,
        AllowAllRuntimeVersions = true,
        DiscoveryTypes = DiscoveryType.DotNetSdk
    };

    var instances = MSBuildLocator
        .QueryVisualStudioInstances(queryOptions)
        .Distinct(new VSInstanceComparer())
        .ToList();

    // Select an SDK that is compatible with the current runtime
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
        sb.AppendLine("  Available SDKs:");
        foreach (var inst in instances)
        {
            sb.AppendLine($"    - .NET {inst.Version} at {inst.MSBuildPath}");
        }

        if (instances.Any(i => i.MSBuildPath.Contains("preview", StringComparison.OrdinalIgnoreCase) || i.MSBuildPath.Contains("-rc.", StringComparison.OrdinalIgnoreCase)))
        {
            sb.AppendLine();
            sb.AppendLine("By default, dotnet will not run via a preview SDK.");
            sb.AppendLine("If you are using a preview SDK, set DOTNET_ROLL_FORWARD_TO_PRERELEASE=1 in the environment.");
        }

        Console.Error.WriteLine(sb.ToString());
        Console.Error.WriteLine("To install the correct SDK:");
        Console.Error.WriteLine($"  - Visit: https://dotnet.microsoft.com/download/dotnet/{currentMajor}.0");
        return 2;
    }

    MSBuildLocator.RegisterInstance(selectedInstance);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Failed to register MSBuild: {ex.Message}");
    return 2;
}

// Run the analyzer
var result = Analyzer.AnalyzeWorkspace(projectFiles, workspaceRoot, pluginOptions);

// Serialize and output results
var options = new JsonSerializerOptions
{
    WriteIndented = false,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
};

Console.WriteLine(JsonSerializer.Serialize(result, options));
return 0;
