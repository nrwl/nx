using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Builds Nx target configurations for .NET projects.
/// </summary>
public static class TargetBuilder
{
    /// <summary>
    /// Builds all applicable targets for a .NET project.
    /// </summary>
    public static Dictionary<string, Target> BuildTargets(
        string projectName,
        string fileName,
        bool isTest,
        bool isExe,
        List<PackageReference> packageRefs,
        Dictionary<string, string> properties,
        string workspaceRoot)
    {
        var targets = new Dictionary<string, Target>();

        AddBuildTarget(targets, projectName, fileName, isTest, properties, workspaceRoot);

        if (isTest)
        {
            AddTestTarget(targets, projectName, fileName, packageRefs, properties, workspaceRoot);
        }

        AddRestoreTarget(targets, projectName, fileName, isTest, properties, workspaceRoot);
        AddCleanTarget(targets, fileName, isTest);

        if (isExe)
        {
            AddPublishTarget(targets, projectName, fileName, isTest, properties, workspaceRoot);
        }

        if (!isExe && !isTest)
        {
            AddPackTarget(targets, projectName, fileName, properties, workspaceRoot);
        }

        return targets;
    }

    /// <summary>
    /// Checks if the project uses the new artifacts output layout.
    /// </summary>
    private static bool UsesArtifactsOutput(Dictionary<string, string> properties)
    {
        return properties.GetValueOrDefault("UseArtifactsOutput")
            ?.Equals("true", StringComparison.OrdinalIgnoreCase) == true;
    }

    /// <summary>
    /// Makes an absolute path relative to the workspace root.
    /// If the path is already relative, returns it as-is.
    /// </summary>
    private static string MakeRelativeToWorkspace(string path, string workspaceRoot)
    {
        if (string.IsNullOrEmpty(path) || !Path.IsPathRooted(path))
        {
            return path;
        }

        // Normalize paths for comparison
        var normalizedPath = Path.GetFullPath(path);
        var normalizedWorkspaceRoot = Path.GetFullPath(workspaceRoot);

        if (normalizedPath.StartsWith(normalizedWorkspaceRoot, StringComparison.OrdinalIgnoreCase))
        {
            var relativePath = Path.GetRelativePath(normalizedWorkspaceRoot, normalizedPath);
            // Convert Windows backslashes to forward slashes for Nx
            return relativePath.Replace('\\', '/');
        }

        // If path is not under workspace root, return it as-is
        return path;
    }

    /// <summary>
    /// Gets the artifacts root path (defaults to "artifacts" if not specified).
    /// This path is relative to the workspace root, not the project root.
    /// </summary>
    private static string GetArtifactsPath(Dictionary<string, string> properties, string workspaceRoot)
    {
        var artifactsPath = properties.GetValueOrDefault("ArtifactsPath") ?? "artifacts";
        return MakeRelativeToWorkspace(artifactsPath, workspaceRoot);
    }

    /// <summary>
    /// Gets the pivot string that distinguishes different builds.
    /// The pivot combines configuration, target framework, and runtime identifier.
    /// Format: {config}[_{tfm}][_{rid}] or uses custom ArtifactsPivots if specified.
    /// </summary>
    private static string GetArtifactsPivot(Dictionary<string, string> properties)
    {
        // If custom pivots are specified, use them
        var customPivots = properties.GetValueOrDefault("ArtifactsPivots");
        if (!string.IsNullOrEmpty(customPivots))
        {
            return customPivots;
        }

        // Build default pivot from config, tfm, and rid
        var parts = new List<string>();

        var config = properties.GetValueOrDefault("Configuration");
        if (!string.IsNullOrEmpty(config))
        {
            parts.Add(config.ToLowerInvariant());
        }

        var tfm = properties.GetValueOrDefault("TargetFramework");
        if (!string.IsNullOrEmpty(tfm))
        {
            parts.Add(tfm.ToLowerInvariant());
        }

        var rid = properties.GetValueOrDefault("RuntimeIdentifier");
        if (!string.IsNullOrEmpty(rid))
        {
            parts.Add(rid.ToLowerInvariant());
        }

        // Default to "debug" if no parts
        return parts.Count > 0 ? string.Join("_", parts) : "debug";
    }

    /// <summary>
    /// Gets the output directory path for build outputs.
    /// Handles both traditional (bin/) and artifacts (artifacts/bin/{ProjectName}/{pivot}/) layouts.
    /// </summary>
    private static string GetOutputPath(Dictionary<string, string> properties, string projectName, string workspaceRoot)
    {
        // Check if using artifacts output layout
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsPath(properties, workspaceRoot);
            var pivot = GetArtifactsPivot(properties);
            // Artifacts layout: artifacts/bin/{ProjectName}/{pivot}/
            return $"{artifactsPath}/bin/{projectName}/{pivot}";
        }

