using System.Collections.Concurrent;
using Microsoft.Build.Execution;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Discovers the test classes and methods a project declares, so each can become
/// its own Nx target.
/// </summary>
/// <remarks>
/// A syntax-only pass: sources are parsed but never compiled, so it runs during
/// project-graph construction without needing a build. The cost is one blind
/// spot, tests inherited from a base class. <c>#if</c> regions are evaluated
/// against the project's own DefineConstants.
/// </remarks>
public static class TestClassScanner
{
    private static readonly CSharpParseOptions DefaultParseOptions =
        new(LanguageVersion.Preview, DocumentationMode.None);

    /// <summary>
    /// Parse options carrying the project's own preprocessor symbols.
    /// </summary>
    /// <remarks>
    /// Without them every <c>#if</c> is evaluated against an empty symbol set,
    /// which reads <c>#if DEBUG</c> as inactive and <c>#if !DEBUG</c> as
    /// active. The second is the damaging direction: a class the build excludes
    /// would still get a target, whose filter then matches nothing and fails
    /// the task on every run.
    /// </remarks>
    private static CSharpParseOptions ParseOptionsFor(string defineConstants) =>
        string.IsNullOrWhiteSpace(defineConstants)
            ? DefaultParseOptions
            : DefaultParseOptions.WithPreprocessorSymbols(
                defineConstants.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

    /// <summary>
    /// Scans the C# sources MSBuild assigned to a project.
    /// </summary>
    /// <remarks>
    /// Reads the <c>Compile</c> item group rather than globbing the project
    /// directory, so <c>&lt;Compile Remove&gt;</c>, linked files, generated
    /// sources and <c>DefaultItemExcludes</c> are all honored without
    /// reimplementing MSBuild's item semantics.
    /// </remarks>
    public static TestDiscoveryResult Scan(
        ProjectInstance project,
        SplitBy splitBy,
        string projectDirectory,
        string workspaceRoot)
    {
        var paths = project
            .GetItems("Compile")
            .Select(item => item.GetMetadataValue("FullPath"))
            .Where(path => !string.IsNullOrEmpty(path) &&
                           path.EndsWith(".cs", StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var externalSources = CollectExternalSources(paths, projectDirectory, workspaceRoot);

        var sources = new ConcurrentBag<string>();
        Parallel.ForEach(paths, path =>
        {
            try
            {
                sources.Add(File.ReadAllText(path));
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                // A Compile item can point at a file that is not readable: a
                // generated source not yet produced, or a stale link. Tests in a
                // skipped file still run under the non-atomized target.
                Console.Error.WriteLine(
                    $"@nx/dotnet: could not read '{path}' while discovering tests: {ex.Message}");
            }
        });

        return ScanSources(sources, splitBy, ParseOptionsFor(project.GetPropertyValue("DefineConstants")))
            with
        { ExternalSources = externalSources };
    }

    /// <summary>
    /// Picks out the scanned sources that live outside the project directory, as
    /// workspace-relative paths.
    /// </summary>
    /// <remarks>
    /// Sources under the project are already covered by the plugin's per-project
    /// glob, so only the strays are worth reporting. Anything outside the
    /// workspace entirely is dropped: Nx cannot hash what it does not track, and
    /// a path that escapes the workspace would produce a glob that matches
    /// nothing.
    /// </remarks>
    internal static List<string> CollectExternalSources(
        IEnumerable<string> paths,
        string projectDirectory,
        string workspaceRoot)
    {
        var external = new List<string>();

        foreach (var path in paths)
        {
            if (IsUnder(path, projectDirectory))
            {
                continue;
            }

            if (!IsUnder(path, workspaceRoot))
            {
                continue;
            }

            external.Add(Path.GetRelativePath(workspaceRoot, path).Replace('\\', '/'));
        }

        // Sorted for the same reason the units are: this feeds a hash, and an
        // unstable order would change it without the sources changing.
        external.Sort(StringComparer.Ordinal);
        return external;
    }

    /// <summary>
    /// Whether <paramref name="path"/> resolves to somewhere inside
    /// <paramref name="directory"/>.
    /// </summary>
    /// <remarks>
    /// When the two do not share a root, GetRelativePath returns
    /// <paramref name="path"/> unchanged rather than throwing, which on Windows
    /// is how a linked Compile item on another drive arrives. The rooted check
    /// is what turns that into "not under".
    ///
    /// Escaping is decided on the first path segment rather than a <c>".."</c>
    /// prefix, because a directory may legally be named <c>..config</c>, and
    /// treating that as an escape would drop its sources from the set that gets
    /// hashed for cache invalidation.
    /// </remarks>
    private static bool IsUnder(string path, string directory)
    {
        var relative = Path.GetRelativePath(directory, path);
        if (Path.IsPathRooted(relative))
        {
            return false;
        }

        var firstSegment = relative.Split(
            Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)[0];
        return firstSegment != "..";
    }

    /// <summary>
    /// Extracts test units from already-loaded source text.
    /// </summary>
    /// <remarks>
    /// Split out from <see cref="Scan"/> so the discovery rules can be tested
    /// against inline sources without an MSBuild evaluation.
    /// </remarks>
    public static TestDiscoveryResult ScanSources(
        IEnumerable<string> sources,
        SplitBy splitBy,
        CSharpParseOptions? parseOptions = null)
    {
        var options = parseOptions ?? DefaultParseOptions;
        var materialized = sources as IReadOnlyList<string> ?? sources.ToList();

        // [assembly: DoNotParallelize] applies to the whole assembly but may be
        // declared in any file — commonly a shared AssemblyInfo.cs, which
        // contains no test classes of its own — so it has to be resolved across
        // every source before any class is examined.
        //
        // The substring check short-circuits before parsing, which in the
        // overwhelmingly common case where nothing mentions the attribute costs
        // one scan of the text instead of a second parse of every file.
        var assemblyDoNotParallelize = materialized.Any(source =>
            source.Contains("DoNotParallelize", StringComparison.Ordinal) &&
            DeclaresAssemblyDoNotParallelize(source, options));

        var assemblyDiscoverInternals = materialized.Any(source =>
            source.Contains("DiscoverInternals", StringComparison.Ordinal) &&
            DeclaresAssemblyDiscoverInternals(source, options));

        var units = new ConcurrentBag<TestUnit>();
        var skippedNested = 0;
        var skippedGeneric = 0;
        var skippedUnrunnable = 0;
        var skippedNoOwnMethod = 0;

        Parallel.ForEach(materialized, source =>
        {
            var exclusions = new Exclusions();
            foreach (var unit in ScanSource(
                source, splitBy, assemblyDoNotParallelize, assemblyDiscoverInternals, exclusions, options))
            {
                units.Add(unit);
            }

            Interlocked.Add(ref skippedNested, exclusions.Nested);
            Interlocked.Add(ref skippedGeneric, exclusions.Generic);
            Interlocked.Add(ref skippedUnrunnable, exclusions.Unrunnable);
            Interlocked.Add(ref skippedNoOwnMethod, exclusions.NoOwnMethod);
        });

        // Deduplicating by Id is what collapses `partial` classes declared
        // across several files into a single class unit, while still letting
        // their methods surface as distinct method units.
        //
        // Ordering must be deterministic: target names derive from these, and
        // an unstable order would change the project graph hash on every run.
        var merged = units
            .GroupBy(unit => unit.Id, StringComparer.Ordinal)
            .Select(group => group.Aggregate(MergeDuplicates))
            .OrderBy(unit => unit.Id, StringComparer.Ordinal)
            .ToList();

        // A class unit with no runnable signal on any of its partial halves is
        // dropped only here, after merging — one half might declare the test
        // method or base list that justifies the other.
        skippedUnrunnable += merged.Count(unit => !unit.HasRunnableMembers);

        return new TestDiscoveryResult
        {
            Units = [.. merged.Where(unit => unit.HasRunnableMembers)],
            SkippedNested = skippedNested,
            SkippedGeneric = skippedGeneric,
            SkippedUnrunnable = skippedUnrunnable,
            SkippedNoOwnMethod = skippedNoOwnMethod
        };
    }

    /// <summary>Per-file tally of test classes and methods left out.</summary>
    private sealed class Exclusions
    {
        public int Nested;
        public int Generic;
        public int Unrunnable;

        /// <summary>
        /// Method mode only. Tallied per file, so a partial class with no local
        /// test method on either half counts twice — a known imprecision in an
        /// informational count, not in what gets split.
        /// </summary>
        public int NoOwnMethod;
    }

    /// <summary>
    /// Two declarations of the same unit (partial class halves) may disagree
    /// about their attributes; take the union so a <c>[DoNotParallelize]</c> on
    /// either half is honored, and so a class unit is kept if either half shows
    /// a sign of having something runnable.
    /// </summary>
    private static TestUnit MergeDuplicates(TestUnit left, TestUnit right) => left with
    {
        DoNotParallelize = left.DoNotParallelize || right.DoNotParallelize,
        HasDataRows = left.HasDataRows || right.HasDataRows,
        HasRunnableMembers = left.HasRunnableMembers || right.HasRunnableMembers
    };

    private static bool DeclaresAssemblyDoNotParallelize(string source, CSharpParseOptions options) =>
        CSharpSyntaxTree.ParseText(source, options)
            .GetCompilationUnitRoot()
            .AttributeLists
            .Where(list => list.Target?.Identifier.ValueText == "assembly")
            .Any(list => HasAttribute(list, "DoNotParallelize"));

    private static bool DeclaresAssemblyDiscoverInternals(string source, CSharpParseOptions options) =>
        CSharpSyntaxTree.ParseText(source, options)
            .GetCompilationUnitRoot()
            .AttributeLists
            .Where(list => list.Target?.Identifier.ValueText == "assembly")
            .Any(list => HasAttribute(list, "DiscoverInternals"));

    private static IEnumerable<TestUnit> ScanSource(
        string source,
        SplitBy splitBy,
        bool assemblyDoNotParallelize,
        bool assemblyDiscoverInternals,
        Exclusions exclusions,
        CSharpParseOptions options)
    {
        var root = CSharpSyntaxTree.ParseText(source, options).GetCompilationUnitRoot();

        foreach (var declaration in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
        {
            if (!IsAtomizableTestClass(declaration, assemblyDiscoverInternals, exclusions))
            {
                continue;
            }

            var classDoNotParallelize =
                assemblyDoNotParallelize || HasAttribute(declaration.AttributeLists, "DoNotParallelize");

            var ns = GetNamespace(declaration);
            var className = declaration.Identifier.ValueText;

            if (splitBy == SplitBy.Class)
            {
                yield return new TestUnit
                {
                    Namespace = ns,
                    ClassName = className,
                    DoNotParallelize = classDoNotParallelize,
                    // A local test method is direct evidence; a base list is the
                    // only signal available for tests inherited from a shared
                    // base, which this syntax-only pass cannot see into.
                    // ScanSources drops the unit only if no partial half shows
                    // either.
                    HasRunnableMembers =
                        declaration.Members.OfType<MethodDeclarationSyntax>()
                            .Any(method => HasAttribute(method.AttributeLists, "TestMethod", "DataTestMethod")) ||
                        declaration.BaseList is not null
                };
                continue;
            }

            var hasOwnTestMethod = false;

            foreach (var method in declaration.Members.OfType<MethodDeclarationSyntax>())
            {
                // Generic test methods would need their type arguments encoded
                // (and commas %2C-escaped) in the FullyQualifiedName filter.
                // Excluded rather than guessed at.
                if (!HasAttribute(method.AttributeLists, "TestMethod", "DataTestMethod"))
                {
                    continue;
                }

                // Counted whether or not this specific method goes on to be
                // excluded below — a class with an excluded method still
                // declared one of its own, which is a different situation from
                // declaring none at all.
                hasOwnTestMethod = true;

                if (method.TypeParameterList is not null)
                {
                    exclusions.Generic++;
                    continue;
                }

                // MSTest never runs an ignored method; a target for it would
                // only fail on --minimum-expected-tests.
                if (HasAttribute(method.AttributeLists, "Ignore"))
                {
                    exclusions.Unrunnable++;
                    continue;
                }

                yield return new TestUnit
                {
                    Namespace = ns,
                    ClassName = className,
                    MethodName = method.Identifier.ValueText,
                    DoNotParallelize =
                        classDoNotParallelize || HasAttribute(method.AttributeLists, "DoNotParallelize"),
                    HasDataRows = HasAttribute(method.AttributeLists, "DataRow", "DynamicData")
                    // HasRunnableMembers defaults to true: reaching this point
                    // already required a qualifying [TestMethod]/[DataTestMethod].
                };
            }

            if (!hasOwnTestMethod)
            {
                exclusions.NoOwnMethod++;
            }
        }
    }

    private static bool IsAtomizableTestClass(
        ClassDeclarationSyntax declaration,
        bool assemblyDiscoverInternals,
        Exclusions exclusions)
    {
        // Checked first so the exclusion tallies below only count declarations
        // that are actually test classes.
        if (!HasAttribute(declaration.AttributeLists, "TestClass"))
        {
            return false;
        }

        // An abstract class has no tests of its own; its concrete subclasses
        // carry their own [TestClass] in practice. Not counted as an exclusion —
        // it is the normal shape of a shared test base, not something withheld.
        if (declaration.Modifiers.Any(SyntaxKind.AbstractKeyword))
        {
            return false;
        }

        // Nested classes are excluded: the platform encodes them into the class
        // segment in a form we have not confirmed, so filtering on the outer name
        // alone risks matching nothing.
        if (declaration.Parent is not (BaseNamespaceDeclarationSyntax or CompilationUnitSyntax))
        {
            exclusions.Nested++;
            return false;
        }

        // Generic classes are name-mangled in both filter syntaxes.
        if (declaration.TypeParameterList is not null)
        {
            exclusions.Generic++;
            return false;
        }

        // MSTest never runs an ignored class's tests; a target for it would
        // only fail on --minimum-expected-tests. Applies to both split modes —
        // an ignored class has nothing runnable regardless of how it splits.
        if (HasAttribute(declaration.AttributeLists, "Ignore"))
        {
            exclusions.Unrunnable++;
            return false;
        }

        // MSTest does not discover a non-public class's tests unless the
        // assembly opts in.
        if (!declaration.Modifiers.Any(SyntaxKind.PublicKeyword) && !assemblyDiscoverInternals)
        {
            exclusions.Unrunnable++;
            return false;
        }

        return true;
    }

    /// <summary>
    /// Builds the dotted namespace for a declaration, joining nested namespace
    /// blocks outermost-first. Handles both block and file-scoped forms.
    /// </summary>
    /// <remarks>
    /// Built from identifier tokens rather than <c>NameSyntax.ToString()</c>,
    /// which would include any trivia — whitespace, line breaks, comments —
    /// sitting between the dotted segments of an unusually formatted namespace.
    /// </remarks>
    private static string GetNamespace(SyntaxNode node) =>
        string.Join('.', node.Ancestors()
            .OfType<BaseNamespaceDeclarationSyntax>()
            .Reverse()
            .SelectMany(ns => ns.Name.DescendantTokens())
            .Where(token => token.IsKind(SyntaxKind.IdentifierToken))
            .Select(token => token.ValueText));

    private static bool HasAttribute(SyntaxList<AttributeListSyntax> lists, params string[] names) =>
        lists.Any(list => HasAttribute(list, names));

    /// <summary>
    /// Matches an attribute by simple name, ignoring any qualification and the
    /// optional <c>Attribute</c> suffix — so <c>[TestClass]</c>,
    /// <c>[TestClassAttribute]</c>, <c>[MSTest.TestClass]</c> and
    /// <c>[global::Microsoft.VisualStudio.TestTools.UnitTesting.TestClass]</c>
    /// are all recognized.
    /// </summary>
    private static bool HasAttribute(AttributeListSyntax list, params string[] names) =>
        list.Attributes.Any(attribute =>
        {
            var name = attribute.Name switch
            {
                QualifiedNameSyntax qualified => qualified.Right.Identifier.ValueText,
                AliasQualifiedNameSyntax aliased => aliased.Name.Identifier.ValueText,
                SimpleNameSyntax simple => simple.Identifier.ValueText,
                _ => attribute.Name.ToString()
            };

            if (name.EndsWith("Attribute", StringComparison.Ordinal) && name.Length > "Attribute".Length)
            {
                name = name[..^"Attribute".Length];
            }

            return names.Contains(name, StringComparer.Ordinal);
        });
}
