using System.Diagnostics.CodeAnalysis;
using MsbuildAnalyzer.Models;

namespace MsbuildAnalyzer.Utilities;

public static class RidVariantUtilities
{
    public static List<string> ResolveRuntimeIdentifiers(EvaluatedProperties properties)
    {
        var plural = Split(properties.Get("RuntimeIdentifiers"));
        return plural.Count > 0 ? plural : Split(properties.Get("RuntimeIdentifier"));
    }

    private static List<string> Split(string? value) =>
        (value ?? string.Empty)
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();

    public static bool TryGetOutputPaths(
        EvaluatedProperties properties,
        string framework,
        string runtimeIdentifier,
        [NotNullWhen(true)] out string? outputPath,
        [NotNullWhen(true)] out string? intermediatePath,
        out string reason)
    {
        outputPath = null;
        intermediatePath = null;
        if (properties.UsesArtifactsOutput)
        {
            reason = "UseArtifactsOutput is enabled";
            return false;
        }

        foreach (var property in new[] { "AppendTargetFrameworkToOutputPath", "AppendRuntimeIdentifierToOutputPath" })
        {
            if (string.Equals(properties.Get(property), "false", StringComparison.OrdinalIgnoreCase))
            {
                reason = $"{property} is false";
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(properties.OutDir)
            && !string.Equals(Normalize(properties.OutDir), Normalize(properties.OutputPath ?? ""), StringComparison.OrdinalIgnoreCase))
        {
            reason = "OutDir does not match the evaluated OutputPath";
            return false;
        }

        if (!IsPublishDirDerivable(properties.PublishDir, properties.OutputPath))
        {
            reason = "PublishDir does not use the default <OutputPath>/publish layout";
            return false;
        }

        outputPath = WithRuntimeIdentifier(properties.OutputPath, properties, framework, runtimeIdentifier);
        intermediatePath = WithRuntimeIdentifier(properties.IntermediateOutputPath, properties, framework, runtimeIdentifier);
        if (outputPath is null || intermediatePath is null)
        {
            outputPath = null;
            intermediatePath = null;
            reason = "the evaluated output paths do not end in <Configuration>/<TargetFramework>[/<RuntimeIdentifier>]";
            return false;
        }

        reason = string.Empty;
        return true;
    }

    private static bool IsPublishDirDerivable(string? publishDir, string? outputPath)
    {
        if (string.IsNullOrWhiteSpace(publishDir))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(outputPath))
        {
            return false;
        }

        return string.Equals(
            Normalize(publishDir),
            $"{Normalize(outputPath)}/publish",
            StringComparison.OrdinalIgnoreCase);
    }

    private static string? WithRuntimeIdentifier(
        string? path,
        EvaluatedProperties properties,
        string framework,
        string runtimeIdentifier)
    {
        if (string.IsNullOrWhiteSpace(path) || string.IsNullOrWhiteSpace(properties.Configuration))
        {
            return null;
        }

        var segments = Normalize(path).Split('/');
        var innerRid = properties.Get("RuntimeIdentifier");
        var frameworkIndex = segments.Length - 1;
        if (!string.IsNullOrEmpty(innerRid))
        {
            if (!segments[^1].Equals(innerRid, StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            frameworkIndex--;
        }

        if (frameworkIndex < 1
            || !segments[frameworkIndex].Equals(framework, StringComparison.OrdinalIgnoreCase)
            || !segments[frameworkIndex - 1].Equals(properties.Configuration, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return $"{string.Join('/', segments[..(frameworkIndex + 1)])}/{runtimeIdentifier}";
    }

    private static string Normalize(string path) => path.Replace('\\', '/').TrimEnd('/');
}
