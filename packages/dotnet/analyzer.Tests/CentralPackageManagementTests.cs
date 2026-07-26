using MsbuildAnalyzer;
using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Central Package Management resolution, and the per-package externalDependencies inputs it
/// produces in place of a whole-file Directory.Packages.props input.
/// </summary>
public class CentralPackageManagementTests
{
    private static readonly string WorkspaceRoot =
        Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");

    private static Dictionary<string, string> CpmEnabled() =>
        new() { ["ManagePackageVersionsCentrally"] = "true" };

    private static PackageReference Ref(
        string include,
        string? version = null,
        string? versionOverride = null) =>
        new() { Include = include, Version = version, VersionOverride = versionOverride };

    // ---------------------------------------------------------------------
    // Version resolution
    // ---------------------------------------------------------------------

    [Fact]
    public void ResolvesVersionsFromPackageVersionItems()
    {
        var resolved = Analyzer.ResolveCentralPackages(
            CpmEnabled(),
            new List<PackageReference> { Ref("Serilog"), Ref("Newtonsoft.Json") },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Serilog"] = "4.0.0",
                ["Newtonsoft.Json"] = "13.0.3",
                ["Unused.Package"] = "1.0.0"
            });

        Assert.NotNull(resolved);
        // Only referenced packages, sorted by id.
        Assert.Equal(
            new[] { ("Newtonsoft.Json", "13.0.3"), ("Serilog", "4.0.0") },
            resolved!.Select(p => (p.Id, p.Version)).ToArray());
    }

    [Fact]
    public void VersionOverride_WinsOverCentralVersion()
    {
        var resolved = Analyzer.ResolveCentralPackages(
            CpmEnabled(),
            new List<PackageReference> { Ref("Serilog", versionOverride: "2.0.0") },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Serilog"] = "4.0.0"
            });

        Assert.NotNull(resolved);
        Assert.Equal("2.0.0", Assert.Single(resolved!).Version);
    }

    [Fact]
    public void InlineVersion_UsedWhenPresent()
    {
        var resolved = Analyzer.ResolveCentralPackages(
            CpmEnabled(),
            new List<PackageReference> { Ref("Serilog", version: "3.1.1") },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase));

        Assert.NotNull(resolved);
        Assert.Equal("3.1.1", Assert.Single(resolved!).Version);
    }

    [Fact]
    public void PackageIdMatching_IsCaseInsensitive_AndPrefersManifestCasing()
    {
        // The manifest's casing wins so the external node name agrees with what
        // createTouchedDependencies parses out of the same manifest.
        var resolved = Analyzer.ResolveCentralPackages(
            CpmEnabled(),
            new List<PackageReference> { Ref("serilog") },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Serilog"] = "4.0.0"
            });

        Assert.NotNull(resolved);
        var package = Assert.Single(resolved!);
        Assert.Equal("Serilog", package.Id);
        Assert.Equal("4.0.0", package.Version);
    }

    [Fact]
    public void VersionOverride_KeepsManifestCasing()
    {
        var resolved = Analyzer.ResolveCentralPackages(
            CpmEnabled(),
            new List<PackageReference> { Ref("serilog", versionOverride: "2.0.0") },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Serilog"] = "4.0.0"
            });

        Assert.NotNull(resolved);
        var package = Assert.Single(resolved!);
        Assert.Equal("Serilog", package.Id);
        Assert.Equal("2.0.0", package.Version);
    }

    [Fact]
    public void ProjectWithNoPackages_ResolvesToEmpty_NotNull()
    {
        // An empty list is meaningful: nothing in Directory.Packages.props should invalidate
        // a project with no references.
        var resolved = Analyzer.ResolveCentralPackages(
            CpmEnabled(),
            new List<PackageReference>(),
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Serilog"] = "4.0.0"
            });

        Assert.NotNull(resolved);
        Assert.Empty(resolved!);
    }

    [Fact]
    public void ReturnsNull_WhenCentralPackageManagementIsOff()
    {
        Assert.Null(Analyzer.ResolveCentralPackages(
            new Dictionary<string, string>(),
            new List<PackageReference> { Ref("Serilog", version: "4.0.0") },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)));
    }

    [Fact]
    public void ReturnsNull_WhenAVersionCannotBeDetermined()
    {
        // Unresolvable version — the caller must keep the whole-file input.
        Assert.Null(Analyzer.ResolveCentralPackages(
            CpmEnabled(),
            new List<PackageReference> { Ref("Serilog"), Ref("Mystery.Package") },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Serilog"] = "4.0.0"
            }));
    }

    [Fact]
    public void DuplicateReferences_AreCollapsed()
    {
        var resolved = Analyzer.ResolveCentralPackages(
            CpmEnabled(),
            new List<PackageReference> { Ref("Serilog"), Ref("Serilog") },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Serilog"] = "4.0.0"
            });

        Assert.NotNull(resolved);
        Assert.Single(resolved!);
    }

    // ---------------------------------------------------------------------
    // externalDependencies inputs
    // ---------------------------------------------------------------------

    private static Dictionary<string, Target> BuildTargets(
        List<ResolvedPackage>? resolvedPackages,
        bool isExe = false,
        bool isTest = false,
        List<string>? directoryBuildInputs = null) =>
        TargetBuilder.BuildTargets(
            projectName: "MyProj",
            fileName: "MyProj.csproj",
            isTest: isTest,
            isExe: isExe,
            packageRefs: new List<PackageReference>(),
            properties: new Dictionary<string, string>(),
            projectDirectory: Path.Combine(WorkspaceRoot, "apps", "MyProj"),
            workspaceRoot: WorkspaceRoot,
            options: new PluginOptions(),
            nxJson: null,
            directoryBuildInputs: directoryBuildInputs ?? new List<string>(),
            resolvedPackages: resolvedPackages);

    private static string[]? ExternalDependencies(Target target)
    {
        foreach (var input in target.Inputs ?? Array.Empty<object>())
        {
            var property = input.GetType().GetProperty("externalDependencies");
            if (property is not null)
            {
                return (string[]?)property.GetValue(input);
            }
        }
        return null;
    }

    [Fact]
    public void CacheableTargets_DeclareExternalDependencies()
    {
        var packages = new List<ResolvedPackage>
        {
            new() { Id = "Serilog", Version = "4.0.0" }
        };

        foreach (var targetName in new[] { "build", "build:release" })
        {
            var targets = BuildTargets(packages);
            Assert.Equal(
                new[] { "nuget:Serilog@4.0.0" },
                ExternalDependencies(targets[targetName]));
        }

        // pack is only generated for libraries, publish only for executables
        Assert.Equal(
            new[] { "nuget:Serilog@4.0.0" },
            ExternalDependencies(BuildTargets(packages)["pack"]));
        Assert.Equal(
            new[] { "nuget:Serilog@4.0.0" },
            ExternalDependencies(BuildTargets(packages, isExe: true)["publish"]));
        Assert.Equal(
            new[] { "nuget:Serilog@4.0.0" },
            ExternalDependencies(BuildTargets(packages, isTest: true)["test"]));
    }

    [Fact]
    public void ExternalNodeNames_IncludeTheVersion()
    {
        // Two CPM scopes pinning one package to different versions must not collide on a
        // shared node name, or one scope's version silently overwrites the other's.
        var targets = BuildTargets(new List<ResolvedPackage>
        {
            new() { Id = "Serilog", Version = "3.1.1" }
        });

        Assert.Equal(new[] { "nuget:Serilog@3.1.1" }, ExternalDependencies(targets["build"]));
    }

    [Fact]
    public void EmptyPackageList_StillDeclaresExternalDependencies()
    {
        // An empty array opts the target out of Nx's AllExternalDependencies fallback, so a
        // project referencing no packages stops being invalidated by unrelated churn.
        var targets = BuildTargets(new List<ResolvedPackage>());

        Assert.Equal(Array.Empty<string>(), ExternalDependencies(targets["build"]));
    }

    [Fact]
    public void NullResolution_LeavesInputsUnchanged()
    {
        var targets = BuildTargets(
            resolvedPackages: null,
            directoryBuildInputs: new List<string>
            {
                "{workspaceRoot}/Directory.Packages.props"
            });

        Assert.Null(ExternalDependencies(targets["build"]));
        Assert.Contains(
            "{workspaceRoot}/Directory.Packages.props",
            targets["build"].Inputs!.OfType<string>());
    }

    [Fact]
    public void NonCacheableTargets_StillDeclareNoInputs()
    {
        var targets = BuildTargets(
            new List<ResolvedPackage> { new() { Id = "Serilog", Version = "4.0.0" } },
            isExe: true);

        Assert.Null(targets["restore"].Inputs);
        Assert.Null(targets["clean"].Inputs);
        Assert.Null(targets["watch"].Inputs);
        Assert.Null(targets["run"].Inputs);
    }

    [Fact]
    public void ExternalDependencies_ArePlacedBeforeDirectoryBuildInputs()
    {
        // The existing contract is that Directory.* inputs come last; anything spliced after
        // them would break TargetBuilderDirectoryBuildInputsTests.
        var targets = BuildTargets(
            new List<ResolvedPackage> { new() { Id = "Serilog", Version = "4.0.0" } },
            directoryBuildInputs: new List<string> { "{workspaceRoot}/Directory.Build.props" });

        var inputs = targets["build"].Inputs!;
        Assert.Equal("{workspaceRoot}/Directory.Build.props", inputs[^1] as string);
        Assert.NotNull(ExternalDependencies(targets["build"]));
    }

    [Fact]
    public void IsCentralPackagesInput_MatchesOnlyTheCpmManifest()
    {
        Assert.True(ProjectUtilities.IsCentralPackagesInput(
            "{workspaceRoot}/Directory.Packages.props"));
        Assert.True(ProjectUtilities.IsCentralPackagesInput(
            "{workspaceRoot}/group/Directory.Packages.props"));
        Assert.False(ProjectUtilities.IsCentralPackagesInput(
            "{workspaceRoot}/Directory.Build.props"));
    }
}
