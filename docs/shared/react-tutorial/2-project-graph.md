# React Monorepo Tutorial - Part 2: Project Graph

Run the command: `npx nx graph`. A browser should open up with the following contents:

![Initial Project Graph](/shared/react-tutorial/initial-project-graph.png)

This is still different than the design from the start of Part 1:

![Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.svg)

The Project Graph is derived from the source code of your workspace. Make the following adjustments to your existing projects, so that our Project Graph will match the design:

### `common-ui`

Run the `@nx/react:component` generator with the command:

```{% command="npx nx g @nx/react:component banner --project=common-ui --export" path="~/myorg" %}

>  NX  Generating @nx/react:component

CREATE libs/common-ui/src/lib/banner/banner.module.css
CREATE libs/common-ui/src/lib/banner/banner.spec.tsx
CREATE libs/common-ui/src/lib/banner/banner.tsx
UPDATE libs/common-ui/src/index.ts
```

Then create a simple `Banner` component in the generated file:

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

Add the `Banner` component to the admin app:

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

Export a `Product` TS interface and some example products:

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

Use both the `Banner` component from your `common-ui` lib, and the `exampleProducts` from your `products` lib:

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

![Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.svg)
{% /side-by-side %}

Your graph now matches the original design.

The Project Graph is more than just a visualization - Nx provides tooling to optimize your task-running and even automate your CI based on this graph. This will be covered in more detail in: [4: Workspace Optimization](/react-tutorial/4-workspace-optimization).

## What's Next

- Continue to [3: Task Running](/react-tutorial/3-task-running)
