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
    public void CombinesTagsFromEveryTargetFramework()
    {
        WriteProject(
            """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFrameworks>net8.0;net9.0</TargetFrameworks>
              </PropertyGroup>
              <ItemGroup>
                <NxTag Include="scope:shared;owner:devflow" />
                <NxTag Include="tfm:net8.0" Condition="'$(TargetFramework)' == 'net8.0'" />
                <NxTag Include="tfm:net9.0" Condition="'$(TargetFramework)' == 'net9.0'" />
                <NxTag Include="outer:only" Condition="'$(TargetFramework)' == ''" />
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
            new[] { "owner:devflow", "requires:emulator", "scope:shared", "tfm:net8.0", "tfm:net9.0" },
            tags);
        Assert.DoesNotContain("Warning:", error);
    }

    [Theory]
    [InlineData("")]
    [InlineData("<NxTag Include=\" ; ; \" />")]
    public void OmitsTagsWhenNoTagsAreAuthored(string tagsItem)
    {
        WriteProject($"""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
              </PropertyGroup>
              <ItemGroup>
                {tagsItem}
              </ItemGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var node = result.RootElement.GetProperty("nodesByFile").GetProperty("Tagged.csproj");

        Assert.False(node.TryGetProperty("tags", out _));
        Assert.DoesNotContain("Warning:", error);
    }

    [Fact]
    public void KeepsTagsWhenAllTagsAreFrameworkSpecific()
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

        Assert.Equal(
            new[] { "requires:emulator" },
            node.GetProperty("tags").EnumerateArray().Select(tag => tag.GetString()).ToArray());
        Assert.DoesNotContain("Warning:", error);
    }

    [Fact]
    public void KeepsTagsConditionedOnTargetFrameworkPlatform()
    {
        WriteProject("""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFrameworks>net8.0;net8.0-windows</TargetFrameworks>
              </PropertyGroup>
              <ItemGroup Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'windows'">
                <NxTag Include="platform:windows" />
              </ItemGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var tags = result.RootElement.GetProperty("nodesByFile").GetProperty("Tagged.csproj")
            .GetProperty("tags").EnumerateArray().Select(tag => tag.GetString()).ToArray();

        Assert.Equal(new[] { "platform:windows" }, tags);
        Assert.DoesNotContain("Warning:", error);
    }

    [Theory]
    [InlineData("<TargetFramework>net8.0</TargetFramework>")]
    [InlineData("<TargetFrameworks>net8.0;net9.0</TargetFrameworks>")]
    public void MergesImportedAndProjectItemsWithoutWarning(string targetFramework)
    {
        WriteProject($"""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                {targetFramework}
              </PropertyGroup>
              <ItemGroup>
                <NxTag Include=" scope:client ;scope:client;;" />
                <NxTag Include="requires:emulator" Condition="'$(TargetFramework)' != ''" />
              </ItemGroup>
            </Project>
            """);
        File.WriteAllText(
            Path.Combine(_workspaceRoot, "Directory.Build.props"),
            """
            <Project>
              <ItemGroup>
                <NxTag Include="scope:client;owner:devflow" />
              </ItemGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var tags = result.RootElement.GetProperty("nodesByFile").GetProperty("Tagged.csproj")
            .GetProperty("tags").EnumerateArray().Select(tag => tag.GetString()).ToArray();

        Assert.Equal(new[] { "owner:devflow", "requires:emulator", "scope:client" }, tags);
        Assert.DoesNotContain("Warning:", error);
    }

    [Fact]
    public void AppliesNativeItemRemovalToImportedTags()
    {
        WriteProject("""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
              </PropertyGroup>
              <ItemGroup>
                <NxTag Remove="scope:shared" />
                <NxTag Include="scope:client" />
              </ItemGroup>
            </Project>
            """);
        File.WriteAllText(
            Path.Combine(_workspaceRoot, "Directory.Build.props"),
            """
            <Project>
              <ItemGroup>
                <NxTag Include="scope:shared;owner:devflow" />
              </ItemGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var tags = result.RootElement.GetProperty("nodesByFile").GetProperty("Tagged.csproj")
            .GetProperty("tags").EnumerateArray().Select(tag => tag.GetString()).ToArray();

        Assert.Equal(new[] { "owner:devflow", "scope:client" }, tags);
        Assert.DoesNotContain("Warning:", error);
    }

    [Fact]
    public void DoesNotReadTagsDirectlyFromProperties()
    {
        WriteProject("""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                <NxTags>scope:property</NxTags>
              </PropertyGroup>
              <ItemGroup>
                <NxTag Include="scope:item" />
              </ItemGroup>
            </Project>
            """);

        using var result = RunAnalyzer(_workspaceRoot, out var error, "Tagged.csproj");
        var tags = result.RootElement.GetProperty("nodesByFile").GetProperty("Tagged.csproj")
            .GetProperty("tags").EnumerateArray().Select(tag => tag.GetString()).ToArray();

        Assert.Equal(new[] { "scope:item" }, tags);
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
