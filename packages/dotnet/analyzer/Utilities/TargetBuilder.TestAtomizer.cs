using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Splits a test target into one target per test unit, plus a no-op parent that
/// depends on all of them.
/// </summary>
public static partial class TargetBuilder
{
    /// <summary>
    /// Adds the split targets for a project, or nothing at all when the project
    /// declares no test units.
    /// </summary>
    /// <returns>The target group, or null when nothing was added.</returns>
    private static Dictionary<string, List<string>>? AddAtomizedTestTargets(
        Dictionary<string, Target> targets,
        TestDiscoveryResult discovery,
        Target baseTestTarget,
        PluginOptions options,
        Dictionary<string, string> properties,
        string projectName,
        string projectDirectory,
        string workspaceRoot,
        string fileName)
    {
        var ciTargetName = options.TestCiTargetName!;
        var units = discovery.Units;

        // A no-op parent with no dependencies would pass while running nothing.
        if (units.Count == 0)
        {
            return null;
        }

        // Every unit appends only its id to this base, so whether it can be
        // expressed as an Nx path is a property of the project, not the unit.
        var resultsBase = GetAtomizedTestResultsBase(properties, projectName, projectDirectory, workspaceRoot);
        if (resultsBase is null)
        {
            Console.Error.WriteLine(
                $"@nx/dotnet: cannot split tests for '{projectName}'. Its test results directory " +
                "resolves outside the workspace, so per-class results cannot be declared as Nx outputs.");
            return null;
        }

        var (nxBaseDirectory, cwdRelativeBase) = resultsBase.Value;

        ReportExclusions(discovery, projectName, options.TestTargetName);

        var technologies = ProjectUtilities.GetTechnologies(fileName);
        var groupName = options.TestCiGroupName ?? $"{ciTargetName.ToUpperInvariant()} (CI)";
        var dependsOn = new List<object>();
        var groupMembers = new List<string>();

        foreach (var unit in units)
        {
            var targetName = $"{ciTargetName}--{unit.Id}";
            var nxOutputPath = $"{nxBaseDirectory}/{unit.Id}";
            var cwdRelativePath = $"{cwdRelativeBase}/{unit.Id}";

            targets[targetName] = baseTestTarget with
            {
                Options = new TargetOptions
                {
                    Cwd = baseTestTarget.Options?.Cwd,
                    Args = BuildAtomizedArgs(unit, cwdRelativePath)
                },
                Outputs = [nxOutputPath],
                Parallelism = unit.DoNotParallelize ? false : null,
                Metadata = new TargetMetadata
                {
                    Description = $"Run .NET tests in {unit.Id}",
                    Technologies = technologies
                }
            };

            dependsOn.Add(new TargetDependency
            {
                Target = targetName,
                Params = "forward",
                Options = "forward"
            });
            groupMembers.Add(targetName);
        }

        targets[ciTargetName] = new Target
        {
            Executor = "nx:noop",
            Cache = baseTestTarget.Cache,
            Inputs = baseTestTarget.Inputs,
            Outputs = baseTestTarget.Outputs,
            DependsOn = [.. dependsOn],
            // Otherwise Nx could schedule the parent alongside its own tasks.
            Parallelism = units.All(unit => unit.DoNotParallelize) ? false : null,
            Metadata = new TargetMetadata
            {
                Description = "Run .NET tests in CI",
                Technologies = technologies,
                NonAtomizedTarget = options.TestTargetName
            }
        };

        groupMembers.Insert(0, ciTargetName);

        return new Dictionary<string, List<string>> { [groupName] = groupMembers };
    }

    /// <summary>
    /// Reports test classes and methods that were found but deliberately left
    /// out of the split.
    /// </summary>
    /// <remarks>
    /// Excluded tests still run under the ordinary test target, so nothing
    /// fails; the split run just stops covering them.
    /// </remarks>
    private static void ReportExclusions(
        TestDiscoveryResult discovery,
        string projectName,
        string testTargetName)
    {
        var reasons = new List<string>();

        if (discovery.SkippedNested > 0)
        {
            reasons.Add($"{discovery.SkippedNested} nested");
        }

        if (discovery.SkippedGeneric > 0)
        {
            reasons.Add($"{discovery.SkippedGeneric} generic");
        }

        if (reasons.Count == 0)
        {
            return;
        }

        Console.Error.WriteLine(
            $"@nx/dotnet: split '{projectName}' into {discovery.Units.Count} test targets, " +
            $"leaving out {string.Join(" and ", reasons)} " +
            $"({(discovery.SkippedNested + discovery.SkippedGeneric == 1 ? "test" : "tests")} " +
            $"that cannot be selected individually by the test platform). " +
            $"They still run as part of the '{testTargetName}' target.");
    }

    /// <summary>
    /// Builds the argument list for a single split test task.
    /// </summary>
    /// <remarks>
    /// Argument order matters. Nx assembles the command as
    /// <c>&lt;command&gt; &lt;unknownOptions&gt; &lt;options.args&gt;
    /// &lt;__unparsed__&gt;</c>, so flags forwarded from the parent land before
    /// the <c>--</c> and reach the SDK, while anything after <c>nx … --</c>
    /// lands after it and reaches the test platform.
    ///
    /// The same arguments work under the VSTest bridge and under .NET 10's
    /// platform runner, so there is no branch on which is in use.
    /// </remarks>
    private static string[] BuildAtomizedArgs(
        TestUnit unit,
        string cwdRelativeResultsPath)
    {
        // --no-build implies --no-restore on both SDKs; --no-restore is kept
        // so these match the unsplit target's arguments.
        var args = new List<string> { "--no-build", "--no-restore", "--" };

        args.AddRange(unit.FilterArgs);

        // Per-task directory so restoring one task from cache cannot overwrite
        // another's results. No reporter is enabled: --report-trx comes from an
        // extension the project may not reference, and is an "Unknown option"
        // failure when it does not.
        args.AddRange(["--results-directory", $"\"{cwdRelativeResultsPath}\""]);

        // Without this a filter matching nothing exits zero, so a discovery
        // gap would pass silently.
        args.AddRange(["--minimum-expected-tests", "1"]);

        return [.. args];
    }
}
