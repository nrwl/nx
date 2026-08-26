using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for the split test targets.
///
/// Like the other TargetBuilder tests these drive the pure-logic path with a
/// property dictionary mirroring what MSBuild would return, and inject the
/// discovered test units directly rather than evaluating a real project.
/// </summary>
public class TargetBuilderAtomizerTests
{
    private static readonly string WorkspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-ws");
    private static readonly string ProjectDirectory = Path.Combine(WorkspaceRoot, "apps", "IntegrationTests");

    private static readonly List<TestUnit> TwoClasses =
    [
        new() { Namespace = "Acme.Integration", ClassName = "CheckoutTests" },
        new() { Namespace = "Acme.Integration", ClassName = "LoginTests" }
    ];

    private static PluginOptions Options(
        string? ciTargetName = "test-ci",
        string? ciGroupName = "TEST (CI)",
        SplitBy splitBy = SplitBy.Class) => new()
        {
            TestCiTargetName = ciTargetName,
            TestCiGroupName = ciGroupName,
            TestCiSplitBy = splitBy
        };

    private static BuildTargetsResult Build(
        PluginOptions? options = null,
        List<TestUnit>? units = null,
        bool supportsSplitting = true,
        bool isTest = true,
        Dictionary<string, string>? properties = null,
        string? projectDirectory = null) =>
        TargetBuilder.BuildTargets(
            projectName: "IntegrationTests",
            fileName: "IntegrationTests.csproj",
            isTest: isTest,
            isExe: true,
            packageRefs: [],
            properties: properties ?? new Dictionary<string, string>(),
            projectDirectory: projectDirectory ?? ProjectDirectory,
            workspaceRoot: WorkspaceRoot,
            options: options ?? Options(),
            nxJson: null,
            directoryBuildInputs: [],
            supportsSplitting: supportsSplitting,
            discoverTestUnits: _ => new TestDiscoveryResult { Units = units ?? TwoClasses });

    private static string[] Args(Target target) => target.Options?.Args ?? [];

    // --- Opt-in gating ------------------------------------------------------

    [Fact]
    public void WithoutCiTargetName_NoSplitTargetsAreEmitted()
    {
        var result = Build(Options(ciTargetName: null));

        Assert.DoesNotContain(result.Targets.Keys, name => name.StartsWith("test-ci"));
        Assert.Null(result.TargetGroups);
        Assert.False(result.DerivedFromSources);
        // The ordinary test target is untouched.
        Assert.True(result.Targets.ContainsKey("test"));
    }

    [Fact]
    public void WithoutMsTestOnThePlatform_NoSplitTargetsAreEmitted()
    {
        // The filters come from MSTest's contribution to the platform, so a
        // project without both cannot be split even when asked.
        var result = Build(supportsSplitting: false);

        Assert.DoesNotContain(result.Targets.Keys, name => name.StartsWith("test-ci"));
        Assert.False(result.DerivedFromSources);
    }

    [Fact]
    public void NonTestProject_IsNeverSplit()
    {
        var result = Build(isTest: false);

        Assert.DoesNotContain(result.Targets.Keys, name => name.StartsWith("test-ci"));
    }

    [Fact]
    public void WithNoDiscoveredUnits_EmitsNoParentEither()
    {
        // An empty group would show in the UI, and a no-op parent with no
        // dependencies would pass while running nothing.
        var result = Build(units: []);

        Assert.DoesNotContain(result.Targets.Keys, name => name.StartsWith("test-ci"));
        Assert.Null(result.TargetGroups);
    }

    [Fact]
    public void WithNoDiscoveredUnits_StillReportsWhySkippedClassesWereLeftOut()
    {
        // A project whose only test classes were all nested or generic gets
        // nothing from opting in, and that is exactly the case worth
        // explaining rather than leaving silent.
        var originalError = Console.Error;
        var writer = new StringWriter();
        Console.SetError(writer);
        try
        {
            TargetBuilder.BuildTargets(
                projectName: "IntegrationTests",
                fileName: "IntegrationTests.csproj",
                isTest: true,
                isExe: true,
                packageRefs: [],
                properties: new Dictionary<string, string>(),
                projectDirectory: ProjectDirectory,
                workspaceRoot: WorkspaceRoot,
                options: Options(),
                nxJson: null,
                directoryBuildInputs: [],
                supportsSplitting: true,
                discoverTestUnits: _ => new TestDiscoveryResult
                {
                    Units = [],
                    SkippedNested = 2
                });
        }
        finally
        {
            Console.SetError(originalError);
        }

        Assert.Contains("could not split any tests", writer.ToString());
        Assert.Contains("2 nested", writer.ToString());
    }

