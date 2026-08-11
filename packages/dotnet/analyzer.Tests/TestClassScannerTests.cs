using Microsoft.CodeAnalysis.CSharp;
using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Unit tests for test discovery.
///
/// These drive <see cref="TestClassScanner.ScanSources"/> with inline sources
/// rather than an MSBuild evaluation, following the same "pure-logic path"
/// approach as TargetBuilderOutputPathsTests: no project files, no temp
/// directories, no SDK resolution.
///
/// The stakes here are higher than for the other analyzer logic. A class or
/// method missed by discovery gets no target of its own, and a filter that is
/// too broad runs the same test in two targets at once. Every rule the scanner
/// applies is pinned below.
///
/// Fixture classes carry a throwaway `[TestMethod] public void T() { }` unless
/// the test is specifically about a class with no runnable members — a class
/// with neither a local test method nor a base class is excluded, so an empty
/// body would silently fail to discover for a reason unrelated to what most of
/// these tests actually check.
/// </summary>
public class TestClassScannerTests
{
    private static List<TestUnit> Scan(SplitBy splitBy, params string[] sources) =>
        TestClassScanner.ScanSources(sources, splitBy).Units;

    private static TestDiscoveryResult Discover(SplitBy splitBy, params string[] sources) =>
        TestClassScanner.ScanSources(sources, splitBy);

    private static List<string> Ids(SplitBy splitBy, params string[] sources) =>
        Scan(splitBy, sources).Select(unit => unit.Id).ToList();

    // --- Namespace forms ----------------------------------------------------

    [Fact]
    public void FileScopedNamespace_IsResolved()
    {
        Assert.Equal(
            ["Acme.Tests.LoginTests"],
            Ids(SplitBy.Class,
                "namespace Acme.Tests; [TestClass] public class LoginTests { [TestMethod] public void T() { } }"));
    }

    [Fact]
    public void BlockNamespace_IsResolved()
    {
        Assert.Equal(
            ["Acme.Tests.LoginTests"],
            Ids(SplitBy.Class,
                "namespace Acme.Tests { [TestClass] public class LoginTests " +
                "{ [TestMethod] public void T() { } } }"));
    }

    [Fact]
    public void NestedNamespaces_AreJoinedOutermostFirst()
    {
        Assert.Equal(
            ["Acme.Tests.LoginTests"],
            Ids(SplitBy.Class,
                "namespace Acme { namespace Tests { [TestClass] public class LoginTests " +
                "{ [TestMethod] public void T() { } } } }"));
    }

    [Fact]
    public void GlobalNamespace_ProducesUnqualifiedIdAndWildcardFilter()
    {
        var unit = Assert.Single(Scan(SplitBy.Class,
            "[TestClass] public class LoginTests { [TestMethod] public void T() { } }"));

        Assert.Equal("LoginTests", unit.Id);
        // A class in the global namespace has no namespace to qualify with.
        Assert.Equal(["--filter", "\"ClassName=LoginTests\""], unit.FilterArgs);
    }

    [Fact]
    public void NamespaceWithUnusualFormatting_DoesNotLeakIntoTheId()
    {
        // A qualified namespace name is one syntax node, and ToString() on it
        // would include whatever trivia sits between the dotted segments. This
        // must resolve the same as "Acme.Tests" regardless.
        var source = """
            namespace Acme
                . /* why is this here */ Tests;
            [TestClass]
            public class LoginTests { [TestMethod] public void T() { } }
            """;

        Assert.Equal(["Acme.Tests.LoginTests"], Ids(SplitBy.Class, source));
    }

    // --- Attribute recognition ---------------------------------------------

    [Theory]
    [InlineData("[TestClass]")]
    [InlineData("[TestClassAttribute]")]
    [InlineData("[MSTest.TestClass]")]
    [InlineData("[global::Microsoft.VisualStudio.TestTools.UnitTesting.TestClass]")]
    public void TestClassAttribute_IsRecognizedInAllSpellings(string attribute)
    {
        Assert.Equal(
            ["Acme.LoginTests"],
            Ids(SplitBy.Class,
                $"namespace Acme; {attribute} public class LoginTests {{ [TestMethod] public void T() {{ }} }}"));
    }

    [Fact]
    public void ClassWithoutTestClassAttribute_IsIgnored()
    {
        Assert.Empty(Scan(SplitBy.Class, "namespace Acme; public class LoginHelpers { }"));
    }

