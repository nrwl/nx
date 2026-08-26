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

        // Every unit appends only its id to this base, so whether it can be
        // expressed as an Nx path is a property of the project, not the unit.
        // Resolved before any exclusion summary: when the directory rules out
        // splitting, nothing was left out — splitting never started.
        var resultsBase = GetAtomizedTestResultsBase(properties, projectName, projectDirectory, workspaceRoot);
        if (resultsBase is null)
        {
            Console.Error.WriteLine(
                $"@nx/dotnet: cannot split tests for '{projectName}'. Its test results directory " +
                "resolves outside the workspace, so per-class results cannot be declared as Nx outputs.");
            return null;
        }

        var (nxBaseDirectory, cwdRelativeBase) = resultsBase.Value;

        // The base reaches a command string, so a value this builder cannot
        // express safely is refused rather than escaped.
        if (!IsPlainResultsDirectory(nxBaseDirectory))
        {
            Console.Error.WriteLine(
                $"@nx/dotnet: cannot split tests for '{projectName}'. Its test results directory " +
                "is not a plain path, so it is not safe to use in the test command.");
            return null;
        }

        // Before the early return below: a project whose classes were all
        // excluded splits nothing and still needs the explanation.
        ReportExclusions(discovery, projectName, options.TestTargetName);

        // A no-op parent with no dependencies would pass while running nothing.
        if (units.Count == 0)
        {
            return null;
        }

        var technologies = ProjectUtilities.GetTechnologies(fileName);
        var groupName = options.TestCiGroupName!;
        var dependsOn = new List<object>();
        var groupMembers = new List<string>();

        // Merged into the caller's `targets` only once the parent is built, so
        // throwing partway through cannot leave leaves without a parent.
        var atomizedTargets = new Dictionary<string, Target>();

        foreach (var unit in units)
        {
            // Discovery should already guarantee this, but Id becomes a target
            // name, a filter and a results-directory path.
            if (!IsDottedIdentifierSequence(unit.Id))
            {
                Console.Error.WriteLine(
                    $"@nx/dotnet: skipping '{unit.Id}' while splitting '{projectName}'. Its name is not " +
                    "a plain dotted identifier sequence, so it is not safe to use as a target name.");
                continue;
            }

            var targetName = $"{ciTargetName}--{unit.Id}";
            var nxOutputPath = $"{nxBaseDirectory}/{unit.Id}";
            var cwdRelativePath = $"{cwdRelativeBase}/{unit.Id}";

            atomizedTargets[targetName] = baseTestTarget with
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

        // The loop can reject every unit, which reaches the same state the
        // early return above exists to prevent.
        if (dependsOn.Count == 0)
        {
            return null;
        }

        atomizedTargets[ciTargetName] = new Target
        {
            Executor = "nx:noop",
            Cache = baseTestTarget.Cache,
            Inputs = baseTestTarget.Inputs,
            Outputs = baseTestTarget.Outputs,
            DependsOn = [.. dependsOn],
            Parallelism = units.All(unit => unit.DoNotParallelize) ? false : null,
            Metadata = new TargetMetadata
            {
                Description = "Run .NET tests in CI",
                Technologies = technologies,
                NonAtomizedTarget = options.TestTargetName
            }
        };

        groupMembers.Insert(0, ciTargetName);

        foreach (var (name, target) in atomizedTargets)
        {
            targets[name] = target;
        }

        return new Dictionary<string, List<string>> { [groupName] = groupMembers };
    }

    /// <summary>
    /// Reports test classes and methods that were found but deliberately left
    /// out of the split.
    /// </summary>
    /// <remarks>
    /// Excluded tests still run under the ordinary test target, so nothing
    /// fails; the split run just stops covering them. Fires even when nothing
    /// split, which is the case most worth explaining.
    /// </remarks>
    private static void ReportExclusions(
        TestDiscoveryResult discovery,
        string projectName,
        string testTargetName)
    {
        // Split by what happens to the class, not just why it was left out: a
        // nested or generic class still runs unsplit, an ignored or non-public
        // one is never run by MSTest at all, so one sentence cannot cover both.
        var unsplitReasons = new List<string>();

        if (discovery.SkippedNested > 0)
        {
            unsplitReasons.Add($"{discovery.SkippedNested} nested");
        }

        if (discovery.SkippedGeneric > 0)
        {
            unsplitReasons.Add($"{discovery.SkippedGeneric} generic");
        }

        if (discovery.SkippedNoOwnMethod > 0)
        {
            unsplitReasons.Add($"{discovery.SkippedNoOwnMethod} with no test method of their own");
        }

        if (unsplitReasons.Count == 0 && discovery.SkippedUnrunnable == 0)
        {
            return;
        }

        var summary = discovery.Units.Count > 0
            ? $"split '{projectName}' into {discovery.Units.Count} test targets"
            : $"could not split any tests for '{projectName}'";

        if (unsplitReasons.Count > 0)
        {
            var total = discovery.SkippedNested + discovery.SkippedGeneric + discovery.SkippedNoOwnMethod;
            var reasonsText = unsplitReasons.Count == 1
                ? unsplitReasons[0]
                : string.Join(", ", unsplitReasons.Take(unsplitReasons.Count - 1)) + " and " + unsplitReasons[^1];
            var testWord = total == 1 ? "test" : "tests";

            Console.Error.WriteLine(
                $"@nx/dotnet: {summary}, leaving out {reasonsText} " +
                $"({testWord} the split does not cover). " +
                $"They still run as part of the '{testTargetName}' target.");
        }

        if (discovery.SkippedUnrunnable > 0)
        {
            var classWord = discovery.SkippedUnrunnable == 1 ? "class" : "classes";
            var prefix = unsplitReasons.Count > 0 ? "@nx/dotnet: also left out" : $"@nx/dotnet: {summary}, leaving out";

            Console.Error.WriteLine(
                $"{prefix} {discovery.SkippedUnrunnable} ignored, non-public, or empty test " +
                $"{classWord}. MSTest would not run {(discovery.SkippedUnrunnable == 1 ? "it" : "them")} " +
                "under any target.");
        }
    }

    /// <summary>
    /// Whether <paramref name="id"/> is a dot-separated sequence of ordinary
    /// identifiers, with nothing else mixed in.
    /// </summary>
    private static bool IsDottedIdentifierSequence(string id) =>
        id.Length > 0 && id.Split('.').All(IsIdentifier);

    private static bool IsIdentifier(string segment) =>
        segment.Length > 0 &&
        (char.IsLetter(segment[0]) || segment[0] == '_') &&
        segment.Skip(1).All(c => char.IsLetterOrDigit(c) || c == '_');

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
