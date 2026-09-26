namespace Catalog;

public record Product(string Id, string Name, int Price);

public static class ProductCatalog
{
    public static IReadOnlyList<Product> All() =>
    [
        new Product("1", "A Game of Thrones", 10000),
        new Product("2", "A Clash of Kings", 10000),
    ];
}
