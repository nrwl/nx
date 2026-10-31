using MsbuildAnalyzer.Models;
using MsbuildAnalyzer.Utilities;
using Xunit;

namespace MsbuildAnalyzer.Tests;

public class RidVariantUtilitiesTests
{
    private static Dictionary<string, string> Properties(string configuration = "Debug") => new()
    {
        ["Configuration"] = configuration,
        ["OutputPath"] = $"bin/{configuration}/net10.0/",
        ["IntermediateOutputPath"] = $"obj/{configuration}/net10.0/",
        ["PublishDir"] = $"bin/{configuration}/net10.0/publish/",
    };

    [Theory]
    [InlineData("ios-arm64", "iossimulator-arm64;iossimulator-x64", "iossimulator-arm64,iossimulator-x64")]
    [InlineData("osx-arm64", " linux-x64 ; win-x64;linux-x64;; ", "linux-x64,win-x64")]
    [InlineData("osx-arm64", "", "osx-arm64")]
    [InlineData("osx-arm64", " ; ; ", "osx-arm64")]
    [InlineData("", "", "")]
    public void ResolveRuntimeIdentifiers_PluralIsAuthoritative(string singular, string plural, string expected)
    {
        EvaluatedProperties properties = new Dictionary<string, string>
        {
            ["RuntimeIdentifier"] = singular,
            ["RuntimeIdentifiers"] = plural,
        };

        Assert.Equal(expected, string.Join(',', RidVariantUtilities.ResolveRuntimeIdentifiers(properties)));
    }

    [Theory]
    [InlineData("Debug")]
    [InlineData("Release")]
    public void Outputs_AppendRidWithoutChangingTheEvaluatedConfiguration(string configuration)
    {
        Assert.True(RidVariantUtilities.TryGetOutputPaths(
            Properties(configuration), "net10.0", "linux-x64", out var bin, out var obj, out var reason), reason);

        Assert.Equal($"bin/{configuration}/net10.0/linux-x64", bin);
        Assert.Equal($"obj/{configuration}/net10.0/linux-x64", obj);
    }

    [Fact]
    public void Outputs_ReplaceImplicitRidInsteadOfNesting()
    {
        var properties = Properties();
        properties["RuntimeIdentifier"] = "osx-arm64";
        properties["OutputPath"] += "osx-arm64/";
        properties["IntermediateOutputPath"] += "osx-arm64/";
        properties["PublishDir"] = properties["OutputPath"] + "publish/";

        Assert.True(RidVariantUtilities.TryGetOutputPaths(
            properties, "net10.0", "linux-x64", out var bin, out var obj, out var reason), reason);

        Assert.Equal("bin/Debug/net10.0/linux-x64", bin);
        Assert.Equal("obj/Debug/net10.0/linux-x64", obj);
    }

    [Fact]
    public void Outputs_PreserveUnrelatedConfigurationDirectoriesAndNormalizeSeparators()
    {
        var properties = Properties("Release");
        properties["OutputPath"] = @"..\Debug\Release\bin\Release\net10.0\";
        properties["IntermediateOutputPath"] = @"..\Debug\Release\obj\Release\net10.0\";
        properties["PublishDir"] = @"..\Debug\Release\bin\Release\net10.0\publish\";

        Assert.True(RidVariantUtilities.TryGetOutputPaths(
            properties, "net10.0", "linux-x64", out var bin, out var obj, out var reason), reason);

        Assert.Equal("../Debug/Release/bin/Release/net10.0/linux-x64", bin);
        Assert.Equal("../Debug/Release/obj/Release/net10.0/linux-x64", obj);
    }

    [Theory]
    [InlineData("UseArtifactsOutput", "True")]
    [InlineData("AppendTargetFrameworkToOutputPath", "False")]
    [InlineData("AppendRuntimeIdentifierToOutputPath", "false")]
    [InlineData("PublishDir", "dist/publish/")]
    [InlineData("OutputPath", "bin/")]
    [InlineData("IntermediateOutputPath", "obj/fixed/")]
    [InlineData("OutDir", "custom/")]
    [InlineData("RuntimeIdentifier", "implicit-but-not-in-output")]
    [InlineData("Configuration", "Release")]
    public void Outputs_RejectUnsupportedLayoutsWithAReason(string name, string value)
    {
        var properties = Properties();
        properties[name] = value;

        Assert.False(RidVariantUtilities.TryGetOutputPaths(
            properties, "net10.0", "linux-x64", out var bin, out var obj, out var reason));

        Assert.Null(bin);
        Assert.Null(obj);
        Assert.NotEmpty(reason);
    }

    [Fact]
    public void Outputs_UnsetPublishDirUsesTheSdkDefault()
    {
        var properties = Properties();
        properties.Remove("PublishDir");

        Assert.True(RidVariantUtilities.TryGetOutputPaths(
            properties, "net10.0", "linux-x64", out _, out _, out var reason), reason);
    }
}
