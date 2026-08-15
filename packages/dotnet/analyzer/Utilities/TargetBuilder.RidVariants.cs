using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Per-runtime-identifier target variants for multi-targeted executables that
/// declare RIDs (https://github.com/nrwl/nx/discussions/36676).
///
/// A RID-specific publish needs a RID-specific build: <c>dotnet publish
/// --no-build --runtime &lt;rid&gt;</c> looks for build output under a
/// runtime-specific folder, so the publish variant depends on a dedicated
/// <c>build-&lt;tfm&gt;-&lt;rid&gt;-release</c> target rather than the framework-only
/// Release build. This models the RID dimension correctly by construction (see
/// nrwl/nx#33474) instead of forwarding <c>--runtime</c> at run time.
///
/// Output paths are derived from each inner build's evaluated
/// <c>OutputPath</c>/<c>IntermediateOutputPath</c> (configuration rewritten to
/// Release, then the RID placed where the SDK's default layout puts it). This
/// is only valid for the standard appended layout, so RID variants are skipped
/// with a warning when <c>UseArtifactsOutput</c> is set, when
/// <c>AppendTargetFrameworkToOutputPath</c> or <c>AppendRuntimeIdentifierToOutputPath</c>
/// is explicitly false, or when a path can't be reliably derived — rather than
/// emit an output path the build will never write.
///
/// The RID Release build is self-contained on the same terms as the framework
/// build variants — it does not depend on the aggregate <c>^build</c> and does
/// not pass <c>--no-dependencies</c>. Only generated where a project explicitly
/// declares runtime identifiers.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddRuntimeVariantTargets(
        Dictionary<string, Target> targets,
        HashSet<string> seenNames,
        string tfm,
        string tfmToken,
        Dictionary<string, string> properties,
        List<string> runtimeIdentifiers,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput,
        List<string> directoryBuildInputs,
        List<string> technologies)
    {
        if (!IsRuntimeLayoutSupported(properties, out var reason))
        {
            Console.Error.WriteLine(
                $"Warning: skipping runtime-identifier variants for '{tfm}' because {reason}. " +
                "RID variants require the standard appended output layout.");
            return;
        }

        // Any RID already baked into the inner build's evaluated output path (platform
        // frameworks such as net10.0-ios default one). It is replaced by the declared RID
        // rather than appended, so we don't get bin/.../<implicit-rid>/<declared-rid>.
        var innerRid = properties.GetValueOrDefault("RuntimeIdentifier");

        foreach (var rid in runtimeIdentifiers)
        {
            if (string.IsNullOrWhiteSpace(rid))
            {
                continue;
            }

            var binDir = DeriveRuntimeOutput(properties.GetValueOrDefault("OutputPath"), innerRid, rid, projectDirectory, workspaceRoot);
            var objDir = DeriveRuntimeOutput(properties.GetValueOrDefault("IntermediateOutputPath"), innerRid, rid, projectDirectory, workspaceRoot);

            if (binDir is null || objDir is null)
            {
                Console.Error.WriteLine(
                    $"Warning: skipping runtime-identifier variants for '{tfm}'/'{rid}' because the output path could not be derived from the evaluated build.");
                continue;
            }

            var ridToken = NormalizeTargetNameSegment(rid);
            var buildReleaseName = BuildVariantName(options.BuildTargetName, tfmToken, ridToken, "release");
            var publishName = BuildVariantName(options.PublishTargetName, tfmToken, ridToken);

            // build-<tfm>-<rid>-release — a self-contained Release build for the RID, which the
            // RID publish depends on so its --no-build publish finds the runtime-specific output.
            TryAddVariant(targets, seenNames, buildReleaseName, new Target
            {
                Command = "dotnet build",
                Options = new TargetOptions
                {
                    Cwd = "{projectRoot}",
                    Args = ["--no-restore", "--framework", tfm, "--runtime", rid, "--configuration", "Release"]
                },
                Cache = true,
                Inputs = BuildVariantInputs(productionInput, directoryBuildInputs),
                Outputs = DedupeOutputs(new[] { binDir, objDir }),
                Metadata = VariantMetadata($"Build the {tfm} target framework for {rid} in Release configuration", technologies, tfm, rid, options.BuildTargetName)
            });

            // publish-<tfm>-<rid>
            TryAddVariant(targets, seenNames, publishName, new Target
            {
                Command = "dotnet publish",
                Options = new TargetOptions
                {
                    Cwd = "{projectRoot}",
                    Args = ["--no-build", "--no-dependencies", "--no-restore", "--framework", tfm, "--runtime", rid, "--configuration", "Release"]
                },
                DependsOn = [buildReleaseName],
                Cache = true,
                Inputs = BuildVariantInputs(productionInput, directoryBuildInputs),
                Outputs = DedupeOutputs(new[] { AppendSegment(binDir, "publish"), objDir }),
                Metadata = VariantMetadata($"Publish the {tfm} target framework for {rid}", technologies, tfm, rid, options.PublishTargetName)
            });
        }
    }

    /// <summary>
    /// RID variants can only place outputs correctly in the standard appended
    /// layout, where the framework and runtime identifier are output-path
    /// segments. Reject the artifacts layout and any project that turns off the
    /// framework or runtime-identifier path segments.
    /// </summary>
    private static bool IsRuntimeLayoutSupported(Dictionary<string, string> properties, out string reason)
    {
        if (UsesArtifactsOutput(properties))
        {
            reason = "it uses the artifacts output layout (UseArtifactsOutput)";
            return false;
        }

        if (IsExplicitlyFalse(properties, "AppendTargetFrameworkToOutputPath"))
        {
            reason = "AppendTargetFrameworkToOutputPath is false";
            return false;
        }

        if (IsExplicitlyFalse(properties, "AppendRuntimeIdentifierToOutputPath"))
        {
            reason = "AppendRuntimeIdentifierToOutputPath is false";
            return false;
        }

        if (!ProjectUtilities.IsPublishDirDerivable(
                properties.GetValueOrDefault("PublishDir"),
                properties.GetValueOrDefault("OutputPath")))
        {
            reason = "a custom PublishDir was set that doesn't match the default <OutputPath>/publish layout";
            return false;
        }

        reason = string.Empty;
        return true;
    }

    private static bool IsExplicitlyFalse(Dictionary<string, string> properties, string name)
    {
        return properties.TryGetValue(name, out var value)
            && value.Equals("false", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Derives the Release output directory for a declared runtime identifier from
    /// an inner build's evaluated output path: rewrite the configuration segment to
    /// Release, then place the RID. When the inner build already baked a (default)
    /// RID into its path, the trailing RID segment is replaced; otherwise the RID is
    /// appended. Returns <c>null</c> when the path can't be derived so the caller can
    /// skip rather than emit a wrong output.
    /// </summary>
    private static string? DeriveRuntimeOutput(
        string? rawPath,
        string? innerRid,
        string declaredRid,
        string projectDirectory,
        string workspaceRoot)
    {
        if (string.IsNullOrEmpty(rawPath))
        {
            return null;
        }

        var resolved = ResolvePath(rawPath, projectDirectory, workspaceRoot);
        var release = WithConfiguration(resolved, "Release");
        if (string.IsNullOrEmpty(release))
        {
            return null;
        }

        var segments = release.Split('/');

        if (!string.IsNullOrEmpty(innerRid))
        {
            // The inner build defaulted a RID into the path; replace that trailing
            // segment with the declared RID. If the layout doesn't match that
            // expectation, decline rather than guess.
            if (segments.Length > 0 && segments[^1].Equals(innerRid, StringComparison.OrdinalIgnoreCase))
            {
                segments[^1] = declaredRid;
                return string.Join('/', segments);
            }

            return null;
        }

        return $"{release.TrimEnd('/')}/{declaredRid}";
    }
}
