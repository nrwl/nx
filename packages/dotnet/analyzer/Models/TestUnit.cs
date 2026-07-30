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
    /// Whether the method is data-driven (<c>[DataRow]</c>/<c>[DynamicData]</c>),
    /// meaning it expands into several test cases at run time.
    /// </summary>
    public bool HasDataRows { get; init; }

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
    /// </remarks>
    public string[] FilterArgs =>
    [
        "--filter",
        Quote(MethodName is null ? $"ClassName={ClassFqn}" : $"FullyQualifiedName={Id}")
    ];

    private static string Quote(string value) => $"\"{value}\"";
}
