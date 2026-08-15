using System.Diagnostics;
using System.Text.Json;
using Xunit;

namespace MsbuildAnalyzer.Tests;

public class NxTagsTests
{
    [Fact]
    public void EmitsOnlyTagsSharedByEveryTargetFramework()
    {
        var workspaceRoot = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
        Directory.CreateDirectory(workspaceRoot);
        var projectPath = Path.Combine(workspaceRoot, "Tagged.csproj");

        try
        {
            File.WriteAllText(
                projectPath,
                """
                <Project Sdk="Microsoft.NET.Sdk">
                  <PropertyGroup>
                    <TargetFrameworks>net8.0;net9.0</TargetFrameworks>
                    <NxTags>scope:shared;owner:devflow</NxTags>
                  </PropertyGroup>
                  <PropertyGroup Condition="'$(TargetFramework)' == 'net8.0'">
                    <NxTags>$(NxTags);tfm:net8.0</NxTags>
                  </PropertyGroup>
                  <ItemGroup>
                    <NxTag Include="tfm:net8.0" Condition="'$(TargetFramework)' == 'net8.0'" />
                    <NxTag Include="requires:emulator" />
                  </ItemGroup>
                </Project>
                """);

            using var result = RunAnalyzer(workspaceRoot, "Tagged.csproj");
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
        }
        finally
        {
            Directory.Delete(workspaceRoot, recursive: true);
        }
    }

    private static JsonDocument RunAnalyzer(
        string workspaceRoot,
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
        process.StandardInput.Write(string.Join(Environment.NewLine, projectFiles));
        process.StandardInput.Close();

        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        process.WaitForExit();

        Assert.True(process.ExitCode == 0, error);

        return JsonDocument.Parse(output);
    }
}
