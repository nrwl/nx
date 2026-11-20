using System.Text.Json;
using System.Text.Json.Serialization;
using MsbuildAnalyzer.Models;
using Xunit;

namespace MsbuildAnalyzer.Tests;

public class ProjectMetadataTests
{
    [Fact]
    public void TargetGroups_SerializeNamedGroupsAndPreserveMemberOrder()
    {
        var metadata = new ProjectMetadata
        {
            Technologies = ["dotnet", "C#"],
            TargetGroups = new Dictionary<string, List<string>>
            {
                ["Build"] = ["build", "build:release"],
                ["Test"] = ["test", "test--second", "test--first"],
            },
        };

        var json = JsonSerializer.Serialize(metadata, new JsonSerializerOptions
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });

        Assert.Equal(
            """{"technologies":["dotnet","C#"],"targetGroups":{"Build":["build","build:release"],"Test":["test","test--second","test--first"]}}""",
            json);
    }
}
