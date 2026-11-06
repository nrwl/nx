using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

public static partial class TargetBuilder
{
    private static Dictionary<string, List<string>>? AddFrameworkVariantTargets(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        List<FrameworkVariant> frameworkVariants,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options)
    {
        var leaves = new List<string>();
        foreach (var variant in frameworkVariants)
        {
            var name = BuildVariantName(options.BuildTargetName, variant.TargetFramework);
            var ownPaths = variant.Configurations.Values.SelectMany(properties => new[]
            {
                ResolvePath(properties.OutDir ?? properties.OutputPath ?? "", projectDirectory, workspaceRoot),
                ResolvePath(properties.IntermediateOutputPath ?? "", projectDirectory, workspaceRoot)
            }.Concat(string.IsNullOrEmpty(properties.OpenApiDocumentsDirectory) ? [] :
                new[] { ResolvePath(properties.OpenApiDocumentsDirectory, projectDirectory, workspaceRoot) })).ToArray();
            var referenceOutsideWorkspace = variant.References.Values.SelectMany(references => references)
                .Any(reference =>
                {
                    var directory = Path.GetDirectoryName(reference.ProjectFile)!;
                    return ResolvePath(reference.Properties.OutDir ?? reference.Properties.OutputPath ?? "", directory, workspaceRoot) is null ||
                        ResolvePath(reference.Properties.IntermediateOutputPath ?? "", directory, workspaceRoot) is null ||
                        (!string.IsNullOrEmpty(reference.Properties.OpenApiDocumentsDirectory) &&
                            ResolvePath(reference.Properties.OpenApiDocumentsDirectory, directory, workspaceRoot) is null);
                });
            var outputConflict = referenceOutsideWorkspace || ownPaths.Any(path => path is null) || frameworkVariants
                .Where(other => other.TargetFramework != variant.TargetFramework)
                .SelectMany(other => other.Configurations.Values)
                .SelectMany(properties => new[]
                {
                    ResolvePath(properties.OutDir ?? properties.OutputPath ?? "", projectDirectory, workspaceRoot),
                    ResolvePath(properties.IntermediateOutputPath ?? "", projectDirectory, workspaceRoot)
                }.Concat(string.IsNullOrEmpty(properties.OpenApiDocumentsDirectory) ? [] :
                    new[] { ResolvePath(properties.OpenApiDocumentsDirectory, projectDirectory, workspaceRoot) }))
                .Any(other => other is not null && ownPaths.Any(path => path is not null &&
                    (path == other || path.StartsWith($"{other}/", StringComparison.Ordinal) || other.StartsWith($"{path}/", StringComparison.Ordinal))));
            if (outputConflict)
            {
                Console.Error.WriteLine($"Warning: disabling cache for '{name}' because evaluated output paths overlap another framework or escape the workspace.");
            }
            var configurations = variant.Configurations.ToDictionary(pair => pair.Key, pair =>
            {
                var outputs = GetVariantBuildOutputs(pair.Value, fileName, projectDirectory, workspaceRoot)
                    .Concat(variant.References.GetValueOrDefault(pair.Key, []).SelectMany(reference =>
                        GetVariantBuildOutputs(reference.Properties, Path.GetFileName(reference.ProjectFile),
                            Path.GetDirectoryName(reference.ProjectFile)!, workspaceRoot)
                            .Select(path => path.Replace("{projectRoot}",
                                $"{{workspaceRoot}}/{Path.GetRelativePath(workspaceRoot, Path.GetDirectoryName(reference.ProjectFile)!).Replace('\\', '/')}"))))
                    .Distinct().ToArray();
                return new TargetConfiguration
                {
                    Args = ["--no-restore", "--framework", variant.TargetFramework, "--configuration", pair.Value.Configuration!],
                    NxArgs = $"--no-restore --framework {variant.TargetFramework} --configuration {pair.Value.Configuration}",
                    NxOutputs = CreateVariantOptions([], outputs, workspaceRoot, projectDirectory).NxOutputs
                };
            });
            if (TryAddVariant(targets, name, new Target
            {
                Command = "dotnet build {args.nxArgs}",
                DefaultConfiguration = "debug",
                Parallelism = false,
                Options = new TargetOptions { Cwd = "{projectRoot}", ForwardAllArgs = false },
                Configurations = configurations,
                Cache = variant.Cacheable && !outputConflict,
                Inputs = variant.Inputs,
                Outputs = configurations.Values.SelectMany(configuration => configuration.NxOutputs!.Keys)
                    .Distinct().Select(key => $"{(key.StartsWith("exclude") ? "!" : "")}{{options.nxOutputs.{key}}}").ToArray(),
                Metadata = new TargetMetadata
                {
                    Description = $"Build the {variant.TargetFramework} target framework",
                    Technologies = ProjectUtilities.GetTechnologies(fileName),
                    TargetFramework = variant.TargetFramework,
                    VariantOf = options.BuildTargetName
                }
            }))
            {
                leaves.Add(name);
            }
        }

        if (leaves.Count != frameworkVariants.Count)
        {
            Console.Error.WriteLine($"Warning: retaining '{options.BuildTargetName}' as an all-framework build because not every framework variant could be generated.");
            return null;
        }

        targets[options.BuildTargetName] = new Target
        {
            Executor = "nx:noop",
            Cache = false,
            DefaultConfiguration = "debug",
            Configurations = new() { ["debug"] = new(), ["release"] = new() },
            DependsOn = leaves.ToArray(),
            Outputs = [],
            Metadata = targets[options.BuildTargetName].Metadata
        };
        var releaseName = $"{options.BuildTargetName}:release";
        if (targets.TryGetValue(releaseName, out var releaseTarget) && releaseTarget.Command == "dotnet build")
        {
            var configurations = new[] { "debug", "release" }.ToDictionary(configuration => configuration, configuration =>
            {
                var outputs = frameworkVariants.SelectMany(variant =>
                    GetVariantBuildOutputs(variant.Configurations[configuration], fileName, projectDirectory, workspaceRoot))
                    .Distinct().ToArray();
                var generated = releaseTarget.Configurations![configuration];
                return generated with
                {
                    NxArgs = string.Join(" ", generated.Args ?? []),
                    NxOutputs = CreateVariantOptions([], outputs, workspaceRoot, projectDirectory).NxOutputs
                };
            });
            targets[releaseName] = releaseTarget with
            {
                Command = "dotnet build {args.nxArgs}",
                Cache = false,
                Parallelism = false,
                DefaultConfiguration = "release",
                Options = new TargetOptions { Cwd = "{projectRoot}", ForwardAllArgs = false },
                Configurations = configurations,
                Outputs = configurations.Values.SelectMany(configuration => configuration.NxOutputs!.Keys)
                    .Distinct().Select(key => $"{(key.StartsWith("exclude") ? "!" : "")}{{options.nxOutputs.{key}}}").ToArray(),
                Metadata = releaseTarget.Metadata! with { Description = "Legacy all-framework Release build (not a framework aggregate)" }
            };
            Console.Error.WriteLine($"Warning: '{projectName}:{releaseName}' retains the legacy all-framework build because Nx cannot select a fixed dependency configuration. Use '{projectName}:{options.BuildTargetName} --configuration=release' for framework fan-out. Legacy '^{releaseName}' dependencies cannot yet fan out without core support.");
        }
        else
        {
            Console.Error.WriteLine($"Warning: cannot create compatibility target '{releaseName}' because another target owns that name.");
        }

        foreach (var name in new[] { options.PublishTargetName, options.PackTargetName })
        {
            if (!targets.TryGetValue(name, out var target))
            {
                continue;
            }
            targets[name] = target with
            {
                Parallelism = false,
            };
            if (name == options.PublishTargetName)
            {
                targets[name] = targets[name] with { Cache = false, Outputs = [] };
            }
            else
            {
                var configurations = frameworkVariants.SelectMany(variant => variant.Configurations.Keys).Distinct()
                    .ToDictionary(configuration => configuration, configuration =>
                    {
                        var outputs = frameworkVariants.SelectMany(variant =>
                        {
                            var properties = variant.Configurations[configuration];
                            var package = ResolvePath(properties.PackageOutputPath ?? "", projectDirectory, workspaceRoot);
                            return GetVariantBuildOutputs(properties, fileName, projectDirectory, workspaceRoot)
                                .Concat(package is null ? [] : new[] { $"{package}/*.nupkg" });
                        }).Distinct().ToArray();
                        var original = targets[name].Configurations![configuration];
                        return original with
                        {
                            NxArgs = string.Join(" ", original.Args ?? []),
                            NxOutputs = CreateVariantOptions([], outputs, workspaceRoot, projectDirectory).NxOutputs
                        };
                    });
                targets[name] = targets[name] with
                {
                    Command = "dotnet pack {args.nxArgs}",
                    DefaultConfiguration = "release",
                    Options = new TargetOptions { Cwd = "{projectRoot}", ForwardAllArgs = false },
                    Configurations = configurations,
                    Outputs = configurations.Values.SelectMany(configuration => configuration.NxOutputs!.Keys)
                        .Distinct().Select(key => $"{(key.StartsWith("exclude") ? "!" : "")}{{options.nxOutputs.{key}}}").ToArray()
                };
            }
        }

        return new() { ["Build"] = [options.BuildTargetName, releaseName, .. leaves] };
    }

