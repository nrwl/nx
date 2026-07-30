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
            Ids(SplitBy.Class, "namespace Acme.Tests; [TestClass] public class LoginTests { }"));
    }

    [Fact]
    public void BlockNamespace_IsResolved()
    {
        Assert.Equal(
            ["Acme.Tests.LoginTests"],
            Ids(SplitBy.Class, "namespace Acme.Tests { [TestClass] public class LoginTests { } }"));
    }

    [Fact]
    public void NestedNamespaces_AreJoinedOutermostFirst()
    {
        Assert.Equal(
            ["Acme.Tests.LoginTests"],
            Ids(SplitBy.Class, "namespace Acme { namespace Tests { [TestClass] public class LoginTests { } } }"));
    }

    [Fact]
    public void GlobalNamespace_ProducesUnqualifiedIdAndWildcardFilter()
    {
        var unit = Assert.Single(Scan(SplitBy.Class, "[TestClass] public class LoginTests { }"));

        Assert.Equal("LoginTests", unit.Id);
        // A class in the global namespace has no namespace to qualify with.
        Assert.Equal(["--filter", "\"ClassName=LoginTests\""], unit.FilterArgs);
    }

    // --- Attribute recognition ---------------------------------------------

    [Theory]
    [InlineData("[TestClass]")]
    [InlineData("[TestClassAttribute]")]
    [InlineData("[MSTest.TestClass]")]
    [InlineData("[global::Microsoft.VisualStudio.TestTools.UnitTesting.TestClass]")]
    [InlineData("[TestClass, Ignore]")]
    [InlineData("[Ignore]\n[TestClass]")]
    public void TestClassAttribute_IsRecognizedInAllSpellings(string attribute)
    {
        Assert.Equal(
            ["Acme.LoginTests"],
            Ids(SplitBy.Class, $"namespace Acme; {attribute} public class LoginTests {{ }}"));
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
                "namespace Acme; [TestClass] public class Outer { [TestClass] public class Inner { } }"));
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
        var ids = Ids(SplitBy.Class,
            "namespace Acme; [TestClass] public abstract class BaseTests { }",
            "namespace Acme; [TestClass] public class LoginTests : BaseTests { }");

        Assert.Equal(["Acme.LoginTests"], ids);
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
            "namespace Acme; [TestClass] public class A { } [TestClass] public class B { }");

        Assert.Equal(["Acme.A", "Acme.B"], ids);
    }

    // --- Partial classes ----------------------------------------------------

    [Fact]
    public void PartialClassAcrossFiles_ProducesOneClassUnit()
    {
        // Deriving names from file names would emit two targets here, each
        // running the entire class.
        var ids = Ids(SplitBy.Class,
            "namespace Acme; [TestClass] public partial class LoginTests { }",
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
            "namespace Acme; [TestClass] public partial class LoginTests { }",
            "namespace Acme; [TestClass, DoNotParallelize] public partial class LoginTests { }"));

        Assert.True(unit.DoNotParallelize);
    }

    // --- Same name in different namespaces ----------------------------------

    [Fact]
    public void SameClassNameInTwoNamespaces_StaysDistinct()
    {
        var units = Scan(SplitBy.Class,
            "namespace Acme.Api; [TestClass] public class SmokeTests { }",
            "namespace Acme.Web; [TestClass] public class SmokeTests { }");

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
    public void MethodMode_DataRowMethod_IsASingleUnitFlaggedAsDataDriven()
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

        Assert.Equal("Acme.Tests.Adds", unit.Id);
        Assert.True(unit.HasDataRows);
    }

    [Fact]
    public void MethodMode_GenericTestMethod_IsNotAtomized()
    {
        Assert.Empty(Scan(SplitBy.Method,
            "namespace Acme; [TestClass] public class Tests { [TestMethod] public void Generic<T>() { } }"));
    }

    [Fact]
    public void MethodMode_MethodsOfExcludedClasses_AreNotDiscovered()
    {
        Assert.Empty(Scan(SplitBy.Method,
            "namespace Acme; [TestClass] public abstract class BaseTests { [TestMethod] public void A() { } }"));
    }

    // --- DoNotParallelize ---------------------------------------------------

    [Fact]
    public void AssemblyLevelDoNotParallelize_MarksEveryUnit()
    {
        var units = Scan(SplitBy.Class,
            "using Microsoft.VisualStudio.TestTools.UnitTesting; [assembly: DoNotParallelize]",
            "namespace Acme; [TestClass] public class A { }",
            "namespace Acme; [TestClass] public class B { }");

        Assert.All(units, unit => Assert.True(unit.DoNotParallelize));
    }

    [Fact]
    public void ClassLevelDoNotParallelize_MarksOnlyThatClass()
    {
        var units = Scan(SplitBy.Class,
            "namespace Acme; [TestClass, DoNotParallelize] public class Serial { }",
            "namespace Acme; [TestClass] public class Parallel { }");

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
            "namespace Acme; [TestClass] public class A { }");

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
            "namespace Acme; [TestClass] public class Charlie { }",
            "namespace Acme; [TestClass] public class Alpha { }",
            "namespace Acme; [TestClass] public class Bravo { }"
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
            "namespace Acme; [TestClass] public class Outer { [TestClass] public class Inner { } }");

        Assert.Equal(1, result.SkippedNested);
        Assert.Equal(0, result.SkippedGeneric);
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
    public void AbstractBaseClasses_AreNotCountedAsExclusions()
    {
        // A shared abstract test base is the normal shape of inheritance, not
        // something withheld — reporting it would be noise on every run.
        var result = Discover(SplitBy.Class,
            "namespace Acme; [TestClass] public abstract class BaseTests { }",
            "namespace Acme; [TestClass] public class LoginTests : BaseTests { }");

        Assert.Equal(0, result.SkippedNested);
        Assert.Equal(0, result.SkippedGeneric);
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
    }

    [Fact]
    public void ScanSources_ReportsNoExternalSources()
    {
        // Only the MSBuild-driven Scan overload knows where files live; the
        // pure-source path has nothing to report.
        Assert.Empty(Discover(SplitBy.Class, "namespace Acme; [TestClass] public class A { }")
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
            "namespace Acme; [TestClass] public class A { [TestClass] public class Inner { } }",
            "namespace Acme; [TestClass] public class B { [TestClass] public class Inner { } }",
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
