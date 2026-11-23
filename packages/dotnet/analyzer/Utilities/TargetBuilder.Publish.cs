using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Publish target creation methods for TargetBuilder.
/// </summary>
public static partial class TargetBuilder
{
    private static void AddPublishTarget(
        Dictionary<string, Target> targets,
        string projectName,
        string fileName,
        bool isTest,
        EvaluatedProperties properties,
        string projectDirectory,
        string workspaceRoot,
        PluginOptions options,
        string productionInput,
        List<string> directoryBuildInputs)
    {
        // The configuration MSBuild evaluated the paths at; the target runs at Release.
        var defaultConfiguration = properties.Configuration;
        var releaseProperties = properties.WithConfiguration("Release");

        var publishDir = GetPublishDir(releaseProperties, defaultConfiguration, projectDirectory, workspaceRoot);
        // `dotnet publish` writes incremental-publish state (e.g.
        // obj/<Configuration>/PublishOutputs.<hash>.txt) into the intermediate
        // (obj) directory, so it must be declared as an output alongside the
        // publish directory, mirroring the build target.
        var intermediatePath = GetIntermediateOutputPath(releaseProperties, projectDirectory, workspaceRoot);

        string[] defaultFlags = ["--no-build", "--no-dependencies", "--no-restore"];

        var buildReleaseTarget = $"{options.BuildTargetName}:release";
        targets[options.PublishTargetName] = new Target
        {
            Command = "dotnet publish",
            Options = new TargetOptions
            {
                Cwd = "{projectRoot}",
                Args = [.. defaultFlags, "--configuration", "Release"]
            },
            Configurations = new Dictionary<string, TargetConfiguration>
            {
                ["debug"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Debug"]
                },
                ["release"] = new TargetConfiguration
                {
                    Args = [.. defaultFlags, "--configuration", "Release"]
                }
            },
            DependsOn = [buildReleaseTarget],
            Cache = true,
            Inputs =
            [
                "default",
                $"^{productionInput}",
                new { workingDirectory = "absolute" },
                new
                {
                    dependentTasksOutputFiles = GetPublishDependencyOutputsGlob(
                        properties, projectDirectory, workspaceRoot, intermediatePath)
                },
                new { env = "NUGET_PACKAGES" },
                .. directoryBuildInputs
            ],
            Outputs = new[] { publishDir }
                .Where(p => p is not null)
                .Concat(GetIntermediateOutputs(intermediatePath))
                .ToArray()!,
            Metadata = new TargetMetadata
            {
                Description = "Publish the .NET application",
                Technologies = ProjectUtilities.GetTechnologies(fileName)
            }
        };
    }

    /// <summary>
    /// The build outputs publish hashes. Build's bin and obj outputs also cover
    /// the files publish writes, so a publish on a warm tree would otherwise hash
    /// its own previous run. Excludes the publish directory at every
    /// configuration and the publish file list MSBuild keeps in obj.
    /// Paths are workspace-relative: Nx does not resolve tokens in this glob.
    /// </summary>
    private static string GetPublishDependencyOutputsGlob(
        EvaluatedProperties properties,
        string projectDirectory,
        string workspaceRoot,
        string? intermediatePath)
    {
        var publishDir = GetPublishDir(
            properties.WithConfiguration("*"), properties.Configuration, projectDirectory, workspaceRoot);
        var cleanFile = string.IsNullOrEmpty(properties.PublishCleanFile)
            ? "PublishOutputs.*.txt"
            : properties.PublishCleanFile;

        var dir = ToWorkspaceRelative(publishDir, projectDirectory, workspaceRoot);
        var obj = ToWorkspaceRelative(intermediatePath, projectDirectory, workspaceRoot);

        // A path with glob syntax of its own cannot be embedded in the pattern.
        var excluded = new[]
            {
                dir is not null && dir.Split('/').All(s => s == "*" || !HasGlobSyntax(s))
                    ? $"{dir}/**"
                    : null,
                obj is not null && !HasGlobSyntax(obj)
                    && (cleanFile == "PublishOutputs.*.txt" || !HasGlobSyntax(cleanFile))
                    ? $"{obj}/**/{cleanFile}"
                    : null,
            }
            .OfType<string>()
            .ToArray();

        return excluded.Length switch
        {
            0 => "**/*",
            1 => $"!{excluded[0]}",
            _ => $"!{{{string.Join(',', excluded)}}}",
        };
    }

    /// <summary>
    /// Rewrites a <c>{workspaceRoot}</c>/<c>{projectRoot}</c> path as
    /// workspace-relative. Returns <c>null</c> for any other path.
    /// </summary>
    private static string? ToWorkspaceRelative(string? path, string projectDirectory, string workspaceRoot)
    {
        const string workspaceToken = "{workspaceRoot}";
        const string projectToken = "{projectRoot}";

        string? relative = null;
        if (path?.StartsWith(workspaceToken) == true)
        {
            relative = path[workspaceToken.Length..].TrimStart('/');
        }
        else if (path?.StartsWith(projectToken) == true)
        {
            var projectRoot = Path.GetRelativePath(Path.GetFullPath(workspaceRoot), Path.GetFullPath(projectDirectory))
                .Replace('\\', '/');
            var rest = path[projectToken.Length..].TrimStart('/');
            relative = projectRoot == "." ? rest : $"{projectRoot}/{rest}".TrimEnd('/');
        }

        return string.IsNullOrEmpty(relative) ? null : relative;
    }

    private static bool HasGlobSyntax(string value) =>
        value.IndexOfAny(['*', '?', '[', ']', '{', '}', '(', ')', ',', '!']) >= 0;
}
