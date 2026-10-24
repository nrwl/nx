using System.Diagnostics;
using System.Text.Json;
using Xunit;

namespace MsbuildAnalyzer.Tests;

public class RidAnalyzerIntegrationTests : IDisposable
{
    private readonly string workspace = Path.Combine(
        Path.GetTempPath(), "nx-dotnet-rid-" + Guid.NewGuid().ToString("n"));

    public void Dispose()
    {
        if (Directory.Exists(workspace))
        {
            Directory.Delete(workspace, recursive: true);
        }
        GC.SuppressFinalize(this);
    }

    private (JsonElement Project, string Warnings) Analyze(
        string properties = "",
        string options = "{}",
        string frameworks = "<TargetFrameworks>net8.0;netstandard2.1</TargetFrameworks>",
        string items = "")
    {
        Directory.CreateDirectory(Path.Combine(workspace, "App"));
        File.WriteAllText(Path.Combine(workspace, "App", "App.csproj"), $"""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                {frameworks}
                <OutputType>Exe</OutputType>
                <RuntimeIdentifiers>linux-x64;win-x64</RuntimeIdentifiers>
                {properties}
              </PropertyGroup>
              {items}
            </Project>
            """);
        File.WriteAllText(Path.Combine(workspace, "nx.json"), "{}");
        var start = new ProcessStartInfo("dotnet")
        {
            ArgumentList = { Path.Combine(AppContext.BaseDirectory, "MsbuildAnalyzer.dll"), workspace },
            WorkingDirectory = workspace,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        using var process = Process.Start(start)!;
        process.StandardInput.WriteLine(options);
        process.StandardInput.WriteLine("App/App.csproj");
        process.StandardInput.Close();
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        Assert.True(process.WaitForExit(180_000), "Analyzer timed out");
        var warnings = stderr.GetAwaiter().GetResult();
        Assert.True(process.ExitCode == 0, $"Analyzer failed: {warnings}");
        using var document = JsonDocument.Parse(stdout.GetAwaiter().GetResult());
        return (document.RootElement.GetProperty("nodesByFile").GetProperty("App/App.csproj").Clone(), warnings);
    }

    private static string[] Args(JsonElement target, string? configuration = null) =>
        (configuration is null
            ? target.GetProperty("options")
            : target.GetProperty("configurations").GetProperty(configuration))
        .GetProperty("args").EnumerateArray().Select(value => value.GetString()!).ToArray();

    [Fact]
    public void DefaultOn_EmitsColonTargetsAndAConfigurationMatchedPublishChain()
    {
        var (project, warnings) = Analyze();
        var targets = project.GetProperty("targets");
        var build = targets.GetProperty("build:net8.0:linux-x64");
        var publish = targets.GetProperty("publish:net8.0:linux-x64");

        Assert.DoesNotContain("skipping RID variants", warnings);
        Assert.Equal("release", build.GetProperty("defaultConfiguration").GetString());
        Assert.Equal("release", publish.GetProperty("defaultConfiguration").GetString());
        Assert.Contains("rmSync", publish.GetProperty("command").GetString());
        Assert.Equal(
            new[] { "build:net8.0:linux-x64" },
            publish.GetProperty("dependsOn").EnumerateArray().Select(value => value.GetString()));
        foreach (var configuration in new[] { "debug", "release" })
        {
            var expected = configuration == "debug" ? "Debug" : "Release";
            Assert.Equal(
                new[] { "--no-restore", "--framework", "net8.0", "--runtime", "linux-x64", "--configuration", expected },
                Args(build, configuration));
            Assert.Contains("--no-build", Args(publish, configuration));
            Assert.Contains(expected, Args(publish, configuration));
            Assert.Contains("linux-x64", Args(publish, configuration));
            Assert.Equal($"bin/{expected}/net8.0/linux-x64/publish",
                publish.GetProperty("configurations").GetProperty(configuration)
                    .GetProperty("env").GetProperty("NX_DOTNET_PUBLISH_DIRECTORY").GetString());
        }
        Assert.DoesNotContain("--no-dependencies", Args(build));
        Assert.False(build.TryGetProperty("dependsOn", out var buildDependencies)
            && buildDependencies.GetArrayLength() > 0);
        Assert.Equal("build", build.GetProperty("metadata").GetProperty("variantOf").GetString());
        Assert.Equal("publish", publish.GetProperty("metadata").GetProperty("variantOf").GetString());
        Assert.Equal("net8.0", publish.GetProperty("metadata").GetProperty("targetFramework").GetString());
        Assert.Equal("linux-x64", publish.GetProperty("metadata").GetProperty("runtimeIdentifier").GetString());
        Assert.DoesNotContain(targets.EnumerateObject(), target => target.Name.EndsWith("-release"));
        Assert.DoesNotContain(
            targets.GetProperty("build").GetProperty("dependsOn").EnumerateArray(),
            dependency => dependency.GetString()!.Contains("linux-x64"));
    }

    [Theory]
    [InlineData("""{"ridVariants":false}""")]
    [InlineData("""{"tfmVariants":false,"ridVariants":true}""")]
    public void ExplicitOptOut_SuppressesRidVariants(string options)
    {
        var (project, _) = Analyze(options: options);

        Assert.DoesNotContain(
            project.GetProperty("targets").EnumerateObject(),
            target => target.Name.Contains("linux-x64") || target.Name.Contains("win-x64"));
    }

    [Fact]
    public void SingleFramework_RemainsUnchanged()
    {
        var (project, _) = Analyze(frameworks: "<TargetFramework>net8.0</TargetFramework>");

        Assert.DoesNotContain(
            project.GetProperty("targets").EnumerateObject(),
            target => target.Name.Contains("net8.0"));
    }

    [Theory]
    [InlineData("Exe")]
    [InlineData("WinExe")]
    public void Executability_IsEvaluatedPerFrameworkWithTheSharedPredicate(string outputType)
    {
        var (project, _) = Analyze($"""
            <OutputType>Library</OutputType>
            <OutputType Condition="'$(TargetFramework)' == 'net8.0'">{outputType}</OutputType>
            """);
        var targets = project.GetProperty("targets");

        Assert.True(targets.TryGetProperty("publish:net8.0:linux-x64", out _));
        Assert.False(targets.TryGetProperty("publish:netstandard2.1:linux-x64", out _));
        Assert.False(targets.TryGetProperty("build:netstandard2.1:linux-x64", out _));
    }

    [Theory]
    [InlineData("<UseArtifactsOutput>true</UseArtifactsOutput>", "UseArtifactsOutput")]
    [InlineData("<AppendTargetFrameworkToOutputPath>false</AppendTargetFrameworkToOutputPath>", "AppendTargetFrameworkToOutputPath")]
    [InlineData("<AppendRuntimeIdentifierToOutputPath>false</AppendRuntimeIdentifierToOutputPath>", "AppendRuntimeIdentifierToOutputPath")]
    [InlineData("<PublishDir>dist/publish</PublishDir>", "PublishDir")]
    [InlineData("<OutputPath>dist/custom/</OutputPath>", "output paths")]
    [InlineData("<OutDir>dist/custom/</OutDir>", "OutDir")]
    [InlineData("<OpenApiDocumentsDirectory>api-spec</OpenApiDocumentsDirectory>", "OpenApiDocumentsDirectory")]
    [InlineData("<OpenApiDocumentsDirectory>bin/$(Configuration)/$(TargetFramework)/$(RuntimeIdentifier)/publish</OpenApiDocumentsDirectory>", "OpenApiDocumentsDirectory")]
    public void UnsupportedLayouts_WarnAndSkipRidTargets(string properties, string expectedWarning)
    {
        var (project, warnings) = Analyze(properties);

        Assert.DoesNotContain(
            project.GetProperty("targets").EnumerateObject(),
            target => target.Name.Contains("linux-x64") || target.Name.Contains("win-x64"));
        Assert.Contains(expectedWarning, warnings);
    }

    [Fact]
    public void PluralIdentifiers_ReplaceAnUnrelatedImplicitSingularInEveryOutput()
    {
        var (project, _) = Analyze("<RuntimeIdentifier>osx-arm64</RuntimeIdentifier>");
        var targets = project.GetProperty("targets");

        Assert.False(targets.TryGetProperty("build:net8.0:osx-arm64", out _));
        var target = targets.GetProperty("build:net8.0:linux-x64");
        foreach (var configuration in new[] { "debug", "release" })
        {
            var outputs = target.GetProperty("configurations").GetProperty(configuration)
                .GetProperty("nxOutputs").EnumerateObject().Select(output => output.Value.GetString()!).ToArray();
            Assert.Contains(outputs, output => output.Contains("/net8.0/linux-x64/"));
            Assert.DoesNotContain(outputs, output => output.Contains("osx-arm64"));
        }
    }

    [Theory]
    [InlineData("<PublishDir Condition=\"'$(RuntimeIdentifier)' == 'linux-x64'\">dist/publish</PublishDir>", "PublishDir")]
    [InlineData("<OutputPath Condition=\"'$(RuntimeIdentifier)' == 'linux-x64'\">dist/custom/</OutputPath>", "output paths")]
    public void RidConditionedLayouts_AreEvaluatedBeforeDeclaringOutputs(string properties, string expectedWarning)
    {
        var (project, warnings) = Analyze(properties);
        var targets = project.GetProperty("targets");

        Assert.False(targets.TryGetProperty("build:net8.0:linux-x64", out _));
        Assert.False(targets.TryGetProperty("publish:net8.0:linux-x64", out _));
        Assert.True(targets.TryGetProperty("build:net8.0:win-x64", out _));
        Assert.Contains(expectedWarning, warnings);
    }

    [Fact]
    public void Collision_DoesNotOverwriteABaseTargetOrCreateAPublishWithAnUnrelatedBuild()
    {
        var (project, warnings) = Analyze(options: """{"publishTargetName":"build:net8.0:linux-x64"}""");
        var targets = project.GetProperty("targets");
        var existing = targets.GetProperty("build:net8.0:linux-x64");

        Assert.Equal("dotnet publish", existing.GetProperty("command").GetString());
        Assert.False(existing.GetProperty("metadata").TryGetProperty("runtimeIdentifier", out _));
        Assert.False(targets.TryGetProperty("build:net8.0:linux-x64:net8.0:linux-x64", out _));
        Assert.Contains("already exists", warnings);
    }

    [Fact]
    public void RidConditionedLinkedItems_AreInputsOnlyOnTheirEvaluatedRuntime()
    {
        Directory.CreateDirectory(Path.Combine(workspace, "Shared"));
        File.WriteAllText(Path.Combine(workspace, "Shared", "Linux.cs"), "class Linux {}");
        File.WriteAllText(Path.Combine(workspace, "Shared", "Windows.cs"), "class Windows {}");
        var (project, _) = Analyze(items: """
            <ItemGroup Condition="'$(RuntimeIdentifier)' == 'linux-x64'">
              <Compile Include="../Shared/Linux.cs" />
            </ItemGroup>
            <ItemGroup Condition="'$(RuntimeIdentifier)' == 'win-x64'">
              <Compile Include="../Shared/Windows.cs" />
            </ItemGroup>
            """);
        var targets = project.GetProperty("targets");
        var linux = targets.GetProperty("build:net8.0:linux-x64").GetProperty("inputs")
            .EnumerateArray().Where(value => value.ValueKind == JsonValueKind.String).Select(value => value.GetString()).ToArray();
        var windows = targets.GetProperty("build:net8.0:win-x64").GetProperty("inputs")
            .EnumerateArray().Where(value => value.ValueKind == JsonValueKind.String).Select(value => value.GetString()).ToArray();

        Assert.Contains("{workspaceRoot}/Shared/Linux.cs", linux);
        Assert.DoesNotContain("{workspaceRoot}/Shared/Windows.cs", linux);
        Assert.Contains("{workspaceRoot}/Shared/Windows.cs", windows);
        Assert.DoesNotContain("{workspaceRoot}/Shared/Linux.cs", windows);
    }

    [Fact]
    public void ConfigurationDependentExecutability_WarnsAndSkipsRatherThanOfferingABrokenConfiguration()
    {
        var (project, warnings) = Analyze("""
            <OutputType Condition="'$(Configuration)' == 'Debug'">Library</OutputType>
            """);

        Assert.DoesNotContain(project.GetProperty("targets").EnumerateObject(),
            target => target.Name.Contains("linux-x64"));
        Assert.Contains("both Debug and Release", warnings);
    }
}
