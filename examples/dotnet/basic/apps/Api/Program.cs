using Catalog;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/products", () => ProductCatalog.All());

app.Run();
