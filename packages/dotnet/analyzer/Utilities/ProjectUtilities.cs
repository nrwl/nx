using Microsoft.Build.Execution;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Utility methods for working with .NET projects.
/// </summary>
public static class ProjectUtilities
{
    /// <summary>
    /// Gets the relative path from workspace root to the project's directory.
    /// </summary>
    public static string GetRelativeProjectRoot(string projectPath, string workspaceRoot)
    {
        var projectDir = Path.GetDirectoryName(projectPath)!;
        var relativePath = Path.GetRelativePath(workspaceRoot, projectDir);
        return relativePath.Replace(Path.DirectorySeparatorChar, '/');
    }

    /// <summary>
    /// Gets the relative path from workspace root to the project file.
    /// </summary>
    public static string GetRelativeProjectFile(string projectPath, string workspaceRoot)
    {
        var relativePath = Path.GetRelativePath(workspaceRoot, projectPath);
        return relativePath.Replace(Path.DirectorySeparatorChar, '/');
    }

    /// <summary>
    /// Generates an Nx project name from a project file path.
    /// Prefers the Name property from the Nx PropertyGroup, falls back to MSBuildProjectName.
    /// </summary>
    public static string GetProjectName(ProjectInstance project)
    {
        var nxXml = project.GetPropertyValue("Nx");
        if (!string.IsNullOrEmpty(nxXml))
        {
            // Parse the XML to extract the Name element
            using (var reader = System.Xml.XmlReader.Create(new StringReader(nxXml)))
            {
                while (reader.Read())
                {
                    if (reader.IsStartElement("Name"))
                    {
                        return reader.ReadElementContentAsString();
                    }
                }
            }
        }

        // Fall back to MSBuildProjectName
        var msbuildProjectName = project.GetPropertyValue("MSBuildProjectName");
        if (string.IsNullOrEmpty(msbuildProjectName))
        {
            throw new ArgumentException("ProjectInstance must have a valid MSBuildProjectName.");
        }

        return msbuildProjectName;
    }

    /// <summary>
    /// Directory.Build.props/.targets are auto-imported by Microsoft.Common.props/.targets, walking
    /// up from the project to the first ancestor that defines them. Directory.Build.rsp is read by
    /// the dotnet CLI from the same walk. Directory.Solution.props/.targets apply for .sln builds.
    /// Directory.Packages.props is read by the Central Package Management SDK import to source
    /// PackageVersion items. global.json is read by the SDK resolver walking up from the
    /// invocation directory. We mirror the "first ancestor wins" rule they share so the inputs
    /// match what the build actually reads — over-declaring would let unrelated shadowed
    /// parents bust the cache.
    /// </summary>
    public static readonly string[] DirectoryBuildFileNames =
    {
        "Directory.Build.props",
        "Directory.Build.targets",
        "Directory.Build.rsp",
        "Directory.Solution.props",
        "Directory.Solution.targets",
        "Directory.Packages.props",
        "global.json",
    };

    /// <summary>
    /// Files every ancestor contributes rather than only the nearest: NuGet merges each
    /// nuget.config on the walk to the root, and analyzers read each .editorconfig up to
    /// the one that sets root=true, which we do not parse for.
    /// </summary>
    public static readonly string[] CascadingFileNames =
    {
        "nuget.config",
        ".editorconfig",
    };

