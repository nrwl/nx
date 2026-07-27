using System.Text.Json;
using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Guards the JSON contract between the analyzer and the TypeScript plugin.
/// Pins the existing output shape while the serializer options move into
/// AnalyzerJson, so the tests exercise the same instances the analyzer uses
/// rather than a copy that can drift.
/// </summary>
public class SerializationTests
{
    /// <summary>
    /// The analyzer's own options, not a copy. A mirrored copy would stay green
    /// while the real behavior changed underneath it.
    /// </summary>
    private static readonly JsonSerializerOptions JsonOptions = AnalyzerJson.Output;

    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);

    [Fact]
    public void Target_ExistingShape_SerializesExactly()
    {
        // The full expected document, so an accidental property addition or a
        // naming-policy change fails loudly rather than drifting.
        var json = Serialize(new Target
        {
            Command = "dotnet test",
            Options = new TargetOptions { Cwd = "{projectRoot}", Args = ["--no-build", "--no-restore"] },
            DependsOn = ["build"],
            Cache = true,
            Outputs = ["{projectRoot}/TestResults"]
        });

        Assert.Equal(
            "{\"command\":\"dotnet test\"," +
            "\"options\":{\"cwd\":\"{projectRoot}\",\"args\":[\"--no-build\",\"--no-restore\"]}," +
            "\"dependsOn\":[\"build\"]," +
            "\"cache\":true," +
            "\"outputs\":[\"{projectRoot}/TestResults\"]}",
            json);
    }
}
