using MsbuildAnalyzer.Models;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// The two members that do more than look a name up: the project-extensions
/// fallback chain, and the configuration copy whose comparer decides whether a
/// property MSBuild spelled non-canonically stays readable.
/// </summary>
public class EvaluatedPropertiesTests
{
    private static EvaluatedProperties Properties(params (string Name, string Value)[] values)
    {
        var dictionary = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (name, value) in values)
        {
            dictionary[name] = value;
        }

        return dictionary;
    }

    /// <summary>
    /// The members look themselves up with <c>nameof</c>, so the member name IS the
    /// MSBuild property name and a rename would silently read a different property.
    /// These literals are the independent check on that: they are deliberately spelled
    /// out here rather than shared with the production type, so a rename fails here
    /// instead of in a workspace.
    /// </summary>
    [Theory]
    [InlineData("BaseOutputPath")]
    [InlineData("OutputPath")]
    [InlineData("OutDir")]
    [InlineData("PublishDir")]
    [InlineData("PackageOutputPath")]
    [InlineData("BaseIntermediateOutputPath")]
    [InlineData("IntermediateOutputPath")]
    [InlineData("MSBuildProjectExtensionsPath")]
    [InlineData("UseArtifactsOutput")]
    [InlineData("ArtifactsPath")]
    [InlineData("ArtifactsProjectName")]
    [InlineData("ArtifactsPublishOutputName")]
    [InlineData("ArtifactsPackageOutputName")]
    [InlineData("Configuration")]
    [InlineData("MSBuildProjectName")]
    [InlineData("OutputType")]
    [InlineData("OpenApiDocumentsDirectory")]
    [InlineData("OpenApiGenerateDocumentsOptions")]
    [InlineData("TestResultsDirectory")]
    public void MemberIsNamedAsMSBuildNamesTheProperty(string msbuildName)
    {
        var member = typeof(EvaluatedProperties).GetProperty(msbuildName);
        Assert.True(member is not null, $"No member named '{msbuildName}'; a rename would change which property is read.");

        var properties = Properties((msbuildName, "sentinel"));

        Assert.Equal("sentinel", member!.GetValue(properties) as string);
    }

    /// <summary>
    /// Same guard for the interpreted member that carries an MSBuild name itself
    /// rather than deriving from a raw member: it reads a bool, so the string theory
    /// above cannot cover it.
    /// </summary>
    [Theory]
    [InlineData("IsTestProject")]
    public void BoolMemberIsNamedAsMSBuildNamesTheProperty(string msbuildName)
    {
        var member = typeof(EvaluatedProperties).GetProperty(msbuildName);
        Assert.True(member is not null, $"No member named '{msbuildName}'; a rename would change which property is read.");

        Assert.True((bool)member!.GetValue(Properties((msbuildName, "true")))!);
        Assert.False((bool)member.GetValue(Properties((msbuildName, "false")))!);
        Assert.False((bool)member.GetValue(Properties())!);
    }

    [Fact]
    public void ProjectExtensionsPath_PrefersTheRebasedProperty()
    {
        var properties = Properties(
            ("MSBuildProjectExtensionsPath", "/ws/apps/MyLib/obj/"),
            ("BaseIntermediateOutputPath", @"obj\"));

        Assert.Equal("/ws/apps/MyLib/obj/", properties.ProjectExtensionsPath);
    }

    [Fact]
    public void ProjectExtensionsPath_NormalizesSeparatorsInTheFallback()
    {
        // A project that never imported Microsoft.Common.props leaves the
        // MSBuild-flavoured `obj\`, which would not combine on a non-Windows path.
        var properties = Properties(("BaseIntermediateOutputPath", @"custom\obj\"));

        Assert.Equal("custom/obj/", properties.ProjectExtensionsPath);
    }

    [Fact]
    public void ProjectExtensionsPath_DefaultsToObj()
    {
        Assert.Equal("obj", Properties().ProjectExtensionsPath);
    }

    [Fact]
    public void WithConfiguration_ReplacesConfigurationAndKeepsTheRestReadable()
    {
        var properties = Properties(("Configuration", "Debug"), ("OutputPath", "bin/Debug"));

        var release = properties.WithConfiguration("Release");

        Assert.Equal("Release", release.Configuration);
        Assert.Equal("bin/Debug", release.OutputPath);
        Assert.Equal("Debug", properties.Configuration);
    }

    [Fact]
    public void WithConfiguration_PreservesTheCaseInsensitiveComparer()
    {
        // The Dictionary copy constructor falls back to an ordinal comparer unless
        // the source comparer is passed through, which would hide a property
        // MSBuild reported under a non-canonical spelling from every member.
        var properties = Properties(("outputpath", "bin/Debug"));

        Assert.Equal("bin/Debug", properties.WithConfiguration("Release").OutputPath);
    }
}
