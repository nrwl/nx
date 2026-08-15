using System.Diagnostics;
using System.Text.Json;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Analyzer-level integration tests that run the real analyzer executable
/// against a temporary multi-targeted project and assert on the public JSON it
/// emits. Unlike the <c>TargetBuilder</c> unit tests, these exercise the full
/// path — MSBuild registration, <c>ProjectGraph</c> inner-build enumeration in
/// <see cref="Analyzer"/>, and serialization — proving the framework variants
/// actually surface (and don't, when disabled) through the contract the Nx
/// plugin consumes.
/// </summary>
public class AnalyzerIntegrationTests : IDisposable
{
    private readonly string _workspace;

    public AnalyzerIntegrationTests()
    {
        _workspace = Path.Combine(Path.GetTempPath(), "nx-dotnet-it-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(_workspace, "App"));
        File.WriteAllText(
            Path.Combine(_workspace, "App", "App.csproj"),
            """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <OutputType>Exe</OutputType>
                <TargetFrameworks>net8.0;net9.0</TargetFrameworks>
              </PropertyGroup>
            </Project>
            """);
        File.WriteAllText(
            Path.Combine(_workspace, "nx.json"),
            """{ "namedInputs": { "default": ["{projectRoot}/**/*"], "production": ["default"] } }""");
    }

    public void Dispose()
    {
        try { Directory.Delete(_workspace, recursive: true); } catch { /* best effort */ }
    }

    private static string AnalyzerDll =>
        Path.Combine(AppContext.BaseDirectory, "MsbuildAnalyzer.dll");

    private JsonElement RunAnalyzer(string? optionsJson)
    {
        Assert.True(File.Exists(AnalyzerDll), $"Analyzer not found at {AnalyzerDll}");

        var psi = new ProcessStartInfo("dotnet")
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            WorkingDirectory = _workspace,
        };
        psi.ArgumentList.Add(AnalyzerDll);
        psi.ArgumentList.Add(_workspace);
        if (optionsJson is not null)
        {
            psi.ArgumentList.Add(optionsJson);
        }

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

    private static string[] TargetNames(JsonElement targets) =>
        targets.EnumerateObject().Select(p => p.Name).ToArray();

    [Fact]
    public void Enabled_RealMultiTargetProject_EmitsBuildVariants()
    {
        var targets = RunAnalyzer("""{"frameworkVariants":true}""");
        var names = TargetNames(targets);

        Assert.Contains("build-net8.0", names);
        Assert.Contains("build-net9.0", names);
        Assert.Contains("build-net8.0-release", names);
        Assert.Contains("build-net9.0-release", names);

        // Unqualified targets are preserved.
        Assert.Contains("build", names);
        Assert.Contains("build:release", names);
    }

    [Fact]
    public void Enabled_Variant_HasFrameworkArgsSelfContainedDepsAndScopedOutputs()
    {
        var targets = RunAnalyzer("""{"frameworkVariants":true}""");
        var variant = targets.GetProperty("build-net8.0");

        var args = variant.GetProperty("options").GetProperty("args")
            .EnumerateArray().Select(a => a.GetString()).ToArray();
        Assert.Contains("--framework", args);
        Assert.Contains("net8.0", args);
        Assert.DoesNotContain("--no-dependencies", args);

        // Self-contained: no dependency on the aggregate build.
        var dependsOn = variant.TryGetProperty("dependsOn", out var d)
            ? d.EnumerateArray().Select(x => x.GetString()).ToArray()
            : Array.Empty<string>();
        Assert.DoesNotContain("^build", dependsOn);

        // Outputs are scoped to this framework and no other.
        var outputs = variant.GetProperty("outputs")
            .EnumerateArray().Select(o => o.GetString()!).ToArray();
        Assert.NotEmpty(outputs);
        Assert.All(outputs, o => Assert.Contains("net8.0", o));
        Assert.DoesNotContain(outputs, o => o.Contains("net9.0"));

        Assert.Equal(
            "net8.0",
            variant.GetProperty("metadata").GetProperty("targetFramework").GetString());
    }

    [Fact]
    public void Disabled_RealMultiTargetProject_EmitsNoVariants()
    {
        var targets = RunAnalyzer(optionsJson: null);
        var names = TargetNames(targets);

        Assert.DoesNotContain(names, n => n.StartsWith("build-net"));
        Assert.Contains("build", names);
    }
}