    [Fact]
    public void WithOnlyInheritedTests_ReportsWhyMethodModeSplitNothing()
    {
        // A class can pass discovery (a real, atomizable [TestClass]) yet
        // produce zero units in method mode because every test it runs is
        // inherited from a base class — SkippedNested and SkippedGeneric both
        // stay 0, so without this category there is nothing to report at all.
        var originalError = Console.Error;
        var writer = new StringWriter();
        Console.SetError(writer);
        try
        {
            TargetBuilder.BuildTargets(
                projectName: "IntegrationTests",
                fileName: "IntegrationTests.csproj",
                isTest: true,
                isExe: true,
                packageRefs: [],
                properties: new Dictionary<string, string>(),
                projectDirectory: ProjectDirectory,
                workspaceRoot: WorkspaceRoot,
                options: Options(splitBy: SplitBy.Method),
                nxJson: null,
                directoryBuildInputs: [],
                supportsSplitting: true,
                discoverTestUnits: _ => new TestDiscoveryResult
                {
                    Units = [],
                    SkippedNoOwnMethod = 1
                });
        }
        finally
        {
            Console.SetError(originalError);
        }

        Assert.Contains("could not split any tests", writer.ToString());
        Assert.Contains("1 with no test method of their own", writer.ToString());
    }

    [Fact]
    public void UnrunnableClasses_AreNotDescribedAsStillRunningUnderTheTestTarget()
    {
        // An ignored, non-public or empty [TestClass] is not run by MSTest at
        // all, so it must not be folded into the sentence that promises the
        // unsplit target still covers what was left out.
        var originalError = Console.Error;
        var writer = new StringWriter();
        Console.SetError(writer);
        try
        {
            TargetBuilder.BuildTargets(
                projectName: "IntegrationTests",
                fileName: "IntegrationTests.csproj",
                isTest: true,
                isExe: true,
                packageRefs: [],
                properties: new Dictionary<string, string>(),
                projectDirectory: ProjectDirectory,
                workspaceRoot: WorkspaceRoot,
                options: Options(),
                nxJson: null,
                directoryBuildInputs: [],
                supportsSplitting: true,
                discoverTestUnits: _ => new TestDiscoveryResult
                {
                    Units = TwoClasses,
                    SkippedUnrunnable = 2
                });
        }
        finally
        {
            Console.SetError(originalError);
        }

        var output = writer.ToString();
        Assert.Contains("2 ignored, non-public, or empty test classes", output);
        Assert.Contains("would not run them under any target", output);
        Assert.DoesNotContain("still run as part of", output);
    }

    [Fact]
    public void NoOwnMethod_IsNotExplainedAsInheritance()
    {
        // The count covers any class declaring no [TestMethod] in method mode,
        // including one with no base type at all, so it cannot claim the tests
        // were inherited.
        var originalError = Console.Error;
        var writer = new StringWriter();
        Console.SetError(writer);
        try
        {
            TargetBuilder.BuildTargets(
                projectName: "IntegrationTests",
                fileName: "IntegrationTests.csproj",
                isTest: true,
                isExe: true,
                packageRefs: [],
                properties: new Dictionary<string, string>(),
                projectDirectory: ProjectDirectory,
                workspaceRoot: WorkspaceRoot,
                options: Options(splitBy: SplitBy.Method),
                nxJson: null,
                directoryBuildInputs: [],
                supportsSplitting: true,
                discoverTestUnits: _ => new TestDiscoveryResult
                {
                    Units = [],
                    SkippedNoOwnMethod = 1
                });
        }
        finally
        {
            Console.SetError(originalError);
        }

        var output = writer.ToString();
        Assert.Contains("1 with no test method of their own", output);
        Assert.DoesNotContain("inherited", output);
    }

    [Fact]
    public void WhenEveryUnitIsRejected_NoParentTargetIsEmitted()
    {
        // The units.Count == 0 return cannot cover this: discovery found units,
        // and the id guard emptied them afterwards. A parent with no
        // dependencies would pass while running nothing.
        var originalError = Console.Error;
        var writer = new StringWriter();
        Console.SetError(writer);
        BuildTargetsResult result;
        try
        {
            result = Build(units:
            [
                new() { Namespace = "Acme", ClassName = "Weird Name" },
                new() { Namespace = "Acme", ClassName = "Also Weird" }
            ]);
        }
        finally
        {
            Console.SetError(originalError);
        }

        Assert.DoesNotContain(result.Targets.Keys, name => name.StartsWith("test-ci"));
        Assert.Null(result.TargetGroups);
    }

