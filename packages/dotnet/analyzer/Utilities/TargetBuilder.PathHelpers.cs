using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Path helper methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
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
            var baseRelativePath = MakeRelativeToWorkspace(baseOutputPath, workspaceRoot);
            // Normalize path separators and trim
            return baseRelativePath.Replace('\\', '/').TrimEnd('/');
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
            var baseRelativePath = MakeRelativeToWorkspace(baseIntermediatePath, workspaceRoot);
            // Normalize path separators and trim
            return baseRelativePath.Replace('\\', '/').TrimEnd('/');
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
}
