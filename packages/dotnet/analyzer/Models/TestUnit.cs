namespace MsbuildAnalyzer.Models;

/// <summary>
/// The granularity at which a test project's tests are split into Nx targets.
/// </summary>
public enum SplitBy
{
    /// <summary>
    /// One target per test class. The default: coarse enough that process
    /// startup stays negligible for ordinary suites.
    /// </summary>
    Class,

    /// <summary>
    /// One target per test method. Worth opting into when each method carries
    /// its own expensive fixture (spinning up a distributed app, a database, a
    /// browser), because then grouping methods saves nothing and only serializes
    /// work that could have run on separate agents.
    /// </summary>
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
    /// <remarks>
    /// Not needed to build the filter — <c>FullyQualifiedName=</c> is exact and
    /// MSTest folds data rows under the method's own identity — but recorded so
    /// diagnostics can explain a leaf that reports more cases than its name
    /// suggests.
    /// </remarks>
    public bool HasDataRows { get; init; }

    /// <summary>Fully-qualified name of the declaring class.</summary>
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
    /// The single place a filter expression is constructed.
    ///
    /// Both forms use <c>--filter</c>, whose expression syntax MSTest provides.
    /// The platform-level <c>--treenode-filter</c> would be framework-neutral,
    /// but MSTest does not register that service and rejects the option.
    ///
    /// The <c>=</c> operator is an exact match rather than a prefix, which keeps
    /// <c>LoginTest</c> and <c>LoginTestWithMfa</c> in separate tasks. MSTest
    /// folds data rows under the method's own FullyQualifiedName, so one task
    /// runs all of a <c>[DataRow]</c> method's cases.
    ///
    /// <c>ClassName</c> requires the namespace; MSTest matches nothing for a
    /// bare class name.
    ///
    /// Values are quoted for the shell Nx runs commands through. A C# identifier
    /// cannot contain a double-quote, so no escaping is needed inside them.
    /// </remarks>
    public string[] FilterArgs =>
    [
        "--filter",
        Quote(MethodName is null ? $"ClassName={ClassFqn}" : $"FullyQualifiedName={Id}")
    ];

    private static string Quote(string value) => $"\"{value}\"";
}
