using Microsoft.Build.Locator;

namespace MsbuildAnalyzer;

/// <summary>
/// Comparer for Visual Studio instances to remove duplicates.
/// </summary>
public class VSInstanceComparer : IEqualityComparer<VisualStudioInstance>
{
    public bool Equals(VisualStudioInstance? x, VisualStudioInstance? y)
    {
        if (x == null && y == null) return true;
        if (x == null || y == null) return false;
        return x.MSBuildPath.Equals(y.MSBuildPath, StringComparison.OrdinalIgnoreCase);
    }

    public int GetHashCode(VisualStudioInstance obj)
    {
        return obj.MSBuildPath.GetHashCode(StringComparison.OrdinalIgnoreCase);
    }
}
