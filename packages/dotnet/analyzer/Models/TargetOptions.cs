namespace MsbuildAnalyzer.Models;

/// <summary>
/// Options for executing a target command.
/// </summary>
public record TargetOptions
{
    /// <summary>
    /// The working directory for the command.
    /// </summary>
    public string? Cwd { get; init; }

    /// <summary>
    /// Command-line arguments to pass to the command.
    /// </summary>
    public string[]? Args { get; init; }
}
