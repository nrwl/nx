namespace MsbuildAnalyzer.Models;

/// <summary>
/// Options for executing a target command.
/// </summary>
public record TargetOptions
{
    public Dictionary<string, string>? Env { get; init; }

    public Dictionary<string, string>? NxOutputs { get; init; }

    public bool? ForwardAllArgs { get; init; }

    public string? NxArgs { get; init; }

    /// <summary>
    /// The working directory for the command.
    /// </summary>
    public string? Cwd { get; init; }

    /// <summary>
    /// Command-line arguments to pass to the command.
    /// </summary>
    public string[]? Args { get; init; }
}
