namespace MsbuildAnalyzer.Models;

/// <summary>
/// Plugin options passed from the Nx plugin to control target generation.
/// </summary>
public class PluginOptions
{
    /// <summary>
    /// The name of the build target. Defaults to "build".
    /// </summary>
    public string BuildTargetName { get; set; } = "build";

    /// <summary>
    /// The name of the test target. Defaults to "test".
    /// </summary>
    public string TestTargetName { get; set; } = "test";

    /// <summary>
    /// The name of the clean target. Defaults to "clean".
    /// </summary>
    public string CleanTargetName { get; set; } = "clean";

    /// <summary>
    /// The name of the restore target. Defaults to "restore".
    /// </summary>
    public string RestoreTargetName { get; set; } = "restore";

    /// <summary>
    /// The name of the publish target. Defaults to "publish".
    /// </summary>
    public string PublishTargetName { get; set; } = "publish";

    /// <summary>
    /// The name of the pack target. Defaults to "pack".
    /// </summary>
    public string PackTargetName { get; set; } = "pack";

    /// <summary>
    /// The name of the watch target. Defaults to "watch".
    /// </summary>
    public string WatchTargetName { get; set; } = "watch";

    /// <summary>
    /// The name of the run target. Defaults to "run".
    /// </summary>
    public string RunTargetName { get; set; } = "run";

    /// <summary>
    /// When true, multi-targeted projects additionally get per-target-framework
    /// target variants (e.g. "build-net10.0-ios") alongside the unqualified
    /// targets. Opt-in because expanding the task graph this way is only useful
    /// for workspaces that need to invoke a single framework in isolation.
    /// Defaults to false, leaving the generated targets unchanged.
    /// </summary>
    public bool FrameworkVariants { get; set; } = false;

    /// <summary>
    /// When true, multi-targeted executables additionally get per-runtime-identifier
    /// variants (e.g. "publish-net10.0-ios-ios-arm64"). Separate from
    /// <see cref="FrameworkVariants"/> so opting into per-framework build variants
    /// does not, on its own, expand the graph with RID variants. Enabling this
    /// implies framework variants. Defaults to false.
    /// </summary>
    public bool RuntimeVariants { get; set; } = false;
}
