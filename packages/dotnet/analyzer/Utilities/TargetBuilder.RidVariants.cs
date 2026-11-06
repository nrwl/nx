using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

public static partial class TargetBuilder
{
    private const string RidPublishDirectoryVariable = "NX_DOTNET_PUBLISH_DIRECTORY";

    private static Dictionary<string, List<string>> AddRidVariantTargets(
        Dictionary<string, Target> targets,
        string fileName,
        List<FrameworkVariant> variants,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options)
    {
        var groups = new Dictionary<string, List<string>>();
        if (!options.TfmVariants || !options.RidVariants)
        {
            return groups;
        }

        var builds = new List<string>();
        var publishes = new List<string>();
        foreach (var variant in variants)
        {
            if (!variant.Properties.IsExecutable)
            {
                continue;
            }

            foreach (var runtime in variant.RidVariants)
            {
                var rid = runtime.RuntimeIdentifier;
                var buildName = BuildVariantName(options.BuildTargetName, variant.TargetFramework, rid);
                var publishName = BuildVariantName(options.PublishTargetName, variant.TargetFramework, rid);
                var configurations = new Dictionary<string, TargetOptions>();
                var publishConfigurations = new Dictionary<string, TargetOptions>();
                var cacheable = runtime.Cacheable;
                foreach (var (configuration, properties) in runtime.Configurations)
                {
                    if (!properties.IsExecutable)
                    {
                        Console.Error.WriteLine(
                            $"Warning: skipping RID variants for '{variant.TargetFramework}'/'{rid}' " +
                            $"because OutputType is not executable in {configuration}.");
                        configurations.Clear();
                        break;
                    }

                    if (!RidVariantUtilities.TryGetOutputPaths(
                        variant.Configurations[configuration], variant.TargetFramework, rid, out _, out _, out var baseReason))
                    {
                        Console.Error.WriteLine(
                            $"Warning: skipping RID variants for '{variant.TargetFramework}'/'{rid}' " +
                            $"because {baseReason} ({configuration}).");
                        configurations.Clear();
                        break;
                    }

                    if (!RidVariantUtilities.TryGetOutputPaths(
                        properties, variant.TargetFramework, rid, out var bin, out var obj, out var reason))
                    {
                        Console.Error.WriteLine(
                            $"Warning: skipping RID variants for '{variant.TargetFramework}'/'{rid}' " +
                            $"because {reason} ({configuration}).");
                        configurations.Clear();
                        break;
                    }

                    var binPath = ResolvePath(bin, projectDirectory, workspaceRoot);
                    var objPath = ResolvePath(obj, projectDirectory, workspaceRoot);
                    if (binPath is null || objPath is null)
                    {
                        Console.Error.WriteLine(
                            $"Warning: skipping RID variants for '{variant.TargetFramework}'/'{rid}' " +
                            "because an evaluated output path is outside the workspace.");
                        configurations.Clear();
                        break;
                    }

                    var documents = GetOpenApiDocumentsDirectory(properties, projectDirectory, workspaceRoot);
                    if (!string.IsNullOrEmpty(properties.OpenApiDocumentsDirectory)
                        && (documents is null || !new[] { binPath, objPath }.Any(path =>
                            documents == path || documents.StartsWith($"{path}/", StringComparison.Ordinal))
                            || documents == $"{binPath}/publish"
                            || documents.StartsWith($"{binPath}/publish/", StringComparison.Ordinal)))
                    {
                        Console.Error.WriteLine(
                            $"Warning: skipping RID variants for '{variant.TargetFramework}'/'{rid}' " +
                            "because OpenApiDocumentsDirectory is outside the scoped build outputs.");
                        configurations.Clear();
                        break;
                    }

                    string[] args =
                    [
                        "--no-restore", "--framework", variant.TargetFramework,
                        "--runtime", rid, "--configuration", properties.Configuration!
                    ];
                    var references = runtime.References.GetValueOrDefault(configuration, []);
                    if (references.Any(reference =>
                        ResolvePath(reference.Properties.OutDir ?? reference.Properties.OutputPath ?? "",
                            Path.GetDirectoryName(reference.ProjectFile)!, workspaceRoot) is null
                        || ResolvePath(reference.Properties.IntermediateOutputPath ?? "",
                            Path.GetDirectoryName(reference.ProjectFile)!, workspaceRoot) is null))
                    {
                        cacheable = false;
                        Console.Error.WriteLine(
                            $"Warning: disabling cache for '{variant.TargetFramework}'/'{rid}' " +
                            $"because a referenced project's {configuration} output paths are outside the workspace or underivable.");
                    }
                    string[] outputs =
                    [
                        $"{binPath}/**/*",
                        $"!{binPath}/publish/**/*",
                        .. GetIntermediateOutputs(objPath),
                        .. references.SelectMany(reference =>
                            GetVariantBuildOutputs(reference.Properties, Path.GetFileName(reference.ProjectFile),
                                Path.GetDirectoryName(reference.ProjectFile)!, workspaceRoot)
                                .Select(path => path.Replace("{projectRoot}",
                                    $"{{workspaceRoot}}/{Path.GetRelativePath(workspaceRoot, Path.GetDirectoryName(reference.ProjectFile)!).Replace('\\', '/')}")))
                    ];
                    configurations[configuration] = CreateVariantOptions(
                        args, outputs, workspaceRoot, projectDirectory);
                    publishConfigurations[configuration] = CreateVariantOptions(
                        ["--no-build", .. args],
                        [$"{binPath}/publish/**/*", .. GetIntermediateOutputs(objPath)],
                        workspaceRoot, projectDirectory) with
                    {
                        Env = new()
                        {
                            [RidPublishDirectoryVariable] = Path.GetRelativePath(projectDirectory,
                                Path.GetFullPath(Path.Combine(projectDirectory, bin, "publish"))).Replace('\\', '/')
                        }
                    };
                }

                if (!configurations.ContainsKey("debug") || !configurations.ContainsKey("release"))
                {
                    continue;
                }

                var build = CreateRidTarget(
                    "build", variant, runtime with { Cacheable = cacheable }, options.BuildTargetName, configurations, fileName);
                if (!TryAddVariant(targets, buildName, build))
                {
                    continue;
                }
                builds.Add(buildName);

                var publish = CreateRidTarget(
                    "publish", variant, runtime with { Cacheable = cacheable }, options.PublishTargetName, publishConfigurations, fileName) with
                {
                    DependsOn = [buildName]
                };
                if (TryAddVariant(targets, publishName, publish))
                {
                    publishes.Add(publishName);
                }
            }
        }

        if (builds.Count > 0)
        {
            groups[$"{options.BuildTargetName} (RID)"] = builds;
        }
        if (publishes.Count > 0)
        {
            groups[$"{options.PublishTargetName} (RID)"] = publishes;
        }
        return groups;
    }