    [Fact]
    public void ClassNamedLikeAnAttributeMatch_IsNotConfused()
    {
        // "TestClassRunner" must not match the "TestClass" attribute name.
        Assert.Empty(Scan(SplitBy.Class, "namespace Acme; [TestClassRunner] public class LoginTests { }"));
    }

    // --- Exclusions ---------------------------------------------------------

    [Fact]
    public void NestedTestClass_IsNotAtomized()
    {
        Assert.Equal(
            ["Acme.Outer"],
            Ids(SplitBy.Class,
                "namespace Acme; [TestClass] public class Outer " +
                "{ [TestMethod] public void T() { } [TestClass] public class Inner { } }"));
    }

    [Fact]
    public void AbstractTestClass_IsNotAtomized()
    {
        Assert.Empty(Scan(SplitBy.Class, "namespace Acme; [TestClass] public abstract class BaseTests { }"));
    }

    [Fact]
    public void GenericTestClass_IsNotAtomized()
    {
        Assert.Empty(Scan(SplitBy.Class, "namespace Acme; [TestClass] public class Tests<T> { }"));
    }

    [Fact]
    public void ConcreteSubclassOfAbstractBase_IsAtomized()
    {
        // No local test method: everything it runs is inherited from
        // BaseTests, invisible to this syntax-only pass. The base list is what
        // keeps it from looking empty.
        var ids = Ids(SplitBy.Class,
            "namespace Acme; [TestClass] public abstract class BaseTests { }",
            "namespace Acme; [TestClass] public class LoginTests : BaseTests { }");

        Assert.Equal(["Acme.LoginTests"], ids);
    }

    [Fact]
    public void EmptyTestClass_WithNoMethodsOrBase_IsNotAtomized()
    {
        // Nothing here could ever pass: no local test method, and no base
        // class that might carry inherited ones. A target for it would only
        // fail on --minimum-expected-tests.
        var result = Discover(SplitBy.Class, "namespace Acme; [TestClass] public class Empty { }");

        Assert.Empty(result.Units);
        Assert.Equal(1, result.SkippedUnrunnable);
    }

    [Fact]
    public void IgnoredTestClass_IsNotAtomized()
    {
        var result = Discover(SplitBy.Class,
            "namespace Acme; [TestClass, Ignore] public class LoginTests " +
            "{ [TestMethod] public void T() { } }");

        Assert.Empty(result.Units);
        Assert.Equal(1, result.SkippedUnrunnable);
    }

    [Fact]
    public void NonPublicTestClass_IsNotAtomized()
    {
        var result = Discover(SplitBy.Class,
            "namespace Acme; [TestClass] internal class LoginTests { [TestMethod] public void T() { } }");

        Assert.Empty(result.Units);
        Assert.Equal(1, result.SkippedUnrunnable);
    }

    [Fact]
    public void NonPublicTestClass_WithAssemblyDiscoverInternals_IsAtomized()
    {
        var units = Scan(SplitBy.Class,
            "using Microsoft.VisualStudio.TestTools.UnitTesting; [assembly: DiscoverInternals]",
            "namespace Acme; [TestClass] internal class LoginTests { [TestMethod] public void T() { } }");

        Assert.Equal(["Acme.LoginTests"], units.Select(u => u.Id));
    }

    // --- Parsing robustness -------------------------------------------------

    [Fact]
    public void ClassKeywordInsideStringsAndComments_IsNotDiscovered()
    {
        // Outer delimiter is four quotes so the three-quote raw string *inside*
        // the sample source survives intact.
        var source = """"
            namespace Acme;
            [TestClass]
            public class RealTests
            {
                [TestMethod] public void T() { }
                /* [TestClass] public class CommentedOut { } */
                const string Raw = """
                    [TestClass] public class InRawString { }
                    """;
                const string Verbatim = @"[TestClass] public class InVerbatim { }";
            }
            """";

        Assert.Equal(["Acme.RealTests"], Ids(SplitBy.Class, source));
    }

    [Fact]
    public void MultipleTestClassesInOneFile_EachBecomeAUnit()
    {
        var ids = Ids(SplitBy.Class,
            "namespace Acme; [TestClass] public class A { [TestMethod] public void T() { } } " +
            "[TestClass] public class B { [TestMethod] public void T() { } }");

        Assert.Equal(["Acme.A", "Acme.B"], ids);
    }

    // --- Partial classes ----------------------------------------------------

