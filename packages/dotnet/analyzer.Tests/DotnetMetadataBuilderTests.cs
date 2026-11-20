using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for <see cref="DotnetMetadataBuilder.Build"/>, which produces the structured
/// <c>metadata.dotnet</c> model (see https://github.com/nrwl/nx/discussions/36676) from
/// already-evaluated MSBuild property/package-reference data — the same data
/// <see cref="Analyzer"/> collects per grouped inner-build node. These tests drive the pure
/// builder directly with plain dictionaries, avoiding the cost of a full MSBuild project graph
/// evaluation (matching the existing analyzer test conventions in this project).
/// </summary>
public class DotnetMetadataBuilderTests
{
    private static DotnetMetadataBuilder.TargetFrameworkEvaluation Evaluation(
        Dictionary<string, string> properties,
        List<PackageReference>? packageRefs = null) =>
        new(properties, packageRefs ?? new List<PackageReference>());

    private static Dictionary<string, string> Properties(params (string Key, string Value)[] entries) =>
        entries.ToDictionary(e => e.Key, e => e.Value);

    // --- Single target framework -------------------------------------------------------------

    [Fact]
    public void Build_SingleTarget_ClassLibrary_IsPackableButNotExecutableOrPublishable()
    {
        // A plain class library: no OutputType override (defaults away from "Exe"), no
        // IsPackable/IsPublishable overrides.
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("AssemblyName", "MyLib"))),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        var tfm = Assert.Single(metadata.TargetFrameworks);
        Assert.Equal("net9.0", tfm.TargetFramework);
        Assert.True(tfm.Capabilities.Packable, "IsPackable defaults to true when unevaluated.");
        Assert.False(tfm.Capabilities.Executable);
        Assert.False(tfm.Capabilities.Publishable, "IsPublishable falls back to the executable heuristic when unevaluated.");
        Assert.False(tfm.Capabilities.Test);
        Assert.False(tfm.Capabilities.Tool);
    }

    [Fact]
    public void Build_SingleTarget_ConsoleApp_IsExecutableAndPublishableButNotPackable()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(
                ("TargetFramework", "net9.0"),
                ("OutputType", "Exe"),
                ("IsPackable", "false"))),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        var capabilities = Assert.Single(metadata.TargetFrameworks).Capabilities;
        Assert.True(capabilities.Executable);
        Assert.True(capabilities.Publishable, "Unevaluated IsPublishable falls back to the executable capability.");
        Assert.False(capabilities.Packable);
    }

    [Fact]
    public void Build_TestProject_WithExeOutputType_IsNotPublishable()
    {
        // Microsoft.NET.Sdk sets OutputType=Exe for the test host but explicitly forces
        // IsPublishable=false — the metadata must honor that override, not the exe heuristic.
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(
                Properties(
                    ("TargetFramework", "net9.0"),
                    ("OutputType", "Exe"),
                    ("IsPublishable", "false")),
                new List<PackageReference> { new() { Include = "Microsoft.NET.Test.Sdk", Version = "17.11.1" } }),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        var capabilities = Assert.Single(metadata.TargetFrameworks).Capabilities;
        Assert.True(capabilities.Test);
        Assert.True(capabilities.Executable);
        Assert.False(capabilities.Publishable);
    }

    [Theory]
    [InlineData("Microsoft.NET.Test.Sdk")]
    [InlineData("Microsoft.Testing.Platform")]
    [InlineData("microsoft.net.test.sdk")]
    [InlineData("microsoft.testing.platform")]
    public void Build_TestPackageReference_MarksTestCapability(string packageId)
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(
                Properties(("TargetFramework", "net9.0")),
                new List<PackageReference> { new() { Include = packageId } }),
        };

        Assert.True(Assert.Single(DotnetMetadataBuilder.Build(evaluations).TargetFrameworks).Capabilities.Test);
    }

    [Theory]
    [InlineData("IsTestProject", "True", true)]
    [InlineData("IsTestProject", "false", false)]
    [InlineData("IsTestingPlatformApplication", "True", true)]
    public void Build_TestCapability_UsesCurrentTargetInferenceRules(string property, string value, bool expected)
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(
                Properties(("TargetFramework", "net9.0"), (property, value)),
                new List<PackageReference> { new() { Include = "Microsoft.NET.Test.Sdk" } }),
        };

        var capabilities = Assert.Single(DotnetMetadataBuilder.Build(evaluations).TargetFrameworks).Capabilities;

        Assert.Equal(expected, capabilities.Test);
    }

    [Theory]
    [InlineData("true")]
    [InlineData("True")]
    public void Build_PackAsTool_MarksToolCapability(string value)
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("PackAsTool", value))),
        };

        Assert.True(Assert.Single(DotnetMetadataBuilder.Build(evaluations).TargetFrameworks).Capabilities.Tool);
    }

    [Theory]
    [InlineData("True", true)]
    [InlineData("FALSE", false)]
    public void Build_EvaluatedPackagingCapabilities_AreCaseInsensitive(string value, bool expected)
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(
                ("TargetFramework", "net9.0"),
                ("IsPackable", value),
                ("IsPublishable", value))),
        };

        var capabilities = Assert.Single(DotnetMetadataBuilder.Build(evaluations).TargetFrameworks).Capabilities;

        Assert.Equal(expected, capabilities.Packable);
        Assert.Equal(expected, capabilities.Publishable);
    }

    // --- Target framework/platform facts ------------------------------------------------------

    [Fact]
    public void Build_PlatformSpecificTarget_CapturesFrameworkAndPlatformIdentifiers()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(
                ("TargetFramework", "net9.0-ios"),
                ("TargetFrameworkIdentifier", ".NETCoreApp"),
                ("TargetFrameworkVersion", "v9.0"),
                ("TargetPlatformIdentifier", "ios"),
                ("TargetPlatformVersion", "17.0"))),
        };

        var tfm = Assert.Single(DotnetMetadataBuilder.Build(evaluations).TargetFrameworks);

        Assert.Equal("net9.0-ios", tfm.TargetFramework);
        Assert.Equal(".NETCoreApp", tfm.TargetFrameworkIdentifier);
        Assert.Equal("v9.0", tfm.TargetFrameworkVersion);
        Assert.Equal("ios", tfm.TargetPlatformIdentifier);
        Assert.Equal("17.0", tfm.TargetPlatformVersion);
    }

    [Fact]
    public void Build_NonPlatformTarget_LeavesPlatformFactsNull()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"))),
        };

        var tfm = Assert.Single(DotnetMetadataBuilder.Build(evaluations).TargetFrameworks);

        Assert.Null(tfm.TargetPlatformIdentifier);
        Assert.Null(tfm.TargetPlatformVersion);
    }

    // --- RuntimeIdentifier / RuntimeIdentifiers ------------------------------------------------

    [Fact]
    public void Build_SingleRuntimeIdentifier_IsCaptured()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("RuntimeIdentifier", "linux-x64"))),
        };

        var tfm = Assert.Single(DotnetMetadataBuilder.Build(evaluations).TargetFrameworks);

        Assert.Equal("linux-x64", tfm.RuntimeIdentifier);
        Assert.Empty(tfm.RuntimeIdentifiers);
    }

    [Fact]
    public void Build_RuntimeIdentifiersList_IsSplitTrimmedAndDeduplicated()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(
                ("TargetFramework", "net9.0"),
                ("RuntimeIdentifiers", "linux-x64; win-x64;osx-arm64 ;win-x64"))),
        };

        var tfm = Assert.Single(DotnetMetadataBuilder.Build(evaluations).TargetFrameworks);

        Assert.Equal(new[] { "linux-x64", "win-x64", "osx-arm64" }, tfm.RuntimeIdentifiers);
    }

    [Fact]
    public void Build_MultiTarget_PreservesGivenOrder()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"))),
            Evaluation(Properties(("TargetFramework", "net8.0"))),
            Evaluation(Properties(("TargetFramework", "net9.0-android"))),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        Assert.Equal(
            new[] { "net9.0", "net8.0", "net9.0-android" },
            metadata.TargetFrameworks.Select(f => f.TargetFramework));
    }

    [Fact]
    public void Build_MultiTarget_KeepsCapabilitiesPerFramework()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(
                Properties(("TargetFramework", "net8.0")),
                new List<PackageReference> { new() { Include = "Microsoft.NET.Test.Sdk" } }),
            Evaluation(Properties(("TargetFramework", "net9.0"), ("OutputType", "Exe"))),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        var net8 = metadata.TargetFrameworks.Single(f => f.TargetFramework == "net8.0");
        var net9 = metadata.TargetFrameworks.Single(f => f.TargetFramework == "net9.0");
        Assert.True(net8.Capabilities.Test);
        Assert.False(net8.Capabilities.Executable);
        Assert.False(net9.Capabilities.Test);
        Assert.True(net9.Capabilities.Executable);
    }

    [Fact]
    public void Build_MultiTarget_DuplicateFramework_KeepsFirstOccurrenceOnly()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("RuntimeIdentifier", "linux-x64"))),
            Evaluation(Properties(("TargetFramework", "net9.0"), ("RuntimeIdentifier", "win-x64"))),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        var tfm = Assert.Single(metadata.TargetFrameworks);
        Assert.Equal("linux-x64", tfm.RuntimeIdentifier);
    }

    // --- PackageId ------------------------------------------------------------------------------

    [Fact]
    public void Build_ExplicitPackageId_IsUsed()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("PackageId", "My.Custom.Package"), ("AssemblyName", "MyLib"))),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        Assert.Equal("My.Custom.Package", metadata.PackageId);
        Assert.Equal("My.Custom.Package", Assert.Single(metadata.TargetFrameworks).PackageId);
    }

    [Fact]
    public void Build_UnsetPackageId_FallsBackToAssemblyName()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("AssemblyName", "MyLib"))),
        };

        Assert.Equal("MyLib", DotnetMetadataBuilder.Build(evaluations).PackageId);
    }

    [Fact]
    public void Build_NoPackageIdOrAssemblyName_IsNull()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"))),
        };

        Assert.Null(DotnetMetadataBuilder.Build(evaluations).PackageId);
    }

    [Fact]
    public void Build_MultiTarget_SamePackageIdAcrossFrameworks_IsUsedAtProjectLevel()
    {
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("PackageId", "My.Custom.Package"))),
            Evaluation(Properties(("TargetFramework", "net8.0"), ("PackageId", "My.Custom.Package"))),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        Assert.Equal("My.Custom.Package", metadata.PackageId);
        Assert.All(metadata.TargetFrameworks, f => Assert.Equal("My.Custom.Package", f.PackageId));
    }

    [Fact]
    public void Build_MultiTarget_ConditionalPackageIdPerFramework_ProjectLevelIsNullButPerFrameworkIsPreserved()
    {
        // A conditional `<PackageId>` that varies by `$(TargetFramework)` — no single value
        // describes the whole project, so the project-level PackageId must not silently pick
        // whichever framework evaluated first.
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("PackageId", "My.Package.Net9"))),
            Evaluation(Properties(("TargetFramework", "net8.0"), ("PackageId", "My.Package.Net8"))),
        };

        var metadata = DotnetMetadataBuilder.Build(evaluations);

        Assert.Null(metadata.PackageId);
        Assert.Equal("My.Package.Net9", metadata.TargetFrameworks.Single(f => f.TargetFramework == "net9.0").PackageId);
        Assert.Equal("My.Package.Net8", metadata.TargetFrameworks.Single(f => f.TargetFramework == "net8.0").PackageId);
    }

    [Fact]
    public void Build_MultiTarget_DivergentAssemblyNameFallback_ProjectLevelIsNull()
    {
        // Even without an explicit PackageId, a per-TFM AssemblyName override means the
        // fallback identity still diverges across frameworks — still ambiguous at project level.
        var evaluations = new List<DotnetMetadataBuilder.TargetFrameworkEvaluation>
        {
            Evaluation(Properties(("TargetFramework", "net9.0"), ("AssemblyName", "MyLib.Net9"))),
            Evaluation(Properties(("TargetFramework", "net8.0"), ("AssemblyName", "MyLib.Net8"))),
        };

        Assert.Null(DotnetMetadataBuilder.Build(evaluations).PackageId);
    }
}