    [Fact]
    public void WithNoDiscoveredUnits_StillReportsBeingDerivedFromSources()
    {
        // Regression test. A project that opts in but declares no test classes
        // yet emits no targets, but its sources still have to be hashed: nothing
        // about its project file changes when the first test class is added, so
        // treating "no targets" as "does not depend on sources" would leave that
        // first class invisible until an unrelated change or `nx reset`.
        var result = Build(units: []);

        Assert.True(result.DerivedFromSources);
    }

    [Fact]
    public void WhenSplittingIsNotRequested_IsNotDerivedFromSources()
    {
        // The counterpart: no opt-in means no source hashing, which is what
        // keeps the cost at zero for workspaces that never split.
        Assert.False(Build(Options(ciTargetName: null)).DerivedFromSources);
        Assert.False(Build(supportsSplitting: false).DerivedFromSources);
        Assert.False(Build(isTest: false).DerivedFromSources);
    }

    [Fact]
    public void UnitWithAnIdThatIsNotADottedIdentifierSequence_IsSkipped()
    {
        // Id feeds a target name, a filter, and a results-directory path, so
        // an unexpected shape must be refused rather than trusted. The rest
        // of the units still get their targets.
        var originalError = Console.Error;
        var writer = new StringWriter();
        Console.SetError(writer);
        BuildTargetsResult result;
        try
        {
            result = Build(units:
            [
                new() { Namespace = "Acme", ClassName = "Weird Name" },
                new() { Namespace = "Acme", ClassName = "Fine" }
            ]);
        }
        finally
        {
            Console.SetError(originalError);
        }

        Assert.False(result.Targets.ContainsKey("test-ci--Acme.Weird Name"));
        Assert.True(result.Targets.ContainsKey("test-ci--Acme.Fine"));
        Assert.Contains("not a plain dotted identifier sequence", writer.ToString());

        var dependencies = (result.Targets["test-ci"].DependsOn ?? [])
            .OfType<TargetDependency>()
            .ToList();
        Assert.Single(dependencies);
        Assert.Equal("test-ci--Acme.Fine", dependencies[0].Target);
    }

    // --- Shape of the emitted targets --------------------------------------

    [Fact]
    public void EmitsOneLeafPerUnitPlusANoopParent()
    {
        var result = Build();

        Assert.True(result.Targets.ContainsKey("test-ci--Acme.Integration.LoginTests"));
        Assert.True(result.Targets.ContainsKey("test-ci--Acme.Integration.CheckoutTests"));
        Assert.Equal("nx:noop", result.Targets["test-ci"].Executor);
        Assert.Null(result.Targets["test-ci"].Command);
        Assert.True(result.DerivedFromSources);
    }

    [Fact]
    public void ParentPointsBackAtTheNonAtomizedTarget()
    {
        // Nx core keys the Nx Cloud requirement, .env resolution and
        // target-defaults matching off this.
        var result = Build();

        Assert.Equal("test", result.Targets["test-ci"].Metadata?.NonAtomizedTarget);
    }

    [Fact]
    public void ParentPointsAtARenamedTestTarget()
    {
        var options = Options();
        options.TestTargetName = "unit-test";

        var result = Build(options);

        Assert.Equal("unit-test", result.Targets["test-ci"].Metadata?.NonAtomizedTarget);
    }

    [Fact]
    public void ParentDependsOnEveryLeafWithForwarding()
    {
        var result = Build();

        var dependencies = (result.Targets["test-ci"].DependsOn ?? [])
            .OfType<TargetDependency>()
            .ToList();

        Assert.Equal(2, dependencies.Count);
        Assert.All(dependencies, dependency =>
        {
            // Without forwarding, flags typed on the parent stop at the no-op.
            Assert.Equal("forward", dependency.Params);
            Assert.Equal("forward", dependency.Options);
        });
        Assert.Contains(dependencies, d => d.Target == "test-ci--Acme.Integration.LoginTests");
    }

