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
    /// PackageVersion items. We mirror MSBuild's "first ancestor wins" rule so the inputs match
    /// what the build actually reads — over-declaring would let unrelated shadowed parents bust
    /// the cache.
    /// </summary>
    public static readonly string[] DirectoryBuildFileNames =
    {
        "Directory.Build.props",
        "Directory.Build.targets",
        "Directory.Build.rsp",
        "Directory.Solution.props",
        "Directory.Solution.targets",
        "Directory.Packages.props",
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
    /// For a given project, find the closest ancestor occurrence of each Directory.* filename
    /// using the pre-built directory→filename-set index. Returns paths suitable for use as Nx
    /// inputs (prefixed with "{workspaceRoot}/...").
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
                    if (!found.ContainsKey(fileName) && filesInDir.Contains(fileName))
                    {
                        var path = relativeDir == "."
                            ? fileName
                            : $"{relativeDir}/{fileName}";
                        found[fileName] = path;
                        inputs.Add($"{{workspaceRoot}}/{path}");
                    }
                }
            }

            if (found.Count == DirectoryBuildFileNames.Length)
            {
                break;
            }

            if (string.Equals(normalizedDir, workspaceRootFull, StringComparison.OrdinalIgnoreCase))
            {
                break;
            }

            dir = Directory.GetParent(normalizedDir)?.FullName;
        }

        return inputs;
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
    /// Resolves the runtime identifiers for an evaluated inner build. The plural
    /// <c>RuntimeIdentifiers</c> is authoritative when it declares any value;
    /// otherwise the evaluated singular <c>RuntimeIdentifier</c> is used (which may
    /// be an SDK default for platform frameworks). Values are split on ';',
    /// trimmed, de-duplicated, and sorted for stable output. Returns an empty list
    /// when neither is set.
    /// </summary>
    public static List<string> ResolveRuntimeIdentifiers(string? singular, string? plural)
    {
        var rids = new List<string>();

        void Add(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                return;
            }
            foreach (var rid in raw.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!rids.Contains(rid, StringComparer.Ordinal))
                {
                    rids.Add(rid);
                }
            }
        }

        // Plural wins outright when present: a declared RuntimeIdentifiers list must
        // not be polluted by an unrelated SDK-implicit singular RuntimeIdentifier.
        Add(plural);
        if (rids.Count == 0)
        {
            Add(singular);
        }

        rids.Sort(StringComparer.Ordinal);
        return rids;
    }

    /// <summary>
    /// Whether the publish output directory can be derived as
    /// <c>&lt;OutputPath&gt;/publish</c>. True when <paramref name="publishDir"/> is
    /// empty (the SDK default) or normalizes to exactly that; false for a custom or
    /// fixed publish directory, which the per-RID output derivation can't model and
    /// might collide across RIDs.
    /// </summary>
    public static bool IsPublishDirDerivable(string? publishDir, string? outputPath)
    {
        if (string.IsNullOrWhiteSpace(publishDir))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(outputPath))
        {
            return false;
        }

        var pub = publishDir.Replace('\\', '/').TrimEnd('/');
        var expected = outputPath.Replace('\\', '/').TrimEnd('/') + "/publish";
        return string.Equals(pub, expected, StringComparison.OrdinalIgnoreCase);
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
