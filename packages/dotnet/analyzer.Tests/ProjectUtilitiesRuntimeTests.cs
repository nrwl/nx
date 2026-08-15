using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for the runtime-identifier and publish-directory resolution
/// helpers that back the per-RID variants.
/// </summary>
public class ProjectUtilitiesRuntimeTests
{
    // --- ResolveRuntimeIdentifiers ---------------------------------------

    [Fact]
    public void ResolveRuntimeIdentifiers_PluralIsAuthoritative()
    {
        var rids = ProjectUtilities.ResolveRuntimeIdentifiers(null, "win-x64;linux-x64");
        Assert.Equal(new[] { "linux-x64", "win-x64" }, rids);
    }

    [Fact]
    public void ResolveRuntimeIdentifiers_PluralSuppressesImplicitSingular()
    {
        // A platform framework can evaluate an SDK-default singular RuntimeIdentifier;
        // a declared plural list must not be polluted by it.
        var rids = ProjectUtilities.ResolveRuntimeIdentifiers("iossimulator-arm64", "ios-arm64");
        Assert.Equal(new[] { "ios-arm64" }, rids);
    }

    [Fact]
    public void ResolveRuntimeIdentifiers_FallsBackToEvaluatedSingular()
    {
        var rids = ProjectUtilities.ResolveRuntimeIdentifiers("iossimulator-arm64", null);
        Assert.Equal(new[] { "iossimulator-arm64" }, rids);
    }

    [Fact]
    public void ResolveRuntimeIdentifiers_EmptyWhenNeitherSet()
    {
        Assert.Empty(ProjectUtilities.ResolveRuntimeIdentifiers(null, null));
        Assert.Empty(ProjectUtilities.ResolveRuntimeIdentifiers("", "  "));
    }

    // --- IsPublishDirDerivable -------------------------------------------

    [Fact]
    public void IsPublishDirDerivable_EmptyPublishDir_IsDerivable()
    {
        Assert.True(ProjectUtilities.IsPublishDirDerivable(null, "bin/Debug/net10.0"));
        Assert.True(ProjectUtilities.IsPublishDirDerivable("  ", "bin/Debug/net10.0"));
    }

    [Fact]
    public void IsPublishDirDerivable_DefaultPublishUnderOutputPath_IsDerivable()
    {
        Assert.True(ProjectUtilities.IsPublishDirDerivable("bin/Debug/net10.0/publish/", "bin/Debug/net10.0/"));
        // Backslashes normalize the same way.
        Assert.True(ProjectUtilities.IsPublishDirDerivable(@"bin\Debug\net10.0\publish", @"bin\Debug\net10.0"));
    }

    [Fact]
    public void IsPublishDirDerivable_CustomPublishDir_IsNotDerivable()
    {
        Assert.False(ProjectUtilities.IsPublishDirDerivable("dist/custompub", "bin/Debug/net10.0"));
        Assert.False(ProjectUtilities.IsPublishDirDerivable("bin/Debug/net10.0/out", "bin/Debug/net10.0"));
    }
}
