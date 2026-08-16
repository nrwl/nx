using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

public class ProjectMetadataTests
{
    [Theory]
    [InlineData("Exe")]
    [InlineData("WinExe")]
    public void InfersApplicationsFromExecutableOutputTypes(string outputType)
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[] { Properties(("OutputType", outputType)) });

        Assert.Equal("application", projectType);
    }

    [Fact]
    public void InfersApplicationsWhenTargetFrameworkOutputTypesAgree()
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[]
            {
                Properties(("OutputType", "Exe")),
                Properties(("OutputType", "WinExe"))
            });

        Assert.Equal("application", projectType);
    }

    [Fact]
    public void InfersLibrariesFromLibraryOutputType()
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[] { Properties(("OutputType", "Library")) });

        Assert.Equal("library", projectType);
    }

    [Fact]
    public void KeepsLibraryOutputTestProjectsClassifiedAsLibraries()
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[]
            {
                Properties(
                    ("OutputType", "Library"),
                    ("IsTestProject", "true"),
                    ("IsPackable", "true"),
                    ("PackAsTool", "true"))
            },
            isTestProject: true);

        Assert.Equal("library", projectType);
    }

    [Theory]
    [InlineData("Exe")]
    [InlineData("WinExe")]
    public void LeavesExecutableTestProjectsUnclassified(string outputType)
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[] { Properties(("OutputType", outputType)) },
            isTestProject: true);

        Assert.Null(projectType);
    }

    [Fact]
    public void LeavesConflictingTargetFrameworksUnclassified()
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[]
            {
                Properties(("OutputType", "Exe")),
                Properties(("OutputType", "Library"))
            });

        Assert.Null(projectType);
    }

    [Theory]
    [InlineData("")]
    [InlineData("AppContainerExe")]
    public void LeavesUnknownOutputTypesUnclassified(string outputType)
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[] { Properties(("OutputType", outputType)) });

        Assert.Null(projectType);
    }

    [Fact]
    public void LeavesMissingOutputTypesUnclassified()
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[] { Properties(("IsTestProject", "true")) });

        Assert.Null(projectType);
    }

    [Fact]
    public void AddsStableEvaluatedSdkTechnologies()
    {
        var technologies = ProjectUtilities.GetTechnologies(
            "apps/MyApp/MyApp.csproj",
            new[]
            {
                Properties(
                    ("UsingMicrosoftNETSdkWeb", "true"),
                    ("UseMaui", "True"))
            });

        Assert.Equal(
            new[] { "dotnet", "C#", "ASP.NET Core", ".NET MAUI" },
            technologies);
    }

    [Fact]
    public void AddsWebAssemblyTechnology()
    {
        var technologies = ProjectUtilities.GetTechnologies(
            "apps/MyApp/MyApp.csproj",
            new[]
            {
                Properties(("UsingMicrosoftNETSdkWebAssembly", "true"))
            });

        Assert.Equal(new[] { "dotnet", "C#", "WebAssembly" }, technologies);
    }

    [Fact]
    public void AddsBlazorWebAssemblyTechnologies()
    {
        var technologies = ProjectUtilities.GetTechnologies(
            "apps/MyApp/MyApp.csproj",
            new[]
            {
                Properties(
                    ("UsingMicrosoftNETSdkBlazorWebAssembly", "true"),
                    ("UsingMicrosoftNETSdkWebAssembly", "true"))
            });

        Assert.Equal(
            new[] { "dotnet", "C#", "Blazor", "Blazor WebAssembly", "WebAssembly" },
            technologies);
    }

    [Fact]
    public void AddsMauiBlazorHybridTechnologies()
    {
        var technologies = ProjectUtilities.GetTechnologies(
            "apps/MyApp/MyApp.csproj",
            new[] { Properties(("UseMaui", "true")) },
            new[]
            {
                new PackageReference
                {
                    Include = "Microsoft.AspNetCore.Components.WebView.Maui"
                }
            });

        Assert.Equal(
            new[] { "dotnet", "C#", ".NET MAUI", "Blazor", "Blazor Hybrid" },
            technologies);
    }

    [Fact]
    public void AggregatesDistinctPackageReferencesAcrossTargetFrameworks()
    {
        var webViewMaui = new PackageReference
        {
            Include = "Microsoft.AspNetCore.Components.WebView.Maui",
            Version = "9.0.0"
        };

        var packageReferences = Analyzer.AggregatePackageReferences(
            new[]
            {
                Array.Empty<PackageReference>(),
                new[] { webViewMaui },
                new[] { webViewMaui }
            });

        Assert.Equal(new[] { webViewMaui }, packageReferences);
    }

    [Fact]
    public void DoesNotInferBlazorFromRazorSdk()
    {
        var technologies = ProjectUtilities.GetTechnologies(
            "apps/MyApp/MyApp.csproj",
            new[]
            {
                Properties(
                    ("UsingMicrosoftNETSdkWeb", "true"),
                    ("UsingMicrosoftNETSdkRazor", "true"))
            });

        Assert.Equal(new[] { "dotnet", "C#", "ASP.NET Core" }, technologies);
    }

    [Fact]
    public void DoesNotTreatOtherCapabilitiesAsTechnologies()
    {
        var technologies = ProjectUtilities.GetTechnologies(
            "libs/MyLibrary/MyLibrary.fsproj",
            new[]
            {
                Properties(
                    ("IsTestProject", "true"),
                    ("IsPackable", "true"),
                    ("PackAsTool", "true"))
            });

        Assert.Equal(new[] { "dotnet", "F#" }, technologies);
    }

    private static IReadOnlyDictionary<string, string> Properties(
        params (string Name, string Value)[] properties)
    {
        return properties.ToDictionary(property => property.Name, property => property.Value);
    }
}