    /// <summary>
    /// .NET project file extensions. Used both to partition stdin input and to filter the MSBuild
    /// project graph — imported files such as Directory.Build.props can surface as graph nodes
    /// depending on the SDK version, and they must never be treated as buildable projects.
    /// </summary>
    public static bool IsProjectFile(string path)
    {
        var ext = Path.GetExtension(path);
        return ext.Equals(".csproj", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".fsproj", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".vbproj", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// For a given project, find the closest ancestor occurrence of each
    /// <see cref="DirectoryBuildFileNames"/> entry and every ancestor occurrence of each
    /// <see cref="CascadingFileNames"/> entry, using the pre-built directory→filename-set
    /// index. Names match case-insensitively but the declared path keeps the on-disk casing,
    /// since on a case-sensitive filesystem the two spellings are different files. Returns
    /// paths suitable for use as Nx inputs (prefixed with "{workspaceRoot}/...").
    /// </summary>
    public static List<string> GetDirectoryBuildInputs(
        string projectPath,
        string workspaceRoot,
        Dictionary<string, HashSet<string>> filesByDir)
    {
        if (filesByDir.Count == 0)
        {
            return new List<string>();
        }

        var workspaceRootFull = Path.GetFullPath(workspaceRoot)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var dir = Path.GetDirectoryName(Path.GetFullPath(projectPath));

        var found = new Dictionary<string, string>();
        var inputs = new List<string>();

        while (!string.IsNullOrEmpty(dir))
        {
            var normalizedDir = dir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (!IsSameOrUnder(normalizedDir, workspaceRootFull))
            {
                break;
            }

            var relativeDir = string.Equals(normalizedDir, workspaceRootFull, StringComparison.OrdinalIgnoreCase)
                ? "."
                : Path.GetRelativePath(workspaceRootFull, normalizedDir).Replace('\\', '/');

            if (filesByDir.TryGetValue(relativeDir, out var filesInDir))
            {
                foreach (var fileName in DirectoryBuildFileNames)
                {
                    if (!found.ContainsKey(fileName) && filesInDir.TryGetValue(fileName, out var onDiskName))
                    {
                        var path = relativeDir == "."
                            ? onDiskName
                            : $"{relativeDir}/{onDiskName}";
                        found[fileName] = path;
                        inputs.Add($"{{workspaceRoot}}/{path}");
                    }
                }

                foreach (var fileName in CascadingFileNames)
                {
                    if (filesInDir.TryGetValue(fileName, out var onDiskName))
                    {
                        var path = relativeDir == "."
                            ? onDiskName
                            : $"{relativeDir}/{onDiskName}";
                        inputs.Add($"{{workspaceRoot}}/{path}");
                    }
                }
            }

            if (string.Equals(normalizedDir, workspaceRootFull, StringComparison.OrdinalIgnoreCase))
            {
                break;
            }

            dir = Directory.GetParent(normalizedDir)?.FullName;
        }

        return inputs;
    }

    /// <summary>
    /// Workspace-relative, forward-slashed paths for the absolute paths that lie inside
    /// the workspace. SDK and package imports lie outside it and are dropped.
    /// </summary>
    public static List<string> GetWorkspaceRelativePaths(string workspaceRoot, IEnumerable<string> absolutePaths)
    {
        var root = Path.GetFullPath(workspaceRoot)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var result = new SortedSet<string>(StringComparer.Ordinal);

        foreach (var absolutePath in absolutePaths)
        {
            var full = Path.GetFullPath(absolutePath);
            if (string.Equals(full, root, StringComparison.OrdinalIgnoreCase) || !IsSameOrUnder(full, root))
            {
                continue;
            }
            result.Add(Path.GetRelativePath(root, full).Replace('\\', '/'));
        }

        return result.ToList();
    }

    /// <summary>
    /// Nx inputs for the files MSBuild pulled into a project from outside its directory:
    /// imports, linked sources, analyzer AdditionalFiles. Files under the project directory
    /// are already covered by the {projectRoot} input, and files outside the workspace
    /// cannot be hashed.
    /// </summary>
    public static List<string> GetSharedInputs(string projectDirectory, string workspaceRoot, IEnumerable<string> absolutePaths)
    {
        var project = Path.GetFullPath(projectDirectory)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var outsideProject = absolutePaths.Where(p => !IsSameOrUnder(Path.GetFullPath(p), project));

        return GetWorkspaceRelativePaths(workspaceRoot, outsideProject)
            .Select(relative => $"{{workspaceRoot}}/{relative}")
            .ToList();
    }

    private static bool IsSameOrUnder(string path, string root)
    {
        if (string.Equals(path, root, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
        var rootWithSep = root + Path.DirectorySeparatorChar;
        return path.StartsWith(rootWithSep, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Gets the list of technologies for a project based on its file type and characteristics.
    /// </summary>
    public static List<string> GetTechnologies(string projectPath)
    {
        var techs = new List<string> { "dotnet" };

        var ext = Path.GetExtension(projectPath).ToLowerInvariant();
        if (ext == ".csproj")
        {
            techs.Add("C#");
        }
        else if (ext == ".fsproj")
        {
            techs.Add("F#");
        }
        else if (ext == ".vbproj")
        {
            techs.Add("VB");
        }


        return techs;
    }
}
