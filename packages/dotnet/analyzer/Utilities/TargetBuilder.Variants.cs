using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Per-target-framework build variants for multi-targeted projects.
///
/// A project that declares <c>&lt;TargetFrameworks&gt;</c> has no single host
/// that can necessarily run an unqualified <c>dotnet build</c> across every
/// framework (an iOS + Windows project is the canonical case). These variants
/// let a workspace build and cache one framework in isolation while the
/// unqualified targets keep building the whole project.
///
/// Each variant is <b>self-contained</b>: it does not depend on the unqualified
/// build and does not pass <c>--no-dependencies</c>, so MSBuild builds each
/// referenced project's framework-compatible inner build directly. Depending on
/// the aggregate <c>^build</c> would rebuild every framework of every dependency
/// and reintroduce the very host-compatibility problem these variants solve.
/// The tradeoff is coarser task-level caching of dependencies; <c>^production</c>
/// remains an input so a dependency source change still invalidates the variant.
///
/// Variant target names avoid the ambiguous <c>project:target:configuration</c>
/// colon delimiter — the framework is joined to the configured target name with
/// a hyphen (e.g. <c>build-net10.0-ios</c>), so <c>nx run app:build-net10.0-ios</c>
/// is unambiguous.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddFrameworkVariantTargets(
        Dictionary<string, Target> targets,
        string fileName,
        List<FrameworkVariant> frameworkVariants,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput,
        List<string> directoryBuildInputs)
    {
        var technologies = ProjectUtilities.GetTechnologies(fileName);
        var seenNames = new HashSet<string>(StringComparer.Ordinal);

        foreach (var variant in frameworkVariants)
        {
            var tfm = variant.TargetFramework;
            if (string.IsNullOrWhiteSpace(tfm))
            {
                continue;
            }

            var token = NormalizeTargetNameSegment(tfm);

            var buildName = BuildVariantName(options.BuildTargetName, token);
            var buildReleaseName = BuildVariantName(options.BuildTargetName, token, "release");

            var buildOutputs = GetVariantBuildOutputs(variant.Properties, projectDirectory, workspaceRoot);
            var releaseOutputs = GetVariantBuildOutputs(variant.Properties, projectDirectory, workspaceRoot, releaseOnly: true);

            var inputs = BuildVariantInputs(productionInput, directoryBuildInputs);

            // build-<tfm> (Debug by default, mirroring the unqualified build)
            TryAddVariant(targets, seenNames, buildName, new Target
            {
                Command = "dotnet build",
                Options = new TargetOptions
                {
                    Cwd = "{projectRoot}",
                    Args = ["--no-restore", "--framework", tfm]
                },
                Configurations = FrameworkBuildConfigurations(tfm),
                Cache = true,
                Inputs = inputs,
                Outputs = buildOutputs,
                Metadata = VariantMetadata($"Build the {tfm} target framework", technologies, tfm, options.BuildTargetName)
            });

            // build-<tfm>-release — a Release build of the framework, mirroring the unqualified
            // build:release target (Nx cannot depend on a configuration, so Release is its own
            // target that a Release-only consumer can depend on).
            TryAddVariant(targets, seenNames, buildReleaseName, new Target
            {
                Command = "dotnet build",
                Options = new TargetOptions
                {
                    Cwd = "{projectRoot}",
                    Args = ["--no-restore", "--framework", tfm, "--configuration", "Release"]
                },
                Configurations = FrameworkBuildConfigurations(tfm),
                Cache = true,
                Inputs = inputs,
                Outputs = releaseOutputs.Length > 0 ? releaseOutputs : buildOutputs,
                Metadata = VariantMetadata($"Build the {tfm} target framework in Release configuration", technologies, tfm, options.BuildTargetName)
            });
        }
    }

    /// <summary>
    /// Joins a configured target name and framework token(s) with a hyphen. The
    /// result never contains a colon, so it can't be mistaken for a
    /// configuration in Nx's <c>project:target:configuration</c> syntax.
    /// </summary>
    private static string BuildVariantName(string baseName, params string[] segments)
    {
        return $"{baseName}-{string.Join("-", segments)}";
    }

    /// <summary>
    /// Deterministically normalizes a framework short name into a target-name
    /// segment: lower-cased with any character outside <c>[a-z0-9.+-]</c>
    /// replaced by a hyphen. Framework short names are already lower-case
    /// (e.g. "net10.0-ios"), so this is usually a no-op, but it guarantees the
    /// generated name is a stable, safe Nx target identifier.
    /// </summary>
    private static string NormalizeTargetNameSegment(string value)
    {
        var chars = value.Trim().ToLowerInvariant().ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            var c = chars[i];
            var ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '.' || c == '+' || c == '-';
            if (!ok)
            {
                chars[i] = '-';
            }
        }
        return new string(chars);
    }

    /// <summary>
    /// Inserts a variant target unless its name collides with an already-emitted
    /// target (either an unqualified target or a previously-added variant). On a
    /// collision the variant is skipped and a warning is written to stderr,
    /// rather than silently overwriting a real target.
    /// </summary>
    private static void TryAddVariant(
        Dictionary<string, Target> targets,
        HashSet<string> seenNames,
        string name,
        Target target)
    {
        if (name.Contains(':'))
        {
            Console.Error.WriteLine(
                $"Warning: skipping framework variant target '{name}' because its name contains ':', which is ambiguous with Nx configuration syntax.");
            return;
        }

        if (targets.ContainsKey(name) || !seenNames.Add(name))
        {
            Console.Error.WriteLine(
                $"Warning: skipping framework variant target '{name}' because a target with that name already exists.");
            return;
        }

        targets[name] = target;
    }

    private static Dictionary<string, TargetConfiguration> FrameworkBuildConfigurations(string tfm) => new()
    {
        ["debug"] = new TargetConfiguration
        {
            Args = ["--no-restore", "--framework", tfm, "--configuration", "Debug"]
        },
        ["release"] = new TargetConfiguration
        {
            Args = ["--no-restore", "--framework", tfm, "--configuration", "Release"]
        }
    };

    private static TargetMetadata VariantMetadata(
        string description,
        List<string> technologies,
        string tfm,
        string frameworkVariantOf) => new()
    {
        Description = description,
        Technologies = technologies,
        TargetFramework = tfm,
        FrameworkVariantOf = frameworkVariantOf
    };

    private static object[] BuildVariantInputs(
        string productionInput,
        List<string> directoryBuildInputs)
    {
        // Mirrors the unqualified build's inputs minus dependentTasksOutputFiles: a self-contained
        // variant has no dependent Nx tasks, but ^production still invalidates it when a
        // dependency's sources change.
        return
        [
            productionInput,
            $"^{productionInput}",
            "{workspaceRoot}/.editorconfig",
            new { workingDirectory = "absolute" },
            .. directoryBuildInputs
        ];
    }

    /// <summary>
    /// Build/intermediate outputs scoped to a single framework. The inner build's
    /// evaluated <c>OutputPath</c>/<c>IntermediateOutputPath</c> already include the
    /// framework segment; both the Debug and Release forms are declared so the
    /// variant's configurations are cached correctly.
    /// </summary>
    private static string[] GetVariantBuildOutputs(
        Dictionary<string, string> properties,
        string projectDirectory,
        string workspaceRoot,
        bool releaseOnly = false)
    {
        var outputs = new List<string?>();

        var outputPath = ResolvePath(properties.GetValueOrDefault("OutputPath") ?? "", projectDirectory, workspaceRoot);
        var intermediatePath = ResolvePath(properties.GetValueOrDefault("IntermediateOutputPath") ?? "", projectDirectory, workspaceRoot);

        foreach (var basePath in new[] { outputPath, intermediatePath })
        {
            if (basePath is null)
            {
                continue;
            }

            if (!releaseOnly)
            {
                outputs.Add(WithConfiguration(basePath, "Debug"));
            }
            outputs.Add(WithConfiguration(basePath, "Release"));
        }

        return DedupeOutputs(outputs);
    }

    private static string[] DedupeOutputs(IEnumerable<string?> outputs)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<string>();
        foreach (var o in outputs)
        {
            if (o is not null && seen.Add(o))
            {
                result.Add(o);
            }
        }
        return result.ToArray();
    }

    /// <summary>
    /// Rewrites the configuration portion of an already-tokenized output path to
    /// <paramref name="configuration"/>. Handles the traditional layout where the
    /// configuration is its own path segment (e.g. <c>bin/Debug/net10.0</c>) and the
    /// artifacts layout where it is the prefix of a combined pivot segment
    /// (e.g. <c>artifacts/bin/app/debug_net10.0</c>). A no-op when no configuration
    /// token is present.
    /// </summary>
    private static string? WithConfiguration(string? path, string configuration)
    {
        if (string.IsNullOrEmpty(path))
        {
            return path;
        }

        var segments = path.Split('/');
        for (var i = 0; i < segments.Length; i++)
        {
            var segment = segments[i];

            if (segment.Equals("Debug", StringComparison.OrdinalIgnoreCase) ||
                segment.Equals("Release", StringComparison.OrdinalIgnoreCase))
            {
                segments[i] = configuration;
                continue;
            }

            // Artifacts-output pivots combine configuration and framework, e.g. "debug_net10.0".
            if (segment.StartsWith("debug_", StringComparison.OrdinalIgnoreCase))
            {
                segments[i] = configuration.ToLowerInvariant() + segment.Substring("debug".Length);
            }
            else if (segment.StartsWith("release_", StringComparison.OrdinalIgnoreCase))
            {
                segments[i] = configuration.ToLowerInvariant() + segment.Substring("release".Length);
            }
        }

        return string.Join('/', segments);
    }
}
