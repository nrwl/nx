namespace MsbuildAnalyzer.Models;

/// <summary>
/// The granularity at which a test project's tests are split into Nx targets.
/// </summary>
public enum SplitBy
{
    Class,
    Method
}

/// <summary>
/// One unit of test atomization: either a test class or a single test method.
/// </summary>
public sealed record TestUnit
{
    /// <summary>Enclosing namespace, or empty for the global namespace.</summary>
    public required string Namespace { get; init; }

    /// <summary>The declaring test class's simple name.</summary>
    public required string ClassName { get; init; }

    /// <summary>The test method's name, or null when the unit is a whole class.</summary>
    public string? MethodName { get; init; }

    /// <summary>
    /// Whether MSTest was told these tests must not run in parallel, via
    /// <c>[DoNotParallelize]</c> at assembly, class, or method level.
    /// </summary>
    public bool DoNotParallelize { get; init; }

    /// <summary>
    /// Whether this unit has anything that could actually run.
    /// </summary>
    /// <remarks>
    /// Always true for a method unit, which already required a
    /// <c>[TestMethod]</c>. A class unit sets it from a local test method, or
    /// from a base list — the only signal syntax-only scanning has for
    /// inherited tests.
    /// </remarks>
    public bool HasRunnableMembers { get; init; } = true;

    public string ClassFqn =>
        string.IsNullOrEmpty(Namespace) ? ClassName : $"{Namespace}.{ClassName}";

    /// <summary>
    /// Stable identifier for this unit. Used as the Nx target-name suffix, as
    /// the per-unit test-results subdirectory, and as the dedupe key.
    /// </summary>
    public string Id => MethodName is null ? ClassFqn : $"{ClassFqn}.{MethodName}";

    /// <summary>
    /// The command-line arguments that restrict a test run to this unit.
    /// </summary>
    /// <remarks>
    /// Both forms use <c>--filter</c>, whose expression syntax MSTest provides;
    /// MSTest does not register the platform's <c>--treenode-filter</c> and
    /// rejects it. <c>=</c> matches exactly rather than by prefix, keeping
    /// <c>LoginTest</c> and <c>LoginTestWithMfa</c> in separate tasks, and
    /// <c>ClassName</c> matches nothing without the namespace.
    ///
    /// Values are quoted for the shell; namespace and class name come from
    /// identifier tokens, which cannot contain a double-quote.
    /// </remarks>
    public string[] FilterArgs =>
    [
        "--filter",
        Quote(MethodName is null ? $"ClassName={ClassFqn}" : $"FullyQualifiedName={Id}")
    ];

    private static string Quote(string value) => $"\"{value}\"";
}