    [Fact]
    public void PartialClassAcrossFiles_ProducesOneClassUnit()
    {
        // Deriving names from file names would emit two targets here, each
        // running the entire class.
        var ids = Ids(SplitBy.Class,
            "namespace Acme; [TestClass] public partial class LoginTests { [TestMethod] public void T() { } }",
            "namespace Acme; [TestClass] public partial class LoginTests { }");

        Assert.Equal(["Acme.LoginTests"], ids);
    }

    [Fact]
    public void PartialClassAcrossFiles_ProducesDistinctMethodUnits()
    {
        var ids = Ids(SplitBy.Method,
            "namespace Acme; [TestClass] public partial class LoginTests { [TestMethod] public void A() { } }",
            "namespace Acme; [TestClass] public partial class LoginTests { [TestMethod] public void B() { } }");

        Assert.Equal(["Acme.LoginTests.A", "Acme.LoginTests.B"], ids);
    }

    [Fact]
    public void PartialClass_DoNotParallelizeOnEitherHalf_AppliesToTheUnit()
    {
        var unit = Assert.Single(Scan(SplitBy.Class,
            "namespace Acme; [TestClass] public partial class LoginTests { [TestMethod] public void T() { } }",
            "namespace Acme; [TestClass, DoNotParallelize] public partial class LoginTests { }"));

        Assert.True(unit.DoNotParallelize);
    }

    [Fact]
    public void PartialClass_RunnableSignalOnEitherHalf_KeepsTheUnit()
    {
        // Neither half looks runnable on its own — no local test method here,
        // no base list there — but they are the same class, and one half's
        // test method is a real reason to keep it. Unioned the same way
        // DoNotParallelize is.
        var unit = Assert.Single(Scan(SplitBy.Class,
            "namespace Acme; [TestClass] public partial class LoginTests { }",
            "namespace Acme; [TestClass] public partial class LoginTests { [TestMethod] public void T() { } }"));

        Assert.Equal("Acme.LoginTests", unit.Id);
    }

    // --- Same name in different namespaces ----------------------------------

    [Fact]
    public void SameClassNameInTwoNamespaces_StaysDistinct()
    {
        var units = Scan(SplitBy.Class,
            "namespace Acme.Api; [TestClass] public class SmokeTests { [TestMethod] public void T() { } }",
            "namespace Acme.Web; [TestClass] public class SmokeTests { [TestMethod] public void T() { } }");

        Assert.Equal(["Acme.Api.SmokeTests", "Acme.Web.SmokeTests"], units.Select(u => u.Id));

        // The namespace is what keeps these from both matching one another's
        // filter and double-running. MSTest also matches nothing for a bare
        // class name, so it is required regardless.
        Assert.Equal("\"ClassName=Acme.Api.SmokeTests\"", units[0].FilterArgs[1]);
        Assert.Equal("\"ClassName=Acme.Web.SmokeTests\"", units[1].FilterArgs[1]);
    }

    // --- Method mode --------------------------------------------------------

    [Fact]
    public void MethodMode_DiscoversTestMethods()
    {
        var ids = Ids(SplitBy.Method, """
            namespace Acme;
            [TestClass]
            public class LoginTests
            {
                [TestMethod] public void Succeeds() { }
                [DataTestMethod] public void Parameterized() { }
                public void NotATest() { }
            }
            """);

        Assert.Equal(["Acme.LoginTests.Parameterized", "Acme.LoginTests.Succeeds"], ids);
    }

    [Fact]
    public void MethodMode_UsesExactFullyQualifiedNameFilter()
    {
        var unit = Assert.Single(Scan(SplitBy.Method,
            "namespace Acme; [TestClass] public class LoginTests { [TestMethod] public void Succeeds() { } }"));

        Assert.Equal(["--filter", "\"FullyQualifiedName=Acme.LoginTests.Succeeds\""], unit.FilterArgs);
    }

    [Fact]
    public void MethodMode_PrefixOverlappingNames_DoNotShareAFilter()
    {
        // Regression test for the bug a wildcard filter would introduce:
        // "LoginTest*" matches LoginTestWithMfa too, so that test would run in
        // both leaves. With an exact match, neither filter is a prefix of the
        // other's target.
        var units = Scan(SplitBy.Method, """
            namespace Acme;
            [TestClass]
            public class Tests
            {
                [TestMethod] public void LoginTest() { }
                [TestMethod] public void LoginTestWithMfa() { }
            }
            """);

        Assert.Equal(["Acme.Tests.LoginTest", "Acme.Tests.LoginTestWithMfa"], units.Select(u => u.Id));

        var filters = units.Select(u => u.FilterArgs[1]).ToList();
        Assert.Equal("\"FullyQualifiedName=Acme.Tests.LoginTest\"", filters[0]);
        Assert.Equal("\"FullyQualifiedName=Acme.Tests.LoginTestWithMfa\"", filters[1]);
        Assert.DoesNotContain("*", filters[0]);
        Assert.DoesNotContain("*", filters[1]);
    }

