# Node Nx Tutorial - Part 2: Nx Graph

Run the command: `npx nx graph`. A browser should open up with the following contents:

![Initial Nx Graph](/shared/node-tutorial/initial-project-graph.png)

Notice how this is still different from the architectural design requirements given in Part 1:

![Our Workspace Requirements](/shared/node-tutorial/requirements-diagram.png)

In Nx, your graph is primarily descriptive in nature, rather than prescriptive. Edges connecting nodes are created based on your projects' source code.

To reflect the intended architecture, make the following adjustments to your existing projects:

### `products-data-client`

Update the contents of the generated `products-data-client.ts` file to export a `Product` interface and a way to create a `ProductsDataClient` object:

```typescript {% fileName="libs/products-data-client/src/lib/products-data-client.ts" %}
export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface ProductsDataClient {
  getProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | undefined>;
}

export const exampleProducts: Record<string, Product> = {
  '1': { id: '1', name: 'Product 1', price: 100 },
  '2': { id: '2', name: 'Product 2', price: 200 },
};

export function createProductsDataClient(): ProductsDataClient {
  return {
    getProducts() {
      return Promise.resolve(Object.values(exampleProducts));
    },
    getProductById(id) {
      return Promise.resolve(exampleProducts[id]);
    },
  };
}
```

### `products-cli`

Update the generated `main.ts` file of this project to import the `createProductsDataClient()` function. Then use the data client to print the product matching the id provided at the command-line. If no id was provided, print all products as an array.

```typescript {% fileName="apps/products-cli/src/main.ts" %}
import { createProductsDataClient } from '@my-products/products-data-client';

main();

async function main() {
  const productsDataClient = createProductsDataClient();
  const id = getProvidedId();
  if (id != null) {
    const product = await productsDataClient.getProductById(id);
    console.log(JSON.stringify(product, null, 2));
  } else {
    const products = await productsDataClient.getProducts();
    console.log(JSON.stringify(products, null, 2));
  }
}

function getProvidedId() {
  return process.argv[2];
}
```

### `products-api`

Update the generated `main.ts` file of this project to also import the `createProductsDataClient()` function. Then use the data client and the express api to create an express app with 2 GET request handlers:

```javascript {% fileName="apps/products-api/src/main.ts" %}
/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */
import * as express from 'express';
import { createProductsDataClient } from '@my-products/products-data-client';

const app = express();
const productsDataClient = createProductsDataClient();

app.get('/products', async (_req, res) => {
  const products = await productsDataClient.getProducts();
  res.send(products);
});

app.get('/products/:id', async (req, res) => {
  const id = req.params.id;
  const product = await productsDataClient.getProductById(id);
  if (product == null) {
    res.status(404).send();
    return;
  }
  res.send(product);
});

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
server.on('error', console.error);
```

Now run `npx nx graph` again:

{% side-by-side %}
![Matching Graph](/shared/node-tutorial/matching-graph.png)

![Our Workspace Requirements](/shared/node-tutorial/requirements-diagram.png)
{% /side-by-side %}

You can confirm that your graph now matches your required structure.

The Nx Graph is more than just a visualization - Nx provides tooling to optimize your task-running and even automate your CI based on this graph. This will be covered in more detail in: [4: Workspace Optimization](/node-tutorial/4-workspace-optimization).

## What's Next

- Continue to [3: Task Running](/node-tutorial/3-task-running)
