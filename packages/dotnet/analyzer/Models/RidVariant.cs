namespace MsbuildAnalyzer.Models;

public sealed record RidVariant
{
    public required string RuntimeIdentifier { get; init; }

    public required Dictionary<string, EvaluatedProperties> Configurations { get; init; }

    public required object[] Inputs { get; init; }

    public required Dictionary<string, List<VariantReference>> References { get; init; }

    public bool Cacheable { get; init; } = true;
}
