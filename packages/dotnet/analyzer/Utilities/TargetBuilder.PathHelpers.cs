using System.Text.RegularExpressions;
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
/// Paths that escape the workspace cannot be expressed as Nx outputs, so the
/// helpers return <c>null</c> for that case and callers filter them out.
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
    /// - Absolute paths outside the workspace cannot be expressed as Nx
    ///   outputs and return <c>null</c> so callers can drop them.
    /// </summary>
    private static string? ResolvePath(string path, string projectDirectory, string workspaceRoot)
    {
        if (string.IsNullOrEmpty(path))
        {
            return null;
        }

        // Relative paths are project-relative (MSBuild convention). Anchor them
        // and fall through so `.` and `..` normalize like absolute paths.
        if (!Path.IsPathRooted(path))
        {
            path = Path.Combine(projectDirectory, path.Replace('\\', '/'));
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

        // Absolute path outside the workspace cannot be tokenized as an Nx
        // output. Drop it rather than emit something Nx can't honour.
        return null;
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
    /// Used when constructing paths under the artifacts output layout. Returns
    /// <c>null</c> when the configured path lives outside the workspace, since
    /// Nx outputs must be expressible relative to <c>{workspaceRoot}</c>.
    /// </summary>
    private static string? GetArtifactsRelativePath(Dictionary<string, string> properties, string workspaceRoot)
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

        return null;
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
    /// Builds an artifacts-layout subdirectory from the names MSBuild evaluated,
    /// rather than hard-coding them: every segment
    /// (<c>ArtifactsPath</c>, the output name, <c>ArtifactsProjectName</c>) is
    /// overridable, and <c>ArtifactsProjectName</c> defaults to
    /// <c>MSBuildProjectName</c>, which is not the Nx project name.
    /// The pivot segment is deliberately omitted so one output covers every
    /// configuration. Returns <c>null</c> when the path escapes the workspace.
    /// </summary>
    private static string? GetArtifactsSubdirectory(
        Dictionary<string, string> properties,
        string workspaceRoot,
        string outputNameProperty,
        string defaultOutputName,
        bool includeProjectName)
    {
        var artifactsPath = GetArtifactsRelativePath(properties, workspaceRoot);
        if (artifactsPath is null)
        {
            return null;
        }

        var outputName = properties.GetValueOrDefault(outputNameProperty) ?? defaultOutputName;
        var path = $"{{workspaceRoot}}/{artifactsPath}/{outputName}";

        if (!includeProjectName)
        {
            return path;
        }

        var artifactsProjectName = properties.GetValueOrDefault("ArtifactsProjectName")
            ?? properties.GetValueOrDefault("MSBuildProjectName");

        return string.IsNullOrEmpty(artifactsProjectName) ? path : $"{path}/{artifactsProjectName}";
    }

    /// <summary>
    /// Gets the output directory path for build outputs, as a fully-qualified
    /// Nx-prefixed string. Handles both traditional and artifacts layouts.
    /// Returns <c>null</c> when the path lives outside the workspace.
    /// </summary>
    private static string? GetOutputPath(Dictionary<string, string> properties, string projectDirectory, string workspaceRoot)
    {
        var baseOutputPath = properties.GetValueOrDefault("BaseOutputPath");
        if (!string.IsNullOrEmpty(baseOutputPath))
        {
            return ResolvePath(baseOutputPath, projectDirectory, workspaceRoot);
        }

        var outputPath = properties.GetValueOrDefault("OutputPath")
            ?? properties.GetValueOrDefault("OutDir")
            ?? "bin";

        var resolved = ResolvePath(outputPath, projectDirectory, workspaceRoot);
        return resolved is null ? null : StripConfiguration(resolved);
    }

    /// <summary>
    /// Gets the intermediate output directory path (obj), as a fully-qualified
    /// Nx-prefixed string. Returns <c>null</c> when the path lives outside the
    /// workspace.
    /// </summary>
    private static string? GetIntermediateOutputPath(Dictionary<string, string> properties, string projectDirectory, string workspaceRoot)
    {
        var baseIntermediatePath = properties.GetValueOrDefault("BaseIntermediateOutputPath");
        if (!string.IsNullOrEmpty(baseIntermediatePath))
        {
            return ResolvePath(baseIntermediatePath, projectDirectory, workspaceRoot);
        }

        var intermediatePath = properties.GetValueOrDefault("IntermediateOutputPath") ?? "obj";

        var resolved = ResolvePath(intermediatePath, projectDirectory, workspaceRoot);
        return resolved is null ? null : StripConfiguration(resolved);
    }

    /// <summary>
    /// Gets the publish output directory path, as a fully-qualified Nx-prefixed
    /// string. Returns <c>null</c> when the path lives outside the workspace.
    /// </summary>
    private static string? GetPublishDir(Dictionary<string, string> properties, string? defaultConfiguration, string projectDirectory, string workspaceRoot)
    {
        if (UsesArtifactsOutput(properties))
        {
            // PublishDir carries the pivot (…/publish/<project>/debug), which is
            // per-configuration. Declare its parent so one output covers every
            // configuration, as the bin and obj outputs do.
            return GetArtifactsSubdirectory(properties, workspaceRoot, "ArtifactsPublishOutputName", "publish", includeProjectName: true);
        }

        // PublishDir (e.g. "bin/Debug/publish") is evaluated by MSBuild at the
        // project's default Configuration, but the publish target runs with the
        // Configuration in `properties` (Release). Rewrite the configuration
        // segment so the declared output matches where the publish actually lands.
        var publishDir = properties.GetValueOrDefault("PublishDir");
        if (!string.IsNullOrEmpty(publishDir))
        {
            var resolved = ResolvePath(publishDir, projectDirectory, workspaceRoot);
            return ApplyConfiguration(resolved, defaultConfiguration, properties.GetValueOrDefault("Configuration"));
        }

        var outputPath = GetOutputPath(properties, projectDirectory, workspaceRoot);
        return outputPath is null ? null : $"{outputPath.TrimEnd('/')}/publish";
    }

    /// <summary>
    /// Rewrites the segments MSBuild produced from <paramref name="defaultConfiguration"/>
    /// to <paramref name="targetConfiguration"/>. Used for paths (like PublishDir) that
    /// MSBuild evaluates at the project's default configuration but a target consumes at
    /// another. Matching the evaluated default exactly, rather than any Debug/Release
    /// segment, leaves a directory that merely happens to be named `release` alone.
    /// A no-op when either configuration is unknown.
    /// </summary>
    private static string? ApplyConfiguration(string? path, string? defaultConfiguration, string? targetConfiguration)
    {
        if (string.IsNullOrEmpty(path)
            || string.IsNullOrEmpty(defaultConfiguration)
            || string.IsNullOrEmpty(targetConfiguration))
        {
            return path;
        }

        var segments = path.Split('/');
        for (var i = 0; i < segments.Length; i++)
        {
            if (segments[i].Equals(defaultConfiguration, StringComparison.Ordinal))
            {
                segments[i] = targetConfiguration;
            }
        }

        return string.Join('/', segments);
    }

    /// <summary>
    /// Gets the package output directory path, as a fully-qualified Nx-prefixed
    /// string. Returns <c>null</c> when the path lives outside the workspace.
    /// </summary>
    private static string? GetPackageOutputPath(Dictionary<string, string> properties, string? defaultConfiguration, string projectDirectory, string workspaceRoot)
    {
        if (UsesArtifactsOutput(properties))
        {
            // The package layout has no per-project segment.
            return GetArtifactsSubdirectory(properties, workspaceRoot, "ArtifactsPackageOutputName", "package", includeProjectName: false);
        }

        // PackageOutputPath is evaluated at the project's default Configuration,
        // but pack runs at the Configuration in `properties` (Release). Rewrite
        // the configuration segment so the declared output matches where the
        // .nupkg lands, as GetPublishDir does for PublishDir.
        var packageOutputPath = properties.GetValueOrDefault("PackageOutputPath");
        if (!string.IsNullOrEmpty(packageOutputPath))
        {
            var resolved = ResolvePath(packageOutputPath, projectDirectory, workspaceRoot);
            return ApplyConfiguration(resolved, defaultConfiguration, properties.GetValueOrDefault("Configuration"));
        }

        return GetOutputPath(properties, projectDirectory, workspaceRoot);
    }

    /// <summary>
    /// Gets the directory Microsoft.Extensions.ApiDescription.Server writes the
    /// generated OpenAPI documents to, as a fully-qualified Nx-prefixed string.
    /// The property may point anywhere, so it resolves under the same rules as
    /// the other outputs. Returns <c>null</c> when the property is unset or the
    /// path lives outside the workspace.
    /// </summary>
    private static string? GetOpenApiDocumentsDirectory(Dictionary<string, string> properties, string projectDirectory, string workspaceRoot)
    {
        var openApiDocumentsDirectory = properties.GetValueOrDefault("OpenApiDocumentsDirectory");
        return string.IsNullOrEmpty(openApiDocumentsDirectory)
            ? null
            : ResolvePath(openApiDocumentsDirectory, projectDirectory, workspaceRoot);
    }

    /// <summary>
    /// Gets globs matching the OpenAPI documents dotnet-getdocument writes for
    /// this project: <c>&lt;stem&gt;.json</c> for the default document and
    /// <c>&lt;stem&gt;_&lt;document&gt;.json</c> for every other registered one, where
    /// the stem comes from <see cref="GetOpenApiDocumentFileName"/>.
    /// Globs rather than the directory: the directory may be the project root
    /// (the value the ASP.NET Core docs recommend) or shared with other projects.
    /// Two globs rather than <c>&lt;stem&gt;*.json</c>: the latter would also claim
    /// siblings that merely share the prefix, and a declared output is removed
    /// and rewritten on cache restore.
    /// Returns an empty array when the directory is already covered by an output.
    /// </summary>
    private static string[] GetOpenApiDocumentsOutputs(
        Dictionary<string, string> properties,
        string fileName,
        string projectDirectory,
        string workspaceRoot,
        params string?[] coveredDirectories)
    {
        var directory = GetOpenApiDocumentsDirectory(properties, projectDirectory, workspaceRoot);
        if (directory is null || coveredDirectories.Contains(directory))
        {
            return [];
        }

        var stem = GetOpenApiDocumentFileName(properties, fileName);
        return [$"{directory}/{stem}.json", $"{directory}/{stem}_*.json"];
    }

    /// <summary>
    /// Matches the <c>--file-name</c> option inside
    /// <c>$(OpenApiGenerateDocumentsOptions)</c>, which the package appends to the
    /// dotnet-getdocument command verbatim. The tool accepts
    /// <c>--file-name v</c>, <c>--file-name=v</c> and <c>--file-name:v</c>, and
    /// rejects any value outside <c>[A-Za-z0-9_-]</c>, so the value never has
    /// spaces to quote around.
    /// </summary>
    private static readonly Regex OpenApiFileNameOption = new(
        @"--file-name[=:\s]\s*""?(?<name>[^\s""]+)""?",
        RegexOptions.Compiled);

    /// <summary>
    /// Gets the file name stem dotnet-getdocument writes documents under:
    /// <c>&lt;stem&gt;.json</c> for the default document and
    /// <c>&lt;stem&gt;_&lt;document&gt;.json</c> for the rest. The stem is the project
    /// name unless <c>$(OpenApiGenerateDocumentsOptions)</c> overrides it with
    /// <c>--file-name</c>.
    /// </summary>
    private static string GetOpenApiDocumentFileName(Dictionary<string, string> properties, string fileName)
    {
        var options = properties.GetValueOrDefault("OpenApiGenerateDocumentsOptions");
        if (!string.IsNullOrWhiteSpace(options))
        {
            var match = OpenApiFileNameOption.Match(options);
            if (match.Success)
            {
                return match.Groups["name"].Value;
            }
        }

        return Path.GetFileNameWithoutExtension(fileName);
    }

    /// <summary>
    /// Gets the test results directory path, as a fully-qualified Nx-prefixed
    /// string. Returns <c>null</c> when the path lives outside the workspace.
    /// </summary>
    private static string? GetTestResultsDirectory(Dictionary<string, string> properties, string projectName, string projectDirectory, string workspaceRoot)
    {
        if (UsesArtifactsOutput(properties))
        {
            var artifactsPath = GetArtifactsRelativePath(properties, workspaceRoot);
            return artifactsPath is null ? null : $"{{workspaceRoot}}/{artifactsPath}/TestResults/{projectName}";
        }

        var testResultsDir = properties.GetValueOrDefault("TestResultsDirectory");
        if (!string.IsNullOrEmpty(testResultsDir))
        {
            return ResolvePath(testResultsDir, projectDirectory, workspaceRoot);
        }

        return "{projectRoot}/TestResults";
    }
}
