using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

public class TargetBuilderFrameworkVariantsTests
{
    private static FrameworkVariant Variant(string tfm) => new()
    {
        TargetFramework = tfm,
        Inputs = ["production", $"!{{projectRoot}}/{tfm}-excluded.cs"],
        Configurations = new[] { "debug", "release" }.ToDictionary(configuration => configuration, configuration =>
            new EvaluatedProperties(new()
            {
                ["Configuration"] = configuration == "debug" ? "Debug" : "Release",
                ["OutputPath"] = $"bin/{configuration}/{tfm}",
                ["IntermediateOutputPath"] = $"obj/{configuration}/{tfm}"
            }))
    };

    private static BuildTargetsResult Build(PluginOptions? options = null, List<FrameworkVariant>? variants = null) =>
        TargetBuilder.BuildTargets("App", "App.csproj", false, true, [], new Dictionary<string, string>(),
            "/workspace/Debug/App", "/workspace", options ?? new(), null, [],
            variants ?? [Variant("net10.0"), Variant("netstandard2.1")]);

    [Fact]
    public void DefaultBuild_IsAnOutputlessUncachedAggregateOfTfmLeaves()
    {
        var result = Build();
        var aggregate = result.Targets["build"];
        Assert.Equal("nx:noop", aggregate.Executor);
        Assert.False(aggregate.Cache);
        Assert.Empty(aggregate.Outputs!);
        Assert.Equal(new[] { "build:net10.0", "build:netstandard2.1" }, aggregate.DependsOn);
        Assert.Equal("dotnet build {args.nxArgs}", result.Targets["build:release"].Command);
        Assert.False(result.Targets["build:release"].Cache);
        Assert.Equal("release", result.Targets["build:release"].DefaultConfiguration);
        Assert.Equal(new[] { "build", "build:release", "build:net10.0", "build:netstandard2.1" }, result.TargetGroups!["Build"]);
        Assert.DoesNotContain(result.Targets.Keys, name => name.EndsWith("-release"));
    }

    [Fact]
    public void Leaf_HasEvaluatedConfigurationOutputsAndBuildsCompatibleReferencesItself()
    {
        var leaf = Build().Targets["build:net10.0"];
        Assert.Equal("build", leaf.Metadata!.VariantOf);
        Assert.Equal("net10.0", leaf.Metadata.TargetFramework);
        Assert.Null(leaf.DependsOn);
        Assert.Equal("debug", leaf.DefaultConfiguration);
        Assert.Contains("--framework", leaf.Configurations!["release"].Args!);
        Assert.DoesNotContain("--no-dependencies", leaf.Configurations["release"].Args!);
        Assert.Contains("Debug/App/bin/release/net10.0/**/*", leaf.Configurations["release"].NxOutputs!.Values);
        Assert.DoesNotContain(leaf.Configurations["release"].NxOutputs!.Values, path => path.Contains("bin/debug"));
        Assert.Equal(Variant("net10.0").Inputs, leaf.Inputs);
        Assert.False(leaf.Options!.ForwardAllArgs);
        Assert.Equal("dotnet build {args.nxArgs}", leaf.Command);
    }

    [Fact]
    public void OptOutAndSingleTfm_KeepOrdinaryTargets()
    {
        foreach (var result in new[] { Build(new() { TfmVariants = false }), Build(variants: [Variant("net10.0")]) })
        {
            Assert.Equal("dotnet build", result.Targets["build"].Command);
            Assert.True(result.Targets.ContainsKey("build:release"));
            Assert.Null(result.TargetGroups);
        }
    }

    [Fact]
    public void RenameAndCollision_DoNotOverwriteExistingTargetsOrEmitIncompleteAggregate()
    {
        var renamed = Build(new() { BuildTargetName = "compile" });
        Assert.Equal("compile", renamed.Targets["compile:net10.0"].Metadata!.VariantOf);
        var collision = Build(new() { PublishTargetName = "build:net10.0" });
        Assert.Equal("dotnet publish", collision.Targets["build:net10.0"].Command);
        Assert.Equal("dotnet build", collision.Targets["build"].Command);
        Assert.Null(collision.TargetGroups);
    }

    [Fact]
    public void OverlappingEvaluatedFrameworkPaths_DisableCachingWithoutRemovingLeaves()
    {
        var variants = new[] { "net10.0", "netstandard2.1" }.Select(tfm => Variant(tfm) with
        {
            Configurations = new[] { "debug", "release" }.ToDictionary(configuration => configuration, configuration =>
                new EvaluatedProperties(new()
                {
                    ["Configuration"] = configuration,
                    ["OutputPath"] = $"bin/{configuration}/shared",
                    ["IntermediateOutputPath"] = $"obj/{configuration}/{tfm}"
                }))
        }).ToList();
        var result = Build(variants: variants);
        Assert.False(result.Targets["build:net10.0"].Cache);
        Assert.False(result.Targets["build:netstandard2.1"].Cache);
        Assert.Equal("nx:noop", result.Targets["build"].Executor);
    }

    [Fact]
    public void SharedOpenApiDocuments_DisableCachingRatherThanClaimingAnotherFrameworksDocuments()
    {
        var variants = new[] { "net10.0", "netstandard2.1" }.Select(tfm => Variant(tfm) with
        {
            Configurations = new[] { "debug", "release" }.ToDictionary(configuration => configuration, configuration =>
                new EvaluatedProperties(new()
                {
                    ["Configuration"] = configuration,
                    ["OutputPath"] = $"bin/{configuration}/{tfm}",
                    ["IntermediateOutputPath"] = $"obj/{configuration}/{tfm}",
                    ["OpenApiDocumentsDirectory"] = "openapi"
                }))
        }).ToList();
        var result = Build(variants: variants);
        Assert.False(result.Targets["build:net10.0"].Cache);
        Assert.False(result.Targets["build:netstandard2.1"].Cache);
    }
}
