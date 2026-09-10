namespace MsbuildAnalyzer.Models;

/// <summary>
/// The MSBuild properties evaluated for one project.
///
/// MSBuild's model is string-keyed and nothing it ships names these properties
/// in a type, so the binding has to live somewhere. Here each member is named
/// exactly as MSBuild names the property and looks itself up with
/// <c>nameof</c>, which keeps the two spellings from drifting: there is no
/// literal to mistype, and the member IS the name.
///
/// The cost is that renaming a member changes which property is read, so treat
/// these names as the external contract they are. Members that interpret a value
/// either derive from a raw member (<see cref="IsExecutable"/>,
/// <see cref="ProjectExtensionsPath"/>) or carry the MSBuild name themselves
/// (<see cref="IsTestProject"/>); both routes bind the name with <c>nameof</c>,
/// so the rule holds everywhere.
///
/// Backed by the whole evaluated set rather than a curated one, so a property
/// no member models is still reachable through <see cref="Get"/>.
/// </summary>
public sealed class EvaluatedProperties
{
    private readonly Dictionary<string, string> values;

    public EvaluatedProperties(Dictionary<string, string> values)
    {
        this.values = values;
    }

    /// <summary>
    /// Lets the evaluated dictionary stand in wherever properties are expected,
    /// so callers that build one directly (tests, <c>Analyzer.CollectProperties</c>)
    /// do not have to wrap it by hand.
    /// </summary>
    public static implicit operator EvaluatedProperties(Dictionary<string, string> values) => new(values);

    /// <summary>
    /// Reads a property no member models. Returns <c>null</c> when it is unset.
    /// Prefer a member: this is the escape hatch, not the front door.
    /// </summary>
    public string? Get(string name) => values.GetValueOrDefault(name);

    /// <summary>
    /// Copies the set with <c>Configuration</c> replaced, preserving the source
    /// comparer. The <c>Dictionary</c> copy constructor silently falls back to an
    /// ordinal comparer, which would hide any property MSBuild reports under a
    /// non-canonical spelling from every member below.
    /// </summary>
    public EvaluatedProperties WithConfiguration(string configuration) =>
        new(new Dictionary<string, string>(values, values.Comparer)
        {
            [nameof(Configuration)] = configuration
        });

    // Output layout.
    public string? BaseOutputPath => Get(nameof(BaseOutputPath));
    public string? OutputPath => Get(nameof(OutputPath));
    public string? OutDir => Get(nameof(OutDir));
    public string? PublishDir => Get(nameof(PublishDir));
    public string? PackageOutputPath => Get(nameof(PackageOutputPath));
    public string? BaseIntermediateOutputPath => Get(nameof(BaseIntermediateOutputPath));
    public string? IntermediateOutputPath => Get(nameof(IntermediateOutputPath));
    public string? MSBuildProjectExtensionsPath => Get(nameof(MSBuildProjectExtensionsPath));

    // Artifacts layout.
    public string? UseArtifactsOutput => Get(nameof(UseArtifactsOutput));
    public string? ArtifactsPath => Get(nameof(ArtifactsPath));
    public string? ArtifactsProjectName => Get(nameof(ArtifactsProjectName));
    public string? ArtifactsPublishOutputName => Get(nameof(ArtifactsPublishOutputName));
    public string? ArtifactsPackageOutputName => Get(nameof(ArtifactsPackageOutputName));

    // Identity and kind.
    public string? Configuration => Get(nameof(Configuration));
    public string? MSBuildProjectName => Get(nameof(MSBuildProjectName));
    public string? OutputType => Get(nameof(OutputType));

    // Tooling.
    public string? OpenApiDocumentsDirectory => Get(nameof(OpenApiDocumentsDirectory));
    public string? OpenApiGenerateDocumentsOptions => Get(nameof(OpenApiGenerateDocumentsOptions));
    public string? TestResultsDirectory => Get(nameof(TestResultsDirectory));

    // Interpreted values. Each derives from a raw member above or, like
    // IsTestProject, carries the MSBuild name itself; either way the name comes
    // from a `nameof`.
    public bool IsTestProject => IsTrue(nameof(IsTestProject));

    /// <summary>
    /// Microsoft.Testing.Platform's marker for a runner project. Some runners
    /// set it and leave <see cref="IsTestProject"/> unset, so neither property
    /// implies the other. MTP imports its targets from a restored package, so
    /// the value exists only once the project has been restored.
    /// </summary>
    public bool IsTestingPlatformApplication => IsTrue(nameof(IsTestingPlatformApplication));

    public bool UsesArtifactsOutput => IsTrue(nameof(UseArtifactsOutput));
    public bool IsExecutable =>
        string.Equals(OutputType, "Exe", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// MSBuild compares booleans case-insensitively, so a project that writes
    /// <c>True</c> means the same thing as one that writes <c>true</c>.
    /// </summary>
    private bool IsTrue(string name) =>
        string.Equals(Get(name), "true", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// The directory NuGet writes its restore-generated imports into.
    /// <c>Microsoft.Common.props</c> rebases <c>MSBuildProjectExtensionsPath</c> to an
    /// absolute path on every SDK project, so the fallback only covers a project that
    /// never imported it. There the value is MSBuild-flavoured (<c>obj\</c>) and its
    /// separators have to be normalized before it can be combined on a non-Windows path.
    /// Absolute when rebased and possibly relative on the fallbacks; callers combine it
    /// with the project directory through <c>Path.Combine</c>, which keeps an absolute
    /// value as it is.
    /// </summary>
    public string ProjectExtensionsPath =>
        MSBuildProjectExtensionsPath
        ?? BaseIntermediateOutputPath?.Replace('\\', '/')
        ?? "obj";
}
