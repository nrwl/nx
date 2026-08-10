using MsbuildAnalyzer;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for the gate that decides whether a project's tests can be split.
///
/// Getting this wrong is not a build error. The emitted tasks use options that
/// only reach the test platform when both properties below are set; short of
/// that, `dotnet test` routes through the VSTest bridge, which accepts the same
/// arguments and ignores them. Every split task would then run the whole suite
/// and report success. Each configuration that decides the answer is pinned
/// here.
/// </summary>
public class SupportsTestSplittingTests
{
    private static Dictionary<string, string> Props(params (string Key, string Value)[] entries) =>
        entries.ToDictionary(e => e.Key, e => e.Value);

    private const string Runner = "EnableMSTestRunner";
    private const string DotnetTestSupport = "TestingPlatformDotnetTestSupport";

    [Fact]
    public void BothProperties_AreRequiredAndSufficient()
    {
        // Also covers a project using the MSTest.Sdk project SDK: MSBuild does
        // not surface a project's Sdk attribute, but MSTest.Sdk sets both of
        // these properties, so such a project is recognized without one.
        Assert.True(Analyzer.SupportsTestSplitting(
            Props((Runner, "true"), (DotnetTestSupport, "true"))));
    }

    [Fact]
    public void CasingOfThePropertyValueDoesNotMatter()
    {
        Assert.True(Analyzer.SupportsTestSplitting(
            Props((Runner, "True"), (DotnetTestSupport, "TRUE"))));
    }

    // --- The cases that must be refused -------------------------------------
    //
    // Each was checked against MSTest 3.6.4 by running a filter matching no
    // tests with --minimum-expected-tests 1. Only the both-properties case
    // exits non-zero; the rest report the suite as passed.

    [Fact]
    public void RunnerAlone_IsNotEnough()
    {
        // Switches MSTest onto the platform, but `dotnet test` still uses the
        // VSTest bridge, so arguments after `--` never reach the runner.
        Assert.False(Analyzer.SupportsTestSplitting(Props((Runner, "true"))));
    }

    [Fact]
    public void DotnetTestSupportAlone_IsNotEnough()
    {
        // Routes `dotnet test` at the platform, but the project still executes
        // under VSTest.
        Assert.False(Analyzer.SupportsTestSplitting(Props((DotnetTestSupport, "true"))));
    }

    [Fact]
    public void EitherPropertySetToFalse_IsNotEnough()
    {
        Assert.False(Analyzer.SupportsTestSplitting(
            Props((Runner, "false"), (DotnetTestSupport, "true"))));

        Assert.False(Analyzer.SupportsTestSplitting(
            Props((Runner, "true"), (DotnetTestSupport, "false"))));
    }

    [Fact]
    public void NoEvidenceAtAll_IsNotEnough()
    {
        Assert.False(Analyzer.SupportsTestSplitting(Props()));
    }
}
