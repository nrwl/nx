namespace MsbuildAnalyzer.Models;

public sealed record FrameworkVariant
{
    public required string TargetFramework { get; init; }

    public required Dictionary<string, EvaluatedProperties> Configurations { get; init; }

    public required object[] Inputs { get; init; }

    public bool Cacheable { get; init; } = true;

    public Dictionary<string, List<VariantReference>> References { get; init; } = new();

    public List<RidVariant> RidVariants { get; init; } = new();

    public EvaluatedProperties Properties => Configurations["debug"];
}
