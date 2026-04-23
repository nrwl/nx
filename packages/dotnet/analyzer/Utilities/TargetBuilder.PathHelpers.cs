using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Path helper methods for TargetBuilder.
///
/// Path helpers return fully-qualified output paths prefixed with a location
/// token Nx understands: <c>{projectRoot}/…</c> for paths inside the project
/// directory (the MSBuild default) and <c>{workspaceRoot}/…</c> for paths that
/// escape the project directory but remain inside the workspace (for example
/// a centralized <c>dist/</c> folder configured via <c>Directory.Build.props</c>).
/// Paths that escape the workspace are emitted as-is.
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
    /// Resolves a raw MSBuild path string to an Nx-prefixed output path.
    /// - Relative paths are treated as project-relative (MSBuild convention)
    ///   and returned with a <c>{projectRoot}/</c> prefix.
    /// - Absolute paths under the project directory are returned relative to
    ///   the project directory with a <c>{projectRoot}/</c> prefix.
    /// - Absolute paths elsewhere in the workspace are returned relative to
    ///   the workspace root with a <c>{workspaceRoot}/</c> prefix.
    /// - Absolute paths outside the workspace are returned as-is (forward-slashed).
    /// </summary>
    private static string ResolvePath(string path, string projectDirectory, string workspaceRoot)
    {
        if (string.IsNullOrEmpty(path))
        {
            return path;
        }

        if (!Path.IsPathRooted(path))
        {
            var normalized = path.Replace('\\', '/').TrimEnd('/');
            return string.IsNullOrEmpty(normalized) ? "{projectRoot}" : $"{{projectRoot}}/{normalized}";
        }

        var normalizedPath = Path.GetFullPath(path);
        var normalizedProject = Path.GetFullPath(projectDirectory);
        var normalizedWorkspace = Path.GetFullPath(workspaceRoot);

        if (IsUnder(normalizedPath, normalizedProject))
        {
            var relative = Path.GetRelativePath(normalizedProject, normalizedPath)
                .Replace('\\', '/').TrimEnd('/');
            return relative == "." || string.IsNullOrEmpty(relative)
                ? "{projectRoot}"
                : $"{{projectRoot}}/{relative}";
        }

        if (IsUnder(normalizedPath, normalizedWorkspace))
        {
            var relative = Path.GetRelativePath(normalizedWorkspace, normalizedPath)
                .Replace('\\', '/').TrimEnd('/');
            return relative == "." || string.IsNullOrEmpty(relative)
                ? "{workspaceRoot}"
                : $"{{workspaceRoot}}/{relative}";
        }

        // Absolute path outside the workspace - return as-is for Nx to treat as absolute.
        return normalizedPath.Replace('\\', '/').TrimEnd('/');
    }

    /// <summary>
    /// Returns true when <paramref name="candidate"/> is the same as, or a
    /// descendant of, <paramref name="parent"/>. Uses path-aware comparison so
    /// a prefix like <c>/foo</c> does not match <c>/foobar</c>.
    /// </summary>
    private static bool IsUnder(string candidate, string parent)
    {
        if (candidate.Equals(parent, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var parentWithSep = parent.EndsWith(Path.DirectorySeparatorChar) || parent.EndsWith(Path.AltDirectorySeparatorChar)
            ? parent
            : parent + Path.DirectorySeparatorChar;

        return candidate.StartsWith(parentWithSep, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Gets the artifacts root path relative to the workspace root (defaults to "artifacts").
    /// Used when constructing paths under the artifacts output layout.
    /// </summary>
    private static string GetArtifactsRelativePath(Dictionary<string, string> properties, string workspaceRoot)
    {
        var artifactsPath = properties.GetValueOrDefault("ArtifactsPath") ?? "artifacts";
        if (!Path.IsPathRooted(artifactsPath))
        {
            return artifactsPath.Replace('\\', '/').TrimEnd('/');
        }

        var normalizedPath = Path.GetFullPath(artifactsPath);
        var normalizedWorkspaceRoot = Path.GetFullPath(workspaceRoot);

        if (IsUnder(normalizedPath, normalizedWorkspaceRoot))
        {
            return Path.GetRelativePath(normalizedWorkspaceRoot, normalizedPath)
                .Replace('\\', '/').TrimEnd('/');
        }

        return normalizedPath.Replace('\\', '/').TrimEnd('/');
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
    /// Gets the output directory path for build outputs, as a fully-qualified
    /// Nx-prefixed string. Handles both traditional and artifacts layouts.
    /// </summary>
    private static string GetOutputPath(Dictionary<string, string> properties, string projectName, string projectDirectory, string workspaceRoot)
    {
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsRelativePath(properties, workspaceRoot);
            return $"{{workspaceRoot}}/{artifactsPath}/bin/{projectName}";
        }

        var baseOutputPath = properties.GetValueOrDefault("BaseOutputPath");
        if (!string.IsNullOrEmpty(baseOutputPath))
        {
            return ResolvePath(baseOutputPath, projectDirectory, workspaceRoot);
        }

        var outputPath = properties.GetValueOrDefault("OutputPath")
            ?? properties.GetValueOrDefault("OutDir")
            ?? "bin";

        return StripConfiguration(ResolvePath(outputPath, projectDirectory, workspaceRoot));
    }

    /// <summary>
    /// Gets the intermediate output directory path (obj), as a fully-qualified
    /// Nx-prefixed string.
    /// </summary>
    private static string GetIntermediateOutputPath(Dictionary<string, string> properties, string projectName, string projectDirectory, string workspaceRoot)
    {
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsRelativePath(properties, workspaceRoot);
            return $"{{workspaceRoot}}/{artifactsPath}/obj/{projectName}";
        }

        var baseIntermediatePath = properties.GetValueOrDefault("BaseIntermediateOutputPath");
        if (!string.IsNullOrEmpty(baseIntermediatePath))
        {
            return ResolvePath(baseIntermediatePath, projectDirectory, workspaceRoot);
        }

        var intermediatePath = properties.GetValueOrDefault("IntermediateOutputPath") ?? "obj";

        return StripConfiguration(ResolvePath(intermediatePath, projectDirectory, workspaceRoot));
    }

    /// <summary>
    /// Gets the publish output directory path, as a fully-qualified Nx-prefixed string.
    /// </summary>
    private static string GetPublishDir(Dictionary<string, string> properties, string projectName, string projectDirectory, string workspaceRoot)
    {
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsRelativePath(properties, workspaceRoot);
            return $"{{workspaceRoot}}/{artifactsPath}/publish/{projectName}";
        }

        var publishDir = properties.GetValueOrDefault("PublishDir");
        if (!string.IsNullOrEmpty(publishDir))
        {
            return ResolvePath(publishDir, projectDirectory, workspaceRoot);
        }

        var outputPath = GetOutputPath(properties, projectName, projectDirectory, workspaceRoot);
        return $"{outputPath.TrimEnd('/')}/publish";
    }

    /// <summary>
    /// Gets the package output directory path, as a fully-qualified Nx-prefixed string.
    /// </summary>
    private static string GetPackageOutputPath(Dictionary<string, string> properties, string projectName, string projectDirectory, string workspaceRoot)
    {
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsRelativePath(properties, workspaceRoot);
            return $"{{workspaceRoot}}/{artifactsPath}/package";
        }

        var packageOutputPath = properties.GetValueOrDefault("PackageOutputPath");
        if (!string.IsNullOrEmpty(packageOutputPath))
        {
            return ResolvePath(packageOutputPath, projectDirectory, workspaceRoot);
        }

        return GetOutputPath(properties, projectName, projectDirectory, workspaceRoot);
    }

    /// <summary>
    /// Gets the test results directory path, as a fully-qualified Nx-prefixed string.
    /// </summary>
    private static string GetTestResultsDirectory(Dictionary<string, string> properties, string projectName, string projectDirectory, string workspaceRoot)
    {
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsRelativePath(properties, workspaceRoot);
            return $"{{workspaceRoot}}/{artifactsPath}/TestResults/{projectName}";
        }

        var testResultsDir = properties.GetValueOrDefault("TestResultsDirectory");
        if (!string.IsNullOrEmpty(testResultsDir))
        {
            return ResolvePath(testResultsDir, projectDirectory, workspaceRoot);
        }

        return "{projectRoot}/TestResults";
    }
}
