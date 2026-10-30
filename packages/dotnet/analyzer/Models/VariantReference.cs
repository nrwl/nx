namespace MsbuildAnalyzer.Models;

public sealed record VariantReference
{
    public required string ProjectFile { get; init; }

    public required EvaluatedProperties Properties { get; init; }
}
