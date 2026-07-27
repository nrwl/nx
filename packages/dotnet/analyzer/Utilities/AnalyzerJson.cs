using System.Text.Json;
using System.Text.Json.Serialization;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// The JSON contract between the analyzer and the Nx plugin.
/// </summary>
/// <remarks>
/// Both sets live here so tests exercise the same instances the analyzer uses.
/// </remarks>
public static class AnalyzerJson
{
    /// <summary>
    /// For reading the plugin options passed on the command line.
    /// </summary>
    /// <remarks>
    /// The plugin sends <c>"class"</c>/<c>"method"</c> for the split
    /// granularity. Without the enum converter System.Text.Json will not bind
    /// a string to an enum.
    /// </remarks>
    public static JsonSerializerOptions PluginOptions { get; } = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    /// <summary>
    /// For writing the analysis result the plugin consumes.
    /// </summary>
    /// <remarks>
    /// Omitting nulls keeps output for projects that do not split unchanged as
    /// optional fields are added.
    /// </remarks>
    public static JsonSerializerOptions Output { get; } = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
}