    [Fact]
    public void LeavesReuseTheTestTargetInputsAndBuildDependency()
    {
        var result = Build();

        var test = result.Targets["test"];
        var leaf = result.Targets["test-ci--Acme.Integration.LoginTests"];

        Assert.Equal(test.Inputs, leaf.Inputs);
        Assert.Equal(test.Cache, leaf.Cache);
        // --no-build only works because the build output is a dependency.
        Assert.Equal(test.DependsOn, leaf.DependsOn);
        Assert.Contains("--no-build", Args(leaf));
    }

    [Fact]
    public void TargetGroupListsTheParentFirst()
    {
        var result = Build();

        var group = Assert.Contains("TEST (CI)", result.TargetGroups!);
        Assert.Equal("test-ci", group[0]);
        Assert.Equal(3, group.Count);
    }

    // --- Filters ------------------------------------------------------------

    [Fact]
    public void ClassLeavesFilterByFullyQualifiedClassName()
    {
        var result = Build();

        var args = Args(result.Targets["test-ci--Acme.Integration.LoginTests"]);
        var index = Array.IndexOf(args, "--filter");

        Assert.True(index >= 0);
        // The namespace is required: MSTest matches nothing for a bare class
        // name. The platform-level --treenode-filter is not an option here
        // because MSTest does not register it.
        Assert.Equal("\"ClassName=Acme.Integration.LoginTests\"", args[index + 1]);
    }

    [Fact]
    public void MethodLeavesFilterByExactFullyQualifiedName()
    {
        var result = Build(
            Options(splitBy: SplitBy.Method),
            units:
            [
                new() { Namespace = "Acme", ClassName = "Tests", MethodName = "LoginTest" },
                new() { Namespace = "Acme", ClassName = "Tests", MethodName = "LoginTestWithMfa" }
            ]);

        var args = Args(result.Targets["test-ci--Acme.Tests.LoginTest"]);
        var index = Array.IndexOf(args, "--filter");

        Assert.True(index >= 0);
        // Exact match, so LoginTestWithMfa does not also run in this leaf.
        Assert.Equal("\"FullyQualifiedName=Acme.Tests.LoginTest\"", args[index + 1]);
    }

    [Fact]
    public void FilterValuesAreQuoted()
    {
        // Nx runs commands through a shell, so the filter expression is quoted
        // rather than left to word-splitting.
        var result = Build();

        Assert.All(
            result.Targets.Where(pair => pair.Key.StartsWith("test-ci--")),
            pair =>
            {
                var args = Args(pair.Value);
                var index = Array.IndexOf(args, "--filter");
                Assert.True(index >= 0);
                Assert.StartsWith("\"", args[index + 1]);
                Assert.EndsWith("\"", args[index + 1]);
            });
    }

    [Fact]
    public void NoReporterIsTurnedOn()
    {
        // --report-trx comes from an extension that is only present when the
        // project references it; passing it otherwise is a hard failure.
        var result = Build();

        Assert.All(
            result.Targets.Where(pair => pair.Key.StartsWith("test-ci--")),
            pair => Assert.DoesNotContain(Args(pair.Value), arg => arg.StartsWith("--report-")));
    }

    [Fact]
    public void EveryLeafFailsLoudlyWhenItsFilterMatchesNothing()
    {
        var result = Build();

        Assert.All(
            result.Targets.Where(pair => pair.Key.StartsWith("test-ci--")),
            pair =>
            {
                var args = Args(pair.Value);
                var index = Array.IndexOf(args, "--minimum-expected-tests");
                Assert.True(index >= 0);
                Assert.Equal("1", args[index + 1]);
            });
    }

    [Fact]
    public void PlatformArgumentsFollowASeparator()
    {
        var result = Build();

        var args = Args(result.Targets["test-ci--Acme.Integration.LoginTests"]);
        var separator = Array.IndexOf(args, "--");

        Assert.True(separator >= 0);
        // Everything the platform needs must be after it; SDK flags before.
        Assert.True(Array.IndexOf(args, "--filter") > separator);
        Assert.True(Array.IndexOf(args, "--no-build") < separator);
    }