    [Fact]
    public void MethodMode_DataRowMethod_IsASingleUnit()
    {
        var unit = Assert.Single(Scan(SplitBy.Method, """
            namespace Acme;
            [TestClass]
            public class Tests
            {
                [TestMethod]
                [DataRow(1)]
                [DataRow(2)]
                public void Adds(int n) { }
            }
            """));

        // Two [DataRow]s, one unit: MSTest folds the rows under the method's
        // own name, so one task runs both cases.
        Assert.Equal("Acme.Tests.Adds", unit.Id);
    }

    [Fact]
    public void MethodMode_GenericTestMethod_IsNotAtomized()
    {
        Assert.Empty(Scan(SplitBy.Method,
            "namespace Acme; [TestClass] public class Tests { [TestMethod] public void Generic<T>() { } }"));
    }

    [Fact]
    public void MethodMode_IgnoredMethod_IsNotAtomized()
    {
        var result = Discover(SplitBy.Method, """
            namespace Acme;
            [TestClass]
            public class Tests
            {
                [TestMethod] public void Runs() { }
                [TestMethod, Ignore] public void Skipped() { }
            }
            """);

        Assert.Equal(["Acme.Tests.Runs"], result.Units.Select(u => u.Id));
        Assert.Equal(1, result.SkippedUnrunnable);
    }

    [Fact]
    public void MethodMode_MethodsOfExcludedClasses_AreNotDiscovered()
    {
        Assert.Empty(Scan(SplitBy.Method,
            "namespace Acme; [TestClass] public abstract class BaseTests { [TestMethod] public void A() { } }"));
    }

    [Fact]
    public void MethodMode_SubclassWithOnlyInheritedTests_IsCountedNotSilentlyDropped()
    {
        // The base's tests are invisible to a syntax-only scan of the
        // subclass's own declaration, so method mode has nothing to yield for
        // it — unlike class mode, where the base list is enough to keep the
        // whole class as one unit. Neither SkippedNested nor SkippedGeneric
        // moves; without this category the gap would be silent.
        var result = Discover(SplitBy.Method,
            "namespace Acme; [TestClass] public abstract class BaseTests { [TestMethod] public void A() { } }",
            "namespace Acme; [TestClass] public class LoginTests : BaseTests { }");

        Assert.Empty(result.Units);
        Assert.Equal(1, result.SkippedNoOwnMethod);
        Assert.Equal(0, result.SkippedNested);
        Assert.Equal(0, result.SkippedGeneric);
    }

    [Fact]
    public void MethodMode_SubclassWithItsOwnMethodIsNotCounted()
    {
        var result = Discover(SplitBy.Method,
            "namespace Acme; [TestClass] public abstract class BaseTests { [TestMethod] public void A() { } }",
            "namespace Acme; [TestClass] public class LoginTests : BaseTests " +
            "{ [TestMethod] public void B() { } }");

        Assert.Equal(["Acme.LoginTests.B"], result.Units.Select(u => u.Id));
        Assert.Equal(0, result.SkippedNoOwnMethod);
    }

    // --- DoNotParallelize ---------------------------------------------------

    [Fact]
    public void AssemblyLevelDoNotParallelize_MarksEveryUnit()
    {
        var units = Scan(SplitBy.Class,
            "using Microsoft.VisualStudio.TestTools.UnitTesting; [assembly: DoNotParallelize]",
            "namespace Acme; [TestClass] public class A { [TestMethod] public void T() { } }",
            "namespace Acme; [TestClass] public class B { [TestMethod] public void T() { } }");

        Assert.All(units, unit => Assert.True(unit.DoNotParallelize));
    }

    [Fact]
    public void ClassLevelDoNotParallelize_MarksOnlyThatClass()
    {
        var units = Scan(SplitBy.Class,
            "namespace Acme; [TestClass, DoNotParallelize] public class Serial { [TestMethod] public void T() { } }",
            "namespace Acme; [TestClass] public class Parallel { [TestMethod] public void T() { } }");

        Assert.True(units.Single(u => u.ClassName == "Serial").DoNotParallelize);
        Assert.False(units.Single(u => u.ClassName == "Parallel").DoNotParallelize);
    }

