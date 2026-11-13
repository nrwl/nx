using System.Runtime.CompilerServices;
using Microsoft.Build.Locator;

namespace MsbuildAnalyzer.Tests;

/// <summary>
/// Registers the ambient .NET SDK's MSBuild assemblies for this test process, exactly once,
/// before anything in this assembly can reference an MSBuild type. Required for the small
/// number of tests (<see cref="DotnetMetadataAnalyzerEndToEndTests"/>) that invoke
/// <c>Analyzer.AnalyzeWorkspace</c> against a real temporary project rather than driving
/// <c>DotnetMetadataBuilder</c> directly with plain dictionaries — mirrors the registration
/// <c>Program.cs</c> performs for the analyzer executable itself.
/// </summary>
internal static class MSBuildTestRegistration
{
    [ModuleInitializer]
    public static void Register()
    {
        if (!MSBuildLocator.IsRegistered)
        {
            MSBuildLocator.RegisterDefaults();
        }
    }
}
