using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ASP.NET Core's web JSON defaults set NumberHandling to AllowReadingFromString,
// which means the API really does accept both 5 and "5". On .NET 10, where the
// emitted document is OpenAPI 3.1, that is reported honestly as a union
// ("type": ["integer", "string"]) and openapi-generator cannot map it, so the
// generated client gets an empty interface instead of `number`. Strict keeps the
// schema to a single type. It is not needed on .NET 9 (which emits OpenAPI 3.0,
// where unions are not expressible), but it is set here so the behaviour does not
// change out from under the example when the repo moves to a newer SDK.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
