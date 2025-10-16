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
        AddBuildReleaseTarget(targets, projectName, fileName, isTest, properties, workspaceRoot);

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
    /// Strips common configuration names from the end of a path segment.
    /// Handles Debug/Release as magic strings for configuration-agnostic caching.
    /// </summary>
    private static string StripConfiguration(string path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return path;
        }

        // Normalize path separators
        var normalizedPath = path.Replace('\\', '/').TrimEnd('/');
        var segments = normalizedPath.Split('/');

        // Check if the last segment is a configuration name
        if (segments.Length > 0)
        {
            var lastSegment = segments[^1];
            if (lastSegment.Equals("Debug", StringComparison.OrdinalIgnoreCase) ||
                lastSegment.Equals("Release", StringComparison.OrdinalIgnoreCase))
            {
                // Remove the configuration segment
                return string.Join("/", segments[..^1]);
            }
        }

        return normalizedPath;
    }

    /// <summary>
    /// Gets the output directory path for build outputs.
    /// Handles both traditional (bin/) and artifacts (artifacts/bin/{ProjectName}/) layouts.
    /// </summary>
    private static string GetOutputPath(Dictionary<string, string> properties, string projectName, string workspaceRoot)
    {
        // Check if using artifacts output layout
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsPath(properties, workspaceRoot);
            // Artifacts layout: artifacts/bin/{ProjectName}/
            return $"{artifactsPath}/bin/{projectName}";
        }

        // Traditional layout: Prefer BaseOutputPath if available
        var baseOutputPath = properties.GetValueOrDefault("BaseOutputPath");
        if (!string.IsNullOrEmpty(baseOutputPath))
        {
            return MakeRelativeToWorkspace(baseOutputPath, workspaceRoot).TrimEnd('/');
        }

        // Otherwise use OutputPath and strip configuration if present
        var outputPath = properties.GetValueOrDefault("OutputPath")
            ?? properties.GetValueOrDefault("OutDir")
            ?? "bin";

        var relativePath = MakeRelativeToWorkspace(outputPath, workspaceRoot);
        return StripConfiguration(relativePath);
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
            // Artifacts layout: artifacts/obj/{ProjectName}/
            return $"{artifactsPath}/obj/{projectName}";
        }

        // Traditional layout: Prefer BaseIntermediateOutputPath if available
        var baseIntermediatePath = properties.GetValueOrDefault("BaseIntermediateOutputPath");
        if (!string.IsNullOrEmpty(baseIntermediatePath))
        {
            return MakeRelativeToWorkspace(baseIntermediatePath, workspaceRoot).TrimEnd('/');
        }

        // Otherwise use IntermediateOutputPath and strip configuration if present
        var intermediatePath = properties.GetValueOrDefault("IntermediateOutputPath") ?? "obj";

        var relativePath = MakeRelativeToWorkspace(intermediatePath, workspaceRoot);
        return StripConfiguration(relativePath);
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
            // Artifacts layout: artifacts/publish/{ProjectName}/
            return $"{artifactsPath}/publish/{projectName}";
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
            // Artifacts layout: artifacts/package/
            return $"{artifactsPath}/package";
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
            // Artifacts layout: artifacts/TestResults/{ProjectName}/
            return $"{artifactsPath}/TestResults/{projectName}";
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
        string[] defaultFlags = ["--no-restore", "--no-dependencies"];

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
                Args = defaultFlags
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["debug"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Debug"]
                },
                ["release"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Release"]
                }
            },
            DependsOn = ["restore", "^build"],
            Cache = true,
            Inputs = ["default", "^production"],
            Outputs =
            [
                $"{outputPrefix}/{outputPath}",
                $"{outputPrefix}/{intermediatePath}"
            ],
            Metadata = new TargetMetadata
            {
                Description = "Build the .NET project",
                Technologies = ProjectUtilities.GetTechnologies(fileName, isTest)
            }
        };
    }

    private static void AddBuildReleaseTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        bool isTest,
        Dictionary<string, string> properties,
        string workspaceRoot)
    {
        var outputPath = GetOutputPath(properties, projectName, workspaceRoot);
        var intermediatePath = GetIntermediateOutputPath(properties, projectName, workspaceRoot);

        string[] defaultFlags = ["--no-restore", "--no-dependencies"];

        // For artifacts output, paths are relative to workspace root
        // For traditional output, paths are relative to project root
        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        targets["build:release"] = new Target
        {
            Command = "dotnet build",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = [.. defaultFlags, "--configuration", "Release"]
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["debug"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Debug"]
                },
                ["release"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Release"]
                }
            },
            DependsOn = ["restore", "^build:release"],
            Cache = true,
            Inputs = ["default", "^production"],
            Outputs =
            [
                $"{outputPrefix}/{outputPath}",
                $"{outputPrefix}/{intermediatePath}"
            ],
            Metadata = new TargetMetadata
            {
                Description = "Build the .NET project in Release configuration",
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
        // TODO(@AgentEnder): We should add this back in after external deps
        // support is fleshed out.
        //
        // var externalDeps = packageRefs.Select(p => p.Include).ToArray();
        var testResultsDir = GetTestResultsDirectory(properties, projectName, workspaceRoot);

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        string[] defaultFlags = ["--no-build", "--no-restore"];

        targets["test"] = new Target
        {
            Command = "dotnet test",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = [.. defaultFlags]
            },
            DependsOn = ["build", "restore"],
            Cache = true,
            Inputs =
            [
                "default",
                "^production",
                // new { externalDependencies = externalDeps }
            ],
            Outputs = [$"{outputPrefix}/{testResultsDir}"],
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
                Args = ["--no-dependencies"]
            },
            DependsOn = ["^restore"],
            Cache = true,
            Inputs =
            [
                "{projectRoot}/*.csproj",
                "{projectRoot}/*.fsproj",
                "{projectRoot}/*.vbproj"
            ],
            Outputs = [$"{outputPrefix}/{intermediatePath}"],
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
        // Create a copy of properties with Configuration=Release
        var releaseProperties = new Dictionary<string, string>(properties)
        {
            ["Configuration"] = "Release"
        };

        var publishDir = GetPublishDir(releaseProperties, projectName, workspaceRoot);

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        string[] defaultFlags = ["--no-build", "--no-dependencies", "--no-restore"];

        targets["publish"] = new Target
        {
            Command = "dotnet publish",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = [.. defaultFlags, "--configuration", "Release"]
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["debug"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Debug"]
                },
                ["release"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Release"]
                }
            },
            DependsOn = ["build:release"],
            Cache = true,
            Inputs = ["default", "^production"],
            Outputs = [$"{outputPrefix}/{publishDir}"],
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
        // Create a copy of properties with Configuration=Release
        var releaseProperties = new Dictionary<string, string>(properties)
        {
            ["Configuration"] = "Release"
        };

        var packageOutputPath = GetPackageOutputPath(releaseProperties, projectName, workspaceRoot);

        var useWorkspaceRoot = UsesArtifactsOutput(properties);
        var outputPrefix = useWorkspaceRoot ? "{workspaceRoot}" : "{projectRoot}";

        targets["pack"] = new Target
        {
            Command = "dotnet pack",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = ["--no-dependencies", "--no-build", "--configuration", "Release"]
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["debug"] = new TargetConfiguration
                {
                    Args = ["--no-dependencies", "--no-build", "--configuration", "Debug"]
                },
                ["release"] = new TargetConfiguration
                {
                    Args = ["--no-dependencies", "--no-build", "--configuration", "Release"]
                }
            },
            DependsOn = ["build:release"],
            Cache = true,
            Inputs = ["default", "^production"],
            Outputs = [$"{outputPrefix}/{packageOutputPath}/*.nupkg"],
            Metadata = new TargetMetadata
            {
                Description = "Create NuGet package",
                Technologies = ProjectUtilities.GetTechnologies(fileName, false)
            }
        };
    }
}