    [Fact]
    public void MethodLevelDoNotParallelize_MarksOnlyThatMethod()
    {
        var units = Scan(SplitBy.Method, """
            namespace Acme;
            [TestClass]
            public class Tests
            {
                [TestMethod, DoNotParallelize] public void Serial() { }
                [TestMethod] public void Concurrent() { }
            }
            """);

        Assert.True(units.Single(u => u.MethodName == "Serial").DoNotParallelize);
        Assert.False(units.Single(u => u.MethodName == "Concurrent").DoNotParallelize);
    }

    [Fact]
    public void ParallelizeAttribute_DoesNotSuppressDiscovery()
    {
        var units = Scan(SplitBy.Class,
            "[assembly: Parallelize(Scope = ExecutionScope.MethodLevel)]",
            "namespace Acme; [TestClass] public class A { [TestMethod] public void T() { } }");

        Assert.False(Assert.Single(units).DoNotParallelize);
    }

    // --- Determinism --------------------------------------------------------

    [Fact]
    public void Ordering_IsDeterministicRegardlessOfSourceOrder()
    {
        // Sources are parsed in parallel, so without an explicit sort the result
        // order would vary between runs and change the project graph hash.
        string[] sources =
        [
            "namespace Acme; [TestClass] public class Charlie { [TestMethod] public void T() { } }",
            "namespace Acme; [TestClass] public class Alpha { [TestMethod] public void T() { } }",
            "namespace Acme; [TestClass] public class Bravo { [TestMethod] public void T() { } }"
        ];

        var forward = Ids(SplitBy.Class, sources);
        var reversed = Ids(SplitBy.Class, sources.Reverse().ToArray());

        Assert.Equal(["Acme.Alpha", "Acme.Bravo", "Acme.Charlie"], forward);
        Assert.Equal(forward, reversed);
    }

    [Fact]
    public void EmptyInput_ProducesNoUnits()
    {
        Assert.Empty(Scan(SplitBy.Class));
        Assert.Empty(Scan(SplitBy.Method, "namespace Acme; public class Empty { }"));
    }

    // --- Exclusion tallies --------------------------------------------------
    //
    // A test class that gets no target is the only failure mode of splitting
    // that is invisible from the outside, so the counts that drive the reported
    // diagnostic are pinned here.

    [Fact]
    public void NestedTestClasses_AreCounted()
    {
        var result = Discover(SplitBy.Class,
            "namespace Acme; [TestClass] public class Outer " +
            "{ [TestMethod] public void T() { } [TestClass] public class Inner { } }");

        Assert.Equal(1, result.SkippedNested);
        Assert.Equal(0, result.SkippedGeneric);
        Assert.Equal(0, result.SkippedUnrunnable);
    }

    [Fact]
    public void GenericTestClasses_AreCounted()
    {
        var result = Discover(SplitBy.Class, "namespace Acme; [TestClass] public class Tests<T> { }");

        Assert.Equal(1, result.SkippedGeneric);
        Assert.Equal(0, result.SkippedNested);
    }

    [Fact]
    public void GenericTestMethods_AreCounted()
    {
        var result = Discover(SplitBy.Method, """
            namespace Acme;
            [TestClass]
            public class Tests
            {
                [TestMethod] public void Plain() { }
                [TestMethod] public void Generic<T>() { }
            }
            """);

        Assert.Equal(["Acme.Tests.Plain"], result.Units.Select(u => u.Id));
        Assert.Equal(1, result.SkippedGeneric);
    }

    [Fact]
    public void UnrunnableClasses_AreCounted()
    {
        var result = Discover(SplitBy.Class,
            "namespace Acme; [TestClass] public class Empty { }",
            "namespace Acme; [TestClass, Ignore] public class Ignored { [TestMethod] public void T() { } }");

        Assert.Empty(result.Units);
        Assert.Equal(2, result.SkippedUnrunnable);
    }

    [Fact]
    public void AbstractBaseClasses_AreNotCountedAsExclusions()
    {
        // A shared abstract test base is the normal shape of inheritance, not
        // something withheld — reporting it would be noise on every run.
        var result = Discover(SplitBy.Class,
            "namespace Acme; [TestClass] public abstract class BaseTests { }",
            "namespace Acme; [TestClass] public class LoginTests : BaseTests { }");

        Assert.Equal(0, result.SkippedNested);
        Assert.Equal(0, result.SkippedGeneric);
        Assert.Equal(0, result.SkippedUnrunnable);
    }

