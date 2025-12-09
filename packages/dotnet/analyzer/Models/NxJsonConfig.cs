namespace MsbuildAnalyzer.Models;

/// <summary>
/// Simplified nx.json configuration containing only the fields we need.
/// </summary>
public class NxJsonConfig
{
    /// <summary>
    /// Named input sets defined in nx.json. Keys are the input names (e.g., "production", "default").
    /// </summary>
    public Dictionary<string, object>? NamedInputs { get; set; }
}
