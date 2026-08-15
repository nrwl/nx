using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for the opt-in per-runtime-identifier target variants generated
/// for multi-targeted executables that declare RIDs
/// (https://github.com/nrwl/nx/discussions/36676, https://github.com/nrwl/nx/issues/33474).
/// </summary>
public class TargetBuilderRuntimeVariantsTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static string ProjectDir(params string[] segments) =>
        Path.Combine(new[] { WorkspaceRoot }.Concat(segments).ToArray());

    private static Dictionary<string, string> InnerProperties(
        string tfm,
        (string key, string value)[]? extra = null)
    {
        var props = new Dictionary<string, string>
        {
            ["TargetFramework"] = tfm,
            ["OutputPath"] = $"bin/Debug/{tfm}/",
            ["IntermediateOutputPath"] = $"obj/Debug/{tfm}/",
            ["BaseOutputPath"] = "bin/",
            ["BaseIntermediateOutputPath"] = "obj/",
        };
        foreach (var (k, v) in extra ?? Array.Empty<(string, string)>())
        {
            props[k] = v;
        }
        return props;
    }

    private static FrameworkVariant Variant(
        string tfm,
        string[] rids,
        bool isExecutable = true,
        (string key, string value)[]? extraProps = null) => new()
    {
        TargetFramework = tfm,
        Properties = InnerProperties(tfm, extraProps),
        IsExecutable = isExecutable,
        RuntimeIdentifiers = rids.ToList(),
    };

    private static Dictionary<string, Target> BuildTargets(
        List<FrameworkVariant> variants,
        bool runtimeVariants = true,
        bool frameworkVariants = false)
    {
        var options = new PluginOptions
        {
            FrameworkVariants = frameworkVariants,
            RuntimeVariants = runtimeVariants,
        };
        return TargetBuilder.BuildTargets(
            projectName: "MyProj",
            fileName: "MyProj.csproj",
            isTest: false,
            isExe: true,
            packageRefs: new List<PackageReference>(),
            properties: new Dictionary<string, string>
            {
                ["BaseOutputPath"] = "bin/",
                ["BaseIntermediateOutputPath"] = "obj/",
            },
            projectDirectory: ProjectDir("MyProj"),
            workspaceRoot: WorkspaceRoot,
            options: options,
            nxJson: null,
            directoryBuildInputs: new List<string>(),
            frameworkVariants: variants);
    }

    private static List<FrameworkVariant> WinAndIos() => new()
    {
        Variant("net10.0", new[] { "win-x64" }),
        Variant("net10.0-ios", new[] { "ios-arm64" },
            extraProps: new[]
            {
                // Platform frameworks default a RID into the evaluated output path.
                ("RuntimeIdentifier", "iossimulator-arm64"),
                ("OutputPath", "bin/Debug/net10.0-ios/iossimulator-arm64/"),
                ("IntermediateOutputPath", "obj/Debug/net10.0-ios/iossimulator-arm64/"),
            }),
    };

    // --- Gating -----------------------------------------------------------

    [Fact]
    public void FrameworkVariantsWithoutRuntimeVariants_EmitsNoRuntimeVariants()
    {
        // Opting into per-framework build variants must not, on its own, expand
        // the graph with RID variants — that needs the separate runtimeVariants flag.
        var targets = BuildTargets(WinAndIos(), runtimeVariants: false, frameworkVariants: true);

        Assert.Contains("build-net10.0", targets.Keys); // framework variants present
        Assert.DoesNotContain(targets.Keys, k => k.Contains("win-x64") || k.Contains("ios-arm64"));
    }

    [Fact]
    public void NoRidsDeclared_EmitsNoRuntimeVariants()
    {
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net10.0", Array.Empty<string>()),
            Variant("net10.0-ios", Array.Empty<string>()),
        });

        Assert.DoesNotContain(targets.Keys, k => k.Contains("-ios-arm64") || k.Contains("-win-x64"));
        Assert.Contains("build-net10.0-ios", targets.Keys);
    }

    [Fact]
    public void NonExecutableFramework_EmitsNoRuntimeVariants()
    {
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net10.0", new[] { "win-x64" }, isExecutable: false),
            Variant("net10.0-ios", new[] { "ios-arm64" }, isExecutable: false),
        });

        Assert.DoesNotContain(targets.Keys, k => k.Contains("win-x64") || k.Contains("ios-arm64"));
    }

    [Fact]
    public void MixedLibraryAndExecutable_OnlyExecutableFrameworkGetsRuntimeVariants()
    {
        // OutputType can be conditioned per framework: only the executable one
        // should get publish/RID variants.
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net9.0", new[] { "win-x64" }, isExecutable: false),
            Variant("net10.0", new[] { "win-x64" }, isExecutable: true),
        });

        Assert.DoesNotContain("build-net9.0-win-x64-release", targets.Keys);
        Assert.DoesNotContain("publish-net9.0-win-x64", targets.Keys);
        Assert.Contains("build-net10.0-win-x64-release", targets.Keys);
        Assert.Contains("publish-net10.0-win-x64", targets.Keys);
    }

    [Fact]
    public void RidsDeclared_ForExecutable_EmitsBuildAndPublishRuntimeVariants()
    {
        var targets = BuildTargets(WinAndIos());

        Assert.Contains("build-net10.0-win-x64-release", targets.Keys);
        Assert.Contains("publish-net10.0-win-x64", targets.Keys);
        Assert.Contains("build-net10.0-ios-ios-arm64-release", targets.Keys);
        Assert.Contains("publish-net10.0-ios-ios-arm64", targets.Keys);
    }

    // --- Command & dependencies ------------------------------------------

    [Fact]
    public void RuntimeBuildVariant_PassesRuntimeArgument()
    {
        var targets = BuildTargets(WinAndIos());

        Assert.Equal(
            new[] { "--no-restore", "--framework", "net10.0", "--runtime", "win-x64", "--configuration", "Release" },
            targets["build-net10.0-win-x64-release"].Options!.Args);
    }

    [Fact]
    public void RuntimeBuildVariant_IsSelfContained()
    {
        var targets = BuildTargets(WinAndIos());

        var build = targets["build-net10.0-win-x64-release"];
        Assert.True(build.DependsOn is null || build.DependsOn.Length == 0);
        Assert.DoesNotContain("--no-dependencies", build.Options!.Args!);
    }

    [Fact]
    public void PublishRuntimeVariant_DependsOnRuntimeSpecificBuild()
    {
        var targets = BuildTargets(WinAndIos());

        // The key correctness point behind #33474: the RID publish depends on a
        // RID-specific build, not the framework-only Release build.
        Assert.Equal(
            new[] { "build-net10.0-win-x64-release" },
            targets["publish-net10.0-win-x64"].DependsOn);
    }

    // --- Output-path derivation ------------------------------------------

    [Fact]
    public void RuntimeVariant_AppendsRidWhenNoImplicitRid()
    {
        var targets = BuildTargets(WinAndIos());

        Assert.Equal(
            new[]
            {
                "{projectRoot}/bin/Release/net10.0/win-x64",
                "{projectRoot}/obj/Release/net10.0/win-x64",
            },
            targets["build-net10.0-win-x64-release"].Outputs);

        Assert.Equal(
            new[]
            {
                "{projectRoot}/bin/Release/net10.0/win-x64/publish",
                "{projectRoot}/obj/Release/net10.0/win-x64",
            },
            targets["publish-net10.0-win-x64"].Outputs);
    }

    [Fact]
    public void RuntimeVariant_ReplacesImplicitRidFromEvaluatedPath()
    {
        // net10.0-ios's inner build defaults iossimulator-arm64 into the path; the
        // declared ios-arm64 replaces it rather than nesting under it.
        var targets = BuildTargets(WinAndIos());

        Assert.Equal(
            new[]
            {
                "{projectRoot}/bin/Release/net10.0-ios/ios-arm64",
                "{projectRoot}/obj/Release/net10.0-ios/ios-arm64",
            },
            targets["build-net10.0-ios-ios-arm64-release"].Outputs);
    }

    // --- Conservative skip for unsupported layouts -----------------------

    [Fact]
    public void ArtifactsLayout_SkipsRuntimeVariants()
    {
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net9.0", new[] { "win-x64" }, extraProps: new[] { ("UseArtifactsOutput", "true") }),
            Variant("net10.0", new[] { "win-x64" }, extraProps: new[] { ("UseArtifactsOutput", "true") }),
        });

        Assert.DoesNotContain(targets.Keys, k => k.Contains("win-x64"));
    }

    [Fact]
    public void AppendRuntimeIdentifierFalse_SkipsRuntimeVariants()
    {
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net9.0", new[] { "win-x64" }, extraProps: new[] { ("AppendRuntimeIdentifierToOutputPath", "false") }),
            Variant("net10.0", new[] { "win-x64" }, extraProps: new[] { ("AppendRuntimeIdentifierToOutputPath", "false") }),
        });

        Assert.DoesNotContain(targets.Keys, k => k.Contains("win-x64"));
    }

    [Fact]
    public void AppendTargetFrameworkFalse_SkipsRuntimeVariants()
    {
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net9.0", new[] { "win-x64" }, extraProps: new[] { ("AppendTargetFrameworkToOutputPath", "false") }),
            Variant("net10.0", new[] { "win-x64" }, extraProps: new[] { ("AppendTargetFrameworkToOutputPath", "false") }),
        });

        Assert.DoesNotContain(targets.Keys, k => k.Contains("win-x64"));
    }

    [Fact]
    public void CustomPublishDir_SkipsRuntimeVariants()
    {
        // A custom publish directory that isn't <OutputPath>/publish can't be modeled
        // per-RID, so the variants are skipped rather than pointed at the wrong folder.
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net9.0", new[] { "win-x64" }, extraProps: new[] { ("PublishDir", "dist/custompub") }),
            Variant("net10.0", new[] { "win-x64" }, extraProps: new[] { ("PublishDir", "dist/custompub") }),
        });

        Assert.DoesNotContain(targets.Keys, k => k.Contains("win-x64"));
    }

    [Fact]
    public void DefaultPublishDir_EmitsRuntimeVariants()
    {
        // PublishDir equal to <OutputPath>/publish is the derivable default.
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net9.0", new[] { "win-x64" }, extraProps: new[] { ("PublishDir", "bin/Debug/net9.0/publish/") }),
            Variant("net10.0", new[] { "win-x64" }, extraProps: new[] { ("PublishDir", "bin/Debug/net10.0/publish/") }),
        });

        Assert.Contains("publish-net10.0-win-x64", targets.Keys);
    }

    // --- Metadata & naming -----------------------------------------------

    [Fact]
    public void RuntimeVariant_RecordsFrameworkRuntimeAndBaseTargetMetadata()
    {
        var targets = BuildTargets(WinAndIos());

        var publishMeta = targets["publish-net10.0-win-x64"].Metadata!;
        Assert.Equal("net10.0", publishMeta.TargetFramework);
        Assert.Equal("win-x64", publishMeta.RuntimeIdentifier);
        Assert.Equal("publish", publishMeta.FrameworkVariantOf);

        Assert.Equal("build", targets["build-net10.0-win-x64-release"].Metadata!.FrameworkVariantOf);
    }

    [Fact]
    public void RuntimeVariantNames_NeverContainColon()
    {
        var targets = BuildTargets(WinAndIos());

        foreach (var name in targets.Keys.Where(k => k.Contains("win-x64") || k.Contains("ios-arm64")))
        {
            Assert.DoesNotContain(':', name);
        }
    }

    [Fact]
    public void MultipleRids_EmitVariantsForEach()
    {
        var targets = BuildTargets(new List<FrameworkVariant>
        {
            Variant("net10.0", new[] { "win-x64", "linux-x64" }),
            Variant("net10.0-ios", new[] { "ios-arm64" },
                extraProps: new[]
                {
                    ("RuntimeIdentifier", "iossimulator-arm64"),
                    ("OutputPath", "bin/Debug/net10.0-ios/iossimulator-arm64/"),
                    ("IntermediateOutputPath", "obj/Debug/net10.0-ios/iossimulator-arm64/"),
                }),
        });

        Assert.Contains("publish-net10.0-win-x64", targets.Keys);
        Assert.Contains("publish-net10.0-linux-x64", targets.Keys);
        Assert.Contains("publish-net10.0-ios-ios-arm64", targets.Keys);
    }
}
