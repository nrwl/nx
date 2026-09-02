using Catalog;
using Xunit;

public class ProductCatalogTests
{
    [Fact]
    public void ReturnsEveryProduct()
    {
        Assert.Equal(2, ProductCatalog.All().Count);
    }
}
