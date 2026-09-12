using System.Text.Json;
using System.Text.Json.Serialization;
using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Guards the JSON contract between the analyzer and the TypeScript plugin.
///
/// Two things are asserted here. First, that the atomizer model additions
/// (Executor, Parallelism, NonAtomizedTarget, TargetGroups, AtomizedRoots) are
/// omitted when unset, so output for projects that don't atomize is unchanged
/// byte for byte. Second, that widening Target.DependsOn from string[] to
/// object[] still serializes bare strings as strings — that relies on
/// System.Text.Json using the runtime type for object-declared values, which is
/// load-bearing enough to pin down with a test.
/// </summary>
public class SerializationTests
{
    /// <summary>
    /// The analyzer's own options, not a copy. A mirrored copy would stay green
    /// while the real behavior changed underneath it.
    /// </summary>
    private static readonly JsonSerializerOptions JsonOptions = AnalyzerJson.Output;

    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);

    // --- The new fields must not leak into existing output ------------------

    [Fact]
    public void Target_WithoutAtomizerFields_OmitsThemEntirely()
    {
        var json = Serialize(new Target
        {
            Command = "dotnet test",
            Options = new TargetOptions { Cwd = "{projectRoot}", Args = ["--no-build"] },
            DependsOn = ["build"],
            Cache = true,
            Outputs = ["{projectRoot}/TestResults"],
            Metadata = new TargetMetadata
            {
                Description = "Run .NET tests",
                Technologies = ["dotnet", "csharp"]
            }
        });

        Assert.DoesNotContain("executor", json);
        Assert.DoesNotContain("parallelism", json);
        Assert.DoesNotContain("nonAtomizedTarget", json);
    }

    [Fact]
    public void Target_ExistingShape_SerializesExactly()
    {
        // The full expected document, so an accidental property addition or a
        // naming-policy change fails loudly rather than drifting.
        var json = Serialize(new Target
        {
            Command = "dotnet test",
            Options = new TargetOptions { Cwd = "{projectRoot}", Args = ["--no-build", "--no-restore"] },
            DependsOn = ["build"],
            Cache = true,
            Outputs = ["{projectRoot}/TestResults"]
        });

        Assert.Equal(
            "{\"command\":\"dotnet test\"," +
            "\"options\":{\"cwd\":\"{projectRoot}\",\"args\":[\"--no-build\",\"--no-restore\"]}," +
            "\"dependsOn\":[\"build\"]," +
            "\"cache\":true," +
            "\"outputs\":[\"{projectRoot}/TestResults\"]}",
            json);
    }

    [Fact]
    public void ProjectMetadata_WithoutTargetGroups_OmitsThem()
    {
        var json = Serialize(new ProjectMetadata { Technologies = ["dotnet", "csharp"] });

        Assert.Equal("{\"technologies\":[\"dotnet\",\"csharp\"]}", json);
    }

    [Fact]
    public void AnalysisResult_WithoutAtomizedRoots_OmitsThem()
    {
        var json = Serialize(new AnalysisResult());

        Assert.Equal("{\"nodesByFile\":{},\"referencesByRoot\":{}}", json);
    }

    // --- DependsOn widening -------------------------------------------------

    [Fact]
    public void DependsOn_BareStrings_StillSerializeAsStrings()
    {
        var json = Serialize(new Target { DependsOn = ["build", "^build"] });

        Assert.Equal("{\"dependsOn\":[\"build\",\"^build\"]}", json);
    }

    [Fact]
    public void DependsOn_TargetDependency_SerializesForwardingKeys()
    {
        var json = Serialize(new Target
        {
            DependsOn =
            [
                new TargetDependency { Target = "test-ci--Acme.LoginTests", Params = "forward", Options = "forward" }
            ]
        });

        Assert.Equal(
            "{\"dependsOn\":[{\"target\":\"test-ci--Acme.LoginTests\"," +
            "\"params\":\"forward\",\"options\":\"forward\"}]}",
            json);
    }

    [Fact]
    public void DependsOn_MixedStringsAndDependencies_SerializeSideBySide()
    {
        // The atomized parent depends on leaves via objects while the leaves
        // themselves depend on "build" via a bare string, so both forms coexist
        // in one analysis result.
        var json = Serialize(new Target
        {
            DependsOn = ["build", new TargetDependency { Target = "test-ci--A", Params = "forward" }]
        });

        Assert.Equal(
            "{\"dependsOn\":[\"build\",{\"target\":\"test-ci--A\",\"params\":\"forward\"}]}",
            json);
    }

    [Fact]
    public void TargetDependency_WithoutForwarding_OmitsNullKeys()
    {
        var json = Serialize(new Target { DependsOn = [new TargetDependency { Target = "build" }] });

        Assert.Equal("{\"dependsOn\":[{\"target\":\"build\"}]}", json);
    }

    // --- The atomizer shapes themselves ------------------------------------

    [Fact]
    public void NoopParent_SerializesExecutorAndNonAtomizedTarget()
    {
        var json = Serialize(new Target
        {
            Executor = "nx:noop",
            Cache = true,
            DependsOn = [new TargetDependency { Target = "test-ci--A", Params = "forward", Options = "forward" }],
            Metadata = new TargetMetadata
            {
                Description = "Run .NET tests in CI",
                Technologies = ["dotnet"],
                NonAtomizedTarget = "test"
            }
        });

        Assert.Contains("\"executor\":\"nx:noop\"", json);
        Assert.Contains("\"nonAtomizedTarget\":\"test\"", json);
        Assert.DoesNotContain("\"command\"", json);
    }

    [Fact]
    public void Leaf_WithParallelismDisabled_SerializesFalse()
    {
        var json = Serialize(new Target { Command = "dotnet test", Parallelism = false });

        Assert.Contains("\"parallelism\":false", json);
    }

    [Fact]
    public void ProjectMetadata_TargetGroups_ListParentFirst()
    {
        var json = Serialize(new ProjectMetadata
        {
            Technologies = ["dotnet"],
            TargetGroups = new() { ["TEST (CI)"] = ["test-ci", "test-ci--A", "test-ci--B"] }
        });

        Assert.Equal(
            "{\"technologies\":[\"dotnet\"]," +
            "\"targetGroups\":{\"TEST (CI)\":[\"test-ci\",\"test-ci--A\",\"test-ci--B\"]}}",
            json);
    }

    [Fact]
    public void AnalysisResult_AtomizedRoots_RoundTrips()
    {
        var json = Serialize(new AnalysisResult { AtomizedRoots = ["apps/integration-tests"] });
        Assert.Contains("\"atomizedRoots\":[\"apps/integration-tests\"]", json);

        var parsed = JsonSerializer.Deserialize<AnalysisResult>(json, JsonOptions);
        Assert.Equal(["apps/integration-tests"], parsed!.AtomizedRoots);
    }

    // --- Reading the plugin's options -------------------------------------
    //
    // The plugin sends these on the command line, so the analyzer's ability to
    // bind them is the contract between the two halves of this feature. These
    // run against AnalyzerJson.PluginOptions itself, so removing the enum
    // converter breaks them rather than going unnoticed.

    [Theory]
    [InlineData("class", SplitBy.Class)]
    [InlineData("method", SplitBy.Method)]
    [InlineData("Method", SplitBy.Method)]
    public void PluginOptions_SplitByArrivesAsALowercaseString(string value, SplitBy expected)
    {
        var options = JsonSerializer.Deserialize<PluginOptions>(
            $"{{\"testCiSplitBy\":\"{value}\"}}", AnalyzerJson.PluginOptions);

        Assert.Equal(expected, options!.TestCiSplitBy);
    }

    [Fact]
    public void PluginOptions_SplitByDefaultsToClassWhenAbsent()
    {
        var options = JsonSerializer.Deserialize<PluginOptions>(
            "{\"testCiTargetName\":\"test-ci\"}", AnalyzerJson.PluginOptions);

        Assert.Equal(SplitBy.Class, options!.TestCiSplitBy);
    }

    [Fact]
    public void PluginOptions_ReadsTheFullSetThePluginSends()
    {
        var options = JsonSerializer.Deserialize<PluginOptions>(
            "{\"testTargetName\":\"unit-test\",\"testCiTargetName\":\"unit-test-ci\"," +
            "\"testCiGroupName\":\"UNIT TEST (CI)\",\"testCiSplitBy\":\"method\"}",
            AnalyzerJson.PluginOptions);

        Assert.Equal("unit-test", options!.TestTargetName);
        Assert.Equal("unit-test-ci", options.TestCiTargetName);
        Assert.Equal("UNIT TEST (CI)", options.TestCiGroupName);
        Assert.Equal(SplitBy.Method, options.TestCiSplitBy);
    }

    [Fact]
    public void PluginOptions_OmittedCiOptionsLeaveSplittingOff()
    {
        var options = JsonSerializer.Deserialize<PluginOptions>(
            "{\"testTargetName\":\"test\"}", AnalyzerJson.PluginOptions);

        Assert.Null(options!.TestCiTargetName);
    }

    [Fact]
    public void AnalysisResult_FromOlderAnalyzer_DeserializesWithNullAtomizedRoots()
    {
        // Results cached on disk by a pre-atomizer analyzer must still load.
        var parsed = JsonSerializer.Deserialize<AnalysisResult>(
            "{\"nodesByFile\":{},\"referencesByRoot\":{}}", JsonOptions);

        Assert.Null(parsed!.AtomizedRoots);
    }
}
