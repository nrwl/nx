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
    /// Converts PascalCase to kebab-case.
    /// </summary>
    public static string GetProjectName(string projectPath)
    {
        var filename = Path.GetFileNameWithoutExtension(projectPath);

        // Convert PascalCase to kebab-case
        var result = System.Text.RegularExpressions.Regex.Replace(
            filename,
            "([a-z])([A-Z])",
            "$1-$2"
        );

        // Replace non-alphanumeric characters with hyphens
        result = System.Text.RegularExpressions.Regex.Replace(
            result,
            "[^a-z0-9\\-]",
            "-",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase
        );

        // Collapse multiple hyphens
        result = System.Text.RegularExpressions.Regex.Replace(result, "-+", "-");

        return result.Trim('-').ToLowerInvariant();
    }

    /// <summary>
    /// Gets the list of technologies for a project based on its file type and characteristics.
    /// </summary>
    public static List<string> GetTechnologies(string projectPath, bool isTest)
    {
        var techs = new List<string> { "dotnet" };

        var ext = Path.GetExtension(projectPath).ToLowerInvariant();
        if (ext == ".csproj")
        {
            techs.Add("csharp");
        }
        else if (ext == ".fsproj")
        {
            techs.Add("fsharp");
        }
        else if (ext == ".vbproj")
        {
            techs.Add("vb");
        }

        if (isTest)
        {
            techs.Add("test");
        }

        return techs;
    }
}
