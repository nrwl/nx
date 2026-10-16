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
    /// The name of the target that runs the project's tests split across one
    /// task per test unit. Null (the default) disables splitting entirely.
    /// </summary>
    public string? TestCiTargetName { get; set; }

    /// <summary>
    /// The name of the target group the split targets are collapsed into.
    /// </summary>
    /// <remarks>
    /// Always sent alongside <see cref="TestCiTargetName"/>, derived on the
    /// TypeScript side from the shared Nx helper so the naming convention has
    /// one implementation across plugins. There is deliberately no default
    /// here, which would be a second one.
    /// </remarks>
    public string? TestCiGroupName { get; set; }

    /// <summary>
    /// Whether each split task runs one test class or one test method.
    /// Defaults to <see cref="SplitBy.Class"/>.
    /// </summary>
    public SplitBy TestCiSplitBy { get; set; } = SplitBy.Class;
}
