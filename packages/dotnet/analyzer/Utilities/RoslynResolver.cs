using System.Runtime.Loader;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Loads Roslyn from the .NET SDK rather than shipping it.
/// </summary>
/// <remarks>
/// The arrangement the Microsoft.Build packages use: reference the API at
/// compile time, exclude the runtime assets, load the real assemblies from the
/// SDK on first use. MSBuildLocator has no Roslyn equivalent, but it hands back
/// the SDK directory and <c>Roslyn/bincore</c> sits directly under it.
/// </remarks>
public static class RoslynResolver
{
    private static string? _bincore;

    /// <summary>
    /// Points assembly resolution at the SDK's Roslyn.
    /// </summary>
    /// <returns>
    /// False when the SDK has no <c>Roslyn/bincore</c>, in which case test
    /// discovery is unavailable and callers must not attempt to split.
    /// </returns>
    public static bool TryRegister(string msbuildPath)
    {
        var bincore = Path.Combine(msbuildPath, "Roslyn", "bincore");
        if (!File.Exists(Path.Combine(bincore, "Microsoft.CodeAnalysis.CSharp.dll")))
        {
            return false;
        }

        if (Interlocked.Exchange(ref _bincore, bincore) is not null)
        {
            return true;
        }

        AssemblyLoadContext.Default.Resolving += (context, name) =>
        {
            if (name.Name is null ||
                !name.Name.StartsWith("Microsoft.CodeAnalysis", StringComparison.Ordinal))
            {
                return null;
            }

            var path = Path.Combine(bincore, name.Name + ".dll");

            // Version is not matched: the package reference pins a version for
            // compilation, while the SDK's Roslyn parses the language that same
            // SDK compiles.
            return File.Exists(path) ? context.LoadFromAssemblyPath(path) : null;
        };

        return true;
    }
}
