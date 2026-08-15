using System.Text.Json;
using MsbuildAnalyzer.Models;
using Xunit;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// End-to-end coverage for the structured <c>metadata.dotnet</c> model
/// (see https://github.com/nrwl/nx/discussions/36676), driving the real
/// <see cref="Analyzer.AnalyzeWorkspace"/> entry point — including MSBuild property collection,
/// per-target-framework grouping, and public JSON serialization — against an actual temporary
/// multi-targeted project on disk. This complements <see cref="DotnetMetadataBuilderTests"/>,
/// which drives the pure builder directly with plain dictionaries and does not exercise MSBuild
/// evaluation, <c>Analyzer.CollectProperties</c>'s allow-list, or serialization at all.
/// </summary>
public class DotnetMetadataAnalyzerEndToEndTests : IDisposable
{
    private readonly string _workspaceRoot;

    public DotnetMetadataAnalyzerEndToEndTests()
    {
        _workspaceRoot = Path.Combine(Path.GetTempPath(), "nx-dotnet-metadata-e2e-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_workspaceRoot);
    }

    public void Dispose()
    {
        try
        {
            Directory.Delete(_workspaceRoot, recursive: true);
        }
        catch (IOException)
        {
            // Best-effort cleanup; a stray locked file shouldn't fail the test run.
        }
    }

    // A multi-targeted project where the Test and Executable capabilities genuinely differ per
    // framework, evaluated for real (no restore is performed, matching how the analyzer's own
    // ProjectGraph construction works):
    //   - net8.0 only: references Microsoft.NET.Test.Sdk via a *conditional* PackageReference,
    //     scoped to this TargetFramework via the ItemGroup Condition -> Test capability, detected
    //     from the raw evaluated package reference items (not IsTestProject, which would require
    //     the package's own props to be restored and imported).
    //   - net9.0 only: an explicit OutputType=Exe -> Executable capability.
    // PackageId is declared once, unconditionally, so it's expected to be unambiguous and
    // surface at the project level as well as on every per-framework entry.
    private const string ProjectXml = """
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFrameworks>net8.0;net9.0</TargetFrameworks>
            <PackageId>Sample.MultiTarget.Package</PackageId>
          </PropertyGroup>
          <PropertyGroup Condition="'$(TargetFramework)' == 'net9.0'">
            <OutputType>Exe</OutputType>
          </PropertyGroup>
          <ItemGroup Condition="'$(TargetFramework)' == 'net8.0'">
            <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
          </ItemGroup>
        </Project>
        """;

    private string WriteSampleProject()
    {
        var projectFile = Path.Combine(_workspaceRoot, "Sample.csproj");
        File.WriteAllText(projectFile, ProjectXml);
        return "Sample.csproj";
    }

    [Fact]
    public void AnalyzeWorkspace_RealMultiTargetProject_ProducesExpectedDotnetMetadata()
    {
        var relativeProjectFile = WriteSampleProject();

        var result = Analyzer.AnalyzeWorkspace(
            new List<string> { relativeProjectFile },
            new List<string>(),
            _workspaceRoot,
            new PluginOptions());

        var node = Assert.Single(result.NodesByFile).Value;
        var dotnet = node.Metadata?.Dotnet;
        Assert.NotNull(dotnet);

        // Project-level PackageId is unambiguous (declared unconditionally) and resolved from
        // real MSBuild evaluation, not a test-supplied dictionary.
        Assert.Equal("Sample.MultiTarget.Package", dotnet!.PackageId);

        // Project-level capabilities are the OR across both real evaluated target frameworks:
        // net8.0 contributes Test, net9.0 contributes Executable.
        Assert.True(dotnet.Capabilities.Test, "net8.0 evaluates a Microsoft.NET.Test.Sdk PackageReference.");
        Assert.True(dotnet.Capabilities.Executable, "net9.0 evaluates OutputType=Exe.");
        Assert.True(dotnet.Capabilities.Publishable);
        Assert.True(dotnet.Capabilities.Packable, "IsPackable defaults to true when unevaluated.");
        Assert.False(dotnet.Capabilities.Tool);

        Assert.Equal(2, dotnet.TargetFrameworks.Count);
        Assert.Equal(new[] { "net8.0", "net9.0" }, dotnet.TargetFrameworks.Select(f => f.TargetFramework));

        var net8 = dotnet.TargetFrameworks.Single(f => f.TargetFramework == "net8.0");
        Assert.True(net8.Capabilities.Test, "The conditional PackageReference is scoped to net8.0 only.");
        Assert.False(net8.Capabilities.Executable, "net8.0 never sets OutputType.");
        Assert.True(net8.Capabilities.Publishable, "The evaluated IsPublishable is true independent of OutputType here.");
        Assert.True(net8.Capabilities.Packable);
        Assert.Equal("Sample.MultiTarget.Package", net8.PackageId);
        Assert.Equal(".NETCoreApp", net8.TargetFrameworkIdentifier);

        var net9 = dotnet.TargetFrameworks.Single(f => f.TargetFramework == "net9.0");
        Assert.False(net9.Capabilities.Test, "The conditional test PackageReference does not apply to net9.0.");
        Assert.True(net9.Capabilities.Executable, "net9.0 declares its own OutputType=Exe.");
        Assert.True(net9.Capabilities.Publishable);
        Assert.True(net9.Capabilities.Packable);
        Assert.Equal("Sample.MultiTarget.Package", net9.PackageId);
    }

    [Fact]
    public void AnalyzeWorkspace_RealMultiTargetProject_SerializesToExpectedPublicJsonShape()
    {
        var relativeProjectFile = WriteSampleProject();

        var result = Analyzer.AnalyzeWorkspace(
            new List<string> { relativeProjectFile },
            new List<string>(),
            _workspaceRoot,
            new PluginOptions());

        // Same serializer configuration Program.cs uses for the analyzer's actual stdout
        // contract: camelCase property names, nulls omitted.
        var jsonOptions = new JsonSerializerOptions
        {
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        var json = JsonSerializer.Serialize(result, jsonOptions);
        using var document = JsonDocument.Parse(json);

        var nodesByFile = document.RootElement.GetProperty("nodesByFile");
        var node = nodesByFile.GetProperty(relativeProjectFile);
        var dotnet = node.GetProperty("metadata").GetProperty("dotnet");

        Assert.Equal("Sample.MultiTarget.Package", dotnet.GetProperty("packageId").GetString());

        var capabilities = dotnet.GetProperty("capabilities");
        Assert.True(capabilities.GetProperty("test").GetBoolean());
        Assert.True(capabilities.GetProperty("executable").GetBoolean());
        Assert.True(capabilities.GetProperty("packable").GetBoolean());
        Assert.True(capabilities.GetProperty("publishable").GetBoolean());
        Assert.False(capabilities.GetProperty("tool").GetBoolean());

        var targetFrameworks = dotnet.GetProperty("targetFrameworks");
        Assert.Equal(2, targetFrameworks.GetArrayLength());
        Assert.Equal("net8.0", targetFrameworks[0].GetProperty("targetFramework").GetString());
        Assert.Equal("net9.0", targetFrameworks[1].GetProperty("targetFramework").GetString());
        Assert.Equal("Sample.MultiTarget.Package", targetFrameworks[0].GetProperty("packageId").GetString());
    }
}