    [Fact]
    public void TheWholeArgumentVectorIsPinned()
    {
        // Pinned verbatim rather than probed flag by flag, because this vector
        // is the entire contract with `dotnet test` and every element of it was
        // established by running a real MSTest binary rather than from docs:
        //
        //   --no-restore            redundant next to --no-build, which implies
        //                           it on both SDKs; kept so a leaf's flags
        //                           match the unsplit target
        //   --                      accepted by the VSTest bridge (.NET 9) and
        //                           by .NET 10's platform runner alike, which is
        //                           why no branch on runner mode exists
        //   --filter ClassName=     MSTest does not register the platform's
        //                           tree-node filter service and rejects
        //                           --treenode-filter outright
        //   --minimum-expected-tests  turns a filter that matches nothing into
        //                           a non-zero exit instead of a silent pass
        //   (no reporter)           --report-trx comes from an extension the
        //                           project may not reference, and is a hard
        //                           failure when it does not
        var result = Build();

        Assert.Equal(
            [
                "--no-build",
                "--no-restore",
                "--",
                "--filter",
                "\"ClassName=Acme.Integration.LoginTests\"",
                "--results-directory",
                "\"TestResults/Acme.Integration.LoginTests\"",
                "--minimum-expected-tests",
                "1"
            ],
            Args(result.Targets["test-ci--Acme.Integration.LoginTests"]));
    }

    // --- Results directories ------------------------------------------------

    [Fact]
    public void EachLeafClaimsItsOwnResultsDirectory()
    {
        // Sharing the project's TestResults directory would make replaying one
        // leaf from cache restore the others' results too.
        var result = Build();

        Assert.Equal(
            ["{projectRoot}/TestResults/Acme.Integration.LoginTests"],
            result.Targets["test-ci--Acme.Integration.LoginTests"].Outputs);
        Assert.Equal(
            ["{projectRoot}/TestResults/Acme.Integration.CheckoutTests"],
            result.Targets["test-ci--Acme.Integration.CheckoutTests"].Outputs);
    }

    [Fact]
    public void ResultsDirectoryArgumentIsRelativeToTheWorkingDirectory()
    {
        var result = Build();

        var args = Args(result.Targets["test-ci--Acme.Integration.LoginTests"]);
        var index = Array.IndexOf(args, "--results-directory");

        Assert.Equal("\"TestResults/Acme.Integration.LoginTests\"", args[index + 1]);
    }

    [Fact]
    public void WorkspaceAnchoredResultsDirectoryWalksBackUp()
    {
        // The artifacts-output layout puts results above the project directory,
        // so the CLI argument has to climb out of it.
        var properties = new Dictionary<string, string>
        {
            ["UseArtifactsOutput"] = "true",
            ["ArtifactsPath"] = Path.Combine(WorkspaceRoot, "artifacts")
        };

        var result = Build(properties: properties);
        var leaf = result.Targets["test-ci--Acme.Integration.LoginTests"];
        var args = Args(leaf);
        var index = Array.IndexOf(args, "--results-directory");

        Assert.Equal(
            ["{workspaceRoot}/artifacts/TestResults/IntegrationTests/Acme.Integration.LoginTests"],
            leaf.Outputs);
        Assert.Equal(
            "\"../../artifacts/TestResults/IntegrationTests/Acme.Integration.LoginTests\"",
            args[index + 1]);
    }

    [Fact]
    public void ResultsDirectoryAtTheProjectRootStillSplits()
    {
        // TestResultsDirectory can resolve to the project directory itself, and
        // ResolvePath emits a bare "{projectRoot}" for it. That is a supported
        // layout, not a directory outside the workspace.
        var properties = new Dictionary<string, string>
        {
            ["TestResultsDirectory"] = ProjectDirectory
        };

        var result = Build(properties: properties);
        var leaf = result.Targets["test-ci--Acme.Integration.LoginTests"];
        var args = Args(leaf);
        var index = Array.IndexOf(args, "--results-directory");

        Assert.Equal(["{projectRoot}/Acme.Integration.LoginTests"], leaf.Outputs);
        Assert.Equal("\"./Acme.Integration.LoginTests\"", args[index + 1]);
    }

    [Fact]
    public void ResultsDirectoryAtTheWorkspaceRootStillSplits()
    {
        // The same bare-token case one level up: a workspace-anchored results
        // directory has to climb out of the project to reach it.
        var properties = new Dictionary<string, string>
        {
            ["TestResultsDirectory"] = WorkspaceRoot
        };

        var result = Build(properties: properties);
        var leaf = result.Targets["test-ci--Acme.Integration.LoginTests"];
        var args = Args(leaf);
        var index = Array.IndexOf(args, "--results-directory");

        Assert.Equal(["{workspaceRoot}/Acme.Integration.LoginTests"], leaf.Outputs);
        Assert.Equal("\"../../Acme.Integration.LoginTests\"", args[index + 1]);
    }

