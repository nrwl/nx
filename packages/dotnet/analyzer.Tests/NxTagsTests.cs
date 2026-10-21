using System.Diagnostics;
using System.Text.Json;
using Xunit;

namespace MsbuildAnalyzer.Tests;

public class NxTagsTests : IDisposable
{
    private readonly string _workspaceRoot =
        Path.Combine(Path.GetTempPath(), "nx-dotnet-tags-" + Guid.NewGuid().ToString("n"));

    public void Dispose()
    {
        if (Directory.Exists(_workspaceRoot))
        {
            Directory.Delete(_workspaceRoot, recursive: true);
        }
        GC.SuppressFinalize(this);
    }

    private void WriteProject(string content)
    {
        Directory.CreateDirectory(_workspaceRoot);
        File.WriteAllText(Path.Combine(_workspaceRoot, "Tagged.csproj"), content);
    }

    [Fact]
    public void EmitsOnlyTagsSharedByEveryTargetFramework()
    {
        WriteProject(
            """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFrameworks>net8.0;net9.0</TargetFrameworks>
                <NxTags>scope:shared;owner:devflow</NxTags>
              </PropertyGroup>
              <PropertyGroup Condition="'$(TargetFramework)' == 'net8.0'">
                <NxTags>$(NxTags);property:net8.0</NxTags>
              </PropertyGroup>
              <ItemGroup>
                <NxTag Include="tfm:net8.0" Condition="'$(TargetFramework)' == 'net8.0'" />
                <NxTag Include="requires:emulator" />
              </ItemGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var tags = result
            .RootElement
            .GetProperty("nodesByFile")
            .GetProperty("Tagged.csproj")
            .GetProperty("tags")
            .EnumerateArray()
            .Select(tag => tag.GetString())
            .ToArray();

        Assert.Equal(
            new[] { "owner:devflow", "requires:emulator", "scope:shared" },
            tags);
        Assert.Contains(Path.Combine(_workspaceRoot, "Tagged.csproj"), error);
        Assert.Contains("NxTags/NxTag values [property:net8.0, tfm:net8.0]", error);
        Assert.Contains("do not apply to every target framework", error);
        Assert.Single(error.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries));
    }

    [Theory]
    [InlineData("")]
    [InlineData("<NxTags> ; ; </NxTags>")]
    public void OmitsTagsWhenNoTagsAreAuthored(string tagsProperty)
    {
        WriteProject($"""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                {tagsProperty}
              </PropertyGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var node = result.RootElement.GetProperty("nodesByFile").GetProperty("Tagged.csproj");

        Assert.False(node.TryGetProperty("tags", out _));
        Assert.DoesNotContain("Warning:", error);
    }

    [Fact]
    public void WarnsAndOmitsTagsWhenAllTagsAreFrameworkSpecific()
    {
        WriteProject("""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFrameworks>net8.0;net9.0</TargetFrameworks>
              </PropertyGroup>
              <ItemGroup>
                <NxTag Include="requires:emulator" Condition="'$(TargetFramework)' == 'net8.0'" />
              </ItemGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var node = result.RootElement.GetProperty("nodesByFile").GetProperty("Tagged.csproj");

        Assert.False(node.TryGetProperty("tags", out _));
        Assert.Contains("NxTags/NxTag values [requires:emulator]", error);
        Assert.Contains("Define shared tags without a target-framework condition.", error);
    }

    [Theory]
    [InlineData("<TargetFramework>net8.0</TargetFramework>")]
    [InlineData("<TargetFrameworks>net8.0;net9.0</TargetFrameworks>")]
    public void PreservesImportedAndLayeredTagsWithoutWarning(string targetFramework)
    {
        WriteProject($"""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                {targetFramework}
                <NxTags>$(NxTags); scope:client ;scope:client;;</NxTags>
              </PropertyGroup>
              <ItemGroup>
                <NxTag Include="requires:emulator" Condition="'$(TargetFramework)' != ''" />
              </ItemGroup>
            </Project>
            """);
        File.WriteAllText(
            Path.Combine(_workspaceRoot, "Directory.Build.props"),
            """
            <Project>
              <PropertyGroup>
                <NxTags>owner:devflow</NxTags>
              </PropertyGroup>
              <ItemGroup>
                <NxTag Include="scope:client" />
              </ItemGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var tags = result.RootElement.GetProperty("nodesByFile").GetProperty("Tagged.csproj")
            .GetProperty("tags").EnumerateArray().Select(tag => tag.GetString()).ToArray();

        Assert.Equal(new[] { "owner:devflow", "requires:emulator", "scope:client" }, tags);
        Assert.DoesNotContain("Warning:", error);
    }

    private static JsonDocument RunAnalyzer(
        string workspaceRoot,
        out string error,
        params string[] projectFiles)
    {
        var analyzerPath = Path.Combine(AppContext.BaseDirectory, "MsbuildAnalyzer.dll");
        var startInfo = new ProcessStartInfo("dotnet")
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        startInfo.ArgumentList.Add(analyzerPath);
        startInfo.ArgumentList.Add(workspaceRoot);

        using var process = Process.Start(startInfo)!;
        process.StandardInput.WriteLine(string.Empty);
        process.StandardInput.Write(string.Join(Environment.NewLine, projectFiles));
        process.StandardInput.Close();

        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        Assert.True(process.WaitForExit(milliseconds: 180_000), "Analyzer timed out");
        var output = outputTask.GetAwaiter().GetResult();
        error = errorTask.GetAwaiter().GetResult();

        Assert.True(process.ExitCode == 0, error);

        return JsonDocument.Parse(output);
    }
}
