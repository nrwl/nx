# React Nx Tutorial - Part 2: Project Graph

A significant part of the power of Nx is in the Nx graph.

Run the command: `npx nx graph`. A browser should open up with the following:

[Initial Nx Graph](/shared/react-tutorial/initial-project-graph.png)

Notice how this is still different than the architectural design that we laid out at the start of Part 1:

[Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.png)

In Nx, your graph is primarily descriptive in nature, rather than prescriptive. Edges connecting nodes are created based on your projects' source code.

{% callout type="note" title="Enforcing An Architectural Design with Tags and Boundary Rules" %}
An optional tagging feature exists in Nx which can enable you to define rules and be more prescriptive on how projects can depend on each other in your workspace.

You can read more about this in [our blog article on Mastering Project Boundaries in Nx](https://blog.nrwl.io/mastering-the-project-boundaries-in-nx-f095852f5bf43).
{% /callout %}

Accordingly, to reflect the intended architect, we'll need to add the following to our libraries:

<details>
<summary>Adding Code to Reflect Expected Design</summary>

### `common-ui`

Run the generator:

<details>
<summary>`npx nx g @nrwl/react:component banner --project=common-ui --export`</summary>

```bash
>  NX  Generating @nrwl/react:component

CREATE libs/common-ui/src/lib/banner/banner.module.css
CREATE libs/common-ui/src/lib/banner/banner.spec.tsx
CREATE libs/common-ui/src/lib/banner/banner.tsx
UPDATE libs/common-ui/src/index.ts

```

</details>
to create a banner component in this library and export it from the library's `index.ts` file.

We'll then implement a simple banner component:

```javascript {% fileName="libs/common-ui/src/lib/banner.tsx" %}
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

{% callout type="note" title="Importing from Other Nx Projects" }
Note that the `Banner` component here was available from the import path: `@myorg/common-ui`. This matches the syntax: `@<workspace name>/<project name>`.

When we run a `library` generator for the `common-ui` lib, that generator also adds the path for this library to our `tsconfig.base.json` file:

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    "paths": {
      "@myorg/common-ui": ["libs/common-ui/src/index.ts"],
      "@myorg/products": ["libs/products/src/index.ts"]
    }
  }
}
```

{% /callout }

### `products`

Export a `Product` TS interface and some example products from this lib:

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

</details>

Now if we run `npx nx graph` again, we can see that our graph matches our design:

{% side-by-side %}
[Matching Graph](/shared/react/matching-graph.png)

[Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.png)
{% /side-by-side %}

{% callout type="note" title="More Than Just A Picture" %}
The Nx Graph is more than just a visualization!

Nx provides exceptional tooling to optimize your task-running based and even automate your CI based on this graph. We'll see this in detail in: [4: Workspace Optimization](/react-tutorial/4-workspace-optimization).
{% /callout %}

## What's Next

- Continue to [3: Tasks](/react-tutorial/3-task-running)
