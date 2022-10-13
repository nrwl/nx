# React Tutorial - Part 2: Project Graph

Run the command: `npx nx graph`. A browser should open up with the following contents:

![Initial Project Graph](/shared/react-tutorial/initial-project-graph.png)

Notice how this is still different from the architectural design that we laid out at the start of Part 1:

![Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.png)

In Nx, your graph is primarily descriptive in nature, rather than prescriptive. Edges connecting nodes are created based on your projects' source code.

To reflect the intended architecture, make the following adjustments to your existing projects:

### `common-ui`

Run the `@nrwl/react:component` generator to create a `banner` component using the command: `npx nx g @nrwl/react:component banner --project=common-ui --export`

```bash
% npx nx g @nrwl/react:component banner --project=common-ui --export

>  NX  Generating @nrwl/react:component

CREATE libs/common-ui/src/lib/banner/banner.module.css
CREATE libs/common-ui/src/lib/banner/banner.spec.tsx
CREATE libs/common-ui/src/lib/banner/banner.tsx
UPDATE libs/common-ui/src/index.ts
```

Next create a simple banner component in your generated file:

```javascript {% fileName="libs/common-ui/src/lib/banner/banner.tsx" %}
export interface BannerProps {
  text: string;
}

export function Banner(props: BannerProps) {
  return <header>{props.text}</header>;
}

export default Banner;
```

### `admin`

Add the banner component to the admin app:

```javascript {% fileName="apps/admin/src/app/app.tsx" %}
import { Banner } from '@myorg/common-ui';

export function App() {
  return (
    <>
      <Banner text="Welcome to our admin app." />
      <div />
    </>
  );
}

export default App;
```

### `products`

Export a `Product` TS interface and some example products from this lib by making the following change:

```javascript {% fileName="libs/products/src/lib/products.ts" %}
export interface Product {
  id: string;
  name: string;
  price: number;
}

export const exampleProducts: Product[] = [
  {
    id: '1',
    name: 'Product 1',
    price: 100,
  },
  {
    id: '2',
    name: 'Product 2',
    price: 200,
  },
];
```

### `store`

Import and use both the `Banner` component from your `common-ui` lib, and the `exampleProducts` from your `products` lib:

```javascript {% fileName="apps/store/src/app/app.tsx" %}
import { Banner } from '@myorg/common-ui';
import { exampleProducts } from '@myorg/products';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function App() {
  return (
    <>
      <Banner text="Welcome to the store!" />
      <ul>
        {exampleProducts.map((product) => (
          <li key={product.id}>
            <strong>{product.name}</strong> Price: {product.price}
          </li>
        ))}
      </ul>
    </>
  );
}

export default App;
```

Now run `npx nx graph` again:

{% side-by-side %}
![Matching Graph](/shared/react-tutorial/matching-graph.png)

![Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.png)
{% /side-by-side %}

You can confirm that your graph now matches your required structure.

The Project Graph is more than just a visualization - Nx provides tooling to optimize your task-running and even automate your CI based on this graph. This will be covered in more detail in: [4: Workspace Optimization](/react-tutorial/4-workspace-optimization).

## What's Next

- Continue to [3: Task Running](/react-tutorial/3-task-running)
