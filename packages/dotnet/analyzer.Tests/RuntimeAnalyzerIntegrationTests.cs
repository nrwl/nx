using System.Diagnostics;
using System.Text.Json;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Analyzer-level integration test that runs the real analyzer executable
/// against a temporary multi-targeted executable declaring runtime identifiers
/// (standard output layout) and asserts the per-RID variants surface through
/// the public JSON — exercising Analyzer's inner-build enumeration, RID
/// collection, layout gating, and serialization end to end.
/// </summary>
public class RuntimeAnalyzerIntegrationTests : IDisposable
{
    private readonly string _workspace;

    public RuntimeAnalyzerIntegrationTests()
    {
        _workspace = Path.Combine(Path.GetTempPath(), "nx-dotnet-rid-it-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(_workspace, "App"));
        File.WriteAllText(
            Path.Combine(_workspace, "App", "App.csproj"),
            """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <OutputType>Exe</OutputType>
                <TargetFrameworks>net9.0;net10.0</TargetFrameworks>
                <RuntimeIdentifiers>linux-x64;win-x64</RuntimeIdentifiers>
              </PropertyGroup>
            </Project>
            """);
        File.WriteAllText(Path.Combine(_workspace, "nx.json"), "{}");
    }

    public void Dispose()
    {
        try { Directory.Delete(_workspace, recursive: true); } catch { /* best effort */ }
    }

    private JsonElement RunAnalyzer(string optionsJson)
    {
        var dll = Path.Combine(AppContext.BaseDirectory, "MsbuildAnalyzer.dll");
        Assert.True(File.Exists(dll), $"Analyzer not found at {dll}");

        var psi = new ProcessStartInfo("dotnet")
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            WorkingDirectory = _workspace,
        };
        psi.ArgumentList.Add(dll);
        psi.ArgumentList.Add(_workspace);
        psi.ArgumentList.Add(optionsJson);

        using var proc = Process.Start(psi)!;
        proc.StandardInput.WriteLine("App/App.csproj");
        proc.StandardInput.Close();

        var stdout = proc.StandardOutput.ReadToEnd();
        var stderr = proc.StandardError.ReadToEnd();
        Assert.True(proc.WaitForExit(180_000), "Analyzer timed out");
        Assert.True(proc.ExitCode == 0, $"Analyzer exited {proc.ExitCode}. stderr:\n{stderr}");

        using var doc = JsonDocument.Parse(stdout);
        return doc.RootElement
            .GetProperty("nodesByFile")
            .GetProperty("App/App.csproj")
            .GetProperty("targets")
            .Clone();
    }

    [Fact]
    public void FrameworkVariantsAlone_EmitsNoRuntimeVariants()
    {
        var targets = RunAnalyzer("""{"frameworkVariants":true}""");
        var names = targets.EnumerateObject().Select(p => p.Name).ToArray();

        // Framework build variants are present, but no RID variants without the
        // separate runtimeVariants opt-in.
        Assert.Contains("build-net10.0", names);
        Assert.DoesNotContain(names, n => n.Contains("win-x64") || n.Contains("linux-x64"));
    }

    [Fact]
    public void Enabled_RealRidProject_EmitsRuntimeVariantsWithScopedOutputs()
    {
        var targets = RunAnalyzer("""{"runtimeVariants":true}""");

        var publish = targets.GetProperty("publish-net10.0-win-x64");

        var args = publish.GetProperty("options").GetProperty("args")
            .EnumerateArray().Select(a => a.GetString()).ToArray();
        Assert.Contains("--runtime", args);
        Assert.Contains("win-x64", args);

        var dependsOn = publish.GetProperty("dependsOn")
            .EnumerateArray().Select(x => x.GetString()).ToArray();
        Assert.Contains("build-net10.0-win-x64-release", dependsOn);

        var outputs = targets.GetProperty("build-net10.0-win-x64-release")
            .GetProperty("outputs").EnumerateArray().Select(o => o.GetString()!).ToArray();
        Assert.Contains(outputs, o => o.Contains("Release/net10.0/win-x64"));

        var meta = publish.GetProperty("metadata");
        Assert.Equal("net10.0", meta.GetProperty("targetFramework").GetString());
        Assert.Equal("win-x64", meta.GetProperty("runtimeIdentifier").GetString());
    }
}
