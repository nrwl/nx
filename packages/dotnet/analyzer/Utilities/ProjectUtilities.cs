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