        // Traditional layout: OutputPath is the evaluated output directory
        var outputPath = properties.GetValueOrDefault("OutputPath")
            ?? properties.GetValueOrDefault("OutDir")
            ?? "bin";
        // Make it relative to the workspace root (though it's typically already relative to project root)
        return MakeRelativeToWorkspace(outputPath, workspaceRoot);
    }

    /// <summary>
    /// Gets the intermediate output directory path (obj).
    /// Handles both traditional and artifacts layouts.
    /// </summary>
    private static string GetIntermediateOutputPath(Dictionary<string, string> properties, string projectName, string workspaceRoot)
    {
        // Check if using artifacts output layout
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsPath(properties, workspaceRoot);
            var pivot = GetArtifactsPivot(properties);
            // Artifacts layout: artifacts/obj/{ProjectName}/{pivot}/
            return $"{artifactsPath}/obj/{projectName}/{pivot}";
        }

        // Traditional layout: IntermediateOutputPath is the full path
        var intermediatePath = properties.GetValueOrDefault("IntermediateOutputPath")
            ?? properties.GetValueOrDefault("BaseIntermediateOutputPath")
            ?? "obj";
        return MakeRelativeToWorkspace(intermediatePath, workspaceRoot);
    }

    /// <summary>
    /// Gets the publish output directory path.
    /// Handles both traditional and artifacts layouts.
    /// </summary>
    private static string GetPublishDir(Dictionary<string, string> properties, string projectName, string workspaceRoot)
    {
        // Check if using artifacts output layout
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsPath(properties, workspaceRoot);
            var pivot = GetArtifactsPivot(properties);
            // Artifacts layout: artifacts/publish/{ProjectName}/{pivot}/
            return $"{artifactsPath}/publish/{projectName}/{pivot}";
        }

        // Traditional layout: PublishDir can be customized
        var publishDir = properties.GetValueOrDefault("PublishDir");
        if (!string.IsNullOrEmpty(publishDir))
        {
            return MakeRelativeToWorkspace(publishDir, workspaceRoot);
        }

        var outputPath = GetOutputPath(properties, projectName, workspaceRoot);
        return $"{outputPath.TrimEnd('/')}/publish";
    }

    /// <summary>
    /// Gets the package output directory path.
    /// Handles both traditional and artifacts layouts.
    /// </summary>
    private static string GetPackageOutputPath(Dictionary<string, string> properties, string projectName, string workspaceRoot)
    {
        // Check if using artifacts output layout
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsPath(properties, workspaceRoot);
            var pivot = GetArtifactsPivot(properties);
            // Artifacts layout: artifacts/package/{pivot}/
            return $"{artifactsPath}/package/{pivot}";
        }

        // Traditional layout: PackageOutputPath is where .nupkg files go
        var packageOutputPath = properties.GetValueOrDefault("PackageOutputPath");
        if (!string.IsNullOrEmpty(packageOutputPath))
        {
            return MakeRelativeToWorkspace(packageOutputPath, workspaceRoot);
        }

        return GetOutputPath(properties, projectName, workspaceRoot);
    }

    /// <summary>
    /// Gets the test results directory path.
    /// Handles both traditional and artifacts layouts.
    /// </summary>
    private static string GetTestResultsDirectory(Dictionary<string, string> properties, string projectName, string workspaceRoot)
    {
        // Check if using artifacts output layout
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsPath(properties, workspaceRoot);
            var pivot = GetArtifactsPivot(properties);
            // Artifacts layout: artifacts/TestResults/{ProjectName}/{pivot}/
            return $"{artifactsPath}/TestResults/{projectName}/{pivot}";
        }

        // Traditional layout: TestResultsDirectory can be customized
        var testResultsDir = properties.GetValueOrDefault("TestResultsDirectory");
        if (!string.IsNullOrEmpty(testResultsDir))
        {
            return MakeRelativeToWorkspace(testResultsDir, workspaceRoot);
        }

        return "TestResults";
    }

    private static void AddBuildTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        bool isTest,
        Dictionary<string, string> properties,
        string workspaceRoot)
    {
        var outputPath = GetOutputPath(properties, projectName, workspaceRoot);
        var intermediatePath = GetIntermediateOutputPath(properties, projectName, workspaceRoot);
        var defaultConfiguration = properties.GetValueOrDefault("Configuration") ?? "Debug";

        // For artifacts output, paths are relative to workspace root
        // For traditional output, paths are relative to project root
        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        targets["build"] = new Target
        {
            Command = "dotnet build",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = new[] { "--no-restore", "--no-dependencies", "--configuration", defaultConfiguration }
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["Debug"] = new TargetConfiguration
                {
                    Options = new TargetOptions
                    {
                        Args = new[] { "--configuration", "Debug" }
                    }
                },
                ["Release"] = new TargetConfiguration
                {
                    Options = new TargetOptions
                    {
                        Args = new[] { "--configuration", "Release" }
                    }
                }
            },
            DefaultConfiguration = defaultConfiguration,
            DependsOn = new[] { "restore", "^build" },
            Cache = true,
            Inputs = new object[] { "default", "^production" },
            Outputs = new[]
            {
                $"{outputPrefix}/{outputPath}",
                $"{outputPrefix}/{intermediatePath}"
            },
            Metadata = new TargetMetadata
            {
                Description = "Build the .NET project",
                Technologies = ProjectUtilities.GetTechnologies(fileName, isTest)
            }
        };
    }

    private static void AddTestTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        List<PackageReference> packageRefs,
        Dictionary<string, string> properties,
        string workspaceRoot)
    {
        var externalDeps = packageRefs.Select(p => p.Include).ToArray();
        var testResultsDir = GetTestResultsDirectory(properties, projectName, workspaceRoot);

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        targets["test"] = new Target
        {
            Command = "dotnet test",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = new[] { "--no-dependencies", "--no-build" }
            },
            DependsOn = new[] { "build" },
            Cache = true,
            Inputs = new object[]
            {
                "default",
                "^production",
                new { externalDependencies = externalDeps }
            },
            Outputs = new[] { $"{outputPrefix}/{testResultsDir}" },
            Metadata = new TargetMetadata
            {
                Description = "Run .NET tests",
                Technologies = ProjectUtilities.GetTechnologies(fileName, true)
            }
        };
    }

    private static void AddRestoreTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        bool isTest,
        Dictionary<string, string> properties,
        string workspaceRoot)
    {
        var intermediatePath = GetIntermediateOutputPath(properties, projectName, workspaceRoot);

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        targets["restore"] = new Target
        {
            Command = "dotnet restore",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = new[] { "--no-dependencies" }
            },
            DependsOn = new[] { "^restore" },
            Cache = true,
            Inputs = new object[]
            {
                "{projectRoot}/*.csproj",
                "{projectRoot}/*.fsproj",
                "{projectRoot}/*.vbproj"
            },
            Outputs = new[] { $"{outputPrefix}/{intermediatePath}" },
            Metadata = new TargetMetadata
            {
                Description = "Restore .NET project dependencies",
                Technologies = ProjectUtilities.GetTechnologies(fileName, isTest)
            }
        };
    }

    private static void AddCleanTarget(Dictionary<string, Target> targets, string fileName, bool isTest)
    {
        targets["clean"] = new Target
        {
            Command = "dotnet clean",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}"
            },
            Cache = false,
            Metadata = new TargetMetadata
            {
                Description = "Clean build artifacts",
                Technologies = ProjectUtilities.GetTechnologies(fileName, isTest)
            }
        };
    }

    private static void AddPublishTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        bool isTest,
        Dictionary<string, string> properties,
        string workspaceRoot)
    {
        var publishDir = GetPublishDir(properties, projectName, workspaceRoot);
        var defaultConfiguration = properties.GetValueOrDefault("Configuration") ?? "Debug";

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        targets["publish"] = new Target
        {
            Command = "dotnet publish",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = new[] { "--no-build", "--no-dependencies", "--configuration", defaultConfiguration }
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["Debug"] = new TargetConfiguration
                {
                    Options = new TargetOptions
                    {
                        Args = new[] { "--configuration", "Debug" }
                    }
                },
                ["Release"] = new TargetConfiguration
                {
                    Options = new TargetOptions
                    {
                        Args = new[] { "--configuration", "Release" }
                    }
                }
            },
            DefaultConfiguration = defaultConfiguration,
            DependsOn = new[] { "build" },
            Cache = true,
            Inputs = new object[] { "default", "^production" },
            Outputs = new[] { $"{outputPrefix}/{publishDir}" },
            Metadata = new TargetMetadata
            {
                Description = "Publish the .NET application",
                Technologies = ProjectUtilities.GetTechnologies(fileName, isTest)
            }
        };
    }

    private static void AddPackTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        Dictionary<string, string> properties,
        string workspaceRoot)
    {
        var packageOutputPath = GetPackageOutputPath(properties, projectName, workspaceRoot);
        var defaultConfiguration = properties.GetValueOrDefault("Configuration") ?? "Debug";

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        targets["pack"] = new Target
        {
            Command = "dotnet pack",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = new[] { "--no-dependencies", "--no-build", "--configuration", defaultConfiguration }
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["Debug"] = new TargetConfiguration
                {
                    Options = new TargetOptions
                    {
                        Args = new[] { "--configuration", "Debug" }
                    }
                },
                ["Release"] = new TargetConfiguration
                {
                    Options = new TargetOptions
                    {
                        Args = new[] { "--configuration", "Release" }
                    }
                }
            },
            DefaultConfiguration = defaultConfiguration,
            DependsOn = new[] { "build" },
            Cache = true,
            Inputs = new object[] { "default", "^production" },
            Outputs = new[] { $"{outputPrefix}/{packageOutputPath}/*.nupkg" },
            Metadata = new TargetMetadata
            {
                Description = "Create NuGet package",
                Technologies = ProjectUtilities.GetTechnologies(fileName, false)
            }
        };
    }
}