    private static string BuildVariantName(string baseName, params string[] segments) =>
        $"{baseName}:{string.Join(":", segments.Select(segment => new string(segment.Trim().ToLowerInvariant()
            .Select(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '+' or '-' ? c : '-').ToArray())))}";

    private static bool TryAddVariant(Dictionary<string, Target> targets, string name, Target target)
    {
        if (targets.TryAdd(name, target))
        {
            return true;
        }
        Console.Error.WriteLine($"Warning: skipping variant target '{name}' because a target with that name already exists.");
        return false;
    }

    private static string[] GetVariantBuildOutputs(
        EvaluatedProperties properties,
        string fileName,
        string projectDirectory,
        string workspaceRoot)
    {
        var output = ResolvePath(properties.OutDir ?? properties.OutputPath ?? "", projectDirectory, workspaceRoot);
        var intermediate = ResolvePath(properties.IntermediateOutputPath ?? "", projectDirectory, workspaceRoot);
        var runtimes = (properties.Get("RuntimeIdentifiers") ?? properties.Get("RuntimeIdentifier") ?? "")
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var runtimeExclusions = runtimes.SelectMany(runtime =>
            new[] { output, intermediate }.Where(path => path is not null)
                .Select(path => $"!{path}/{runtime}/**/*"));
        return new[] { output is null ? null : $"{output}/**/*" }.Where(path => path is not null).Select(path => path!)
            .Concat(GetIntermediateOutputs(intermediate))
            .Concat(output is null ? [] : new[] { $"!{output}/**/publish/**/*" })
            .Concat(runtimeExclusions)
            .Concat(GetOpenApiDocumentsOutputs(properties, fileName, projectDirectory, workspaceRoot, output, intermediate))
            .Distinct().ToArray();
    }

    private static TargetOptions CreateVariantOptions(
        string[] args,
        string[] outputs,
        string workspaceRoot,
        string projectDirectory) => new()
        {
            Cwd = "{projectRoot}",
            Args = args,
            NxArgs = string.Join(" ", args),
            ForwardAllArgs = false,
            NxOutputs = outputs.Select((output, index) => (output, index)).ToDictionary(
            pair => $"{(pair.output.StartsWith('!') ? "exclude" : "output")}{pair.index}",
            pair => pair.output.TrimStart('!').Replace("{projectRoot}", Path.GetRelativePath(workspaceRoot, projectDirectory).Replace('\\', '/'))
                .Replace("{workspaceRoot}/", ""))
        };
}