    private static Target CreateRidTarget(
        string command,
        FrameworkVariant variant,
        RidVariant runtime,
        string baseTarget,
        Dictionary<string, TargetOptions> options,
        string fileName) => new()
        {
            Command = command == "publish"
                ? $"node -e \"require('node:fs').rmSync(process.env.{RidPublishDirectoryVariable}, {{recursive:true,force:true}})\" && dotnet publish {{args.nxArgs}}"
                : "dotnet build {args.nxArgs}",
            DefaultConfiguration = "release",
            Options = options["release"],
            Configurations = options.ToDictionary(
                entry => entry.Key,
                entry => new TargetConfiguration
                {
                    Args = entry.Value.Args,
                    NxArgs = entry.Value.NxArgs,
                    NxOutputs = entry.Value.NxOutputs,
                    Env = entry.Value.Env,
                    ForwardAllArgs = entry.Value.ForwardAllArgs
                }),
            Cache = variant.Cacheable && runtime.Cacheable,
            Parallelism = false,
            Inputs = runtime.Inputs,
            Outputs = options.Values.SelectMany(value => value.NxOutputs!.Keys)
                .Distinct(StringComparer.Ordinal)
                .Select(key => $"{(key.StartsWith("exclude", StringComparison.Ordinal) ? "!" : "")}{{options.nxOutputs.{key}}}")
                .ToArray(),
            Metadata = new TargetMetadata
            {
                Description = $"{(command == "build" ? "Build" : "Publish")} the {variant.TargetFramework} target framework for {runtime.RuntimeIdentifier}",
                Technologies = ProjectUtilities.GetTechnologies(fileName),
                VariantOf = baseTarget,
                TargetFramework = variant.TargetFramework,
                RuntimeIdentifier = runtime.RuntimeIdentifier
            }
        };
}
