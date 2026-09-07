using System.Diagnostics;
using System.Text.Json;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// End-to-end checks that run the analyzer the way the plugin does: as a
/// process, against a real project, with MSBuild doing the evaluation.
///
/// The rest of the suite hands <see cref="Utilities.TargetBuilder.BuildTargets"/>
/// a hand-built property dictionary, which cannot catch a wrong assumption about
/// what MSBuild actually evaluates - the fixture simply asserts whatever the
/// author believed. Two real defects reached review that way: a package whose
/// props default OpenApiDocumentsDirectory to $(BaseIntermediateOutputPath), and
/// PackageOutputPath always being set to a Debug path the pack target never
/// writes to. These tests cover that seam; they are deliberately few, since each
/// one pays for a process launch and a full MSBuild evaluation.
/// </summary>
public class AnalyzerSmokeTests : IDisposable
{
    private readonly string _workspaceRoot =
        Path.Combine(Path.GetTempPath(), "nx-dotnet-smoke-" + Guid.NewGuid().ToString("n"));

    public void Dispose()
    {
        if (Directory.Exists(_workspaceRoot))
        {
            Directory.Delete(_workspaceRoot, recursive: true);
        }
        GC.SuppressFinalize(this);
    }

    private string WriteProject(string projectName, string propertyGroup, string? directoryBuildProps = null)
    {
        var projectDirectory = Path.Combine(_workspaceRoot, "apps", projectName);
        Directory.CreateDirectory(projectDirectory);

        if (directoryBuildProps is not null)
        {
            File.WriteAllText(
                Path.Combine(_workspaceRoot, "Directory.Build.props"),
                $"<Project><PropertyGroup>{directoryBuildProps}</PropertyGroup></Project>");
        }

        var projectFile = Path.Combine(projectDirectory, $"{projectName}.csproj");
        File.WriteAllText(projectFile, $"""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                {propertyGroup}
              </PropertyGroup>
            </Project>
            """);

        return projectFile;
    }

    /// <summary>
    /// Runs the analyzer over one project and returns that project's targets.
    /// The analyzer registers MSBuildLocator itself, so it has to run out of
    /// process - registering in the test host would fight the runner over which
    /// MSBuild assemblies get loaded.
    /// </summary>
    private Dictionary<string, JsonElement> Analyze(string projectFile)
    {
        // Both MsbuildAnalyzer.dll and its runtimeconfig.json land next to the
        // test assembly via the project reference.
        var analyzer = Path.Combine(AppContext.BaseDirectory, "MsbuildAnalyzer.dll");
        Assert.True(File.Exists(analyzer), $"Analyzer not found at {analyzer}");

        var startInfo = new ProcessStartInfo("dotnet")
        {
            ArgumentList = { analyzer, _workspaceRoot },
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };

        using var process = Process.Start(startInfo)!;
        // First stdin line is the plugin-options slot; empty means defaults.
        process.StandardInput.WriteLine(string.Empty);
        process.StandardInput.WriteLine(projectFile);
        process.StandardInput.Close();

        var stdout = process.StandardOutput.ReadToEnd();
        var stderr = process.StandardError.ReadToEnd();
        Assert.True(process.WaitForExit(milliseconds: 180_000), "Analyzer timed out");
        Assert.True(process.ExitCode == 0, $"Analyzer exited {process.ExitCode}. stderr:\n{stderr}");

        var relativeProjectFile = Path.GetRelativePath(_workspaceRoot, projectFile).Replace('\\', '/');
        var result = JsonDocument.Parse(stdout).RootElement;

        return result
            .GetProperty("nodesByFile")
            .GetProperty(relativeProjectFile)
            .GetProperty("targets")
            .EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value);
    }

    private static string[] Outputs(Dictionary<string, JsonElement> targets, string targetName) =>
        [.. targets[targetName].GetProperty("outputs").EnumerateArray().Select(o => o.GetString()!)];

    [Fact]
    public void DefaultProject_DeclaresBinAndObj()
    {
        var targets = Analyze(WriteProject("MyLib", ""));

        Assert.Equal(new[] { "{projectRoot}/bin", "{projectRoot}/obj" }, Outputs(targets, "build"));
    }

    [Fact]
    public void OpenApiDocumentsDirectory_DeclaresTheDocumentGlobs()
    {
        var projectFile = WriteProject(
            "MyApi",
            "<OpenApiDocumentsDirectory>$(MSBuildProjectDirectory)/openapi</OpenApiDocumentsDirectory>");

        var targets = Analyze(projectFile);

        Assert.Equal(
            new[]
            {
                "{projectRoot}/bin",
                "{projectRoot}/obj",
                "{projectRoot}/openapi/MyApi.json",
                "{projectRoot}/openapi/MyApi_*.json",
            },
            Outputs(targets, "build"));
    }

    [Fact]
    public void Pack_DeclaresTheReleasePackageDirectory()
    {
        // MSBuild always evaluates PackageOutputPath, and does so at the default
        // Debug configuration, while pack runs --configuration Release. No
        // hand-built fixture caught this because none of them set the property.
        var targets = Analyze(WriteProject("MyLib", ""));

        Assert.Equal(
            new[] { "{projectRoot}/bin/Release/*.nupkg", "{projectRoot}/obj" },
            Outputs(targets, "pack"));
    }

    [Fact]
    public void ArtifactsLayout_DeclaresTheMSBuildProjectNameNotTheNxName()
    {
        // ArtifactsProjectName defaults to MSBuildProjectName. Naming the project
        // something else for Nx must not move the declared output.
        var projectFile = WriteProject(
            "Renamed",
            "<Nx><Name>my-renamed-api</Name></Nx>",
            directoryBuildProps: "<UseArtifactsOutput>true</UseArtifactsOutput>");

        var targets = Analyze(projectFile);

        Assert.Equal(
            new[]
            {
                "{workspaceRoot}/artifacts/bin/Renamed",
                "{workspaceRoot}/artifacts/obj/Renamed",
            },
            Outputs(targets, "build"));
    }
}