    [Theory]
    [InlineData("TestResults/`touch /tmp/pwned`")]
    [InlineData("TestResults\" ; touch /tmp/pwned ; echo \"")]
    [InlineData("TestResults/$(id)")]
    [InlineData("../../../../tmp/escaped")]
    public void ResultsDirectoryThatIsNotAPlainPath_ReportsWhyNothingSplit(string testResultsDirectory)
    {
        // The resolved base is interpolated into --results-directory, which Nx
        // joins into a command string and runs through a shell, so a value that
        // is not a plain path is refused the same way an unusable unit id is.
        // MSBuild does not interpret these, so they reach the analyzer verbatim.
        var properties = new Dictionary<string, string>
        {
            ["TestResultsDirectory"] = testResultsDirectory
        };

        var originalError = Console.Error;
        var writer = new StringWriter();
        Console.SetError(writer);
        BuildTargetsResult result;
        try
        {
            result = Build(properties: properties);
        }
        finally
        {
            Console.SetError(originalError);
        }

        Assert.DoesNotContain(result.Targets.Keys, name => name.StartsWith("test-ci"));
        Assert.Null(result.TargetGroups);
        Assert.Contains("cannot split tests", writer.ToString());
    }

    [Fact]
    public void ResultsDirectoryWithOrdinaryPunctuationStillSplits()
    {
        // The guard is an allow-list, so the ordinary characters a results
        // directory actually uses have to keep working — including a space,
        // which is safe because the argument is emitted already quoted.
        var properties = new Dictionary<string, string>
        {
            ["TestResultsDirectory"] = "artifacts/test-results.v2/Integration Tests"
        };

        var result = Build(properties: properties);

        Assert.Contains(result.Targets.Keys, name => name.StartsWith("test-ci--"));
    }

    [Fact]
    public void ResultsDirectoryOutsideTheWorkspace_ReportsWhyNothingSplit()
    {
        // Matches the two sibling gates (unsupported platform, no parser
        // available): reports why splitting stopped rather than bailing out
        // silently.
        var properties = new Dictionary<string, string>
        {
            ["TestResultsDirectory"] =
                Path.Combine(Path.GetTempPath(), "nx-dotnet-results-outside-workspace")
        };

        var originalError = Console.Error;
        var writer = new StringWriter();
        Console.SetError(writer);
        BuildTargetsResult result;
        try
        {
            result = Build(properties: properties);
        }
        finally
        {
            Console.SetError(originalError);
        }

        Assert.DoesNotContain(result.Targets.Keys, name => name.StartsWith("test-ci"));
        Assert.Null(result.TargetGroups);
        Assert.Contains("cannot split tests", writer.ToString());
        Assert.Contains("outside the workspace", writer.ToString());
    }

    [Fact]
    public void ParentKeepsTheWholeResultsDirectoryAsItsOutput()
    {
        var result = Build();

        Assert.Equal(result.Targets["test"].Outputs, result.Targets["test-ci"].Outputs);
    }

    // --- Parallelism --------------------------------------------------------

    [Fact]
    public void LeavesRunConcurrentlyByDefault()
    {
        var result = Build();

        Assert.Null(result.Targets["test-ci--Acme.Integration.LoginTests"].Parallelism);
        Assert.Null(result.Targets["test-ci"].Parallelism);
    }

    [Fact]
    public void DoNotParallelizeUnitsAreMarkedSerial()
    {
        var result = Build(units:
        [
            new() { Namespace = "Acme", ClassName = "Serial", DoNotParallelize = true },
            new() { Namespace = "Acme", ClassName = "Concurrent" }
        ]);

        Assert.False(result.Targets["test-ci--Acme.Serial"].Parallelism);
        Assert.Null(result.Targets["test-ci--Acme.Concurrent"].Parallelism);
        // Some units may still run concurrently, so the group is not serial.
        Assert.Null(result.Targets["test-ci"].Parallelism);
    }

    [Fact]
    public void WhenEveryUnitIsSerialTheGroupIsToo()
    {
        var result = Build(units:
        [
            new() { Namespace = "Acme", ClassName = "A", DoNotParallelize = true },
            new() { Namespace = "Acme", ClassName = "B", DoNotParallelize = true }
        ]);

        Assert.False(result.Targets["test-ci"].Parallelism);
    }
}
