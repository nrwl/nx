using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// What makes a project a test project, and so which projects get a <c>test</c>
/// target and lose <c>pack</c>. <c>publish</c> and <c>run</c> are decided by
/// OutputType alone, so an MTP runner keeps both.
///
/// The expectations here mirror the SDK's own gate in
/// <c>Microsoft.TestPlatform.ImportAfter.targets</c>:
/// <c>IsTestProject == 'true' OR IsTestingPlatformApplication == 'true'</c>.
/// Measured against real MSBuild evaluation: a plain library leaves both empty,
/// xunit.v3 sets IsTestProject=true and IsTestingPlatformApplication=True, and
/// xunit.v3.mtp-v2 sets only IsTestingPlatformApplication=true. All three
/// values appear only after a restore.
/// </summary>
public class TestProjectDetectionTests
{
    private static bool IsTestProject(
        Dictionary<string, string>? properties = null,
        params string[] packages)
    {
        return ProjectUtilities.IsTestProject(
            new Dictionary<string, string>(
                properties ?? [],
                StringComparer.OrdinalIgnoreCase),
            [.. packages.Select(p => new PackageReference { Include = p })]);
    }

    private static Dictionary<string, string> Property(string name, string value) =>
        new() { [name] = value };

    [Fact]
    public void NoSignals_IsNotATestProject()
    {
        Assert.False(IsTestProject());
    }

    [Fact]
    public void OrdinaryLibrary_IsNotATestProject()
    {
        Assert.False(IsTestProject(properties: null, "Newtonsoft.Json", "Serilog"));
    }

    [Theory]
    [InlineData("IsTestProject")]
    // Microsoft.Testing.Platform sets this instead of IsTestProject, and it is
    // the only property xunit.v3.mtp-v2 sets. NXC-4963.
    [InlineData("IsTestingPlatformApplication")]
    public void TestProperty_IsATestProject(string property)
    {
        Assert.True(IsTestProject(Property(property, "true")));
    }

    // MSBuild compares booleans case-insensitively, and xunit.v3 really does
    // evaluate IsTestingPlatformApplication to "True".
    [Theory]
    [InlineData("IsTestProject", "True")]
    [InlineData("IsTestProject", "TRUE")]
    [InlineData("IsTestingPlatformApplication", "True")]
    public void TestProperty_IsCaseInsensitive(string property, string value)
    {
        Assert.True(IsTestProject(Property(property, value)));
    }

    [Theory]
    [InlineData("IsTestProject")]
    [InlineData("IsTestingPlatformApplication")]
    public void TestPropertySetFalse_IsNotATestProject(string property)
    {
        Assert.False(IsTestProject(Property(property, "false")));
    }

    // The escape hatch. A library that references a test framework so it can
    // expose helpers is not itself runnable by `dotnet test`, and saying so in
    // the project file has to win over anything inferred from packages.
    [Fact]
    public void IsTestProjectSetFalse_OverridesTheTestPackages()
    {
        Assert.False(IsTestProject(
            Property("IsTestProject", "false"),
            "Microsoft.NET.Test.Sdk",
            "Microsoft.Testing.Platform"));
    }

    // Only IsTestProject carries that meaning. MSTest.Sdk evaluates
    // IsTestingPlatformApplication to "false" on a project it has already marked
    // with IsTestProject=true, so that property saying false describes the runner
    // kind and cannot be read as "not a test project".
    [Fact]
    public void MSTestSdkShape_IsATestProject()
    {
        var properties = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["IsTestProject"] = "true",
            ["IsTestingPlatformApplication"] = "false",
        };

        Assert.True(ProjectUtilities.IsTestProject(properties, []));
    }

    [Fact]
    public void TestingPlatformApplicationSetFalse_DoesNotSuppressTheTestPackages()
    {
        Assert.True(IsTestProject(
            Property("IsTestingPlatformApplication", "false"),
            "Microsoft.NET.Test.Sdk"));
    }

    // Both properties come from a restored package, so before the first restore
    // a reference to the test SDK is the only evidence there is.
    [Theory]
    [InlineData("Microsoft.NET.Test.Sdk")]
    [InlineData("microsoft.net.test.sdk")]
    [InlineData("Microsoft.Testing.Platform")]
    [InlineData("Microsoft.Testing.Extensions.CodeCoverage")]
    public void TestSdkPackageWithNoProperties_IsATestProject(string package)
    {
        Assert.True(IsTestProject(packages: package));
    }

    [Fact]
    public void TestSdkPackageAmongOthers_IsATestProject()
    {
        Assert.True(IsTestProject(
            properties: null,
            "Newtonsoft.Json",
            "Microsoft.NET.Test.Sdk",
            "Moq"));
    }

    // A framework reference is not evidence of runnability on its own. xunit,
    // NUnit, MSTest and TUnit projects are detected from the properties their
    // packages set once restored, which is also what keeps a helper library
    // that references one from losing its pack target.
    [Theory]
    [InlineData("xunit")]
    [InlineData("xunit.v3")]
    [InlineData("xunit.v3.mtp-v2")]
    [InlineData("xunit.abstractions")]
    [InlineData("xunit.extensibility.core")]
    [InlineData("NUnit")]
    [InlineData("NUnit3TestAdapter")]
    [InlineData("NUnit.Analyzers")]
    [InlineData("MSTest.TestFramework")]
    [InlineData("TUnit")]
    public void FrameworkPackageAlone_IsNotATestProject(string package)
    {
        Assert.False(IsTestProject(packages: package));
    }

    // A name that merely starts with a family name is not in that family.
    [Fact]
    public void PackageNamedLikeTheTestingPrefix_IsNotATestProject()
    {
        Assert.False(IsTestProject(packages: "Microsoft.TestingHelpers"));
    }
}
