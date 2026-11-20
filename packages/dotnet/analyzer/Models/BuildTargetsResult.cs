namespace MsbuildAnalyzer.Models;

public sealed record BuildTargetsResult
{
    public required Dictionary<string, Target> Targets { get; init; }

    public Dictionary<string, List<string>>? TargetGroups { get; init; }
}