    [Fact]
    public void NonTestClasses_AreNotCountedAsExclusions()
    {
        // Ordinary helper types are not candidates in the first place.
        var result = Discover(SplitBy.Class,
            "namespace Acme; public class Helper { public class NestedHelper { } }",
            "namespace Acme; public class Generic<T> { }");

        Assert.Equal(0, result.SkippedNested);
        Assert.Equal(0, result.SkippedGeneric);
        Assert.Equal(0, result.SkippedUnrunnable);
    }

    [Fact]
    public void ScanSources_ReportsNoExternalSources()
    {
        // Only the MSBuild-driven Scan overload knows where files live; the
        // pure-source path has nothing to report.
        Assert.Empty(Discover(SplitBy.Class,
            "namespace Acme; [TestClass] public class A { [TestMethod] public void T() { } }")
            .ExternalSources);
    }

    // --- External source collection ----------------------------------------
    //
    // These feed cache invalidation: a linked source that is not reported here
    // is never hashed, so editing it leaves a stale analysis in place and the
    // test classes it declares keep whatever targets they had.

    private static List<string> Externals(params string[] paths) =>
        TestClassScanner.CollectExternalSources(
            paths,
            Path.Combine("/ws", "apps", "proj"),
            "/ws");

    [Fact]
    public void SourcesUnderTheProjectAreNotReported()
    {
        // Already covered by the plugin's per-project glob.
        Assert.Empty(Externals(Path.Combine("/ws", "apps", "proj", "Tests.cs")));
    }

    [Fact]
    public void LinkedSourcesElsewhereInTheWorkspaceAreReported()
    {
        Assert.Equal(
            ["libs/shared/Linked.cs"],
            Externals(Path.Combine("/ws", "libs", "shared", "Linked.cs")));
    }

    [Fact]
    public void SourcesOutsideTheWorkspaceAreDropped()
    {
        // Nx cannot hash what it does not track.
        Assert.Empty(Externals(Path.Combine("/elsewhere", "Linked.cs")));
    }

    [Fact]
    public void ADirectoryNamedLikeAnEscapeIsStillInsideTheWorkspace()
    {
        // "..shared" starts with ".." but is an ordinary directory name, not a
        // traversal. Reading it as an escape drops the file from hashing.
        Assert.Equal(
            ["..shared/Linked.cs"],
            Externals(Path.Combine("/ws", "..shared", "Linked.cs")));
    }

    [Fact]
    public void ADirectoryNamedLikeAnEscapeInsideTheProjectIsNotReported()
    {
        Assert.Empty(Externals(Path.Combine("/ws", "apps", "proj", "..config", "Tests.cs")));
    }

    [Fact]
    public void ExclusionsAreTalliedAcrossFiles()
    {
        var result = Discover(SplitBy.Class,
            "namespace Acme; [TestClass] public class A " +
            "{ [TestMethod] public void T() { } [TestClass] public class Inner { } }",
            "namespace Acme; [TestClass] public class B " +
            "{ [TestMethod] public void T() { } [TestClass] public class Inner { } }",
            "namespace Acme; [TestClass] public class Generic<T> { }");

        Assert.Equal(["Acme.A", "Acme.B"], result.Units.Select(u => u.Id));
        Assert.Equal(2, result.SkippedNested);
        Assert.Equal(1, result.SkippedGeneric);
    }

    // --- Preprocessor regions ------------------------------------------------

    [Fact]
    public void IfRegions_FollowTheProjectsDefineConstants()
    {
        // Parsed with no symbols, `#if !DEBUG` reads as active and the class
        // the build excludes still gets a target, whose filter then matches
        // nothing and fails the task on every run.
        var options = CSharpParseOptions.Default
            .WithPreprocessorSymbols("TRACE", "DEBUG", "NET", "NET9_0", "NETCOREAPP");

        var result = TestClassScanner.ScanSources(
            [
                """
                namespace Acme;
                #if DEBUG
                [TestClass] public class Compiled { [TestMethod] public void M() {} }
                #endif
                #if !DEBUG
                [TestClass] public class NotCompiled { [TestMethod] public void M() {} }
                #endif
                """
            ],
            SplitBy.Class,
            options);

        Assert.Equal(["Acme.Compiled"], result.Units.Select(u => u.Id).ToArray());
    }
}
