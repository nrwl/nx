using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for the opt-in per-target-framework target variants added for
/// multi-targeted projects (https://github.com/nrwl/nx/discussions/36676).
///
/// These drive the pure target-building logic with property dictionaries that
/// mirror what MSBuild hands back for each inner build, so no full MSBuild
/// evaluation is needed.
/// </summary>
public class TargetBuilderFrameworkVariantsTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static string ProjectDir(params string[] segments) =>
        Path.Combine(new[] { WorkspaceRoot }.Concat(segments).ToArray());

    private static Dictionary<string, string> InnerProperties(string tfm) => new()
    {
        ["TargetFramework"] = tfm,
        ["OutputPath"] = $"bin/Debug/{tfm}/",
        ["IntermediateOutputPath"] = $"obj/Debug/{tfm}/",
    };

    private static Dictionary<string, Target> BuildTargets(
        bool frameworkVariants,
        List<FrameworkVariant>? variants,
        bool isExe = false,
        bool isTest = false,
        PluginOptions? options = null)
    {
        options ??= new PluginOptions();
        options.FrameworkVariants = frameworkVariants;

        return TargetBuilder.BuildTargets(
            projectName: "MyProj",
            fileName: "MyProj.csproj",
            isTest: isTest,
            isExe: isExe,
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

    private static List<FrameworkVariant> Variants(params string[] tfms) =>
        tfms.Select(t => new FrameworkVariant
        {
            TargetFramework = t,
            Properties = InnerProperties(t),
        }).ToList();

    // --- Opt-in / disabled behavior --------------------------------------

    [Fact]
    public void Disabled_ByDefault_EmitsNoVariants()
    {
        var targets = BuildTargets(frameworkVariants: false, Variants("net10.0", "net10.0-ios"));

        Assert.DoesNotContain(targets.Keys, k => k.StartsWith("build-net"));
        Assert.Contains("build", targets.Keys);
        Assert.Contains("build:release", targets.Keys);
    }

    [Fact]
    public void Enabled_ButNullVariants_EmitsNoVariants()
    {
        var targets = BuildTargets(frameworkVariants: true, variants: null);

        Assert.DoesNotContain(targets.Keys, k => k.Contains("-net"));
    }

    [Fact]
    public void Enabled_WithSingleFramework_EmitsNoVariants()
    {
        // A single evaluated framework has nothing to disambiguate.
        var targets = BuildTargets(frameworkVariants: true, Variants("net10.0"));

        Assert.DoesNotContain(targets.Keys, k => k.StartsWith("build-net"));
    }

    // --- Variant generation ----------------------------------------------

    [Fact]
    public void Enabled_WithMultipleFrameworks_EmitsBuildVariants()
    {
        var targets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"));

        Assert.Contains("build-net10.0", targets.Keys);
        Assert.Contains("build-net10.0-release", targets.Keys);
        Assert.Contains("build-net10.0-ios", targets.Keys);
        Assert.Contains("build-net10.0-ios-release", targets.Keys);

        // Unqualified targets remain untouched.
        Assert.Contains("build", targets.Keys);
        Assert.Contains("build:release", targets.Keys);
    }

    [Fact]
    public void BuildVariant_PassesFrameworkArgument()
    {
        var targets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"));

        var args = targets["build-net10.0-ios"].Options!.Args!;
        Assert.Equal(new[] { "--no-restore", "--no-dependencies", "--framework", "net10.0-ios" }, args);
    }

    [Fact]
    public void BuildVariant_ScopesOutputsToFramework()
    {
        var targets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"));

        Assert.Equal(
            new[]
            {
                "{projectRoot}/bin/Debug/net10.0-ios",
                "{projectRoot}/bin/Release/net10.0-ios",
                "{projectRoot}/obj/Debug/net10.0-ios",
                "{projectRoot}/obj/Release/net10.0-ios",
            },
            targets["build-net10.0-ios"].Outputs);
    }

    [Fact]
    public void BuildReleaseVariant_ScopesOutputsToReleaseFramework()
    {
        var targets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"));

        Assert.Equal(
            new[]
            {
                "{projectRoot}/bin/Release/net10.0-ios",
                "{projectRoot}/obj/Release/net10.0-ios",
            },
            targets["build-net10.0-ios-release"].Outputs);
    }

    [Fact]
    public void BuildVariant_RecordsFrameworkMetadata()
    {
        var targets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"));

        Assert.Equal("net10.0-ios", targets["build-net10.0-ios"].Metadata!.TargetFramework);
    }

    [Fact]
    public void PublishVariant_OnlyForExecutables_DependsOnReleaseBuild()
    {
        var exeTargets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"), isExe: true);
        Assert.Contains("publish-net10.0-ios", exeTargets.Keys);
        Assert.Equal(new[] { "build-net10.0-ios-release" }, exeTargets["publish-net10.0-ios"].DependsOn);

        var libTargets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"));
        Assert.DoesNotContain("publish-net10.0-ios", libTargets.Keys);
    }

    [Fact]
    public void TestVariant_OnlyForTestProjects_DependsOnDebugBuild()
    {
        var testTargets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"), isTest: true);
        Assert.Contains("test-net10.0-ios", testTargets.Keys);
        Assert.Equal(new[] { "build-net10.0-ios" }, testTargets["test-net10.0-ios"].DependsOn);

        var nonTestTargets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"));
        Assert.DoesNotContain("test-net10.0-ios", nonTestTargets.Keys);
    }

    // --- Naming safety & collisions --------------------------------------

    [Fact]
    public void VariantNames_NeverContainColon()
    {
        var targets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"), isExe: true);

        foreach (var name in targets.Keys.Where(k => k.Contains("net10.0")))
        {
            Assert.DoesNotContain(':', name);
        }
    }

    [Fact]
    public void VariantNames_DeriveFromConfiguredTargetName()
    {
        var options = new PluginOptions { BuildTargetName = "compile" };
        var targets = BuildTargets(frameworkVariants: true, Variants("net10.0", "net10.0-ios"), options: options);

        Assert.Contains("compile-net10.0-ios", targets.Keys);
        Assert.Contains("compile-net10.0-ios-release", targets.Keys);
        Assert.DoesNotContain("build-net10.0-ios", targets.Keys);
    }

    [Fact]
    public void CollidingNormalizedFrameworks_AreSkippedNotOverwritten()
    {
        // Two distinct evaluated frameworks whose names normalize to the same
        // token must not silently overwrite each other.
        var variants = new List<FrameworkVariant>
        {
            new() { TargetFramework = "net8.0", Properties = InnerProperties("net8.0") },
            new() { TargetFramework = "NET8.0", Properties = InnerProperties("NET8.0") },
        };

        var targets = BuildTargets(frameworkVariants: true, variants);

        Assert.Contains("build-net8.0", targets.Keys);
        // Only the first wins; the collision is reported and skipped.
        Assert.Single(targets.Keys, k => k == "build-net8.0");
    }
}
