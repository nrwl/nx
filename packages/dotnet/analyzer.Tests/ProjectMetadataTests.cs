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
    public void InfersLibrariesFromLibraryOutputType()
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[] { Properties(("OutputType", "Library")) });

        Assert.Equal("library", projectType);
    }

    [Fact]
    public void DoesNotTreatCapabilitiesAsProjectTypes()
    {
        var projectType = ProjectUtilities.InferProjectType(
            new[]
            {
                Properties(
                    ("OutputType", "Library"),
                    ("IsTestProject", "true"),
                    ("IsPackable", "true"),
                    ("PackAsTool", "true"))
            });

        Assert.Equal("library", projectType);
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
